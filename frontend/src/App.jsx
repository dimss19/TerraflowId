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
  MapPin,
  Phone,
  Mail,
  Send,
  RotateCcw,
  RefreshCw,
  HardDriveDownload,
  AlertTriangle,
  Globe,
  Share2,
  CheckCircle2,
  ArrowRight
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
  const [actionMessage, setActionMessage] = useState(null);

  const showActionToast = (msg) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 4000);
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

    // Real-time sensor reading pushed from MQTT
    socket.on('sensor:data', (newReading) => {
      setLatestReading(newReading);
      setRealtimeReadings(prev => {
        const updated = [...prev, newReading];
        return updated.slice(-60);
      });
    });

    // Real-time alerts
    socket.on('device:alert', (alert) => {
      setActiveAlertsCount(prev => prev + 1);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const triggerSimulatorAction = async (endpoint, label) => {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: device?.device_id || 'AWLR-001' })
      });
      const data = await res.json();
      if (data.success) {
        showActionToast(`✅ ${label} berhasil dikirim!`);
      } else {
        showActionToast(`❌ Gagal: ${data.error}`);
      }
    } catch (e) {
      showActionToast(`❌ Error: ${e.message}`);
    } finally {
      refreshAllData();
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
      
      {/* 1. Official Corporate Header & Hero Banner */}
      <Header 
        device={device}
        isConnected={isConnected}
        activeAlertsCount={activeAlertsCount}
        onRefresh={refreshAllData}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Container */}
      <main style={{ maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '0 40px', flex: 1 }}>
        
        {/* Toast feedback */}
        {actionMessage && (
          <div style={{
            marginBottom: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            background: '#ffffff',
            border: '1px solid #bfdbfe',
            color: '#003882',
            fontWeight: 700,
            fontSize: '0.88rem',
            boxShadow: '0 4px 16px rgba(0, 56, 130, 0.08)'
          }}>
            {actionMessage}
          </div>
        )}

        {/* 2. Sub-Navigation Tabs */}
        <div style={{
          display: 'flex',
          gap: '8px',
          background: '#ffffff',
          padding: '6px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 10px rgba(0, 56, 130, 0.03)',
          marginBottom: '28px',
          overflowX: 'auto'
        }}>
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
        </div>

        {/* 3. Tab Contents */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            
            {/* Top Telemetry Grid: Water Level Gauge & Real-time Chart */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(480px, 2.2fr)', gap: '24px' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div className="corporate-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#edf2fc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#003882' }}>
                    <Radio size={16} />
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>JARAK SENSOR (RAW)</span>
                </div>
                <div className="mono-text" style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginTop: '10px' }}>
                  {latestReading?.raw_distance_cm ? Number(latestReading.raw_distance_cm).toFixed(1) : '373.8'} <span style={{ fontSize: '0.8rem', color: '#64748b' }}>cm</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>A16 Modbus Terkalibrasi</div>
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
          />
        )}

        {activeTab === 'diagnostics' && (
          <DiagnosticsView 
            device={device} 
            onAlertResolved={refreshAllData} 
          />
        )}

      </main>

      {/* 4. Official Mitra & Akreditasi Industri (Matching Image 2) */}
      <section style={{
        marginTop: '60px',
        padding: '36px 40px',
        background: '#f4f8fd',
        borderTop: '1px solid #e2e8f0',
        borderBottom: '1px solid #e2e8f0',
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

      {/* 5. Official Corporate 4-Column Footer (Matching Image 2) */}
      <footer style={{
        background: '#edf3fb',
        padding: '48px 40px 24px',
        marginTop: 'auto'
      }}>
        <div style={{
          maxWidth: '1440px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '36px',
          paddingBottom: '36px',
          borderBottom: '1px solid #d8e4f4'
        }}>
          {/* Column 1: Company Profile */}
          <div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#003882', marginBottom: '14px' }}>
              Terraflow Indonesia
            </h4>
            <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.6 }}>
              <strong>PT Tanah Airku Teknologi</strong> menghadirkan layanan pemetaan pada bidang geospatial untuk mendukung kebutuhan survei, analisis, serta pengolahan data spasial secara efektif dan terukur.
            </p>
          </div>

          {/* Column 2: Layanan */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '14px' }}>
              Layanan
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.84rem', color: '#475569' }}>
              <li>Survei Topografi</li>
              <li>Survei GNSS</li>
              <li>Aerial Mapping</li>
              <li>Survei Batimetri &amp; AWLR</li>
            </ul>
          </div>

          {/* Column 3: Perusahaan */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '14px' }}>
              Perusahaan
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.84rem', color: '#475569' }}>
              <li>Tentang Kami</li>
              <li>Portofolio</li>
              <li>Karir</li>
              <li>Kontak</li>
            </ul>
          </div>

          {/* Column 4: Hubungi Kami */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '14px' }}>
              Hubungi Kami
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.84rem', color: '#475569' }}>
              <div>terraflow.pt@gmail.com</div>
              <div>+62 813 5858 3775</div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#003882', border: '1px solid #cbd5e1' }}>
                  <Globe size={14} />
                </div>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#003882', border: '1px solid #cbd5e1' }}>
                  <Share2 size={14} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Copyright & Legal */}
        <div style={{
          maxWidth: '1440px',
          margin: '0 auto',
          paddingTop: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          fontSize: '0.78rem',
          color: '#64748b'
        }}>
          <div>
            &copy; 2024 TerraflowID Geospatial &amp; Engineering. Precision in Every Pixel.
          </div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <span style={{ cursor: 'pointer' }}>Privacy Policy</span>
            <span style={{ cursor: 'pointer' }}>Terms of Service</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
