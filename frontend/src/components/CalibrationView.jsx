import React, { useState, useEffect } from 'react';
import { Sliders, Send, History, CheckCircle2, AlertCircle, RefreshCw, Calculator, ShieldCheck, ArrowRight } from 'lucide-react';

export default function CalibrationView({ device, latestReading, onCalibrationUpdated }) {
  const [formData, setFormData] = useState({
    sensor_height_cm: 600.0,
    offset_cm: 0.0,
    slope: 1.0,
    applied_by: 'Teknisi PT Tanah Airku Teknologi',
    notes: 'Penyesuaian offset elevasi di dermaga estuari'
  });

  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (device) {
      setFormData(prev => ({
        ...prev,
        sensor_height_cm: Number(device.sensor_height_cm) || 600.0,
        offset_cm: Number(device.calibrated_offset) || 0.0,
        slope: Number(device.calibrated_slope) || 1.0
      }));
    }
    fetchHistory();
  }, [device]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/calibration/${device?.device_id || 'AWLR-001'}/history`);
      const json = await res.json();
      if (json.success) {
        setHistory(json.data);
      }
    } catch (e) {
      console.error('Error fetching history:', e);
    }
  };

  const rawDist = latestReading?.raw_distance_cm != null ? Number(latestReading.raw_distance_cm) : 420.0;
  
  // Current Calculation
  const currentHeight = Number(device?.sensor_height_cm) || 600.0;
  const currentOffset = Number(device?.calibrated_offset) || 0.0;
  const currentSlope = Number(device?.calibrated_slope) || 1.0;
  const currentCalcLevel = +(currentHeight - (rawDist * currentSlope + currentOffset)).toFixed(2);

  // New Simulated Calculation
  const simHeight = Number(formData.sensor_height_cm) || 600.0;
  const simOffset = Number(formData.offset_cm) || 0.0;
  const simSlope = Number(formData.slope) || 1.0;
  const simCalcLevel = +(simHeight - (rawDist * simSlope + simOffset)).toFixed(2);
  const deltaLevel = +(simCalcLevel - currentCalcLevel).toFixed(2);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/calibration/${device?.device_id || 'AWLR-001'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const json = await res.json();

      if (json.success) {
        setFeedback({ type: 'success', text: `Kalibrasi berhasil diterapkan dan disinkronkan ke ESP32 via MQTT!` });
        fetchHistory();
        if (onCalibrationUpdated) onCalibrationUpdated();
      } else {
        setFeedback({ type: 'error', text: json.error || 'Gagal menyimpan kalibrasi' });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* Title Header */}
      <div className="corporate-card" style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
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
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
              Kalibrasi Parameter Sensor Jarak Jauh (Remote Calibration)
            </h2>
            <p style={{ fontSize: '0.88rem', color: '#64748b', marginTop: '2px' }}>
              Formula Elevasi Air: <span className="mono-text" style={{ color: '#003882', fontWeight: 700 }}>Water Level = Sensor Height - (Raw Distance &times; Slope + Offset)</span>
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Form (styled like Kirim Pesan in Image 2) + Right Preview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        
        {/* Form Container (Matching Image 2 Kirim Pesan) */}
        <div className="corporate-card" style={{ padding: '32px 28px' }}>
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#003882' }}>
              Pengaturan Nilai Kalibrasi
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '4px' }}>
              Perubahan akan langsung dikirim ke memori NVS ESP32-S3 via protokol MQTT.
            </p>
          </div>

          {feedback && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '0.88rem',
              fontWeight: 600,
              background: feedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
              color: feedback.type === 'success' ? '#059669' : '#dc2626',
              border: `1px solid ${feedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`
            }}>
              {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{feedback.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                  TINGGI SENSOR (CM)
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  className="input-corporate"
                  value={formData.sensor_height_cm}
                  onChange={e => setFormData({ ...formData, sensor_height_cm: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                  OFFSET ELEVASI (CM)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="input-corporate"
                  value={formData.offset_cm}
                  onChange={e => setFormData({ ...formData, offset_cm: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                  SLOPE MULTIPLIER
                </label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  className="input-corporate"
                  value={formData.slope}
                  onChange={e => setFormData({ ...formData, slope: parseFloat(e.target.value) || 1.0 })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                  NAMA PETUGAS / TEKNISI
                </label>
                <input
                  type="text"
                  required
                  className="input-corporate"
                  value={formData.applied_by}
                  onChange={e => setFormData({ ...formData, applied_by: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                CATATAN LAPANGAN
              </label>
              <textarea
                rows={3}
                className="input-corporate"
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Deskripsikan alasan atau catatan teknis kalibrasi..."
                style={{ resize: 'vertical' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-corporate-primary"
              style={{ width: '100%', marginTop: '6px', padding: '14px 24px', fontSize: '0.9rem' }}
            >
              {loading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  MENERAPKAN PARAMETER...
                </>
              ) : (
                <>
                  <span>KIRIM PERMINTAAN KALIBRASI</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Preview & Verification Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Live Preview Card */}
          <div className="corporate-card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <Calculator size={20} color="#003882" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                Simulasi Hasil Perhitungan Real-Time
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="subtle-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Jarak Sensor Saat Ini (Raw):</span>
                <span className="mono-text" style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>{rawDist.toFixed(1)} cm</span>
              </div>

              <div className="subtle-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Tinggi Muka Air Sekarang:</span>
                <span className="mono-text" style={{ fontSize: '1rem', fontWeight: 800, color: '#475569' }}>{currentCalcLevel.toFixed(2)} cm</span>
              </div>

              <div style={{
                padding: '16px',
                borderRadius: '10px',
                background: '#edf2fc',
                border: '1px solid #d4e2fa',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '0.9rem', color: '#003882', fontWeight: 800 }}>Hasil Setelah Kalibrasi Baru:</span>
                <span className="mono-text" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#003882' }}>{simCalcLevel.toFixed(2)} cm</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px', fontSize: '0.82rem', color: '#64748b' }}>
                <span>Selisih Koreksi (Delta):</span>
                <span className="mono-text" style={{ fontWeight: 700, color: deltaLevel >= 0 ? '#059669' : '#dc2626' }}>
                  {deltaLevel > 0 ? `+${deltaLevel}` : deltaLevel} cm
                </span>
              </div>
            </div>
          </div>

          {/* Standards & Accreditation Badge Card */}
          <div className="corporate-card" style={{ padding: '24px', background: '#f8fafd' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldCheck size={20} color="#059669" />
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                Kepatuhan Standar Pengukuran Hidrometri
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '6px', lineHeight: 1.5 }}>
              Parameter kalibrasi TerraFlow AWLR diverifikasi sesuai standar akreditasi industri BIG (Badan Informasi Geospasial) dan ISO 9001 untuk ketelitian geospasial tinggi.
            </p>
          </div>

        </div>

      </div>

      {/* Historical Audit Trail Table */}
      <div className="corporate-card" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
          <History size={20} color="#003882" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
            Riwayat Log Kalibrasi Sensor
          </h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Waktu</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Tinggi Sensor</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Offset</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Slope</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Teknisi</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                    Belum ada riwayat kalibrasi tersimpan.
                  </td>
                </tr>
              ) : (
                history.map((h, i) => (
                  <tr key={h.id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{new Date(h.applied_at).toLocaleString('id-ID')}</td>
                    <td className="mono-text" style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>{Number(h.sensor_height_cm).toFixed(1)} cm</td>
                    <td className="mono-text" style={{ padding: '10px 14px', color: '#003882' }}>{Number(h.offset_cm).toFixed(2)} cm</td>
                    <td className="mono-text" style={{ padding: '10px 14px' }}>{Number(h.slope).toFixed(4)}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>{h.applied_by}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{h.notes || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
