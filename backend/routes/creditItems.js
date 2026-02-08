/**
 * Credit Items Routes - Secured with ownership checks and validation
 */
const express = require('express');
const router = express.Router();
const { validationResult } = require('express-validator');
const { authenticateToken, requireStaff } = require('../middleware/auth');
const { query } = require('../config/database');
const {
  addCreditItemValidation,
  CREDIT_ITEM_STATUSES,
} = require('../utils/validators');
const {
  sendSuccess,
  sendCreated,
  sendError,
  sendNotFound,
  sendForbidden,
  handleValidationErrors,
  asyncHandler,
} = require('../utils/responseHelpers');

/**
 * Verify ownership of a credit item
 */
const verifyItemOwnership = async (itemId, userId, userRole) => {
  const result = await query('SELECT client_id FROM credit_items WHERE id = $1 AND deleted_at IS NULL', [itemId]);
  if (result.rows.length === 0) return { found: false };
  const item = result.rows[0];
  if (userRole === 'admin' || userRole === 'staff') return { found: true, owned: true };
  return { found: true, owned: item.client_id === userId };
};

// Get all credit items for the current user
router.get(
  '/',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { page = 1, limit = 50 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    const result = await query(
      `SELECT ci.id, ci.client_id, ci.item_type, ci.creditor_name, ci.account_number,
              ci.bureau, ci.balance, ci.status, ci.date_opened, ci.description, 
              ci.created_at, ci.updated_at,
              COUNT(d.id) as dispute_count
       FROM credit_items ci
       LEFT JOIN disputes d ON ci.id = d.credit_item_id AND d.deleted_at IS NULL
       WHERE ci.client_id = $1 AND ci.deleted_at IS NULL
       GROUP BY ci.id
       ORDER BY ci.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, Math.min(100, parseInt(limit)), offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) FROM credit_items WHERE client_id = $1 AND deleted_at IS NULL',
      [userId]
    );

    sendSuccess(res, {
      items: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  })
);

// Get credit items for a specific client (ownership verified)
router.get(
  '/client/:clientId',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { clientId } = req.params;

    // Clients can only view their own items
    if (req.user.role === 'client' && req.user.id !== clientId) {
      return sendForbidden(res, 'Access denied');
    }

    const result = await query(
      `SELECT ci.id, ci.client_id, ci.item_type, ci.creditor_name, ci.account_number,
              ci.bureau, ci.balance, ci.status, ci.date_opened, ci.description,
              ci.created_at, ci.updated_at,
              COUNT(d.id) as dispute_count
       FROM credit_items ci
       LEFT JOIN disputes d ON ci.id = d.credit_item_id AND d.deleted_at IS NULL
       WHERE ci.client_id = $1 AND ci.deleted_at IS NULL
       GROUP BY ci.id
       ORDER BY ci.created_at DESC`,
      [clientId]
    );

    sendSuccess(res, { items: result.rows });
  })
);

// Add new credit item (with validation and ownership check)
router.post(
  '/',
  authenticateToken,
  addCreditItemValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (handleValidationErrors(errors, res)) return;

    const { clientId, itemType, creditorName, accountNumber, bureau, balance, dateOpened, description } = req.body;

    // Clients can only add items to their own profile
    if (req.user.role === 'client' && req.user.id !== clientId) {
      return sendForbidden(res, 'Access denied');
    }

    const result = await query(
      `INSERT INTO credit_items (client_id, item_type, creditor_name, account_number, bureau, balance, date_opened, description, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'identified')
       RETURNING id, client_id, item_type, creditor_name, account_number, bureau, balance, status, date_opened, description, created_at`,
      [clientId, itemType, creditorName, accountNumber, bureau, balance, dateOpened, description]
    );

    sendCreated(res, { item: result.rows[0] }, 'Credit item added');
  })
);

// Update credit item status (with ownership check)
router.put(
  '/:id/status',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { status } = req.body;

    // Validate status
    if (!status || !CREDIT_ITEM_STATUSES.includes(status.toLowerCase())) {
      return sendError(res, `Status must be one of: ${CREDIT_ITEM_STATUSES.join(', ')}`);
    }

    // Verify ownership
    const ownership = await verifyItemOwnership(req.params.id, req.user.id, req.user.role);
    if (!ownership.found) return sendNotFound(res, 'Credit item');
    if (!ownership.owned) return sendForbidden(res, 'Access denied');

    await query(
      `UPDATE credit_items SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [status.toLowerCase(), req.params.id]
    );

    sendSuccess(res, {}, 'Status updated successfully');
  })
);

// Delete credit item (with ownership check)
router.delete(
  '/:id',
  authenticateToken,
  asyncHandler(async (req, res) => {
    // Verify ownership
    const ownership = await verifyItemOwnership(req.params.id, req.user.id, req.user.role);
    if (!ownership.found) return sendNotFound(res, 'Credit item');
    if (!ownership.owned) return sendForbidden(res, 'Access denied');

    await query(
      `UPDATE credit_items SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [req.params.id]
    );
    sendSuccess(res, {}, 'Credit item deleted');
  })
);

module.exports = router;
