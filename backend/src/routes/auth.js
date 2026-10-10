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
  const { username, password, remember_me } = req.body;

  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ 
      success: false, 
      error: 'Nama pengguna dan kata sandi wajib diisi' 
    });
  }

  const cleanUsername = username.trim().toLowerCase();

  try {
    const result = await query(`
      SELECT id, username, email, phone, avatar_url, password_hash, full_name, role, is_active, is_approved 
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

    // Check if account is approved by admin
    if (user.is_approved === false) {
      return res.status(403).json({ 
        success: false, 
        pending_approval: true,
        error: 'Terima kasih sudah mendaftar. Akun Anda sedang menunggu persetujuan Administrator.' 
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

    // Sign JWT token - 30 days if remember_me is true, 24 hours otherwise
    const tokenPayload = {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      email: user.email,
      phone: user.phone || '',
      avatarUrl: user.avatar_url || ''
    };

    const isRememberMe = Boolean(remember_me);
    const tokenExpires = isRememberMe ? '30d' : '24h';

    const token = jwt.sign(tokenPayload, config.jwtSecret, {
      algorithm: 'HS256',
      expiresIn: tokenExpires
    });

    res.json({
      success: true,
      token,
      user: tokenPayload,
      remember_me: isRememberMe,
      message: 'Autentikasi berhasil'
    });
  } catch (err) {
    console.error('[Auth Error /login]', err.message);
    res.status(500).json({ success: false, error: 'Terjadi kesalahan sistem saat proses autentikasi' });
  }
});

// POST /api/auth/register - Operator Self-Registration (Pending Admin Approval)
router.post('/register', async (req, res) => {
  const { username, email, password, full_name, phone } = req.body;

  if (!username || !email || !password || !full_name) {
    return res.status(400).json({ 
      success: false, 
      error: 'Nama lengkap, nama pengguna, email, dan kata sandi wajib diisi' 
    });
  }

  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({
      success: false,
      error: 'Kata sandi minimal harus 8 karakter'
    });
  }

  const cleanUsername = String(username).trim().toLowerCase();
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanFullName = String(full_name).trim();
  const cleanPhone = phone ? String(phone).trim().slice(0, 20) : null;

  // Basic format validations
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanUsername)) {
    return res.status(400).json({
      success: false,
      error: 'Username hanya boleh terdiri dari huruf, angka, dan garis bawah (3-30 karakter)'
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({
      success: false,
      error: 'Format alamat email tidak valid'
    });
  }

  try {
    // Check if username or email is already taken
    const existing = await query(`
      SELECT id, username, email FROM users 
      WHERE LOWER(username) = $1 OR LOWER(email) = $2
    `, [cleanUsername, cleanEmail]);

    if (existing.rows.length > 0) {
      const match = existing.rows[0];
      if (match.username.toLowerCase() === cleanUsername) {
        return res.status(409).json({ success: false, error: 'Nama pengguna (username) sudah digunakan' });
      }
      return res.status(409).json({ success: false, error: 'Email sudah terdaftar pada sistem' });
    }

    // Hash password securely with Argon2id
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4
    });

    const insertResult = await query(`
      INSERT INTO users (username, email, password_hash, full_name, role, phone, is_active, is_approved)
      VALUES ($1, $2, $3, $4, 'operator', $5, true, false)
      RETURNING id, username, email, full_name, phone, role, is_active, is_approved, created_at
    `, [cleanUsername, cleanEmail, passwordHash, cleanFullName, cleanPhone]);

    res.status(201).json({
      success: true,
      pending_approval: true,
      message: 'Pendaftaran operator berhasil! Akun Anda sedang menunggu persetujuan Administrator.',
      user: insertResult.rows[0]
    });
  } catch (err) {
    console.error('[Auth Error /register]', err.message);
    res.status(500).json({ success: false, error: 'Gagal memproses pendaftaran operator' });
  }
});

// POST /api/auth/forgot-password/request-otp
// Generate a 6-digit OTP code with 10-minute validity
router.post('/forgot-password/request-otp', async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ success: false, error: 'Masukkan alamat email yang valid' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const userRes = await query('SELECT id, username, email FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    
    // Always return success message even if email not found to prevent email enumeration
    if (userRes.rows.length === 0) {
      return res.json({
        success: true,
        message: 'Jika email terdaftar, kode OTP telah dikirimkan ke kotak masuk Anda'
      });
    }

    // Generate random 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 menit

    // Invalidate previous OTPs for this email
    await query('UPDATE password_resets SET used = true WHERE LOWER(email) = $1', [cleanEmail]);

    // Save new OTP
    await query(`
      INSERT INTO password_resets (email, otp_code, expires_at, used)
      VALUES ($1, $2, $3, false)
    `, [cleanEmail, otpCode, expiresAt]);

    console.log(`[OTP GENERATED] Kode OTP Reset Password untuk ${cleanEmail}: ${otpCode} (Berlaku s/d ${expiresAt.toISOString()})`);

    // In local development / demo, we also send back hint or dev_otp if in development
    const isDev = process.env.NODE_ENV !== 'production';

    res.json({
      success: true,
      message: 'Kode OTP 6-digit berhasil dikirim ke email Anda (berlaku 10 menit)',
      ...(isDev ? { dev_otp_hint: otpCode } : {})
    });
  } catch (err) {
    console.error('[Auth Error /forgot-password/request-otp]', err.message);
    res.status(500).json({ success: false, error: 'Gagal memproses permintaan OTP' });
  }
});

// POST /api/auth/forgot-password/reset-password
// Verify OTP and update password
router.post('/forgot-password/reset-password', async (req, res) => {
  const { email, otp_code, new_password } = req.body;

  if (!email || !otp_code || !new_password) {
    return res.status(400).json({ success: false, error: 'Email, kode OTP, dan kata sandi baru wajib diisi' });
  }

  if (typeof new_password !== 'string' || new_password.length < 8) {
    return res.status(400).json({ success: false, error: 'Kata sandi baru minimal harus 8 karakter' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp = String(otp_code).trim();

  try {
    // Check valid and unexpired OTP
    const otpRes = await query(`
      SELECT id, expires_at FROM password_resets
      WHERE LOWER(email) = $1 AND otp_code = $2 AND used = false AND expires_at > NOW()
      ORDER BY id DESC LIMIT 1
    `, [cleanEmail, cleanOtp]);

    if (otpRes.rows.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Kode OTP tidak valid atau telah kedaluwarsa. Silakan ajukan ulang.' 
      });
    }

    // Hash new password
    const newHash = await argon2.hash(new_password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4
    });

    // Update user password
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE LOWER(email) = $2', [newHash, cleanEmail]);

    // Mark OTP as used
    await query('UPDATE password_resets SET used = true WHERE id = $1', [otpRes.rows[0].id]);

    res.json({
      success: true,
      message: 'Kata sandi berhasil direset! Silakan login dengan kata sandi baru Anda.'
    });
  } catch (err) {
    console.error('[Auth Error /forgot-password/reset-password]', err.message);
    res.status(500).json({ success: false, error: 'Gagal mereset kata sandi' });
  }
});

// POST /api/auth/google
// Handle Google OAuth Sign-in & Operator Registration with Approval requirement
router.post('/google', async (req, res) => {
  const { email, fullName, googleId } = req.body;

  if (!email || !fullName) {
    return res.status(400).json({ success: false, error: 'Identitas Google tidak lengkap' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = fullName.trim();
  const cleanGoogleId = googleId ? String(googleId).trim() : null;

  try {
    // 1. Check if user already exists
    const userRes = await query(`
      SELECT id, username, email, full_name, phone, avatar_url, role, is_active, is_approved 
      FROM users 
      WHERE LOWER(email) = $1
    `, [cleanEmail]);

    let user;

    if (userRes.rows.length === 0) {
      // 2. New Operator: Auto-register with is_approved = false
      const baseUsername = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) || 'operator';
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const generatedUsername = `${baseUsername}_${randomSuffix}`;

      // Dummy secure hash for google auth accounts
      const randomSecret = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const dummyHash = await argon2.hash(randomSecret, { type: argon2.argon2id });

      const insertRes = await query(`
        INSERT INTO users (username, email, password_hash, full_name, role, is_active, is_approved, google_id)
        VALUES ($1, $2, $3, $4, 'operator', true, false, $5)
        RETURNING id, username, email, full_name, phone, avatar_url, role, is_active, is_approved
      `, [generatedUsername, cleanEmail, dummyHash, cleanName, cleanGoogleId]);

      user = insertRes.rows[0];

      return res.status(403).json({
        success: false,
        pending_approval: true,
        error: 'Terima kasih sudah mendaftar dengan Google. Akun operator Anda sedang menunggu persetujuan Administrator.'
      });
    } else {
      user = userRes.rows[0];

      // Update google_id if not linked yet
      if (cleanGoogleId) {
        await query('UPDATE users SET google_id = $1 WHERE id = $2', [cleanGoogleId, user.id]);
      }
    }

    // 3. Check active and approval status
    if (!user.is_active) {
      return res.status(403).json({ success: false, error: 'Akun Anda dinonaktifkan. Silakan hubungi administrator.' });
    }

    if (user.is_approved === false) {
      return res.status(403).json({
        success: false,
        pending_approval: true,
        error: 'Pendaftaran akun Google Anda telah diterima. Akses stasiun AWLR akan aktif setelah disetujui oleh Administrator.'
      });
    }

    // 4. Update last login
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    // 5. Issue JWT Token
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
      message: 'Berhasil masuk dengan akun Google'
    });
  } catch (err) {
    console.error('[Auth Error /google]', err.message);
    res.status(500).json({ success: false, error: 'Gagal memproses autentikasi Google' });
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
