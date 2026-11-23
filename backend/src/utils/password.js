const argon2 = require('argon2');

// Parameter argon2id tunggal untuk seluruh aplikasi (registrasi, reset,
// ganti sandi, manajemen user, seed). Ubah di sini saja bila perlu.
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4
};

function hashPassword(plain) {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

module.exports = { hashPassword, ARGON2_OPTIONS };
