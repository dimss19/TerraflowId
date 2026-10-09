const express = require('express');
const router = express.Router();
const argon2 = require('argon2');
const { query } = require('../db/connection');
const { authenticateToken } = require('./auth');

// Middleware: Require Admin Role
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      error: 'Akses ditolak: Operasi ini memerlukan hak akses Administrator' 
    });
  }
  next();
}

// All user management routes require valid token + admin privileges
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/users - List all users
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT id, username, email, full_name, phone, avatar_url, role, is_active, last_login, created_at, updated_at
      FROM users
      ORDER BY id ASC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[API Error GET /users]', err.message);
    res.status(500).json({ success: false, error: 'Gagal mengambil daftar pengguna' });
  }
});

// POST /api/users - Create new user with Argon2 hashing
router.post('/', async (req, res) => {
  const { username, email, password, full_name, role, phone, avatar_url } = req.body;

  if (!username || !email || !password || !full_name) {
    return res.status(400).json({ 
      success: false, 
      error: 'Nama pengguna, email, kata sandi, dan nama lengkap wajib diisi' 
    });
  }

  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({
      success: false,
      error: 'Kata sandi minimal harus 8 karakter'
    });
  }

  const cleanUsername = username.trim().toLowerCase();
  const cleanEmail = email.trim().toLowerCase();
  const cleanRole = ['admin', 'operator'].includes(role) ? role : 'operator';
  const cleanPhone = phone ? String(phone).trim().slice(0, 20) : null;
  const cleanAvatar = avatar_url ? String(avatar_url).trim().slice(0, 255) : null;

  try {
    // Check if username or email already exists
    const existing = await query(`
      SELECT id, username, email FROM users 
      WHERE LOWER(username) = $1 OR LOWER(email) = $2
    `, [cleanUsername, cleanEmail]);

    if (existing.rows.length > 0) {
      const match = existing.rows[0];
      if (match.username.toLowerCase() === cleanUsername) {
        return res.status(409).json({ success: false, error: 'Nama pengguna (username) sudah digunakan' });
      }
      return res.status(409).json({ success: false, error: 'Email sudah terdaftar pada akun lain' });
    }

    // Securely hash password with Argon2id
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4
    });

    const insertResult = await query(`
      INSERT INTO users (username, email, password_hash, full_name, role, phone, avatar_url, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      RETURNING id, username, email, full_name, phone, avatar_url, role, is_active, created_at
    `, [cleanUsername, cleanEmail, passwordHash, full_name.trim(), cleanRole, cleanPhone, cleanAvatar]);

    res.status(201).json({
      success: true,
      data: insertResult.rows[0],
      message: 'Pengguna baru berhasil didaftarkan'
    });
  } catch (err) {
    console.error('[API Error POST /users]', err.message);
    res.status(500).json({ success: false, error: 'Gagal membuat pengguna baru' });
  }
});

// PATCH /api/users/:id - Update user details, role, status, or reset password
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { full_name, email, role, is_active, password, phone, avatar_url } = req.body;

  const userId = parseInt(id, 10);
  if (isNaN(userId)) {
    return res.status(400).json({ success: false, error: 'ID pengguna tidak valid' });
  }

  // Prevent admin from deactivating themselves
  if (req.user.id === userId && is_active === false) {
    return res.status(400).json({ 
      success: false, 
      error: 'Anda tidak dapat menonaktifkan akun administrator Anda sendiri' 
    });
  }

  try {
    // Check if user exists
    const userCheck = await query('SELECT id, role FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan' });
    }

    // Build update fields dynamically and safely with parameters
    const updateClauses = [];
    const params = [userId];
    let paramIdx = 2;

    if (full_name !== undefined && typeof full_name === 'string') {
      updateClauses.push(`full_name = $${paramIdx++}`);
      params.push(full_name.trim());
    }

    if (email !== undefined && typeof email === 'string') {
      updateClauses.push(`email = $${paramIdx++}`);
      params.push(email.trim().toLowerCase());
    }

    if (phone !== undefined) {
      updateClauses.push(`phone = $${paramIdx++}`);
      params.push(phone ? String(phone).trim().slice(0, 20) : null);
    }

    if (avatar_url !== undefined) {
      updateClauses.push(`avatar_url = $${paramIdx++}`);
      params.push(avatar_url ? String(avatar_url).trim().slice(0, 255) : null);
    }

    if (role !== undefined && ['admin', 'operator'].includes(role)) {
      updateClauses.push(`role = $${paramIdx++}`);
      params.push(role);
    }

    if (is_active !== undefined) {
      updateClauses.push(`is_active = $${paramIdx++}`);
      params.push(Boolean(is_active));
    }

    if (password) {
      if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ success: false, error: 'Kata sandi baru minimal 8 karakter' });
      }
      const newHash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4
      });
      updateClauses.push(`password_hash = $${paramIdx++}`);
      params.push(newHash);
    }

    if (updateClauses.length === 0) {
      return res.status(400).json({ success: false, error: 'Tidak ada data yang diperbarui' });
    }

    updateClauses.push('updated_at = NOW()');

    const updateSql = `
      UPDATE users 
      SET ${updateClauses.join(', ')} 
      WHERE id = $1 
      RETURNING id, username, email, full_name, phone, avatar_url, role, is_active, last_login, updated_at
    `;

    const updated = await query(updateSql, params);
    res.json({
      success: true,
      data: updated.rows[0],
      message: 'Data pengguna berhasil diperbarui'
    });
  } catch (err) {
    console.error('[API Error PATCH /users/:id]', err.message);
    res.status(500).json({ success: false, error: 'Gagal memperbarui data pengguna' });
  }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const userId = parseInt(id, 10);

  if (isNaN(userId)) {
    return res.status(400).json({ success: false, error: 'ID pengguna tidak valid' });
  }

  // Prevent deleting oneself
  if (req.user.id === userId) {
    return res.status(400).json({ 
      success: false, 
      error: 'Anda tidak dapat menghapus akun administrator Anda sendiri' 
    });
  }

  try {
    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id, username', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan' });
    }
    res.json({
      success: true,
      message: `Pengguna '${result.rows[0].username}' berhasil dihapus`
    });
  } catch (err) {
    console.error('[API Error DELETE /users/:id]', err.message);
    res.status(500).json({ success: false, error: 'Gagal menghapus pengguna' });
  }
});

module.exports = router;
