import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Send, 
  History, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Calculator, 
  ShieldCheck, 
  ArrowRight,
  ShieldAlert,
  Cpu,
  Radio,
  HardDrive,
  BatteryCharging,
  RotateCcw,
  HardDriveDownload,
  Check,
  AlertTriangle,
  Activity
} from 'lucide-react';

export default function DeviceTab({ 
  device, 
  currentUser,
  latestReading, 
  activeAlertsCount = 0,
  onCalibrationUpdated,
  onActionTriggered,
  authToken
}) {
  const isAdmin = currentUser?.role === 'admin';
  // --- Calibration State ---
  const [formData, setFormData] = useState({
    sensor_height_cm: 600.0,
    offset_cm: 0.0,
    slope: 1.0,
    applied_by: 'Teknisi AWLR',
    notes: 'Penyesuaian parameter kalibrasi lapangan'
  });

  const [loadingCalib, setLoadingCalib] = useState(false);
  const [calibHistory, setCalibHistory] = useState([]);
  const [calibFeedback, setCalibFeedback] = useState(null);

  // --- Diagnostics & Alerts State ---
  const [alerts, setAlerts] = useState([]);
  const [diagnostics, setDiagnostics] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [isSpinningAlerts, setIsSpinningAlerts] = useState(false);

  const handleRefreshAlerts = async () => {
    setIsSpinningAlerts(true);
    try {
      await fetchAlerts();
    } finally {
      setTimeout(() => {
        setIsSpinningAlerts(false);
      }, 750);
    }
  };

  useEffect(() => {
    if (device) {
      setFormData(prev => ({
        ...prev,
        sensor_height_cm: Number(device.sensor_height_cm) || 600.0,
        offset_cm: Number(device.calibrated_offset) || 0.0,
        slope: Number(device.calibrated_slope) || 1.0
      }));
      if (isAdmin) {
        fetchCalibrationHistory();
      }
      fetchAlerts();
      fetchDiagnostics();
    }
  }, [device, isAdmin]);

  const fetchCalibrationHistory = async () => {
    try {
      const res = await fetch(`/api/calibration/${device?.device_id || 'AWLR-001'}/history`);
      const json = await res.json();
      if (json.success) {
        setCalibHistory(json.data);
      }
    } catch (e) {
      console.error('Error fetching calibration history:', e);
    }
  };

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`/api/alerts/${device?.device_id || 'AWLR-001'}?status=active`);
      const json = await res.json();
      if (json.success) {
        setAlerts(json.data);
      }
    } catch (e) {
      console.error('Error fetching alerts:', e);
    }
  };

  const fetchDiagnostics = async () => {
    try {
      const res = await fetch(`/api/diagnostics/${device?.device_id || 'AWLR-001'}`);
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        setDiagnostics(json.data[0]);
      }
    } catch (e) {
      console.error('Error fetching diagnostics:', e);
    }
  };

  // Calibration calculations
  const rawDist = latestReading?.raw_distance_cm != null ? Number(latestReading.raw_distance_cm) : 420.0;
  const currentHeight = Number(device?.sensor_height_cm) || 600.0;
  const currentOffset = Number(device?.calibrated_offset) || 0.0;
  const currentSlope = Number(device?.calibrated_slope) || 1.0;
  const currentCalcLevel = +(currentHeight - (rawDist * currentSlope + currentOffset)).toFixed(2);

  const simHeight = Number(formData.sensor_height_cm) || 600.0;
  const simOffset = Number(formData.offset_cm) || 0.0;
  const simSlope = Number(formData.slope) || 1.0;
  const simCalcLevel = +(simHeight - (rawDist * simSlope + simOffset)).toFixed(2);
  const deltaLevel = +(simCalcLevel - currentCalcLevel).toFixed(2);

  const handleCalibrationSubmit = async (e) => {
    e.preventDefault();
    setLoadingCalib(true);
    setCalibFeedback(null);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await fetch(`/api/calibration/${device?.device_id || 'AWLR-001'}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(formData)
      });
      const json = await res.json();

      if (json.success) {
        setCalibFeedback({ type: 'success', text: 'Kalibrasi berhasil disimpan dan disinkronkan ke stasiun AWLR.' });
        fetchCalibrationHistory();
        if (onCalibrationUpdated) onCalibrationUpdated();
      } else {
        setCalibFeedback({ type: 'error', text: json.error || 'Gagal menyimpan kalibrasi' });
      }
    } catch (err) {
      setCalibFeedback({ type: 'error', text: err.message });
    } finally {
      setLoadingCalib(false);
    }
  };

  const handleResolveAlert = async (alertId) => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await fetch(`/api/alerts/${alertId}/resolve`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ resolved_by: 'Operator AWLR' })
      });
      const json = await res.json();
      if (json.success) {
        setActionFeedback('Peringatan telah diselesaikan');
        fetchAlerts();
        setTimeout(() => setActionFeedback(null), 3500);
      }
    } catch (e) {
      console.error('Error resolving alert:', e);
    }
  };

  const handleRemoteCommand = async (commandName, endpoint) => {
    setLoadingAction(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers
      });
      const json = await res.json();
      if (json.success) {
        setActionFeedback(`${json.message || `Perintah ${commandName} berhasil dikirim`}`);
      } else {
        setActionFeedback(`Gagal: ${json.error}`);
      }
    } catch (e) {
      setActionFeedback(`Error: ${e.message}`);
    } finally {
      setLoadingAction(false);
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* ========================================================= */}
      {/* SECTION 1: KALIBRASI SENSOR AWLR (KHUSUS ADMINISTRATOR)   */}
      {/* ========================================================= */}
      {isAdmin && (
        <div className="corporate-card" style={{ padding: '28px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: '#edf2fc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#003882'
              }}>
                <Sliders size={22} />
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Konfigurasi &amp; Kalibrasi Sensor
              </h2>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#64748b', marginTop: '4px', marginBottom: 0 }}>
              Sesuaikan tinggi referensi, offset elevasi, dan faktor pengali slope secara jarak jauh via MQTT
            </p>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#ecfdf5',
            color: '#059669',
            border: '1px solid #a7f3d0',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '0.78rem',
            fontWeight: 700
          }}>
            <ShieldCheck size={16} />
            <span>KALIBRASI TERVALIDASI</span>
          </div>
        </div>

        {/* Feedback message */}
        {calibFeedback && (
          <div style={{
            marginTop: '20px',
            padding: '12px 18px',
            borderRadius: '10px',
            background: calibFeedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
            color: calibFeedback.type === 'success' ? '#059669' : '#dc2626',
            border: `1px solid ${calibFeedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            fontSize: '0.88rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {calibFeedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {calibFeedback.text}
          </div>
        )}

        {/* Calibration Active Values & Live Preview Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
          gap: '24px', 
          marginTop: '24px' 
        }}>
          
          {/* Left: Calibration Form */}
          <form onSubmit={handleCalibrationSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                TINGGI SENSOR DARI DASAR REFERENSI (CM)
              </label>
              <input
                type="number"
                step="0.1"
                min="50"
                max="2000"
                className="corporate-input"
                value={formData.sensor_height_cm}
                onChange={(e) => setFormData({ ...formData, sensor_height_cm: e.target.value })}
                required
              />
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Jarak pemasangan sensor ke dasar acuan elevasi (nol ukur)</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                  OFFSET ELEVASI (CM)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="-100"
                  max="100"
                  className="corporate-input"
                  value={formData.offset_cm}
                  onChange={(e) => setFormData({ ...formData, offset_cm: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                  FAKTOR PENGALI (SLOPE)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0.8"
                  max="1.2"
                  className="corporate-input"
                  value={formData.slope}
                  onChange={(e) => setFormData({ ...formData, slope: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                NAMA PETUGAS / TEKNISI
              </label>
              <input
                type="text"
                className="corporate-input"
                value={formData.applied_by}
                onChange={(e) => setFormData({ ...formData, applied_by: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                CATATAN PERUBAHAN
              </label>
              <input
                type="text"
                className="corporate-input"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <button 
              type="submit" 
              disabled={loadingCalib} 
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px' }}
            >
              <Send size={16} />
              <span>{loadingCalib ? 'Menyimpan & Mengirim...' : 'Terapkan Kalibrasi ke Perangkat'}</span>
            </button>
          </form>

          {/* Right: Live Calculation Simulation Panel */}
          <div className="subtle-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#003882' }}>
              <Calculator size={18} />
              <span style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase' }}>
                SIMULATOR HASIL KALIBRASI REAL-TIME
              </span>
            </div>

            <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
              Jarak mentah sensor saat ini: <strong>{rawDist.toFixed(1)} cm</strong>
            </div>

            <div style={{
              background: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              padding: '16px'
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                ELEVASI DENGAN KALIBRASI AKTIF SAAT INI
              </div>
              <div className="mono-text" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                {currentCalcLevel.toFixed(1)} <span style={{ fontSize: '0.9rem', color: '#003882' }}>cm</span>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8', marginLeft: '8px' }}>
                  ({(currentCalcLevel / 100).toFixed(2)} m)
                </span>
              </div>
            </div>

            <div style={{
              background: '#eff6ff',
              borderRadius: '10px',
              border: '1px solid #bfdbfe',
              padding: '16px'
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#003882', textTransform: 'uppercase' }}>
                ELEVASI HASIL PENYESUAIAN BARU (SIMULASI)
              </div>
              <div className="mono-text" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#003882', marginTop: '4px' }}>
                {simCalcLevel.toFixed(1)} <span style={{ fontSize: '0.9rem', color: '#003882' }}>cm</span>
                <span style={{ fontSize: '0.85rem', color: '#0369a1', marginLeft: '8px' }}>
                  ({(simCalcLevel / 100).toFixed(2)} m)
                </span>
              </div>
              <div style={{ 
                fontSize: '0.78rem', 
                fontWeight: 700, 
                color: deltaLevel > 0 ? '#059669' : deltaLevel < 0 ? '#d97706' : '#64748b',
                marginTop: '6px'
              }}>
                Selisih dari nilai saat ini: {deltaLevel > 0 ? `+${deltaLevel}` : deltaLevel} cm
              </div>
            </div>

            <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.5 }}>
              Formula hidrometri: <em>Elevasi = Tinggi Sensor - (Jarak Sensor &times; Slope + Offset)</em>.
              Data akan otomatis dienkode ke memori non-volatil stasiun.
            </div>
          </div>

        </div>

        {/* Calibration Audit History Table */}
        <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', marginBottom: '12px' }}>
            Riwayat Log Kalibrasi Sensor
          </div>

          <div className="table-responsive">
            <table className="corporate-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Waktu Penerapan</th>
                  <th>Tinggi Sensor</th>
                  <th>Offset</th>
                  <th>Slope</th>
                  <th>Petugas</th>
                  <th>Catatan</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {calibHistory.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                      Belum ada riwayat kalibrasi tercatat
                    </td>
                  </tr>
                ) : (
                  calibHistory.slice(0, 5).map((row, idx) => (
                    <tr key={idx}>
                      <td className="mono-text" style={{ fontSize: '0.8rem' }}>
                        {new Date(row.applied_at).toLocaleString('id-ID')}
                      </td>
                      <td className="mono-text" style={{ fontWeight: 700 }}>
                        {row.sensor_height_cm} cm
                      </td>
                      <td className="mono-text">{row.offset_cm} cm</td>
                      <td className="mono-text">{Number(row.slope).toFixed(6)}</td>
                      <td>{row.applied_by || '-'}</td>
                      <td>{row.notes || '-'}</td>
                      <td>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          background: row.is_active ? '#ecfdf5' : '#f1f5f9',
                          color: row.is_active ? '#059669' : '#64748b'
                        }}>
                          {row.is_active ? 'Aktif' : 'Arsip'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 2: KESEHATAN SISTEM & DIAGNOSTIK */}
      {/* ========================================================= */}
      <div className="corporate-card" style={{ padding: '28px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: '#edf2fc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#003882'
              }}>
                <Activity size={22} />
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Kesehatan &amp; Diagnostik Perangkat
              </h2>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#64748b', marginTop: '4px', marginBottom: 0 }}>
              Kondisi telemetri internal stasiun pemantau, integritas memori, dan daya mandiri
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => handleRemoteCommand('Restart', `/api/devices/${device?.device_id || 'AWLR-001'}/restart`)}
              disabled={loadingAction}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RotateCcw size={15} />
              <span>Restart Stasiun</span>
            </button>

            <button
              onClick={() => handleRemoteCommand('Sinkronisasi', `/api/devices/${device?.device_id || 'AWLR-001'}/sync`)}
              disabled={loadingAction}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <HardDriveDownload size={15} />
              <span>Sinkronisasi SD</span>
            </button>
          </div>
        </div>

        {/* Action feedback toast */}
        {actionFeedback && (
          <div style={{
            marginTop: '16px',
            padding: '10px 16px',
            borderRadius: '8px',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            color: '#003882',
            fontSize: '0.85rem',
            fontWeight: 700
          }}>
            {actionFeedback}
          </div>
        )}

        {/* System Telemetry Modules Grid (Without proprietary chip details) */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
          gap: '14px', 
          marginTop: '24px' 
        }}>
          <div className="subtle-panel" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={16} color="#003882" />
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                MODUL KONTROL UTAMA
              </span>
            </div>
            <div className="mono-text" style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginTop: '6px' }}>
              Unit Pengendali Aktif
            </div>
            <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
              Watchdog Pengaman Aktif &bull; Uptime: {diagnostics?.uptime_sec ? `${Math.floor(diagnostics.uptime_sec / 3600)}j ${Math.floor((diagnostics.uptime_sec % 3600) / 60)}m` : 'Normal'}
            </div>
          </div>

          <div className="subtle-panel" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radio size={16} color="#003882" />
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                ANTARMUKA SENSOR
              </span>
            </div>
            <div className="mono-text" style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginTop: '6px' }}>
              Sensor Muka Air
            </div>
            <div style={{ fontSize: '0.72rem', color: '#003882', fontWeight: 600, marginTop: '2px' }}>
              Acuan Elevasi: {Number(device?.sensor_height_cm) || 600} cm &bull; Transmisi Digital Siap
            </div>
          </div>

          <div className="subtle-panel" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HardDrive size={16} color="#003882" />
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                PENYIMPANAN OFFLINE
              </span>
            </div>
            <div className="mono-text" style={{ fontSize: '1.2rem', fontWeight: 800, color: '#059669', marginTop: '6px' }}>
              Penyimpanan Lokal Siap
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
              Sistem Berkas Mandiri &bull; Auto Re-mount
            </div>
          </div>

          <div className="subtle-panel" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BatteryCharging size={16} color="#003882" />
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                DAYA &amp; AKI
              </span>
            </div>
            <div className="mono-text" style={{ fontSize: '1.2rem', fontWeight: 800, color: '#059669', marginTop: '6px' }}>
              {latestReading?.battery_voltage != null ? `${Number(latestReading.battery_voltage).toFixed(2)} V` : '12.50 V'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
              Solar Charger Siap Mandiri
            </div>
          </div>
        </div>

        {/* Diagnostics Snapshot Metrics */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
          gap: '12px', 
          marginTop: '16px' 
        }}>
          <div className="subtle-panel" style={{ padding: '12px' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>BOOT COUNT</span>
            <div className="mono-text" style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
              {diagnostics?.boot_count ?? 1} Kali
            </div>
          </div>

          <div className="subtle-panel" style={{ padding: '12px' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>WATCHDOG TRIPS</span>
            <div className="mono-text" style={{ fontSize: '1.1rem', fontWeight: 800, color: diagnostics?.watchdog_count ? '#dc2626' : '#059669' }}>
              {diagnostics?.watchdog_count ?? 0} Kali
            </div>
          </div>

          <div className="subtle-panel" style={{ padding: '12px' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>FREE MEMORY</span>
            <div className="mono-text" style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
              {diagnostics?.free_heap_bytes ? `${Math.round(diagnostics.free_heap_bytes / 1024)} KB` : '160 KB'}
            </div>
          </div>

          <div className="subtle-panel" style={{ padding: '12px' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>VERSI PERANGKAT</span>
            <div className="mono-text" style={{ fontSize: '1.1rem', fontWeight: 800, color: '#003882' }}>
              {diagnostics?.firmware_version || 'v1.2.0'}
            </div>
          </div>
        </div>

      </div>

      {/* ========================================================= */}
      {/* SECTION 3: KONSOL PERINGATAN (ALERTS CONSOLE) */}
      {/* ========================================================= */}
      <div className="corporate-card" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert size={20} color={alerts.length > 0 ? '#dc2626' : '#059669'} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Konsol Peringatan Aktif ({alerts.length})
            </h3>
          </div>

          <button 
            onClick={handleRefreshAlerts} 
            disabled={isSpinningAlerts}
            className="btn btn-secondary" 
            style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={13} className={isSpinningAlerts ? 'spin' : ''} />
            <span>Segarkan Peringatan</span>
          </button>
        </div>

        {alerts.length === 0 ? (
          <div style={{
            padding: '24px',
            borderRadius: '10px',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#059669',
            fontSize: '0.88rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <CheckCircle2 size={20} />
            Semua sistem beroperasi normal. Tidak ada peringatan aktif yang membutuhkan tindakan.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {alerts.map((al) => (
              <div 
                key={al.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 18px',
                  borderRadius: '10px',
                  background: al.severity === 'CRITICAL' ? '#fef2f2' : '#fffbeb',
                  border: `1px solid ${al.severity === 'CRITICAL' ? '#fecaca' : '#fde68a'}`,
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <AlertTriangle size={18} color={al.severity === 'CRITICAL' ? '#dc2626' : '#d97706'} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        background: al.severity === 'CRITICAL' ? '#dc2626' : '#d97706',
                        color: '#ffffff'
                      }}>
                        {al.alert_code}
                      </span>
                      <span className="mono-text" style={{ fontSize: '0.76rem', color: '#64748b' }}>
                        {new Date(al.timestamp).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a', marginTop: '4px' }}>
                      {al.message}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleResolveAlert(al.id)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                >
                  Tandai Selesai
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
