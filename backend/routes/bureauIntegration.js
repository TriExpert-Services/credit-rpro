/**
 * Bureau Integration Routes
 * 
 * Endpoints for automated credit report pulling from Experian, Equifax, and TransUnion.
 * Includes report snapshots, change detection, and bureau connection management.
 * 
 * @module routes/bureauIntegration
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateUUID } = require('../utils/validators');
const { sendSuccess, sendCreated, sendError, sendNotFound, sendForbidden } = require('../utils/responseHelpers');
const { logger } = require('../utils/logger');
const { auditFromRequest } = require('../utils/auditLogger');
const bureauService = require('../utils/bureauService');

// All routes require authentication
router.use(authenticateToken);

// ============================================================================
// Bureau Status & Configuration
// ============================================================================

/**
 * GET /api/bureau/status
 * Get connection status for all three bureaus.
 * Admin/staff only.
 */
router.get('/status', requireRole('admin', 'staff'), async (req, res) => {
  logger.info({ userId: req.user.id }, 'Fetching bureau connection status');

  try {
    const statuses = bureauService.getBureauStatus();

    // Enrich with DB connection info
    const enriched = {};
    for (const bureau of ['experian', 'equifax', 'transunion']) {
      const dbStatus = await bureauService.getConnectionStatus(bureau);
      enriched[bureau] = {
        ...statuses[bureau],
        ...dbStatus,
      };
    }

    sendSuccess(res, enriched);
  } catch (error) {
    logger.error({ err: error.message }, 'Failed to fetch bureau status');
    sendError(res, 'Failed to fetch bureau status');
  }
});

/**
 * PUT /api/bureau/connections/:bureau
 * Save or update bureau API credentials.
 * Admin only.
 */
router.put('/connections/:bureau', requireRole('admin'), async (req, res) => {
  const { bureau } = req.params;
  const validBureaus = ['experian', 'equifax', 'transunion'];

  if (!validBureaus.includes(bureau)) {
    return sendError(res, 'Invalid bureau. Must be: experian, equifax, or transunion', 400);
  }

  logger.info({ userId: req.user.id, bureau }, 'Updating bureau connection');

  try {
    const connection = await bureauService.saveConnection(bureau, req.body, req.user.id);

    auditFromRequest(req, 'update', 'bureau_connection', connection.id, {
      bureau,
      action: 'credentials_updated',
    });

    sendSuccess(res, connection, 'Bureau connection updated');
  } catch (error) {
    logger.error({ bureau, err: error.message }, 'Failed to update bureau connection');
    sendError(res, 'Failed to update bureau connection');
  }
});

// ============================================================================
// Report Pulling
// ============================================================================

/**
 * POST /api/bureau/pull/:clientId/:bureau
 * Pull a credit report from a single bureau for a client.
 * Admin/staff only.
 */
router.post(
  '/pull/:clientId/:bureau',
  requireRole('admin', 'staff'),
  validateUUID('clientId', 'params'),
  async (req, res) => {
    const { clientId, bureau } = req.params;
    const validBureaus = ['experian', 'equifax', 'transunion'];

    if (!validBureaus.includes(bureau)) {
      return sendError(res, 'Invalid bureau. Must be: experian, equifax, or transunion', 400);
    }

    logger.info({ userId: req.user.id, clientId, bureau }, 'Initiating single bureau pull');

    try {
      const result = await bureauService.pullReport(clientId, bureau, req.user.id);

      auditFromRequest(req, 'create', 'bureau_pull', result.pullId, {
        clientId,
        bureau,
        snapshotId: result.snapshot?.id,
        changesDetected: result.changesDetected?.length || 0,
      });

      sendCreated(res, result, 'Credit report pulled successfully');
    } catch (error) {
      logger.error({ clientId, bureau, err: error.message }, 'Bureau pull failed');
      sendError(res, `Failed to pull ${bureau} report: ${error.message}`);
    }
  }
);

/**
 * POST /api/bureau/pull-all/:clientId
 * Pull credit reports from all three bureaus simultaneously.
 * Admin/staff only.
 */
router.post(
  '/pull-all/:clientId',
  requireRole('admin', 'staff'),
  validateUUID('clientId', 'params'),
  async (req, res) => {
    const { clientId } = req.params;

    logger.info({ userId: req.user.id, clientId }, 'Initiating tri-bureau pull');

    try {
      const results = await bureauService.pullAllBureaus(clientId, req.user.id);

      auditFromRequest(req, 'create', 'bureau_pull', null, {
        clientId,
        bureaus: ['experian', 'equifax', 'transunion'],
        results: Object.fromEntries(
          Object.entries(results.results).map(([b, r]) => [b, { success: r.success, error: r.error }])
        ),
      });

      sendCreated(res, results, 'Tri-bureau report pull completed');
    } catch (error) {
      logger.error({ clientId, err: error.message }, 'Tri-bureau pull failed');
      sendError(res, 'Failed to pull reports from all bureaus');
    }
  }
);

/**
 * POST /api/bureau/pull-own/:bureau
 * Client pulls their own credit report from a single bureau.
 * Requires active subscription.
 */
router.post('/pull-own/:bureau', async (req, res) => {
  const { bureau } = req.params;
  const validBureaus = ['experian', 'equifax', 'transunion'];

  if (!validBureaus.includes(bureau)) {
    return sendError(res, 'Invalid bureau. Must be: experian, equifax, or transunion', 400);
  }

  const clientId = req.user.id;
  logger.info({ clientId, bureau }, 'Client initiating own bureau pull');

  try {
    // Check subscription
    const { rows } = await require('../config/database').query(
      `SELECT subscription_status FROM client_profiles WHERE user_id = $1`,
      [clientId]
    );

    if (!rows[0] || !['active', 'trial'].includes(rows[0].subscription_status)) {
      return sendForbidden(res, 'Active subscription required to pull credit reports');
    }

    const result = await bureauService.pullReport(clientId, bureau, clientId, 'consumer_review');

    auditFromRequest(req, 'create', 'bureau_pull', result.pullId, {
      bureau,
      selfService: true,
    });

    sendCreated(res, result, 'Credit report pulled successfully');
  } catch (error) {
    logger.error({ clientId, bureau, err: error.message }, 'Client bureau pull failed');
    sendError(res, `Failed to pull report: ${error.message}`);
  }
});

// ============================================================================
// Snapshots & History
// ============================================================================

/**
 * GET /api/bureau/snapshots/:clientId
 * Get latest report snapshots for a client (one per bureau).
 */
router.get(
  '/snapshots/:clientId',
  validateUUID('clientId', 'params'),
  async (req, res) => {
    const { clientId } = req.params;

    // Access control
    if (req.user.role === 'client' && req.user.id !== clientId) {
      return sendForbidden(res, 'You can only view your own reports');
    }

    logger.info({ userId: req.user.id, clientId }, 'Fetching latest snapshots');

    try {
      const snapshots = await bureauService.getLatestSnapshots(clientId);
      sendSuccess(res, { snapshots });
    } catch (error) {
      logger.error({ clientId, err: error.message }, 'Failed to fetch snapshots');
      sendError(res, 'Failed to fetch report snapshots');
    }
  }
);

/**
 * GET /api/bureau/snapshots/:clientId/:bureau
 * Get snapshot history for a specific bureau.
 */
router.get(
  '/snapshots/:clientId/:bureau',
  validateUUID('clientId', 'params'),
  async (req, res) => {
    const { clientId, bureau } = req.params;
    const validBureaus = ['experian', 'equifax', 'transunion'];

    if (!validBureaus.includes(bureau)) {
      return sendError(res, 'Invalid bureau', 400);
    }

    if (req.user.role === 'client' && req.user.id !== clientId) {
      return sendForbidden(res, 'You can only view your own reports');
    }

    logger.info({ userId: req.user.id, clientId, bureau }, 'Fetching bureau snapshot history');

    try {
      const limit = parseInt(req.query.limit, 10) || 10;
      const { rows } = await require('../config/database').query(
        `SELECT id, bureau, report_id, report_date, score, changes_count, created_at
         FROM credit_report_snapshots
         WHERE client_id = $1 AND bureau = $2
         ORDER BY created_at DESC
         LIMIT $3`,
        [clientId, bureau, limit]
      );

      sendSuccess(res, { snapshots: rows });
    } catch (error) {
      logger.error({ clientId, bureau, err: error.message }, 'Failed to fetch snapshot history');
      sendError(res, 'Failed to fetch snapshot history');
    }
  }
);

/**
 * GET /api/bureau/snapshot/:snapshotId
 * Get full snapshot detail including report data.
 */
router.get(
  '/snapshot/:snapshotId',
  validateUUID('snapshotId', 'params'),
  async (req, res) => {
    const { snapshotId } = req.params;

    logger.info({ userId: req.user.id, snapshotId }, 'Fetching snapshot detail');

    try {
      const { rows } = await require('../config/database').query(
        `SELECT * FROM credit_report_snapshots WHERE id = $1`,
        [snapshotId]
      );

      if (rows.length === 0) {
        return sendNotFound(res, 'Snapshot not found');
      }

      // Access control
      if (req.user.role === 'client' && rows[0].client_id !== req.user.id) {
        return sendForbidden(res, 'You can only view your own reports');
      }

      sendSuccess(res, rows[0]);
    } catch (error) {
      logger.error({ snapshotId, err: error.message }, 'Failed to fetch snapshot');
      sendError(res, 'Failed to fetch snapshot');
    }
  }
);

// ============================================================================
// Change Detection & History
// ============================================================================

/**
 * GET /api/bureau/changes/:clientId
 * Get change history for a client with filters.
 */
router.get(
  '/changes/:clientId',
  validateUUID('clientId', 'params'),
  async (req, res) => {
    const { clientId } = req.params;

    if (req.user.role === 'client' && req.user.id !== clientId) {
      return sendForbidden(res, 'You can only view your own changes');
    }

    logger.info({ userId: req.user.id, clientId }, 'Fetching change history');

    try {
      const options = {
        bureau: req.query.bureau,
        severity: req.query.severity,
        category: req.query.category,
        limit: parseInt(req.query.limit, 10) || 50,
        offset: parseInt(req.query.offset, 10) || 0,
      };

      const result = await bureauService.getChangeHistory(clientId, options);
      sendSuccess(res, result);
    } catch (error) {
      logger.error({ clientId, err: error.message }, 'Failed to fetch change history');
      sendError(res, 'Failed to fetch change history');
    }
  }
);

/**
 * GET /api/bureau/changes/:clientId/timeline
 * Get aggregated change timeline for visualization.
 */
router.get(
  '/changes/:clientId/timeline',
  validateUUID('clientId', 'params'),
  async (req, res) => {
    const { clientId } = req.params;

    if (req.user.role === 'client' && req.user.id !== clientId) {
      return sendForbidden(res, 'You can only view your own data');
    }

    logger.info({ userId: req.user.id, clientId }, 'Fetching change timeline');

    try {
      const months = parseInt(req.query.months, 10) || 12;
      const timeline = await bureauService.getChangeTimeline(clientId, months);
      sendSuccess(res, { timeline });
    } catch (error) {
      logger.error({ clientId, err: error.message }, 'Failed to fetch timeline');
      sendError(res, 'Failed to fetch change timeline');
    }
  }
);

/**
 * GET /api/bureau/compare/:clientId
 * Cross-bureau comparison and discrepancy analysis.
 */
router.get(
  '/compare/:clientId',
  validateUUID('clientId', 'params'),
  async (req, res) => {
    const { clientId } = req.params;

    if (req.user.role === 'client' && req.user.id !== clientId) {
      return sendForbidden(res, 'You can only view your own data');
    }

    logger.info({ userId: req.user.id, clientId }, 'Running cross-bureau comparison');

    try {
      const analysis = await bureauService.analyzeCrossBureau(clientId);
      sendSuccess(res, analysis);
    } catch (error) {
      logger.error({ clientId, err: error.message }, 'Cross-bureau comparison failed');
      sendError(res, 'Failed to perform cross-bureau comparison');
    }
  }
);

// ============================================================================
// Pull History
// ============================================================================

/**
 * GET /api/bureau/pull-history/:clientId
 * Get bureau pull history for a client.
 */
router.get(
  '/pull-history/:clientId',
  validateUUID('clientId', 'params'),
  async (req, res) => {
    const { clientId } = req.params;

    if (req.user.role === 'client' && req.user.id !== clientId) {
      return sendForbidden(res, 'You can only view your own pull history');
    }

    logger.info({ userId: req.user.id, clientId }, 'Fetching pull history');

    try {
      const limit = parseInt(req.query.limit, 10) || 20;
      const history = await bureauService.getPullHistory(clientId, limit);
      sendSuccess(res, { history });
    } catch (error) {
      logger.error({ clientId, err: error.message }, 'Failed to fetch pull history');
      sendError(res, 'Failed to fetch pull history');
    }
  }
);

// ============================================================================
// Auto-Pull Configuration
// ============================================================================

/**
 * GET /api/bureau/auto-pull/:clientId
 * Get auto-pull configuration for a client.
 */
router.get(
  '/auto-pull/:clientId',
  validateUUID('clientId', 'params'),
  async (req, res) => {
    const { clientId } = req.params;

    if (req.user.role === 'client' && req.user.id !== clientId) {
      return sendForbidden(res, 'You can only view your own settings');
    }

    logger.info({ userId: req.user.id, clientId }, 'Fetching auto-pull config');

    try {
      const { rows } = await require('../config/database').query(
        `SELECT * FROM bureau_auto_pull_config WHERE client_id = $1`,
        [clientId]
      );

      sendSuccess(res, {
        config: rows[0] || {
          enabled: false,
          frequency: 'monthly',
          bureaus: ['experian', 'equifax', 'transunion'],
          nextPullDate: null,
        },
      });
    } catch (error) {
      logger.error({ clientId, err: error.message }, 'Failed to fetch auto-pull config');
      sendError(res, 'Failed to fetch auto-pull configuration');
    }
  }
);

/**
 * PUT /api/bureau/auto-pull/:clientId
 * Update auto-pull configuration for a client.
 * Admin/staff can set for any client; clients can set for themselves.
 */
router.put(
  '/auto-pull/:clientId',
  validateUUID('clientId', 'params'),
  async (req, res) => {
    const { clientId } = req.params;

    if (req.user.role === 'client' && req.user.id !== clientId) {
      return sendForbidden(res, 'You can only update your own settings');
    }

    const { enabled, frequency, bureaus } = req.body;

    // Validate
    const validFreqs = ['weekly', 'biweekly', 'monthly', 'quarterly'];
    if (frequency && !validFreqs.includes(frequency)) {
      return sendError(res, `Invalid frequency. Options: ${validFreqs.join(', ')}`, 400);
    }

    const validBureaus = ['experian', 'equifax', 'transunion'];
    if (bureaus && !Array.isArray(bureaus)) {
      return sendError(res, 'bureaus must be an array', 400);
    }
    if (bureaus && bureaus.some((b) => !validBureaus.includes(b))) {
      return sendError(res, `Invalid bureau in array. Options: ${validBureaus.join(', ')}`, 400);
    }

    logger.info({ userId: req.user.id, clientId, enabled, frequency }, 'Updating auto-pull config');

    try {
      const db = require('../config/database');

      // Calculate next pull date based on frequency
      const freqDays = { weekly: 7, biweekly: 14, monthly: 30, quarterly: 90 };
      const nextPull = enabled !== false
        ? new Date(Date.now() + (freqDays[frequency || 'monthly'] * 24 * 60 * 60 * 1000))
        : null;

      const { rows } = await db.query(
        `INSERT INTO bureau_auto_pull_config
         (client_id, enabled, frequency, bureaus, next_pull_date, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (client_id)
         DO UPDATE SET enabled = $2, frequency = $3, bureaus = $4, next_pull_date = $5,
                       updated_by = $6, updated_at = NOW()
         RETURNING *`,
        [
          clientId,
          enabled !== false,
          frequency || 'monthly',
          JSON.stringify(bureaus || validBureaus),
          nextPull,
          req.user.id,
        ]
      );

      auditFromRequest(req, 'update', 'auto_pull_config', rows[0]?.id, {
        clientId,
        enabled,
        frequency,
      });

      sendSuccess(res, { config: rows[0] }, 'Auto-pull configuration updated');
    } catch (error) {
      logger.error({ clientId, err: error.message }, 'Failed to update auto-pull config');
      sendError(res, 'Failed to update auto-pull configuration');
    }
  }
);

module.exports = router;
