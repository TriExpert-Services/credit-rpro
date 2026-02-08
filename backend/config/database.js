const { Pool } = require('pg');
const { logger } = require('../utils/logger');

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isProduction && process.env.DATABASE_SSL === 'true' 
        ? { rejectUnauthorized: false } 
        : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
    if (!isProduction) logger.debug('Database connection established');
});

pool.on('error', (err) => {
    logger.error({ err }, 'Unexpected database pool error');
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
    transaction
};
