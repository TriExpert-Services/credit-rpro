const { Pool } = require('pg');

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
    if (!isProduction) console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected database error:', err);
    // Don't exit on transient errors - let the pool handle reconnection
});

// Query helper - only logs in development
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        if (!isProduction) {
            const duration = Date.now() - start;
            console.log('Executed query', { text: text.substring(0, 80), duration, rows: res.rowCount });
        }
        return res;
    } catch (error) {
        console.error('Database query error:', error.message);
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
