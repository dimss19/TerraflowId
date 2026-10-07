const fs = require('fs');
const path = require('path');
const { pool } = require('./connection');

async function runMigrations() {
  console.log('[Migration] Starting database migration on teraflowid...');
  const client = await pool.connect();
  
  try {
    const migrationFile = path.join(__dirname, 'migrations', '001_initial_schema.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    
    console.log('[Migration] Successfully executed 001_initial_schema.sql');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration Error]', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = runMigrations;
