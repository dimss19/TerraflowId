const aedes = require('aedes');
const net = require('net');
const config = require('../config');

let brokerInstance = null;
let tcpServer = null;

function startBroker() {
  if (!config.mqtt.embedded) {
    console.log('[MQTT Broker] Using external broker at:', config.mqtt.url);
    return null;
  }

  // Autentikasi username/password (aktif bila MQTT_USER & MQTT_PASS diisi).
  // Broker Aedes tanpa autentikasi berarti siapa pun yang bisa mencapai port
  // broker dapat publish/subscribe seluruh topic.
  const authRequired = Boolean(config.mqtt.user && config.mqtt.password);

  brokerInstance = aedes({
    id: 'TERRAFLOW_AEDES_BROKER',
    authenticate: (client, username, password, cb) => {
      if (!authRequired) {
        return cb(null, true);
      }
      const u = username ? username.toString() : '';
      const p = password ? password.toString() : '';
      if (u === config.mqtt.user && p === config.mqtt.password) {
        return cb(null, true);
      }
      const err = new Error('Authentication failed: invalid username or password');
      err.returnCode = 4; // CONNACK: Bad User Name or Password
      console.warn(`[MQTT Broker] Auth rejected for client ${client.id || 'unknown'} (user: ${u || '-'})`);
      cb(err, false);
    },
  });

  if (authRequired) {
    console.log('[MQTT Broker] Authentication ENABLED (username/password required)');
  } else {
    console.warn('[MQTT Broker] Authentication DISABLED - broker terbuka untuk publik!');
  }

  tcpServer = net.createServer(brokerInstance.handle);

  tcpServer.listen(config.mqtt.port, config.mqtt.host, () => {
    console.log(`[MQTT Broker] Embedded Aedes broker listening on ${config.mqtt.host}:${config.mqtt.port}`);
  });

  brokerInstance.on('client', (client) => {
    console.log(`[MQTT Broker] Client connected: ${client ? client.id : 'unknown'}`);
  });

  brokerInstance.on('clientDisconnect', (client) => {
    console.log(`[MQTT Broker] Client disconnected: ${client ? client.id : 'unknown'}`);
  });

  brokerInstance.on('subscribe', (subscriptions, client) => {
    console.log(`[MQTT Broker] Client ${client ? client.id : 'unknown'} subscribed to:`, 
      subscriptions.map(s => s.topic).join(', '));
  });

  tcpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[MQTT Broker] Port ${config.mqtt.port} is already in use. Assuming external broker is active.`);
    } else {
      console.error('[MQTT Broker Error]', err.message);
    }
  });

  return { aedes: brokerInstance, server: tcpServer };
}

module.exports = {
  startBroker,
};
