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

module.exports = {
  publishCalibration,
  publishCommand,
};
