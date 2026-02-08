/**
 * Rate Limiting Configuration
 * Different limits for different endpoint sensitivities
 *
 * @module middleware/rateLimiters
 */
const rateLimit = require('express-rate-limit');

const baseOptions = {
  standardHeaders: true,
  legacyHeaders: false,
};

/**
 * General API limiter — 200 requests per 15 min
 */
const generalLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests from this IP, please try again later.' },
});

/**
 * Auth limiter — 10 attempts per 15 min (login, register)
 */
const authLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' },
});

/**
 * Sensitive operations — 30 requests per 15 min
 * For: password changes, user deletion, settings updates
 */
const sensitiveLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many sensitive operation requests. Please try again later.' },
});

/**
 * Write operations — 60 requests per 15 min
 * For: creating disputes, uploading documents, payments
 */
const writeLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Too many write requests. Please slow down.' },
});

/**
 * AI/expensive operations — 20 requests per 15 min
 * For: AI dispute generation, credit report analysis
 */
const aiLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many AI requests. Please wait before generating more.' },
});

/**
 * Upload limiter — 15 uploads per 15 min
 */
const uploadLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Too many file uploads. Please try again later.' },
});

module.exports = {
  generalLimiter,
  authLimiter,
  sensitiveLimiter,
  writeLimiter,
  aiLimiter,
  uploadLimiter,
};
