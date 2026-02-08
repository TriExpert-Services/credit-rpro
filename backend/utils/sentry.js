/**
 * Sentry Error Tracking Integration
 * Captures unhandled errors, performance transactions, and custom events
 *
 * @module utils/sentry
 */
const Sentry = require('@sentry/node');
const { logger } = require('./logger');

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Initialize Sentry — call once at app startup before any other middleware
 * @param {import('express').Express} app - Express application
 */
function initSentry(app) {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    logger.warn('⚠️  SENTRY_DSN not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: `credit-repair-api@${process.env.npm_package_version || '1.0.0'}`,

    // Performance monitoring — sample 20% of transactions in prod, 100% in dev
    tracesSampleRate: isProduction ? 0.2 : 1.0,

    // Only send errors in production by default
    enabled: isProduction || process.env.SENTRY_FORCE_ENABLE === 'true',

    // Filter out noisy/expected errors
    beforeSend(event, hint) {
      const error = hint?.originalException;

      // Don't report 4xx client errors
      if (error?.status && error.status < 500) {
        return null;
      }

      // Don't report rate-limit hits
      if (error?.message?.includes('Too many requests')) {
        return null;
      }

      return event;
    },

    // Scrub sensitive data
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'http') {
        // Remove auth headers from breadcrumbs
        if (breadcrumb.data?.headers) {
          delete breadcrumb.data.headers.authorization;
          delete breadcrumb.data.headers.cookie;
        }
      }
      return breadcrumb;
    },

    integrations: [
      // Express integration for request context
      Sentry.expressIntegration(),
      // Postgres integration for query spans
      Sentry.postgresIntegration(),
    ],
  });

  // Sentry request handler — must be first middleware
  app.use(Sentry.expressIntegration().setupRequestHandler?.() || ((req, res, next) => next()));

  logger.info('✅ Sentry error tracking initialized');
}

/**
 * Sentry error handler middleware — must be before other error handlers
 * @returns {import('express').ErrorRequestHandler}
 */
function sentryErrorHandler() {
  if (!process.env.SENTRY_DSN) {
    return (err, req, res, next) => next(err);
  }
  return Sentry.expressErrorHandler();
}

/**
 * Capture a custom error message to Sentry
 * @param {Error|string} error - Error object or message
 * @param {Object} [context] - Additional context
 */
function captureError(error, context = {}) {
  if (!process.env.SENTRY_DSN) return;

  Sentry.withScope((scope) => {
    if (context.user) {
      scope.setUser({ id: context.user.id, email: context.user.email });
    }
    if (context.tags) {
      Object.entries(context.tags).forEach(([key, value]) => scope.setTag(key, value));
    }
    if (context.extra) {
      Object.entries(context.extra).forEach(([key, value]) => scope.setExtra(key, value));
    }

    if (typeof error === 'string') {
      Sentry.captureMessage(error, 'error');
    } else {
      Sentry.captureException(error);
    }
  });
}

/**
 * Capture a custom event/message to Sentry (info level)
 * @param {string} message - Message to capture
 * @param {Object} [data] - Additional data
 */
function captureMessage(message, data = {}) {
  if (!process.env.SENTRY_DSN) return;

  Sentry.withScope((scope) => {
    Object.entries(data).forEach(([key, value]) => scope.setExtra(key, value));
    Sentry.captureMessage(message, 'info');
  });
}

module.exports = {
  initSentry,
  sentryErrorHandler,
  captureError,
  captureMessage,
  Sentry,
};
