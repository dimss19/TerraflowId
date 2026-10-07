/**
 * AWLR Hardware & Field Simulator
 * Simulates ESP32-S3 Industrial + A16 Ultrasonic Sensor + SD Card Buffering
 * PT Tanah Airku Teknologi — TerraFlow
 */

const mqtt = require('mqtt');
const config = require('../config');

const DEVICE_ID = 'AWLR-001';
const SENSOR_HEIGHT = 600.0;
let calibration = {
  sensor_height_cm: 600.0,
  offset_cm: 0.0,
  slope: 1.000000
};

// Simulation state
let isConnected = false;
let readingCounter = 1500;
let watchdogCount = 0;
let bootCount = 1;
let batteryVoltage = 12.45;
let pendingSdBuffer = [];

const client = mqtt.connect(config.mqtt.url, {
  clientId: `ESP32S3_${DEVICE_ID}_SIMULATOR`,
  clean: true,
  reconnectPeriod: 2000,
  will: {
    topic: `terraflow/${DEVICE_ID}/status`,
    payload: JSON.stringify({ device_id: DEVICE_ID, status: 'offline', reason: 'unexpected_disconnect' }),
    qos: 1,
    retain: false
  }
});

client.on('connect', () => {
  isConnected = true;
  console.log(`[AWLR Simulator] ESP32-S3 connected to MQTT broker for ${DEVICE_ID}`);

  // Send status online
  client.publish(`terraflow/${DEVICE_ID}/status`, JSON.stringify({
    device_id: DEVICE_ID,
    status: 'online',
    timestamp: Math.floor(Date.now() / 1000)
  }));

  // Subscribe to command and calibration topics
  client.subscribe([
    `terraflow/${DEVICE_ID}/calibration/set`,
    `terraflow/${DEVICE_ID}/command/#`,
    `terraflow/${DEVICE_ID}/data/bulk/ack`
  ]);

  // Send initial boot diagnostics
  sendDiagnostics('POWERON_RESET');
});

client.on('message', async (topic, payload) => {
  try {
    const data = JSON.parse(payload.toString());
    console.log(`[AWLR Simulator Received] ${topic}:`, data);

    if (topic === `terraflow/${DEVICE_ID}/calibration/set`) {
      handleCalibrationSet(data);
    } else if (topic === `terraflow/${DEVICE_ID}/command/restart`) {
      handleRemoteRestart();
    } else if (topic === `terraflow/${DEVICE_ID}/command/sync_request`) {
      handleManualSync();
    } else if (topic === `terraflow/${DEVICE_ID}/data/bulk/ack`) {
      handleBulkAck(data);
    }
  } catch (err) {
    console.error('[AWLR Simulator Error Parsing]', err.message);
  }
});

function handleCalibrationSet(data) {
  calibration.sensor_height_cm = Number(data.sensor_height_cm) || calibration.sensor_height_cm;
  calibration.offset_cm = Number(data.offset_cm) || 0;
  calibration.slope = Number(data.slope) || 1.0;

  console.log(`[AWLR Simulator] ESP32-S3 updated NVS calibration:`, calibration);

  // Send confirmation back
  client.publish(`terraflow/${DEVICE_ID}/calibration/response`, JSON.stringify({
    device_id: DEVICE_ID,
    status: 'applied',
    active_calibration: calibration,
    timestamp: Math.floor(Date.now() / 1000)
  }));
}

function handleRemoteRestart() {
  console.warn('[AWLR Simulator] Executing remote soft-restart...');
  bootCount++;
  sendDiagnostics('SW_CPU_RESET');
}

function handleManualSync() {
  console.log('[AWLR Simulator] Triggered manual bulk sync from SD Card...');
  executeBulkSync();
}

let activeAckResolver = null;
function handleBulkAck(data) {
  console.log(`[AWLR Simulator] Received Server ACK for batch ${data.batch_id} chunk ${data.chunk}`);
  if (activeAckResolver) {
    activeAckResolver(data);
    activeAckResolver = null;
  }
}

// Generate tidal wave reading
function generateReading(timeMs = Date.now(), isOffline = false) {
  readingCounter++;
  const tidalPeriodMs = 12.42 * 3600 * 1000;
  const phase = (2 * Math.PI * timeMs) / tidalPeriodMs;
  const phaseS2 = (2 * Math.PI * timeMs) / (12.0 * 3600 * 1000);
  const ripple = (Math.sin(readingCounter * 0.2) * 0.7);

  const baseMsl = 220.0;
  const amplitude = 110.0;
  const waterLevel = +(baseMsl + (amplitude * Math.sin(phase)) + (20.0 * Math.sin(phaseS2)) + ripple).toFixed(2);
  const rawDistance = +(calibration.sensor_height_cm - (waterLevel * calibration.slope + calibration.offset_cm)).toFixed(2);
  
  // Slight battery discharge
  batteryVoltage = Math.max(10.8, +(batteryVoltage - 0.0001).toFixed(3));
  const batteryPercent = Math.min(100, Math.max(0, Math.round(((batteryVoltage - 10.5) / 2.3) * 100)));

  return {
    device_id: DEVICE_ID,
    timestamp: Math.floor(timeMs / 1000),
    raw_distance_cm: rawDistance,
    water_level_cm: waterLevel,
    temperature_c: +(28.5 + Math.sin(readingCounter / 50) * 1.2).toFixed(2),
    battery_voltage: +batteryVoltage.toFixed(2),
    battery_percent: batteryPercent,
    signal_quality: -64 - Math.round(Math.random() * 8),
    sd_status: 'ok',
    reading_count: readingCounter,
    source: isOffline ? 'sd_buffer' : 'live'
  };
}

// Regular 10-second tick in simulator for vibrant dashboard demonstration
function tickReading() {
  if (!isConnected) return;
  const reading = generateReading();
  const topic = `terraflow/${DEVICE_ID}/data`;
  client.publish(topic, JSON.stringify(reading));
  console.log(`[AWLR Telemetry] Level: ${reading.water_level_cm} cm | Dist: ${reading.raw_distance_cm} cm | Batt: ${reading.battery_voltage}V`);
}

function sendDiagnostics(bootReason = 'NORMAL') {
  if (!isConnected) return;
  const diag = {
    device_id: DEVICE_ID,
    timestamp: Math.floor(Date.now() / 1000),
    boot_reason: bootReason,
    uptime_sec: 14200,
    boot_count: bootCount,
    watchdog_count: watchdogCount,
    brownout_count: 0,
    panic_count: 0,
    free_heap_bytes: 154200,
    wifi_rssi: -65,
    sd_card_ok: true,
    sensor_ok: true,
    battery_voltage: +batteryVoltage.toFixed(2),
    esp_temp_c: 41.5,
    pending_unsent: pendingSdBuffer.length,
    firmware_version: '1.2.0'
  };
  client.publish(`terraflow/${DEVICE_ID}/diagnostics`, JSON.stringify(diag));
}

// Bulk Sync execution
async function executeBulkSync() {
  if (pendingSdBuffer.length === 0) {
    // Generate synthetic offline buffered records if buffer empty
    console.log('[AWLR Simulator] Generating 30 buffered offline records for demonstration...');
    const now = Date.now();
    for (let i = 30; i > 0; i--) {
      pendingSdBuffer.push(generateReading(now - (i * 60 * 1000), true));
    }
  }

  const chunkSize = 10;
  const totalChunks = Math.ceil(pendingSdBuffer.length / chunkSize);
  const batchId = `BATCH_${Date.now()}`;

  console.log(`[AWLR Simulator] Starting SD Card Bulk Sync: ${pendingSdBuffer.length} records in ${totalChunks} chunks`);

  for (let c = 0; c < totalChunks; c++) {
    const chunkRecords = pendingSdBuffer.slice(c * chunkSize, (c + 1) * chunkSize);
    const chunkPayload = {
      device_id: DEVICE_ID,
      batch_id: batchId,
      chunk: c + 1,
      total_chunks: totalChunks,
      source: 'sd_buffer',
      file_date: new Date().toISOString().slice(0, 10),
      records: chunkRecords
    };

    client.publish(`terraflow/${DEVICE_ID}/data/bulk`, JSON.stringify(chunkPayload));
    console.log(`[AWLR Simulator] Published chunk ${c + 1}/${totalChunks} (${chunkRecords.length} records)`);

    // Await ACK or timeout
    await new Promise((resolve) => {
      activeAckResolver = resolve;
      setTimeout(() => {
        if (activeAckResolver) {
          console.warn(`[AWLR Simulator] Chunk ${c + 1} ACK timed out, continuing...`);
          activeAckResolver = null;
          resolve();
        }
      }, 5000);
    });

    // Throttling 200ms
    await new Promise(r => setTimeout(r, 200));
  }

  pendingSdBuffer = [];
  console.log('[AWLR Simulator] Bulk Sync completed! SD Card marked all records as sent.');
}

// Injected Events for Testing
function injectWatchdogReset() {
  console.warn('[AWLR Simulator INJECTION] Simulating Task Watchdog Reset!');
  watchdogCount++;
  bootCount++;

  client.publish(`terraflow/${DEVICE_ID}/alert`, JSON.stringify({
    device_id: DEVICE_ID,
    timestamp: Math.floor(Date.now() / 1000),
    alert_code: 'WDT_RESET',
    severity: 'CRITICAL',
    message: 'Watchdog reset detected. Task sensorRead stalled beyond 30s timeout.',
    details: {
      watchdog_count: watchdogCount,
      boot_count: bootCount,
      last_free_heap: 18240
    }
  }));

  sendDiagnostics('TG0WDT_SYS_RESET');
}

function injectSensorFail() {
  console.warn('[AWLR Simulator INJECTION] Simulating Sensor A16 Communication Failure!');
  client.publish(`terraflow/${DEVICE_ID}/alert`, JSON.stringify({
    device_id: DEVICE_ID,
    timestamp: Math.floor(Date.now() / 1000),
    alert_code: 'SENSOR_FAIL',
    severity: 'CRITICAL',
    message: 'A16 Ultrasonic Sensor not responding after 5 consecutive RS485 queries.',
    details: { consecutive_fails: 5, rs485_status: 'TIMEOUT' }
  }));
}

// Timer for live continuous telemetry (every 10 seconds for snappy UI demo)
const tickInterval = setInterval(tickReading, 10000);

module.exports = {
  executeBulkSync,
  injectWatchdogReset,
  injectSensorFail,
};
