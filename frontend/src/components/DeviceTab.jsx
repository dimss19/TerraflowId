import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import TestModeTab from './TestModeTab';
import { 
  Sliders, 
  Save, 
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
  Info,
  Play,
  Square,
  Zap,
  Timer,
  Terminal,
  Trash2,
  Droplet
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
    slope: 1.0
  });

  const [loadingCalib, setLoadingCalib] = useState(false);
  const [calibFeedback, setCalibFeedback] = useState(null);
  const [activeInfoField, setActiveInfoField] = useState(null);

  const calibInfoDescriptions = {
    sensor_height: {
      title: 'Tinggi Sensor ke Dasar Sungai / Peil Nol (cm)',
      image: '/sensor-calibration-diagram.jpg',
      desc: 'Jarak fisik vertikal dari bibir bawah sensor ultrasonik A16 sampai ke dasar sungai / datum nol meter peil schaal. Nilai ini menjadi tinggi acuan statis di server web untuk mengonversi data jarak mentah menjadi Tinggi Muka Air (TMA).',
      example: 'TMA = Tinggi Sensor Acuan (H) - Jarak Sensor ke Air (D). Contoh: Diukur dengan meteran dari bibir sensor ke dasar sungai adalah 600 cm (6.00 m). Jika sensor mendeteksi jarak muka air 420 cm, maka Ketinggian Air = 600 - 420 = 180 cm (1.80 m).'
    },
    offset: {
      title: 'Offset Elevasi (cm)',
      image: '/offset-calibration-diagram.jpg',
      desc: 'Nilai koreksi tetap (+ atau -) untuk mengompensasi pergeseran datum atau deviasi pembacaan awal (zero-point error). Digunakan jika hasil pembacaan sensor memiliki selisih tetap terhadap mistar ukur fisik / peil schaal acuan.',
      example: 'Gunakan nilai (+) jika pembacaan sensor lebih rendah dari acuan (contoh: 138.8 cm vs 140.0 cm -> offset +1.2 cm). Gunakan nilai (-) jika pembacaan sensor lebih tinggi dari acuan (contoh: 141.2 cm vs 140.0 cm -> offset -1.2 cm).'
    },
    slope: {
      title: 'Faktor Pengali (Slope)',
      image: '/slope-calibration-diagram.jpg',
      desc: 'Koefisien linear untuk menyesuaikan skala jarak gelombang sensor jika kesalahan (error) bertambah seiring jarak akibat propagasi gelombang atau temperatur udara.',
      example: 'Rumus: Jarak Terkoreksi = Jarak Sensor × Slope. Nilai default adalah 1.0000. Biarkan default kecuali pengujian kalibrasi multi-titik membuktikan adanya deviasi skala yang meregang.'
    }
  };

  // --- Diagnostics & Alerts State ---
  const [alerts, setAlerts] = useState([]);
  const [diagnostics, setDiagnostics] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [isSpinningAlerts, setIsSpinningAlerts] = useState(false);

  // --- Sampling Interval & Duty Cycle State ---
  const [selectedInterval, setSelectedInterval] = useState(900);
  const [loadingInterval, setLoadingInterval] = useState(false);
  const [intervalFeedback, setIntervalFeedback] = useState(null);

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
      if (device.sampling_interval_sec) {
        setSelectedInterval(Number(device.sampling_interval_sec));
      }
      fetchAlerts();
      fetchDiagnostics();
    }
  }, [device, isAdmin]);

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

  // Calibration calculations: based on latest reading
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
        setCalibFeedback({ type: 'success', text: 'Parameter konfigurasi sensor berhasil disimpan di server.' });
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

  const handleSaveInterval = async () => {
    if (!device?.device_id) return;
    setLoadingInterval(true);
    setIntervalFeedback(null);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await fetch(`/api/devices/${device.device_id}/interval`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ sampling_interval_sec: selectedInterval })
      });
      const json = await res.json();
      if (json.success) {
        setIntervalFeedback({ type: 'success', text: json.message });
        if (onActionTriggered) onActionTriggered('interval_updated');
      } else {
        setIntervalFeedback({ type: 'error', text: json.error || 'Gagal mengubah interval' });
      }
    } catch (err) {
      setIntervalFeedback({ type: 'error', text: err.message });
    } finally {
      setLoadingInterval(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* ========================================================= */}
      {/* SECTION 0: MONITOR DATA MENTAH & MODE UJI 1 DETIK (ADMIN) */}
      {/* ========================================================= */}
      {isAdmin && (
        <TestModeTab 
          device={device}
          authToken={authToken}
          currentUser={currentUser}
          onRefresh={onCalibrationUpdated}
        />
      )}

      {/* ========================================================= */}
      {/* SECTION 1: KALIBRASI SENSOR AWLR (KHUSUS ADMINISTRATOR)   */}
      {/* ========================================================= */}
      {/* ========================================================= */}
      {isAdmin && (
        <div className="corporate-card" style={{ padding: '28px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: '#edf2fc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#003882'
              }}>
                <Sliders size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Konfigurasi Parameter Sensor &amp; Hidrometri
                </h2>
                <p style={{ fontSize: '0.84rem', color: '#64748b', marginTop: '3px', marginBottom: 0 }}>
                  Penetapan tinggi acuan fisik tiang sensor ke dasar sungai sebagai basis kalkulasi Tinggi Muka Air (TMA)
                </p>
              </div>
            </div>
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
            <span>ATURAN SERVER AKTIF</span>
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


        {/* Calibration Inputs & Real-time Live Simulator Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', 
          gap: '24px', 
          marginTop: '24px' 
        }}>
          
          {/* Left: Calibration Form */}
          <form onSubmit={handleCalibrationSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Input 1: Tinggi Acuan Sensor ke Dasar Sungai */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '18px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Tinggi Sensor ke Dasar Sungai (Tinggi Acuan H)
                </label>
                <button
                  type="button"
                  onClick={() => setActiveInfoField('sensor_height')}
                  title="Klik untuk melihat panduan pengukuran"
                  style={{
                    background: '#e0f2fe',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#0284c7',
                    cursor: 'pointer',
                    padding: '3px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 700
                  }}
                >
                  <HelpCircle size={13} />
                  <span>Panduan</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type="number"
                    step="0.1"
                    min="10"
                    max="3000"
                    className="corporate-input"
                    style={{ paddingRight: '48px', fontSize: '1.15rem', fontWeight: 800, color: '#003882' }}
                    value={formData.sensor_height_cm}
                    onChange={(e) => setFormData({ ...formData, sensor_height_cm: e.target.value })}
                    required
                  />
                  <span style={{
                    position: 'absolute',
                    right: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    color: '#64748b'
                  }}>
                    cm
                  </span>
                </div>
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '9px 12px',
                  whiteSpace: 'nowrap',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#003882'
                }}>
                  = {((Number(formData.sensor_height_cm) || 0) / 100).toFixed(2)} m
                </div>
              </div>

              <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.45, marginTop: '8px' }}>
                Ukur jarak tegak lurus dengan meteran dari bibir bawah sensor ultrasonik A16 ke dasar sungai atau datum nol meter peil schaal saat tiang terpasang.
              </div>
            </div>

            {/* Input 2 & 3: Offset & Slope */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '18px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Penyesuaian Tambahan (Opsional)
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                      Offset Elevasi (cm)
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveInfoField('offset')}
                      style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', padding: '2px' }}
                    >
                      <HelpCircle size={14} />
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
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginTop: '4px' }}>
                    Koreksi mistar (default: 0.0)
                  </span>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                      Faktor Pengali (Slope)
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveInfoField('slope')}
                      style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', padding: '2px' }}
                    >
                      <HelpCircle size={14} />
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
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginTop: '4px' }}>
                    Faktor skala (default: 1.0000)
                  </span>
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loadingCalib} 
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '4px',
                padding: '12px 24px',
                fontWeight: 700,
                fontSize: '0.9rem'
              }}
            >
              <Save size={16} />
              <span>{loadingCalib ? 'Menyimpan Parameter ke Server...' : 'Simpan Konfigurasi Sensor'}</span>
            </button>
          </form>

          {/* Right: Live Calculation Simulation Panel with Dynamic Diagram */}
          <div className="subtle-panel" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#003882' }}>
                <Calculator size={18} />
                <span style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Simulasi Hidrometri Real-Time
                </span>
              </div>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                background: '#e0f2fe',
                color: '#0284c7',
                padding: '3px 8px',
                borderRadius: '6px'
              }}>
                LIVE PREVIEW
              </span>
            </div>

            {/* Interactive SVG Diagram */}
            {(() => {
              const clampedLevel = Math.max(0, Math.min(simHeight, simCalcLevel));
              const waterRatio = simHeight > 0 ? (clampedLevel / simHeight) : 0.3;
              const waterSvgY = Math.round(180 - (waterRatio * 140));

              return (
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '12px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <svg viewBox="0 0 260 210" style={{ width: '100%', maxWidth: '280px', height: '170px' }}>
                    {/* Riverbed / Dasar Sungai */}
                    <rect x="20" y="180" width="220" height="24" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1" rx="4" />
                    <text x="130" y="196" textAnchor="middle" fontSize="9" fontWeight="800" fill="#64748b">
                      DASAR SUNGAI (DATUM 0 CM)
                    </text>

                    {/* Pole Tiang */}
                    <line x1="42" y1="20" x2="42" y2="180" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
                    <line x1="42" y1="28" x2="75" y2="28" stroke="#64748b" strokeWidth="3" />

                    {/* Sensor Head A16 */}
                    <rect x="62" y="22" width="26" height="15" rx="3" fill="#0f172a" stroke="#1e293b" strokeWidth="1" />
                    <text x="75" y="16" textAnchor="middle" fontSize="8" fontWeight="800" fill="#475569">
                      SENSOR A16
                    </text>

                    {/* Water Body */}
                    <rect 
                      x="26" 
                      y={waterSvgY} 
                      width="208" 
                      height={Math.max(0, 180 - waterSvgY)} 
                      fill="rgba(14, 165, 233, 0.22)" 
                      stroke="#0284c7" 
                      strokeWidth="1.5" 
                      rx="2" 
                    />
                    <text 
                      x="130" 
                      y={Math.min(172, Math.max(waterSvgY + 16, 150))} 
                      textAnchor="middle" 
                      fontSize="10" 
                      fontWeight="800" 
                      fill="#0369a1"
                    >
                      Ketinggian Air: {simCalcLevel.toFixed(1)} cm ({(simCalcLevel / 100).toFixed(2)} m)
                    </text>

                    {/* Ultrasonic Beam (D) */}
                    <line x1="75" y1="37" x2="75" y2={waterSvgY} stroke="#0284c7" strokeWidth="1.5" strokeDasharray="3,3" />
                    <text x="82" y={Math.max(48, Math.round((37 + waterSvgY) / 2))} fontSize="9" fontWeight="700" fill="#0284c7">
                      D = {rawDist.toFixed(1)} cm
                    </text>

                    {/* Total Reference Height Line (H) */}
                    <line x1="228" y1="28" x2="228" y2="180" stroke="#003882" strokeWidth="1.5" />
                    <line x1="223" y1="28" x2="233" y2="28" stroke="#003882" strokeWidth="1.5" />
                    <line x1="223" y1="180" x2="233" y2="180" stroke="#003882" strokeWidth="1.5" />
                    <text 
                      x="222" 
                      y="105" 
                      textAnchor="end" 
                      fontSize="9" 
                      fontWeight="800" 
                      fill="#003882"
                    >
                      H = {simHeight.toFixed(0)} cm
                    </text>
                  </svg>
                </div>
              );
            })()}

            {/* Arithmetic Breakdown */}
            <div style={{
              background: '#eff6ff',
              borderRadius: '10px',
              border: '1px solid #bfdbfe',
              padding: '14px 16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#003882', textTransform: 'uppercase' }}>
                  HASIL SIMULASI TINGGI MUKA AIR (TMA)
                </span>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  Raw Distance: <strong>{rawDist.toFixed(1)} cm</strong>
                </span>
              </div>

              <div className="mono-text" style={{ fontSize: '1.6rem', fontWeight: 800, color: '#003882', marginTop: '6px' }}>
                {simCalcLevel.toFixed(1)} <span style={{ fontSize: '0.95rem', color: '#003882' }}>cm</span>
                <span style={{ fontSize: '0.9rem', color: '#0284c7', marginLeft: '8px' }}>
                  ({(simCalcLevel / 100).toFixed(2)} m)
                </span>
              </div>

              <div style={{
                fontSize: '0.76rem',
                color: '#334155',
                marginTop: '8px',
                paddingTop: '8px',
                borderTop: '1px dashed #bfdbfe'
              }}>
                Rincian: {simHeight.toFixed(1)} cm &minus; ({rawDist.toFixed(1)} &times; {simSlope} + {simOffset}) = <strong>{simCalcLevel.toFixed(1)} cm</strong>
              </div>
            </div>

            {/* Comparison with Active Config */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '0.78rem'
            }}>
              <div>
                <span style={{ color: '#64748b' }}>Nilai Aktif Server Saat Ini: </span>
                <strong style={{ color: '#0f172a' }}>{currentCalcLevel.toFixed(1)} cm ({(currentCalcLevel / 100).toFixed(2)} m)</strong>
              </div>
              <div style={{ 
                fontWeight: 700, 
                color: deltaLevel > 0 ? '#059669' : deltaLevel < 0 ? '#d97706' : '#64748b' 
              }}>
                Selisih: {deltaLevel > 0 ? `+${deltaLevel}` : deltaLevel} cm
              </div>
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

        {/* Keterangan Parameter Aktif */}
        {device?.updated_at && (
          <div style={{
            marginTop: '20px',
            paddingTop: '14px',
            borderTop: '1px solid #f1f5f9',
            fontSize: '0.78rem',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Info size={14} color="#003882" />
            <span>Konfigurasi Aktif di Server &bull; Terakhir diperbarui: <strong>{new Date(device.updated_at).toLocaleString('id-ID')} WIB</strong></span>
          </div>
        )}

      </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 2: INTERVAL PEMBACAAN & SIKLUS DAYA (DUTY CYCLE)  */}
      {/* ========================================================= */}
      <div className="corporate-card" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: '#e0f2fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0284c7'
            }}>
              <Activity size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Interval Pembacaan &amp; Siklus Daya (Deep Sleep Duty Cycle)
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#64748b', marginTop: '3px', marginBottom: 0 }}>
                Pengaturan interval sampling sensor dan transmisi telemetri. Perubahan disinkronkan ke mikrokontroler via <strong>MQTT Retained Message</strong>.
              </p>
            </div>
          </div>

          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '0.78rem',
            color: '#64748b'
          }}>
            Status Aktif di Alat: <strong style={{ color: '#003882' }}>
              {(() => {
                const cur = device?.sampling_interval_sec || 900;
                return cur >= 3600 ? `${cur / 3600} Jam` : cur >= 60 ? `${cur / 60} Menit` : `${cur} Detik`;
              })()}
            </strong>
          </div>
        </div>

        {/* Feedback message */}
        {intervalFeedback && (
          <div style={{
            marginTop: '18px',
            padding: '12px 16px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.85rem',
            fontWeight: 600,
            background: intervalFeedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${intervalFeedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            color: intervalFeedback.type === 'success' ? '#059669' : '#dc2626'
          }}>
            {intervalFeedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{intervalFeedback.text}</span>
          </div>
        )}

        {/* Preset Selector Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '14px',
          marginTop: '20px'
        }}>
          {[
            { sec: 60, title: '1 Menit', sub: 'Mode Uji / Kalibrasi', battery: 'Mode Cepat' },
            { sec: 900, title: '15 Menit', sub: 'Standar AWLR Hidrologi', battery: 'Optimal (Rekomendasi)', recommended: true },
            { sec: 1800, title: '30 Menit', sub: 'Mode Hemat Daya', battery: 'Hemat Baterai' },
            { sec: 3600, title: '1 Jam', sub: 'Ultra Hemat Daya', battery: 'Ultra Hemat' },
            { sec: 7200, title: '2 Jam', sub: 'Siaga Panjang', battery: 'Maksimum Daya' }
          ].map((item) => {
            const isSelected = selectedInterval === item.sec;
            return (
              <div
                key={item.sec}
                onClick={() => setSelectedInterval(item.sec)}
                style={{
                  border: isSelected ? '2px solid #0284c7' : '1px solid #e2e8f0',
                  background: isSelected ? '#f0f9ff' : '#ffffff',
                  borderRadius: '12px',
                  padding: '16px',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? '0 4px 12px rgba(2, 132, 199, 0.15)' : 'none'
                }}
              >
                {item.recommended && (
                  <span style={{
                    position: 'absolute',
                    top: '-10px',
                    right: '12px',
                    background: '#0284c7',
                    color: '#ffffff',
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    letterSpacing: '0.5px'
                  }}>
                    REKOMENDASI
                  </span>
                )}
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: isSelected ? '#0369a1' : '#0f172a' }}>
                  {item.title}
                </div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginTop: '2px' }}>
                  {item.sub}
                </div>
                <div style={{
                  marginTop: '10px',
                  paddingTop: '8px',
                  borderTop: '1px solid #f1f5f9',
                  fontSize: '0.72rem',
                  color: isSelected ? '#0284c7' : '#94a3b8'
                }}>
                  Efisiensi: <strong>{item.battery}</strong>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginTop: '22px' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', maxWidth: '580px' }}>
            ℹ️ Konfigurasi disimpan di broker dengan status <strong>MQTT Retain</strong>. Begitu perangkat bangun dari Deep Sleep pada siklus berikutnya, interval ini otomatis diterapkan.
          </div>

          <button
            onClick={handleSaveInterval}
            disabled={loadingInterval}
            className="btn btn-primary"
            style={{
              padding: '10px 24px',
              fontSize: '0.88rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Save size={16} />
            <span>{loadingInterval ? 'Meneruskan ke Broker...' : 'Terapkan Interval via MQTT'}</span>
          </button>
        </div>

        {/* Remote Command Console */}
        <div style={{
          marginTop: '24px',
          paddingTop: '18px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>Konsol Kendali Jarak Jauh (Remote Command)</div>
            <div style={{ fontSize: '0.76rem', color: '#64748b' }}>Perintah eksekusi langsung ke perangkat saat online</div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => handleRemoteCommand('Restart Perangkat', `/api/devices/${device.device_id}/restart`)}
              disabled={loadingAction}
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RotateCcw size={14} />
              <span>Restart Alat Lapangan</span>
            </button>
            <button
              onClick={() => handleRemoteCommand('Sinkronisasi SD Card', `/api/devices/${device.device_id}/sync`)}
              disabled={loadingAction}
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <HardDriveDownload size={14} />
              <span>Tarik Log SD Card (Sync)</span>
            </button>
          </div>
        </div>

        {actionFeedback && (
          <div style={{
            marginTop: '12px',
            padding: '8px 14px',
            borderRadius: '6px',
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            fontSize: '0.8rem',
            color: '#334155'
          }}>
            {actionFeedback}
          </div>
        )}
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
