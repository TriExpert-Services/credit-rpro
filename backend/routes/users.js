const express = require('express');
const router = express.Router();
const { authenticateToken, requireStaff } = require('../middleware/auth');
const { query } = require('../config/database');

// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', authenticateToken, async (req, res) => {
    try {
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
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: result.rows[0] });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authenticateToken, async (req, res) => {
    try {
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

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// @route   GET /api/users
// @desc    Get all users (admin/staff only)
// @access  Private (Staff)
router.get('/', authenticateToken, requireStaff, async (req, res) => {
    try {
        const { role, status, limit = 50, offset = 0 } = req.query;

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
        params.push(limit, offset);

        const result = await query(queryText, params);

        // Get total count
        const countResult = await query('SELECT COUNT(*) FROM users');

        res.json({
            users: result.rows,
            total: parseInt(countResult.rows[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

module.exports = router;
