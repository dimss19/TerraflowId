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
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileText size={24} color="#06b6d4" />
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc' }}>
                Riwayat Telemetri &amp; Ekspor Data
              </h2>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Telusuri arsip data elevasi muka air dan ekspor laporan terstandar untuk analisis hidrologi
            </p>
          </div>

          <button onClick={handleExportCSV} className="btn btn-primary">
            <Download size={16} />
            <span>Ekspor Format CSV</span>
          </button>
        </div>

        {/* Date Filter Inputs */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '14px', 
          marginTop: '20px', 
          padding: '16px', 
          background: 'rgba(15, 23, 42, 0.6)', 
          borderRadius: '10px',
          border: '1px solid rgba(59, 130, 246, 0.15)',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} color="#38bdf8" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Rentang Waktu:</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="datetime-local"
              className="form-input"
              style={{ width: 'auto' }}
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
            <span style={{ color: 'var(--text-muted)' }}>s/d</span>
            <input
              type="datetime-local"
              className="form-input"
              style={{ width: 'auto' }}
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>

          <button onClick={fetchHistorical} disabled={loading} className="btn btn-secondary">
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Filter size={14} />}
            <span>Filter Data</span>
          </button>

          <div style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Ditemukan: <strong style={{ color: '#38bdf8' }}>{readings.length}</strong> Rekaman
          </div>
        </div>
      </div>

      {/* Historical Data Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(59, 130, 246, 0.2)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 8px' }}>Waktu (Timestamp)</th>
                <th style={{ padding: '12px 8px' }}>Elevasi Air (cm)</th>
                <th style={{ padding: '12px 8px' }}>Jarak Sensor (cm)</th>
                <th style={{ padding: '12px 8px' }}>Temperatur Air (°C)</th>
                <th style={{ padding: '12px 8px' }}>Baterai / Aki</th>
                <th style={{ padding: '12px 8px' }}>Sinyal RSSI</th>
                <th style={{ padding: '12px 8px' }}>Sumber Data</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.08)' }}>
                  <td className="mono-text" style={{ padding: '12px 8px', color: '#f8fafc' }}>
                    {new Date(row.timestamp).toLocaleString('id-ID')}
                  </td>
                  <td className="mono-text" style={{ padding: '12px 8px', fontWeight: 700, color: '#38bdf8' }}>
                    {Number(row.water_level_cm).toFixed(1)} cm
                  </td>
                  <td className="mono-text" style={{ padding: '12px 8px', color: '#94a3b8' }}>
                    {Number(row.raw_distance_cm).toFixed(1)} cm
                  </td>
                  <td className="mono-text" style={{ padding: '12px 8px', color: '#94a3b8' }}>
                    {row.temperature_c ? `${Number(row.temperature_c).toFixed(1)} °C` : '-'}
                  </td>
                  <td className="mono-text" style={{ padding: '12px 8px' }}>
                    <span style={{ color: Number(row.battery_voltage) < 11.5 ? '#f59e0b' : '#34d399' }}>
                      {row.battery_voltage ? `${Number(row.battery_voltage).toFixed(2)} V` : '-'}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '6px' }}>
                      ({row.battery_percent}%)
                    </span>
                  </td>
                  <td className="mono-text" style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>
                    {row.signal_quality ? `${row.signal_quality} dBm` : '-'}
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <span className={`badge ${row.source === 'live' ? 'badge-emerald' : 'badge-cyan'}`}>
                      {row.source === 'live' ? <Radio size={12} /> : <HardDrive size={12} />}
                      {row.source === 'live' ? 'LIVE MQTT' : 'SD BUFFER'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(59, 130, 246, 0.15)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Halaman {page} dari {totalPages}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft size={16} />
              <span>Sebelumnya</span>
            </button>
            <button
              className="btn btn-secondary"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              <span>Berikutnya</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
