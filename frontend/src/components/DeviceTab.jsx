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
  RotateCcw,
  HardDriveDownload,
  Check,
  AlertTriangle,
  Activity,
  HelpCircle,
  X,
  Info
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
  const [activeInfoField, setActiveInfoField] = useState(null);

  const calibInfoDescriptions = {
    sensor_height: {
      title: 'Tinggi Sensor Dari Dasar Referensi (cm)',
      image: '/sensor-calibration-diagram.jpg',
      desc: 'Ilustrasi teknis pengukuran hidrometri Automatic Water Level Recorder (AWLR): Tinggi Muka Air (TMA) dihitung dari selisih Tinggi Sensor ke Dasar dikurangi Jarak Sensor ke Permukaan Air.',
      example: 'TMA = Tinggi Sensor dari Dasar - Jarak Sensor ke Air. Contoh: Jika tinggi sensor 615 cm dan jarak sensor ke air 200 cm, maka TMA = 415 cm (4.15 m).'
    },
    offset: {
      title: 'Offset Elevasi (cm)',
      image: '/offset-calibration-diagram.jpg',
      desc: 'Nilai koreksi tetap (+ atau -) untuk mengompensasi pergeseran datum atau deviasi pembacaan awal (zero-point error). Digunakan jika hasil pembacaan sensor tidak sama persis dengan mistar ukur fisik / peil schaal acuan.',
      example: 'Gunakan nilai (+) jika pembacaan sensor lebih rendah dari acuan (contoh: 138.8 cm vs 140.0 cm -> offset +1.2 cm). Gunakan nilai (-) jika pembacaan sensor lebih tinggi dari acuan (contoh: 141.2 cm vs 140.0 cm -> offset -1.2 cm).'
    },
    slope: {
      title: 'Faktor Pengali (Slope)',
      image: '/slope-calibration-diagram.jpg',
      desc: 'Koefisien linear untuk menyesuaikan skala jarak gelombang sensor jika kesalahan (error) bertambah seiring jarak akibat propagasi gelombang atau temperatur udara.',
      example: 'Rumus: Jarak Terkoreksi = Jarak Sensor × Slope. Nilai default adalah 1.0000. Biarkan default kecuali pengujian beberapa titik jarak (minimal 2-3 titik) membuktikan adanya galat skala yang meregang.'
    },
    applied_by: {
      title: 'Nama Petugas / Teknisi',
      desc: 'Identitas personel yang bertanggung jawab melakukan kalibrasi dan validasi fisik di lapangan untuk keperluan audit trail / riwayat pemeliharaan.',
      example: 'Contoh: Teknisi AWLR / Tim Hidrologi Pos B'
    },
    notes: {
      title: 'Catatan Perubahan',
      desc: 'Keterangan alasan pembaruan kalibrasi (misal: perawatan rutin, penggantian bracket sensor, atau penyesuaian peil pasca banjir).',
      example: 'Contoh: Penyesuaian pasca perbaikan bracket tiang penyangga.'
    }
  };

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
    if (!device?.device_id) return;
    try {
      const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
      const res = await fetch(`/api/calibration/${device.device_id}/history`, { headers });
      const json = await res.json();
      if (json.success) {
        setCalibHistory(json.data);
      }
    } catch (e) {
      console.error('Error fetching calibration history:', e);
    }
  };

  const fetchAlerts = async () => {
    if (!device?.device_id) return;
    try {
      const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
      const res = await fetch(`/api/alerts/${device.device_id}?status=active`, { headers });
      const json = await res.json();
      if (json.success) {
        setAlerts(json.data);
      }
    } catch (e) {
      console.error('Error fetching alerts:', e);
    }
  };

  const fetchDiagnostics = async () => {
    if (!device?.device_id) return;
    try {
      const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
      const res = await fetch(`/api/diagnostics/${device.device_id}`, { headers });
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                  TINGGI SENSOR DARI DASAR REFERENSI (CM)
                </label>
                <button
                  type="button"
                  onClick={() => setActiveInfoField('sensor_height')}
                  title="Klik untuk melihat penjelasan detail"
                  style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                >
                  <HelpCircle size={15} />
                </button>
              </div>
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
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                    OFFSET ELEVASI (CM)
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveInfoField('offset')}
                    title="Klik untuk melihat penjelasan detail"
                    style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                  >
                    <HelpCircle size={15} />
                  </button>
                </div>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                    FAKTOR PENGALI (SLOPE)
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveInfoField('slope')}
                    title="Klik untuk melihat penjelasan detail"
                    style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                  >
                    <HelpCircle size={15} />
                  </button>
                </div>
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                  NAMA PETUGAS / TEKNISI
                </label>
                <button
                  type="button"
                  onClick={() => setActiveInfoField('applied_by')}
                  title="Klik untuk melihat penjelasan detail"
                  style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                >
                  <HelpCircle size={15} />
                </button>
              </div>
              <input
                type="text"
                className="corporate-input"
                value={formData.applied_by}
                onChange={(e) => setFormData({ ...formData, applied_by: e.target.value })}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                  CATATAN PERUBAHAN
                </label>
                <button
                  type="button"
                  onClick={() => setActiveInfoField('notes')}
                  title="Klik untuk melihat penjelasan detail"
                  style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                >
                  <HelpCircle size={15} />
                </button>
              </div>
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

        {/* Info Modal / Popup Penjelasan Kalibrasi */}
        {activeInfoField && calibInfoDescriptions[activeInfoField] && (
          <div 
            onClick={() => setActiveInfoField(null)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.45)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '16px'
            }}
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#ffffff',
                borderRadius: '14px',
                maxWidth: calibInfoDescriptions[activeInfoField].image ? '680px' : '480px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '24px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                border: '1px solid #e2e8f0',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ background: '#e0f2fe', color: '#0284c7', padding: '8px', borderRadius: '10px' }}>
                    <Info size={20} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a' }}>
                      {calibInfoDescriptions[activeInfoField].title}
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Panduan Parameter Lapangan</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveInfoField(null)}
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px',
                    cursor: 'pointer',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Render Image if Available */}
              {calibInfoDescriptions[activeInfoField].image && (
                <div style={{ marginTop: '16px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#0f172a' }}>
                  <img 
                    src={calibInfoDescriptions[activeInfoField].image} 
                    alt="Diagram Kalibrasi Sensor" 
                    style={{ width: '100%', height: 'auto', display: 'block' }} 
                  />
                </div>
              )}

              <div style={{ marginTop: '16px', fontSize: '0.86rem', color: '#334155', lineHeight: 1.6 }}>
                {calibInfoDescriptions[activeInfoField].desc}
              </div>

              <div style={{
                marginTop: '16px',
                padding: '12px 14px',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '0.78rem',
                color: '#475569'
              }}>
                <strong style={{ color: '#0f172a' }}>Petunjuk Praktis:</strong>
                <p style={{ margin: '4px 0 0 0' }}>{calibInfoDescriptions[activeInfoField].example}</p>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setActiveInfoField(null)}
                  className="btn btn-primary"
                  style={{ padding: '8px 20px', fontSize: '0.82rem' }}
                >
                  Mengerti
                </button>
              </div>
            </div>
          </div>
        )}

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
