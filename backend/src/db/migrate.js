const fs = require('fs');
const path = require('path');
const { pool } = require('./connection');

// Migrasi dicatat di tabel schema_migrations sehingga setiap berkas hanya
// dijalankan sekali. Pada database lama (sebelum tabel ini ada) seluruh
// berkas akan dijalankan sekali lagi lalu dicatat - aman karena semua
// migrasi ditulis idempotent (IF NOT EXISTS / guard DO $$).
async function runMigrations() {
  console.log('[Migration] Starting database migration on teraflowid...');
  const client = await pool.connect();
  
  try {
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const appliedRes = await client.query('SELECT filename FROM schema_migrations');
    const applied = new Set(appliedRes.rows.map(r => r.filename));

    let ranCount = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sqlPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, 'utf8');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      ranCount++;
      console.log(`[Migration] Successfully executed ${file}`);
    }
    await client.query('COMMIT');
    console.log(ranCount > 0
      ? `[Migration] ${ranCount} migration(s) applied.`
      : '[Migration] Database already up to date.');
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
