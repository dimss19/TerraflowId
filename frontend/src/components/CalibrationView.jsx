import React, { useState, useEffect } from 'react';
import { Sliders, Send, History, CheckCircle2, AlertCircle, RefreshCw, Calculator, ShieldCheck } from 'lucide-react';

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
        setFeedback({ type: 'success', text: `Kalibrasi berhasil diterapkan dan dikirim via MQTT! (${json.mqttStatus})` });
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Title Header */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sliders size={24} color="#06b6d4" />
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc' }}>
              Kalibrasi Parameter Sensor Jarak Jauh (Remote Calibration)
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Formula Water Level: <span className="mono-text" style={{ color: '#38bdf8' }}>Water Level = Sensor Height - (Raw Distance &times; Slope + Offset)</span>
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '24px' }}>
        
        {/* Form Calibration */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '16px' }}>
            Form Penyesuaian Parameter
          </h3>

          {feedback && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${feedback.type === 'success' ? '#10b981' : '#ef4444'}55`,
              color: feedback.type === 'success' ? '#34d399' : '#f87171',
              fontSize: '0.85rem'
            }}>
              {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{feedback.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                TINGGI SENSOR KE DASAR (SENSOR_HEIGHT_CM)
              </label>
              <input
                type="number"
                step="0.1"
                min="50"
                max="2000"
                required
                className="form-input"
                value={formData.sensor_height_cm}
                onChange={e => setFormData({ ...formData, sensor_height_cm: e.target.value })}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Batas aman: 50.0 cm hingga 2000.0 cm</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                  OFFSET (OFFSET_CM)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="-100"
                  max="100"
                  required
                  className="form-input"
                  value={formData.offset_cm}
                  onChange={e => setFormData({ ...formData, offset_cm: e.target.value })}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rentang: -100 cm s/d +100 cm</span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                  SLOPE (FAKTOR GRADIENT)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0.8"
                  max="1.2"
                  required
                  className="form-input"
                  value={formData.slope}
                  onChange={e => setFormData({ ...formData, slope: e.target.value })}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Normal: 1.000000 &plusmn; 20%</span>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                NAMA OPERATOR / TEKNISI
              </label>
              <input
                type="text"
                required
                className="form-input"
                value={formData.applied_by}
                onChange={e => setFormData({ ...formData, applied_by: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                CATATAN PERUBAHAN
              </label>
              <input
                type="text"
                className="form-input"
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', marginTop: '8px' }}
            >
              {loading ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
              <span>{loading ? 'Mengirim ke ESP32...' : 'Terapkan & Kirim ke Perangkat via MQTT'}</span>
            </button>
          </form>
        </div>

        {/* Live Calculation Simulator Preview */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Calculator size={20} color="#38bdf8" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                Simulasi Perhitungan Real-Time
              </h3>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Simulasi dampak perubahan parameter terhadap pembacaan mentah jarak sensor A16 saat ini ({rawDist.toFixed(1)} cm):
            </p>

            {/* Comparison Box */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>KALIBRASI SAAT INI (AKTIF DI PERANGKAT)</div>
                <div className="mono-text" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#94a3b8', marginTop: '4px' }}>
                  {currentCalcLevel} cm
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {currentHeight} - ({rawDist.toFixed(1)} &times; {currentSlope} + {currentOffset})
                </div>
              </div>

              <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
                <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>SIMULASI KALIBRASI BARU</div>
                <div className="mono-text" style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
                  {simCalcLevel} cm
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {simHeight} - ({rawDist.toFixed(1)} &times; {simSlope} + {simOffset})
                </div>
              </div>

              <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Selisih Elevasi (&Delta;):</span>
                <span className="mono-text" style={{ fontSize: '1.1rem', fontWeight: 700, color: deltaLevel >= 0 ? '#34d399' : '#f87171' }}>
                  {deltaLevel >= 0 ? `+${deltaLevel}` : deltaLevel} cm
                </span>
              </div>

            </div>
          </div>

          <div style={{ marginTop: '20px', padding: '12px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', fontSize: '0.75rem', color: '#93c5fd', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <ShieldCheck size={18} />
            <span>ESP32-S3 menyimpan parameter kalibrasi ke Non-Volatile Storage (NVS) agar tidak hilang saat mati daya.</span>
          </div>
        </div>

      </div>

      {/* Calibration Audit Trail History */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <History size={20} color="#818cf8" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
            Riwayat Log Kalibrasi Perangkat
          </h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(59, 130, 246, 0.2)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 8px' }}>Tanggal &amp; Waktu</th>
                <th style={{ padding: '10px 8px' }}>Tinggi (cm)</th>
                <th style={{ padding: '10px 8px' }}>Offset (cm)</th>
                <th style={{ padding: '10px 8px' }}>Slope</th>
                <th style={{ padding: '10px 8px' }}>Operator</th>
                <th style={{ padding: '10px 8px' }}>Catatan</th>
                <th style={{ padding: '10px 8px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                  <td className="mono-text" style={{ padding: '10px 8px', color: '#f8fafc' }}>
                    {new Date(h.applied_at).toLocaleString('id-ID')}
                  </td>
                  <td className="mono-text" style={{ padding: '10px 8px' }}>{h.sensor_height_cm}</td>
                  <td className="mono-text" style={{ padding: '10px 8px' }}>{h.offset_cm}</td>
                  <td className="mono-text" style={{ padding: '10px 8px' }}>{h.slope}</td>
                  <td style={{ padding: '10px 8px', color: '#94a3b8' }}>{h.applied_by}</td>
                  <td style={{ padding: '10px 8px', color: '#64748b' }}>{h.notes || '-'}</td>
                  <td style={{ padding: '10px 8px' }}>
                    <span className={`badge ${h.is_active ? 'badge-emerald' : 'badge-cyan'}`}>
                      {h.is_active ? 'AKTIF' : 'TERGANTIKAN'}
                    </span>
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
