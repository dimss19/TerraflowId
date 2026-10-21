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
router.get('/readings/:device_id', async (req, res) => {
  const { device_id } = req.params;
  const normalizedId = (device_id || '').trim().replace(/\s+/g, '-');
  const { start, end, limit = 500 } = req.query;

  const maxLimit = Math.min(2000, Math.max(1, parseInt(limit, 10) || 500));
  const conditions = ['(device_id = $1 OR device_id = $2)'];
  const params = [device_id, normalizedId];
  let paramIdx = 3;

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
  const normalizedId = (device_id || '').trim().replace(/\s+/g, '-');
  const { hours = 24, start, end } = req.query;

  try {
    let result;
    if (start || end) {
      const conditions = ['(device_id = $1 OR device_id = $2)'];
      const params = [device_id, normalizedId];
      let pIdx = 3;

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
  const { start, end, format = 'csv', aggregate = 'raw', tz = 'wib', unit = 'm' } = req.query;

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

// Helper to resolve calibration parameters for a device
async function getDeviceCalibration(deviceId) {
  try {
    const res = await query(
      `SELECT sensor_height_cm, offset_cm, slope 
       FROM calibrations 
       WHERE device_id = $1 AND is_active = true 
       ORDER BY applied_at DESC LIMIT 1`,
      [deviceId]
    );
    if (res.rows.length > 0) {
      return {
        height: parseFloat(res.rows[0].sensor_height_cm) || 600.0,
        offset: parseFloat(res.rows[0].offset_cm) || 0.0,
        slope: parseFloat(res.rows[0].slope) || 1.0
      };
    }
  } catch (err) {
    console.warn('[Get Calibration Warning]', err.message);
  }
  return { height: 600.0, offset: 0.0, slope: 1.0 };
}

// POST /api/readings/offline-sync - Synchronize single offline record (supports 1 record per minute rhythm)
router.post('/readings/offline-sync', async (req, res) => {
  try {
    const {
      device_id,
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
    if (!date || hour === undefined || minute === undefined) {
      return res.status(400).json({ success: false, error: 'Data minimal offline wajib memuat: date (YYYY-MM-DD), hour (jam), dan minute (menit)' });
    }

    const pad = (n) => String(n).padStart(2, '0');
    const h = Math.max(0, Math.min(23, parseInt(hour, 10) || 0));
    const m = Math.max(0, Math.min(59, parseInt(minute, 10) || 0));
    const s = Math.max(0, Math.min(59, parseInt(second, 10) || 0));
    
    // Construct valid timestamp
    const dateStr = String(date).trim();
    const isoString = `${dateStr}T${pad(h)}:${pad(m)}:${pad(s)}`;
    const parsedDate = new Date(isoString);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ success: false, error: `Format tanggal/waktu tidak valid: ${dateStr} ${h}:${m}:${s}` });
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
      finalWaterLevel = calibHeight - (effDist * calibSlope + calibOffset);
    }

    const insertSql = `
      INSERT INTO readings (
        device_id, timestamp, raw_distance_cm, water_level_cm,
        temperature_c, signal_quality, sd_status, reading_count, source
      )
      VALUES ($1, $2, $3, $4, $5, 100, 'ok', 0, 'offline_sync')
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
      28.0
    ]);

    const savedRow = resDb.rows[0];

    // Emit live WebSocket update so UI monitoring charts stream this playback
    try {
      const { getSocketIO } = require('../mqtt/subscriber');
      const io = getSocketIO ? getSocketIO() : null;
      if (io && savedRow) {
        io.emit('sensor:data', savedRow);
        io.emit('telemetry', { device_id, data: savedRow });
      }
    } catch (wsErr) {
      console.warn('[WS Emit Warning]', wsErr.message);
    }

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
router.post('/readings/offline-batch', async (req, res) => {
  try {
    const { device_id, records, recalculate = false, sensor_height_cm, offset_cm, slope } = req.body;
    if (!device_id || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, error: 'device_id dan array records wajib disertakan' });
    }

    let devCalib = null;
    if (recalculate) {
      devCalib = await getDeviceCalibration(device_id);
      if (sensor_height_cm != null) devCalib.height = parseFloat(sensor_height_cm);
      if (offset_cm != null) devCalib.offset = parseFloat(offset_cm);
      if (slope != null) devCalib.slope = parseFloat(slope);
    }

    let savedCount = 0;
    const pad = (n) => String(n).padStart(2, '0');

    for (const item of records) {
      if (!item.date || item.hour === undefined || item.minute === undefined) continue;

      const h = Math.max(0, Math.min(23, parseInt(item.hour, 10) || 0));
      const m = Math.max(0, Math.min(59, parseInt(item.minute, 10) || 0));
      const s = Math.max(0, Math.min(59, parseInt(item.second, 10) || 0));
      const dateStr = String(item.date).trim();
      const parsedDate = new Date(`${dateStr}T${pad(h)}:${pad(m)}:${pad(s)}`);
      if (isNaN(parsedDate.getTime())) continue;

      const rawDist = item.raw_distance_cm != null ? parseFloat(item.raw_distance_cm) : null;
      const filtDist = item.filtered_distance_cm != null ? parseFloat(item.filtered_distance_cm) : rawDist;
      const effDist = filtDist != null ? filtDist : rawDist;

      let waterLevel = item.water_level_cm != null ? parseFloat(item.water_level_cm) : null;
      if (recalculate && effDist != null && devCalib) {
        waterLevel = devCalib.height - (effDist * devCalib.slope + devCalib.offset);
      }

      try {
        await query(`
          INSERT INTO readings (
            device_id, timestamp, raw_distance_cm, water_level_cm,
            temperature_c, signal_quality, sd_status, reading_count, source
          )
          VALUES ($1, $2, $3, $4, $5, 100, 'ok', 0, 'offline_sync')
          ON CONFLICT (device_id, timestamp) DO UPDATE SET
            water_level_cm = EXCLUDED.water_level_cm,
            raw_distance_cm = EXCLUDED.raw_distance_cm,
            source = 'offline_sync'
        `, [
          device_id,
          parsedDate.toISOString(),
          rawDist,
          waterLevel,
          28.0
        ]);
        savedCount++;
      } catch (rowErr) {
        console.warn('[Offline Batch Row Warning]', rowErr.message);
      }
    }

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
