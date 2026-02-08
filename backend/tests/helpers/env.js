/**
 * Jest global setup — environment variables for test runs.
 * Referenced by jest.config.js → setupFiles.
 */

// Prevent Sentry / Auth0 / Stripe from activating
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.PORT = '0'; // random port
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.AUTH0_DOMAIN = '';      // disable Auth0
process.env.AUTH0_AUDIENCE = '';
process.env.STRIPE_SECRET_KEY = '';
process.env.SENTRY_DSN = '';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
