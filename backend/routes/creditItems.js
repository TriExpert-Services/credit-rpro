const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

// Get all credit items for a client
router.get('/client/:clientId', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            `SELECT ci.*, 
                    COUNT(d.id) as dispute_count
             FROM credit_items ci
             LEFT JOIN disputes d ON ci.id = d.credit_item_id
             WHERE ci.client_id = $1
             GROUP BY ci.id
             ORDER BY ci.created_at DESC`,
            [req.params.clientId]
        );
        res.json({ items: result.rows });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch credit items' });
    }
});

// Add new credit item
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { clientId, itemType, creditorName, accountNumber, bureau, balance, dateOpened, description } = req.body;

        const result = await query(
            `INSERT INTO credit_items (client_id, item_type, creditor_name, account_number, bureau, balance, date_opened, description, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'identified')
             RETURNING *`,
            [clientId, itemType, creditorName, accountNumber, bureau, balance, dateOpened, description]
        );

        res.status(201).json({ 
            message: 'Credit item added',
            item: result.rows[0] 
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add credit item' });
    }
});

// Update credit item status
router.put('/:id/status', authenticateToken, async (req, res) => {
    try {
        const { status } = req.body;
        
        await query(
            `UPDATE credit_items 
             SET status = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [status, req.params.id]
        );

        res.json({ message: 'Status updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// Delete credit item
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        await query('DELETE FROM credit_items WHERE id = $1', [req.params.id]);
        res.json({ message: 'Credit item deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete item' });
    }
});

module.exports = router;
