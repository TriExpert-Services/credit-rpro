const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

// Get dashboard stats for client
router.get('/client/:clientId', authenticateToken, async (req, res) => {
    try {
        const clientId = req.params.clientId;

        // Get latest credit scores
        const scoresResult = await query(
            `SELECT DISTINCT ON (bureau) bureau, score, score_date
             FROM credit_scores
             WHERE client_id = $1
             ORDER BY bureau, score_date DESC`,
            [clientId]
        );

        // Get credit items summary
        const itemsResult = await query(
            `SELECT status, COUNT(*) as count
             FROM credit_items
             WHERE client_id = $1
             GROUP BY status`,
            [clientId]
        );

        // Get disputes summary
        const disputesResult = await query(
            `SELECT status, COUNT(*) as count
             FROM disputes
             WHERE client_id = $1
             GROUP BY status`,
            [clientId]
        );

        // Get recent activity
        const activityResult = await query(
            `SELECT action, description, created_at
             FROM activity_log
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 10`,
            [clientId]
        );

        // Calculate score improvement
        const improvementResult = await query(
            `WITH first_scores AS (
                SELECT bureau, score
                FROM credit_scores
                WHERE client_id = $1
                ORDER BY score_date ASC
                LIMIT 3
            ),
            latest_scores AS (
                SELECT DISTINCT ON (bureau) bureau, score
                FROM credit_scores
                WHERE client_id = $1
                ORDER BY bureau, score_date DESC
            )
            SELECT 
                l.bureau,
                f.score as first_score,
                l.score as latest_score,
                (l.score - f.score) as improvement
            FROM latest_scores l
            LEFT JOIN first_scores f ON l.bureau = f.bureau`,
            [clientId]
        );

        res.json({
            currentScores: scoresResult.rows,
            itemsSummary: itemsResult.rows,
            disputesSummary: disputesResult.rows,
            recentActivity: activityResult.rows,
            scoreImprovement: improvementResult.rows
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// Get admin dashboard stats
router.get('/admin/stats', authenticateToken, async (req, res) => {
    try {
        // Total clients
        const clientsResult = await query(
            `SELECT COUNT(*) as total FROM users WHERE role = 'client'`
        );

        // Active subscriptions
        const activeSubsResult = await query(
            `SELECT COUNT(*) as active FROM client_profiles WHERE subscription_status = 'active'`
        );

        // Total disputes
        const disputesResult = await query(
            `SELECT COUNT(*) as total FROM disputes`
        );

        // Revenue this month
        const revenueResult = await query(
            `SELECT COALESCE(SUM(amount), 0) as revenue
             FROM payments
             WHERE payment_status = 'completed'
             AND payment_date >= date_trunc('month', CURRENT_DATE)`
        );

        // Recent clients
        const recentClientsResult = await query(
            `SELECT u.id, u.first_name, u.last_name, u.email, u.created_at,
                    cp.subscription_status
             FROM users u
             JOIN client_profiles cp ON u.id = cp.user_id
             WHERE u.role = 'client'
             ORDER BY u.created_at DESC
             LIMIT 10`
        );

        res.json({
            totalClients: parseInt(clientsResult.rows[0].total),
            activeSubscriptions: parseInt(activeSubsResult.rows[0].active),
            totalDisputes: parseInt(disputesResult.rows[0].total),
            monthlyRevenue: parseFloat(revenueResult.rows[0].revenue),
            recentClients: recentClientsResult.rows
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch admin dashboard data' });
    }
});

module.exports = router;
