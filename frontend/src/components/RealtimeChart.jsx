import React, { useState } from 'react';
import { Activity, Clock } from 'lucide-react';

export default function RealtimeChart({ readings = [] }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Take the most recent 60 readings
  const displayData = readings.slice(-60);

  if (displayData.length === 0) {
    return (
      <div className="corporate-card" style={{ padding: '24px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Menunggu aliran data telemetri real-time...</p>
      </div>
    );
  }

  const values = displayData.map(d => Number(d.water_level_cm) || 0);
  const minVal = Math.floor(Math.min(...values) - 5);
  const maxVal = Math.ceil(Math.max(...values) + 5);
  const range = Math.max(10, maxVal - minVal);
  const currentVal = values[values.length - 1];

  // SVG dimensions
  const svgWidth = 600;
  const svgHeight = 220;
  const paddingX = 20;
  const paddingY = 25;

  const points = displayData.map((d, i) => {
    const x = paddingX + (i / Math.max(1, displayData.length - 1)) * (svgWidth - paddingX * 2);
    const y = svgHeight - paddingY - ((Number(d.water_level_cm) - minVal) / range) * (svgHeight - paddingY * 2);
    return { x, y, data: d };
  });

  const pathD = points.length > 0 
    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
    : '';

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z`
    : '';

  return (
    <div className="corporate-card" style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: '#edf2fc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#003882'
          }}>
            <Activity size={18} />
          </div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
            Grafik Telemetri Real-Time (60 Menit Terakhir)
          </h3>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 500 }}>
            Min: <span className="mono-text" style={{ color: '#003882', fontWeight: 700 }}>{minVal + 5} cm</span> &bull; 
            Max: <span className="mono-text" style={{ color: '#003882', fontWeight: 700 }}> {maxVal - 5} cm</span>
          </div>
          <span className="badge badge-navy">
            <Clock size={12} /> {displayData.length} Sampel
          </span>
        </div>
      </div>

      {/* SVG Chart Area */}
      <div style={{ position: 'relative', width: '100%', flex: 1, minHeight: '200px' }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="realtimeAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#003882" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#003882" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={paddingX} y1={paddingY} x2={svgWidth - paddingX} y2={paddingY} stroke="#f1f5f9" strokeDasharray="4 4" strokeWidth="1.5" />
          <line x1={paddingX} y1={svgHeight / 2} x2={svgWidth - paddingX} y2={svgHeight / 2} stroke="#f1f5f9" strokeDasharray="4 4" strokeWidth="1.5" />
          <line x1={paddingX} y1={svgHeight - paddingY} x2={svgWidth - paddingX} y2={svgHeight - paddingY} stroke="#f1f5f9" strokeDasharray="4 4" strokeWidth="1.5" />

          {/* Area Fill */}
          <path d={areaD} fill="url(#realtimeAreaGrad)" className="chart-animated-area" />

          {/* Line Stroke */}
          <path d={pathD} fill="none" stroke="#003882" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className="chart-animated-line" />

          {/* Live Telemetry Beacon Ping on Latest Reading */}
          {points.length > 0 && (
            <circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r="8"
              fill="none"
              stroke="#0284c7"
              strokeWidth="2.5"
              className="chart-beacon-pulse"
              pointerEvents="none"
            />
          )}

          {/* Data Points on Hover / End */}
          {points.map((p, idx) => (
            <circle
              key={idx}
              cx={p.x}
              cy={p.y}
              r={hoveredPoint?.data === p.data ? 6.5 : (idx === points.length - 1 ? 5.5 : 2.5)}
              fill={idx === points.length - 1 ? "#003882" : "#38bdf8"}
              stroke="#ffffff"
              strokeWidth={idx === points.length - 1 ? 2.5 : 1}
              style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
              onMouseEnter={() => setHoveredPoint(p)}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          ))}
        </svg>

        {/* Hover Tooltip */}
        {hoveredPoint && (
          <div style={{
            position: 'absolute',
            left: `${(hoveredPoint.x / svgWidth) * 100}%`,
            top: `${(hoveredPoint.y / svgHeight) * 100 - 35}%`,
            transform: 'translate(-50%, -100%)',
            background: '#ffffff',
            border: '1px solid #d0deee',
            padding: '6px 12px',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0, 56, 130, 0.12)',
            pointerEvents: 'none',
            zIndex: 10,
            whiteSpace: 'nowrap'
          }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#003882' }}>
              {Number(hoveredPoint.data.water_level_cm).toFixed(1)} cm
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
              Dist: {Number(hoveredPoint.data.raw_distance_cm).toFixed(1)} cm
            </div>
          </div>
        )}
      </div>

      {/* Time axis footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>
        <span>60 Menit Lalu</span>
        <span>30 Menit Lalu</span>
        <span style={{ color: '#003882', fontWeight: 800 }}>Terkini ({currentVal?.toFixed(1)} cm)</span>
      </div>

    </div>
  );
}
