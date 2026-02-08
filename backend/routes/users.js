/**
 * Users Routes - Secured with proper data selection and validation
 */
const express = require('express');
const router = express.Router();
const { validationResult } = require('express-validator');
const { authenticateToken, requireStaff, requireAdmin } = require('../middleware/auth');
const { query } = require('../config/database');
const { updateProfileValidation } = require('../utils/validators');
const {
  sendSuccess,
  sendError,
  sendNotFound,
  handleValidationErrors,
  asyncHandler,
} = require('../utils/responseHelpers');
const { auditFromRequest, AUDIT_ACTIONS } = require('../utils/auditLogger');
const { logger } = require('../utils/logger');

// @route   GET /api/users/profile
// @desc    Get current user profile (safe columns only)
// @access  Private
router.get(
  '/profile',
  authenticateToken,
  asyncHandler(async (req, res) => {
    logger.info({ userId: req.user?.id }, 'Get user profile');
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.status, u.created_at,
              cp.date_of_birth, cp.address_line1, cp.address_line2, cp.city, cp.state, cp.zip_code,
              cp.subscription_status, cp.subscription_start_date, cp.monthly_fee
       FROM users u
       LEFT JOIN client_profiles cp ON u.id = cp.user_id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return sendNotFound(res, 'User');
    }

    sendSuccess(res, { user: result.rows[0] });
  })
);

// @route   PUT /api/users/profile
// @desc    Update user profile (with validation)
// @access  Private
router.put(
  '/profile',
  authenticateToken,
  updateProfileValidation,
  asyncHandler(async (req, res) => {
    logger.info({ userId: req.user?.id }, 'Update user profile');
    const errors = validationResult(req);
    if (handleValidationErrors(errors, res)) return;

    const { firstName, lastName, phone, dateOfBirth, addressLine1, addressLine2, city, state, zipCode } = req.body;

    // Update user basic info
    await query(
      `UPDATE users SET 
          first_name = COALESCE($1, first_name),
          last_name = COALESCE($2, last_name),
          phone = COALESCE($3, phone),
          updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [firstName, lastName, phone, req.user.id]
    );

    // Update client profile if user is a client
    if (req.user.role === 'client') {
      await query(
        `UPDATE client_profiles SET
            date_of_birth = COALESCE($1, date_of_birth),
            address_line1 = COALESCE($2, address_line1),
            address_line2 = COALESCE($3, address_line2),
            city = COALESCE($4, city),
            state = COALESCE($5, state),
            zip_code = COALESCE($6, zip_code),
            updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $7`,
        [dateOfBirth, addressLine1, addressLine2, city, state, zipCode, req.user.id]
      );
    }

    sendSuccess(res, {}, 'Profile updated successfully');
  })
);

// @route   GET /api/users
// @desc    Get all users (admin/staff only, with pagination)
// @access  Private (Staff)
router.get(
  '/',
  authenticateToken,
  requireStaff,
  asyncHandler(async (req, res) => {
    logger.info({ userId: req.user?.id }, 'List all users');
    const { role, status, limit = 50, offset = 0 } = req.query;
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const safeOffset = Math.max(0, parseInt(offset) || 0);

    let queryText = `
      SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.status, u.created_at, u.last_login,
             cp.subscription_status
      FROM users u
      LEFT JOIN client_profiles cp ON u.id = cp.user_id
      WHERE u.deleted_at IS NULL
    `;
    const params = [];
    let paramIndex = 1;

    if (role) {
      queryText += ` AND u.role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    if (status) {
      queryText += ` AND u.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    queryText += ` ORDER BY u.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(safeLimit, safeOffset);

    const result = await query(queryText, params);

    // Get total count with same filters
    let countText = 'SELECT COUNT(*) FROM users u WHERE u.deleted_at IS NULL';
    const countParams = [];
    let countIndex = 1;
    if (role) {
      countText += ` AND u.role = $${countIndex}`;
      countParams.push(role);
      countIndex++;
    }
    if (status) {
      countText += ` AND u.status = $${countIndex}`;
      countParams.push(status);
    }
    const countResult = await query(countText, countParams);

    sendSuccess(res, {
      users: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: safeLimit,
      offset: safeOffset,
    });
  })
);

// @route   DELETE /api/users/:id
// @desc    Delete a user and all related data (admin only)
// @access  Private (Admin)
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    logger.info({ userId: req.user?.id }, 'Delete user');
    const userId = req.params.id;

    // Prevent admin from deleting themselves
    if (userId === req.user.id) {
      return sendError(res, 'No puedes eliminar tu propia cuenta', 400);
    }

    // Verify user exists and is not another admin
    const userResult = await query(
      'SELECT id, role, email, first_name, last_name FROM users WHERE id = $1 AND deleted_at IS NULL',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return sendNotFound(res, 'Usuario');
    }

    const targetUser = userResult.rows[0];

    if (targetUser.role === 'admin') {
      return sendError(res, 'No puedes eliminar a otro administrador', 403);
    }

    // Soft delete user — mark as deleted instead of physical removal
    await query(
      `UPDATE users SET deleted_at = CURRENT_TIMESTAMP, status = 'inactive', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [userId]
    );

    // Soft delete all related data
    await Promise.all([
      query(`UPDATE credit_items SET deleted_at = CURRENT_TIMESTAMP WHERE client_id = $1 AND deleted_at IS NULL`, [userId]),
      query(`UPDATE disputes SET deleted_at = CURRENT_TIMESTAMP WHERE client_id = $1 AND deleted_at IS NULL`, [userId]),
      query(`UPDATE documents SET deleted_at = CURRENT_TIMESTAMP WHERE client_id = $1 AND deleted_at IS NULL`, [userId]),
      query(`UPDATE payments SET deleted_at = CURRENT_TIMESTAMP WHERE client_id = $1 AND deleted_at IS NULL`, [userId]),
      query(`UPDATE invoices SET deleted_at = CURRENT_TIMESTAMP WHERE client_id = $1 AND deleted_at IS NULL`, [userId]),
      query(`UPDATE notifications SET deleted_at = CURRENT_TIMESTAMP WHERE recipient_id = $1 AND deleted_at IS NULL`, [userId]),
    ]);

    // Explicit audit log for user deletion
    await auditFromRequest(
      req,
      AUDIT_ACTIONS.USER_DELETED,
      'user',
      targetUser.id,
      `Admin deleted user: ${targetUser.email} (${targetUser.first_name} ${targetUser.last_name})`,
      { deletedEmail: targetUser.email, deletedRole: targetUser.role }
    );

    sendSuccess(res, {
      deletedUser: {
        id: targetUser.id,
        email: targetUser.email,
        name: `${targetUser.first_name} ${targetUser.last_name}`,
      },
    }, 'Usuario eliminado exitosamente');
  })
);

module.exports = router;
