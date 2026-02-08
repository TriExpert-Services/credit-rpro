/**
 * XSS Sanitization Middleware
 * Recursively sanitizes all string values in req.body, req.query, and req.params
 *
 * @module middleware/sanitize
 */
const xss = require('xss');

// Custom XSS options — strip all HTML tags by default
const xssOptions = {
  whiteList: {}, // No tags allowed
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
};

/**
 * Recursively sanitize all string values in an object
 * @param {*} obj - The object to sanitize
 * @returns {*} The sanitized object
 */
function sanitizeValue(obj) {
  if (typeof obj === 'string') {
    return xss(obj, xssOptions);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeValue);
  }
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeValue(value);
    }
    return sanitized;
  }
  return obj;
}

/**
 * Express middleware that sanitizes req.body, req.query, and req.params
 * Strips HTML/script tags to prevent XSS attacks
 */
function xssSanitize(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeValue(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeValue(req.params);
  }
  next();
}

module.exports = { xssSanitize, sanitizeValue };
