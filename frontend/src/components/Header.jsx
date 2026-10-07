import React, { useState } from 'react';
import { 
  Waves, 
  Activity, 
  Radio, 
  RotateCcw, 
  AlertTriangle, 
  RefreshCw,
  HardDriveDownload,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

export default function Header({ 
  device, 
  isConnected, 
  activeAlertsCount,
  onRefresh
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
    <header className="glass-panel" style={{ marginBottom: '24px', padding: '16px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Brand identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img 
            src="/logo.png" 
            alt="TerraFlow Logo" 
            style={{ 
              width: '56px', 
              height: '56px', 
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.4))'
            }} 
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(to right, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                TERRAFLOW
              </h1>
              <span className="badge badge-cyan">AWLR PORTABLE</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              PT Tanah Airku Teknologi &bull; Industrial Hydro-Tidal Telemetry
            </p>
          </div>
        </div>

        {/* Device & Status controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          
          {/* Active Device Info */}
          <div style={{ 
            background: 'rgba(15, 23, 42, 0.6)', 
            border: '1px solid rgba(59, 130, 246, 0.2)', 
            padding: '8px 14px', 
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <Radio size={16} color="#38bdf8" />
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>DEVICE ID</div>
              <div className="mono-text" style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc' }}>
                {device?.device_id || 'AWLR-001'}
              </div>
            </div>
          </div>

          {/* Connection Status */}
          <div className={`badge ${isConnected ? 'badge-emerald' : 'badge-rose'}`} style={{ padding: '8px 14px' }}>
            <span className={isConnected ? 'pulse-dot' : ''} style={!isConnected ? { width: 8, height: 8, borderRadius: '50%', background: '#ef4444' } : {}} />
            <span>{isConnected ? 'LIVE WEBSOCKET' : 'CONNECTING...'}</span>
          </div>

          {/* Alert Counter Badge */}
          {activeAlertsCount > 0 && (
            <div className="badge badge-rose" style={{ padding: '8px 14px' }}>
              <AlertTriangle size={14} />
              <span>{activeAlertsCount} ALERT AKTIF</span>
            </div>
          )}

          {/* Quick Simulation Trigger Toolbar */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="btn btn-secondary" 
              title="Picu Sinkronisasi SD Card Massal"
              disabled={triggerLoading}
              onClick={() => triggerSimulatorAction('/api/devices/AWLR-001/sync', 'Sinkronisasi SD Card')}
            >
              <HardDriveDownload size={14} color="#38bdf8" />
              <span>Sync SD</span>
            </button>

            <button 
              className="btn btn-warning" 
              title="Injeksi Watchdog Reset untuk Verifikasi"
              disabled={triggerLoading}
              onClick={() => triggerSimulatorAction('/api/simulator/trigger-wdt', 'Uji Watchdog Reset')}
            >
              <RotateCcw size={14} />
              <span>Sim WDT</span>
            </button>

            <button 
              className="btn btn-danger" 
              title="Injeksi Sensor RS485 Gagal untuk Uji Alert"
              disabled={triggerLoading}
              onClick={() => triggerSimulatorAction('/api/simulator/trigger-sensor-fail', 'Uji Sensor Fail')}
            >
              <AlertTriangle size={14} />
              <span>Sim Fail</span>
            </button>
          </div>

        </div>
      </div>

      {/* Floating Action Toast Notification */}
      {toastMessage && (
        <div style={{
          marginTop: '12px',
          padding: '10px 16px',
          borderRadius: '8px',
          background: 'rgba(30, 41, 59, 0.95)',
          border: '1px solid rgba(6, 182, 212, 0.4)',
          fontSize: '0.85rem',
          color: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.4)'
        }}>
          <CheckCircle2 size={16} color="#38bdf8" />
          <span>{toastMessage}</span>
        </div>
      )}
    </header>
  );
}
