const mqtt = require('mqtt');
const config = require('../config');
const { query } = require('../db/connection');

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
    
    // Subscribe to all device topics (supporting both direct and devices namespace patterns)
    const topics = [
      'terraflow/+/data',
      'terraflow/+/data/bulk',
      'terraflow/+/alert',
      'terraflow/+/diagnostics',
      'terraflow/+/status',
      'terraflow/+/calibration/response',
      'terraflow/devices/+/telemetry',
      'terraflow/devices/+/data',
      'terraflow/devices/+/data/bulk',
      'terraflow/devices/+/alert',
      'terraflow/devices/+/diagnostics',
      'terraflow/devices/+/status',
      'terraflow/devices/+/calibration/response'
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

      let deviceId;
      let subtopic;
      if (parts[1] === 'devices' && parts.length >= 4) {
        deviceId = parts[2];
        subtopic = parts.slice(3).join('/');
      } else {
        deviceId = parts[1];
        subtopic = parts.slice(2).join('/');
      }

      if (subtopic === 'telemetry') {
        subtopic = 'data';
      }

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
    if (isOnline) {
      await query(
        'UPDATE devices SET last_seen = NOW() WHERE device_id = $1',
        [deviceId]
      ).catch(() => {});
    } else {
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
  }
}

async function handleSingleReading(deviceId, data) {
  let ts = data.timestamp ? new Date(typeof data.timestamp === 'number' && data.timestamp < 1e11 ? data.timestamp * 1000 : data.timestamp) : new Date();
  if (ts.getTime() > Date.now() + 600000) {
    const corrected = new Date(ts.getTime() - 7 * 3600 * 1000);
    if (corrected.getTime() <= Date.now() + 60000) {
      ts = corrected;
    }
  }
  
  // Align timestamp to the exact minute (:00 seconds) to ensure exactly 1 record per minute
  ts = new Date(Math.floor(ts.getTime() / 60000) * 60000);
  
  // Aturan perhitungan muka air server-side dari data mentah sensor
  let waterLevel = data.water_level_cm != null ? Number(data.water_level_cm) : null;
  const rawDist = data.raw_distance_cm != null ? Number(data.raw_distance_cm) : null;

  if (rawDist != null) {
    try {
      const calibRes = await query(
        `SELECT sensor_height_cm, offset_cm, slope 
         FROM calibrations 
         WHERE device_id = $1 AND is_active = true 
         ORDER BY applied_at DESC LIMIT 1`,
        [deviceId]
      );
      if (calibRes.rows.length > 0) {
        const h = parseFloat(calibRes.rows[0].sensor_height_cm) || 600.0;
        const off = parseFloat(calibRes.rows[0].offset_cm) || 0.0;
        const slp = parseFloat(calibRes.rows[0].slope) || 1.0;
        waterLevel = +(h - (rawDist * slp + off)).toFixed(2);
      }
    } catch (e) {
      console.warn('[Calibration Rule Warning]', e.message);
    }
  }

  const insertSql = `
    INSERT INTO readings (
      device_id, timestamp, raw_distance_cm, water_level_cm,
      temperature_c, battery_voltage, battery_percent,
      signal_quality, sd_status, reading_count, source
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (device_id, timestamp) DO UPDATE SET
      water_level_cm = EXCLUDED.water_level_cm,
      raw_distance_cm = EXCLUDED.raw_distance_cm,
      temperature_c = EXCLUDED.temperature_c,
      battery_voltage = EXCLUDED.battery_voltage,
      battery_percent = EXCLUDED.battery_percent,
      signal_quality = EXCLUDED.signal_quality,
      source = EXCLUDED.source
    RETURNING *
  `;

  const values = [
    deviceId,
    ts,
    rawDist,
    waterLevel,
    data.temperature_c != null ? Number(data.temperature_c) : null,
    data.battery_voltage != null ? Number(data.battery_voltage) : null,
    data.battery_percent != null ? Number(data.battery_percent) : null,
    data.signal_quality != null ? Number(data.signal_quality) : null,
    data.sd_status || 'ok',
    data.reading_count != null ? Number(data.reading_count) : null,
    data.source || 'live'
  ];

  const res = await query(insertSql, values);
  const savedRow = res.rows[0];
  console.log(`[MQTT Telemetry] Device: ${deviceId} | Raw: ${rawDist} cm | Level: ${waterLevel} cm | Temp: ${data.temperature_c}°C`);

  // Broadcast to Web Dashboard via WebSocket (dual event emission for backwards & forward compatibility)
  if (ioInstance && savedRow) {
    ioInstance.emit('sensor:data', savedRow);
    ioInstance.emit('telemetry', { device_id: deviceId, data: savedRow });
  }
}

async function handleBulkReadings(deviceId, payload) {
  const records = payload.records || [];
  let savedCount = 0;

  for (const item of records) {
    let ts = item.timestamp ? new Date(typeof item.timestamp === 'number' && item.timestamp < 1e11 ? item.timestamp * 1000 : item.timestamp) : new Date();
    // Guard: Jika timestamp berada di masa depan (> 10 menit), kemungkinan data offline RTC tersimpan dalam jam lokal (WIB) tanpa konversi UTC
    if (ts.getTime() > Date.now() + 600000) {
      const corrected = new Date(ts.getTime() - 7 * 3600 * 1000);
      if (corrected.getTime() <= Date.now() + 60000) {
        ts = corrected;
      }
    }
    
    // Align timestamp to the exact minute (:00 seconds)
    ts = new Date(Math.floor(ts.getTime() / 60000) * 60000);
    
    const insertSql = `
      INSERT INTO readings (
        device_id, timestamp, raw_distance_cm, water_level_cm,
        temperature_c, battery_voltage, battery_percent,
        signal_quality, sd_status, reading_count, source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'sd_buffer')
      ON CONFLICT (device_id, timestamp) DO NOTHING
    `;

    try {
      await query(insertSql, [
        deviceId,
        ts,
        item.raw_distance_cm != null ? Number(item.raw_distance_cm) : null,
        item.water_level_cm != null ? Number(item.water_level_cm) : null,
        item.temperature_c != null ? Number(item.temperature_c) : null,
        item.battery_voltage != null ? Number(item.battery_voltage) : null,
        item.battery_percent != null ? Number(item.battery_percent) : null,
        item.signal_quality != null ? Number(item.signal_quality) : null,
        'ok',
        item.reading_count != null ? Number(item.reading_count) : null
      ]);
      savedCount++;
    } catch (e) {
      console.warn('[Bulk Insert Warning]', e.message);
    }
  }

  // Publish ACK to device
  const ackTopic = `terraflow/${deviceId}/data/bulk/ack`;
  const ackPayload = JSON.stringify({
    device_id: deviceId,
    batch_id: payload.batch_id || 'unknown',
    chunk: payload.chunk || 1,
    status: 'ok',
    records_saved: savedCount,
    timestamp: Math.floor(Date.now() / 1000)
  });

  if (mqttClient && mqttClient.connected) {
    mqttClient.publish(ackTopic, ackPayload);
    console.log(`[MQTT Bulk ACK] Sent ACK for chunk ${payload.chunk} (${savedCount} saved) to ${ackTopic}`);
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
  const ts = data.timestamp ? new Date(typeof data.timestamp === 'number' && data.timestamp < 1e11 ? data.timestamp * 1000 : data.timestamp) : new Date();
  
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
  const ts = data.timestamp ? new Date(typeof data.timestamp === 'number' && data.timestamp < 1e11 ? data.timestamp * 1000 : data.timestamp) : new Date();
  
  const insertSql = `
    INSERT INTO device_diagnostics (
      device_id, timestamp, boot_reason, uptime_sec, boot_count,
      watchdog_count, brownout_count, panic_count, free_heap_bytes,
      wifi_rssi, sd_card_ok, sensor_ok, battery_voltage, esp_temp_c,
      pending_unsent, firmware_version
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING *
  `;

  const res = await query(insertSql, [
    deviceId,
    ts,
    data.boot_reason || 'NORMAL',
    data.uptime_sec || 0,
    data.boot_count || 1,
    data.watchdog_count || 0,
    data.brownout_count || 0,
    data.panic_count || 0,
    data.free_heap_bytes || 0,
    data.wifi_rssi || -70,
    data.sd_card_ok !== false,
    data.sensor_ok !== false,
    data.battery_voltage || null,
    data.esp_temp_c || null,
    data.pending_unsent || 0,
    data.firmware_version || '1.0.0'
  ]);

  const diag = res.rows[0];
  if (ioInstance && diag) {
    ioInstance.emit('diagnostics:update', diag);
  }
}

module.exports = {
  initSubscriber,
  setSocketIO,
  getMqttClient: () => mqttClient,
  getSocketIO: () => ioInstance,
};
