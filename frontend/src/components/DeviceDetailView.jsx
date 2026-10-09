import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Waves, 
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

  // Recalculate status freshness every 10 seconds
  React.useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  const handleRefreshClick = async () => {
    setIsSpinning(true);
    try {
      if (onRefresh) await onRefresh();
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

          {/* Right: Online Status & Refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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

            <button
              onClick={handleRefreshClick}
              disabled={isSpinning}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px' }}
              title="Segarkan Data"
            >
              <RefreshCw size={15} className={isSpinning ? 'spin' : ''} />
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
          <span className="tab-icon"><Waves size={16} /></span>
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
