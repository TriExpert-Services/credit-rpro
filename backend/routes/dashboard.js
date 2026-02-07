/**
 * Dashboard Routes - Secured with ownership checks
 */
const express = require('express');
const router = express.Router();
const { authenticateToken, requireStaff } = require('../middleware/auth');
const { query } = require('../config/database');
const { sendSuccess, sendForbidden, asyncHandler } = require('../utils/responseHelpers');

// Get dashboard stats for client (with ownership check)
router.get(
  '/client/:clientId',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const clientId = req.params.clientId;

    // Clients can only view their own dashboard
    if (req.user.role === 'client' && req.user.id !== clientId) {
      return sendForbidden(res, 'Access denied');
    }

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

    // Calculate score improvement - fixed query using DISTINCT ON per bureau
    const improvementResult = await query(
      `WITH first_scores AS (
          SELECT DISTINCT ON (bureau) bureau, score
          FROM credit_scores
          WHERE client_id = $1
          ORDER BY bureau, score_date ASC
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

    sendSuccess(res, {
      currentScores: scoresResult.rows,
      itemsSummary: itemsResult.rows,
      disputesSummary: disputesResult.rows,
      recentActivity: activityResult.rows,
      scoreImprovement: improvementResult.rows,
    });
  })
);

// Get admin dashboard stats (admin/staff only)
router.get(
  '/admin/stats',
  authenticateToken,
  requireStaff,
  asyncHandler(async (req, res) => {
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

    // Recent clients (no password_hash or sensitive data)
    const recentClientsResult = await query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.created_at,
              cp.subscription_status
       FROM users u
       JOIN client_profiles cp ON u.id = cp.user_id
       WHERE u.role = 'client'
       ORDER BY u.created_at DESC
       LIMIT 10`
    );

    // Disputes by status
    const disputesByStatus = await query(
      `SELECT status, COUNT(*) as count FROM disputes GROUP BY status`
    );

    // Monthly revenue trend (last 6 months)
    const revenueTrend = await query(
      `SELECT 
        date_trunc('month', payment_date) as month,
        SUM(amount) as total
       FROM payments
       WHERE payment_status = 'completed'
       AND payment_date >= CURRENT_DATE - INTERVAL '6 months'
       GROUP BY date_trunc('month', payment_date)
       ORDER BY month`
    );

    sendSuccess(res, {
      totalClients: parseInt(clientsResult.rows[0].total),
      activeSubscriptions: parseInt(activeSubsResult.rows[0].active),
      totalDisputes: parseInt(disputesResult.rows[0].total),
      monthlyRevenue: parseFloat(revenueResult.rows[0].revenue),
      recentClients: recentClientsResult.rows,
      disputesByStatus: disputesByStatus.rows,
      revenueTrend: revenueTrend.rows,
    });
  })
);

module.exports = router;
