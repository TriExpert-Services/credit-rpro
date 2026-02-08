const { Pool } = require('pg');
const { logger } = require('../utils/logger');

const isProduction = process.env.NODE_ENV === 'production';

// ─── Connection Pool Configuration ──────────────────────────────────────────
// Tuned for production workload: ~20 concurrent connections with overflow handling
const poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: isProduction && process.env.DATABASE_SSL === 'true' 
        ? { rejectUnauthorized: false } 
        : false,
    // Pool sizing
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),            // Max connections in pool
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),             // Min idle connections kept warm
    // Timeouts
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),        // Close idle connections after 30s
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT || '5000', 10), // Fail fast if DB unreachable
    // Reaping — recycle connections to prevent memory leaks
    maxLifetimeMillis: parseInt(process.env.DB_MAX_LIFETIME || '1800000', 10),      // 30 min max connection lifetime
    // Statement timeout — kill long-running queries
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000', 10),   // 30s query timeout
    // Idle in transaction timeout
    idle_in_transaction_session_timeout: parseInt(process.env.DB_IDLE_TX_TIMEOUT || '60000', 10), // 60s
    // Connection-level settings applied on connect
    application_name: 'credit-repair-pro',
};

const pool = new Pool(poolConfig);

// ─── Pool Event Handlers ────────────────────────────────────────────────────
let totalConnections = 0;

pool.on('connect', (client) => {
    totalConnections++;
    if (!isProduction) logger.debug({ totalConnections }, 'Database connection acquired');
    // Set per-connection search_path and timezone
    client.query("SET timezone = 'UTC'").catch(() => {});
});

pool.on('remove', () => {
    totalConnections = Math.max(0, totalConnections - 1);
    if (!isProduction) logger.debug({ totalConnections }, 'Database connection removed');
});

pool.on('error', (err) => {
    logger.error({ err }, 'Unexpected database pool error');
});

// ─── Pool Health Metrics ────────────────────────────────────────────────────
const getPoolStats = () => ({
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    maxConnections: poolConfig.max,
    minConnections: poolConfig.min,
    totalConnectionsCreated: totalConnections,
});

// Query helper with structured logging
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;

        // Log slow queries (> 500ms) always; all queries in dev
        if (duration > 500) {
            logger.warn({ query: text.substring(0, 120), duration, rows: res.rowCount }, 'Slow database query');
        } else if (!isProduction) {
            logger.debug({ query: text.substring(0, 80), duration, rows: res.rowCount }, 'Query executed');
        }

        return res;
    } catch (error) {
        logger.error({ err: error.message, query: text.substring(0, 120) }, 'Database query error');
        throw error;
    }
};

// Transaction helper
const transaction = async (callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    pool,
    query,
    transaction,
    getPoolStats
};
