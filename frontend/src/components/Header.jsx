import React, { useState } from 'react';
import { 
  Compass, 
  RotateCcw, 
  AlertTriangle 
} from 'lucide-react';
import AdminMenu from './AdminMenu';

export default function Header({ 
  device, 
  devices = [],
  isConnected, 
  activeAlertsCount,
  onRefresh,
  currentUser,
  onLogout,
  onGoToLanding,
  onNavigate,
  showHero = true
}) {
  const [toastMessage, setToastMessage] = useState(null);
  const [, setTick] = useState(0);

  // Re-evaluate freshness every 10 seconds
  React.useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  const isDeviceOnline = (dev) => {
    if (!dev || !dev.last_seen) return false;
    const diffSeconds = (Date.now() - new Date(dev.last_seen).getTime()) / 1000;
    return diffSeconds < 120;
  };

  // Determine true status badge: Never show LIVE if device or stations are offline
  let statusBadge = {
    text: 'LIVE',
    color: '#059669',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    dotBg: '#10b981',
    pulse: true
  };

  if (!isConnected) {
    statusBadge = {
      text: 'TERPUTUS',
      color: '#dc2626',
      bg: '#fef2f2',
      border: '#fecaca',
      dotBg: '#dc2626',
      pulse: false
    };
  } else {
    // Live telemetry stays active whenever ANY device is online (e.g. AWLR-002 online while AWLR-001 is offline)
    const isCurrentOnline = device && isDeviceOnline(device);
    const isAnyStationOnline = Array.isArray(devices) && devices.some(d => isDeviceOnline(d));
    const hasLiveTelemetry = isCurrentOnline || isAnyStationOnline;

    if (hasLiveTelemetry) {
      statusBadge = {
        text: 'LIVE',
        color: '#059669',
        bg: '#ecfdf5',
        border: '#a7f3d0',
        dotBg: '#10b981',
        pulse: true
      };
    } else {
      statusBadge = {
        text: 'OFFLINE',
        color: '#64748b',
        bg: '#f8fafc',
        border: '#e2e8f0',
        dotBg: '#94a3b8',
        pulse: false
      };
    }
  }

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <header style={{ marginBottom: '28px' }}>
      {/* 1. Official Corporate Top Navigation Bar */}
      <div className="header-top-bar">
        {/* Brand Logo & Name */}
        <div 
          onClick={onGoToLanding}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
          title={currentUser ? "Ke Dashboard Terraflow" : "Ke Beranda Utama Terraflow"}
        >
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: '2.5px solid #003882',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#003882'
          }}>
            <Compass size={22} strokeWidth={2.5} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#003882', letterSpacing: '-0.02em' }}>
              Terraflow
            </span>
            <span style={{ fontSize: '1.25rem', fontWeight: 500, color: '#003882' }}>
              Indonesia
            </span>
          </div>
        </div>

        {/* Right Section: Connection Status Pill & Admin/Account Dropdown Menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          
          {/* 1. LIVE / OFFLINE Status Pill */}
          <div style={{
            background: statusBadge.bg,
            color: statusBadge.color,
            border: `1px solid ${statusBadge.border}`,
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '0.78rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.25s ease'
          }}>
            <span 
              className={statusBadge.pulse ? 'pulse-dot' : ''} 
              style={{ 
                width: '7px', 
                height: '7px', 
                borderRadius: '50%', 
                background: statusBadge.dotBg 
              }} 
            />
            <span>{statusBadge.text}</span>
          </div>

          {/* 2. Admin & Account Dropdown Menu */}
          <AdminMenu 
            currentUser={currentUser} 
            onNavigate={onNavigate} 
            onLogout={onLogout} 
          />

        </div>
      </div>

      {/* 2. Official Corporate Hero Header (Rendered on main dashboard overview) */}
      {showHero && (
        <div className="header-hero">
          <div style={{
            fontSize: '0.78rem',
            fontWeight: 800,
            color: '#003882',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: '8px'
          }}>
            SISTEM MONITORING TELEMETRI AWLR
          </div>
          
          <h1 className="header-hero-title">
            Pemantauan AWLR.
          </h1>

          <p className="header-hero-desc">
            Siap mendukung monitoring elevasi pasang surut air laut, muara, dan sungai secara terpadu dengan transmisi data real-time, pencatatan offline mandiri, dan kompensasi cerdas.
          </p>

          {/* Toast Notification */}
          {toastMessage && (
            <div style={{
              marginTop: '16px',
              padding: '10px 16px',
              borderRadius: '8px',
              background: '#ffffff',
              border: '1px solid #bfdbfe',
              boxShadow: '0 4px 14px rgba(0, 56, 130, 0.08)',
              color: '#003882',
              fontSize: '0.88rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {toastMessage}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
