const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { publishCalibration, publishCommand } = require('../mqtt/publisher');
const { analyzeTidalReadings } = require('../services/tidalAnalysis');
const { authenticateToken, requireAdmin } = require('./auth');

// ==========================================
// 1. READINGS & TELEMETRY
// ==========================================

// GET /api/readings/:device_id/latest - Get most recent reading
router.get('/readings/:device_id/latest', async (req, res) => {
  const { device_id } = req.params;
  try {
    const result = await query(`
      SELECT * FROM readings
      WHERE device_id = $1
      ORDER BY timestamp DESC
      LIMIT 1
    `, [device_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Belum ada data pembacaan' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[API Error /readings/:device_id/latest]', err.message);
    res.status(500).json({ success: false, error: 'Gagal mengambil pembacaan terbaru' });
  }
});

// GET /api/readings/:device_id - Historical readings with date range filter
router.get('/readings/:device_id', async (req, res) => {
  const { device_id } = req.params;
  const { start, end, limit = 500 } = req.query;

  const maxLimit = Math.min(2000, Math.max(1, parseInt(limit, 10) || 500));
  const conditions = ['device_id = $1'];
  const params = [device_id];
  let paramIdx = 2;

  if (start) {
    const startDate = new Date(start);
    if (!isNaN(startDate.getTime())) {
      conditions.push(`timestamp >= $${paramIdx++}`);
      params.push(startDate.toISOString());
    }
  }

  if (end) {
    const endDate = new Date(end);
    if (!isNaN(endDate.getTime())) {
      conditions.push(`timestamp <= $${paramIdx++}`);
      params.push(endDate.toISOString());
    }
  }

  params.push(maxLimit);
  const sql = `
    SELECT * FROM readings
    WHERE ${conditions.join(' AND ')}
    ORDER BY timestamp DESC
    LIMIT $${paramIdx}
  `;

  try {
    const result = await query(sql, params);
    res.json({ success: true, count: result.rows.length, data: result.rows.reverse() });
  } catch (err) {
    console.error('[API Error /readings/:device_id]', err.message);
    res.status(500).json({ success: false, error: 'Gagal mengambil riwayat pembacaan' });
  }
});

// ==========================================
// 3. TIDAL ANALYSIS (PASANG SURUT)
// ==========================================

// GET /api/readings/:device_id/tidal - Tidal curve and stats with flexible date/time filtering
router.get('/readings/:device_id/tidal', async (req, res) => {
  const { device_id } = req.params;
  const { hours = 24, start, end } = req.query;

  try {
    let result;
    if (start || end) {
      const conditions = ['device_id = $1'];
      const params = [device_id];
      let pIdx = 2;

      if (start) {
        conditions.push(`timestamp >= $${pIdx}`);
        params.push(new Date(start).toISOString());
        pIdx++;
      }
      if (end) {
        conditions.push(`timestamp <= $${pIdx}`);
        params.push(new Date(end).toISOString());
        pIdx++;
      }

      result = await query(`
        SELECT timestamp, water_level_cm, raw_distance_cm, temperature_c, battery_voltage
        FROM readings
        WHERE ${conditions.join(' AND ')}
        ORDER BY timestamp ASC
      `, params);
    } else {
      const timeWindowHours = Math.min(168, Math.max(1, parseInt(hours, 10) || 24));
      result = await query(`
        SELECT timestamp, water_level_cm, raw_distance_cm, temperature_c, battery_voltage
        FROM readings
        WHERE device_id = $1
          AND timestamp >= NOW() - ($2 || ' hours')::INTERVAL
        ORDER BY timestamp ASC
      `, [device_id, timeWindowHours.toString()]);
    }

    const analysis = analyzeTidalReadings(result.rows);
    res.json({
      success: true,
      deviceId: device_id,
      ...analysis
    });
  } catch (err) {
    console.error('[API Error /readings/:device_id/tidal]', err.message);
    res.status(500).json({ success: false, error: 'Gagal memproses analisis pasang surut' });
  }
});

// ==========================================
// 4. REMOTE CALIBRATION
// ==========================================

// POST /api/calibration/:device_id - Apply new calibration (Admin Only)
router.post('/calibration/:device_id', authenticateToken, requireAdmin, async (req, res) => {
  const { device_id } = req.params;
  const { sensor_height_cm, offset_cm, slope, applied_by, notes } = req.body;

  // Validation
  const height = parseFloat(sensor_height_cm);
  const offset = parseFloat(offset_cm ?? 0);
  const slopeFactor = parseFloat(slope ?? 1);

  if (isNaN(height) || height < 50 || height > 2000) {
    return res.status(400).json({ success: false, error: 'Tinggi sensor (sensor_height_cm) harus antara 50 cm dan 2000 cm' });
  }
  if (isNaN(offset) || offset < -100 || offset > 100) {
    return res.status(400).json({ success: false, error: 'Offset (offset_cm) harus antara -100 cm dan 100 cm' });
  }
  if (isNaN(slopeFactor) || slopeFactor < 0.8 || slopeFactor > 1.2) {
    return res.status(400).json({ success: false, error: 'Slope harus berada dalam rentang toleransi 0.800000 - 1.200000' });
  }

  try {
    // 1. Deactivate old calibration
    await query(
      'UPDATE calibrations SET is_active = false WHERE device_id = $1',
      [device_id]
    );

    // 2. Insert new calibration record
    const insertRes = await query(`
      INSERT INTO calibrations (
        device_id, sensor_height_cm, offset_cm, slope, applied_at, applied_by, notes, is_active
      )
      VALUES ($1, $2, $3, $4, NOW(), $5, $6, true)
      RETURNING *
    `, [
      device_id,
      height,
      offset,
      slopeFactor,
      applied_by || 'Web Operator',
      notes || 'Remote calibration via Web Dashboard'
    ]);

    // 3. Update device sensor_height_cm
    await query(
      'UPDATE devices SET sensor_height_cm = $1, updated_at = NOW() WHERE device_id = $2',
      [height, device_id]
    );

    // 4. Push to ESP32 over MQTT
    let mqttStatus = 'pushed';
    try {
      await publishCalibration(device_id, {
        sensor_height_cm: height,
        offset_cm: offset,
        slope: slopeFactor
      });
    } catch (mqttErr) {
      console.warn('[Calibration MQTT Warning]', mqttErr.message);
      mqttStatus = 'queued_or_broker_offline';
    }

    res.json({
      success: true,
      message: 'Kalibrasi berhasil disimpan dan dikirim ke perangkat',
      calibration: insertRes.rows[0],
      mqttStatus
    });
  } catch (err) {
    console.error('[API Error /calibration/:device_id]', err.message);
    res.status(500).json({ success: false, error: 'Gagal memperbarui kalibrasi' });
  }
});

// GET /api/calibration/:device_id/history - Calibration history
router.get('/calibration/:device_id/history', async (req, res) => {
  const { device_id } = req.params;
  try {
    const result = await query(`
      SELECT * FROM calibrations
      WHERE device_id = $1
      ORDER BY applied_at DESC
      LIMIT 50
    `, [device_id]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[API Error /calibration/:device_id/history]', err.message);
    res.status(500).json({ success: false, error: 'Gagal mengambil riwayat kalibrasi' });
  }
});

// ==========================================
// 5. ALERTS & DIAGNOSTICS
// ==========================================

// GET /api/alerts/:device_id - Device alerts
router.get('/alerts/:device_id', async (req, res) => {
  const { device_id } = req.params;
  const { status, limit = 100 } = req.query;

  const conditions = ['device_id = $1'];
  const params = [device_id];

  if (status === 'active') {
    conditions.push('resolved = false');
  } else if (status === 'resolved') {
    conditions.push('resolved = true');
  }

  params.push(Math.min(500, parseInt(limit, 10) || 100));

  try {
    const result = await query(`
      SELECT * FROM device_alerts
      WHERE ${conditions.join(' AND ')}
      ORDER BY timestamp DESC
      LIMIT $${params.length}
    `, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[API Error /alerts/:device_id]', err.message);
    res.status(500).json({ success: false, error: 'Gagal mengambil daftar alert' });
  }
});

// PATCH /api/alerts/:id/resolve - Mark alert as resolved
router.patch('/alerts/:id/resolve', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { resolved_by } = req.body;
  const operatorName = req.user?.fullName || req.user?.username || resolved_by || 'Operator Lapangan';

  try {
    const result = await query(`
      UPDATE device_alerts
      SET resolved = true, resolved_at = NOW(), resolved_by = $1
      WHERE id = $2
      RETURNING *
    `, [operatorName, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Alert tidak ditemukan' });
    }
    res.json({ success: true, message: 'Alert ditandai selesai', alert: result.rows[0] });
  } catch (err) {
    console.error('[API Error /alerts/:id/resolve]', err.message);
    res.status(500).json({ success: false, error: 'Gagal memperbarui status alert' });
  }
});

// GET /api/diagnostics/:device_id - Diagnostics snapshots
router.get('/diagnostics/:device_id', async (req, res) => {
  const { device_id } = req.params;
  try {
    const result = await query(`
      SELECT * FROM device_diagnostics
      WHERE device_id = $1
      ORDER BY timestamp DESC
      LIMIT 50
    `, [device_id]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[API Error /diagnostics/:device_id]', err.message);
    res.status(500).json({ success: false, error: 'Gagal mengambil log diagnostik' });
  }
});

// ==========================================
// 6. CSV EXPORT
// ==========================================

// GET /api/export/:device_id - Export CSV
router.get('/export/:device_id', async (req, res) => {
  const { device_id } = req.params;
  const { start, end } = req.query;

  const conditions = ['device_id = $1'];
  const params = [device_id];
  let paramIdx = 2;

  if (start) {
    const s = new Date(start);
    if (!isNaN(s.getTime())) {
      conditions.push(`timestamp >= $${paramIdx++}`);
      params.push(s.toISOString());
    }
  }

  if (end) {
    const e = new Date(end);
    if (!isNaN(e.getTime())) {
      conditions.push(`timestamp <= $${paramIdx++}`);
      params.push(e.toISOString());
    }
  }

  try {
    const result = await query(`
      SELECT timestamp, raw_distance_cm, water_level_cm, temperature_c,
             battery_voltage, battery_percent, signal_quality, sd_status, source
      FROM readings
      WHERE ${conditions.join(' AND ')}
      ORDER BY timestamp ASC
    `, params);

    // CSV header
    const headers = [
      'Timestamp (ISO)',
      'Water Level (cm)',
      'Raw Distance (cm)',
      'Temperature (C)',
      'Battery Voltage (V)',
      'Battery (%)',
      'Signal RSSI (dBm)',
      'SD Status',
      'Data Source'
    ];

    // CSV Injection sanitization helper
    const sanitizeCell = (val) => {
      if (val == null) return '';
      let str = String(val);
      // If starts with dangerous calc characters, escape with single quote
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
      }
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvLines = [headers.join(',')];
    for (const r of result.rows) {
      csvLines.push([
        sanitizeCell(new Date(r.timestamp).toISOString()),
        sanitizeCell(r.water_level_cm),
        sanitizeCell(r.raw_distance_cm),
        sanitizeCell(r.temperature_c),
        sanitizeCell(r.battery_voltage),
        sanitizeCell(r.battery_percent),
        sanitizeCell(r.signal_quality),
        sanitizeCell(r.sd_status),
        sanitizeCell(r.source)
      ].join(','));
    }

    const filename = `terraflow_${device_id}_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(csvLines.join('\r\n'));
  } catch (err) {
    console.error('[API Error /export/:device_id]', err.message);
    res.status(500).json({ success: false, error: 'Gagal mengekspor berkas CSV' });
  }
});

// ==========================================
// 7. SIMULATOR TRIGGERS (FOR DEMO & TESTING)
// ==========================================

router.post('/simulator/trigger-wdt', async (req, res) => {
  const { device_id = 'AWLR-001' } = req.body;
  try {
    const { getMqttClient } = require('../mqtt/subscriber');
    const client = getMqttClient();
    if (client && client.connected) {
      client.publish(`terraflow/${device_id}/alert`, JSON.stringify({
        device_id,
        timestamp: Math.floor(Date.now() / 1000),
        alert_code: 'WDT_RESET',
        severity: 'CRITICAL',
        message: 'Watchdog reset detected. Task sensorRead did not respond within 30s.',
        details: { watchdog_count: 1, trigger: 'Manual test injection' }
      }));
      res.json({ success: true, message: 'WDT Reset alert injected via MQTT' });
    } else {
      res.status(503).json({ success: false, error: 'MQTT client not connected' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/simulator/trigger-sensor-fail', async (req, res) => {
  const { device_id = 'AWLR-001' } = req.body;
  try {
    const { getMqttClient } = require('../mqtt/subscriber');
    const client = getMqttClient();
    if (client && client.connected) {
      client.publish(`terraflow/${device_id}/alert`, JSON.stringify({
        device_id,
        timestamp: Math.floor(Date.now() / 1000),
        alert_code: 'SENSOR_FAIL',
        severity: 'CRITICAL',
        message: 'Sensor ultrasonik tidak merespons setelah 5 kali percobaan pembacaan.',
        details: { consecutive_fails: 5, trigger: 'Manual test injection' }
      }));
      res.json({ success: true, message: 'Sensor Failure alert injected via MQTT' });
    } else {
      res.status(503).json({ success: false, error: 'MQTT client not connected' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
