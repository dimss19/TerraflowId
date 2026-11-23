// SKRIP PENGEMBANGAN SAJA. Membuat data contoh / akun default dengan
// password yang tertulis di kode. Jangan dijalankan di server produksi.
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_SEED !== 'true') {
  console.error('[Seed] Ditolak: NODE_ENV=production. Set ALLOW_DEV_SEED=true bila benar-benar disengaja.');
  process.exit(1);
}

const { hashPassword } = require('../../src/utils/password');
const { query, pool } = require('../../src/db/connection');

async function seedUsers() {
  console.log('[Seed Users] Creating default administrative accounts with Argon2...');
  
  try {
    const adminPasswordHash = await hashPassword('Terraflow2024!');

    const operatorPasswordHash = await hashPassword('Operator2024!');

    await query(`
      INSERT INTO users (username, email, password_hash, full_name, phone, role, is_active)
      VALUES 
      ($1, $2, $3, $4, $5, 'admin', true),
      ($6, $7, $8, $9, $10, 'operator', true)
      ON CONFLICT (username) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        role = EXCLUDED.role,
        updated_at = NOW()
    `, [
      'admin', 'admin@terraflow.id', adminPasswordHash, 'Administrator TerraFlow', '+6281234567890',
      'operator', 'operator@terraflow.id', operatorPasswordHash, 'Teknisi Lapangan AWLR', '+6289876543210'
    ]);

    console.log('[Seed Users] Users seeded successfully with Argon2id hashes:');
    console.log(' - Username: admin | Role: admin');
    console.log(' - Username: operator | Role: operator');
  } catch (err) {
    console.error('[Seed Users Error]', err.message);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  seedUsers();
}

module.exports = seedUsers;
