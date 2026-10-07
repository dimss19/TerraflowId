import React, { useState } from 'react';
import { 
  Radio, 
  RotateCcw, 
  AlertTriangle, 
  RefreshCw, 
  HardDriveDownload, 
  ShieldCheck, 
  Compass, 
  LogOut,
  User
} from 'lucide-react';

export default function Header({ 
  device, 
  isConnected, 
  activeAlertsCount,
  onRefresh,
  currentUser,
  onLogout,
  onGoToLanding
}) {
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <header style={{ marginBottom: '28px' }}>
      {/* 1. Official Corporate Top Navigation Bar */}
      <div style={{
        background: '#ffffff',
        borderBottom: '1px solid #eef2f7',
        padding: '14px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px',
        boxShadow: '0 2px 8px rgba(0, 56, 130, 0.03)'
      }}>
        {/* Brand Logo & Name */}
        <div 
          onClick={onGoToLanding}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
          title="Ke Beranda Utama Terraflow"
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

        {/* Right Section: Only Live WebSocket & Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          
          {/* 1. LIVE WEBSOCKET Pill */}
          <div style={{
            background: isConnected ? '#ecfdf5' : '#fef2f2',
            color: isConnected ? '#059669' : '#dc2626',
            border: `1px solid ${isConnected ? '#a7f3d0' : '#fecaca'}`,
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '0.78rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span className={isConnected ? 'pulse-dot' : ''} style={{ background: isConnected ? '#10b981' : '#dc2626' }}></span>
            <span>{isConnected ? 'LIVE WEBSOCKET' : 'OFFLINE'}</span>
          </div>

          {/* 2. User Profile Chip */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            padding: '5px 14px',
            borderRadius: '24px',
            boxShadow: '0 1px 4px rgba(0, 56, 130, 0.04)'
          }}>
            {/* Avatar Circle */}
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: '#003882',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.8rem',
              fontWeight: 800
            }}>
              {(currentUser?.fullName || currentUser?.username || 'A')[0].toUpperCase()}
            </div>

            {/* Name & Role */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                {currentUser?.fullName || currentUser?.username || 'Administrator'}
              </span>
              <span style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: currentUser?.role === 'admin' ? '#003882' : '#059669',
                textTransform: 'uppercase'
              }}>
                {currentUser?.role || 'Operator'}
              </span>
            </div>

            {/* Device ID & Device Name Sub-Chip */}
            <div style={{ width: '1px', height: '22px', background: '#cbd5e1' }} />

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#ffffff',
              padding: '3px 10px',
              borderRadius: '16px',
              border: '1px solid #e2e8f0'
            }} title={`ID Perangkat: ${device?.device_id || 'AWLR-001'} | Nama: ${device?.name || 'AWLR Portable Alpha'}`}>
              <div style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#003882'
              }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  color: '#003882',
                  letterSpacing: '0.02em'
                }}>
                  {device?.device_id || 'AWLR-001'}
                </span>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>&bull;</span>
                <span style={{
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  color: '#334155',
                  maxWidth: '170px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {device?.name || 'AWLR Portable Alpha'}
                </span>
              </div>
            </div>

            {/* Logout Action */}
            <button
              onClick={onLogout}
              title="Keluar (Logout)"
              style={{
                marginLeft: '2px',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '4px',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#dc2626'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
            >
              <LogOut size={15} />
            </button>
          </div>

        </div>
      </div>

      {/* 2. Official Corporate Hero Header */}
      <div style={{
        padding: '36px 40px 20px',
        maxWidth: '1440px',
        margin: '0 auto'
      }}>
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
        
        <h1 style={{
          fontSize: '2.6rem',
          fontWeight: 800,
          color: '#0f172a',
          letterSpacing: '-0.03em',
          marginBottom: '10px',
          lineHeight: 1.15
        }}>
          Pemantauan AWLR.
        </h1>

        <p style={{
          fontSize: '1.02rem',
          color: '#64748b',
          maxWidth: '780px',
          lineHeight: 1.6
        }}>
          Siap mendukung monitoring elevasi pasang surut air laut, muara, dan sungai secara terpadu dengan transmisi MQTT real-time, pencatatan MicroSD mandiri, dan kompensasi cerdas.
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
    </header>
  );
}
