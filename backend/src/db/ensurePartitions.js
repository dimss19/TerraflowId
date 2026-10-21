/**
 * ==============================================================
 *  TerraFlow AWLR — Pemeliharaan Partisi readings
 * ==============================================================
 *  Tabel `readings` dipartisi RANGE per bulan (readings_YYYY_MM)
 *  dengan `readings_default` sebagai penampung sisa.
 *
 *  Tanpa partisi bulanan yang dibuat otomatis, seluruh data setelah
 *  bulan terakhir akan menumpuk di `readings_default` - tidak ada data
 *  yang hilang, tetapi performanya menurun drastis karena query tidak
 *  lagi bisa memangkas partisi.
 *
 *  Skrip ini idempotent: aman dijalankan berkali-kali.
 *
 * Environment variable yang dibaca:
 *    READINGS_PARTITION_MONTHS_AHEAD  berapa bulan ke depan yang
 *                                    perlu disiapkan (default 2)
 *    READINGS_RETENTION_MONTHS       berapa bulan lama data disimpan;
 *                                    0 = simpan semua (default 0)
 * ==============================================================
 */

const { pool } = require('./connection');

const MONTHS_AHEAD = Math.max(
  1,
  parseInt(process.env.READINGS_PARTITION_MONTHS_AHEAD || '3', 10) || 3
);
const RETENTION_MONTHS = Math.max(
  0,
  parseInt(process.env.READINGS_RETENTION_MONTHS || '0', 10) || 0
);

const TABLE = 'readings';
const DEFAULT_PARTITION = 'readings_default';

/**
 * Nama partisi untuk satu bulan, mis. 2026-11 -> readings_2026_11
 */
function partitionName(year, month) {
  return `readings_${year}_${String(month).padStart(2, '0')}`;
}

/**
 * Rentang [dari, sampai) dalam UTC untuk satu bulan.
 */
function monthRange(year, month) {
  const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const to = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  return { from, to };
}

/**
 * Daftar partisi yang sudah ada.
 */
async function listPartitions(client) {
  const res = await client.query(`
    SELECT c.relname AS name
      FROM pg_class c
      JOIN pg_inherits i ON i.inhrelid = c.oid
      JOIN pg_class p ON p.oid = i.inhparent
     WHERE p.relname = $1
     ORDER BY c.relname
  `, [TABLE]);
  return res.rows.map((r) => r.name);
}

/**
 * Buat partisi bila belum ada.
 */
async function createPartition(client, name, range) {
  const from = range.from.toISOString();
  const to = range.to.toISOString();

  await client.query(
    `CREATE TABLE IF NOT EXISTS ${name}
       PARTITION OF ${TABLE}
       FOR VALUES FROM ('${from}') TO ('${to}')`
  );
  return name;
}

/**
 * Buang partisi lama (dan datanya) bila kebijakan retensi diaktifkan.
 */
async function dropExpiredPartitions(client, existing) {
  if (RETENTION_MONTHS <= 0) return [];

  const now = new Date();
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - RETENTION_MONTHS, 1));
  const dropped = [];

  for (const name of existing) {
    if (name === DEFAULT_PARTITION) continue;
    const m = /^readings_(\d{4})_(\d{2})$/.exec(name);
    if (!m) continue;

    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const partStart = new Date(Date.UTC(year, month - 1, 1));
    if (partStart >= cutoff) continue;

    await client.query(`DROP TABLE IF EXISTS ${name}`);
    dropped.push(name);
  }

  return dropped;
}

async function ensurePartitions() {
  const client = await pool.connect();
  const created = [];
  const dropped = [];

  try {
    await client.query('BEGIN');

    const existing = await listPartitions(client);

    // 1. Buang partisi yang melewati masa retensi (bila diaktifkan)
    for (const name of await dropExpiredPartitions(client, existing)) {
      dropped.push(name);
      console.log(`[Partisi] Partisi lama dibuang: ${name}`);
    }

    // 2. Pastikan partisi untuk bulan berjalan + beberapa bulan ke depan
    const now = new Date();
    for (let i = 0; i < MONTHS_AHEAD; i++) {
      const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
      const name = partitionName(target.getUTCFullYear(), target.getUTCMonth() + 1);
      if (existing.includes(name)) continue;

      await createPartition(client, name, monthRange(target.getUTCFullYear(), target.getUTCMonth() + 1));
      created.push(name);
      console.log(`[Partisi] Partisi dibuat: ${name}`);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Partisi] Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }

  console.log(
    `[Partisi] Selesai. Dibuat: ${created.length}, dibuang: ${dropped.length}, ` +
    `rentensi: ${RETENTION_MONTHS === 0 ? 'simpan semua' : RETENTION_MONTHS + ' bulan'}`
  );

  return { created, dropped };
}

if (require.main === module) {
  ensurePartitions()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { ensurePartitions, partitionName, monthRange, MONTHS_AHEAD, RETENTION_MONTHS };
