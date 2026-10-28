const { getMqttClient } = require('./subscriber');

/**
 * Publish calibration configuration to device
 * @param {string} deviceId 
 * @param {object} params { sensor_height_cm, offset_cm, slope }
 */
function publishCalibration(deviceId, params) {
  const client = getMqttClient();
  if (!client || !client.connected) {
    throw new Error('MQTT client is not connected to broker');
  }

  const topic = `terraflow/${deviceId}/calibration/set`;
  const payload = JSON.stringify({
    cmd: 'set_calibration',
    sensor_height_cm: Number(params.sensor_height_cm),
    offset_cm: Number(params.offset_cm),
    slope: Number(params.slope),
    timestamp: Math.floor(Date.now() / 1000)
  });

  return new Promise((resolve, reject) => {
    client.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) return reject(err);
      console.log(`[MQTT Publisher] Pushed calibration to ${topic}:`, payload);
      resolve({ success: true, topic, payload });
    });
  });
}

/**
 * Publish remote command to device
 * @param {string} deviceId 
 * @param {string} command ('restart', 'sync_request')
 */
function publishCommand(deviceId, command) {
  const client = getMqttClient();
  if (!client || !client.connected) {
    throw new Error('MQTT client is not connected to broker');
  }

  const topic = `terraflow/${deviceId}/command/${command}`;
  const payload = JSON.stringify({
    command,
    timestamp: Math.floor(Date.now() / 1000)
  });

  return new Promise((resolve, reject) => {
    client.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) return reject(err);
      console.log(`[MQTT Publisher] Sent command ${command} to ${topic}`);
      resolve({ success: true, command });
    });
  });
}

/**
 * Publish sampling interval configuration to device via retained MQTT message
 * @param {string} deviceId 
 * @param {number} intervalSec (e.g. 60, 900, 1800, 3600, 7200)
 */
function publishSamplingInterval(deviceId, intervalSec) {
  const client = getMqttClient();
  if (!client || !client.connected) {
    throw new Error('MQTT client is not connected to broker');
  }

  const cleanInterval = Math.max(15, Math.min(86400, parseInt(intervalSec, 10) || 900));
  const topic = `terraflow/${deviceId}/config/interval`;
  const payload = JSON.stringify({
    cmd: 'set_interval',
    sampling_interval_sec: cleanInterval,
    interval_min: Math.round(cleanInterval / 60),
    timestamp: Math.floor(Date.now() / 1000)
  });

  return new Promise((resolve, reject) => {
    // Retain = true sangat krusial: broker menyimpan pesan ini agar ESP32 yang bangun dari Deep Sleep langsung menerimanya
    client.publish(topic, payload, { qos: 1, retain: true }, (err) => {
      if (err) return reject(err);
      console.log(`[MQTT Publisher] Pushed retained interval config (${cleanInterval}s) to ${topic}`);
      resolve({ success: true, topic, payload, intervalSec: cleanInterval });
    });
  });
}

/**
 * Publish test mode command to device (streaming telemetry every 1s)
 * @param {string} deviceId 
 * @param {boolean} enabled 
 * @param {number} durationSec (default 300 = 5 minutes)
 */
function publishTestMode(deviceId, enabled, durationSec = 300) {
  const client = getMqttClient();
  if (!client || !client.connected) {
    throw new Error('MQTT client is not connected to broker');
  }

  const topic = `terraflow/${deviceId}/command/test_mode`;
  const payload = JSON.stringify({
    cmd: 'test_mode',
    test_mode: Boolean(enabled),
    enabled: Boolean(enabled),
    duration_sec: Number(durationSec) || 300,
    timestamp: Math.floor(Date.now() / 1000)
  });

  return new Promise((resolve, reject) => {
    client.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) return reject(err);
      console.log(`[MQTT Publisher] Pushed test mode (${enabled ? 'ON' : 'OFF'}) to ${topic}`);
      resolve({ success: true, topic, enabled, durationSec });
    });
  });
}

module.exports = {
  publishCalibration,
  publishCommand,
  publishSamplingInterval,
  publishTestMode,
};
