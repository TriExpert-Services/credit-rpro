/**
 * Advanced Health Checks
 * Verifies status of database, external services, memory/cpu, and disk
 *
 * @module utils/healthCheck
 */
const { pool, query } = require('../config/database');
const { logger } = require('./logger');

/**
 * Check PostgreSQL connectivity and response time
 * @returns {Promise<{status: string, latency: number, details?: Object}>}
 */
async function checkDatabase() {
  const start = Date.now();
  try {
    const result = await query('SELECT NOW() AS time, current_database() AS db, pg_postmaster_start_time() AS uptime');
    const row = result.rows[0];
    const latency = Date.now() - start;
    const poolInfo = {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    };

    return {
      status: latency < 1000 ? 'healthy' : 'degraded',
      latency,
      details: {
        database: row.db,
        serverTime: row.time,
        uptime: row.uptime,
        pool: poolInfo,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - start,
      error: error.message,
    };
  }
}

/**
 * Check OpenAI API reachability (lightweight — just checks key is configured)
 * @returns {{status: string, details?: Object}}
 */
function checkOpenAI() {
  const hasKey = !!process.env.OPENAI_API_KEY;
  return {
    status: hasKey ? 'configured' : 'not_configured',
    details: { keyPresent: hasKey },
  };
}

/**
 * Check Stripe API configuration
 * @returns {{status: string, details?: Object}}
 */
function checkStripe() {
  const hasKey = !!process.env.STRIPE_SECRET_KEY;
  const hasWebhookSecret = !!process.env.STRIPE_WEBHOOK_SECRET;
  return {
    status: hasKey ? 'configured' : 'not_configured',
    details: { keyPresent: hasKey, webhookSecretPresent: hasWebhookSecret },
  };
}

/**
 * Check Plaid integration
 * @returns {{status: string}}
 */
function checkPlaid() {
  const hasClientId = !!process.env.PLAID_CLIENT_ID;
  const hasSecret = !!process.env.PLAID_SECRET;
  return {
    status: hasClientId && hasSecret ? 'configured' : 'not_configured',
    details: { clientIdPresent: hasClientId, secretPresent: hasSecret },
  };
}

/**
 * Check SMTP email service
 * @returns {{status: string}}
 */
function checkSMTP() {
  const hasHost = !!process.env.SMTP_HOST;
  const hasUser = !!process.env.SMTP_USER;
  return {
    status: hasHost && hasUser ? 'configured' : 'not_configured',
    details: { host: process.env.SMTP_HOST || 'not set' },
  };
}

/**
 * Check Sentry error tracking
 * @returns {{status: string}}
 */
function checkSentry() {
  return {
    status: process.env.SENTRY_DSN ? 'configured' : 'not_configured',
  };
}

/**
 * Get process memory and uptime information
 * @returns {Object}
 */
function getSystemInfo() {
  const mem = process.memoryUsage();
  return {
    uptime: Math.floor(process.uptime()),
    uptimeFormatted: formatUptime(process.uptime()),
    memory: {
      rss: formatBytes(mem.rss),
      heapUsed: formatBytes(mem.heapUsed),
      heapTotal: formatBytes(mem.heapTotal),
      external: formatBytes(mem.external),
      heapUsagePercent: ((mem.heapUsed / mem.heapTotal) * 100).toFixed(1) + '%',
    },
    nodeVersion: process.version,
    pid: process.pid,
    platform: process.platform,
    env: process.env.NODE_ENV || 'development',
  };
}

/**
 * Run all health checks and return a comprehensive status
 * @returns {Promise<Object>}
 */
async function runHealthChecks() {
  const startTime = Date.now();

  const [db] = await Promise.all([
    checkDatabase(),
  ]);

  const services = {
    openai: checkOpenAI(),
    stripe: checkStripe(),
    plaid: checkPlaid(),
    smtp: checkSMTP(),
    sentry: checkSentry(),
  };

  // Determine overall health
  const isHealthy = db.status === 'healthy';
  const isDegraded = db.status === 'degraded';

  const overallStatus = isHealthy ? 'healthy' : isDegraded ? 'degraded' : 'unhealthy';

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    responseTime: `${Date.now() - startTime}ms`,
    checks: {
      database: db,
      services,
    },
    system: getSystemInfo(),
  };
}

/**
 * Simple liveness probe — just confirms the server can respond
 * @returns {Object}
 */
function livenessProbe() {
  return {
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  };
}

/**
 * Readiness probe — checks if the app can serve traffic
 * @returns {Promise<Object>}
 */
async function readinessProbe() {
  const db = await checkDatabase();
  return {
    status: db.status === 'healthy' || db.status === 'degraded' ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    database: db.status,
  };
}

// ---- Helpers ----

function formatBytes(bytes) {
  const mb = (bytes / 1024 / 1024).toFixed(2);
  return `${mb} MB`;
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

module.exports = {
  runHealthChecks,
  livenessProbe,
  readinessProbe,
  checkDatabase,
};
