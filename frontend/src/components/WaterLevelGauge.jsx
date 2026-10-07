import React from 'react';
import { Waves, TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function WaterLevelGauge({ reading, sensorHeight = 600, tidalStatus }) {
  const waterLevel = reading?.water_level_cm != null ? Number(reading.water_level_cm) : 0;
  const rawDistance = reading?.raw_distance_cm != null ? Number(reading.raw_distance_cm) : 0;
  const maxScale = sensorHeight || 600;

  // Percentage for gauge (0 to 100)
  const percent = Math.min(100, Math.max(0, (waterLevel / maxScale) * 100));

  // Gauge SVG math for 240-degree arc
  const radius = 105;
  const stroke = 18;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  // Arc angle 240 deg = 0.666 of circle
  const arcLength = circumference * (240 / 360);
  const strokeDashoffset = arcLength - (percent / 100) * arcLength;

  // Status badge logic
  let statusColor = '#38bdf8';
  let StatusIcon = Minus;
  let statusText = 'AIR TENANG (SLACK)';

  if (tidalStatus?.status === 'RISING' || (reading?.water_level_cm && reading?.prev_level && reading.water_level_cm > reading.prev_level)) {
    statusColor = '#10b981';
    StatusIcon = TrendingUp;
    statusText = 'PASANG SEDANG NAIK';
  } else if (tidalStatus?.status === 'FALLING' || (reading?.water_level_cm && reading?.prev_level && reading.water_level_cm < reading.prev_level)) {
    statusColor = '#f59e0b';
    StatusIcon = TrendingDown;
    statusText = 'AIR SURUT SEDANG TURUN';
  }

  return (
    <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      
      {/* Header */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Waves size={20} color="#06b6d4" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
            Elevasi Permukaan Air
          </h3>
        </div>
        <span className="badge badge-cyan">INTERVAL 1 MENIT</span>
      </div>

      {/* Radial SVG Gauge */}
      <div style={{ position: 'relative', width: '260px', height: '220px', display: 'flex', justifyContent: 'center' }}>
        <svg
          height="220"
          width="260"
          viewBox="0 0 260 220"
          style={{ transform: 'rotate(0deg)' }}
        >
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#818cf8" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Background Track Arc (240 degrees) */}
          <circle
            stroke="rgba(30, 41, 59, 0.7)"
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={`${arcLength} ${circumference}`}
            style={{
              transformOrigin: '130px 130px',
              transform: 'rotate(150deg)'
            }}
            r={normalizedRadius}
            cx="130"
            cy="130"
            strokeLinecap="round"
          />

          {/* Value Progress Arc */}
          <circle
            stroke="url(#gaugeGradient)"
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            filter="url(#glow)"
            style={{
              transformOrigin: '130px 130px',
              transform: 'rotate(150deg)',
              transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            r={normalizedRadius}
            cx="130"
            cy="130"
            strokeLinecap="round"
          />
        </svg>

        {/* Center Readout Value */}
        <div style={{
          position: 'absolute',
          top: '65px',
          left: '0',
          right: '0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none'
        }}>
          <div className="mono-text" style={{ fontSize: '2.8rem', fontWeight: 800, color: '#f8fafc', lineHeight: 1 }}>
            {waterLevel.toFixed(1)}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#38bdf8', fontWeight: 600, marginTop: '4px' }}>
            CENTIMETER (cm)
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {(waterLevel / 100).toFixed(2)} Meter DPL
          </div>
        </div>
      </div>

      {/* Dynamic Status Ribbon */}
      <div style={{
        marginTop: '-10px',
        width: '100%',
        padding: '10px 16px',
        borderRadius: '10px',
        background: 'rgba(15, 23, 42, 0.75)',
        border: `1px solid ${statusColor}44`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <StatusIcon size={18} color={statusColor} />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: statusColor }}>
            {tidalStatus?.label || statusText}
          </span>
        </div>
        <div className="mono-text" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {percent.toFixed(0)}% Rentang Tiang
        </div>
      </div>

      {/* Metrics Footer */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        width: '100%',
        marginTop: '16px',
        paddingTop: '16px',
        borderTop: '1px solid rgba(59, 130, 246, 0.15)'
      }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>JARAK SENSOR (RAW)</div>
          <div className="mono-text" style={{ fontSize: '1.05rem', fontWeight: 700, color: '#94a3b8' }}>
            {rawDistance.toFixed(1)} cm
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TINGGI REFERENSI</div>
          <div className="mono-text" style={{ fontSize: '1.05rem', fontWeight: 700, color: '#94a3b8' }}>
            {sensorHeight} cm
          </div>
        </div>
      </div>

    </div>
  );
}
