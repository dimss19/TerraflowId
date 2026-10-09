import React from 'react';
import { 
  Radio, 
  MapPin, 
  Battery, 
  Thermometer, 
  Waves, 
  AlertTriangle, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  PlusCircle,
  Activity,
  User
} from 'lucide-react';

export default function DeviceOverview({ 
  devices = [], 
  loading = false, 
  onSelectDevice, 
  onRefresh, 
  currentUser, 
  onGoToManageDevices 
}) {
  const [isSpinning, setIsSpinning] = React.useState(false);

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

  const [, setTick] = React.useState(0);

  // Recalculate freshness every 10 seconds
  React.useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  const isDeviceOnline = (lastSeen) => {
    if (!lastSeen) return false;
    const diffSeconds = (Date.now() - new Date(lastSeen).getTime()) / 1000;
    return diffSeconds < 120; // Online if seen within 2 minutes
  };

  const totalDevices = devices.length;
  const onlineDevices = devices.filter(d => isDeviceOnline(d.last_seen)).length;
  const totalAlerts = devices.reduce((acc, d) => acc + (Number(d.active_alerts_count) || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Header Summary Banner */}
      <div className="corporate-card" style={{ padding: '24px 28px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '16px' 
        }}>
          <div>
            <div style={{ 
              fontSize: '0.74rem', 
              fontWeight: 800, 
              color: '#003882', 
              letterSpacing: '0.1em', 
              textTransform: 'uppercase',
              marginBottom: '4px'
            }}>
              {currentUser?.role === 'admin' ? 'JARINGAN STASIUN AWLR TERPADU' : 'STASIUN AWLR OPERASIONAL'}
            </div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {currentUser?.role === 'admin' ? 'Ringkasan Seluruh Perangkat' : 'Stasiun Pemantauan Saya'}
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px', marginBottom: 0 }}>
              {currentUser?.role === 'admin' 
                ? 'Pantau status koneksi, telemetri tinggi muka air, dan kondisi lapangan dari seluruh stasiun AWLR yang terdaftar.'
                : 'Pantau stasiun AWLR lapangan yang ditugaskan kepada Anda oleh administrator sistem.'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleRefreshClick}
              disabled={loading || isSpinning}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              title="Perbarui Data"
            >
              <RefreshCw size={15} className={loading || isSpinning ? 'spin' : ''} />
              <span>Segarkan</span>
            </button>

            {currentUser?.role === 'admin' && onGoToManageDevices && (
              <button
                onClick={onGoToManageDevices}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <PlusCircle size={16} />
                <span>Kelola Perangkat</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick KPI stats strip */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
          gap: '16px', 
          marginTop: '20px',
          paddingTop: '20px',
          borderTop: '1px solid #f1f5f9'
        }}>
          <div className="subtle-panel" style={{ padding: '12px 16px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>TOTAL STASIUN</span>
            <div className="mono-text" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
              {totalDevices} <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Unit</span>
            </div>
          </div>

          <div className="subtle-panel" style={{ padding: '12px 16px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>STASIUN ONLINE</span>
            <div className="mono-text" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
              {onlineDevices} <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>/ {totalDevices} Aktif</span>
            </div>
          </div>

          <div className="subtle-panel" style={{ padding: '12px 16px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>PERINGATAN AKTIF</span>
            <div className="mono-text" style={{ fontSize: '1.4rem', fontWeight: 800, color: totalAlerts > 0 ? '#dc2626' : '#059669', marginTop: '2px' }}>
              {totalAlerts} <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Isu</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Device Cards Grid */}
      {devices.length === 0 ? (
        <div className="corporate-card" style={{ padding: '48px', textAlign: 'center' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: '#edf2fc',
            color: '#003882',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <Radio size={28} />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
            {currentUser?.role === 'admin' 
              ? 'Belum Ada Perangkat AWLR Terdaftar' 
              : 'Belum Ada Stasiun yang Ditugaskan'}
          </h3>
          <p style={{ fontSize: '0.88rem', color: '#64748b', maxWidth: '440px', margin: '0 auto 20px' }}>
            {currentUser?.role === 'admin' 
              ? 'Silakan tambahkan perangkat baru melalui menu Kelola Perangkat untuk mulai menerima data telemetri.'
              : 'Belum ada stasiun AWLR yang ditugaskan kepada akun Anda oleh administrator. Silakan hubungi administrator sistem untuk penugasan stasiun pemantauan.'}
          </p>
          {currentUser?.role === 'admin' && onGoToManageDevices && (
            <button onClick={onGoToManageDevices} className="btn btn-primary">
              Tambah Perangkat Pertama
            </button>
          )}
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', 
          gap: '20px' 
        }}>
          {devices.map((dev) => {
            const online = isDeviceOnline(dev.last_seen);
            const latest = dev.latest_reading || null;
            const alertsCount = Number(dev.active_alerts_count) || 0;

            return (
              <div 
                key={dev.device_id}
                className="corporate-card"
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  padding: '24px',
                  position: 'relative',
                  borderTop: online ? '4px solid #003882' : '4px solid #cbd5e1',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  cursor: 'pointer'
                }}
                onClick={() => onSelectDevice(dev.device_id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 28px rgba(0, 56, 130, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                }}
              >
                {/* Header: ID, Name, Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: online ? '#edf2fc' : '#f1f5f9',
                      color: online ? '#003882' : '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Radio size={18} />
                    </div>
                    <div>
                      <div className="mono-text" style={{ fontSize: '0.88rem', fontWeight: 800, color: '#003882' }}>
                        {dev.device_id}
                      </div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '2px 0 0' }}>
                        {dev.name}
                      </h3>
                    </div>
                  </div>

                  {/* Online / Offline status badge */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '16px',
                    fontSize: '0.72rem',
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
                </div>

                {/* Location & Operator Info */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: '6px', 
                  fontSize: '0.8rem', 
                  color: '#64748b',
                  marginBottom: '16px' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={14} color="#94a3b8" />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {dev.location || 'Lokasi belum dikonfigurasi'}
                    </span>
                  </div>

                  {currentUser?.role === 'admin' ? (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      color: dev.assigned_operator_name ? '#003882' : '#64748b',
                      background: dev.assigned_operator_name ? '#edf2fc' : '#f1f5f9',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      width: 'fit-content'
                    }}>
                      <User size={12} />
                      <span>
                        {dev.assigned_operator_name 
                          ? `Operator: ${dev.assigned_operator_name}` 
                          : 'Belum Ditugaskan'}
                      </span>
                    </div>
                  ) : (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: '#059669',
                      background: '#ecfdf5',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      width: 'fit-content'
                    }}>
                      <CheckCircle2 size={12} />
                      <span>Stasiun Tugas Anda</span>
                    </div>
                  )}
                </div>

                {/* Telemetry Snapshot Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '10px',
                  background: '#f8fafc',
                  border: '1px solid #eef2f7',
                  borderRadius: '10px',
                  padding: '12px',
                  marginBottom: '16px'
                }}>
                  {/* Water Level */}
                  <div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      MUKA AIR
                    </div>
                    <div className="mono-text" style={{ fontSize: '1.15rem', fontWeight: 800, color: '#003882', marginTop: '2px' }}>
                      {latest?.water_level_cm != null 
                        ? `${(Number(latest.water_level_cm) / 100).toFixed(2)} m`
                        : '--'}
                    </div>
                  </div>

                  {/* Battery */}
                  <div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      TEGANGAN AKI
                    </div>
                    <div className="mono-text" style={{ fontSize: '1.15rem', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                      {latest?.battery_voltage != null 
                        ? `${Number(latest.battery_voltage).toFixed(2)} V` 
                        : '--'}
                    </div>
                  </div>

                  {/* Temperature */}
                  <div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      TEMPERATUR
                    </div>
                    <div className="mono-text" style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155', marginTop: '2px' }}>
                      {latest?.temperature_c != null 
                        ? `${Number(latest.temperature_c).toFixed(1)} °C` 
                        : '--'}
                    </div>
                  </div>

                  {/* RSSI Signal */}
                  <div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      SINYAL
                    </div>
                    <div className="mono-text" style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155', marginTop: '2px' }}>
                      {latest?.signal_quality != null 
                        ? `${latest.signal_quality} dBm` 
                        : '--'}
                    </div>
                  </div>
                </div>

                {/* Footer Strip */}
                <div style={{ 
                  marginTop: 'auto', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  paddingTop: '12px',
                  borderTop: '1px solid #f1f5f9',
                  fontSize: '0.76rem',
                  color: '#94a3b8'
                }}>
                  <div>
                    {alertsCount > 0 ? (
                      <span style={{ 
                        color: '#dc2626', 
                        fontWeight: 700, 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px' 
                      }}>
                        <AlertTriangle size={13} />
                        {alertsCount} Peringatan Aktif
                      </span>
                    ) : (
                      <span>
                        {dev.last_seen 
                          ? `Update: ${new Date(dev.last_seen).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` 
                          : 'Belum ada data'}
                      </span>
                    )}
                  </div>

                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px', 
                    color: '#003882', 
                    fontWeight: 700 
                  }}>
                    <span>Buka Detail</span>
                    <ChevronRight size={14} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
