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
      SELECT id, username, email, password_hash, full_name, role, is_active 
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
      email: user.email
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
      SELECT id, username, email, full_name, role, last_login, created_at 
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

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logout berhasil' });
});

module.exports = {
  router,
  authenticateToken
};
