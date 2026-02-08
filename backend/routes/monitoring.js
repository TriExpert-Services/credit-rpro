/**
 * Monitoring Routes
 * Health checks, APM metrics, and audit log endpoints
 * All endpoints except liveness/readiness require admin authentication.
 *
 * @module routes/monitoring
 */
const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { runHealthChecks, livenessProbe, readinessProbe } = require('../utils/healthCheck');
const { getMetrics, resetMetrics } = require('../middleware/apm');
const { getAuditLogs, auditFromRequest, AUDIT_ACTIONS } = require('../utils/auditLogger');
const { asyncHandler } = require('../utils/responseHelpers');
const { logger } = require('../utils/logger');

// ============================================
// Public probes (no auth — used by orchestrators)
// ============================================

/**
 * @route   GET /api/monitoring/liveness
 * @desc    Kubernetes-style liveness probe — is the process alive?
 * @access  Public
 */
router.get('/liveness', (req, res) => {
  res.status(200).json(livenessProbe());
});

/**
 * @route   GET /api/monitoring/readiness
 * @desc    Kubernetes-style readiness probe — can it serve traffic?
 * @access  Public
 */
router.get(
  '/readiness',
  asyncHandler(async (req, res) => {
    const result = await readinessProbe();
    const status = result.status === 'ready' ? 200 : 503;
    res.status(status).json(result);
  })
);

// ============================================
// Admin-only endpoints
// ============================================

/**
 * @route   GET /api/monitoring/health
 * @desc    Comprehensive health check — DB, services, system info
 * @access  Private (Admin)
 */
router.get(
  '/health',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const result = await runHealthChecks();
    const status = result.status === 'healthy' ? 200 : result.status === 'degraded' ? 200 : 503;

    await auditFromRequest(req, AUDIT_ACTIONS.SYSTEM_HEALTH_CHECK, 'system', null, 'Admin viewed health checks');

    res.status(status).json(result);
  })
);

/**
 * @route   GET /api/monitoring/metrics
 * @desc    Application performance metrics — throughput, latency, errors
 * @access  Private (Admin)
 */
router.get(
  '/metrics',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const metricsData = getMetrics();

    await auditFromRequest(req, AUDIT_ACTIONS.SYSTEM_METRICS_VIEWED, 'system', null, 'Admin viewed APM metrics');

    res.status(200).json({ data: metricsData });
  })
);

/**
 * @route   POST /api/monitoring/metrics/reset
 * @desc    Reset APM metrics counters
 * @access  Private (Admin)
 */
router.post(
  '/metrics/reset',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    resetMetrics();

    await auditFromRequest(req, AUDIT_ACTIONS.SYSTEM_METRICS_RESET, 'system', null, 'Admin reset APM metrics');

    res.status(200).json({ data: {}, message: 'Metrics reset successfully' });
  })
);

/**
 * @route   GET /api/monitoring/audit-logs
 * @desc    Query audit logs with filters
 * @query   userId, action, entityType, entityId, startDate, endDate, limit, offset
 * @access  Private (Admin)
 */
router.get(
  '/audit-logs',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { userId, action, entityType, entityId, startDate, endDate, limit, offset } = req.query;

    const result = await getAuditLogs({
      userId,
      action,
      entityType,
      entityId,
      startDate,
      endDate,
      limit,
      offset,
    });

    res.status(200).json({ data: result });
  })
);

module.exports = router;
