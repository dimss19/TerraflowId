const express = require('express');
const router = express.Router();
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { query } = require('../db/connection');

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Akses ditolak: Token autentikasi tidak ditemukan' });
  }

  jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }, (err, decoded) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Sesi telah kedaluwarsa atau token tidak valid' });
    }
    req.user = decoded;
    next();
  });
}

// Middleware: Require specific roles
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Akses ditolak: Anda tidak memiliki izin untuk operasi ini' 
      });
    }
    next();
  };
}

const requireAdmin = requireRole(['admin']);

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ 
      success: false, 
      error: 'Nama pengguna dan kata sandi wajib diisi' 
    });
  }

  const cleanUsername = username.trim().toLowerCase();

  try {
    const result = await query(`
      SELECT id, username, email, phone, avatar_url, password_hash, full_name, role, is_active 
      FROM users 
      WHERE LOWER(username) = $1
    `, [cleanUsername]);

    if (result.rows.length === 0) {
      // Intentionally generic error to prevent username enumeration
      return res.status(401).json({ 
        success: false, 
        error: 'Nama pengguna atau kata sandi tidak valid' 
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ 
        success: false, 
        error: 'Akun Anda dinonaktifkan. Silakan hubungi administrator.' 
      });
    }

    // Verify password securely with Argon2
    const isPasswordValid = await argon2.verify(user.password_hash, password);

    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        error: 'Nama pengguna atau kata sandi tidak valid' 
      });
    }

    // Update last login timestamp
    await query(`UPDATE users SET last_login = NOW() WHERE id = $1`, [user.id]);

    // Sign JWT token
    const tokenPayload = {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      email: user.email,
      phone: user.phone || '',
      avatarUrl: user.avatar_url || ''
    };

    const token = jwt.sign(tokenPayload, config.jwtSecret, {
      algorithm: 'HS256',
      expiresIn: '24h'
    });

    res.json({
      success: true,
      token,
      user: tokenPayload,
      message: 'Autentikasi berhasil'
    });
  } catch (err) {
    console.error('[Auth Error /login]', err.message);
    res.status(500).json({ success: false, error: 'Terjadi kesalahan sistem saat proses autentikasi' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT id, username, email, full_name, phone, avatar_url, role, last_login, created_at 
      FROM users 
      WHERE id = $1 AND is_active = true
    `, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan' });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (err) {
    console.error('[Auth Error /me]', err.message);
    res.status(500).json({ success: false, error: 'Gagal mengambil data profil' });
  }
});

// PATCH /api/auth/profile - Update current user profile
router.patch('/profile', authenticateToken, async (req, res) => {
  const { full_name, email, phone, avatar_url } = req.body;
  const userId = req.user.id;

  const updateClauses = [];
  const params = [userId];
  let paramIdx = 2;

  if (full_name !== undefined) {
    if (typeof full_name !== 'string' || full_name.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Nama lengkap tidak boleh kosong' });
    }
    updateClauses.push(`full_name = $${paramIdx++}`);
    params.push(full_name.trim().slice(0, 100));
  }

  if (email !== undefined) {
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ success: false, error: 'Format email tidak valid' });
    }
    const cleanEmail = email.trim().toLowerCase().slice(0, 100);

    // Check email collision with other users
    const emailCheck = await query('SELECT id FROM users WHERE LOWER(email) = $1 AND id != $2', [cleanEmail, userId]);
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Email sudah terdaftar pada akun lain' });
    }

    updateClauses.push(`email = $${paramIdx++}`);
    params.push(cleanEmail);
  }

  if (phone !== undefined) {
    updateClauses.push(`phone = $${paramIdx++}`);
    params.push(phone ? String(phone).trim().slice(0, 20) : null);
  }

  if (avatar_url !== undefined) {
    updateClauses.push(`avatar_url = $${paramIdx++}`);
    params.push(avatar_url ? String(avatar_url).trim().slice(0, 255) : null);
  }

  if (updateClauses.length === 0) {
    return res.status(400).json({ success: false, error: 'Tidak ada data profil yang diperbarui' });
  }

  updateClauses.push('updated_at = NOW()');

  try {
    const updateSql = `
      UPDATE users
      SET ${updateClauses.join(', ')}
      WHERE id = $1
      RETURNING id, username, email, full_name, phone, avatar_url, role, updated_at
    `;
    const result = await query(updateSql, params);

    res.json({
      success: true,
      message: 'Profil berhasil diperbarui',
      user: result.rows[0]
    });
  } catch (err) {
    console.error('[Auth Error /profile]', err.message);
    res.status(500).json({ success: false, error: 'Gagal memperbarui profil pengguna' });
  }
});

// PATCH /api/auth/password - Change password for current user
router.patch('/password', authenticateToken, async (req, res) => {
  const { current_password, new_password } = req.body;
  const userId = req.user.id;

  if (!current_password || !new_password) {
    return res.status(400).json({ 
      success: false, 
      error: 'Kata sandi saat ini dan kata sandi baru wajib diisi' 
    });
  }

  if (typeof new_password !== 'string' || new_password.length < 8) {
    return res.status(400).json({ 
      success: false, 
      error: 'Kata sandi baru minimal harus 8 karakter' 
    });
  }

  try {
    const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan' });
    }

    const isMatch = await argon2.verify(userResult.rows[0].password_hash, current_password);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Kata sandi saat ini tidak sesuai' });
    }

    const newHash = await argon2.hash(new_password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4
    });

    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, userId]);

    res.json({
      success: true,
      message: 'Kata sandi berhasil diperbarui'
    });
  } catch (err) {
    console.error('[Auth Error /password]', err.message);
    res.status(500).json({ success: false, error: 'Gagal mengubah kata sandi' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logout berhasil' });
});

module.exports = {
  router,
  authenticateToken,
  requireRole,
  requireAdmin
};
