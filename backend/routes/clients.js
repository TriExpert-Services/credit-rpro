const express = require('express');
const router = express.Router();
const { authenticateToken, requireStaff } = require('../middleware/auth');
const { query } = require('../config/database');

// Get all clients
router.get('/', authenticateToken, requireStaff, async (req, res) => {
    try {
        const result = await query(`
            SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.created_at,
                   cp.subscription_status, cp.subscription_start_date, cp.monthly_fee,
                   COUNT(DISTINCT ci.id) as total_items,
                   COUNT(DISTINCT d.id) as total_disputes
            FROM users u
            INNER JOIN client_profiles cp ON u.id = cp.user_id
            LEFT JOIN credit_items ci ON u.id = ci.client_id
            LEFT JOIN disputes d ON u.id = d.client_id
            WHERE u.role = 'client'
            GROUP BY u.id, cp.id
            ORDER BY u.created_at DESC
        `);
        res.json({ clients: result.rows });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch clients' });
    }
});

// Get client details
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const result = await query(`
            SELECT u.*, cp.*
            FROM users u
            LEFT JOIN client_profiles cp ON u.id = cp.user_id
            WHERE u.id = $1
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        res.json({ client: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch client' });
    }
});

module.exports = router;
