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
  const [sliderIndex, setSliderIndex] = useState(null);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const [customTidalData, setCustomTidalData] = useState(null);
  const [loadingTidal, setLoadingTidal] = useState(false);
  const svgRef = React.useRef(null);

  const effectiveTidal = customTidalData || tidalData;
  const series = effectiveTidal?.series || [];
  const highTides = effectiveTidal?.highTides || [];
  const lowTides = effectiveTidal?.lowTides || [];
  const stats = effectiveTidal?.stats || { hht: 0, llt: 0, msl: 0, tidalRange: 0, avgPeriodHours: 12.42 };
  const currentStatus = effectiveTidal?.currentStatus || { status: 'SLACK', label: 'Air Tenang', ratePerHour: 0 };

  const fetchTidalWithFilter = async (sDate = startDate, eDate = endDate) => {
    if (!device?.device_id) return;
    setLoadingTidal(true);
    try {
      const q = new URLSearchParams();
      if (sDate) {
        const s = new Date(sDate);
        if (!isNaN(s.getTime())) q.set('start', s.toISOString());
      }
      if (eDate) {
        const e = new Date(eDate);
        if (!isNaN(e.getTime())) q.set('end', e.toISOString());
      }
      const res = await fetch(`/api/readings/${device.device_id}/tidal?${q}`);
      const json = await res.json();
      if (json.success) {
        setCustomTidalData(json);
        setSliderIndex(null);
      }
    } catch (e) {
      console.error('Error fetching custom tidal:', e);
    } finally {
      setLoadingTidal(false);
    }
  };

  const fetchHistorical = async () => {
    if (!device?.device_id) return;
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
      const res = await fetch(`/api/readings/${device.device_id}?${q}`);
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

  const handleApplyFilter = () => {
    fetchHistorical();
    fetchTidalWithFilter(startDate, endDate);
  };

  const handlePresetRange = (hours) => {
    const end = new Date();
    const start = new Date(Date.now() - hours * 3600 * 1000);
    const startStr = formatDateTimeLocal(start);
    const endStr = formatDateTimeLocal(end);
    setStartDate(startStr);
    setEndDate(endStr);
    fetchTidalWithFilter(startStr, endStr);
  };

  useEffect(() => {
    if (device?.device_id) {
      fetchHistorical();
    }
  }, [device]);

  const handleExportCSV = () => {
    if (!device?.device_id) return;
    const q = new URLSearchParams();
    if (startDate) {
      const s = new Date(startDate);
      if (!isNaN(s.getTime())) q.set('start', s.toISOString());
    }
    if (endDate) {
      const e = new Date(endDate);
      if (!isNaN(e.getTime())) q.set('end', e.toISOString());
    }
    window.location.href = `/api/export/${device.device_id}?${q}`;
  };

  // Generate SVG chart points mapped to the selected time domain (startDate to endDate)
  const svgWidth = 850;
  const svgHeight = 280;
  const paddingX = 40;
  const paddingY = 35;

  const levels = series.map(s => Number(s.smoothed_level) || Number(s.water_level_cm) || 0);
  const minLevel = levels.length ? Math.floor(Math.min(...levels) - 15) : 100;
  const maxLevel = levels.length ? Math.ceil(Math.max(...levels) + 15) : 350;
  const levelRange = Math.max(20, maxLevel - minLevel);

  // Time bounds from filter or fallback to series
  const filterStartTime = startDate ? new Date(startDate).getTime() : (series.length ? new Date(series[0].timestamp).getTime() : 0);
  const filterEndTime = endDate ? new Date(endDate).getTime() : (series.length ? new Date(series[series.length - 1].timestamp).getTime() : 0);
  const totalDuration = Math.max(1000, filterEndTime - filterStartTime);

  const points = series.map((s, i) => {
    let x;
    if (filterStartTime && filterEndTime && filterEndTime > filterStartTime && s.timestamp) {
      const pTime = new Date(s.timestamp).getTime();
      const progress = Math.min(1, Math.max(0, (pTime - filterStartTime) / totalDuration));
      x = paddingX + progress * (svgWidth - paddingX * 2);
    } else {
      x = paddingX + (i / Math.max(1, series.length - 1)) * (svgWidth - paddingX * 2);
    }
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

  // Active draggable marker position
  const activePointIndex = sliderIndex !== null 
    ? Math.min(Math.max(0, sliderIndex), Math.max(0, points.length - 1))
    : (points.length > 0 ? Math.floor(points.length / 2) : 0);
  const activePoint = points[activePointIndex] || null;

  const handlePointerMove = (e) => {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const offsetX = clientX - rect.left;
    const svgX = (offsetX / rect.width) * svgWidth;
    
    // Find closest point along x axis
    let closestIdx = 0;
    let minDist = Infinity;
    points.forEach((p, idx) => {
      const dist = Math.abs(p.x - svgX);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = idx;
      }
    });
    setSliderIndex(closestIdx);
  };

  const handlePointerDown = (e) => {
    setIsDraggingSlider(true);
    handlePointerMove(e);
  };

  const handlePointerUp = () => {
    setIsDraggingSlider(false);
  };

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
              Estimasi otomatis gelombang pasang semi-diurnal &bull; Pemantauan Oseanografi Air Laut
            </p>
          </div>
        </div>

        {/* Dedicated Date & Time Filter Bar - Paling Atas Memengaruhi Metrik HHT, LLT, MSL & Kurva */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '12px 16px',
          marginTop: '22px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={15} color="#003882" />
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                DARI:
              </span>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  fontSize: '0.76rem',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontWeight: 600,
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={15} color="#003882" />
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                HINGGA:
              </span>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  fontSize: '0.76rem',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontWeight: 600,
                  outline: 'none'
                }}
              />
            </div>

            <button
              type="button"
              onClick={handleApplyFilter}
              disabled={loadingTidal}
              className="btn btn-primary"
              style={{ padding: '6px 14px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Filter size={13} />
              <span>{loadingTidal ? 'Memfilter...' : 'Terapkan Waktu'}</span>
            </button>
          </div>

          {/* Quick Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>Preset:</span>
            <button
              type="button"
              onClick={() => handlePresetRange(6)}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#003882',
                cursor: 'pointer'
              }}
            >
              6 Jam
            </button>
            <button
              type="button"
              onClick={() => handlePresetRange(12)}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#003882',
                cursor: 'pointer'
              }}
            >
              12 Jam
            </button>
            <button
              type="button"
              onClick={() => handlePresetRange(24)}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#003882',
                cursor: 'pointer'
              }}
            >
              24 Jam
            </button>
            <button
              type="button"
              onClick={() => handlePresetRange(48)}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#003882',
                cursor: 'pointer'
              }}
            >
              48 Jam
            </button>
          </div>
        </div>

        {/* 5 Tidal KPI & Dynamics Cards (Termasuk Status Air Tenang / Slack) */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', 
          gap: '14px', 
          marginTop: '20px' 
        }}>
          {/* Card 1: Status Dinamika Air / Slack Water */}
          <div className="subtle-panel" style={{ 
            borderLeft: `4px solid ${series.length === 0 ? '#94a3b8' : currentStatus.status === 'RISING' ? '#059669' : currentStatus.status === 'FALLING' ? '#d97706' : '#0284c7'}`,
            background: series.length === 0 ? '#f8fafc' : currentStatus.status === 'RISING' ? '#f0fdf4' : currentStatus.status === 'FALLING' ? '#fffbeb' : '#f0f9ff'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {series.length === 0 ? (
                <Minus size={15} color="#94a3b8" />
              ) : currentStatus.status === 'RISING' ? (
                <TrendingUp size={15} color="#059669" />
              ) : currentStatus.status === 'FALLING' ? (
                <TrendingDown size={15} color="#d97706" />
              ) : (
                <Waves size={15} color="#0284c7" />
              )}
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>STATUS DINAMIKA AIR</span>
            </div>
            <div className="mono-text" style={{ 
              fontSize: '1.25rem', 
              fontWeight: 800, 
              color: series.length === 0 ? '#64748b' : currentStatus.status === 'RISING' ? '#059669' : currentStatus.status === 'FALLING' ? '#d97706' : '#0284c7', 
              marginTop: '4px' 
            }}>
              {series.length === 0 ? 'Tidak Ada Data' : (currentStatus.label || 'Air Tenang')}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
              {series.length === 0 ? 'Rentang waktu kosong' : `Laju: ${Math.abs(Number(currentStatus.ratePerHour) || 0).toFixed(1)} cm/jam`}
            </div>
          </div>

          <div className="subtle-panel" style={{ borderLeft: '4px solid #003882' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={15} color="#003882" />
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>HHT (PASANG TERTINGGI)</span>
            </div>
            <div className="mono-text" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
              {series.length > 0 && stats.hht != null ? (Number(stats.hht) / 100).toFixed(2) : '--'}{' '}
              <span style={{ fontSize: '0.82rem', color: '#003882' }}>m</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
              {series.length > 0 && stats.hht != null ? `${Number(stats.hht).toFixed(1)} cm` : 'Tidak ada data'}
            </div>
          </div>

          <div className="subtle-panel" style={{ borderLeft: '4px solid #d97706' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingDown size={15} color="#d97706" />
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>LLT (SURUT TERENDAH)</span>
            </div>
            <div className="mono-text" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
              {series.length > 0 && stats.llt != null ? (Number(stats.llt) / 100).toFixed(2) : '--'}{' '}
              <span style={{ fontSize: '0.82rem', color: '#d97706' }}>m</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
              {series.length > 0 && stats.llt != null ? `${Number(stats.llt).toFixed(1)} cm` : 'Tidak ada data'}
            </div>
          </div>

          <div className="subtle-panel" style={{ borderLeft: '4px solid #059669' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Anchor size={15} color="#059669" />
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>MSL (DUDUK TENGAH)</span>
            </div>
            <div className="mono-text" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
              {series.length > 0 && stats.msl != null ? (Number(stats.msl) / 100).toFixed(2) : '--'}{' '}
              <span style={{ fontSize: '0.82rem', color: '#059669' }}>m</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
              {series.length > 0 && stats.msl != null ? `${Number(stats.msl).toFixed(1)} cm` : 'Tidak ada data'}
            </div>
          </div>

          <div className="subtle-panel" style={{ borderLeft: '4px solid #7c3aed' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={15} color="#7c3aed" />
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>TUNGGANG AIR (RANGE)</span>
            </div>
            <div className="mono-text" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
              {series.length > 0 && stats.tidalRange != null ? (Number(stats.tidalRange) / 100).toFixed(2) : '--'}{' '}
              <span style={{ fontSize: '0.82rem', color: '#7c3aed' }}>m</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
              {series.length > 0 ? `Periode M2: ${stats.avgPeriodHours || '12.42'} jam` : 'Tidak ada data'}
            </div>
          </div>
        </div>

        {/* Kurva Profil Pasang Surut Header */}
        <div style={{ marginTop: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                Kurva Profil Pasang Surut &amp; Dinamika Air
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                Visualisasi elevasi dan titik pasang/surut berdasarkan filter waktu di atas
              </div>
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

          <div 
            style={{ 
              width: '100%', 
              background: '#ffffff', 
              borderRadius: '12px', 
              border: '1px solid #e2e8f0', 
              padding: '16px',
              position: 'relative',
              userSelect: 'none'
            }}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {series.length === 0 ? (
              <div style={{ height: '240px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#94a3b8' }}>
                <Waves size={32} color="#cbd5e1" />
                <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Tidak ada data telemetri yang tercatat pada rentang waktu ini</span>
                <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>Silakan sesuaikan filter tanggal &amp; jam di atas</span>
              </div>
            ) : (
              <div>
                <svg 
                  ref={svgRef}
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
                  style={{ 
                    width: '100%', 
                    height: 'auto', 
                    display: 'block', 
                    overflow: 'visible',
                    cursor: isDraggingSlider ? 'grabbing' : 'crosshair',
                    touchAction: 'none'
                  }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={(e) => {
                    if (isDraggingSlider || e.buttons === 1) {
                      handlePointerMove(e);
                    }
                  }}
                  onClick={handlePointerMove}
                >
                  <defs>
                    <linearGradient id="tidalGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#003882" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#003882" stopOpacity="0.0" />
                    </linearGradient>
                    <filter id="sliderShadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.25" />
                    </filter>
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

                  {/* Empty/Awaiting Data Zone if data only partially fills the selected filter window */}
                  {points.length > 0 && points[points.length - 1].x < (svgWidth - paddingX - 10) && (
                    <g>
                      <rect 
                        x={points[points.length - 1].x} 
                        y={paddingY} 
                        width={(svgWidth - paddingX) - points[points.length - 1].x} 
                        height={svgHeight - paddingY * 2} 
                        fill="#f8fafc" 
                        opacity="0.75"
                        stroke="#e2e8f0"
                        strokeDasharray="4 4"
                      />
                      <text 
                        x={points[points.length - 1].x + ((svgWidth - paddingX) - points[points.length - 1].x) / 2} 
                        y={svgHeight / 2} 
                        fill="#94a3b8" 
                        fontSize="11" 
                        fontWeight="700" 
                        textAnchor="middle"
                      >
                        (Belum ada data / rentang kosong)
                      </text>
                    </g>
                  )}

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

                  {/* ========================================= */}
                  {/* DRAGGABLE SLIDER LINE & REAL-TIME BADGE */}
                  {/* ========================================= */}
                  {activePoint && (
                    <g style={{ cursor: 'ew-resize' }}>
                      {/* Vertical line indicator */}
                      <line 
                        x1={activePoint.x} 
                        y1={paddingY - 10} 
                        x2={activePoint.x} 
                        y2={svgHeight - paddingY + 10} 
                        stroke="#2563eb" 
                        strokeWidth="2" 
                        strokeDasharray="4 3"
                      />

                      {/* Line Handle at bottom */}
                      <circle 
                        cx={activePoint.x} 
                        cy={svgHeight - paddingY + 10} 
                        r="6" 
                        fill="#2563eb" 
                        stroke="#ffffff" 
                        strokeWidth="2" 
                      />

                      {/* Focal Intersection Point on the Curve */}
                      <circle 
                        cx={activePoint.x} 
                        cy={activePoint.y} 
                        r="8" 
                        fill="#2563eb" 
                        stroke="#ffffff" 
                        strokeWidth="3" 
                        filter="url(#sliderShadow)"
                      />

                      {/* Tooltip Badge showing value in cm */}
                      <g 
                        transform={`translate(${Math.min(Math.max(activePoint.x, paddingX + 50), svgWidth - paddingX - 50)}, ${Math.max(24, activePoint.y - 28)})`}
                        filter="url(#sliderShadow)"
                      >
                        <rect 
                          x="-46" 
                          y="-18" 
                          width="92" 
                          height="26" 
                          rx="6" 
                          fill="#0f172a" 
                        />
                        <polygon 
                          points="-5,8 5,8 0,13" 
                          fill="#0f172a" 
                        />
                        <text 
                          x="0" 
                          y="-1" 
                          fill="#ffffff" 
                          fontSize="12" 
                          fontWeight="800" 
                          fontFamily="monospace" 
                          textAnchor="middle"
                        >
                          {Number(activePoint.val).toFixed(1)} cm
                        </text>
                      </g>

                      {/* Timestamp at the bottom of the slider */}
                      {activePoint.data?.timestamp && (
                        <g transform={`translate(${Math.min(Math.max(activePoint.x, paddingX + 40), svgWidth - paddingX - 40)}, ${svgHeight - paddingY + 28})`}>
                          <rect x="-35" y="-10" width="70" height="18" rx="4" fill="#e2e8f0" />
                          <text x="0" y="3" fill="#334155" fontSize="10" fontWeight="700" textAnchor="middle">
                            {new Date(activePoint.data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </text>
                        </g>
                      )}
                    </g>
                  )}
                </svg>
              </div>
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
                </tr>
              </thead>
              <tbody>
                {loadingHistory ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                      Memuat rekaman data historis...
                    </td>
                  </tr>
                ) : paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
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
                      <td className="mono-text" style={{ fontWeight: 800, color: '#0f172a' }}>
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
