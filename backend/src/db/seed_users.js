const argon2 = require('argon2');
const { query, pool } = require('./connection');

async function seedUsers() {
  console.log('[Seed Users] Creating default administrative accounts with Argon2...');
  
  try {
    const adminPasswordHash = await argon2.hash('Terraflow2024!', {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4
    });

    const operatorPasswordHash = await argon2.hash('Operator2024!', {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4
    });

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
