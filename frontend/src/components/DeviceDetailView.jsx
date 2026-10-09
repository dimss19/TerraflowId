import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Droplet, 
  Activity, 
  Sliders, 
  ArrowLeft, 
  Radio, 
  MapPin, 
  RefreshCw,
  Clock,
  ExternalLink
} from 'lucide-react';

import MonitoringTab from './MonitoringTab';
import AnalysisTab from './AnalysisTab';
import DeviceTab from './DeviceTab';

export default function DeviceDetailView({ 
  device, 
  currentUser,
  latestReading, 
  realtimeReadings = [], 
  tidalData, 
  activeAlertsCount = 0,
  onRefresh, 
  onBackToOverview,
  authToken 
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'monitoring';

  const handleTabChange = (newTab) => {
    setSearchParams({ tab: newTab }, { replace: true });
  };
  const [isSpinning, setIsSpinning] = useState(false);
  const [, setTick] = useState(0);

  // Auto refresh interval state (persisted in localStorage, default 10 seconds)
  const [refreshInterval, setRefreshInterval] = useState(() => {
    const saved = localStorage.getItem('terraflow_auto_refresh');
    return saved !== null ? Number(saved) : 10;
  });

  const handleIntervalChange = (val) => {
    const num = Number(val);
    setRefreshInterval(num);
    localStorage.setItem('terraflow_auto_refresh', String(num));
  };

  // Recalculate status freshness every 5 seconds
  React.useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  // Periodic Auto Refresh data from backend
  React.useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return;

    const autoTimer = setInterval(() => {
      if (onRefresh) onRefresh(true);
    }, refreshInterval * 1000);

    return () => clearInterval(autoTimer);
  }, [refreshInterval, onRefresh]);

  const handleRefreshClick = async () => {
    setIsSpinning(true);
    try {
      if (onRefresh) await onRefresh(false);
    } finally {
      setTimeout(() => {
        setIsSpinning(false);
      }, 750);
    }
  };

  const isOnline = () => {
    if (!device?.last_seen) return false;
    const diffSeconds = (Date.now() - new Date(device.last_seen).getTime()) / 1000;
    return diffSeconds < 120;
  };

  const online = isOnline();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 1. Device Info Subheader Strip */}
      <div className="corporate-card" style={{ padding: '20px 28px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '16px' 
        }}>
          
          {/* Left: Back button & Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={onBackToOverview}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px' }}
              title="Kembali ke Daftar Semua Stasiun"
            >
              <ArrowLeft size={16} />
              <span className="back-text">Semua Stasiun</span>
            </button>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="mono-text" style={{ fontSize: '0.85rem', fontWeight: 800, color: '#003882' }}>
                  {device?.device_id || 'AWLR-001'}
                </span>
                <span style={{ color: '#cbd5e1' }}>&bull;</span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  {device?.name || 'Stasiun AWLR'}
                </h2>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#64748b', marginTop: '3px', flexWrap: 'wrap' }}>
                <MapPin size={13} color="#94a3b8" />
                <span>{device?.location || 'Lokasi stasiun'}</span>
                {device?.latitude && device?.longitude && (
                  <a
                    href={`https://www.google.com/maps?q=${device.latitude},${device.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Buka titik koordinat stasiun di Google Maps"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#003882',
                      background: '#edf2fc',
                      border: '1px solid #bfdbfe',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      textDecoration: 'none',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      marginLeft: '6px',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer'
                    }}
                  >
                    <span className="mono-text">{device.latitude}, {device.longitude}</span>
                    <ExternalLink size={11} strokeWidth={2.5} />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Right: Online Status, Auto Refresh & Manual Refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.76rem',
              fontWeight: 700,
              background: online ? '#ecfdf5' : '#f8fafc',
              color: online ? '#059669' : '#94a3b8',
              border: `1px solid ${online ? '#a7f3d0' : '#e2e8f0'}`
            }}>
              <span 
                className={online ? 'pulse-dot' : ''} 
                style={{ 
                  width: '7px', 
                  height: '7px', 
                  borderRadius: '50%', 
                  background: online ? '#10b981' : '#cbd5e1' 
                }} 
              />
              <span>{online ? 'ONLINE' : 'OFFLINE'}</span>
            </div>

            {/* Auto Refresh Control */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: '8px',
              background: refreshInterval > 0 ? '#f0fdf4' : '#f8fafc',
              border: `1px solid ${refreshInterval > 0 ? '#bbf7d0' : '#e2e8f0'}`,
              fontSize: '0.78rem',
              fontWeight: 600,
              color: refreshInterval > 0 ? '#166534' : '#64748b',
              transition: 'all 0.2s ease'
            }}>
              <span 
                className={refreshInterval > 0 ? 'pulse-dot' : ''} 
                style={{ 
                  width: '6px', 
                  height: '6px', 
                  borderRadius: '50%', 
                  background: refreshInterval > 0 ? '#22c55e' : '#94a3b8' 
                }} 
              />
              <span style={{ fontSize: '0.74rem', fontWeight: 700 }}>Auto:</span>
              <select
                value={refreshInterval}
                onChange={(e) => handleIntervalChange(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  color: refreshInterval > 0 ? '#166534' : '#64748b',
                  cursor: 'pointer',
                  outline: 'none',
                  padding: 0
                }}
                title="Pilih interval pembaruan data otomatis"
              >
                <option value={5}>5 detik</option>
                <option value={10}>10 detik</option>
                <option value={30}>30 detik</option>
                <option value={60}>1 menit</option>
                <option value={0}>Nonaktif</option>
              </select>
            </div>

            <button
              onClick={handleRefreshClick}
              disabled={isSpinning}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px' }}
              title="Segarkan Data Sekarang"
            >
              <RefreshCw size={14} className={isSpinning ? 'spin' : ''} />
              <span>Segarkan</span>
            </button>
          </div>

        </div>
      </div>

      {/* 2. Sub-Navigation Tabs (Responsive: Desktop=Text only, Mobile=Icon only) */}
      <div className="tab-nav-bar">
        <button 
          className={`tab-btn ${currentTab === 'monitoring' ? 'active' : ''}`}
          onClick={() => handleTabChange('monitoring')}
          title="Monitoring Real-Time"
        >
          <span className="tab-icon"><Droplet size={16} /></span>
          <span className="tab-label">Monitoring</span>
        </button>

        <button 
          className={`tab-btn ${currentTab === 'analysis' ? 'active' : ''}`}
          onClick={() => handleTabChange('analysis')}
          title="Analisis & Riwayat Data"
        >
          <span className="tab-icon"><Activity size={16} /></span>
          <span className="tab-label">Analisis &amp; Riwayat</span>
        </button>

        <button 
          className={`tab-btn ${currentTab === 'device' ? 'active' : ''}`}
          onClick={() => handleTabChange('device')}
          title="Pengaturan & Perangkat"
        >
          <span className="tab-icon"><Sliders size={16} /></span>
          <span className="tab-label">Perangkat</span>
          {activeAlertsCount > 0 && (
            <span className="tab-badge" style={{ background: '#dc2626', color: '#ffffff' }}>
              {activeAlertsCount}
            </span>
          )}
        </button>
      </div>

      {/* 3. Tab Contents */}
      {currentTab === 'monitoring' && (
        <MonitoringTab 
          device={device}
          latestReading={latestReading}
          realtimeReadings={realtimeReadings}
          tidalData={tidalData}
        />
      )}

      {currentTab === 'analysis' && (
        <AnalysisTab 
          device={device}
          tidalData={tidalData}
          onRefresh={onRefresh}
        />
      )}

      {currentTab === 'device' && (
        <DeviceTab 
          device={device}
          currentUser={currentUser}
          latestReading={latestReading}
          activeAlertsCount={activeAlertsCount}
          onCalibrationUpdated={onRefresh}
          authToken={authToken}
        />
      )}

    </div>
  );
}
