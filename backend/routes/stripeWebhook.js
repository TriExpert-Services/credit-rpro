/**
 * Stripe Webhooks Handler
 * Processes all Stripe events
 */

const express = require('express');
const router = express.Router();
const stripeService = require('../utils/stripeService');
const { logger } = require('../utils/logger');
const { auditFromRequest, AUDIT_ACTIONS } = require('../utils/auditLogger');

// Raw body parser for Stripe webhooks
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  logger.info('Stripe webhook received');
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripeService.stripe.webhooks.constructEvent(
      req.body,
      sig,
      stripeService.WEBHOOK_SECRET
    );
  } catch (err) {
    logger.error({ err: err.message }, 'Webhook signature verification failed');
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Log webhook event
  await stripeService.logWebhookEvent(event);

  logger.info({ eventType: event.type }, 'Processing Stripe webhook event');

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
        logger.info({ invoiceId: failedInvoice.id }, 'Invoice payment failed');
        // Handle failed payment - could send notification
        break;

      // Payment intent events
      case 'payment_intent.succeeded':
        logger.info({ paymentIntentId: event.data.object.id }, 'Payment intent succeeded');
        break;

      case 'payment_intent.payment_failed':
        logger.info({ paymentIntentId: event.data.object.id }, 'Payment intent failed');
        break;

      // Checkout session events
      case 'checkout.session.completed':
        const session = event.data.object;
        logger.info({ sessionId: session.id }, 'Checkout session completed');
        // Subscription is handled by subscription.created event
        break;

      // Charge events (for refunds)
      case 'charge.refunded':
        logger.info({ chargeId: event.data.object.id }, 'Charge refunded');
        break;

      default:
        logger.info({ eventType: event.type }, 'Unhandled Stripe event type');
    }

    // Mark as processed
    await stripeService.logWebhookEvent(event, true);

  } catch (err) {
    logger.error({ err: err.message, eventType: event.type }, 'Error processing Stripe webhook');
    await stripeService.logWebhookEvent(event, false, err.message);
    // Still return 200 to prevent Stripe from retrying
  }

  res.json({ received: true });
});

module.exports = router;
