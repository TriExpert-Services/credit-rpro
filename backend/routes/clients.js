const express = require('express');
const router = express.Router();
const { authenticateToken, requireStaff } = require('../middleware/auth');
const { query } = require('../config/database');
const { logger } = require('../utils/logger');
const { auditFromRequest, AUDIT_ACTIONS } = require('../utils/auditLogger');

// Get all clients
router.get('/', authenticateToken, requireStaff, async (req, res) => {
    logger.info({ userId: req.user?.id, method: 'GET', path: '/clients' }, 'Fetching all clients');
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
        logger.error({ err: error.message, userId: req.user?.id }, 'Failed to fetch clients');
        res.status(500).json({ error: 'Failed to fetch clients' });
    }
});

// Get client details
router.get('/:id', authenticateToken, async (req, res) => {
    const clientId = req.params.id;
    logger.info({ userId: req.user?.id, method: 'GET', path: `/clients/${clientId}` }, 'Fetching client details');
    try {
        const result = await query(`
            SELECT u.*, cp.*
            FROM users u
            LEFT JOIN client_profiles cp ON u.id = cp.user_id
            WHERE u.id = $1
        `, [clientId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        auditFromRequest(req, 'client.viewed', 'client', clientId, 'Viewed client details').catch(() => {});
        res.json({ client: result.rows[0] });
    } catch (error) {
        logger.error({ err: error.message, userId: req.user?.id, clientId }, 'Failed to fetch client');
        res.status(500).json({ error: 'Failed to fetch client' });
    }
});

module.exports = router;
