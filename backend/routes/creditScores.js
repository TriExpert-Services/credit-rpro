/**
 * Credit Scores Routes
 * Handle FCRA-compliant credit score tracking and reporting
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const creditScoreService = require('../utils/creditScoreService');

/**
 * POST /api/credit-scores
 * Record a new credit score
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    // Check admin or staff role
    if (!['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Staff access required' });
    }

    const { clientId, bureau, score, source, notes } = req.body;
    
    if (!clientId || !bureau || !score) {
      return res.status(400).json({
        message: 'Missing required fields: clientId, bureau, score'
      });
    }
    
    const result = await creditScoreService.recordScore(
      clientId,
      bureau,
      parseInt(score),
      source || 'manual_entry',
      notes
    );
    
    res.status(201).json({
      success: true,
      message: 'Credit score recorded successfully',
      score: result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/credit-scores/:clientId/latest
 * Get latest scores for a client (all bureaus)
 */
router.get('/:clientId/latest', authMiddleware, async (req, res) => {
  try {
    const latestScores = await creditScoreService.getLatestScores(req.params.clientId);
    
    res.json({
      success: true,
      scores: latestScores,
      bureaus: latestScores.map(s => s.bureau)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/credit-scores/:clientId/history/:bureau
 * Get score history for a specific bureau
 */
router.get('/:clientId/history/:bureau', authMiddleware, async (req, res) => {
  try {
    const limit = req.query.limit || 12;
    const history = await creditScoreService.getScoreHistory(
      req.params.clientId,
      req.params.bureau,
      limit
    );
    
    res.json({
      success: true,
      bureau: req.params.bureau,
      history,
      totalRecords: history.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/credit-scores/:clientId/trend/:bureau
 * Calculate score trend
 */
router.get('/:clientId/trend/:bureau', authMiddleware, async (req, res) => {
  try {
    const months = req.query.months || 6;
    const trend = await creditScoreService.calculateTrend(
      req.params.clientId,
      req.params.bureau,
      months
    );
    
    res.json({
      success: true,
      bureau: req.params.bureau,
      trend
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/credit-scores/:clientId/factors
 * Get score factors analysis
 */
router.get('/:clientId/factors', authMiddleware, async (req, res) => {
  try {
    const factors = await creditScoreService.getScoreFactors(req.params.clientId);
    
    res.json({
      success: true,
      factors,
      analysis: factors.analysis
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/credit-scores/:clientId/comparison
 * Get score comparison between bureaus
 */
router.get('/:clientId/comparison', authMiddleware, async (req, res) => {
  try {
    const comparison = await creditScoreService.getBureauComparison(req.params.clientId);
    
    res.json({
      success: true,
      comparison,
      interpretation: comparison.interpretation
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/credit-scores/:clientId/report
 * Generate credit report summary
 */
router.get('/:clientId/report', authMiddleware, async (req, res) => {
  try {
    const report = await creditScoreService.generateReport(req.params.clientId);
    
    res.json({
      success: true,
      report,
      recommendations: report.recommendations
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
