/**
 * Credit Scores Routes
 * Handle FCRA-compliant credit score tracking and reporting
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const creditScoreService = require('../utils/creditScoreService');
const { validate, addCreditScoreSchema, idParam, clientIdParam } = require('../middleware/zodValidation');
const { logger } = require('../utils/logger');
const { auditFromRequest, AUDIT_ACTIONS } = require('../utils/auditLogger');

/**
 * POST /api/credit-scores
 * Record a new credit score
 */
router.post('/', authMiddleware, validate({ body: addCreditScoreSchema }), async (req, res) => {
  try {
    logger.info({ userId: req.user?.id }, 'Recording new credit score');
    // Check admin or staff role
    if (!['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Staff access required' });
    }

    const { clientId, bureau, score, source, notes } = req.body;
    
    const result = await creditScoreService.recordScore(
      clientId,
      bureau,
      parseInt(score),
      source || 'manual_entry',
      notes
    );
    
    auditFromRequest(req, 'credit_score.created', 'credit_score', result?.id, 'Credit score recorded').catch(() => {});
    
    res.status(201).json({
      success: true,
      message: 'Credit score recorded successfully',
      score: result
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error recording credit score');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/credit-scores/:clientId/latest
 * Get latest scores for a client (all bureaus)
 */
router.get('/:clientId/latest', authMiddleware, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id, clientId: req.params.clientId }, 'Fetching latest credit scores');
    const latestScores = await creditScoreService.getLatestScores(req.params.clientId);
    
    res.json({
      success: true,
      scores: latestScores,
      bureaus: latestScores.map(s => s.bureau)
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error fetching latest credit scores');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/credit-scores/:clientId/history/:bureau
 * Get score history for a specific bureau
 */
router.get('/:clientId/history/:bureau', authMiddleware, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id, clientId: req.params.clientId, bureau: req.params.bureau }, 'Fetching credit score history');
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
    logger.error({ err: error.message, userId: req.user?.id }, 'Error fetching credit score history');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/credit-scores/:clientId/trend/:bureau
 * Calculate score trend
 */
router.get('/:clientId/trend/:bureau', authMiddleware, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id, clientId: req.params.clientId, bureau: req.params.bureau }, 'Calculating credit score trend');
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
    logger.error({ err: error.message, userId: req.user?.id }, 'Error calculating credit score trend');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/credit-scores/:clientId/factors
 * Get score factors analysis
 */
router.get('/:clientId/factors', authMiddleware, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id, clientId: req.params.clientId }, 'Fetching credit score factors');
    const factors = await creditScoreService.getScoreFactors(req.params.clientId);
    
    res.json({
      success: true,
      factors,
      analysis: factors.analysis
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error fetching credit score factors');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/credit-scores/:clientId/comparison
 * Get score comparison between bureaus
 */
router.get('/:clientId/comparison', authMiddleware, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id, clientId: req.params.clientId }, 'Fetching bureau comparison');
    const comparison = await creditScoreService.getBureauComparison(req.params.clientId);
    
    res.json({
      success: true,
      comparison,
      interpretation: comparison.interpretation
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error fetching bureau comparison');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/credit-scores/:clientId/report
 * Generate credit report summary
 */
router.get('/:clientId/report', authMiddleware, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id, clientId: req.params.clientId }, 'Generating credit report');
    const report = await creditScoreService.generateReport(req.params.clientId);
    
    res.json({
      success: true,
      report,
      recommendations: report.recommendations
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error generating credit report');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/credit-scores/:clientId/anomalies
 * Detect score anomalies and generate alerts
 */
router.get('/:clientId/anomalies', authMiddleware, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id, clientId: req.params.clientId }, 'Detecting score anomalies');
    const anomalies = await creditScoreService.detectAnomalies(req.params.clientId);
    
    res.json({
      success: true,
      ...anomalies
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error detecting score anomalies');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/credit-scores/:clientId/projections
 * Project score improvements based on resolving negative items
 */
router.get('/:clientId/projections', authMiddleware, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id, clientId: req.params.clientId }, 'Projecting score improvements');
    const projections = await creditScoreService.projectImprovement(req.params.clientId);
    
    res.json({
      success: true,
      ...projections
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error projecting score improvements');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/credit-scores/:clientId/detailed-factors
 * Get detailed FICO factor analysis with weighting
 */
router.get('/:clientId/detailed-factors', authMiddleware, async (req, res) => {
  try {
    logger.info({ userId: req.user?.id, clientId: req.params.clientId }, 'Fetching detailed FICO factors');
    const factors = await creditScoreService.getDetailedFactors(req.params.clientId);
    
    res.json({
      success: true,
      factors
    });
  } catch (error) {
    logger.error({ err: error.message, userId: req.user?.id }, 'Error fetching detailed FICO factors');
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
