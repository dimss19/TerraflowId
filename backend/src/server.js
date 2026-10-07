const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');

const config = require('./config');
const { testConnection } = require('./db/connection');
const { startBroker } = require('./mqtt/broker');
const { initSubscriber, setSocketIO } = require('./mqtt/subscriber');
const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);

// 1. Security Headers & CORS
app.use(helmet({
  contentSecurityPolicy: false, // SPA handles its own client CSP or served separately in Vite
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: [config.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// 2. Health & Root Info Endpoint
app.get('/health', async (req, res) => {
  const dbStatus = await testConnection();
  res.json({
    status: 'ok',
    system: config.company.systemName,
    company: config.company.name,
    version: config.company.version,
    database: dbStatus.ok ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// 3. Mount API Routes
app.use('/api', apiRoutes);

// 4. Setup Socket.IO for Real-time Streaming
const io = new Server(server, {
  cors: {
    origin: [config.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Frontend client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Frontend client disconnected: ${socket.id}`);
  });
});

setSocketIO(io);

// 5. Bootstrap Services
async function bootstrap() {
  console.log('==================================================');
  console.log(`🌊 ${config.company.systemName}`);
  console.log(`🏢 ${config.company.name}`);
  console.log('==================================================');

  // Verify PostgreSQL
  const dbHealth = await testConnection();
  if (!dbHealth.ok) {
    console.error('[FATAL] Cannot connect to PostgreSQL database. Exiting.');
    process.exit(1);
  }

  // Start Embedded MQTT Broker
  startBroker();

  // Initialize MQTT Subscriber
  initSubscriber();

  // Start HTTP & WebSocket Server
  server.listen(config.port, config.host, () => {
    console.log(`[HTTP Server] REST API & Socket.IO running on http://${config.host}:${config.port}`);
    console.log(`[MQTT Broker] Ready on ${config.host}:${config.mqtt.port}`);
    console.log('==================================================');
  });
}

bootstrap().catch((err) => {
  console.error('[Bootstrap Error]', err);
});

module.exports = { app, server };
