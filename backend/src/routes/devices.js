const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { authenticateToken, requireAdmin } = require('./auth');
const { publishCommand } = require('../mqtt/publisher');

// ==========================================
// 1. OPERATOR / ADMIN READ ROUTES
// ==========================================

// GET /api/devices - List AWLR devices based on user role (Admin: all, Operator: assigned only)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const isOperator = req.user && req.user.role === 'operator';

    let sql = `
      SELECT d.*, 
             u.id AS assigned_operator_id,
             u.full_name AS assigned_operator_name,
             u.username AS assigned_operator_username,
             u.email AS assigned_operator_email,
             c.sensor_height_cm AS calibrated_height,
             c.offset_cm AS calibrated_offset,
             c.slope AS calibrated_slope,
             (SELECT COUNT(*) FROM device_alerts a WHERE a.device_id = d.device_id AND a.resolved = false) AS active_alerts_count,
             (SELECT json_build_object(
                'timestamp', r.timestamp,
                'water_level_cm', r.water_level_cm,
                'battery_voltage', r.battery_voltage,
                'battery_percent', r.battery_percent,
                'temperature_c', r.temperature_c,
                'signal_quality', r.signal_quality
              ) FROM readings r WHERE r.device_id = d.device_id ORDER BY r.timestamp DESC LIMIT 1) AS latest_reading
      FROM devices d
      LEFT JOIN users u ON u.id = d.assigned_to
      LEFT JOIN calibrations c ON c.device_id = d.device_id AND c.is_active = true
    `;
    const params = [];

    if (isOperator) {
      // Operators can only view devices assigned specifically to them and active
      sql += ` WHERE d.assigned_to = $1 AND d.is_active = true `;
      params.push(req.user.id);
    }

    sql += ` ORDER BY d.created_at ASC `;
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[API Error GET /devices]', err.message);
    res.status(500).json({ success: false, error: 'Gagal mengambil data perangkat' });
  }
});

// GET /api/devices/:device_id - Get specific device details
router.get('/:device_id', authenticateToken, async (req, res) => {
  const { device_id } = req.params;
  try {
    const result = await query(`
      SELECT d.*, 
             u.id AS assigned_operator_id,
             u.full_name AS assigned_operator_name,
             u.username AS assigned_operator_username,
             u.email AS assigned_operator_email,
             c.sensor_height_cm AS calibrated_height,
             c.offset_cm AS calibrated_offset,
             c.slope AS calibrated_slope,
             (SELECT COUNT(*) FROM device_alerts a WHERE a.device_id = d.device_id AND a.resolved = false) AS active_alerts_count
      FROM devices d
      LEFT JOIN users u ON u.id = d.assigned_to
      LEFT JOIN calibrations c ON c.device_id = d.device_id AND c.is_active = true
      WHERE d.device_id = $1
    `, [device_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Perangkat tidak ditemukan' });
    }

    const device = result.rows[0];

    // Check operator assignment authorization
    if (req.user.role === 'operator' && device.assigned_to !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        error: 'Akses ditolak: Stasiun ini tidak ditugaskan kepada Anda' 
      });
    }

    res.json({ success: true, data: device });
  } catch (err) {
    console.error('[API Error GET /devices/:device_id]', err.message);
    res.status(500).json({ success: false, error: 'Gagal mengambil detail perangkat' });
  }
});

// ==========================================
// 2. REMOTE COMMANDS (ADMIN & ASSIGNED OPERATOR)
// ==========================================

// POST /api/devices/:device_id/restart - Trigger remote reboot
router.post('/:device_id/restart', authenticateToken, async (req, res) => {
  const { device_id } = req.params;
  try {
    const devCheck = await query('SELECT device_id, assigned_to FROM devices WHERE device_id = $1', [device_id]);
    if (devCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Perangkat tidak ditemukan' });
    }

    if (req.user.role === 'operator' && devCheck.rows[0].assigned_to !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Akses ditolak: Stasiun ini tidak ditugaskan kepada Anda' });
    }

    await publishCommand(device_id, 'restart');
    res.json({ success: true, message: `Perintah restart telah dikirim ke perangkat ${device_id}` });
  } catch (err) {
    console.error('[API Error POST /devices/:device_id/restart]', err.message);
    res.status(500).json({ success: false, error: 'Gagal mengirim perintah restart: ' + err.message });
  }
});

// POST /api/devices/:device_id/sync - Trigger remote SD sync
router.post('/:device_id/sync', authenticateToken, async (req, res) => {
  const { device_id } = req.params;
  try {
    const devCheck = await query('SELECT device_id, assigned_to FROM devices WHERE device_id = $1', [device_id]);
    if (devCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Perangkat tidak ditemukan' });
    }

    if (req.user.role === 'operator' && devCheck.rows[0].assigned_to !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Akses ditolak: Stasiun ini tidak ditugaskan kepada Anda' });
    }

    await publishCommand(device_id, 'sync_request');
    res.json({ success: true, message: `Perintah sinkronisasi manual telah dikirim ke perangkat ${device_id}` });
  } catch (err) {
    console.error('[API Error POST /devices/:device_id/sync]', err.message);
    res.status(500).json({ success: false, error: 'Gagal mengirim perintah sinkronisasi: ' + err.message });
  }
});

// ==========================================
// 3. ADMIN CRUD MANAGEMENT (STRICTLY ADMIN ONLY)
// ==========================================

// POST /api/devices - Register new AWLR device (Admin Only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { device_id, name, location, latitude, longitude, sensor_height_cm, is_active, assigned_to } = req.body;

  if (!device_id || !name) {
    return res.status(400).json({
      success: false,
      error: 'ID Perangkat (device_id) dan Nama Perangkat wajib diisi'
    });
  }

  const cleanDeviceId = String(device_id).trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,50}$/.test(cleanDeviceId)) {
    return res.status(400).json({
      success: false,
      error: 'ID Perangkat harus berupa 3-50 karakter alfanumerik (huruf besar, angka, strip, underscore)'
    });
  }

  const cleanName = String(name).trim().slice(0, 100);
  const cleanLocation = location ? String(location).trim().slice(0, 200) : null;
  const parsedLat = latitude !== undefined && latitude !== '' && !isNaN(Number(latitude)) ? Number(latitude) : null;
  const parsedLng = longitude !== undefined && longitude !== '' && !isNaN(Number(longitude)) ? Number(longitude) : null;
  const parsedHeight = sensor_height_cm !== undefined && !isNaN(Number(sensor_height_cm)) ? Number(sensor_height_cm) : 600.00;
  const activeStatus = is_active !== undefined ? Boolean(is_active) : true;

  if (parsedHeight < 50 || parsedHeight > 2000) {
    return res.status(400).json({
      success: false,
      error: 'Tinggi sensor harus berada dalam rentang 50 cm sampai 2000 cm'
    });
  }

  try {
    // Check uniqueness
    const exists = await query('SELECT device_id FROM devices WHERE device_id = $1', [cleanDeviceId]);
    if (exists.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: `Perangkat dengan ID '${cleanDeviceId}' sudah terdaftar`
      });
    }

    // Verify assigned operator if specified
    let targetOperatorId = null;
    if (assigned_to !== undefined && assigned_to !== null && assigned_to !== '') {
      const opId = parseInt(assigned_to, 10);
      if (!isNaN(opId)) {
        const userCheck = await query('SELECT id, role FROM users WHERE id = $1', [opId]);
        if (userCheck.rows.length > 0) {
          targetOperatorId = opId;
        } else {
          return res.status(400).json({
            success: false,
            error: 'Operator yang dipilih tidak ditemukan dalam sistem'
          });
        }
      }
    }

    const insertResult = await query(`
      INSERT INTO devices (device_id, name, location, latitude, longitude, sensor_height_cm, is_active, assigned_to)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [cleanDeviceId, cleanName, cleanLocation, parsedLat, parsedLng, parsedHeight, activeStatus, targetOperatorId]);

    // Create initial calibration row
    await query(`
      INSERT INTO calibrations (device_id, sensor_height_cm, offset_cm, slope, applied_at, applied_by, notes, is_active)
      VALUES ($1, $2, 0.00, 1.000000, NOW(), $3, 'Inisialisasi perangkat baru', true)
    `, [cleanDeviceId, parsedHeight, req.user?.username || 'admin']);

    res.status(201).json({
      success: true,
      message: `Perangkat ${cleanDeviceId} berhasil didaftarkan`,
      data: insertResult.rows[0]
    });
  } catch (err) {
    console.error('[API Error POST /devices]', err.message);
    res.status(500).json({ success: false, error: 'Gagal mendaftarkan perangkat baru' });
  }
});

// PATCH /api/devices/:device_id - Update device configuration & operator assignment (Admin Only)
router.patch('/:device_id', authenticateToken, requireAdmin, async (req, res) => {
  const { device_id } = req.params;
  const { name, location, latitude, longitude, sensor_height_cm, is_active, assigned_to } = req.body;

  try {
    const existing = await query('SELECT * FROM devices WHERE device_id = $1', [device_id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Perangkat tidak ditemukan' });
    }

    const updateClauses = [];
    const params = [device_id];
    let paramIdx = 2;

    if (name !== undefined) {
      if (!name || String(name).trim().length === 0) {
        return res.status(400).json({ success: false, error: 'Nama perangkat tidak boleh kosong' });
      }
      updateClauses.push(`name = $${paramIdx++}`);
      params.push(String(name).trim().slice(0, 100));
    }

    if (location !== undefined) {
      updateClauses.push(`location = $${paramIdx++}`);
      params.push(location ? String(location).trim().slice(0, 200) : null);
    }

    if (latitude !== undefined) {
      const lat = latitude !== '' && !isNaN(Number(latitude)) ? Number(latitude) : null;
      updateClauses.push(`latitude = $${paramIdx++}`);
      params.push(lat);
    }

    if (longitude !== undefined) {
      const lng = longitude !== '' && !isNaN(Number(longitude)) ? Number(longitude) : null;
      updateClauses.push(`longitude = $${paramIdx++}`);
      params.push(lng);
    }

    if (sensor_height_cm !== undefined) {
      const height = Number(sensor_height_cm);
      if (isNaN(height) || height < 50 || height > 2000) {
        return res.status(400).json({ success: false, error: 'Tinggi sensor harus antara 50 dan 2000 cm' });
      }
      updateClauses.push(`sensor_height_cm = $${paramIdx++}`);
      params.push(height);

      // Also update active calibration record
      await query(`
        UPDATE calibrations 
        SET sensor_height_cm = $1, applied_at = NOW(), applied_by = $2
        WHERE device_id = $3 AND is_active = true
      `, [height, req.user?.username || 'admin', device_id]);
    }

    if (is_active !== undefined) {
      updateClauses.push(`is_active = $${paramIdx++}`);
      params.push(Boolean(is_active));
    }

    if (assigned_to !== undefined) {
      if (assigned_to === null || assigned_to === '' || assigned_to === 'null') {
        updateClauses.push(`assigned_to = $${paramIdx++}`);
        params.push(null);
      } else {
        const opId = parseInt(assigned_to, 10);
        if (!isNaN(opId)) {
          const userCheck = await query('SELECT id, role FROM users WHERE id = $1', [opId]);
          if (userCheck.rows.length > 0) {
            updateClauses.push(`assigned_to = $${paramIdx++}`);
            params.push(opId);
          } else {
            return res.status(400).json({ success: false, error: 'Operator yang dipilih tidak ditemukan dalam sistem' });
          }
        }
      }
    }

    if (updateClauses.length === 0) {
      return res.status(400).json({ success: false, error: 'Tidak ada data perangkat yang diperbarui' });
    }

    updateClauses.push('updated_at = NOW()');

    const updateSql = `
      UPDATE devices
      SET ${updateClauses.join(', ')}
      WHERE device_id = $1
      RETURNING *
    `;

    const updated = await query(updateSql, params);
    res.json({
      success: true,
      message: 'Perangkat berhasil diperbarui',
      data: updated.rows[0]
    });
  } catch (err) {
    console.error('[API Error PATCH /devices/:device_id]', err.message);
    res.status(500).json({ success: false, error: 'Gagal memperbarui perangkat' });
  }
});

// PATCH /api/devices/:device_id/toggle - Toggle active status (Admin Only)
router.patch('/:device_id/toggle', authenticateToken, requireAdmin, async (req, res) => {
  const { device_id } = req.params;
  try {
    const result = await query(`
      UPDATE devices
      SET is_active = NOT is_active, updated_at = NOW()
      WHERE device_id = $1
      RETURNING *
    `, [device_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Perangkat tidak ditemukan' });
    }

    const device = result.rows[0];
    res.json({
      success: true,
      message: `Status perangkat ${device_id} diubah menjadi ${device.is_active ? 'Aktif' : 'Nonaktif'}`,
      data: device
    });
  } catch (err) {
    console.error('[API Error PATCH /devices/:device_id/toggle]', err.message);
    res.status(500).json({ success: false, error: 'Gagal mengubah status perangkat' });
  }
});

// DELETE /api/devices/:device_id - Remove device and related data (Admin Only)
router.delete('/:device_id', authenticateToken, requireAdmin, async (req, res) => {
  const { device_id } = req.params;
  try {
    // Delete readings for this device (readings partition doesn't have FK constraint)
    await query('DELETE FROM readings WHERE device_id = $1', [device_id]);

    // Deleting from devices will CASCADE to calibrations, device_alerts, device_diagnostics, alert_rules
    const result = await query('DELETE FROM devices WHERE device_id = $1 RETURNING device_id, name', [device_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Perangkat tidak ditemukan' });
    }

    res.json({
      success: true,
      message: `Perangkat '${result.rows[0].name}' (${device_id}) berhasil dihapus beserta seluruh riwayat datanya`
    });
  } catch (err) {
    console.error('[API Error DELETE /devices/:device_id]', err.message);
    res.status(500).json({ success: false, error: 'Gagal menghapus perangkat' });
  }
});

module.exports = router;
