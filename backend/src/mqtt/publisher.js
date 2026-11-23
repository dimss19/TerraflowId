const { getMqttClient } = require('./subscriber');

const nowSec = () => Math.floor(Date.now() / 1000);

/**
 * Helper publish tunggal: cek koneksi, kirim JSON, log, dan resolve dengan
 * `result` (ditambah topic & payload).
 * @param {string} topic
 * @param {object} body  objek yang akan di-JSON-kan
 * @param {object} opts  opsi MQTT (default qos 1)
 * @param {string} logMsg
 * @param {object} result field tambahan pada nilai resolve
 */
function publishJson(topic, body, opts, logMsg, result = {}) {
  const client = getMqttClient();
  if (!client || !client.connected) {
    return Promise.reject(new Error('MQTT client is not connected to broker'));
  }

  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    client.publish(topic, payload, { qos: 1, ...opts }, (err) => {
      if (err) return reject(err);
      console.log(`[MQTT Publisher] ${logMsg} -> ${topic}`);
      resolve({ success: true, topic, payload, ...result });
    });
  });
}

/**
 * Kirim konfigurasi kalibrasi ke perangkat.
 * Saat ini TIDAK dipakai: kalibrasi dihitung di server (lihat api.js POST
 * /calibration). Dipertahankan karena firmware masih menangani
 * `calibration/set` dan membalas `calibration/response`.
 * @param {object} params { sensor_height_cm, offset_cm, slope }
 */
function publishCalibration(deviceId, params) {
  return publishJson(`terraflow/${deviceId}/calibration/set`, {
    cmd: 'set_calibration',
    sensor_height_cm: Number(params.sensor_height_cm),
    offset_cm: Number(params.offset_cm),
    slope: Number(params.slope),
    timestamp: nowSec()
  }, {}, 'Pushed calibration');
}

/**
 * Perintah umum ke perangkat.
 * @param {string} command ('restart', 'sync_request')
 */
function publishCommand(deviceId, command) {
  return publishJson(`terraflow/${deviceId}/command/${command}`, {
    command,
    timestamp: nowSec()
  }, {}, `Sent command ${command}`, { command });
}

/**
 * Interval sampling via pesan retained.
 * @param {number} intervalSec (e.g. 60, 900, 1800, 3600, 7200)
 */
function publishSamplingInterval(deviceId, intervalSec) {
  const cleanInterval = Math.max(15, Math.min(86400, parseInt(intervalSec, 10) || 900));
  // Retain = true sangat krusial: broker menyimpan pesan ini agar ESP32 yang
  // bangun dari Deep Sleep langsung menerimanya.
  return publishJson(`terraflow/${deviceId}/config/interval`, {
    cmd: 'set_interval',
    sampling_interval_sec: cleanInterval,
    interval_min: Math.round(cleanInterval / 60),
    timestamp: nowSec()
  }, { retain: true }, `Pushed retained interval config (${cleanInterval}s)`, { intervalSec: cleanInterval });
}

/**
 * Mode uji (streaming telemetri tiap 1 detik).
 * @param {boolean} enabled
 * @param {number} durationSec (default 300 = 5 menit)
 */
function publishTestMode(deviceId, enabled, durationSec = 300) {
  return publishJson(`terraflow/${deviceId}/command/test_mode`, {
    cmd: 'test_mode',
    test_mode: Boolean(enabled),
    enabled: Boolean(enabled),
    duration_sec: Number(durationSec) || 300,
    timestamp: nowSec()
  }, {}, `Pushed test mode (${enabled ? 'ON' : 'OFF'})`, { enabled, durationSec });
}

/**
 * Daya sensor (high-side switch GPIO 9).
 * @param {boolean} powerOn
 */
function publishSensorPower(deviceId, powerOn) {
  return publishJson(`terraflow/${deviceId}/command/sensor_power`, {
    power: Boolean(powerOn),
    state: powerOn ? 1 : 0,
    timestamp: nowSec()
  }, {}, `Pushed sensor power (${powerOn ? 'ON' : 'OFF'})`, { power: powerOn });
}

/** Perintah deep sleep. */
function publishSleepCommand(deviceId) {
  return publishJson(`terraflow/${deviceId}/command/sleep`, {
    cmd: 'sleep',
    timestamp: nowSec()
  }, {}, 'Sent deep sleep command');
}

module.exports = {
  publishCalibration,
  publishCommand,
  publishSamplingInterval,
  publishTestMode,
  publishSensorPower,
  publishSleepCommand
};
