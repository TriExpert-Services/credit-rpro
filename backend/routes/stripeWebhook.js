/**
 * Stripe Webhooks Handler
 * Processes all Stripe events
 */

const express = require('express');
const router = express.Router();
const stripeService = require('../utils/stripeService');

// Raw body parser for Stripe webhooks
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripeService.stripe.webhooks.constructEvent(
      req.body,
      sig,
      stripeService.WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Log webhook event
  await stripeService.logWebhookEvent(event);

  console.log('Received Stripe webhook:', event.type);

  try {
    switch (event.type) {
      // Subscription events
      case 'customer.subscription.created':
        await stripeService.handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await stripeService.handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await stripeService.handleSubscriptionDeleted(event.data.object);
        break;

      // Invoice events
      case 'invoice.payment_succeeded':
        const successInvoice = event.data.object;
        if (successInvoice.subscription) {
          await stripeService.recordPaymentTransaction(
            successInvoice,
            { id: successInvoice.payment_intent }
          );
        }
        break;

      case 'invoice.payment_failed':
        const failedInvoice = event.data.object;
        console.log('Invoice payment failed:', failedInvoice.id);
        // Handle failed payment - could send notification
        break;

      // Payment intent events
      case 'payment_intent.succeeded':
        console.log('Payment intent succeeded:', event.data.object.id);
        break;

      case 'payment_intent.payment_failed':
        console.log('Payment intent failed:', event.data.object.id);
        break;

      // Checkout session events
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('Checkout session completed:', session.id);
        // Subscription is handled by subscription.created event
        break;

      // Charge events (for refunds)
      case 'charge.refunded':
        console.log('Charge refunded:', event.data.object.id);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Mark as processed
    await stripeService.logWebhookEvent(event, true);

  } catch (err) {
    console.error('Error processing webhook:', err);
    await stripeService.logWebhookEvent(event, false, err.message);
    // Still return 200 to prevent Stripe from retrying
  }

  res.json({ received: true });
});

module.exports = router;
