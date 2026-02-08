/**
 * Payments Routes - Secured with ownership checks and validation
 */
const express = require('express');
const router = express.Router();
const { validationResult } = require('express-validator');
const { authenticateToken, requireStaff } = require('../middleware/auth');
const { query } = require('../config/database');
const { createPaymentValidation } = require('../utils/validators');
const {
  sendSuccess,
  sendCreated,
  sendError,
  sendForbidden,
  handleValidationErrors,
  asyncHandler,
} = require('../utils/responseHelpers');
const { logger } = require('../utils/logger');
const { auditFromRequest, AUDIT_ACTIONS } = require('../utils/auditLogger');

// Get payment history for client (with ownership check)
router.get(
  '/client/:clientId',
  authenticateToken,
  asyncHandler(async (req, res) => {
    logger.info({ userId: req.user?.id, clientId: req.params.clientId }, 'Getting payment history for client');
    const { clientId } = req.params;

    // Clients can only view their own payments
    if (req.user.role === 'client' && req.user.id !== clientId) {
      return sendForbidden(res, 'Access denied');
    }

    const { page = 1, limit = 50 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    const result = await query(
      `SELECT id, client_id, amount, payment_method, payment_status, description, payment_date, created_at
       FROM payments 
       WHERE client_id = $1 
       ORDER BY payment_date DESC
       LIMIT $2 OFFSET $3`,
      [clientId, Math.min(100, parseInt(limit)), offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) FROM payments WHERE client_id = $1',
      [clientId]
    );

    sendSuccess(res, {
      payments: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  })
);

// Create payment record (staff/admin only)
router.post(
  '/',
  authenticateToken,
  requireStaff,
  createPaymentValidation,
  asyncHandler(async (req, res) => {
    logger.info({ userId: req.user?.id }, 'Creating payment record');
    const errors = validationResult(req);
    if (handleValidationErrors(errors, res)) return;

    const { clientId, amount, paymentMethod, description } = req.body;

    const result = await query(
      `INSERT INTO payments (client_id, amount, payment_method, payment_status, description)
       VALUES ($1, $2, $3, 'completed', $4)
       RETURNING id, client_id, amount, payment_method, payment_status, description, payment_date, created_at`,
      [clientId, amount, paymentMethod, description]
    );

    auditFromRequest(req, 'payment.created', 'payment', result.rows[0].id, 'Payment record created').catch(() => {});
    sendCreated(res, { payment: result.rows[0] }, 'Payment recorded successfully');
  })
);

module.exports = router;
