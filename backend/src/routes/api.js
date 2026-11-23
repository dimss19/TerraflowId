const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { analyzeTidalReadings } = require('../services/tidalAnalysis');
const { parseTelemetryTimestamp, alignToMinute } = require('../utils/timestamp');
const { getSocketIO, runReadingRules } = require('../mqtt/subscriber');
const { getDeviceCalibration, calcWaterLevel } = require('../services/calibration');
const { authenticateToken, requireAdmin } = require('./auth');
const { checkDeviceAccess, requireDeviceAccess } = require('../middleware/deviceAccess');
const { addDateRange } = require('../utils/dateRange');

// ==========================================
// 1. READINGS & TELEMETRY
// ==========================================

// GET /api/readings/:device_id/latest - Get most recent reading
router.get('/readings/:device_id/latest', authenticateToken, requireDeviceAccess, async (req, res) => {
  const { device_id } = req.params;
  const normalizedId = (device_id || '').trim().replace(/\s+/g, '-');
  try {
    const result = await query(`
      SELECT * FROM readings
      WHERE (device_id = $1 OR device_id = $2)
      ORDER BY timestamp DESC
      LIMIT 1
    `, [device_id, normalizedId]);

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
router.get('/readings/:device_id', authenticateToken, requireDeviceAccess, async (req, res) => {
  const { device_id } = req.params;
  const normalizedId = (device_id || '').trim().replace(/\s+/g, '-');
  const { start, end, limit = 500 } = req.query;

  const maxLimit = Math.min(2000, Math.max(1, parseInt(limit, 10) || 500));
  const conditions = ['(device_id = $1 OR device_id = $2)'];
  const params = [device_id, normalizedId];
  addDateRange(conditions, params, start, end);

  params.push(maxLimit);
  const sql = `
    SELECT * FROM readings
    WHERE ${conditions.join(' AND ')}
    ORDER BY timestamp DESC
    LIMIT $${params.length}
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
router.get('/readings/:device_id/tidal', authenticateToken, requireDeviceAccess, async (req, res) => {
  const { device_id } = req.params;
  const normalizedId = (device_id || '').trim().replace(/\s+/g, '-');
  const { hours = 24, start, end } = req.query;

  try {
    let result;
    if (start || end) {
      const conditions = ['(device_id = $1 OR device_id = $2)'];
      const params = [device_id, normalizedId];
      addDateRange(conditions, params, start, end);

      result = await query(`
        SELECT timestamp, water_level_cm, raw_distance_cm, temperature_c
        FROM readings
        WHERE ${conditions.join(' AND ')}
        ORDER BY timestamp ASC
      `, params);
    } else {
      const timeWindowHours = Math.min(168, Math.max(1, parseInt(hours, 10) || 48));
      
      // Selalu gunakan data terbaru sebagai acuan jika tanpa filter tanggal eksplisit
      const maxTsRes = await query(`
        SELECT MAX(timestamp) as latest_ts 
        FROM readings 
        WHERE (device_id = $1 OR device_id = $2)
      `, [device_id, normalizedId]);

      const latestTs = maxTsRes.rows[0]?.latest_ts;

      if (!latestTs) {
        result = { rows: [] };
      } else {
        result = await query(`
          SELECT timestamp, water_level_cm, raw_distance_cm, temperature_c
          FROM readings
          WHERE (device_id = $1 OR device_id = $2)
            AND timestamp >= $3::timestamptz - ($4 || ' hours')::INTERVAL
            AND timestamp <= $3::timestamptz
          ORDER BY timestamp ASC
        `, [device_id, normalizedId, latestTs, timeWindowHours.toString()]);

        // Jika jumlah data dalam jendela waktu tersebut sedikit (< 150 sampel), fallback ke 500 pembacaan terbaru agar kurva panjang
        if (result.rows.length < 150) {
          result = await query(`
            SELECT timestamp, water_level_cm, raw_distance_cm, temperature_c
            FROM (
              SELECT timestamp, water_level_cm, raw_distance_cm, temperature_c
              FROM readings
              WHERE (device_id = $1 OR device_id = $2)
              ORDER BY timestamp DESC
              LIMIT 500
            ) sub
            ORDER BY timestamp ASC
          `, [device_id, normalizedId]);
        }
      }
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
      applied_by || 'Admin',
      notes || 'Aturan kalkulasi web'
    ]);

    // 3. Update device sensor_height_cm
    await query(
      'UPDATE devices SET sensor_height_cm = $1, updated_at = NOW() WHERE device_id = $2',
      [height, device_id]
    );

    // CATATAN ARSITEKTUR:
    // Kalibrasi TIDAK dikirim ke perangkat via MQTT.
    // Perangkat di lapangan murni mengirim data jarak mentah (raw distance),
    // sedangkan perhitungan muka air dilakukan di server web.

    res.json({
      success: true,
      message: 'Parameter konfigurasi sensor berhasil disimpan di server',
      calibration: insertRes.rows[0]
    });
  } catch (err) {
    console.error('[API Error /calibration/:device_id]', err.message);
    res.status(500).json({ success: false, error: 'Gagal memperbarui kalibrasi' });
  }
});

// GET /api/calibration/:device_id/history - Calibration history
router.get('/calibration/:device_id/history', authenticateToken, requireDeviceAccess, async (req, res) => {
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
router.get('/alerts/:device_id', authenticateToken, requireDeviceAccess, async (req, res) => {
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
    const alertRes = await query('SELECT device_id FROM device_alerts WHERE id = $1', [id]);
    if (alertRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Alert tidak ditemukan' });
    }
    if (!(await checkDeviceAccess(req, res, alertRes.rows[0].device_id))) return;

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
router.get('/diagnostics/:device_id', authenticateToken, requireDeviceAccess, async (req, res) => {
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
router.get('/export/:device_id', authenticateToken, requireDeviceAccess, async (req, res) => {
  const { device_id } = req.params;
  const { start, end, format = 'csv', aggregate = 'raw', tz = 'wib', unit = 'm' } = req.query;

  const conditions = ['device_id = $1'];
  const params = [device_id];
  addDateRange(conditions, params, start, end);

  try {
    const result = await query(`
      SELECT timestamp, raw_distance_cm, water_level_cm, temperature_c,
             signal_quality, sd_status, source
      FROM readings
      WHERE ${conditions.join(' AND ')}
      ORDER BY timestamp ASC
    `, params);

    let rows = result.rows;

    // Aggregation downsampling (Raw, 1m, 5m, 15m, 30m, 1h)
    if (aggregate !== 'raw' && rows.length > 0) {
      let intervalMs = 5 * 60 * 1000;
      if (aggregate === '1m') intervalMs = 60 * 1000;
      else if (aggregate === '5m') intervalMs = 5 * 60 * 1000;
      else if (aggregate === '15m') intervalMs = 15 * 60 * 1000;
      else if (aggregate === '30m') intervalMs = 30 * 60 * 1000;
      else if (aggregate === '1h') intervalMs = 60 * 60 * 1000;

      const buckets = new Map();
      for (const r of rows) {
        const t = new Date(r.timestamp).getTime();
        const bucketKey = Math.floor(t / intervalMs) * intervalMs;
        if (!buckets.has(bucketKey)) {
          buckets.set(bucketKey, {
            count: 0,
            waterLevelSum: 0,
            lastR: r
          });
        }
        const b = buckets.get(bucketKey);
        b.count++;
        b.waterLevelSum += (Number(r.water_level_cm) || 0);
        b.lastR = r;
      }

      rows = Array.from(buckets.entries()).map(([ts, b]) => ({
        timestamp: new Date(ts).toISOString(),
        water_level_cm: (b.waterLevelSum / b.count).toFixed(2),
        signal_quality: b.lastR.signal_quality,
        sd_status: b.lastR.sd_status,
        source: b.lastR.source
      }));
    }

    // Timezone formatter helper
    const formatTime = (tsIso, formatType) => {
      const d = new Date(tsIso);
      let adjusted = d;
      if (tz === 'wib') {
        // WIB is UTC+7
        adjusted = new Date(d.getTime() + 7 * 3600 * 1000);
      }
      const pad = (n) => String(n).padStart(2, '0');
      const YYYY = adjusted.getUTCFullYear();
      const MM = pad(adjusted.getUTCMonth() + 1);
      const DD = pad(adjusted.getUTCDate());
      const HH = pad(adjusted.getUTCHours());
      const mm = pad(adjusted.getUTCMinutes());
      const ss = pad(adjusted.getUTCSeconds());

      if (formatType === 'txt_min') return `${YYYY}-${MM}-${DD} ${HH}:${mm}`;
      return `${YYYY}-${MM}-${DD} ${HH}:${mm}:${ss}`;
    };

    const dateStr = new Date().toISOString().slice(0, 10);

    // TXT Hydrology Standard Log format (YYYY-MM-DD HH:mm:ss   <value>)
    if (format === 'txt_sec' || format === 'txt_min' || format === 'txt') {
      const lines = [];
      for (const r of rows) {
        const timeStr = formatTime(r.timestamp, format);
        const wl = Number(r.water_level_cm) || 0;
        const val = unit === 'cm' ? wl.toFixed(1) : (wl / 100).toFixed(3);
        lines.push(`${timeStr}   ${val}`);
      }
      const filename = `${device_id}_${aggregate}_${dateStr}.txt`;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(lines.join('\r\n'));
    }

    // JSON API Format (Cleaned, Water Level focused)
    if (format === 'json') {
      const data = rows.map(r => ({
        timestamp: formatTime(r.timestamp, 'txt_sec'),
        water_level: unit === 'cm' ? Number(r.water_level_cm) : Number((Number(r.water_level_cm) / 100).toFixed(3)),
        unit: unit === 'cm' ? 'cm' : 'm',
        signal_rssi: r.signal_quality,
        source: r.source || 'live'
      }));
      const filename = `${device_id}_${dateStr}.json`;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.json(data);
    }

    // CSV format (Streamlined to verified parameters only)
    const headers = [
      `Waktu (${tz === 'wib' ? 'WIB GMT+7' : 'UTC'})`,
      unit === 'cm' ? 'Muka Air (cm)' : 'Muka Air (m)',
      'Sinyal RSSI (dBm)',
      'Sumber Data'
    ];

    // CSV Injection sanitization helper
    const sanitizeCell = (val) => {
      if (val == null) return '';
      let str = String(val);
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
      }
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvLines = [headers.join(',')];
    for (const r of rows) {
      const wl = Number(r.water_level_cm) || 0;
      const wlVal = unit === 'cm' ? wl.toFixed(1) : (wl / 100).toFixed(3);
      csvLines.push([
        sanitizeCell(formatTime(r.timestamp, 'txt_sec')),
        sanitizeCell(wlVal),
        sanitizeCell(r.signal_quality),
        sanitizeCell(r.source)
      ].join(','));
    }

    const filename = `terraflow_${device_id}_${aggregate}_${dateStr}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(csvLines.join('\r\n'));
  } catch (err) {
    console.error('[API Error /export/:device_id]', err.message);
    res.status(500).json({ success: false, error: 'Gagal mengekspor berkas telemetri' });
  }
});

// ==========================================
// 6. KONVERSI & SINKRONISASI DATA OFFLINE
// ==========================================

// POST /api/readings/offline-sync - Synchronize single offline record (supports 1 record per minute rhythm)
router.post('/readings/offline-sync', authenticateToken, async (req, res) => {
  try {
    const {
      device_id,
      timestamp,
      date,
      hour,
      minute,
      second = 0,
      raw_distance_cm,
      filtered_distance_cm,
      water_level_cm,
      recalculate = false,
      sensor_height_cm,
      offset_cm,
      slope
    } = req.body;

    if (!device_id) {
      return res.status(400).json({ success: false, error: 'device_id wajib disertakan' });
    }
    if (!(await checkDeviceAccess(req, res, device_id))) return;
    // Sumber waktu: `timestamp` (epoch) menjadi utama; date+jam fallback
    // yang diinterpretasi sebagai WIB. Lihat utils/timestamp.js.
    if (timestamp === undefined && (!date || hour === undefined || minute === undefined)) {
      return res.status(400).json({ success: false, error: 'Data minimal offline wajib memuat: timestamp (epoch), atau date (YYYY-MM-DD) + hour (jam) + minute (menit)' });
    }

    const parsedDate = alignToMinute(parseTelemetryTimestamp({ timestamp, date, hour, minute, second }));
    if (!parsedDate) {
      return res.status(400).json({ success: false, error: 'Format timestamp atau tanggal/waktu tidak valid' });
    }

    const rawDist = raw_distance_cm != null ? parseFloat(raw_distance_cm) : null;
    const filtDist = filtered_distance_cm != null ? parseFloat(filtered_distance_cm) : rawDist;
    const effDist = filtDist != null ? filtDist : rawDist;

    let finalWaterLevel = water_level_cm != null ? parseFloat(water_level_cm) : null;

    if (recalculate && effDist != null) {
      let calibHeight = sensor_height_cm != null ? parseFloat(sensor_height_cm) : null;
      let calibOffset = offset_cm != null ? parseFloat(offset_cm) : null;
      let calibSlope = slope != null ? parseFloat(slope) : null;

      if (calibHeight == null || calibOffset == null || calibSlope == null) {
        const devCalib = await getDeviceCalibration(device_id);
        calibHeight = calibHeight != null ? calibHeight : devCalib.height;
        calibOffset = calibOffset != null ? calibOffset : devCalib.offset;
        calibSlope = calibSlope != null ? calibSlope : devCalib.slope;
      }
      finalWaterLevel = calcWaterLevel(effDist, { height: calibHeight, offset: calibOffset, slope: calibSlope });
    }

    const insertSql = `
      INSERT INTO readings (
        device_id, timestamp, raw_distance_cm, water_level_cm,
        temperature_c, signal_quality, sd_status, reading_count, source
      )
      VALUES ($1, $2, $3, $4, $5, NULL, NULL, 0, 'offline_sync')
      ON CONFLICT (device_id, timestamp) DO UPDATE SET
        water_level_cm = EXCLUDED.water_level_cm,
        raw_distance_cm = EXCLUDED.raw_distance_cm,
        source = 'offline_sync'
      RETURNING *
    `;

    const resDb = await query(insertSql, [
      device_id,
      parsedDate.toISOString(),
      rawDist,
      finalWaterLevel,
      req.body.temperature_c != null ? parseFloat(req.body.temperature_c) : null
    ]);

    const savedRow = resDb.rows[0];

    // Emit live WebSocket update so UI monitoring charts stream this playback
    try {
      const io = getSocketIO();
      if (io && savedRow) {
        io.emit('sensor:data', savedRow);
      }
    } catch (wsErr) {
      console.warn('[WS Emit Warning]', wsErr.message);
    }

    // Evaluasi rule alert (SENSOR_ANOMALY, dll.)
    await runReadingRules(device_id, savedRow);

    res.json({
      success: true,
      message: 'Data offline berhasil disinkronkan',
      record: savedRow
    });
  } catch (err) {
    console.error('[API Error /readings/offline-sync]', err.message);
    res.status(500).json({ success: false, error: 'Gagal menyinkronkan data offline: ' + err.message });
  }
});

// POST /api/readings/offline-batch - Bulk convert & insert offline records
router.post('/readings/offline-batch', authenticateToken, async (req, res) => {
  try {
    const { device_id, records, recalculate = false, sensor_height_cm, offset_cm, slope } = req.body;
    if (!device_id || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, error: 'device_id dan array records wajib disertakan' });
    }
    if (!(await checkDeviceAccess(req, res, device_id))) return;

    let devCalib = null;
    if (recalculate) {
      devCalib = await getDeviceCalibration(device_id);
      if (sensor_height_cm != null) devCalib.height = parseFloat(sensor_height_cm);
      if (offset_cm != null) devCalib.offset = parseFloat(offset_cm);
      if (slope != null) devCalib.slope = parseFloat(slope);
    }

    let savedCount = 0;
    let lastInsertedRow = null;

    for (const item of records) {
      // Timestamp: field `timestamp` (epoch) menjadi sumber utama, fallback
      // date+jam diinterpretasi sebagai WIB. Lihat utils/timestamp.js.
      const parsedDate = alignToMinute(parseTelemetryTimestamp(item));
      if (!parsedDate) continue;

      const rawDist = item.raw_distance_cm != null ? parseFloat(item.raw_distance_cm) : null;
      const filtDist = item.filtered_distance_cm != null ? parseFloat(item.filtered_distance_cm) : rawDist;
      const effDist = filtDist != null ? filtDist : rawDist;

      let waterLevel = item.water_level_cm != null ? parseFloat(item.water_level_cm) : null;
      if (recalculate && effDist != null && devCalib) {
        waterLevel = calcWaterLevel(effDist, devCalib);
      }

      try {
        const inserted = await query(`
          INSERT INTO readings (
            device_id, timestamp, raw_distance_cm, water_level_cm,
            temperature_c, signal_quality, sd_status, reading_count, source
          )
          VALUES ($1, $2, $3, $4, $5, NULL, NULL, 0, 'offline_sync')
          ON CONFLICT (device_id, timestamp) DO UPDATE SET
            water_level_cm = EXCLUDED.water_level_cm,
            raw_distance_cm = EXCLUDED.raw_distance_cm,
            source = 'offline_sync'
          RETURNING *
        `, [
          device_id,
          parsedDate.toISOString(),
          rawDist,
          waterLevel,
          item.temperature_c != null ? parseFloat(item.temperature_c) : null
        ]);
        savedCount++;
        lastInsertedRow = inserted.rows[0] || null;
      } catch (rowErr) {
        console.warn('[Offline Batch Row Warning]', rowErr.message);
      }
    }

    // Evaluasi rule alert untuk data offline yang disinkronkan
    await runReadingRules(device_id, lastInsertedRow);

    res.json({
      success: true,
      message: `Berhasil mengonversi dan menyimpan ${savedCount} data offline`,
      saved_count: savedCount
    });
  } catch (err) {
    console.error('[API Error /readings/offline-batch]', err.message);
    res.status(500).json({ success: false, error: 'Gagal memproses batch offline: ' + err.message });
  }
});

module.exports = router;
