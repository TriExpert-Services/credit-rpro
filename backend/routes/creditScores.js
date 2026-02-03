const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');
const { body, validationResult } = require('express-validator');

// Get credit scores for a client
router.get('/client/:clientId', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            `SELECT * FROM credit_scores 
             WHERE client_id = $1 
             ORDER BY score_date DESC`,
            [req.params.clientId]
        );
        res.json({ scores: result.rows });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch scores' });
    }
});

// Add new credit score
router.post('/', authenticateToken, [
    body('clientId').isUUID(),
    body('bureau').isIn(['experian', 'equifax', 'transunion']),
    body('score').isInt({ min: 300, max: 850 }),
    body('scoreDate').isDate()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { clientId, bureau, score, scoreDate, notes } = req.body;

        const result = await query(
            `INSERT INTO credit_scores (client_id, bureau, score, score_date, notes)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [clientId, bureau, score, scoreDate, notes]
        );

        res.status(201).json({ 
            message: 'Credit score added',
            score: result.rows[0] 
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add score' });
    }
});

// Get score progress/trends
router.get('/client/:clientId/trends', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            `SELECT bureau, score, score_date
             FROM credit_scores
             WHERE client_id = $1
             ORDER BY score_date ASC`,
            [req.params.clientId]
        );
        res.json({ trends: result.rows });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch trends' });
    }
});

module.exports = router;
