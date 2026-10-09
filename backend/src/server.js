const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const config = require('./config');
const { testConnection } = require('./db/connection');
const { startBroker } = require('./mqtt/broker');
const { initSubscriber, setSocketIO } = require('./mqtt/subscriber');
const apiRoutes = require('./routes/api');
const { router: authRoutes } = require('./routes/auth');
const userRoutes = require('./routes/users');
const deviceRoutes = require('./routes/devices');

const app = express();
const server = http.createServer(app);

// 1. Security Headers & CORS
app.use(helmet({
  contentSecurityPolicy: false, // SPA handles its own client CSP or served separately in Vite
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: [config.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
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
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api', apiRoutes);

// 3b. Serve Built Frontend SPA (dist) if available
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

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
  console.log(`${config.company.systemName}`);
  console.log(`${config.company.name}`);
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

  // Auto-start AWLR Simulator in development for continuous live telemetry demonstration
  if (process.env.NODE_ENV !== 'production' && process.env.DISABLE_SIMULATOR !== 'true') {
    setTimeout(() => {
      try {
        require('./simulator/awlr_simulator');
        console.log('[AWLR Simulator] Auto-started background telemetry simulator.');
      } catch (simErr) {
        console.error('[AWLR Simulator Auto-start Failed]', simErr.message);
      }
    }, 1500);
  }

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
