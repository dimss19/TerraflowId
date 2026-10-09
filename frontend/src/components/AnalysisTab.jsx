import React, { useState, useEffect } from 'react';
import { 
  Waves, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Anchor, 
  Layers, 
  BarChart2, 
  ChevronRight,
  FileText,
  Download,
  Filter,
  RefreshCw,
  ChevronLeft,
  Calendar,
  CheckCircle2,
  Minus
} from 'lucide-react';

export default function AnalysisTab({ device, tidalData, onRefresh }) {
  // --- Historical State ---
  const [readings, setReadings] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Helper to format Date into local YYYY-MM-DDTHH:mm string for datetime-local input
  const formatDateTimeLocal = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Filter dates (default to past 24 hours in local browser time)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(Date.now() - 24 * 3600 * 1000);
    return formatDateTimeLocal(d);
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return formatDateTimeLocal(d);
  });

  // --- Tidal Analysis State ---
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const series = tidalData?.series || [];
  const highTides = tidalData?.highTides || [];
  const lowTides = tidalData?.lowTides || [];
  const stats = tidalData?.stats || { hht: 0, llt: 0, msl: 0, tidalRange: 0, avgPeriodHours: 12.42 };
  const currentStatus = tidalData?.currentStatus || { status: 'SLACK', label: 'Air Tenang', ratePerHour: 0 };

  const fetchHistorical = async () => {
    setLoadingHistory(true);
    try {
      const q = new URLSearchParams({ limit: 1000 });
      if (startDate) {
        const s = new Date(startDate);
        if (!isNaN(s.getTime())) q.set('start', s.toISOString());
      }
      if (endDate) {
        const e = new Date(endDate);
        if (!isNaN(e.getTime())) q.set('end', e.toISOString());
      }
      const res = await fetch(`/api/readings/${device?.device_id || 'AWLR-001'}?${q}`);
      const json = await res.json();
      if (json.success) {
        setReadings(json.data);
        setPage(1);
      }
    } catch (e) {
      console.error('Error fetching historical:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (device) {
      fetchHistorical();
    }
  }, [device]);

  const handleExportCSV = () => {
    const q = new URLSearchParams();
    if (startDate) {
      const s = new Date(startDate);
      if (!isNaN(s.getTime())) q.set('start', s.toISOString());
    }
    if (endDate) {
      const e = new Date(endDate);
      if (!isNaN(e.getTime())) q.set('end', e.toISOString());
    }
    window.location.href = `/api/export/${device?.device_id || 'AWLR-001'}?${q}`;
  };

  // Generate 24-hour SVG chart points
  const svgWidth = 850;
  const svgHeight = 280;
  const paddingX = 40;
  const paddingY = 35;

  const levels = series.map(s => Number(s.smoothed_level) || Number(s.water_level_cm) || 0);
  const minLevel = levels.length ? Math.floor(Math.min(...levels) - 15) : 100;
  const maxLevel = levels.length ? Math.ceil(Math.max(...levels) + 15) : 350;
  const levelRange = Math.max(20, maxLevel - minLevel);

  const points = series.map((s, i) => {
    const x = paddingX + (i / Math.max(1, series.length - 1)) * (svgWidth - paddingX * 2);
    const val = Number(s.smoothed_level) || Number(s.water_level_cm) || 0;
    const y = svgHeight - paddingY - ((val - minLevel) / levelRange) * (svgHeight - paddingY * 2);
    return { x, y, data: s, val };
  });

  const pathD = points.length > 0
    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
    : '';

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z`
    : '';

  // Match high/low tide coordinates
  const highMarkers = highTides.map(ht => {
    const found = points.find(p => p.data.timestamp === ht.timestamp) || points[0];
    return { ...ht, x: found ? found.x : paddingX, y: found ? found.y : paddingY };
  });

  const lowMarkers = lowTides.map(lt => {
    const found = points.find(p => p.data.timestamp === lt.timestamp) || points[0];
    return { ...lt, x: found ? found.x : paddingX, y: found ? found.y : paddingY };
  });

  const totalPages = Math.ceil(readings.length / pageSize) || 1;
  const paginatedData = readings.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* ========================================================= */}
      {/* SECTION 1: KURVA & ANALISIS PASANG SURUT */}
      {/* ========================================================= */}
      <div className="corporate-card" style={{ padding: '28px' }}>
        
        {/* Header & Tidal Status Badge */}
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
                <TrendingUp size={22} />
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Analisis Pasang Surut &amp; Dinamika Air
              </h2>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#64748b', marginTop: '4px', marginBottom: 0 }}>
              Estimasi otomatis gelombang pasang semi-diurnal &bull; Stasiun {device?.name || device?.device_id}
            </p>
          </div>

          {/* Current Tide Status Badge */}
          <div style={{
            padding: '10px 18px',
            borderRadius: '12px',
            background: currentStatus.status === 'RISING' 
              ? '#ecfdf5' 
              : currentStatus.status === 'FALLING' 
                ? '#fffbeb' 
                : '#edf2fc',
            border: `1px solid ${currentStatus.status === 'RISING' ? '#a7f3d0' : currentStatus.status === 'FALLING' ? '#fde68a' : '#bfdbfe'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            {currentStatus.status === 'RISING' ? (
              <TrendingUp size={20} color="#059669" />
            ) : currentStatus.status === 'FALLING' ? (
              <TrendingDown size={20} color="#d97706" />
            ) : (
              <Minus size={20} color="#003882" />
            )}
            <div>
              <div style={{
                fontSize: '0.88rem',
                fontWeight: 800,
                color: currentStatus.status === 'RISING' ? '#059669' : currentStatus.status === 'FALLING' ? '#d97706' : '#003882',
                textTransform: 'uppercase'
              }}>
                {currentStatus.label || 'Air Tenang'}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                Laju: {Math.abs(Number(currentStatus.ratePerHour) || 0).toFixed(1)} cm/jam
              </div>
            </div>
          </div>
        </div>

        {/* 4 Tidal KPI Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
          gap: '14px', 
          marginTop: '24px' 
        }}>
          <div className="subtle-panel" style={{ borderLeft: '4px solid #003882' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={15} color="#003882" />
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>HHT (PASANG TERTINGGI)</span>
            </div>
            <div className="mono-text" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
              {stats.hht != null ? (Number(stats.hht) / 100).toFixed(2) : '--'}{' '}
              <span style={{ fontSize: '0.82rem', color: '#003882' }}>m</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
              {stats.hht != null ? `${Number(stats.hht).toFixed(1)} cm` : ''}
            </div>
          </div>

          <div className="subtle-panel" style={{ borderLeft: '4px solid #d97706' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingDown size={15} color="#d97706" />
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>LLT (SURUT TERENDAH)</span>
            </div>
            <div className="mono-text" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
              {stats.llt != null ? (Number(stats.llt) / 100).toFixed(2) : '--'}{' '}
              <span style={{ fontSize: '0.82rem', color: '#d97706' }}>m</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
              {stats.llt != null ? `${Number(stats.llt).toFixed(1)} cm` : ''}
            </div>
          </div>

          <div className="subtle-panel" style={{ borderLeft: '4px solid #059669' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Anchor size={15} color="#059669" />
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>MSL (DUDUK TENGAH)</span>
            </div>
            <div className="mono-text" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
              {stats.msl != null ? (Number(stats.msl) / 100).toFixed(2) : '--'}{' '}
              <span style={{ fontSize: '0.82rem', color: '#059669' }}>m</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
              {stats.msl != null ? `${Number(stats.msl).toFixed(1)} cm` : ''}
            </div>
          </div>

          <div className="subtle-panel" style={{ borderLeft: '4px solid #7c3aed' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={15} color="#7c3aed" />
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>TUNGGANG AIR (RANGE)</span>
            </div>
            <div className="mono-text" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
              {stats.tidalRange != null ? (Number(stats.tidalRange) / 100).toFixed(2) : '--'}{' '}
              <span style={{ fontSize: '0.82rem', color: '#7c3aed' }}>m</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
              Periode M2: {stats.avgPeriodHours || '12.42'} jam
            </div>
          </div>
        </div>

        {/* 24-Hour SVG Tidal Curve */}
        <div style={{ marginTop: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
              Kurva Profil Pasang Surut 24 Jam Terakhir
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', fontWeight: 700 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#003882' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#003882' }} />
                Puncak Pasang (High)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#d97706' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#d97706' }} />
                Lembah Surut (Low)
              </span>
            </div>
          </div>

          <div style={{ 
            width: '100%', 
            background: '#ffffff', 
            borderRadius: '12px', 
            border: '1px solid #e2e8f0', 
            padding: '16px',
            position: 'relative'
          }}>
            {series.length === 0 ? (
              <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                Menunggu pembacaan data pasang surut...
              </div>
            ) : (
              <svg 
                viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
                style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
              >
                <defs>
                  <linearGradient id="tidalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#003882" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#003882" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Guide Lines */}
                {[0.25, 0.5, 0.75].map((pct, idx) => {
                  const y = paddingY + pct * (svgHeight - paddingY * 2);
                  const val = Math.round(maxLevel - pct * levelRange);
                  return (
                    <g key={idx}>
                      <line x1={paddingX} y1={y} x2={svgWidth - paddingX} y2={y} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                      <text x={paddingX - 6} y={y + 3} fill="#94a3b8" fontSize="10" textAnchor="end" fontFamily="monospace">
                        {val} cm
                      </text>
                    </g>
                  );
                })}

                {/* Shaded Area Under Curve */}
                {areaD && <path d={areaD} fill="url(#tidalGradient)" className="chart-animated-area" />}

                {/* Main Curve Line */}
                {pathD && <path d={pathD} fill="none" stroke="#003882" strokeWidth="2.8" strokeLinecap="round" className="chart-animated-line" />}

                {/* High Tide Markers with Animated Pulse */}
                {highMarkers.map((m, idx) => (
                  <g key={`ht-${idx}`}>
                    <circle cx={m.x} cy={m.y} r="10" fill="none" stroke="#003882" strokeWidth="2" className="chart-beacon-pulse" pointerEvents="none" />
                    <circle cx={m.x} cy={m.y} r="6.5" fill="#003882" stroke="#ffffff" strokeWidth="2" />
                    <text x={m.x} y={m.y - 12} fill="#003882" fontSize="11" fontWeight="800" textAnchor="middle">
                      {Number(m.water_level_cm).toFixed(0)} cm
                    </text>
                  </g>
                ))}

                {/* Low Tide Markers with Animated Pulse */}
                {lowMarkers.map((m, idx) => (
                  <g key={`lt-${idx}`}>
                    <circle cx={m.x} cy={m.y} r="10" fill="none" stroke="#d97706" strokeWidth="2" className="chart-beacon-pulse" pointerEvents="none" />
                    <circle cx={m.x} cy={m.y} r="6.5" fill="#d97706" stroke="#ffffff" strokeWidth="2" />
                    <text x={m.x} y={m.y + 20} fill="#d97706" fontSize="11" fontWeight="800" textAnchor="middle">
                      {Number(m.water_level_cm).toFixed(0)} cm
                    </text>
                  </g>
                ))}
              </svg>
            )}
          </div>
        </div>

        {/* Daily High & Low Tide Schedule */}
        {(highTides.length > 0 || lowTides.length > 0) && (
          <div style={{ marginTop: '24px' }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', marginBottom: '12px' }}>
              Jadwal Puncak Pasang &amp; Surut Harian
            </div>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
              gap: '12px' 
            }}>
              {highTides.map((ht, idx) => (
                <div key={`ht-card-${idx}`} className="subtle-panel" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                    <TrendingUp size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>
                      PUNCAK PASANG KE-{idx + 1}
                    </div>
                    <div className="mono-text" style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                      {ht.timestamp ? new Date(ht.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--:--'} &bull; {Number(ht.water_level_cm).toFixed(1)} cm
                    </div>
                  </div>
                </div>
              ))}

              {lowTides.map((lt, idx) => (
                <div key={`lt-card-${idx}`} className="subtle-panel" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                    <TrendingDown size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#d97706', textTransform: 'uppercase' }}>
                      LEMBAH SURUT KE-{idx + 1}
                    </div>
                    <div className="mono-text" style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                      {lt.timestamp ? new Date(lt.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--:--'} &bull; {Number(lt.water_level_cm).toFixed(1)} cm
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ========================================================= */}
      {/* SECTION 2: RIWAYAT TELEMETRI & EKSPOR DATA */}
      {/* ========================================================= */}
      <div className="corporate-card" style={{ padding: '28px' }}>
        
        {/* Title & CSV Export Button */}
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
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Tabel Riwayat Telemetri &amp; Ekspor CSV
              </h2>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#64748b', marginTop: '4px', marginBottom: 0 }}>
              Filter data historis dan unduh berkas CSV terstruktur untuk dokumentasi pelaporan hidrometri
            </p>
          </div>

          <button onClick={handleExportCSV} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Download size={16} />
            <span>Unduh Laporan CSV</span>
          </button>
        </div>

        {/* Date Filter Toolbar */}
        <div style={{ 
          display: 'flex', 
          gap: '14px', 
          marginTop: '24px', 
          flexWrap: 'wrap', 
          alignItems: 'flex-end',
          padding: '16px',
          background: '#f8fafc',
          borderRadius: '10px',
          border: '1px solid #eef2f7'
        }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
              DARI TANGGAL &amp; JAM
            </label>
            <input
              type="datetime-local"
              className="corporate-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
              HINGGA TANGGAL &amp; JAM
            </label>
            <input
              type="datetime-local"
              className="corporate-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={fetchHistorical}
              disabled={loadingHistory}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Filter size={15} />
              <span>Terapkan Filter</span>
            </button>

            <button
              onClick={() => {
                const now = new Date();
                const past = new Date(now.getTime() - 24 * 3600 * 1000);
                setStartDate(past.toISOString().slice(0, 16));
                setEndDate(now.toISOString().slice(0, 16));
                fetchHistorical();
              }}
              disabled={loadingHistory}
              className="btn btn-secondary"
              title="Reset ke 24 Jam Terakhir"
            >
              <RefreshCw size={15} className={loadingHistory ? 'spin' : ''} />
            </button>
          </div>
        </div>

        {/* Tabulated Data Table */}
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>
              Menampilkan {readings.length > 0 ? (page - 1) * pageSize + 1 : 0} - {Math.min(page * pageSize, readings.length)} dari total {readings.length} baris rekaman
            </div>
          </div>

          <div className="table-responsive">
            <table className="corporate-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Waktu (WIB)</th>
                  <th>Elevasi Air</th>
                  <th>Jarak Sensor</th>
                  <th>Sinyal RSSI</th>
                  <th>Sumber</th>
                </tr>
              </thead>
              <tbody>
                {loadingHistory ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                      Memuat rekaman data historis...
                    </td>
                  </tr>
                ) : paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                      Tidak ditemukan data pembacaan dalam rentang tanggal yang dipilih.
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((row, idx) => (
                    <tr key={idx}>
                      <td className="mono-text" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                        {new Date(row.timestamp).toLocaleString('id-ID', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </td>
                      <td className="mono-text" style={{ fontWeight: 800, color: '#003882' }}>
                        {row.water_level_cm != null ? (
                          <>
                            {(Number(row.water_level_cm) / 100).toFixed(2)} m{' '}
                            <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>({Number(row.water_level_cm).toFixed(1)} cm)</span>
                          </>
                        ) : '--'}
                      </td>
                      <td className="mono-text" style={{ color: '#475569' }}>
                        {row.raw_distance_cm != null ? `${Number(row.raw_distance_cm).toFixed(1)} cm` : '--'}
                      </td>
                      <td className="mono-text" style={{ color: '#64748b' }}>
                        {row.signal_quality != null ? `${row.signal_quality} dBm` : '--'}
                      </td>
                      <td>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          background: row.source === 'sd_buffer' ? '#fffbeb' : '#ecfdf5',
                          color: row.source === 'sd_buffer' ? '#d97706' : '#059669',
                          border: `1px solid ${row.source === 'sd_buffer' ? '#fde68a' : '#a7f3d0'}`
                        }}>
                          {row.source === 'sd_buffer' ? 'SD Buffer' : 'Live'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <ChevronLeft size={16} />
                <span>Sebelumnya</span>
              </button>

              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b' }}>
                Halaman {page} dari {totalPages}
              </span>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>Berikutnya</span>
                <ChevronRight size={16} />
              </button>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
