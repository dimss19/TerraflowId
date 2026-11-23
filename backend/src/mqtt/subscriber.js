const mqtt = require('mqtt');
const config = require('../config');
const { query } = require('../db/connection');
const { parseTelemetryTimestamp, alignToMinute } = require('../utils/timestamp');
const { getActiveCalibration, calcWaterLevel } = require('../services/calibration');
const { evaluateReadingRules, evaluateDiagnosticsRules } = require('../services/alertRules');

let mqttClient = null;
let ioInstance = null;

function setSocketIO(io) {
  ioInstance = io;
}

function initSubscriber() {
  console.log('[MQTT Subscriber] Connecting to broker at:', config.mqtt.url);
  const connectOptions = {
    clientId: `terraflow_backend_${Math.random().toString(16).substring(2, 8)}`,
    clean: true,
    reconnectPeriod: 3000,
  };
  // Broker lokal memerlukan kredensial yang sama bila autentikasi diaktifkan
  if (config.mqtt.user) connectOptions.username = config.mqtt.user;
  if (config.mqtt.password) connectOptions.password = config.mqtt.password;

  mqttClient = mqtt.connect(config.mqtt.url, connectOptions);

  mqttClient.on('connect', () => {
    console.log('[MQTT Subscriber] Connected to broker successfully!');
    
    // Pola topik firmware: terraflow/<device_id>/<subtopic> (lihat firmware/src/mqtt_client.cpp)
    const topics = [
      'terraflow/+/data',
      'terraflow/+/data/bulk',
      'terraflow/+/alert',
      'terraflow/+/diagnostics',
      'terraflow/+/status',
      'terraflow/+/calibration/response',
      'terraflow/+/command/test_mode/response'
    ];

    mqttClient.subscribe(topics, (err) => {
      if (err) {
        console.error('[MQTT Subscriber] Subscription error:', err.message);
      } else {
        console.log('[MQTT Subscriber] Subscribed to:', topics.join(', '));
      }
    });
  });

  mqttClient.on('message', async (topic, payload) => {
    try {
      const parts = topic.split('/');
      if (parts.length < 3 || parts[0] !== 'terraflow') return;

      const deviceId = parts[1];
      const subtopic = parts.slice(2).join('/');

      const data = JSON.parse(payload.toString());
      await handleMessage(deviceId, subtopic, data);
    } catch (err) {
      console.error(`[MQTT Subscriber Error] Topic: ${topic} | Error:`, err.message);
    }
  });

  mqttClient.on('error', (err) => {
    console.error('[MQTT Subscriber Client Error]', err.message);
  });

  return mqttClient;
}

// Kirim alert baru ke seluruh klien WebSocket.
function emitAlerts(alerts) {
  if (!ioInstance || !Array.isArray(alerts)) return;
  for (const alert of alerts) {
    ioInstance.emit('alert:new', alert);
  }
}

// Evaluasi rule alert berbasis pembacaan lalu broadcast hasilnya.
// Tidak pernah melempar error: kegagalan rule engine tidak boleh
// menggagalkan penyimpanan data.
async function runReadingRules(deviceId, row) {
  if (!row) return;
  try {
    emitAlerts(await evaluateReadingRules(deviceId, row));
  } catch (e) {
    console.warn('[Rule Engine] error:', e.message);
  }
}

async function handleMessage(deviceId, subtopic, data) {
  // Only update device last_seen to NOW() if actual telemetry data or active report is sent
  if (subtopic === 'data' || subtopic === 'data/bulk' || subtopic === 'diagnostics' || (subtopic === 'status' && data?.status === 'online')) {
    await query(
      'UPDATE devices SET last_seen = NOW() WHERE device_id = $1',
      [deviceId]
    ).catch(() => {});
  }

  if (subtopic === 'data') {
    await handleSingleReading(deviceId, data);
  } else if (subtopic === 'data/bulk') {
    await handleBulkReadings(deviceId, data);
  } else if (subtopic === 'alert') {
    await handleAlert(deviceId, data);
  } else if (subtopic === 'diagnostics') {
    await handleDiagnostics(deviceId, data);
  } else if (subtopic === 'status') {
    const isOnline = data.status === 'online';
    // Status online: last_seen sudah diperbarui di awal handleMessage.
    if (!isOnline) {
      // Explicit offline status (e.g. LWT or disconnect) sets last_seen to past so it registers offline
      await query(
        "UPDATE devices SET last_seen = NOW() - INTERVAL '1 hour' WHERE device_id = $1",
        [deviceId]
      ).catch(() => {});
    }
    if (ioInstance) {
      ioInstance.emit('device:status', { 
        device_id: deviceId, 
        status: data.status, 
        is_active: isOnline,
        last_seen: isOnline ? new Date().toISOString() : new Date(Date.now() - 3600000).toISOString()
      });
    }
  } else if (subtopic === 'calibration/response') {
    console.log(`[MQTT Calibration ACK] Device ${deviceId} confirmed calibration:`, data);
    if (ioInstance) {
      ioInstance.emit('calibration:ack', { deviceId, data });
    }
  } else if (subtopic === 'command/test_mode/response') {
    console.log(`[MQTT Test Mode Response] Device ${deviceId}:`, data);
    try {
      const { testModeRegistry } = require('../routes/devices');
      if (testModeRegistry) {
        if (data.test_mode) {
          testModeRegistry.set(deviceId, {
            active: true,
            expiresAt: Date.now() + (data.duration_sec || 300) * 1000,
            duration_sec: data.duration_sec || 300
          });
        } else {
          testModeRegistry.delete(deviceId);
        }
      }
    } catch (_) {}
    if (ioInstance) {
      ioInstance.emit('device:test_mode', { deviceId, data });
    }
  }
}

async function handleSingleReading(deviceId, data) {
  const isTestMode = data.source === 'test' || data.is_test === true;

  // Timestamp: field `timestamp` (epoch) menjadi sumber utama, fallback
  // date+jam diinterpretasi sebagai WIB. Lihat utils/timestamp.js.
  let ts = parseTelemetryTimestamp(data) || new Date();

  // Align timestamp ke menit (:00) HANYA untuk mode sampling normal.
  // Untuk Mode Uji Cepat (1 detik), pertahankan detik presisi agar aliran data real-time tidak tertimpa!
  if (!isTestMode) {
    ts = alignToMinute(ts);
  }
  
  // Aturan perhitungan muka air server-side dari data mentah sensor
  let waterLevel = data.water_level_cm != null ? Number(data.water_level_cm) : null;
  const rawDist = data.raw_distance_cm != null ? Number(data.raw_distance_cm) : null;

  if (rawDist != null) {
    try {
      // Hanya hitung ulang bila ada kalibrasi aktif; tanpa itu nilai dari perangkat dipakai.
      const calib = await getActiveCalibration(deviceId);
      if (calib) {
        waterLevel = calcWaterLevel(rawDist, calib);
      }
    } catch (e) {
      console.warn('[Calibration Rule Warning]', e.message);
    }
  }

  const insertSql = `
    INSERT INTO readings (
      device_id, timestamp, raw_distance_cm, water_level_cm,
      temperature_c, signal_quality, sd_status, reading_count, source,
      sensor_error, write_fail_count
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (device_id, timestamp) DO UPDATE SET
      water_level_cm = EXCLUDED.water_level_cm,
      raw_distance_cm = EXCLUDED.raw_distance_cm,
      temperature_c = EXCLUDED.temperature_c,
      signal_quality = EXCLUDED.signal_quality,
      source = EXCLUDED.source,
      sd_status = EXCLUDED.sd_status,
      sensor_error = EXCLUDED.sensor_error,
      write_fail_count = EXCLUDED.write_fail_count
    RETURNING *
  `;

  const values = [
    deviceId,
    ts,
    rawDist,
    waterLevel,
    data.temperature_c != null ? Number(data.temperature_c) : null,
    data.signal_quality != null ? Number(data.signal_quality) : null,
    // JANGAN pasang fallback `|| 'ok'` di sini. Firmware kini mengirim status
    // MicroSD yang sebenarnya; mengubah nilai kosong/undefined menjadi 'ok'
    // berarti backend ikut memalsukan kesehatan perangkat - persis masalah
    // yang sedang kita hilangkan di sisi firmware.
    data.sd_status != null ? String(data.sd_status).slice(0, 20) : null,
    data.reading_count != null ? Number(data.reading_count) : null,
    data.source || (isTestMode ? 'test' : 'live'),
    data.sensor_error != null ? String(data.sensor_error).slice(0, 20) : null,
    data.write_fail_count != null ? Number(data.write_fail_count) : null
  ];

  // Insert dibungkus try/catch lokal. Sebelumnya kegagalan DB hanya tertangkap
  // catch-all terluar yang mencetak err.message tanpa payload, sehingga satu
  // siklus telemetri bisa hilang total tanpa petunjuk penyebab - kasus nyata:
  // error 22001 (value too long) dari sd_status VARCHAR(10).
  let res;
  try {
    res = await query(insertSql, values);
  } catch (err) {
    console.error(
      `[MQTT Telemetry GAGAL SIMPAN] Device: ${deviceId} | Kode: ${err.code || '-'} | ${err.message}\n` +
      `  Payload yang ditolak: ${JSON.stringify(data)}`
    );
    throw err;
  }
  const savedRow = res.rows[0];
  console.log(`[MQTT Telemetry] Device: ${deviceId} | Raw: ${rawDist} cm | Level: ${waterLevel} cm | Temp: ${data.temperature_c}°C | Source: ${data.source || (isTestMode ? 'test' : 'live')}`);

  // Broadcast to Web Dashboard via WebSocket
  if (ioInstance && savedRow) {
    const livePayload = {
      ...savedRow,
      raw_distance_mm: data.raw_distance_mm != null ? data.raw_distance_mm : (rawDist != null ? Math.round(rawDist * 10) : null),
      filtered_distance_cm: data.filtered_distance_cm != null ? Number(data.filtered_distance_cm) : (rawDist != null ? Number(rawDist) : null),
      valid_samples: data.valid_samples,
      is_blind_spot: data.is_blind_spot || (rawDist != null && rawDist <= 50.0),
      is_test: isTestMode
    };

    ioInstance.emit('sensor:data', livePayload);

    if (isTestMode) {
      ioInstance.emit('test:reading', { device_id: deviceId, data: livePayload });
    }
  }

  // Evaluasi rule alert (SENSOR_ANOMALY, dll.) terhadap pembacaan ini
  await runReadingRules(deviceId, savedRow);
}

async function handleBulkReadings(deviceId, payload) {
  const records = payload.records || [];
  let savedCount = 0;
  let skippedCount = 0;

  const failedTimestamps = [];

  for (const item of records) {
    // Timestamp: field `timestamp` (epoch) menjadi sumber utama, fallback
    // date+jam diinterpretasi sebagai WIB. Lihat utils/timestamp.js.
    let ts = parseTelemetryTimestamp(item);
    if (!ts) {
      // Jam perangkat belum sinkron saat record ini dicatat (timestamp =
      // uptime). Waktu aslinya tidak bisa dipulihkan; jangan disimpan sebagai
      // 1970 dan jangan dimasukkan ke failed_timestamps (akan dikirim ulang
      // tanpa henti). Dihitung sebagai "skipped" di ACK.
      skippedCount++;
      continue;
    }

    // Align timestamp to the exact minute (:00 seconds)
    ts = alignToMinute(ts);
    
    const insertSql = `
      INSERT INTO readings (
        device_id, timestamp, raw_distance_cm, water_level_cm,
        temperature_c, signal_quality, sd_status, reading_count, source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'sd_buffer')
      ON CONFLICT (device_id, timestamp) DO NOTHING
      RETURNING *
    `;

    try {
      const inserted = await query(insertSql, [
        deviceId,
        ts,
        item.raw_distance_cm != null ? Number(item.raw_distance_cm) : null,
        item.water_level_cm != null ? Number(item.water_level_cm) : null,
        item.temperature_c != null ? Number(item.temperature_c) : null,
        item.signal_quality != null ? Number(item.signal_quality) : null,
        item.sd_status != null ? String(item.sd_status).slice(0, 20) : null,
        item.reading_count != null ? Number(item.reading_count) : null
      ]);
      savedCount++;

      // Evaluasi rule alert untuk data offline yang disinkronkan
      await runReadingRules(deviceId, inserted.rows[0]);
    } catch (e) {
      console.warn('[Bulk Insert Warning]', e.message);
      // Catat timestamp yang gagal agar perangkat hanya mengulang baris ini
      failedTimestamps.push(Math.floor(ts.getTime() / 1000));
    }
  }

  // Publish ACK ke perangkat. Status mencerminkan kondisi sebenarnya:
  // perangkat hanya menandai record "terkirim" untuk yang benar-benar
  // tersimpan di server.
  const totalRecords = records.length;
  const status = failedTimestamps.length === 0
    ? 'ok'
    : (savedCount > 0 ? 'partial' : 'error');

  const ackTopic = `terraflow/${deviceId}/data/bulk/ack`;
  const ackPayload = JSON.stringify({
    device_id: deviceId,
    batch_id: payload.batch_id || 'unknown',
    chunk: payload.chunk || 1,
    status,
    records_total: totalRecords,
    records_saved: savedCount,
    records_failed: failedTimestamps.length,
    records_skipped: skippedCount,
    failed_timestamps: failedTimestamps,
    timestamp: Math.floor(Date.now() / 1000)
  });

  if (mqttClient && mqttClient.connected) {
    mqttClient.publish(ackTopic, ackPayload);
    console.log(`[MQTT Bulk ACK] chunk ${payload.chunk} -> status=${status} (${savedCount}/${totalRecords} saved, ${failedTimestamps.length} failed) ke ${ackTopic}`);
  }

  if (ioInstance) {
    ioInstance.emit('sensor:sync_progress', {
      deviceId,
      chunk: payload.chunk,
      totalChunks: payload.total_chunks,
      recordsSaved: savedCount
    });
  }
}

async function handleAlert(deviceId, data) {
  // Waktu terima server dipakai bila jam perangkat belum sinkron (uptime).
  const ts = parseTelemetryTimestamp(data) || new Date();
  
  const insertSql = `
    INSERT INTO device_alerts (
      device_id, timestamp, alert_code, severity, message, details, resolved
    )
    VALUES ($1, $2, $3, $4, $5, $6, false)
    RETURNING *
  `;

  const res = await query(insertSql, [
    deviceId,
    ts,
    data.alert_code || 'UNKNOWN_ALERT',
    data.severity || 'WARNING',
    data.message || 'No description provided',
    JSON.stringify(data.details || {})
  ]);

  const newAlert = res.rows[0];
  console.warn(`[Device Alert] [${newAlert.severity}] ${deviceId}: ${newAlert.message}`);

  if (ioInstance && newAlert) {
    ioInstance.emit('alert:new', newAlert);
  }
}

async function handleDiagnostics(deviceId, data) {
  // Waktu terima server dipakai bila jam perangkat belum sinkron (uptime).
  const ts = parseTelemetryTimestamp(data) || new Date();
  
  // Helper: hanya mengubah nilai yang BENAR-BENAR ada. Nilai yang tidak
  // dikirim perangkat disimpan sebagai NULL, bukan ditebak dengan default
  // optimistis. Versi lama memakai `data.wifi_rssi || -70` (sinyal palsu),
  // `data.sd_card_ok !== false` (undefined dianggap sehat), dan
  // `data.boot_reason || 'NORMAL'` - semuanya menyembunyikan data yang hilang.
  const num = (v) => (v != null && v !== '' ? Number(v) : null);
  const bool = (v) => (typeof v === 'boolean' ? v : null);
  const str = (v, max) => (v != null && v !== '' ? String(v).slice(0, max) : null);

  const insertSql = `
    INSERT INTO device_diagnostics (
      device_id, timestamp, boot_reason, uptime_sec, boot_count,
      watchdog_count, brownout_count, panic_count, free_heap_bytes,
      wifi_rssi, sd_card_ok, sensor_ok, esp_temp_c,
      pending_unsent, firmware_version,
      wake_count, sd_status, sensor_error, sensor_fail_streak,
      sensor_power_on, write_fail_count
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20, $21)
    RETURNING *
  `;

  const res = await query(insertSql, [
    deviceId,
    ts,
    str(data.boot_reason, 30),
    num(data.uptime_sec),
    num(data.boot_count),
    num(data.watchdog_count),
    num(data.brownout_count),
    num(data.panic_count),
    num(data.free_heap_bytes),
    num(data.wifi_rssi),
    bool(data.sd_card_ok),
    bool(data.sensor_ok),
    num(data.esp_temp_c),
    num(data.pending_unsent),
    str(data.firmware_version, 20),
    num(data.wake_count),
    str(data.sd_status, 20),
    str(data.sensor_error, 20),
    num(data.sensor_fail_streak),
    bool(data.sensor_power_on),
    num(data.write_fail_count)
  ]);

  const diag = res.rows[0];
  if (ioInstance && diag) {
    ioInstance.emit('diagnostics:update', diag);
  }

  // Evaluasi rule alert berbasis diagnostik (TEMP_HIGH, dll.)
  if (diag) {
    try {
      emitAlerts(await evaluateDiagnosticsRules(deviceId, diag));
    } catch (e) {
      console.warn('[Rule Engine] error:', e.message);
    }
  }
}

module.exports = {
  initSubscriber,
  setSocketIO,
  getMqttClient: () => mqttClient,
  getSocketIO: () => ioInstance,
  runReadingRules,
};
