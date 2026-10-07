import React, { useState } from 'react';
import { 
  Radio, 
  RotateCcw, 
  AlertTriangle, 
  RefreshCw, 
  HardDriveDownload, 
  ShieldCheck, 
  Compass, 
  Globe, 
  LogOut 
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

        {/* Right Controls: Landing Toggle, User Chip & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={onGoToLanding}
            style={{
              background: '#edf2fc',
              border: '1px solid #bfdbfe',
              color: '#003882',
              borderRadius: '8px',
              padding: '7px 14px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Globe size={14} />
            <span>Landing Page</span>
          </button>

          {currentUser && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.82rem'
            }}>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>
                👤 {currentUser.fullName || currentUser.username}
              </span>
              <span style={{
                background: currentUser.role === 'admin' ? '#003882' : '#059669',
                color: '#ffffff',
                fontSize: '0.66rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '10px',
                textTransform: 'uppercase'
              }}>
                {currentUser.role || 'Operator'}
              </span>
            </div>
          )}

          <button
            onClick={onLogout}
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              borderRadius: '8px',
              padding: '7px 14px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <LogOut size={14} />
            <span>Keluar</span>
          </button>
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
