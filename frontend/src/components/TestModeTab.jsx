import React, { useState, useEffect, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import { 
  Radio, 
  Play, 
  Square, 
  Timer, 
  Terminal, 
  Trash2, 
  Download, 
  Volume2, 
  VolumeX, 
  AlertCircle, 
  CheckCircle2, 
  Activity, 
  Cpu, 
  Wifi, 
  Thermometer, 
  ShieldAlert, 
  Waves,
  Target,
  Compass,
  Sliders,
  Save,
  Check,
  Award,
  CheckSquare,
  Power,
  Moon,
  Zap
} from 'lucide-react';

export default function TestModeTab({ 
  device, 
  authToken, 
  currentUser, 
  onRefresh 
}) {
  const isAdmin = currentUser?.role === 'admin';
  const currentHeight = Number(device?.sensor_height_cm) || 600.0;

  // --- Remote Power & Sleep Testing State ---
  const [loadingPower, setLoadingPower] = useState(false);
  const [loadingSleep, setLoadingSleep] = useState(false);
  const [powerFeedback, setPowerFeedback] = useState(null);

  // --- Test Mode State ---
  const [isTestMode, setIsTestMode] = useState(false);
  const [testRemainingSec, setTestRemainingSec] = useState(0);
  const [selectedDuration, setSelectedDuration] = useState(300); // Default: 5 menit (300 detik)
  const [loadingTestMode, setLoadingTestMode] = useState(false);
  const [testModeFeedback, setTestModeFeedback] = useState(null);

  // --- Alignment & Calibration Wizard State ---
  const [savingCalibration, setSavingCalibration] = useState(false);
  const [calibrationSuccess, setCalibrationSuccess] = useState(null);
  const [showChecklist, setShowChecklist] = useState(false);

  // --- Real-time Stream & Logs State ---
  const [liveRawReading, setLiveRawReading] = useState(null);
  const [prevReading, setPrevReading] = useState(null);
  const [rawStreamLog, setRawStreamLog] = useState([]);
  const [isLogPaused, setIsLogPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);

  // --- Session Metrics ---
  const [sessionFrameCount, setSessionFrameCount] = useState(0);

  // Refs for stable callbacks
  const isLogPausedRef = useRef(false);
  isLogPausedRef.current = isLogPaused;
  const soundEnabledRef = useRef(false);
  soundEnabledRef.current = soundEnabled;
  const lastReadingKeyRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Sound beep on packet arrival using Web Audio API
  const playBeep = () => {
    if (!soundEnabledRef.current) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // 880 Hz (A5)
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (_) {}
  };

  // 1. Initial Fetch of current test mode status & recent test readings
  useEffect(() => {
    if (!device?.device_id) return;

    let isMounted = true;
    const fetchStatusAndHistory = async () => {
      try {
        const headers = {};
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

        // Cek status aktif test mode
        const resStatus = await fetch(`/api/devices/${device.device_id}/test-mode`, { headers });
        const jsonStatus = await resStatus.json();
        if (isMounted && jsonStatus.success) {
          setIsTestMode(Boolean(jsonStatus.active));
          setTestRemainingSec(jsonStatus.remaining_sec || 0);
          if (jsonStatus.duration_sec) {
            setSelectedDuration(jsonStatus.duration_sec);
          }
        }

        // Ambil riwayat frame terbaru jika ada
        const resReadings = await fetch(`/api/devices/${device.device_id}/test-readings?limit=40`, { headers });
        const jsonReadings = await resReadings.json();
        if (isMounted && jsonReadings.success && Array.isArray(jsonReadings.readings)) {
          if (jsonReadings.readings.length > 0) {
            setLiveRawReading(jsonReadings.readings[0]);
            setRawStreamLog(jsonReadings.readings);
            setSessionFrameCount(jsonReadings.readings.length);
          }
        }
      } catch (err) {
        console.warn('[TestModeTab] Init fetch error:', err.message);
      }
    };

    fetchStatusAndHistory();
    return () => {
      isMounted = false;
    };
  }, [device?.device_id, authToken]);

  // 2. Socket.IO Real-Time Stream Listener (with packet deduplication)
  useEffect(() => {
    if (!device?.device_id) return;

    const socket = io('/', {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });

    const matchesThisDev = (id) => {
      if (!id || !device.device_id) return false;
      return id === device.device_id || id.replace(/\s+/g, '-') === device.device_id.replace(/\s+/g, '-');
    };

    const handleData = (payload) => {
      if (!payload) return;
      const dId = payload.device_id || payload.data?.device_id;
      const data = payload.data || payload;

      if (!matchesThisDev(dId)) return;

      // Deduplikasi paket agar tidak dobel karena multiple socket event
      const packetKey = `${dId}-${data.timestamp || ''}-${data.reading_count || data.raw_distance_cm || ''}`;
      if (lastReadingKeyRef.current === packetKey) return;
      lastReadingKeyRef.current = packetKey;

      playBeep();

      setLiveRawReading((prev) => {
        setPrevReading(prev);
        return data;
      });

      setSessionFrameCount((c) => c + 1);

      if (!isLogPausedRef.current) {
        setRawStreamLog((prev) => {
          const row = {
            id: data.id || Math.random().toString(36).substring(7),
            timestamp: data.timestamp || new Date().toISOString(),
            raw_distance_cm: data.raw_distance_cm,
            raw_distance_mm: data.raw_distance_mm || (data.raw_distance_cm != null ? Math.round(Number(data.raw_distance_cm) * 10) : null),
            filtered_distance_cm: data.filtered_distance_cm || data.raw_distance_cm,
            water_level_cm: data.water_level_cm,
            temperature_c: data.temperature_c,
            spread_cm: data.spread_cm,
            valid_samples: data.valid_samples,
            signal_quality: data.signal_quality,
            source: data.source || (data.is_test ? 'test' : 'live'),
            is_blind_spot: data.is_blind_spot || (data.raw_distance_cm != null && Number(data.raw_distance_cm) <= 50.0)
          };
          return [row, ...prev].slice(0, 60); // Simpan 60 frame (1 menit penuh pengujian)
        });
      }
    };

    socket.on('telemetry', handleData);
    socket.on('sensor:data', handleData);
    socket.on('test:reading', (res) => {
      if (matchesThisDev(res?.device_id)) {
        handleData(res.data);
      }
    });

    socket.on('device:test_mode', (res) => {
      if (matchesThisDev(res?.deviceId || res?.device_id)) {
        const active = Boolean(res.data?.test_mode);
        setIsTestMode(active);
        if (active) {
          setTestRemainingSec(res.data?.duration_sec || 300);
        } else {
          setTestRemainingSec(0);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [device?.device_id]); // soundEnabled dibaca via Ref agar toggle suara tidak memutus koneksi Socket.IO

  // 3. Countdown Timer Tick
  useEffect(() => {
    if (!isTestMode || testRemainingSec <= 0) return;
    const interval = setInterval(() => {
      setTestRemainingSec((prev) => {
        if (prev <= 1) {
          setIsTestMode(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isTestMode, testRemainingSec]);

  // 4. Toggle Test Mode Action
  const handleToggleTestMode = async (enable, overrideDuration) => {
    if (!device?.device_id) return;
    setLoadingTestMode(true);
    setTestModeFeedback(null);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const dur = enable ? (overrideDuration || selectedDuration) : 0;
      if (overrideDuration) {
        setSelectedDuration(overrideDuration);
      }
      const res = await fetch(`/api/devices/${device.device_id}/test-mode`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ enabled: enable, duration_sec: dur })
      });
      const json = await res.json();
      if (json.success) {
        setIsTestMode(enable);
        setTestRemainingSec(enable ? dur : 0);
        setTestModeFeedback({ 
          type: 'success', 
          text: json.message || (enable ? `Mode uji 1 detik aktif (${dur} detik)!` : 'Mode uji dinonaktifkan') 
        });
        if (enable) {
          // Kosongkan log lama agar fokus ke pengujian baru
          setSessionFrameCount(0);
        }
      } else {
        setTestModeFeedback({ type: 'error', text: json.error || 'Gagal mengubah mode test' });
      }
    } catch (err) {
      setTestModeFeedback({ type: 'error', text: err.message });
    } finally {
      setLoadingTestMode(false);
      setTimeout(() => setTestModeFeedback(null), 7000);
    }
  };

  // 4b. Kontrol Manual Daya Sensor DYP-A16 (High-Side Switch GPIO 9)
  const handleSetSensorPower = async (powerOn) => {
    if (!device?.device_id) return;
    setLoadingPower(true);
    setPowerFeedback(null);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await fetch(`/api/devices/${device.device_id}/sensor-power`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ power: powerOn })
      });
      const json = await res.json();
      if (json.success) {
        setPowerFeedback({
          type: 'success',
          text: json.message || `Daya sensor (${powerOn ? 'ON' : 'OFF'}) berhasil dikirim.`
        });
      } else {
        setPowerFeedback({
          type: 'error',
          text: json.error || 'Gagal mengubah daya sensor'
        });
      }
    } catch (err) {
      setPowerFeedback({ type: 'error', text: err.message });
    } finally {
      setLoadingPower(false);
      setTimeout(() => setPowerFeedback(null), 5000);
    }
  };

  // 4c. Uji Masuk Mode Hemat Daya Deep Sleep
  const handleTriggerSleep = async () => {
    if (!device?.device_id) return;
    if (!window.confirm('Kirim perintah masuk Deep Sleep sekarang ke ESP32?')) return;
    setLoadingSleep(true);
    setPowerFeedback(null);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await fetch(`/api/devices/${device.device_id}/sleep`, {
        method: 'POST',
        headers
      });
      const json = await res.json();
      if (json.success) {
        setPowerFeedback({
          type: 'success',
          text: json.message || 'Perintah Deep Sleep berhasil dikirim ke perangkat.'
        });
      } else {
        setPowerFeedback({
          type: 'error',
          text: json.error || 'Gagal mengirim perintah Deep Sleep'
        });
      }
    } catch (err) {
      setPowerFeedback({ type: 'error', text: err.message });
    } finally {
      setLoadingSleep(false);
      setTimeout(() => setPowerFeedback(null), 5000);
    }
  };

  // Simpan Kalibrasi Hasil Uji Lapangan 1 Menit Langsung ke Server
  const handleApplyCalibrationH = async (targetHeight) => {
    if (!device?.device_id || !targetHeight) return;
    setSavingCalibration(true);
    setCalibrationSuccess(null);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await fetch(`/api/calibration/${device.device_id}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sensor_height_cm: Number(Number(targetHeight).toFixed(1)),
          offset_cm: 0,
          slope: 1.0,
          notes: `Kalibrasi uji lapangan (Stabilitas pantulan: sebaran ${streamMetrics?.spread?.toFixed(1) || '0'} cm)`,
          applied_by: currentUser?.name || 'Teknisi Lapangan'
        })
      });
      const json = await res.json();
      if (json.success) {
        setCalibrationSuccess({
          type: 'success',
          text: `Tinggi sensor (H) berhasil dikalibrasi ke ${Number(targetHeight).toFixed(1)} cm!`
        });
        if (onRefresh) onRefresh();
      } else {
        setCalibrationSuccess({
          type: 'error',
          text: json.error || 'Gagal menyimpan kalibrasi ke server'
        });
      }
    } catch (err) {
      setCalibrationSuccess({
        type: 'error',
        text: err.message
      });
    } finally {
      setSavingCalibration(false);
      setTimeout(() => setCalibrationSuccess(null), 8000);
    }
  };

  // 5. Export Test Log as CSV
  const handleExportCSV = () => {
    if (rawStreamLog.length === 0) return;

    const headers = [
      'No',
      'Waktu_WIB',
      'Jarak_Mentah_cm',
      'Jarak_Mentah_mm',
      'Jarak_Terfilter_cm',
      'TMA_cm',
      'Suhu_C',
      'Status',
      'Sumber'
    ];

    const rows = rawStreamLog.map((r, idx) => [
      idx + 1,
      r.timestamp ? new Date(r.timestamp).toLocaleString('id-ID') : '--',
      r.raw_distance_cm != null ? Number(r.raw_distance_cm).toFixed(1) : '',
      r.raw_distance_mm != null ? r.raw_distance_mm : '',
      r.filtered_distance_cm != null ? Number(r.filtered_distance_cm).toFixed(1) : '',
      r.water_level_cm != null ? Number(r.water_level_cm).toFixed(1) : '',
      r.temperature_c != null ? Number(r.temperature_c).toFixed(1) : '',
      (r.is_blind_spot || (r.raw_distance_cm != null && Number(r.raw_distance_cm) <= 50.0)) ? 'BLIND_SPOT' : 'NORMAL',
      r.source || 'test'
    ]);

    const csvContent = [
      `# TerraFlow AWLR - Data Uji Cepat 1 Detik`,
      `# Stasiun: ${device.name || device.device_id} (${device.device_id})`,
      `# Tanggal Unduh: ${new Date().toLocaleString('id-ID')}`,
      `# Tinggi Sensor Terkalibrasi: ${currentHeight} cm`,
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.setAttribute('href', url);
    link.setAttribute('download', `TerraFlow_TestLog_${device.device_id}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Live active reading calculations
  const activeReading = liveRawReading;
  const rawDist = activeReading?.raw_distance_cm != null ? Number(activeReading.raw_distance_cm) : null;
  const prevDist = prevReading?.raw_distance_cm != null ? Number(prevReading.raw_distance_cm) : null;
  const deltaDist = (rawDist != null && prevDist != null) ? (rawDist - prevDist) : null;

  const isBlindSpot = activeReading?.is_blind_spot || (rawDist != null && rawDist <= 50.0);

  // SVG Chart points calculation (Last 30-40 frames)
  const chartPoints = useMemo(() => {
    if (rawStreamLog.length < 2) return null;
    const points = [...rawStreamLog].slice(0, 30).reverse();
    const validDists = points.map(p => Number(p.raw_distance_cm)).filter(v => !isNaN(v) && v > 0);
    if (validDists.length < 2) return null;

    const minV = Math.floor(Math.min(...validDists) - 5);
    const maxV = Math.ceil(Math.max(...validDists) + 5);
    const range = (maxV - minV) || 1;

    const width = 600;
    const height = 110;
    const padding = { top: 10, bottom: 20, left: 35, right: 15 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const getX = (idx) => padding.left + (idx / (points.length - 1)) * chartW;
    const getY = (val) => padding.top + chartH - ((val - minV) / range) * chartH;

    const rawPath = points.map((p, idx) => {
      const v = Number(p.raw_distance_cm);
      if (isNaN(v)) return '';
      return `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(v).toFixed(1)}`;
    }).join(' ');

    const filterPath = points.map((p, idx) => {
      const v = Number(p.filtered_distance_cm || p.raw_distance_cm);
      if (isNaN(v)) return '';
      return `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(v).toFixed(1)}`;
    }).join(' ');

    return {
      points,
      minV,
      maxV,
      rawPath,
      filterPath,
      width,
      height,
      padding
    };
  }, [rawStreamLog]);

  // Metrik Stabilitas Pantulan Echo & Kalibrasi Lapangan
  const streamMetrics = useMemo(() => {
    if (!rawStreamLog || rawStreamLog.length < 3) return null;
    // Evaluasi hingga 60 detik sampling terakhir
    const validDists = rawStreamLog
      .slice(0, 60)
      .map(r => Number(r.raw_distance_cm))
      .filter(v => !isNaN(v) && v > 50 && v < 2000);

    if (validDists.length < 3) return null;

    const sorted = [...validDists].sort((a, b) => a - b);
    const minVal = sorted[0];
    const maxVal = sorted[sorted.length - 1];
    const spread = maxVal - minVal;
    const medianVal = sorted[Math.floor(sorted.length / 2)];
    const avgVal = validDists.reduce((acc, v) => acc + v, 0) / validDists.length;

    // Skor Kestabilan (0 - 100%)
    const stabilityScore = Math.max(10, Math.min(100, Math.round(100 - (spread * 15))));

    let status = 'OPTIMAL';
    let label = 'Sangat Stabil (Deviasi Minimal)';
    let color = '#16a34a';
    let bg = '#f0fdf4';
    let border = '#86efac';
    let advice = 'Pantulan echo ultrasonik sangat stabil dan pembacaan jarak konsisten.';

    if (spread > 2.0) {
      status = 'POOR';
      label = 'Fluktuasi Tinggi Terdeteksi';
      color = '#dc2626';
      bg = '#fef2f2';
      border = '#fecaca';
      advice = 'Variasi fluktuasi > 2 cm. Periksa apakah sensor terhalang pipa/braket atau terjadi riak air kuat.';
    } else if (spread > 0.6) {
      status = 'FAIR';
      label = 'Cukup Stabil (Deviasi Ringan)';
      color = '#d97706';
      bg = '#fffbeb';
      border = '#fde68a';
      advice = 'Variasi 0.6 - 2.0 cm terdeteksi. Kencangkan baut braket sensor dan pastikan permukaan air tenang.';
    }

    return {
      sampleCount: validDists.length,
      minVal,
      maxVal,
      spread,
      medianVal,
      avgVal,
      stabilityScore,
      status,
      label,
      color,
      bg,
      border,
      advice
    };
  }, [rawStreamLog]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      
      {/* 1. Main Header Control Card */}
      <div className="corporate-card" style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: isTestMode ? '#f0fdf4' : '#edf2fc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isTestMode ? '#16a34a' : '#003882',
              transition: 'all 0.3s ease',
              boxShadow: isTestMode ? '0 0 16px rgba(34, 197, 94, 0.25)' : 'none'
            }}>
              <Radio size={24} className={isTestMode ? 'pulse-effect' : ''} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Mode Uji Cepat Sensor (Streaming 1 Detik)
                </h3>
                {isTestMode ? (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#dcfce7',
                    border: '1px solid #86efac',
                    color: '#15803d',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: '20px',
                    letterSpacing: '0.04em'
                  }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                    STREAMING 1 DETIK AKTIF
                  </span>
                ) : (
                  <span style={{
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    color: '#64748b',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '6px'
                  }}>
                    STANDBY (SIKLUS NORMAL)
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.84rem', color: '#64748b', marginTop: '4px', marginBottom: 0 }}>
                Streaming data ultrasonik A16 berkecepatan 1Hz tanpa jeda Deep Sleep untuk verifikasi respon muka air &amp; kalibrasi instan.
              </p>
            </div>
          </div>

          {/* Duration Selector & Start/Stop Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            
            {/* Audio Click Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="btn btn-secondary"
              style={{
                padding: '8px 12px',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: soundEnabled ? '#003882' : '#64748b',
                background: soundEnabled ? '#edf2fc' : '#ffffff'
              }}
              title={soundEnabled ? 'Matikan nada detak 1 detik' : 'Nyalakan nada detak suara setiap detik'}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span>{soundEnabled ? 'Suara Aktif' : 'Mute'}</span>
            </button>

            {isTestMode ? (
              <>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  color: '#15803d'
                }}>
                  <Timer size={16} color="#16a34a" />
                  <span>Sisa: {Math.floor(testRemainingSec / 60)}m {String(testRemainingSec % 60).padStart(2, '0')}s</span>
                </div>

                <button
                  onClick={() => handleToggleTestMode(false)}
                  disabled={loadingTestMode}
                  className="btn"
                  style={{
                    background: '#fef2f2',
                    color: '#dc2626',
                    border: '1px solid #fecaca',
                    padding: '9px 18px',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Square size={14} fill="#dc2626" />
                  <span>{loadingTestMode ? 'Menghentikan...' : 'Hentikan Mode Uji'}</span>
                </button>
              </>
            ) : (
              <>
                {/* Duration Picker Pills */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '3px',
                  gap: '2px'
                }}>
                  {[
                    { sec: 60, label: '1m' },
                    { sec: 180, label: '3m' },
                    { sec: 300, label: '5m' },
                    { sec: 600, label: '10m' },
                    { sec: 900, label: '15m' },
                  ].map((item) => (
                    <button
                      key={item.sec}
                      type="button"
                      onClick={() => setSelectedDuration(item.sec)}
                      style={{
                        border: 'none',
                        background: selectedDuration === item.sec ? '#003882' : 'transparent',
                        color: selectedDuration === item.sec ? '#ffffff' : '#64748b',
                        padding: '5px 10px',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      title={`Uji selama ${item.sec / 60} menit`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => handleToggleTestMode(true)}
                  disabled={loadingTestMode}
                  className="btn btn-primary"
                  style={{
                    padding: '9px 20px',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  title="Mulai transmisi data gelombang ultrasonik setiap 1 detik langsung dari ESP32"
                >
                  <Play size={14} fill="#ffffff" />
                  <span>{loadingTestMode ? 'Mengirim Perintah...' : 'Mulai Pengujian 1 Detik'}</span>
                </button>
              </>
            )}

          </div>
        </div>

        {/* Feedback Message */}
        {testModeFeedback && (
          <div style={{
            marginTop: '16px',
            padding: '10px 14px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.82rem',
            fontWeight: 600,
            background: testModeFeedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${testModeFeedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            color: testModeFeedback.type === 'success' ? '#059669' : '#dc2626'
          }}>
            {testModeFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{testModeFeedback.text}</span>
          </div>
        )}

      </div>

      {/* 2. Sakelar Daya Sensor & Uji Deep Sleep */}
      <div className="corporate-card" style={{ padding: '20px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={18} color="#003882" />
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Kendali Sakelar Daya Sensor (P-MOSFET GPIO 9) &amp; Deep Sleep
              </h4>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '3px', marginBottom: 0 }}>
              Perintah langsung via MQTT ke ESP32 untuk pengujian sakelar daya sensor dan verifikasi siklus Deep Sleep.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => handleSetSensorPower(true)}
              disabled={loadingPower}
              className="btn btn-secondary"
              style={{
                fontSize: '0.8rem',
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#16a34a',
                borderColor: '#bbf7d0',
                background: '#f0fdf4'
              }}
              title="Aktifkan switch daya High-Side P-MOSFET sensor A16"
            >
              <Zap size={14} />
              <span>{loadingPower ? 'Mengirim...' : 'Nyalakan Sensor (ON)'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSetSensorPower(false)}
              disabled={loadingPower}
              className="btn btn-secondary"
              style={{
                fontSize: '0.8rem',
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#dc2626',
                borderColor: '#fecaca',
                background: '#fef2f2'
              }}
              title="Putus switch daya High-Side P-MOSFET sensor A16"
            >
              <Power size={14} />
              <span>{loadingPower ? 'Mengirim...' : 'Matikan Sensor (OFF)'}</span>
            </button>

            <button
              type="button"
              onClick={handleTriggerSleep}
              disabled={loadingSleep}
              className="btn btn-secondary"
              style={{
                fontSize: '0.8rem',
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#2563eb',
                borderColor: '#bfdbfe',
                background: '#eff6ff'
              }}
              title="Perintahkan perangkat masuk mode hemat daya Deep Sleep segera"
            >
              <Moon size={14} />
              <span>{loadingSleep ? 'Mengirim...' : 'Masuk Deep Sleep Sekarang'}</span>
            </button>
          </div>
        </div>

        {powerFeedback && (
          <div style={{
            marginTop: '12px',
            padding: '8px 14px',
            borderRadius: '6px',
            fontSize: '0.8rem',
            fontWeight: 600,
            background: powerFeedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${powerFeedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            color: powerFeedback.type === 'success' ? '#059669' : '#dc2626'
          }}>
            {powerFeedback.text}
          </div>
        )}
      </div>

      {/* 3. Stabilitas Pantulan Echo & Kalibrasi Lapangan (H) */}
      <div className="corporate-card" style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Target size={20} color="#003882" />
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Stabilitas Pantulan Echo &amp; Kalibrasi Tinggi Tiang (H)
              </h4>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '3px', marginBottom: 0 }}>
              Evaluasi fluktuasi deviasi gelombang ultrasonik secara real-time dan kunci tinggi tiang acuan (H) dengan satu klik.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowChecklist(!showChecklist)}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <CheckSquare size={14} />
            <span>{showChecklist ? 'Sembunyikan Checklist' : 'Checklist Pra-Pemasangan'}</span>
          </button>
        </div>

        {/* Calibration Feedback Message */}
        {calibrationSuccess && (
          <div style={{
            marginTop: '14px',
            padding: '10px 14px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.82rem',
            fontWeight: 600,
            background: calibrationSuccess.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${calibrationSuccess.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            color: calibrationSuccess.type === 'success' ? '#059669' : '#dc2626'
          }}>
            {calibrationSuccess.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{calibrationSuccess.text}</span>
          </div>
        )}

        {/* Real-time Diagnostics Grid */}
        {streamMetrics ? (
          <div style={{
            marginTop: '18px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '16px'
          }}>
            {/* Box 1: Stabilitas Sinyal Pantulan */}
            <div style={{
              background: '#ffffff',
              border: `1.5px solid ${streamMetrics.border}`,
              borderRadius: '10px',
              padding: '16px 18px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  STABILITAS PANTULAN ECHO
                </span>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  background: streamMetrics.bg,
                  color: streamMetrics.color,
                  border: `1px solid ${streamMetrics.border}`,
                  padding: '3px 8px',
                  borderRadius: '6px'
                }}>
                  {streamMetrics.label}
                </span>
              </div>

              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Fluktuasi Jarak (&Delta; Max - Min):</span>
                  <div className="mono-text" style={{ fontSize: '1.5rem', fontWeight: 800, color: streamMetrics.color }}>
                    &plusmn;{(streamMetrics.spread / 2).toFixed(1)} <span style={{ fontSize: '0.85rem', color: '#64748b' }}>cm (&Delta; {streamMetrics.spread.toFixed(1)} cm)</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Kestabilan:</span>
                  <div className="mono-text" style={{ fontSize: '1.5rem', fontWeight: 800, color: streamMetrics.color }}>
                    {streamMetrics.stabilityScore}%
                  </div>
                </div>
              </div>

              <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${streamMetrics.stabilityScore}%`,
                  background: streamMetrics.status === 'OPTIMAL' ? '#16a34a' : (streamMetrics.status === 'FAIR' ? '#d97706' : '#dc2626'),
                  transition: 'width 0.3s ease'
                }} />
              </div>

              <p style={{ fontSize: '0.78rem', color: '#475569', marginTop: '10px', marginBottom: 0, lineHeight: 1.45 }}>
                {streamMetrics.advice}
              </p>
            </div>

            {/* Box 2: Kalibrasi Tinggi Sensor (H) 1-Klik */}
            <div style={{
              background: '#ffffff',
              border: '1.5px solid #e2e8f0',
              borderRadius: '10px',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    REKOMENDASI TINGGI SENSOR (H)
                  </span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '4px' }}>
                    {streamMetrics.sampleCount} Frame Valid
                  </span>
                </div>

                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Jarak Terukur (Median):</span>
                    <div className="mono-text" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#003882' }}>
                      {streamMetrics.medianVal.toFixed(1)} <span style={{ fontSize: '0.85rem', color: '#64748b' }}>cm</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Tinggi Aktif:</span>
                    <div className="mono-text" style={{ fontSize: '1.2rem', fontWeight: 700, color: '#64748b' }}>
                      {currentHeight.toFixed(1)} cm
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '6px' }}>
                  Selisih: <strong className="mono-text" style={{ color: Math.abs(streamMetrics.medianVal - currentHeight) < 0.5 ? '#16a34a' : '#d97706' }}>
                    {(streamMetrics.medianVal - currentHeight) > 0 ? '+' : ''}{(streamMetrics.medianVal - currentHeight).toFixed(1)} cm
                  </strong>
                </div>
              </div>

              <div style={{ marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => handleApplyCalibrationH(streamMetrics.medianVal)}
                  disabled={savingCalibration || !isAdmin}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '8px 14px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  title={!isAdmin ? 'Hanya administrator yang dapat mengalibrasi tinggi sensor' : 'Terapkan jarak median ini sebagai tinggi sensor acuan (H)'}
                >
                  <Save size={14} />
                  <span>
                    {savingCalibration 
                      ? 'Menyimpan...' 
                      : `Terapkan Sebagai Tinggi Sensor (H = ${streamMetrics.medianVal.toFixed(1)} cm)`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            marginTop: '16px',
            padding: '18px',
            borderRadius: '10px',
            border: '1px dashed #cbd5e1',
            background: '#f8fafc',
            textAlign: 'center'
          }}>
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
              Mulai <strong>Mode Uji Streaming 1 Detik</strong> di atas untuk memantau stabilitas pantulan gelombang dan mengunci nilai tinggi acuan sensor (H).
            </p>
          </div>
        )}

        {/* Pre-departure Physical Checklist */}
        {showChecklist && (
          <div style={{
            marginTop: '16px',
            padding: '14px 18px',
            background: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <CheckSquare size={16} color="#003882" />
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>
                Checklist Fisik Pra-Pemasangan (Sebelum Meninggalkan Lokasi)
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px', fontSize: '0.78rem', color: '#334155' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: '#f8fafc', padding: '10px 12px', borderRadius: '6px' }}>
                <Check size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Posisi Tegak Lurus:</strong> Braket terpasang kokoh dan sumbu sensor tegak lurus menghadap permukaan air.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: '#f8fafc', padding: '10px 12px', borderRadius: '6px' }}>
                <Check size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Bebas Zona Buta (&gt; 50 cm):</strong> Jarak sensor ke elevasi banjir tertinggi masih lebih besar dari 50 cm.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: '#f8fafc', padding: '10px 12px', borderRadius: '6px' }}>
                <Check size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Bebas Hambatan Berkas:</strong> Kerucut pancaran ultrasonik tidak terpotong dinding pipa atau kabel.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: '#f8fafc', padding: '10px 12px', borderRadius: '6px' }}>
                <Check size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Kerapatan Box &amp; IP67:</strong> Semua baut pengunci kencang dan cable gland panel box tersegel rapat.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Four Telemetry Metrics Cards (Live 1s Realtime) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px'
      }}>
        
        {/* Card 1: Jarak Mentah Sensor A16 */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              JARAK MENTAH SENSOR
            </span>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, background: '#e0f2fe', color: '#0284c7', padding: '2px 8px', borderRadius: '4px' }}>
              A16 RAW UART
            </span>
          </div>
          
          <div className="mono-text" style={{ fontSize: '2.1rem', fontWeight: 800, color: '#003882', marginTop: '6px' }}>
            {rawDist != null ? rawDist.toFixed(1) : '--'}
            <span style={{ fontSize: '1rem', fontWeight: 600, color: '#64748b', marginLeft: '4px' }}>cm</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.78rem', color: '#475569' }}>
            <span className="mono-text" style={{ fontWeight: 600 }}>
              {activeReading?.raw_distance_mm != null 
                ? `${activeReading.raw_distance_mm} mm` 
                : (rawDist != null ? `${Math.round(rawDist * 10)} mm` : '-- mm')}
            </span>
            
            {deltaDist != null && (
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: Math.abs(deltaDist) < 0.05 ? '#64748b' : (deltaDist > 0 ? '#dc2626' : '#16a34a')
              }}>
                {Math.abs(deltaDist) < 0.05 ? '±0.0 cm' : `${deltaDist > 0 ? '+' : ''}${deltaDist.toFixed(1)} cm/s`}
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Jarak Terfilter (Median 3/9 Frame) */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              JARAK TERFILTER (MEDIAN)
            </span>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '4px' }}>
              REDUKSI NOISE
            </span>
          </div>

          <div className="mono-text" style={{ fontSize: '2.1rem', fontWeight: 800, color: '#0f172a', marginTop: '6px' }}>
            {activeReading?.filtered_distance_cm != null 
              ? Number(activeReading.filtered_distance_cm).toFixed(1)
              : (rawDist != null ? rawDist.toFixed(1) : '--')}
            <span style={{ fontSize: '1rem', fontWeight: 600, color: '#64748b', marginLeft: '4px' }}>cm</span>
          </div>

          <div style={{ fontSize: '0.78rem', color: '#059669', marginTop: '6px', fontWeight: 600 }}>
            Median eliminasi riak gelombang
          </div>
        </div>

        {/* Card 3: Elevasi Muka Air (TMA) */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              ELEVASI MUKA AIR (TMA)
            </span>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '4px' }}>
              H: {currentHeight} cm
            </span>
          </div>

          <div className="mono-text" style={{ fontSize: '2.1rem', fontWeight: 800, color: '#0284c7', marginTop: '6px' }}>
            {activeReading?.water_level_cm != null ? Number(activeReading.water_level_cm).toFixed(1) : '--'}
            <span style={{ fontSize: '1rem', fontWeight: 600, color: '#64748b', marginLeft: '4px' }}>cm</span>
          </div>

          <div style={{ fontSize: '0.78rem', color: '#0369a1', marginTop: '6px', fontWeight: 600 }}>
            {activeReading?.water_level_cm != null 
              ? `${(Number(activeReading.water_level_cm) / 100).toFixed(2)} meter` 
              : '-- m'}
            <span style={{ color: '#94a3b8', margin: '0 4px' }}>&bull;</span>
            <span style={{ color: '#64748b' }}>H - Jarak</span>
          </div>
        </div>

        {/* Card 4: Diagnostik Pantulan & Sinyal */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              STATUS PANTULAN &amp; SUHU
            </span>
            <span style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              background: isBlindSpot ? '#fee2e2' : '#f0fdf4',
              color: isBlindSpot ? '#dc2626' : '#16a34a',
              padding: '2px 8px',
              borderRadius: '4px'
            }}>
              {isBlindSpot ? 'PERINGATAN' : 'NORMAL'}
            </span>
          </div>

          <div style={{ marginTop: '8px' }}>
            {isBlindSpot ? (
              <span style={{ fontSize: '0.94rem', fontWeight: 800, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldAlert size={18} />
                BLIND SPOT (&le; 50 cm)
              </span>
            ) : (
              <span style={{ fontSize: '0.94rem', fontWeight: 800, color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={18} />
                JANGKAUAN VALID
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', color: '#475569', marginTop: '10px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Thermometer size={14} color="#64748b" />
              {activeReading?.temperature_c != null ? `${Number(activeReading.temperature_c).toFixed(1)}°C` : '--'}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Wifi size={14} color="#64748b" />
              {activeReading?.signal_quality != null ? `${activeReading.signal_quality} dBm` : '--'}
            </span>
            <span style={{ fontWeight: 700, color: '#7c3aed' }}>
              {sessionFrameCount} Frm
            </span>
          </div>
        </div>

      </div>

      {/* 3. Live 1-Second Strip Waveform Chart */}
      <div className="corporate-card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} color="#003882" />
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
              Grafik Respon Sensor Real-Time (30 Detik Terakhir)
            </span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.76rem', fontWeight: 700 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#003882' }}>
              <span style={{ width: '10px', height: '3px', background: '#003882', borderRadius: '2px', display: 'inline-block' }} />
              Jarak Mentah (cm)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#16a34a' }}>
              <span style={{ width: '10px', height: '3px', background: '#16a34a', borderRadius: '2px', display: 'inline-block' }} />
              Jarak Filter (cm)
            </span>
          </div>
        </div>

        {chartPoints ? (
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <svg viewBox={`0 0 ${chartPoints.width} ${chartPoints.height}`} style={{ width: '100%', height: '120px', display: 'block' }}>
              {/* Grid lines */}
              <line x1={chartPoints.padding.left} y1={chartPoints.padding.top} x2={chartPoints.width - chartPoints.padding.right} y2={chartPoints.padding.top} stroke="#e2e8f0" strokeDasharray="3 3" />
              <line x1={chartPoints.padding.left} y1={chartPoints.height - chartPoints.padding.bottom} x2={chartPoints.width - chartPoints.padding.right} y2={chartPoints.height - chartPoints.padding.bottom} stroke="#cbd5e1" />

              {/* Y Axis Labels */}
              <text x={chartPoints.padding.left - 6} y={chartPoints.padding.top + 4} textAnchor="end" fontSize="10" fill="#64748b" className="mono-text">
                {chartPoints.maxV}
              </text>
              <text x={chartPoints.padding.left - 6} y={chartPoints.height - chartPoints.padding.bottom} textAnchor="end" fontSize="10" fill="#64748b" className="mono-text">
                {chartPoints.minV}
              </text>

              {/* Raw Path */}
              {chartPoints.rawPath && (
                <path d={chartPoints.rawPath} fill="none" stroke="#003882" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              )}

              {/* Filter Path */}
              {chartPoints.filterPath && (
                <path d={chartPoints.filterPath} fill="none" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
              )}
            </svg>
          </div>
        ) : (
          <div style={{
            padding: '24px',
            textAlign: 'center',
            fontSize: '0.82rem',
            color: '#94a3b8',
            background: '#fafafa',
            borderRadius: '8px'
          }}>
            Grafik akan tampil otomatis saat minimal 2 frame data uji 1 detik masuk.
          </div>
        )}
      </div>

      {/* 4. Live Stream Terminal Log Table */}
      <div className="corporate-card" style={{ padding: 0, overflow: 'hidden' }}>
        
        {/* Table Action Header */}
        <div style={{
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
            <Terminal size={17} color="#003882" />
            <span style={{ fontSize: '0.88rem', fontWeight: 800 }}>
              Log Aliran Data Mentah Presisi (1 Frame/Detik)
            </span>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              background: '#e0f2fe',
              color: '#0284c7',
              padding: '2px 8px',
              borderRadius: '10px'
            }}>
              {rawStreamLog.length} Frame Terekam
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setIsLogPaused(!isLogPaused)}
              className="btn btn-secondary"
              style={{
                padding: '6px 12px',
                fontSize: '0.76rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title={isLogPaused ? 'Lanjutkan perekaman stream' : 'Jeda tampilan stream agar tidak bergeser'}
            >
              {isLogPaused ? <Play size={12} fill="#0f172a" /> : <Square size={12} fill="#0f172a" />}
              <span>{isLogPaused ? 'Lanjutkan Stream' : 'Jeda Stream'}</span>
            </button>

            <button
              type="button"
              onClick={() => setRawStreamLog([])}
              className="btn btn-secondary"
              style={{
                padding: '6px 12px',
                fontSize: '0.76rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title="Bersihkan riwayat frame pada tabel"
            >
              <Trash2 size={12} />
              <span>Bersihkan</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={rawStreamLog.length === 0}
              className="btn btn-secondary"
              style={{
                padding: '6px 14px',
                fontSize: '0.76rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#003882',
                background: '#edf2fc',
                borderColor: '#cbd5e1'
              }}
              title="Ekspor seluruh log pengujian 1 detik ke file CSV"
            >
              <Download size={13} />
              <span>Unduh CSV Data Uji</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
          {rawStreamLog.length === 0 ? (
            <div style={{
              padding: '36px',
              textAlign: 'center',
              fontSize: '0.84rem',
              color: '#94a3b8',
              background: '#ffffff'
            }}>
              Belum ada aliran data masuk. Klik tombol <strong>"Mulai Pengujian 1 Detik"</strong> di atas untuk memantau data mentah sensor setiap detik.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', color: '#475569', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '9px 14px' }}>#</th>
                  <th style={{ padding: '9px 14px' }}>Waktu (Detik)</th>
                  <th style={{ padding: '9px 14px' }}>Jarak Mentah (cm)</th>
                  <th style={{ padding: '9px 14px' }}>Jarak (mm)</th>
                  <th style={{ padding: '9px 14px' }}>Jarak Filter (cm)</th>
                  <th style={{ padding: '9px 14px' }}>TMA (cm)</th>
                  <th style={{ padding: '9px 14px' }}>Suhu</th>
                  <th style={{ padding: '9px 14px' }}>Kondisi Echo</th>
                  <th style={{ padding: '9px 14px' }}>Sumber</th>
                </tr>
              </thead>
              <tbody>
                {rawStreamLog.map((row, idx) => {
                  const timeStr = row.timestamp ? new Date(row.timestamp).toLocaleTimeString('id-ID') : '--';
                  const isBlind = row.is_blind_spot || (row.raw_distance_cm != null && Number(row.raw_distance_cm) <= 50.0);
                  return (
                    <tr 
                      key={row.id || idx}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: idx === 0 ? '#f0fdf4' : (idx % 2 === 0 ? '#ffffff' : '#f8fafc'),
                        transition: 'background 0.2s ease'
                      }}
                    >
                      <td style={{ padding: '7px 14px', color: '#94a3b8' }}>{idx + 1}</td>
                      <td className="mono-text" style={{ padding: '7px 14px', fontWeight: 700, color: '#0f172a' }}>{timeStr}</td>
                      <td className="mono-text" style={{ padding: '7px 14px', fontWeight: 800, color: '#003882' }}>
                        {row.raw_distance_cm != null ? `${Number(row.raw_distance_cm).toFixed(1)} cm` : '--'}
                      </td>
                      <td className="mono-text" style={{ padding: '7px 14px', color: '#64748b' }}>
                        {row.raw_distance_mm != null ? `${row.raw_distance_mm} mm` : '--'}
                      </td>
                      <td className="mono-text" style={{ padding: '7px 14px', color: '#334155' }}>
                        {row.filtered_distance_cm != null ? `${Number(row.filtered_distance_cm).toFixed(1)} cm` : '--'}
                      </td>
                      <td className="mono-text" style={{ padding: '7px 14px', fontWeight: 700, color: '#0284c7' }}>
                        {row.water_level_cm != null ? `${Number(row.water_level_cm).toFixed(1)} cm` : '--'}
                      </td>
                      <td style={{ padding: '7px 14px', color: '#475569' }}>
                        {row.temperature_c != null ? `${Number(row.temperature_c).toFixed(1)} °C` : '--'}
                      </td>
                      <td style={{ padding: '7px 14px' }}>
                        {isBlind ? (
                          <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.72rem' }}>BLIND SPOT</span>
                        ) : (
                          <span style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.72rem' }}>
                            NORMAL {row.spread_cm != null ? `(±${Number(row.spread_cm).toFixed(1)} cm)` : ''}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '7px 14px' }}>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          background: row.source === 'test' ? '#f3e8ff' : '#e0f2fe',
                          color: row.source === 'test' ? '#7c3aed' : '#0369a1',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          {(row.source || 'LIVE').toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>

    </div>
  );
}

