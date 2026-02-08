/**
 * Stripe Subscription & Payment Routes
 * Complete payment integration with webhooks
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { pool, query, transaction } = require('../config/database');
const stripeService = require('../utils/stripeService');
const { sendSuccess, sendError, sendInternalError } = require('../utils/responseHelpers');
const { logger } = require('../utils/logger');
const { auditFromRequest, AUDIT_ACTIONS } = require('../utils/auditLogger');

// ============================================================================
// GET /api/subscriptions/plans - Get available subscription plans
// ============================================================================
router.get('/plans', async (req, res) => {
  logger.info({ userId: req.user?.id }, 'Getting subscription plans');
  try {
    const plans = await stripeService.getPlans();
    return sendSuccess(res, plans);
  } catch (err) {
    logger.error({ err: err.message, userId: req.user?.id }, 'Error getting subscription plans');
    return sendInternalError(res, 'Error al obtener planes');
  }
});

// ============================================================================
// GET /api/subscriptions/current - Get current user's subscription
// ============================================================================
router.get('/current', auth, async (req, res) => {
  logger.info({ userId: req.user?.id }, 'Getting current subscription');
  try {
    const subscription = await stripeService.getClientSubscription(req.user.id);
    
    if (!subscription) {
      return sendSuccess(res, { hasSubscription: false });
    }

    return sendSuccess(res, {
      hasSubscription: true,
      subscription: {
        id: subscription.id,
        planName: subscription.plan_name,
        planDescription: subscription.plan_description,
        features: subscription.features,
        status: subscription.status,
        billingCycle: subscription.billing_cycle,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        guaranteeStartDate: subscription.guarantee_start_date,
        guaranteeEndDate: subscription.guarantee_end_date,
        guaranteeDaysRemaining: subscription.guarantee_end_date 
          ? Math.max(0, Math.ceil((new Date(subscription.guarantee_end_date) - new Date()) / (1000 * 60 * 60 * 24)))
          : 0,
        disputesThisMonth: subscription.disputes_this_month,
        maxDisputesPerMonth: subscription.max_disputes_per_month,
      },
    });
  } catch (err) {
    logger.error({ err: err.message, userId: req.user?.id }, 'Error getting current subscription');
    return sendInternalError(res, 'Error al obtener suscripción');
  }
});

// ============================================================================
// GET /api/subscriptions/access-status - Check access status
// ============================================================================
router.get('/access-status', auth, async (req, res) => {
  logger.info({ userId: req.user?.id }, 'Checking subscription access status');
  try {
    console.log('Access-status check for user:', req.user.email, 'role:', req.user.role);
    
    // Admin bypass - they have full access
    if (req.user.role === 'admin' || req.user.role === 'staff') {
      console.log('Admin bypass activated for:', req.user.email);
      return sendSuccess(res, {
        isAdmin: true,
        hasAccess: true,
        onboardingComplete: true,
        hasSubscription: true,
        subscriptionStatus: 'admin',
        subscriptionPlan: 'Admin Access',
      });
    }

    const status = await stripeService.getAccessStatus(req.user.id);
    return sendSuccess(res, {
      ...status,
      isAdmin: false,
    });
  } catch (err) {
    logger.error({ err: err.message, userId: req.user?.id }, 'Error checking access status');
    return sendInternalError(res, 'Error al verificar estado de acceso');
  }
});

// ============================================================================
// POST /api/subscriptions/checkout - Create checkout session
// ============================================================================
router.post('/checkout', auth, async (req, res) => {
  logger.info({ userId: req.user?.id }, 'Creating checkout session');
  try {
    const { planId, billingCycle = 'monthly' } = req.body;

    if (!planId) {
      return sendError(res, 'Plan ID is required', 400);
    }

    // Check if onboarding personal info is completed (step 6 - before payment)
    const profileResult = await pool.query(
      `SELECT op.step_6_authorizations, op.current_step, cp.first_name, cp.last_name
       FROM client_profiles cp
       LEFT JOIN onboarding_progress op ON cp.user_id = op.client_id
       WHERE cp.user_id = $1`,
      [req.user.id]
    );

    if (!profileResult.rows[0]) {
      return sendError(res, 'Debe completar su información personal primero', 400);
    }

    // Must have completed step 6 (authorizations/terms)
    if (!profileResult.rows[0].step_6_authorizations) {
      return sendError(res, 'Debe aceptar los términos y condiciones primero', 400);
    }

    const session = await stripeService.createCheckoutSession(
      req.user.id,
      planId,
      billingCycle
    );

    auditFromRequest(req, 'subscription.created', 'subscription', session.id, 'Checkout session created').catch(() => {});
    return sendSuccess(res, { 
      sessionId: session.id,
      checkoutUrl: session.url,
    });
  } catch (err) {
    logger.error({ err: err.message, userId: req.user?.id }, 'Error creating checkout session');
    return sendInternalError(res, 'Error al crear sesión de pago');
  }
});

// ============================================================================
// POST /api/subscriptions/portal - Create customer portal session
// ============================================================================
router.post('/portal', auth, async (req, res) => {
  logger.info({ userId: req.user?.id }, 'Creating customer portal session');
  try {
    const session = await stripeService.createPortalSession(req.user.id);
    return sendSuccess(res, { url: session.url });
  } catch (err) {
    logger.error({ err: err.message, userId: req.user?.id }, 'Error creating portal session');
    return sendInternalError(res, 'Error al crear sesión del portal');
  }
});

// ============================================================================
// POST /api/subscriptions/cancel - Cancel subscription
// ============================================================================
router.post('/cancel', auth, async (req, res) => {
  logger.info({ userId: req.user?.id }, 'Cancelling subscription');
  try {
    const { reason, immediately = false } = req.body;

    if (!reason) {
      return sendError(res, 'Cancellation reason is required', 400);
    }

    const result = await stripeService.cancelSubscription(
      req.user.id,
      reason,
      immediately
    );

    auditFromRequest(req, 'subscription.cancelled', 'subscription', req.user.id, 'Subscription cancelled').catch(() => {});
    return sendSuccess(res, {
      message: immediately 
        ? 'Subscription canceled immediately'
        : 'Subscription will be canceled at the end of the billing period',
      ...result,
    });
  } catch (err) {
    logger.error({ err: err.message, userId: req.user?.id }, 'Error cancelling subscription');
    return sendInternalError(res, 'Error al cancelar suscripción');
  }
});

// ============================================================================
// GET /api/subscriptions/payments - Get payment history
// ============================================================================
router.get('/payments', auth, async (req, res) => {
  logger.info({ userId: req.user?.id }, 'Getting payment history');
  try {
    const { limit = 20, offset = 0 } = req.query;
    const history = await stripeService.getPaymentHistory(
      req.user.id,
      parseInt(limit),
      parseInt(offset)
    );
    return sendSuccess(res, history);
  } catch (err) {
    logger.error({ err: err.message, userId: req.user?.id }, 'Error getting payment history');
    return sendInternalError(res, 'Error al obtener historial de pagos');
  }
});

// ============================================================================
// POST /api/subscriptions/guarantee-claim - Request guarantee refund
// ============================================================================
router.post('/guarantee-claim', auth, async (req, res) => {
  logger.info({ userId: req.user?.id }, 'Submitting guarantee claim');
  const client = await pool.connect();
  
  try {
    const { reason } = req.body;

    if (!reason || reason.length < 20) {
      return sendError(res, 'Please provide a detailed reason (at least 20 characters)', 400);
    }

    await client.query('BEGIN');

    // Get subscription with guarantee info
    const subResult = await client.query(
      `SELECT cs.*, sp.guarantee_days
       FROM client_subscriptions cs
       JOIN subscription_plans sp ON cs.plan_id = sp.id
       WHERE cs.client_id = $1 AND cs.status IN ('active', 'trialing')
       ORDER BY cs.created_at DESC LIMIT 1`,
      [req.user.id]
    );

    if (subResult.rows.length === 0) {
      return sendError(res, 'No active subscription found', 400);
    }

    const subscription = subResult.rows[0];

    // Check if within guarantee period
    const now = new Date();
    const guaranteeEnd = new Date(subscription.guarantee_end_date);
    
    if (now > guaranteeEnd) {
      return sendError(res, 'The 90-day guarantee period has expired', 400);
    }

    if (subscription.guarantee_claimed) {
      return sendError(res, 'A guarantee claim has already been submitted', 400);
    }

    // Calculate service days and refund amount
    const serviceStart = new Date(subscription.service_start_date);
    const serviceDays = Math.ceil((now - serviceStart) / (1000 * 60 * 60 * 24));

    // Get total paid
    const paymentsResult = await client.query(
      `SELECT COALESCE(SUM(amount), 0) as total_paid
       FROM payment_transactions
       WHERE client_id = $1 AND subscription_id = $2 
         AND status = 'succeeded' AND transaction_type = 'subscription_payment'`,
      [req.user.id, subscription.id]
    );

    const totalPaid = parseFloat(paymentsResult.rows[0].total_paid);

    // Get credit scores for documentation
    const scoresResult = await client.query(
      `SELECT bureau, score, score_date 
       FROM credit_scores 
       WHERE client_id = $1 
       ORDER BY score_date DESC`,
      [req.user.id]
    );

    // Get dispute stats
    const disputeResult = await client.query(
      `SELECT 
        COUNT(*) as total_sent,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
        COUNT(*) FILTER (WHERE status IN ('resolved', 'deleted')) as deleted
       FROM disputes WHERE client_id = $1`,
      [req.user.id]
    );

    const disputeStats = disputeResult.rows[0];

    // Create guarantee claim
    await client.query(
      `INSERT INTO guarantee_claims (
        client_id, subscription_id, claim_reason,
        service_start_date, service_days, total_paid, requested_refund_amount,
        current_credit_scores, disputes_sent, items_deleted
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        req.user.id,
        subscription.id,
        reason,
        subscription.service_start_date,
        serviceDays,
        totalPaid,
        totalPaid, // Request full refund
        JSON.stringify(scoresResult.rows),
        parseInt(disputeStats.total_sent),
        parseInt(disputeStats.deleted),
      ]
    );

    // Mark subscription as guarantee requested
    await client.query(
      `UPDATE client_subscriptions SET
        status = 'guarantee_requested',
        guarantee_claimed = true,
        guarantee_claim_date = CURRENT_TIMESTAMP,
        guarantee_claim_reason = $1,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [reason, subscription.id]
    );

    // Create notification for admin
    await client.query(
      `INSERT INTO notifications (
        recipient_id, notification_type, channel, subject, message
      ) SELECT id, 'admin_alert', 'in_app', 
        'Solicitud de Garantía de 90 Días',
        $1
       FROM users WHERE role = 'admin'`,
      [`El cliente ${req.user.email} ha solicitado un reembolso por garantía. Monto: $${totalPaid}. Razón: ${reason}`]
    );

    await client.query('COMMIT');

    auditFromRequest(req, 'subscription.created', 'subscription', subscription.id, 'Guarantee claim submitted').catch(() => {});
    return sendSuccess(res, {
      message: 'Guarantee claim submitted successfully. Our team will review it within 48 hours.',
      claim: {
        serviceDays,
        totalPaid,
        requestedRefund: totalPaid,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err: err.message, userId: req.user?.id }, 'Error submitting guarantee claim');
    return sendInternalError(res, 'Error al procesar solicitud de garantía');
  } finally {
    client.release();
  }
});

// ============================================================================
// ADMIN: GET /api/subscriptions/admin/stats - Revenue statistics
// ============================================================================
router.get('/admin/stats', auth, async (req, res) => {
  logger.info({ userId: req.user?.id }, 'Getting admin subscription stats');
  if (req.user.role !== 'admin') {
    return sendError(res, 'Admin access required', 403);
  }

  try {
    // Active subscriptions
    const activeSubsResult = await pool.query(
      `SELECT COUNT(*) as active_subscriptions,
              SUM(CASE WHEN status = 'trialing' THEN 1 ELSE 0 END) as trialing
       FROM client_subscriptions WHERE status IN ('active', 'trialing')`
    );

    // Monthly revenue
    const revenueResult = await pool.query(
      `SELECT 
        COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'subscription_payment'), 0) as subscription_revenue,
        COALESCE(SUM(amount) FILTER (WHERE transaction_type IN ('refund', 'guarantee_refund')), 0) as refunds,
        COUNT(*) FILTER (WHERE transaction_type = 'subscription_payment') as payment_count
       FROM payment_transactions
       WHERE status = 'succeeded' 
         AND created_at >= date_trunc('month', CURRENT_DATE)`
    );

    // Guarantee claims
    const claimsResult = await pool.query(
      `SELECT 
        COUNT(*) as total_claims,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_claims,
        COALESCE(SUM(approved_refund_amount) FILTER (WHERE status = 'refunded'), 0) as total_refunded
       FROM guarantee_claims`
    );

    // Plan distribution
    const planDistResult = await pool.query(
      `SELECT sp.name, COUNT(*) as subscribers
       FROM client_subscriptions cs
       JOIN subscription_plans sp ON cs.plan_id = sp.id
       WHERE cs.status IN ('active', 'trialing')
       GROUP BY sp.name`
    );

    return sendSuccess(res, {
      subscriptions: {
        active: parseInt(activeSubsResult.rows[0].active_subscriptions),
        trialing: parseInt(activeSubsResult.rows[0].trialing),
      },
      monthlyRevenue: {
        gross: parseFloat(revenueResult.rows[0].subscription_revenue),
        refunds: parseFloat(revenueResult.rows[0].refunds),
        net: parseFloat(revenueResult.rows[0].subscription_revenue) - parseFloat(revenueResult.rows[0].refunds),
        paymentCount: parseInt(revenueResult.rows[0].payment_count),
      },
      guaranteeClaims: {
        total: parseInt(claimsResult.rows[0].total_claims),
        pending: parseInt(claimsResult.rows[0].pending_claims),
        totalRefunded: parseFloat(claimsResult.rows[0].total_refunded),
      },
      planDistribution: planDistResult.rows,
    });
  } catch (err) {
    logger.error({ err: err.message, userId: req.user?.id }, 'Error getting admin subscription stats');
    return sendInternalError(res, 'Error al obtener estadísticas');
  }
});

// ============================================================================
// ADMIN: GET /api/subscriptions/admin/guarantee-claims - Get guarantee claims
// ============================================================================
router.get('/admin/guarantee-claims', auth, async (req, res) => {
  logger.info({ userId: req.user?.id }, 'Getting admin guarantee claims');
  if (req.user.role !== 'admin') {
    return sendError(res, 'Admin access required', 403);
  }

  try {
    const { status = 'pending' } = req.query;
    
    const result = await pool.query(
      `SELECT gc.*, u.email, u.first_name, u.last_name
       FROM guarantee_claims gc
       JOIN users u ON gc.client_id = u.id
       WHERE gc.status = $1
       ORDER BY gc.claim_date DESC`,
      [status]
    );

    return sendSuccess(res, result.rows);
  } catch (err) {
    logger.error({ err: err.message, userId: req.user?.id }, 'Error getting guarantee claims');
    return sendInternalError(res, 'Error al obtener solicitudes de garantía');
  }
});

// ============================================================================
// ADMIN: POST /api/subscriptions/admin/process-claim - Process guarantee claim
// ============================================================================
router.post('/admin/process-claim/:claimId', auth, async (req, res) => {
  logger.info({ userId: req.user?.id, claimId: req.params.claimId }, 'Processing guarantee claim');
  if (req.user.role !== 'admin') {
    return sendError(res, 'Admin access required', 403);
  }

  const client = await pool.connect();

  try {
    const { claimId } = req.params;
    const { action, refundAmount, notes } = req.body;

    if (!['approve', 'partial', 'deny'].includes(action)) {
      return sendError(res, 'Invalid action', 400);
    }

    await client.query('BEGIN');

    // Get claim
    const claimResult = await client.query(
      'SELECT * FROM guarantee_claims WHERE id = $1',
      [claimId]
    );

    if (claimResult.rows.length === 0) {
      return sendError(res, 'Claim not found', 404);
    }

    const claim = claimResult.rows[0];

    if (action === 'deny') {
      await client.query(
        `UPDATE guarantee_claims SET
          status = 'denied',
          reviewed_by = $1,
          reviewed_at = CURRENT_TIMESTAMP,
          review_notes = $2,
          denial_reason = $3,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [req.user.id, notes, notes, claimId]
      );
    } else {
      const finalAmount = action === 'partial' ? refundAmount : claim.total_paid;

      // Process refund
      const refund = await stripeService.processRefund(
        claim.client_id,
        finalAmount,
        `90-day guarantee refund: ${notes || 'Approved'}`,
        true
      );

      await client.query(
        `UPDATE guarantee_claims SET
          status = 'refunded',
          reviewed_by = $1,
          reviewed_at = CURRENT_TIMESTAMP,
          review_notes = $2,
          approved_refund_amount = $3,
          refunded_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [req.user.id, notes, finalAmount, claimId]
      );
    }

    // Notify client
    await client.query(
      `INSERT INTO notifications (
        recipient_id, notification_type, channel, subject, message
      ) VALUES ($1, 'status_update', 'all', $2, $3)`,
      [
        claim.client_id,
        action === 'deny' ? 'Actualización de Solicitud de Garantía' : 'Reembolso de Garantía Procesado',
        action === 'deny' 
          ? `Tu solicitud de garantía ha sido revisada. Decisión: Denegada. Razón: ${notes}`
          : `Tu reembolso de garantía por $${action === 'partial' ? refundAmount : claim.total_paid} ha sido procesado.`,
      ]
    );

    await client.query('COMMIT');

    auditFromRequest(req, 'subscription.updated', 'subscription', claimId, `Guarantee claim ${action === 'deny' ? 'denied' : 'refunded'}`).catch(() => {});
    return sendSuccess(res, {
      message: action === 'deny' ? 'Claim denied' : 'Refund processed successfully',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err: err.message, userId: req.user?.id }, 'Error processing guarantee claim');
    return sendInternalError(res, 'Error al procesar solicitud');
  } finally {
    client.release();
  }
});

// ============================================================================
// ADMIN: GET /api/subscriptions/admin/transactions - All transactions
// ============================================================================
router.get('/admin/transactions', auth, async (req, res) => {
  logger.info({ userId: req.user?.id }, 'Getting admin transactions');
  if (req.user.role !== 'admin') {
    return sendError(res, 'Admin access required', 403);
  }

  try {
    const { limit = 50, offset = 0, startDate, endDate } = req.query;

    let query = `
      SELECT pt.*, u.email, u.first_name, u.last_name, sp.name as plan_name
      FROM payment_transactions pt
      JOIN users u ON pt.client_id = u.id
      LEFT JOIN client_subscriptions cs ON pt.subscription_id = cs.id
      LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (startDate) {
      paramCount++;
      query += ` AND pt.created_at >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND pt.created_at <= $${paramCount}`;
      params.push(endDate);
    }

    query += ` ORDER BY pt.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    return sendSuccess(res, result.rows);
  } catch (err) {
    logger.error({ err: err.message, userId: req.user?.id }, 'Error getting admin transactions');
    return sendInternalError(res, 'Error al obtener transacciones');
  }
});

module.exports = router;
