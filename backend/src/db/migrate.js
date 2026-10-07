const fs = require('fs');
const path = require('path');
const { pool } = require('./connection');

async function runMigrations() {
  console.log('[Migration] Starting database migration on teraflowid...');
  const client = await pool.connect();
  
  try {
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    await client.query('BEGIN');
    for (const file of files) {
      const sqlPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, 'utf8');
      await client.query(sql);
      console.log(`[Migration] Successfully executed ${file}`);
    }
    await client.query('COMMIT');
    console.log('[Migration] All migrations completed successfully.');
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
