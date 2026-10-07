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

  brokerInstance = aedes({
    id: 'TERRAFLOW_AEDES_BROKER',
  });

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
