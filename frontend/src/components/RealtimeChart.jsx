import React, { useState } from 'react';
import { Activity, Clock } from 'lucide-react';

export default function RealtimeChart({ readings = [] }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Take the most recent 60 readings
  const displayData = readings.slice(-60);

  if (displayData.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '24px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Menunggu aliran data telemetri real-time...</p>
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
    <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={20} color="#38bdf8" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
            Grafik Telemetri Real-Time (60 Menit Terakhir)
          </h3>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Min: <span className="mono-text" style={{ color: '#38bdf8', fontWeight: 600 }}>{minVal + 5} cm</span> &bull; 
            Max: <span className="mono-text" style={{ color: '#818cf8', fontWeight: 600 }}> {maxVal - 5} cm</span>
          </div>
          <span className="badge badge-cyan">
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
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="realtimeLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#818cf8" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={paddingX} y1={paddingY} x2={svgWidth - paddingX} y2={paddingY} stroke="rgba(148, 163, 184, 0.1)" strokeDasharray="4 4" />
          <line x1={paddingX} y1={svgHeight / 2} x2={svgWidth - paddingX} y2={svgHeight / 2} stroke="rgba(148, 163, 184, 0.1)" strokeDasharray="4 4" />
          <line x1={paddingX} y1={svgHeight - paddingY} x2={svgWidth - paddingX} y2={svgHeight - paddingY} stroke="rgba(148, 163, 184, 0.1)" strokeDasharray="4 4" />

          {/* Area Fill */}
          <path d={areaD} fill="url(#realtimeAreaGrad)" />

          {/* Line Stroke */}
          <path d={pathD} fill="none" stroke="url(#realtimeLineGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Data Points on Hover / End */}
          {points.map((p, idx) => (
            <circle
              key={idx}
              cx={p.x}
              cy={p.y}
              r={hoveredPoint?.data === p.data ? 6 : idx === points.length - 1 ? 4.5 : 2.5}
              fill={idx === points.length - 1 ? '#06b6d4' : '#38bdf8'}
              stroke="#0f172a"
              strokeWidth="1.5"
              style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
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
            top: `${(hoveredPoint.y / svgHeight) * 100}%`,
            transform: 'translate(-50%, -120%)',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(6, 182, 212, 0.5)',
            padding: '8px 12px',
            borderRadius: '8px',
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            whiteSpace: 'nowrap',
            zIndex: 10
          }}>
            <div className="mono-text" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8' }}>
              {Number(hoveredPoint.data.water_level_cm).toFixed(1)} cm
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {new Date(hoveredPoint.data.timestamp).toLocaleTimeString('id-ID')}
            </div>
          </div>
        )}
      </div>

      {/* Axis Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <span>60 Menit Lalu</span>
        <span>30 Menit Lalu</span>
        <span style={{ color: '#06b6d4', fontWeight: 600 }}>Terkini ({currentVal ? currentVal.toFixed(1) : 0} cm)</span>
      </div>

    </div>
  );
}
