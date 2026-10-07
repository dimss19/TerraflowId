import React, { useState } from 'react';
import { 
  Waves, 
  TrendingUp, 
  TrendingDown, 
  Compass, 
  Calendar, 
  Clock, 
  Anchor, 
  Layers, 
  BarChart2,
  ChevronRight
} from 'lucide-react';

export default function TidalAnalysisView({ tidalData, onTimeframeChange }) {
  const [selectedDay, setSelectedDay] = useState(7); // Day of current month
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const series = tidalData?.series || [];
  const highTides = tidalData?.highTides || [];
  const lowTides = tidalData?.lowTides || [];
  const stats = tidalData?.stats || { hht: 0, llt: 0, msl: 0, tidalRange: 0, avgPeriodHours: 12.42 };
  const currentStatus = tidalData?.currentStatus || { status: 'SLACK', label: 'Air Tenang', ratePerHour: 0 };

  // Generate 24-hour chart points
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 1. Header & Dynamic Tidal Banner */}
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
                <Waves size={22} />
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
                Kurva &amp; Dinamika Pasang Surut Air Laut (Tidal Analysis)
              </h2>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#64748b', marginTop: '4px' }}>
              Deteksi otomatis gelombang pasang semi-diurnal (M2/S2) &bull; Estuari Muara &bull; PT Tanah Airku Teknologi
            </p>
          </div>

          {/* Current Tide Dynamic Status Badge */}
          <div style={{
            padding: '12px 20px',
            borderRadius: '12px',
            background: currentStatus.status === 'RISING' 
              ? '#ecfdf5' 
              : currentStatus.status === 'FALLING' 
                ? '#fffbeb' 
                : '#edf2fc',
            border: `1px solid ${currentStatus.status === 'RISING' ? '#a7f3d0' : currentStatus.status === 'FALLING' ? '#fde68a' : '#bfdbfe'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            {currentStatus.status === 'RISING' ? (
              <TrendingUp size={24} color="#059669" />
            ) : currentStatus.status === 'FALLING' ? (
              <TrendingDown size={24} color="#d97706" />
            ) : (
              <Compass size={24} color="#003882" />
            )}
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>STATUS PASANG SURUT SAAT INI</div>
              <div style={{ 
                fontSize: '1.05rem', 
                fontWeight: 800, 
                color: currentStatus.status === 'RISING' ? '#059669' : currentStatus.status === 'FALLING' ? '#d97706' : '#003882' 
              }}>
                {currentStatus.label}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {currentStatus.description}
              </div>
            </div>
          </div>
        </div>

        {/* Oceanographic Statistics Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
          gap: '16px', 
          marginTop: '24px' 
        }}>
          <div className="subtle-panel">
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>HIGHEST HIGH TIDE (HHT)</div>
            <div className="mono-text" style={{ fontSize: '1.35rem', fontWeight: 800, color: '#003882', marginTop: '4px' }}>
              {stats.hht.toFixed(1)} cm
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Puncak Tertinggi 24 Jam</div>
          </div>

          <div className="subtle-panel">
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>LOWEST LOW TIDE (LLT)</div>
            <div className="mono-text" style={{ fontSize: '1.35rem', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>
              {stats.llt.toFixed(1)} cm
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Titik Surut Terendah</div>
          </div>

          <div className="subtle-panel">
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>MEAN SEA LEVEL (MSL)</div>
            <div className="mono-text" style={{ fontSize: '1.35rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
              {stats.msl.toFixed(1)} cm
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Elevasi Rata-Rata Acuan</div>
          </div>

          <div className="subtle-panel">
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>TIDAL RANGE</div>
            <div className="mono-text" style={{ fontSize: '1.35rem', fontWeight: 800, color: '#003882', marginTop: '4px' }}>
              {stats.tidalRange.toFixed(1)} cm
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Rentang Pasang - Surut</div>
          </div>

          <div className="subtle-panel">
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>PERIODE PASUT TERDETEKSI</div>
            <div className="mono-text" style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
              {stats.avgPeriodHours ? `${stats.avgPeriodHours} Jam` : '~12.4 Jam'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Tipe Semi-Diurnal (Ganda)</div>
          </div>
        </div>
      </div>

      {/* 2. 24-Hour Area Tidal Curve Chart */}
      <div className="corporate-card" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
              Kurva Pasang Surut 24 Jam (24-Hour Tidal Wave Curve)
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
              Data ketinggian air dengan pin deteksi puncak (🔺 High Tide) dan lembah (🔻 Low Tide)
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <span className="badge badge-navy">
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#003882' }}></span>
              Garis Gelombang Pasut
            </span>
            <span className="badge badge-emerald">
              🔺 High Tide
            </span>
            <span className="badge badge-amber">
              🔻 Low Tide
            </span>
          </div>
        </div>

        {/* SVG Curve Container */}
        <div style={{ position: 'relative', width: '100%', minHeight: '300px' }}>
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            preserveAspectRatio="none"
            style={{ width: '100%', height: '300px', overflow: 'visible' }}
          >
            <defs>
              <linearGradient id="tidalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#003882" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#003882" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid Horizontal Lines */}
            {[0.2, 0.4, 0.6, 0.8].map((ratio, idx) => (
              <line
                key={idx}
                x1={paddingX}
                y1={paddingY + ratio * (svgHeight - paddingY * 2)}
                x2={svgWidth - paddingX}
                y2={paddingY + ratio * (svgHeight - paddingY * 2)}
                stroke="#f1f5f9"
                strokeDasharray="4 4"
                strokeWidth="1.5"
              />
            ))}

            {/* Mean Sea Level Reference Line */}
            {stats.msl > 0 && (
              <line
                x1={paddingX}
                y1={svgHeight - paddingY - ((stats.msl - minLevel) / levelRange) * (svgHeight - paddingY * 2)}
                x2={svgWidth - paddingX}
                y2={svgHeight - paddingY - ((stats.msl - minLevel) / levelRange) * (svgHeight - paddingY * 2)}
                stroke="#10b981"
                strokeDasharray="6 3"
                strokeWidth="1.5"
              />
            )}

            {/* Curve Area Fill */}
            <path d={areaD} fill="url(#tidalGradient)" />

            {/* Main Tidal Wave Path */}
            <path d={pathD} fill="none" stroke="#003882" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

            {/* High Tide Markers */}
            {highMarkers.map((ht, idx) => (
              <g key={`ht-${idx}`}>
                <circle cx={ht.x} cy={ht.y} r={7} fill="#10b981" stroke="#ffffff" strokeWidth="2.5" />
                <text x={ht.x} y={ht.y - 12} fill="#059669" fontSize="11" fontWeight="800" textAnchor="middle">
                  ▲ {ht.water_level_cm?.toFixed(1)} cm
                </text>
              </g>
            ))}

            {/* Low Tide Markers */}
            {lowMarkers.map((lt, idx) => (
              <g key={`lt-${idx}`}>
                <circle cx={lt.x} cy={lt.y} r={7} fill="#d97706" stroke="#ffffff" strokeWidth="2.5" />
                <text x={lt.x} y={lt.y + 20} fill="#d97706" fontSize="11" fontWeight="800" textAnchor="middle">
                  ▼ {lt.water_level_cm?.toFixed(1)} cm
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Time Axis */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 40px', marginTop: '16px', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
          <span>00:00 (Surut Awal)</span>
          <span>06:00 (Pasang Pagi)</span>
          <span>12:00 (Surut Siang)</span>
          <span>18:00 (Pasang Sore)</span>
          <span>24:00 (Terkini)</span>
        </div>
      </div>

    </div>
  );
}
