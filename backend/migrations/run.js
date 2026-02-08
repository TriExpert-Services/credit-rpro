/**
 * Database Migration Runner
 * ─────────────────────────
 * Tracks applied migrations in a `schema_migrations` table.
 * Applies any new .sql files from the migrations/ directory in order.
 * 
 * Usage:
 *   node migrations/run.js           # Apply pending migrations
 *   node migrations/run.js --status  # Show migration status
 *   node migrations/run.js --rollback 007  # (future: rollback support)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' && process.env.DATABASE_SSL === 'true'
    ? { rejectUnauthorized: false }
    : false,
});

const MIGRATIONS_DIR = path.join(__dirname);
const MIGRATIONS_TABLE = 'schema_migrations';

// ─── Ensure migrations tracking table exists ────────────────────────────────
async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      checksum VARCHAR(64) NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      execution_time_ms INTEGER,
      applied_by VARCHAR(100) DEFAULT CURRENT_USER
    )
  `);
}

// ─── Get list of already applied migrations ─────────────────────────────────
async function getAppliedMigrations(client) {
  const result = await client.query(
    `SELECT filename, checksum, applied_at FROM ${MIGRATIONS_TABLE} ORDER BY filename`
  );
  return new Map(result.rows.map(r => [r.filename, r]));
}

// ─── Get pending migration files ────────────────────────────────────────────
function getMigrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();  // Alphabetical order ensures numeric prefix ordering
}

// ─── Simple checksum for change detection ───────────────────────────────────
function checksum(content) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

// ─── Apply a single migration within a transaction ──────────────────────────
async function applyMigration(client, filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filePath, 'utf-8');
  const hash = checksum(sql);
  const start = Date.now();

  await client.query('BEGIN');
  try {
    // Split on semicolons but handle $$ blocks (PL/pgSQL functions)
    // For safety, execute the entire file as one statement batch
    await client.query(sql);

    await client.query(
      `INSERT INTO ${MIGRATIONS_TABLE} (filename, checksum, execution_time_ms) VALUES ($1, $2, $3)`,
      [filename, hash, Date.now() - start]
    );

    await client.query('COMMIT');
    return { success: true, time: Date.now() - start };
  } catch (error) {
    await client.query('ROLLBACK');
    return { success: false, error: error.message };
  }
}

// ─── Show migration status ──────────────────────────────────────────────────
async function showStatus() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);
    const files = getMigrationFiles();

    console.log('\n📊 Migration Status\n');
    console.log('  Status     | Filename                                    | Applied At');
    console.log('  -----------|---------------------------------------------|-------------------------');

    for (const file of files) {
      const migration = applied.get(file);
      if (migration) {
        const date = new Date(migration.applied_at).toISOString().replace('T', ' ').substring(0, 19);
        console.log(`  ✅ Applied | ${file.padEnd(43)} | ${date}`);
      } else {
        console.log(`  ⏳ Pending | ${file.padEnd(43)} |`);
      }
    }

    const pending = files.filter(f => !applied.has(f));
    console.log(`\n  Total: ${files.length} | Applied: ${applied.size} | Pending: ${pending.length}\n`);
  } finally {
    client.release();
  }
}

// ─── Run pending migrations ─────────────────────────────────────────────────
async function runMigrations() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);
    const files = getMigrationFiles();
    const pending = files.filter(f => !applied.has(f));

    if (pending.length === 0) {
      console.log('✅ All migrations are up to date. No pending migrations.\n');
      return;
    }

    console.log(`\n🚀 Running ${pending.length} pending migration(s)...\n`);

    let succeeded = 0;
    let failed = 0;

    for (const file of pending) {
      process.stdout.write(`  ➡️  ${file} ... `);
      const result = await applyMigration(client, file);

      if (result.success) {
        console.log(`✅ (${result.time}ms)`);
        succeeded++;
      } else {
        console.log(`❌ FAILED`);
        console.error(`     Error: ${result.error}\n`);
        failed++;
        // Stop on first failure
        console.log('⛔ Stopping migration due to failure.\n');
        break;
      }
    }

    console.log(`\n📊 Results: ${succeeded} succeeded, ${failed} failed, ${pending.length - succeeded - failed} skipped\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

// ─── CLI Entry Point ────────────────────────────────────────────────────────
const arg = process.argv[2];

if (arg === '--status') {
  showStatus().then(() => pool.end()).catch(err => {
    console.error('Error:', err.message);
    pool.end();
    process.exit(1);
  });
} else {
  runMigrations().catch(err => {
    console.error('Migration failed:', err.message);
    process.exit(1);
  });
}
