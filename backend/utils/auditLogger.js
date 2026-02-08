/**
 * Audit Logger Service
 * Records all admin/staff actions to the activity_log table
 * and emits structured log entries for security review.
 *
 * @module utils/auditLogger
 */
const { query } = require('../config/database');
const { logger } = require('./logger');

// ============================================
// Audit Action Types
// ============================================

const AUDIT_ACTIONS = {
  // User management
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_STATUS_CHANGED: 'user.status_changed',
  USER_ROLE_CHANGED: 'user.role_changed',

  // Credit items
  CREDIT_ITEM_CREATED: 'credit_item.created',
  CREDIT_ITEM_UPDATED: 'credit_item.updated',
  CREDIT_ITEM_DELETED: 'credit_item.deleted',

  // Disputes
  DISPUTE_CREATED: 'dispute.created',
  DISPUTE_UPDATED: 'dispute.updated',
  DISPUTE_STATUS_CHANGED: 'dispute.status_changed',
  DISPUTE_LETTER_GENERATED: 'dispute.letter_generated',
  DISPUTE_SENT: 'dispute.sent',

  // Credit scores
  CREDIT_SCORE_RECORDED: 'credit_score.recorded',

  // Documents
  DOCUMENT_UPLOADED: 'document.uploaded',
  DOCUMENT_DELETED: 'document.deleted',

  // Payments
  PAYMENT_CREATED: 'payment.created',
  PAYMENT_REFUNDED: 'payment.refunded',

  // Admin settings
  SETTINGS_UPDATED: 'settings.updated',

  // Auth events
  LOGIN_SUCCESS: 'auth.login_success',
  LOGIN_FAILED: 'auth.login_failed',
  PASSWORD_CHANGED: 'auth.password_changed',
  TWO_FA_ENABLED: 'auth.2fa_enabled',
  TWO_FA_DISABLED: 'auth.2fa_disabled',

  // Subscriptions
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_CANCELLED: 'subscription.cancelled',

  // Compliance
  CONTRACT_SIGNED: 'compliance.contract_signed',
  CONTRACT_CANCELLED: 'compliance.contract_cancelled',

  // System
  SYSTEM_HEALTH_CHECK: 'system.health_check',
  SYSTEM_METRICS_VIEWED: 'system.metrics_viewed',
  SYSTEM_METRICS_RESET: 'system.metrics_reset',
};

// ============================================
// Core Audit Functions
// ============================================

/**
 * Record an audit log entry in both the database and structured logs
 *
 * @param {Object} params
 * @param {string} params.action - Action type (use AUDIT_ACTIONS constants)
 * @param {string} [params.userId] - ID of the user performing the action
 * @param {string} [params.entityType] - Type of entity affected (user, dispute, credit_item, etc.)
 * @param {string} [params.entityId] - ID of the entity affected
 * @param {string} [params.description] - Human-readable description
 * @param {string} [params.ipAddress] - IP address of the requester
 * @param {Object} [params.metadata] - Additional structured data
 */
async function recordAudit({
  action,
  userId = null,
  entityType = null,
  entityId = null,
  description = null,
  ipAddress = null,
  metadata = null,
}) {
  // Always log to structured logger
  const logEntry = {
    audit: true,
    action,
    userId,
    entityType,
    entityId,
    ipAddress,
    metadata,
  };
  logger.info(logEntry, `AUDIT: ${description || action}`);

  // Persist to database (non-blocking — don't fail the request if logging fails)
  try {
    const desc = metadata
      ? `${description || action} | ${JSON.stringify(metadata)}`
      : description || action;

    await query(
      `INSERT INTO activity_log (user_id, action, entity_type, entity_id, description, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, entityType, entityId, desc, ipAddress]
    );
  } catch (error) {
    logger.error({ error: error.message, action, userId }, 'Failed to persist audit log');
  }
}

// ============================================
// Express Middleware - Auto Audit for Admin Routes
// ============================================

/**
 * Creates an Express middleware that automatically records audit entries
 * for admin/staff actions (POST, PUT, PATCH, DELETE methods only).
 *
 * @param {string} entityType - The entity type for audit records
 * @returns {import('express').RequestHandler}
 */
function auditMiddleware(entityType) {
  return (req, res, next) => {
    // Only audit write operations
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }

    // Only audit staff/admin actions
    if (!req.user || !['admin', 'staff'].includes(req.user.role)) {
      return next();
    }

    // Capture the original res.json to intercept the response
    const originalJson = res.json.bind(res);

    res.json = function (body) {
      // Only audit successful operations
      if (res.statusCode < 400) {
        const action = mapMethodToAction(req.method, entityType);
        const entityId = req.params.id || req.params.clientId || body?.data?.id || null;

        // Record asynchronously — don't block response
        recordAudit({
          action,
          userId: req.user.id,
          entityType,
          entityId,
          description: `${req.user.role} ${req.user.id} performed ${req.method} on ${entityType}`,
          ipAddress: req.ip,
          metadata: {
            method: req.method,
            path: req.originalUrl,
            role: req.user.role,
          },
        }).catch(() => {}); // Swallow — already logged in recordAudit
      }

      return originalJson(body);
    };

    next();
  };
}

/**
 * Convenience: record audit directly from a route handler
 * Extracts user and IP from the request object
 *
 * @param {import('express').Request} req
 * @param {string} action - Action type
 * @param {string} [entityType] - Entity type
 * @param {string} [entityId] - Entity ID
 * @param {string} [description] - Description
 * @param {Object} [metadata] - Additional data
 */
async function auditFromRequest(req, action, entityType = null, entityId = null, description = null, metadata = null) {
  await recordAudit({
    action,
    userId: req.user?.id,
    entityType,
    entityId,
    description,
    ipAddress: req.ip,
    metadata,
  });
}

/**
 * Get audit logs with filtering and pagination
 *
 * @param {Object} filters
 * @param {string} [filters.userId] - Filter by acting user
 * @param {string} [filters.action] - Filter by action type
 * @param {string} [filters.entityType] - Filter by entity type
 * @param {string} [filters.entityId] - Filter by entity ID
 * @param {string} [filters.startDate] - Start date (ISO)
 * @param {string} [filters.endDate] - End date (ISO)
 * @param {number} [filters.limit=50] - Results per page
 * @param {number} [filters.offset=0] - Offset
 * @returns {Promise<{logs: Array, total: number}>}
 */
async function getAuditLogs(filters = {}) {
  const { userId, action, entityType, entityId, startDate, endDate, limit = 50, offset = 0 } = filters;
  const safeLimit = Math.min(200, Math.max(1, parseInt(limit) || 50));
  const safeOffset = Math.max(0, parseInt(offset) || 0);

  let queryText = `
    SELECT al.*, u.email AS user_email, u.first_name, u.last_name, u.role AS user_role
    FROM activity_log al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE 1=1
  `;
  const params = [];
  let idx = 1;

  if (userId) {
    queryText += ` AND al.user_id = $${idx++}`;
    params.push(userId);
  }
  if (action) {
    queryText += ` AND al.action ILIKE $${idx++}`;
    params.push(`%${action}%`);
  }
  if (entityType) {
    queryText += ` AND al.entity_type = $${idx++}`;
    params.push(entityType);
  }
  if (entityId) {
    queryText += ` AND al.entity_id = $${idx++}`;
    params.push(entityId);
  }
  if (startDate) {
    queryText += ` AND al.created_at >= $${idx++}`;
    params.push(startDate);
  }
  if (endDate) {
    queryText += ` AND al.created_at <= $${idx++}`;
    params.push(endDate);
  }

  // Count
  const countText = queryText.replace(/SELECT al\.\*.*FROM/, 'SELECT COUNT(*) FROM');
  const countResult = await query(countText, params);

  // Data
  queryText += ` ORDER BY al.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
  params.push(safeLimit, safeOffset);

  const result = await query(queryText, params);

  return {
    logs: result.rows,
    total: parseInt(countResult.rows[0].count),
    limit: safeLimit,
    offset: safeOffset,
  };
}

// ============================================
// Helpers
// ============================================

function mapMethodToAction(method, entityType) {
  const map = {
    POST: `${entityType}.created`,
    PUT: `${entityType}.updated`,
    PATCH: `${entityType}.updated`,
    DELETE: `${entityType}.deleted`,
  };
  return map[method] || `${entityType}.${method.toLowerCase()}`;
}

module.exports = {
  AUDIT_ACTIONS,
  recordAudit,
  auditMiddleware,
  auditFromRequest,
  getAuditLogs,
};
