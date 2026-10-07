import React, { useState } from 'react';
import { 
  Radio, 
  RotateCcw, 
  AlertTriangle, 
  RefreshCw,
  HardDriveDownload,
  ShieldCheck,
  Compass,
  ArrowRight,
  ExternalLink
} from 'lucide-react';

export default function Header({ 
  device, 
  isConnected, 
  activeAlertsCount,
  onRefresh,
  activeTab,
  setActiveTab
}) {
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const triggerSimulatorAction = async (endpoint, label) => {
    try {
      setTriggerLoading(true);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: device?.device_id || 'AWLR-001' })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ ${label} berhasil dipicu via MQTT!`);
      } else {
        showToast(`❌ Gagal: ${data.error}`);
      }
    } catch (e) {
      showToast(`❌ Error: ${e.message}`);
    } finally {
      setTriggerLoading(false);
      if (onRefresh) onRefresh();
    }
  };

  return (
    <header style={{ marginBottom: '28px' }}>
      {/* 1. Official Corporate Top Navigation Bar (Matching Image 2) */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
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

      </div>

      {/* 2. Official Corporate Hero Header (Matching Image 2 "Hubungi Kami.") */}
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
