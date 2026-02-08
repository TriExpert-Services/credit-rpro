/**
 * Application Performance Monitoring (APM) Middleware
 * Lightweight built-in performance tracking — no external APM service required.
 * Tracks response times, slow endpoints, throughput, and error rates.
 *
 * @module middleware/apm
 */
const { logger } = require('../utils/logger');

// ============================================
// In-memory metrics store (resets on restart)
// ============================================
const metrics = {
  startedAt: new Date().toISOString(),
  requests: {
    total: 0,
    byMethod: {},
    byStatus: {},
    byRoute: {},
  },
  errors: {
    total: 0,
    recent: [], // Circular buffer — last 50 errors
  },
  performance: {
    avgResponseTime: 0,
    p95ResponseTime: 0,
    p99ResponseTime: 0,
    slowRequests: [], // Circular buffer — last 20 slow requests
    responseTimes: [], // Rolling window — last 1000 response times for percentile calculations
  },
};

const MAX_RECENT_ERRORS = 50;
const MAX_SLOW_REQUESTS = 20;
const MAX_RESPONSE_TIMES = 1000;
const SLOW_THRESHOLD_MS = parseInt(process.env.APM_SLOW_THRESHOLD_MS, 10) || 2000;

// ============================================
// APM Middleware
// ============================================

/**
 * Express middleware that tracks request performance metrics
 */
function apmMiddleware(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationMs = Math.round(durationNs / 1e6);

    // Count totals
    metrics.requests.total++;

    // By method
    metrics.requests.byMethod[req.method] = (metrics.requests.byMethod[req.method] || 0) + 1;

    // By status code group
    const statusGroup = `${Math.floor(res.statusCode / 100)}xx`;
    metrics.requests.byStatus[statusGroup] = (metrics.requests.byStatus[statusGroup] || 0) + 1;

    // By route (normalised to remove IDs)
    const routeKey = normalizeRoute(req.method, req.originalUrl);
    if (!metrics.requests.byRoute[routeKey]) {
      metrics.requests.byRoute[routeKey] = { count: 0, totalMs: 0, maxMs: 0, errors: 0 };
    }
    const routeMetrics = metrics.requests.byRoute[routeKey];
    routeMetrics.count++;
    routeMetrics.totalMs += durationMs;
    if (durationMs > routeMetrics.maxMs) routeMetrics.maxMs = durationMs;
    if (res.statusCode >= 500) routeMetrics.errors++;

    // Response time buffer for percentile calc
    metrics.performance.responseTimes.push(durationMs);
    if (metrics.performance.responseTimes.length > MAX_RESPONSE_TIMES) {
      metrics.performance.responseTimes.shift();
    }

    // Errors
    if (res.statusCode >= 500) {
      metrics.errors.total++;
      metrics.errors.recent.push({
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: durationMs,
        timestamp: new Date().toISOString(),
        userId: req.user?.id,
      });
      if (metrics.errors.recent.length > MAX_RECENT_ERRORS) {
        metrics.errors.recent.shift();
      }
    }

    // Slow request tracking
    if (durationMs >= SLOW_THRESHOLD_MS) {
      logger.warn({
        type: 'slow_request',
        method: req.method,
        url: req.originalUrl,
        duration: durationMs,
        userId: req.user?.id,
      }, `Slow request detected: ${durationMs}ms`);

      metrics.performance.slowRequests.push({
        method: req.method,
        url: req.originalUrl,
        duration: durationMs,
        status: res.statusCode,
        timestamp: new Date().toISOString(),
        userId: req.user?.id,
      });
      if (metrics.performance.slowRequests.length > MAX_SLOW_REQUESTS) {
        metrics.performance.slowRequests.shift();
      }
    }
  });

  next();
}

// ============================================
// Metrics API
// ============================================

/**
 * Return computed metrics snapshot
 * @returns {Object}
 */
function getMetrics() {
  const times = metrics.performance.responseTimes;
  const sorted = [...times].sort((a, b) => a - b);

  const avg = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
  const p95 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] : 0;
  const p99 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.99)] : 0;

  // Top slowest routes
  const topRoutes = Object.entries(metrics.requests.byRoute)
    .map(([route, data]) => ({
      route,
      count: data.count,
      avgMs: Math.round(data.totalMs / data.count),
      maxMs: data.maxMs,
      errors: data.errors,
      errorRate: data.count > 0 ? ((data.errors / data.count) * 100).toFixed(1) + '%' : '0%',
    }))
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, 15);

  const uptimeSeconds = Math.floor(process.uptime());

  return {
    startedAt: metrics.startedAt,
    uptime: uptimeSeconds,
    throughput: {
      total: metrics.requests.total,
      requestsPerMinute: uptimeSeconds > 0 ? ((metrics.requests.total / uptimeSeconds) * 60).toFixed(2) : 0,
      byMethod: metrics.requests.byMethod,
      byStatus: metrics.requests.byStatus,
    },
    performance: {
      avgResponseTime: `${avg}ms`,
      p95ResponseTime: `${p95}ms`,
      p99ResponseTime: `${p99}ms`,
      slowThreshold: `${SLOW_THRESHOLD_MS}ms`,
      slowRequests: metrics.performance.slowRequests,
    },
    errors: {
      total: metrics.errors.total,
      errorRate: metrics.requests.total > 0
        ? ((metrics.errors.total / metrics.requests.total) * 100).toFixed(2) + '%'
        : '0%',
      recent: metrics.errors.recent.slice(-10),
    },
    topRoutes,
  };
}

/**
 * Reset all metrics (useful after deployments)
 */
function resetMetrics() {
  metrics.startedAt = new Date().toISOString();
  metrics.requests = { total: 0, byMethod: {}, byStatus: {}, byRoute: {} };
  metrics.errors = { total: 0, recent: [] };
  metrics.performance = { avgResponseTime: 0, p95ResponseTime: 0, p99ResponseTime: 0, slowRequests: [], responseTimes: [] };
}

// ============================================
// Helpers
// ============================================

/**
 * Normalize a route path — replace UUIDs and numeric IDs with :id
 */
function normalizeRoute(method, url) {
  const path = url.split('?')[0]; // strip query string
  const normalized = path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+/g, '/:num');
  return `${method} ${normalized}`;
}

module.exports = {
  apmMiddleware,
  getMetrics,
  resetMetrics,
};
