import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Cpu, 
  BatteryCharging, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Server, 
  HardDrive, 
  RefreshCw,
  Terminal,
  Clock,
  Zap
} from 'lucide-react';

export default function DiagnosticsView({ device, onAlertResolved }) {
  const [alerts, setAlerts] = useState([]);
  const [diagnostics, setDiagnostics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);

  const fetchAlertsAndDiagnostics = async () => {
    setLoading(true);
    try {
      const [alertsRes, diagRes] = await Promise.all([
        fetch(`/api/alerts/${device?.device_id || 'AWLR-001'}`),
        fetch(`/api/diagnostics/${device?.device_id || 'AWLR-001'}`)
      ]);
      const alertsJson = await alertsRes.json();
      const diagJson = await diagRes.json();

      if (alertsJson.success) setAlerts(alertsJson.data);
      if (diagJson.success) setDiagnostics(diagJson.data);
    } catch (e) {
      console.error('Error fetching diagnostics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlertsAndDiagnostics();
  }, [device]);

  const handleResolveAlert = async (alertId) => {
    try {
      const res = await fetch(`/api/alerts/${alertId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved_by: 'Teknisi PT Tanah Airku Teknologi' })
      });
      const json = await res.json();
      if (json.success) {
        setActionFeedback('Alert berhasil ditandai selesai.');
        fetchAlertsAndDiagnostics();
        if (onAlertResolved) onAlertResolved();
      }
    } catch (e) {
      setActionFeedback(`Gagal: ${e.message}`);
    }
  };

  const [confirmReboot, setConfirmReboot] = useState(false);

  const handleRemoteReboot = async () => {
    if (!confirmReboot) {
      setConfirmReboot(true);
      setTimeout(() => setConfirmReboot(false), 5000);
      return;
    }

    setConfirmReboot(false);
    try {
      const res = await fetch(`/api/devices/${device?.device_id || 'AWLR-001'}/restart`, {
        method: 'POST'
      });
      const json = await res.json();
      setActionFeedback(json.message || 'Perintah reboot telah dikirim ke perangkat.');
    } catch (e) {
      setActionFeedback(`Gagal: ${e.message}`);
    }
  };

  const latestDiag = diagnostics[0] || {};
  const activeAlerts = alerts.filter(a => !a.resolved);
  const resolvedAlerts = alerts.filter(a => a.resolved);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Title & Actions */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldAlert size={24} color="#f59e0b" />
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc' }}>
                Kesehatan Sistem, Watchdog &amp; Manajemen Alert
              </h2>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Monitoring 14 jenis alert lapangan, pelacakan boot reason RTC Memory, dan manajemen perangkat jarak jauh
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={fetchAlertsAndDiagnostics} className="btn btn-secondary">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Segarkan</span>
            </button>
            <button onClick={handleRemoteReboot} className="btn btn-danger">
              <RotateCcw size={14} />
              <span>{confirmReboot ? 'Konfirmasi: Klik Lagi' : 'Reboot Perangkat (ESP32)'}</span>
            </button>
          </div>
        </div>

        {actionFeedback && (
          <div style={{
            marginTop: '16px',
            padding: '10px 16px',
            borderRadius: '8px',
            background: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            color: '#93c5fd',
            fontSize: '0.85rem'
          }}>
            {actionFeedback}
          </div>
        )}
      </div>

      {/* Hardware Diagnostic Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        
        <div className="glass-panel" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
            <Clock size={16} color="#38bdf8" />
            <span>UPTIME SISTEM</span>
          </div>
          <div className="mono-text" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', marginTop: '6px' }}>
            {latestDiag.uptime_sec ? `${Math.floor(latestDiag.uptime_sec / 3600)}j ${Math.floor((latestDiag.uptime_sec % 3600) / 60)}m` : '24j 12m'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Uptime Berjalan</div>
        </div>

        <div className="glass-panel" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
            <RotateCcw size={16} color="#f59e0b" />
            <span>WATCHDOG RESETS</span>
          </div>
          <div className="mono-text" style={{ fontSize: '1.4rem', fontWeight: 800, color: latestDiag.watchdog_count > 0 ? '#f59e0b' : '#10b981', marginTop: '6px' }}>
            {latestDiag.watchdog_count ?? 0} Kali
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>RTC Memory Counter</div>
        </div>

        <div className="glass-panel" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
            <Cpu size={16} color="#818cf8" />
            <span>FREE HEAP MEMORY</span>
          </div>
          <div className="mono-text" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', marginTop: '6px' }}>
            {latestDiag.free_heap_bytes ? `${Math.round(latestDiag.free_heap_bytes / 1024)} KB` : '152 KB'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Sisa RAM Dinamis</div>
        </div>

        <div className="glass-panel" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
            <Zap size={16} color="#10b981" />
            <span>SUHU INTERNAL ESP32</span>
          </div>
          <div className="mono-text" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', marginTop: '6px' }}>
            {latestDiag.esp_temp_c ? `${latestDiag.esp_temp_c} °C` : '41.5 °C'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Sensor Termal On-Chip</div>
        </div>

        <div className="glass-panel" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
            <HardDrive size={16} color="#06b6d4" />
            <span>STATUS MICROSD CARD</span>
          </div>
          <div className="mono-text" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399', marginTop: '6px' }}>
            {latestDiag.sd_card_ok !== false ? 'NORMAL (SPI)' : 'GAGAL'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Penyimpanan Offline Buffer</div>
        </div>

      </div>

      {/* Active Alerts Panel */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <AlertTriangle size={20} color="#ef4444" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
            Daftar Alert Aktif ({activeAlerts.length})
          </h3>
        </div>

        {activeAlerts.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <CheckCircle2 size={32} color="#10b981" style={{ margin: '0 auto 8px' }} />
            <p>Tidak ada insiden atau alert aktif saat ini. Semua sistem berjalan normal.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {activeAlerts.map(alert => (
              <div
                key={alert.id}
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  background: alert.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                  border: `1px solid ${alert.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b'}44`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '16px',
                  flexWrap: 'wrap'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span className={`badge ${alert.severity === 'CRITICAL' ? 'badge-rose' : 'badge-amber'}`}>
                      {alert.severity}
                    </span>
                    <span className="mono-text" style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.9rem' }}>
                      {alert.alert_code}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      &bull; {new Date(alert.timestamp).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {alert.message}
                  </p>
                </div>

                <button
                  className="btn btn-secondary"
                  onClick={() => handleResolveAlert(alert.id)}
                >
                  <CheckCircle2 size={14} color="#34d399" />
                  <span>Tandai Selesai</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resolved Alerts Audit Trail */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginBottom: '16px' }}>
          Riwayat Insiden yang Telah Ditangani ({resolvedAlerts.length})
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(59, 130, 246, 0.2)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 8px' }}>Waktu Kejadian</th>
                <th style={{ padding: '10px 8px' }}>Kode Alert</th>
                <th style={{ padding: '10px 8px' }}>Tingkat</th>
                <th style={{ padding: '10px 8px' }}>Deskripsi</th>
                <th style={{ padding: '10px 8px' }}>Ditangani Oleh</th>
                <th style={{ padding: '10px 8px' }}>Waktu Selesai</th>
              </tr>
            </thead>
            <tbody>
              {resolvedAlerts.slice(0, 10).map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.08)' }}>
                  <td className="mono-text" style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>
                    {new Date(r.timestamp).toLocaleString('id-ID')}
                  </td>
                  <td className="mono-text" style={{ padding: '10px 8px', color: '#f8fafc', fontWeight: 600 }}>
                    {r.alert_code}
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <span className="badge badge-cyan">{r.severity}</span>
                  </td>
                  <td style={{ padding: '10px 8px', color: '#94a3b8' }}>
                    {r.message}
                  </td>
                  <td style={{ padding: '10px 8px', color: '#64748b' }}>
                    {r.resolved_by || '-'}
                  </td>
                  <td className="mono-text" style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>
                    {r.resolved_at ? new Date(r.resolved_at).toLocaleString('id-ID') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
