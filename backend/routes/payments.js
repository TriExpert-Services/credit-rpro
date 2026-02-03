const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

// Get payment history for client
router.get('/client/:clientId', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            `SELECT * FROM payments 
             WHERE client_id = $1 
             ORDER BY payment_date DESC`,
            [req.params.clientId]
        );
        res.json({ payments: result.rows });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
});

// Create payment record (integrate with Stripe later)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { clientId, amount, paymentMethod, description } = req.body;

        const result = await query(
            `INSERT INTO payments (client_id, amount, payment_method, payment_status, description)
             VALUES ($1, $2, $3, 'completed', $4)
             RETURNING *`,
            [clientId, amount, paymentMethod, description]
        );

        res.status(201).json({
            message: 'Payment recorded successfully',
            payment: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to record payment' });
    }
});

module.exports = router;
