import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Filter, 
  Calendar, 
  RefreshCw, 
  HardDrive, 
  Radio, 
  CheckCircle2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function HistoricalView({ device }) {
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Filter dates (default to past 24 hours)
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
  const [startDate, setStartDate] = useState(yesterday.toISOString().slice(0, 16));
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 16));

  const fetchHistorical = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        start: new Date(startDate).toISOString(),
        end: new Date(endDate).toISOString(),
        limit: 1000
      });
      const res = await fetch(`/api/readings/${device?.device_id || 'AWLR-001'}?${q}`);
      const json = await res.json();
      if (json.success) {
        setReadings(json.data);
      }
    } catch (e) {
      console.error('Error fetching historical:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistorical();
  }, [device]);

  const handleExportCSV = () => {
    const q = new URLSearchParams({
      start: new Date(startDate).toISOString(),
      end: new Date(endDate).toISOString()
    });
    window.location.href = `/api/export/${device?.device_id || 'AWLR-001'}?${q}`;
  };

  const totalPages = Math.ceil(readings.length / pageSize) || 1;
  const paginatedData = readings.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Title & Filter Bar */}
      <div className="corporate-card" style={{ padding: '28px' }}>
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
                <FileText size={22} />
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
                Riwayat Telemetri &amp; Ekspor Data
              </h2>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#64748b', marginTop: '4px' }}>
              Telusuri arsip data elevasi muka air dan ekspor laporan CSV terstandar untuk analisis hidrologi
            </p>
          </div>

          <button onClick={handleExportCSV} className="btn-corporate-primary">
            <Download size={18} />
            <span>UNDUH LAPORAN CSV</span>
          </button>
        </div>

        {/* Date Filters Form */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '24px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
              DARI TANGGAL &amp; WAKTU
            </label>
            <input 
              type="datetime-local" 
              className="input-corporate"
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
            />
          </div>

          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
              HINGGA TANGGAL &amp; WAKTU
            </label>
            <input 
              type="datetime-local" 
              className="input-corporate"
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
            />
          </div>

          <button onClick={fetchHistorical} className="btn-corporate-outline" style={{ height: '44px' }}>
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Filter size={16} />}
            <span>TERAPKAN FILTER</span>
          </button>
        </div>
      </div>

      {/* Historical Data Table */}
      <div className="corporate-card" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>
            Ditemukan <strong style={{ color: '#003882' }}>{readings.length}</strong> baris data arsip
          </div>
          <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
            Halaman {page} dari {totalPages}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                <th style={{ padding: '12px 14px', fontWeight: 700 }}>Waktu Pencatatan</th>
                <th style={{ padding: '12px 14px', fontWeight: 700 }}>Tinggi Muka Air</th>
                <th style={{ padding: '12px 14px', fontWeight: 700 }}>Jarak Sensor (Raw)</th>
                <th style={{ padding: '12px 14px', fontWeight: 700 }}>Suhu Udara</th>
                <th style={{ padding: '12px 14px', fontWeight: 700 }}>Baterai Aki</th>
                <th style={{ padding: '12px 14px', fontWeight: 700 }}>Kanal Sinkron</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                    {loading ? 'Memuat rekaman data...' : 'Tidak ada data rekaman pada rentang waktu ini.'}
                  </td>
                </tr>
              ) : (
                paginatedData.map((r, i) => (
                  <tr key={r.id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px', color: '#475569' }}>
                      {new Date(r.recorded_at).toLocaleString('id-ID')}
                    </td>
                    <td className="mono-text" style={{ padding: '12px 14px', fontWeight: 800, color: '#003882' }}>
                      {Number(r.water_level_cm).toFixed(1)} cm
                    </td>
                    <td className="mono-text" style={{ padding: '12px 14px', color: '#64748b' }}>
                      {Number(r.raw_distance_cm).toFixed(1)} cm
                    </td>
                    <td className="mono-text" style={{ padding: '12px 14px', color: '#64748b' }}>
                      {Number(r.temperature_c).toFixed(1)} &deg;C
                    </td>
                    <td className="mono-text" style={{ padding: '12px 14px' }}>
                      <span style={{ color: Number(r.battery_voltage) > 11.5 ? '#059669' : '#d97706', fontWeight: 700 }}>
                        {Number(r.battery_voltage).toFixed(2)}V
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className="badge badge-navy" style={{ fontSize: '0.7rem' }}>
                        {r.sync_source || 'REALTIME_MQTT'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '24px' }}>
            <button 
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="btn-corporate-outline"
              style={{ padding: '6px 12px' }}
            >
              <ChevronLeft size={16} /> Sebelumnya
            </button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: '0.85rem', fontWeight: 700, color: '#003882' }}>
              {page} / {totalPages}
            </span>
            <button 
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="btn-corporate-outline"
              style={{ padding: '6px 12px' }}
            >
              Berikutnya <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
