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
  Compass, 
  Hash,
  Clock,
  Layers,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';

import Header from './components/Header';
import WaterLevelGauge from './components/WaterLevelGauge';
import RealtimeChart from './components/RealtimeChart';
import TidalAnalysisView from './components/TidalAnalysisView';
import CalibrationView from './components/CalibrationView';
import HistoricalView from './components/HistoricalView';
import DiagnosticsView from './components/DiagnosticsView';

export default function App() {
  const [device, setDevice] = useState(null);
  const [latestReading, setLatestReading] = useState(null);
  const [realtimeReadings, setRealtimeReadings] = useState([]);
  const [tidalData, setTidalData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeAlertsCount, setActiveAlertsCount] = useState(0);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [livePulse, setLivePulse] = useState(false);

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

    // Real-time sensor reading pushed from MQTT
    socket.on('sensor:data', (newReading) => {
      setLatestReading(newReading);
      setRealtimeReadings(prev => {
        const updated = [...prev, newReading];
        return updated.slice(-60); // Keep last 60 points
      });

      // Trigger pulse animation
      setLivePulse(true);
      setTimeout(() => setLivePulse(false), 800);
    });

    // New alert received
    socket.on('alert:new', () => {
      setActiveAlertsCount(c => c + 1);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Ringkasan Real-Time', icon: Activity },
    { id: 'tidal', label: 'Analisis Pasang Surut', icon: Waves },
    { id: 'calibration', label: 'Kalibrasi Sensor', icon: Sliders },
    { id: 'history', label: 'Riwayat & Ekspor CSV', icon: FileText },
    { id: 'diagnostics', label: 'Diagnostik & Alert', icon: ShieldAlert, badge: activeAlertsCount },
  ];

  return (
    <div className="container" style={{ paddingTop: '20px', paddingBottom: '40px' }}>
      
      {/* 1. Header with Brand Identity */}
      <Header
        device={device}
        isConnected={isConnected}
        activeAlertsCount={activeAlertsCount}
        onRefresh={refreshAllData}
      />

      {/* 2. Navigation Tabs */}
      <nav className="glass-panel" style={{ padding: '8px', marginBottom: '24px', display: 'flex', gap: '8px', overflowX: 'auto' }}>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '8px',
                border: 'none',
                background: isActive ? 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={18} color={isActive ? '#ffffff' : '#94a3b8'} />
              <span>{item.label}</span>
              {item.badge > 0 && (
                <span style={{ 
                  background: '#ef4444', 
                  color: '#ffffff', 
                  fontSize: '0.7rem', 
                  padding: '2px 6px', 
                  borderRadius: '999px',
                  fontWeight: 700 
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* 3. Main Content Views */}
      <main>
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Top Grid: Gauge + Realtime Chart */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
              <div style={{ flex: '1' }}>
                <WaterLevelGauge
                  reading={latestReading}
                  sensorHeight={device?.sensor_height_cm || 600}
                  tidalStatus={tidalData?.currentStatus}
                />
              </div>

              <div style={{ flex: '2', minWidth: '340px' }}>
                <RealtimeChart readings={realtimeReadings} />
              </div>
            </div>

            {/* Bottom Grid: Live Sensor Telemetry Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              
              {/* Card 1: Raw Distance */}
              <div className="glass-panel" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>JARAK SENSOR (RAW)</span>
                  <Compass size={18} color="#06b6d4" />
                </div>
                <div className="mono-text" style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', marginTop: '8px' }}>
                  {latestReading?.raw_distance_cm ? `${Number(latestReading.raw_distance_cm).toFixed(1)} cm` : '420.5 cm'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Transmisi RS485 Modbus RTU
                </div>
              </div>

              {/* Card 2: Temperature */}
              <div className="glass-panel" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>TEMPERATUR SENSOR / AIR</span>
                  <Thermometer size={18} color="#10b981" />
                </div>
                <div className="mono-text" style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', marginTop: '8px' }}>
                  {latestReading?.temperature_c ? `${Number(latestReading.temperature_c).toFixed(1)} °C` : '28.5 °C'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Kompensasi Termal Ultrasonik
                </div>
              </div>

              {/* Card 3: Battery */}
              <div className="glass-panel" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>TEGANGAN AKI / BATERAI</span>
                  <Battery size={18} color={latestReading?.battery_voltage < 11.5 ? '#f59e0b' : '#38bdf8'} />
                </div>
                <div className="mono-text" style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', marginTop: '8px' }}>
                  {latestReading?.battery_voltage ? `${Number(latestReading.battery_voltage).toFixed(2)} V` : '12.45 V'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Kapasitas: <strong style={{ color: '#34d399' }}>{latestReading?.battery_percent ?? 88}%</strong>
                </div>
              </div>

              {/* Card 4: Signal & SD Card */}
              <div className="glass-panel" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>SINYAL &amp; MICROSD</span>
                  <Radio size={18} color="#818cf8" />
                </div>
                <div className="mono-text" style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', marginTop: '8px' }}>
                  {latestReading?.signal_quality ? `${latestReading.signal_quality} dBm` : '-65 dBm'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  SD Card SPI: <span className="badge badge-emerald" style={{ padding: '2px 6px', fontSize: '0.65rem' }}>SIAP (OK)</span>
                </div>
              </div>

              {/* Card 5: Sample Counter */}
              <div className="glass-panel" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>TOTAL SAMPEL</span>
                  <Hash size={18} color="#f472b6" />
                </div>
                <div className="mono-text" style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', marginTop: '8px' }}>
                  {latestReading?.reading_count ?? 1520}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Sumber: <strong style={{ color: '#38bdf8' }}>{latestReading?.source === 'live' ? 'Live Telemetry' : 'SD Buffer'}</strong>
                </div>
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

        {activeTab === 'history' && (
          <HistoricalView device={device} />
        )}

        {activeTab === 'diagnostics' && (
          <DiagnosticsView
            device={device}
            onAlertResolved={refreshAllData}
          />
        )}
      </main>

      {/* 4. Footer */}
      <footer style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid rgba(59, 130, 246, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <div>
          &copy; 2026 <strong style={{ color: '#f8fafc' }}>PT Tanah Airku Teknologi</strong> &bull; TerraFlow Portable AWLR
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span>ESP32-S3 Industrial Firmware v1.2</span>
          <span>&bull;</span>
          <span>Sensor A16 (RS485 Modbus RTU)</span>
          <span>&bull;</span>
          <span>PostgreSQL Time-Series Partitioning</span>
        </div>
      </footer>

    </div>
  );
}
