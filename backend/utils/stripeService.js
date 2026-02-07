/**
 * Stripe Service - Complete Payment Integration
 * Handles subscriptions, payments, refunds, and webhooks
 */

const Stripe = require('stripe');
const { pool, query, transaction } = require('../config/database');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Create or get Stripe customer for a user
 */
async function getOrCreateCustomer(userId) {
  const userResult = await pool.query(
    'SELECT id, email, first_name, last_name, phone, stripe_customer_id FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new Error('User not found');
  }

  const user = userResult.rows[0];

  // Return existing customer
  if (user.stripe_customer_id) {
    try {
      const customer = await stripe.customers.retrieve(user.stripe_customer_id);
      if (!customer.deleted) {
        return customer;
      }
    } catch (err) {
      console.log('Stripe customer not found, creating new one');
    }
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email: user.email,
    name: `${user.first_name} ${user.last_name}`.trim(),
    phone: user.phone,
    metadata: {
      user_id: user.id,
    },
  });

  // Save customer ID to user
  await pool.query(
    'UPDATE users SET stripe_customer_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [customer.id, userId]
  );

  return customer;
}

/**
 * Get available subscription plans
 */
async function getPlans() {
  const result = await pool.query(
    `SELECT id, name, description, price_monthly, price_yearly, features, 
            guarantee_days, max_disputes_per_month, includes_ai_analysis,
            stripe_price_id_monthly, stripe_price_id_yearly
     FROM subscription_plans 
     WHERE is_active = true 
     ORDER BY sort_order`
  );
  return result.rows;
}

/**
 * Get single plan by ID
 */
async function getPlanById(planId) {
  const result = await pool.query(
    `SELECT * FROM subscription_plans WHERE id = $1 AND is_active = true`,
    [planId]
  );
  return result.rows[0];
}

/**
 * Create a subscription checkout session
 */
async function createCheckoutSession(userId, planId, billingCycle = 'monthly') {
  const customer = await getOrCreateCustomer(userId);
  const plan = await getPlanById(planId);

  if (!plan) {
    throw new Error('Plan not found');
  }

  // Get or create Stripe price
  let priceId = billingCycle === 'yearly' ? plan.stripe_price_id_yearly : plan.stripe_price_id_monthly;
  
  if (!priceId) {
    // Create price in Stripe if not exists
    const price = await createStripePrice(plan, billingCycle);
    priceId = price.id;
    
    // Save price ID
    const priceColumn = billingCycle === 'yearly' ? 'stripe_price_id_yearly' : 'stripe_price_id_monthly';
    await pool.query(
      `UPDATE subscription_plans SET ${priceColumn} = $1 WHERE id = $2`,
      [priceId, planId]
    );
  }

  const session = await stripe.checkout.sessions.create({
    customer: customer.id,
    payment_method_types: ['card'],
    line_items: [{
      price: priceId,
      quantity: 1,
    }],
    mode: 'subscription',
    success_url: `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL}/subscription/cancel`,
    subscription_data: {
      metadata: {
        user_id: userId,
        plan_id: planId,
        billing_cycle: billingCycle,
      },
    },
    metadata: {
      user_id: userId,
      plan_id: planId,
    },
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    customer_update: {
      address: 'auto',
      name: 'auto',
    },
  });

  return session;
}

/**
 * Create Stripe price for a plan
 */
async function createStripePrice(plan, billingCycle) {
  // First, get or create product
  let productId = plan.stripe_product_id;
  
  if (!productId) {
    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: {
        plan_id: plan.id,
      },
    });
    productId = product.id;
    
    await pool.query(
      'UPDATE subscription_plans SET stripe_product_id = $1 WHERE id = $2',
      [productId, plan.id]
    );
  }

  const amount = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
  const interval = billingCycle === 'yearly' ? 'year' : 'month';

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: Math.round(amount * 100), // Convert to cents
    currency: 'usd',
    recurring: {
      interval: interval,
    },
    metadata: {
      plan_id: plan.id,
      billing_cycle: billingCycle,
    },
  });

  return price;
}

/**
 * Get client's current subscription
 */
async function getClientSubscription(userId) {
  const result = await pool.query(
    `SELECT cs.*, sp.name as plan_name, sp.description as plan_description,
            sp.features, sp.guarantee_days, sp.max_disputes_per_month
     FROM client_subscriptions cs
     JOIN subscription_plans sp ON cs.plan_id = sp.id
     WHERE cs.client_id = $1 AND cs.status IN ('active', 'trialing', 'past_due')
     ORDER BY cs.created_at DESC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0];
}

/**
 * Create or update subscription from Stripe webhook
 */
async function handleSubscriptionCreated(subscription) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const userId = subscription.metadata.user_id;
    const planId = subscription.metadata.plan_id;
    const billingCycle = subscription.metadata.billing_cycle || 'monthly';

    // Check if subscription already exists
    const existingResult = await client.query(
      'SELECT id FROM client_subscriptions WHERE stripe_subscription_id = $1',
      [subscription.id]
    );

    const guaranteeEndDate = new Date();
    guaranteeEndDate.setDate(guaranteeEndDate.getDate() + 90);

    if (existingResult.rows.length > 0) {
      // Update existing
      await client.query(
        `UPDATE client_subscriptions SET
          status = $1,
          current_period_start = to_timestamp($2),
          current_period_end = to_timestamp($3),
          cancel_at_period_end = $4,
          updated_at = CURRENT_TIMESTAMP
         WHERE stripe_subscription_id = $5`,
        [
          subscription.status,
          subscription.current_period_start,
          subscription.current_period_end,
          subscription.cancel_at_period_end,
          subscription.id,
        ]
      );
    } else {
      // Create new subscription record
      await client.query(
        `INSERT INTO client_subscriptions (
          client_id, plan_id, stripe_customer_id, stripe_subscription_id,
          status, billing_cycle, current_period_start, current_period_end,
          guarantee_start_date, guarantee_end_date, service_start_date
        ) VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7), to_timestamp($8), CURRENT_DATE, $9, CURRENT_DATE)`,
        [
          userId, planId, subscription.customer, subscription.id,
          subscription.status, billingCycle,
          subscription.current_period_start, subscription.current_period_end,
          guaranteeEndDate,
        ]
      );
    }

    // Update client profile
    await client.query(
      `UPDATE client_profiles SET 
        subscription_status = $1,
        subscription_active = true,
        subscription_start_date = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [subscription.status === 'trialing' ? 'trial' : 'active', userId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Handle subscription updated
 */
async function handleSubscriptionUpdated(subscription) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE client_subscriptions SET
        status = $1,
        current_period_start = to_timestamp($2),
        current_period_end = to_timestamp($3),
        cancel_at_period_end = $4,
        canceled_at = $5,
        updated_at = CURRENT_TIMESTAMP
       WHERE stripe_subscription_id = $6`,
      [
        subscription.status,
        subscription.current_period_start,
        subscription.current_period_end,
        subscription.cancel_at_period_end,
        subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        subscription.id,
      ]
    );

    // Get user ID
    const subResult = await client.query(
      'SELECT client_id FROM client_subscriptions WHERE stripe_subscription_id = $1',
      [subscription.id]
    );

    if (subResult.rows.length > 0) {
      const isActive = ['active', 'trialing'].includes(subscription.status);
      await client.query(
        `UPDATE client_profiles SET 
          subscription_status = $1,
          subscription_active = $2,
          updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $3`,
        [subscription.status, isActive, subResult.rows[0].client_id]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Handle subscription deleted/canceled
 */
async function handleSubscriptionDeleted(subscription) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE client_subscriptions SET
        status = 'canceled',
        canceled_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
       WHERE stripe_subscription_id = $1`,
      [subscription.id]
    );

    // Get user ID and update profile
    const subResult = await client.query(
      'SELECT client_id FROM client_subscriptions WHERE stripe_subscription_id = $1',
      [subscription.id]
    );

    if (subResult.rows.length > 0) {
      await client.query(
        `UPDATE client_profiles SET 
          subscription_status = 'cancelled',
          subscription_active = false,
          subscription_end_date = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [subResult.rows[0].client_id]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Record payment transaction
 */
async function recordPaymentTransaction(invoice, paymentIntent) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Find subscription
    const subResult = await pool.query(
      'SELECT id, client_id FROM client_subscriptions WHERE stripe_subscription_id = $1',
      [invoice.subscription]
    );

    const subscriptionId = subResult.rows[0]?.id;
    const clientId = subResult.rows[0]?.client_id;

    if (!clientId) {
      // Try to find by customer
      const userResult = await pool.query(
        'SELECT id FROM users WHERE stripe_customer_id = $1',
        [invoice.customer]
      );
      if (userResult.rows.length === 0) {
        throw new Error('User not found for payment');
      }
    }

    const finalClientId = clientId || (await pool.query(
      'SELECT id FROM users WHERE stripe_customer_id = $1',
      [invoice.customer]
    )).rows[0]?.id;

    // Get payment method details
    let paymentMethodDetails = {};
    if (paymentIntent?.payment_method) {
      try {
        const pm = await stripe.paymentMethods.retrieve(paymentIntent.payment_method);
        if (pm.card) {
          paymentMethodDetails = {
            type: 'card',
            brand: pm.card.brand,
            last4: pm.card.last4,
          };
        }
      } catch (err) {
        console.error('Error getting payment method:', err);
      }
    }

    await client.query(
      `INSERT INTO payment_transactions (
        client_id, subscription_id, stripe_payment_intent_id, stripe_charge_id,
        stripe_invoice_id, transaction_type, amount, currency, status,
        payment_method_type, payment_method_last4, payment_method_brand,
        description, receipt_url, invoice_pdf_url,
        billing_period_start, billing_period_end, processed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
                to_timestamp($16), to_timestamp($17), CURRENT_TIMESTAMP)
       ON CONFLICT (stripe_payment_intent_id) DO UPDATE SET
        status = $9, processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP`,
      [
        finalClientId,
        subscriptionId,
        paymentIntent?.id || `inv_${invoice.id}`,
        invoice.charge,
        invoice.id,
        'subscription_payment',
        invoice.amount_paid / 100, // Convert from cents
        invoice.currency.toUpperCase(),
        invoice.status === 'paid' ? 'succeeded' : 'pending',
        paymentMethodDetails.type || 'card',
        paymentMethodDetails.last4,
        paymentMethodDetails.brand,
        invoice.description || `Subscription payment - ${invoice.lines?.data?.[0]?.description || 'Monthly'}`,
        invoice.hosted_invoice_url,
        invoice.invoice_pdf,
        invoice.period_start,
        invoice.period_end,
      ]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Process refund
 */
async function processRefund(userId, amount, reason, isGuaranteeRefund = false) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Get subscription
    const subResult = await client.query(
      `SELECT cs.*, u.stripe_customer_id 
       FROM client_subscriptions cs
       JOIN users u ON u.id = cs.client_id
       WHERE cs.client_id = $1 AND cs.status IN ('active', 'past_due')
       ORDER BY cs.created_at DESC LIMIT 1`,
      [userId]
    );

    if (subResult.rows.length === 0) {
      throw new Error('No active subscription found');
    }

    const subscription = subResult.rows[0];

    // Get recent payments
    const paymentsResult = await client.query(
      `SELECT stripe_payment_intent_id, amount 
       FROM payment_transactions 
       WHERE client_id = $1 AND status = 'succeeded' 
       ORDER BY created_at DESC LIMIT 3`,
      [userId]
    );

    if (paymentsResult.rows.length === 0) {
      throw new Error('No payments found to refund');
    }

    // Create refund in Stripe
    const refund = await stripe.refunds.create({
      payment_intent: paymentsResult.rows[0].stripe_payment_intent_id,
      amount: Math.round(amount * 100), // Convert to cents
      reason: isGuaranteeRefund ? 'requested_by_customer' : 'requested_by_customer',
      metadata: {
        user_id: userId,
        is_guarantee_refund: isGuaranteeRefund.toString(),
        refund_reason: reason,
      },
    });

    // Record refund transaction
    await client.query(
      `INSERT INTO payment_transactions (
        client_id, subscription_id, stripe_refund_id, transaction_type,
        amount, currency, status, description, processed_at
      ) VALUES ($1, $2, $3, $4, $5, 'USD', 'succeeded', $6, CURRENT_TIMESTAMP)`,
      [
        userId,
        subscription.id,
        refund.id,
        isGuaranteeRefund ? 'guarantee_refund' : 'refund',
        amount,
        reason,
      ]
    );

    // Cancel subscription if guarantee refund
    if (isGuaranteeRefund) {
      await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
      
      await client.query(
        `UPDATE client_subscriptions SET
          status = 'refunded',
          guarantee_claimed = true,
          guarantee_claim_date = CURRENT_TIMESTAMP,
          guarantee_claim_reason = $1,
          guarantee_refund_amount = $2,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [reason, amount, subscription.id]
      );
    }

    await client.query('COMMIT');
    return refund;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Cancel subscription
 */
async function cancelSubscription(userId, reason, cancelImmediately = false) {
  const subResult = await pool.query(
    `SELECT stripe_subscription_id FROM client_subscriptions 
     WHERE client_id = $1 AND status IN ('active', 'trialing')
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );

  if (subResult.rows.length === 0) {
    throw new Error('No active subscription found');
  }

  const stripeSubId = subResult.rows[0].stripe_subscription_id;

  if (cancelImmediately) {
    await stripe.subscriptions.cancel(stripeSubId);
  } else {
    await stripe.subscriptions.update(stripeSubId, {
      cancel_at_period_end: true,
      metadata: {
        cancellation_reason: reason,
      },
    });
  }

  await pool.query(
    `UPDATE client_subscriptions SET
      cancel_at_period_end = $1,
      cancellation_reason = $2,
      updated_at = CURRENT_TIMESTAMP
     WHERE stripe_subscription_id = $3`,
    [!cancelImmediately, reason, stripeSubId]
  );

  return { canceled: true };
}

/**
 * Get payment history for client
 */
async function getPaymentHistory(userId, limit = 20, offset = 0) {
  const result = await pool.query(
    `SELECT pt.*, sp.name as plan_name
     FROM payment_transactions pt
     LEFT JOIN client_subscriptions cs ON pt.subscription_id = cs.id
     LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id
     WHERE pt.client_id = $1
     ORDER BY pt.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  const countResult = await pool.query(
    'SELECT COUNT(*) FROM payment_transactions WHERE client_id = $1',
    [userId]
  );

  return {
    transactions: result.rows,
    total: parseInt(countResult.rows[0].count),
    limit,
    offset,
  };
}

/**
 * Create customer portal session
 */
async function createPortalSession(userId) {
  const userResult = await pool.query(
    'SELECT stripe_customer_id FROM users WHERE id = $1',
    [userId]
  );

  if (!userResult.rows[0]?.stripe_customer_id) {
    throw new Error('No Stripe customer found');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: userResult.rows[0].stripe_customer_id,
    return_url: `${process.env.FRONTEND_URL}/subscription`,
  });

  return session;
}

/**
 * Check if user has active subscription
 */
async function hasActiveSubscription(userId) {
  const result = await pool.query(
    `SELECT id FROM client_subscriptions 
     WHERE client_id = $1 AND status IN ('active', 'trialing')
     LIMIT 1`,
    [userId]
  );
  return result.rows.length > 0;
}

/**
 * Get subscription status for access control
 */
async function getAccessStatus(userId) {
  // Check onboarding
  const onboardingResult = await pool.query(
    `SELECT onboarding_completed FROM client_profiles WHERE user_id = $1`,
    [userId]
  );

  const onboardingCompleted = onboardingResult.rows[0]?.onboarding_completed || false;

  // Check subscription
  const subResult = await pool.query(
    `SELECT cs.status, cs.current_period_end, sp.name as plan_name
     FROM client_subscriptions cs
     JOIN subscription_plans sp ON cs.plan_id = sp.id
     WHERE cs.client_id = $1 AND cs.status IN ('active', 'trialing')
     ORDER BY cs.created_at DESC LIMIT 1`,
    [userId]
  );

  const hasSubscription = subResult.rows.length > 0;
  const subscription = subResult.rows[0];

  return {
    onboardingCompleted,
    hasSubscription,
    subscriptionStatus: subscription?.status || null,
    subscriptionPlan: subscription?.plan_name || null,
    currentPeriodEnd: subscription?.current_period_end || null,
    canAccess: onboardingCompleted && hasSubscription,
  };
}

/**
 * Log webhook event
 */
async function logWebhookEvent(event, processed = false, error = null) {
  await pool.query(
    `INSERT INTO stripe_webhook_logs (
      stripe_event_id, event_type, api_version, payload, processed, processing_error, processed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (stripe_event_id) DO UPDATE SET
      processed = $5, processing_error = $6, processed_at = $7`,
    [
      event.id,
      event.type,
      event.api_version,
      JSON.stringify(event),
      processed,
      error,
      processed ? new Date() : null,
    ]
  );
}

module.exports = {
  stripe,
  WEBHOOK_SECRET,
  getOrCreateCustomer,
  getPlans,
  getPlanById,
  createCheckoutSession,
  getClientSubscription,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  recordPaymentTransaction,
  processRefund,
  cancelSubscription,
  getPaymentHistory,
  createPortalSession,
  hasActiveSubscription,
  getAccessStatus,
  logWebhookEvent,
};
