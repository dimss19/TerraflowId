import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { 
  Waves, 
  Activity, 
  Sliders, 
  FileText, 
  ShieldAlert, 
  Battery, 
  Thermometer, 
  Radio, 
  HardDrive, 
  RotateCcw, 
  RefreshCw, 
  AlertTriangle,
  Users
} from 'lucide-react';

import Header from './components/Header';
import WaterLevelGauge from './components/WaterLevelGauge';
import RealtimeChart from './components/RealtimeChart';
import TidalAnalysisView from './components/TidalAnalysisView';
import CalibrationView from './components/CalibrationView';
import HistoricalView from './components/HistoricalView';
import DiagnosticsView from './components/DiagnosticsView';
import LandingPageView from './components/LandingPageView';
import LoginView from './components/LoginView';
import UserManagementView from './components/UserManagementView';

export default function App() {
  // Navigation & Authentication States
  // 'landing' | 'login' | 'dashboard'
  const [viewMode, setViewMode] = useState(() => {
    const savedToken = sessionStorage.getItem('terraflow_token');
    return savedToken ? 'dashboard' : 'landing';
  });

  const [authToken, setAuthToken] = useState(() => {
    return sessionStorage.getItem('terraflow_token') || null;
  });

  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = sessionStorage.getItem('terraflow_user');
    try {
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  // Telemetry & Device States
  const [device, setDevice] = useState(null);
  const [latestReading, setLatestReading] = useState(null);
  const [realtimeReadings, setRealtimeReadings] = useState([]);
  const [tidalData, setTidalData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeAlertsCount, setActiveAlertsCount] = useState(0);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [actionMessage, setActionMessage] = useState(null);

  const showActionToast = (msg) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 4000);
  };

  // Auth Handlers
  const handleLoginSuccess = (token, user) => {
    setAuthToken(token);
    setCurrentUser(user);
    sessionStorage.setItem('terraflow_token', token);
    sessionStorage.setItem('terraflow_user', JSON.stringify(user));
    setViewMode('dashboard');
    showActionToast(`Selamat datang, ${user.fullName || user.username}! Anda telah berhasil masuk.`);
  };

  const handleLogout = () => {
    setAuthToken(null);
    setCurrentUser(null);
    sessionStorage.removeItem('terraflow_token');
    sessionStorage.removeItem('terraflow_user');
    setViewMode('landing');
  };

  // Initialize data fetching
  const refreshAllData = async () => {
    try {
      // 1. Fetch devices
      const devRes = await fetch('/api/devices');
      const devJson = await devRes.json();
      if (devJson.success && devJson.data.length > 0) {
        const currentDev = devJson.data[0];
        setDevice(currentDev);
        setActiveAlertsCount(Number(currentDev.active_alerts_count) || 0);

        // 2. Fetch latest reading
        const latestRes = await fetch(`/api/readings/${currentDev.device_id}/latest`);
        const latestJson = await latestRes.json();
        if (latestJson.success) {
          setLatestReading(latestJson.data);
        }

        // 3. Fetch past 60 readings for chart
        const histRes = await fetch(`/api/readings/${currentDev.device_id}?limit=60`);
        const histJson = await histRes.json();
        if (histJson.success) {
          setRealtimeReadings(histJson.data);
        }

        // 4. Fetch 24-hour tidal analysis
        const tidalRes = await fetch(`/api/readings/${currentDev.device_id}/tidal?hours=24`);
        const tidalJson = await tidalRes.json();
        if (tidalJson.success) {
          setTidalData(tidalJson);
        }
      }
    } catch (err) {
      console.error('[Fetch Error]', err.message);
    }
  };

  useEffect(() => {
    refreshAllData();

    // Setup Socket.IO client
    const socket = io('/', {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected to backend server');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.warn('[Socket.IO] Disconnected from backend server');
      setIsConnected(false);
    });

    // Real-time telemetry event (supports both payload.data and raw record)
    const handleNewData = (data) => {
      if (data) {
        setLatestReading(data);
        setRealtimeReadings((prev) => {
          const updated = [...prev, data];
          return updated.slice(-60);
        });
      }
    };

    socket.on('telemetry', (payload) => handleNewData(payload?.data || payload));
    socket.on('sensor:data', (data) => handleNewData(data));

    // Device alert notification event
    socket.on('device:alert', (payload) => {
      const alert = payload?.data || payload;
      if (alert) {
        showActionToast(`⚠️ Peringatan Sensor [${alert.alert_code}]: ${alert.message}`);
        setActiveAlertsCount((prev) => prev + 1);
      }
    });

    socket.on('alert:new', (alert) => {
      if (alert) {
        showActionToast(`⚠️ Peringatan Sensor [${alert.alert_code}]: ${alert.message}`);
        setActiveAlertsCount((prev) => prev + 1);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Simulator test triggers
  const triggerSimulatorAction = async (endpoint, label) => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ device_id: device?.device_id || 'AWLR-001' })
      });
      const data = await res.json();
      if (data.success) {
        showActionToast(`✅ ${label} berhasil dieksekusi!`);
        refreshAllData();
      } else {
        showActionToast(`❌ Gagal: ${data.error}`);
      }
    } catch (e) {
      showActionToast(`❌ Error: ${e.message}`);
    }
  };

  // Render Landing Page View
  if (viewMode === 'landing') {
    return (
      <LandingPageView 
        onGoToLogin={() => setViewMode('login')} 
        latestReading={latestReading}
        device={device}
      />
    );
  }

  // Render Dedicated Login View
  if (viewMode === 'login') {
    return (
      <LoginView 
        onLoginSuccess={handleLoginSuccess}
        onBackToLanding={() => setViewMode('landing')}
      />
    );
  }

  // Render AWLR Monitoring Dashboard (Authenticated View)
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      
      {/* 1. Header with corporate branding, user profile & logout */}
      <Header 
        device={device}
        isConnected={isConnected}
        activeAlertsCount={activeAlertsCount}
        onRefresh={refreshAllData}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onLogout={handleLogout}
        onGoToLanding={() => setViewMode('landing')}
      />

      {/* Main Container */}
      <main className="app-main-container">
        
        {/* Action Toast Alert Banner */}
        {actionMessage && (
          <div style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            color: '#003882',
            padding: '12px 20px',
            borderRadius: '10px',
            marginBottom: '24px',
            fontSize: '0.88rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 4px 12px rgba(0, 56, 130, 0.05)'
          }}>
            <AlertTriangle size={18} color="#003882" />
            {actionMessage}
          </div>
        )}

        {/* 2. Sub-Navigation Tabs */}
        <div className="tab-nav-bar">
          <button 
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <Waves size={16} />
            <span>Ringkasan Real-Time</span>
          </button>

          <button 
            className={`tab-btn ${activeTab === 'tidal' ? 'active' : ''}`}
            onClick={() => setActiveTab('tidal')}
          >
            <Activity size={16} />
            <span>Analisis Pasang Surut</span>
          </button>

          <button 
            className={`tab-btn ${activeTab === 'calibration' ? 'active' : ''}`}
            onClick={() => setActiveTab('calibration')}
          >
            <Sliders size={16} />
            <span>Kalibrasi Sensor</span>
          </button>

          <button 
            className={`tab-btn ${activeTab === 'historical' ? 'active' : ''}`}
            onClick={() => setActiveTab('historical')}
          >
            <FileText size={16} />
            <span>Riwayat &amp; Ekspor CSV</span>
          </button>

          <button 
            className={`tab-btn ${activeTab === 'diagnostics' ? 'active' : ''}`}
            onClick={() => setActiveTab('diagnostics')}
          >
            <ShieldAlert size={16} />
            <span>Diagnostik &amp; Alert</span>
            {activeAlertsCount > 0 && (
              <span className="badge badge-rose" style={{ marginLeft: '4px', padding: '2px 6px', fontSize: '0.68rem' }}>
                {activeAlertsCount}
              </span>
            )}
          </button>

          {/* Admin User Management Tab (RBAC Protected) */}
          {currentUser?.role === 'admin' && (
            <button 
              className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              <Users size={16} />
              <span>Kelola Pengguna</span>
              <span style={{
                marginLeft: '4px',
                padding: '1px 6px',
                borderRadius: '4px',
                fontSize: '0.62rem',
                fontWeight: 800,
                background: '#003882',
                color: '#ffffff'
              }}>
                ADMIN
              </span>
            </button>
          )}

          {/* Quick Refresh Button on Far Right of Tab Bar */}
          <div style={{ marginLeft: 'auto', paddingRight: '4px' }}>
            <button
              onClick={refreshAllData}
              title="Perbarui Data Telemetri"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                background: '#edf2fc',
                color: '#003882',
                border: 'none',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* 3. Tab Contents */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            
            {/* Top Telemetry Grid: Water Level Gauge & Real-time Chart */}
            <div className="dashboard-telemetry-grid">
              <WaterLevelGauge 
                reading={latestReading} 
                sensorHeight={device?.sensor_height_cm}
                tidalStatus={tidalData?.currentStatus}
              />
              <RealtimeChart 
                readings={realtimeReadings} 
              />
            </div>

            {/* Quick System Telemetry Metric Cards */}
            <div className="metrics-summary-grid">
              <div className="corporate-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#edf2fc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#003882' }}>
                    <Radio size={16} />
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>JARAK SENSOR (RAW)</span>
                </div>
                <div className="mono-text" style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginTop: '10px' }}>
                  {latestReading?.raw_distance_cm ? (Number(latestReading.raw_distance_cm) / 100).toFixed(2) : '3.74'} <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#003882' }}>m</span>
                  <span style={{ fontSize: '0.76rem', color: '#94a3b8', fontWeight: 500, marginLeft: '6px' }}>({latestReading?.raw_distance_cm ? Number(latestReading.raw_distance_cm).toFixed(1) : '373.8'} cm)</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>A16 Modbus (Jangkauan Maks 15 m)</div>
              </div>

              <div className="corporate-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#edf2fc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#003882' }}>
                    <Thermometer size={16} />
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>TEMPERATUR UDARA</span>
                </div>
                <div className="mono-text" style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginTop: '10px' }}>
                  {latestReading?.temperature_c ? Number(latestReading.temperature_c).toFixed(1) : '28.5'} <span style={{ fontSize: '0.8rem', color: '#64748b' }}>&deg;C</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#003882', fontWeight: 600, marginTop: '2px' }}>Kompensasi Kecepatan Suara</div>
              </div>

              <div className="corporate-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#edf2fc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#003882' }}>
                    <Battery size={16} />
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>TEGANGAN AKI</span>
                </div>
                <div className="mono-text" style={{ fontSize: '1.3rem', fontWeight: 800, color: '#059669', marginTop: '10px' }}>
                  {latestReading?.battery_voltage ? Number(latestReading.battery_voltage).toFixed(2) : '12.45'} <span style={{ fontSize: '0.8rem', color: '#64748b' }}>V</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>Daya Solar Panel Normal</div>
              </div>

              <div className="corporate-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#edf2fc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#003882' }}>
                    <HardDrive size={16} />
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>STATUS MICROSD</span>
                </div>
                <div className="mono-text" style={{ fontSize: '1.3rem', fontWeight: 800, color: '#003882', marginTop: '10px' }}>
                  READY
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>Pencatatan Offline Aktif</div>
              </div>
            </div>

          </div>
        )}

        {activeTab === 'tidal' && (
          <TidalAnalysisView 
            tidalData={tidalData} 
            onTimeframeChange={refreshAllData} 
          />
        )}

        {activeTab === 'calibration' && (
          <CalibrationView 
            device={device} 
            latestReading={latestReading} 
            onCalibrationUpdated={refreshAllData} 
          />
        )}

        {activeTab === 'historical' && (
          <HistoricalView 
            device={device} 
            onDataExported={() => showActionToast('File CSV data telemetri berhasil diunduh.')}
          />
        )}

        {activeTab === 'diagnostics' && (
          <DiagnosticsView 
            device={device} 
            activeAlertsCount={activeAlertsCount}
            onActionTriggered={triggerSimulatorAction}
          />
        )}

        {activeTab === 'users' && (
          <UserManagementView 
            authToken={authToken}
            currentUser={currentUser}
            onActionToast={showActionToast}
          />
        )}

      </main>

      {/* 4. Partner Accreditation Bar */}
      <section style={{
        padding: '36px 40px',
        borderTop: '1px solid #eef2f7',
        borderBottom: '1px solid #eef2f7',
        background: '#ffffff',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '0.75rem',
          fontWeight: 800,
          color: '#64748b',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          marginBottom: '20px'
        }}>
          MITRA &amp; AKREDITASI INDUSTRI
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '48px',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#475569', letterSpacing: '0.04em' }}>ASRI</span>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#475569', letterSpacing: '0.04em' }}>ISO 9001</span>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#475569', letterSpacing: '0.04em' }}>ISI</span>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#475569', letterSpacing: '0.04em' }}>BIG</span>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#475569', letterSpacing: '0.04em' }}>KADIN</span>
        </div>
      </section>

      {/* 5. Minimal Clean Footer */}
      <footer style={{
        background: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        padding: '24px 40px',
        marginTop: 'auto'
      }}>
        <div style={{
          maxWidth: '1440px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          fontSize: '0.82rem',
          color: '#64748b'
        }}>
          <div>
            &copy; 2024 <strong>PT Tanah Airku Teknologi</strong> &bull; TerraFlow Industrial AWLR System
          </div>
          <div style={{ display: 'flex', gap: '20px', fontWeight: 600 }}>
            <span>Precision in Every Pixel</span>
            <span>RS485 Modbus A16</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
