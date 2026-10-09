const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const secretPath = path.resolve(__dirname, '../../.jwt_secret');
  if (fs.existsSync(secretPath)) {
    return fs.readFileSync(secretPath, 'utf8').trim();
  }
  const ephemeral = crypto.randomBytes(32).toString('hex');
  try {
    fs.writeFileSync(secretPath, ephemeral, 'utf8');
  } catch (e) {
    // fallback in-memory
  }
  return ephemeral;
}

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  host: process.env.HOST || '127.0.0.1',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret: getJwtSecret(),
  
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '123',
    database: process.env.DB_NAME || 'teraflowid',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },
  
  mqtt: {
    port: parseInt(process.env.MQTT_PORT, 10) || 1883,
    host: process.env.MQTT_HOST || '0.0.0.0',
    embedded: process.env.EMBEDDED_MQTT !== 'false',
    url: process.env.MQTT_URL || 'mqtt://127.0.0.1:1883',
  },
  
  company: {
    name: 'PT Tanah Airku Teknologi',
    systemName: 'TerraFlow AWLR Monitoring System',
    version: '1.0.0',
  }
};
