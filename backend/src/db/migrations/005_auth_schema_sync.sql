-- Schema Migration: 005_auth_schema_sync.sql
-- Sinkronisasi skema autentikasi dengan kode backend (routes/auth.js, routes/users.js).
--
-- Migrasi 002-004 belum membuat objek berikut, padahal sudah digunakan
-- oleh kode aplikasi:
--   1. users.is_approved  -> flag persetujuan operator (cek login & register)
--   2. users.google_id    -> penanda akun yang sudah connect via Google OAuth
--   3. password_resets    -> tabel penyimpanan OTP reset password (6 digit, TTL 10 menit)
--
-- Semua statement di bawah bersifat idempotent (IF NOT EXISTS), aman dijalankan
-- berulang kali.

-- 1. Persetujuan operator
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT true;

-- Pastikan akun lama (termasuk hasil seed) dianggap ter-approve
UPDATE users SET is_approved = true WHERE is_approved IS NULL;

-- 2. Google OAuth ID
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id
    ON users (google_id) WHERE google_id IS NOT NULL;

-- 3. Tabel OTP reset password
CREATE TABLE IF NOT EXISTS password_resets (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets (email);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires ON password_resets (expires_at);
