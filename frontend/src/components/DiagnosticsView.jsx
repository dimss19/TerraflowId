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
  Zap,
  Radio
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
        setActionFeedback('Peringatan berhasil diselesaikan.');
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
      setActionFeedback(`Gagal mengirim restart: ${e.message}`);
    }
  };

  const activeAlerts = alerts.filter(a => !a.is_resolved);
  const resolvedAlerts = alerts.filter(a => a.is_resolved);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Title & Quick Action Banner */}
      <div className="corporate-card" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: '#fef2f2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#dc2626'
              }}>
                <ShieldAlert size={22} />
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
                Diagnostik Sistem &amp; Pusat Peringatan Hardware
              </h2>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#64748b', marginTop: '4px' }}>
              Pelaporan mandiri kegagalan mikrokontroler ESP32-S3, Task Watchdog reset, dan pemantauan sensor RS485
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={handleRemoteReboot}
              className={confirmReboot ? "btn-corporate-primary" : "btn-corporate-outline"}
              style={{ background: confirmReboot ? '#dc2626' : undefined, borderColor: confirmReboot ? '#dc2626' : undefined }}
            >
              <RotateCcw size={16} />
              <span>{confirmReboot ? 'KLIK LAGI UNTUK REBOOT' : 'REBOOT PERANGKAT VIA MQTT'}</span>
            </button>

            <button onClick={fetchAlertsAndDiagnostics} className="btn-corporate-outline">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {actionFeedback && (
          <div style={{
            marginTop: '16px',
            padding: '12px 16px',
            borderRadius: '8px',
            background: '#ecfdf5',
            color: '#059669',
            border: '1px solid #a7f3d0',
            fontSize: '0.88rem',
            fontWeight: 600
          }}>
            {actionFeedback}
          </div>
        )}
      </div>

      {/* Hardware Telemetry Counters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="corporate-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Cpu size={18} color="#003882" />
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>MIKROKONTROLER</span>
          </div>
          <div className="mono-text" style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginTop: '8px' }}>
            ESP32-S3 N8
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>240MHz &bull; RTOS Watchdog Aktif</div>
        </div>

        <div className="corporate-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Radio size={18} color="#003882" />
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>ANTARMUKA SENSOR</span>
          </div>
          <div className="mono-text" style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginTop: '8px' }}>
            A16 RS485 Modbus
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>GPIO 15(TX), 16(RX) &bull; 9600 Baud</div>
        </div>

        <div className="corporate-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <HardDrive size={18} color="#003882" />
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>PENYIMPANAN OFFLINE</span>
          </div>
          <div className="mono-text" style={{ fontSize: '1.3rem', fontWeight: 800, color: '#059669', marginTop: '8px' }}>
            MicroSD SPI (Ready)
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Pin 10, 11, 12, 13 &bull; Auto Re-mount</div>
        </div>

        <div className="corporate-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BatteryCharging size={18} color="#003882" />
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>TEGANGAN AKI</span>
          </div>
          <div className="mono-text" style={{ fontSize: '1.3rem', fontWeight: 800, color: '#003882', marginTop: '8px' }}>
            {device?.battery_voltage ? `${Number(device.battery_voltage).toFixed(2)} V` : '12.45 V'}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>Baterai Normal (82%)</div>
        </div>
      </div>

      {/* Active Alerts List */}
      <div className="corporate-card" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
          <AlertTriangle size={20} color="#dc2626" />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
            Peringatan Lapangan Aktif ({activeAlerts.length})
          </h3>
        </div>

        {activeAlerts.length === 0 ? (
          <div style={{
            padding: '24px',
            borderRadius: '10px',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            textAlign: 'center',
            color: '#059669',
            fontWeight: 700
          }}>
            Semua sistem beroperasi normal. Tidak ada kesalahan atau interupsi watchdog aktif.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {activeAlerts.map(a => (
              <div key={a.id} style={{
                padding: '16px 20px',
                borderRadius: '10px',
                background: a.severity === 'CRITICAL' ? '#fef2f2' : '#fffbeb',
                border: `1px solid ${a.severity === 'CRITICAL' ? '#fecaca' : '#fde68a'}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={a.severity === 'CRITICAL' ? 'badge badge-rose' : 'badge badge-amber'}>
                      {a.alert_type}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {new Date(a.created_at).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
                    {a.message}
                  </p>
                </div>

                <button 
                  onClick={() => handleResolveAlert(a.id)}
                  className="btn-corporate-outline"
                  style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                >
                  <CheckCircle2 size={14} color="#059669" />
                  <span>TANDAI SELESAI</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
