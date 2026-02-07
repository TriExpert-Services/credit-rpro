/**
 * Users Routes - Secured with proper data selection and validation
 */
const express = require('express');
const router = express.Router();
const { validationResult } = require('express-validator');
const { authenticateToken, requireStaff } = require('../middleware/auth');
const { query } = require('../config/database');
const { updateProfileValidation } = require('../utils/validators');
const {
  sendSuccess,
  sendError,
  sendNotFound,
  handleValidationErrors,
  asyncHandler,
} = require('../utils/responseHelpers');

// @route   GET /api/users/profile
// @desc    Get current user profile (safe columns only)
// @access  Private
router.get(
  '/profile',
  authenticateToken,
  asyncHandler(async (req, res) => {
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
    const { role, status, limit = 50, offset = 0 } = req.query;
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const safeOffset = Math.max(0, parseInt(offset) || 0);

    let queryText = `
      SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.status, u.created_at, u.last_login,
             cp.subscription_status
      FROM users u
      LEFT JOIN client_profiles cp ON u.id = cp.user_id
      WHERE 1=1
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
    let countText = 'SELECT COUNT(*) FROM users u WHERE 1=1';
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

module.exports = router;
