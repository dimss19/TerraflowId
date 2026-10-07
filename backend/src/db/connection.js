const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool(config.db);

pool.on('error', (err) => {
  console.error('[PostgreSQL] Unexpected error on idle client:', err.message);
});

/**
 * Execute parameterized query
 * @param {string} text - SQL query with placeholders ($1, $2, etc.)
 * @param {Array} [params] - Parameter values
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (config.env === 'development' && duration > 100) {
      console.warn(`[PostgreSQL Slow Query] ${duration}ms: ${text}`);
    }
    return res;
  } catch (err) {
    console.error(`[PostgreSQL Error] Query: ${text} | Message: ${err.message}`);
    throw err;
  }
}

/**
 * Test database connectivity
 */
async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW() as now, version() as version');
    console.log('[PostgreSQL] Connected successfully to database:', config.db.database);
    return { ok: true, now: res.rows[0].now, version: res.rows[0].version };
  } catch (err) {
    console.error('[PostgreSQL] Connection failed:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = {
  pool,
  query,
  testConnection,
};
