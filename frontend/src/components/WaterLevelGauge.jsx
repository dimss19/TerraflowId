import React from 'react';
import { Waves, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function WaterLevelGauge({ reading, sensorHeight = 600, tidalStatus }) {
  const waterLevel = Number(reading?.water_level_cm) || 0;
  const rawDistance = Number(reading?.raw_distance_cm) || 0;
  const maxScale = Number(sensorHeight) || 600;

  // Percentage for gauge (0 to 100)
  const percent = Math.min(100, Math.max(0, (waterLevel / maxScale) * 100));

  // Gauge SVG geometry for 240-degree arc
  const stroke = 14;
  const normalizedRadius = 92;
  const circumference = normalizedRadius * 2 * Math.PI;
  // Arc angle 240 deg = 0.666 of circle
  const arcLength = circumference * (240 / 360);
  const strokeDashoffset = arcLength - (percent / 100) * arcLength;

  // Status badge logic
  let statusBg = '#eff6ff';
  let statusColor = '#003882';
  let statusBorder = '#bfdbfe';
  let StatusIcon = Minus;
  let statusText = 'AIR TENANG (SLACK)';

  if (tidalStatus?.status === 'RISING' || (reading?.water_level_cm && reading?.prev_level && reading.water_level_cm > reading.prev_level)) {
    statusBg = '#ecfdf5';
    statusColor = '#059669';
    statusBorder = '#a7f3d0';
    StatusIcon = TrendingUp;
    statusText = 'PASANG (AIR NAIK)';
  } else if (tidalStatus?.status === 'FALLING' || (reading?.water_level_cm && reading?.prev_level && reading.water_level_cm < reading.prev_level)) {
    statusBg = '#fffbeb';
    statusColor = '#d97706';
    statusBorder = '#fde68a';
    StatusIcon = TrendingDown;
    statusText = 'SURUT (AIR TURUN)';
  }

  return (
    <div className="corporate-card" style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
      
      {/* Header */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
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
            <Waves size={18} />
          </div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
            Elevasi Permukaan Air
          </h3>
        </div>
        <span className="badge badge-navy">INTERVAL 1 MENIT</span>
      </div>

      {/* Radial SVG Gauge Container */}
      <div style={{ position: 'relative', width: '280px', height: '200px', display: 'flex', justifyContent: 'center' }}>
        <svg
          height="200"
          width="280"
          viewBox="0 0 280 200"
        >
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0284c7" />
              <stop offset="100%" stopColor="#003882" />
            </linearGradient>
          </defs>

          {/* Background Track Arc */}
          <circle
            stroke="#e2e8f0"
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={`${arcLength} ${circumference}`}
            style={{
              transformOrigin: '140px 125px',
              transform: 'rotate(150deg)'
            }}
            r={normalizedRadius}
            cx="140"
            cy="125"
            strokeLinecap="round"
          />

          {/* Value Progress Arc */}
          <circle
            stroke="url(#gaugeGradient)"
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            style={{
              transformOrigin: '140px 125px',
              transform: 'rotate(150deg)',
              transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            r={normalizedRadius}
            cx="140"
            cy="125"
            strokeLinecap="round"
          />

          {/* Min / Max Labels at the ends of arc */}
          <text x="56" y="190" fill="#94a3b8" fontSize="11" fontWeight="700" textAnchor="middle">0</text>
          <text x="224" y="190" fill="#94a3b8" fontSize="11" fontWeight="700" textAnchor="middle">{maxScale.toFixed(0)}</text>
        </svg>

        {/* Center Readout Overlay */}
        <div style={{
          position: 'absolute',
          top: '74px',
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          pointerEvents: 'none'
        }}>
          {/* Main Water Level Number */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{
              fontSize: '2.45rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.03em',
              lineHeight: 1
            }}>
              {waterLevel.toFixed(1)}
            </span>
            <span style={{
              fontSize: '0.92rem',
              fontWeight: 700,
              color: '#64748b'
            }}>
              cm
            </span>
          </div>

          {/* Elevation in Meters Badge */}
          <div style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            color: '#003882',
            marginTop: '6px',
            background: '#edf2fc',
            padding: '3px 12px',
            borderRadius: '20px',
            border: '1px solid #dbeafe'
          }}>
            {(waterLevel / 100.0).toFixed(2)} Meter DPL
          </div>
        </div>
      </div>

      {/* Tidal Dynamic Indicator Badge */}
      <div style={{
        marginTop: '10px',
        padding: '8px 16px',
        borderRadius: '8px',
        background: statusBg,
        border: `1px solid ${statusBorder}`,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.82rem',
        fontWeight: 700,
        color: statusColor,
        width: '100%',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <StatusIcon size={16} />
          <span>{statusText}</span>
        </div>
        <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
          {percent.toFixed(0)}% Kapasitas Tiang
        </span>
      </div>

      {/* Secondary Metric Tiles */}
      <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
        <div className="subtle-panel">
          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Jarak Sensor (Raw)
          </div>
          <div className="mono-text" style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
            {rawDistance.toFixed(1)} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b' }}>cm</span>
          </div>
        </div>

        <div className="subtle-panel">
          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Tinggi Referensi
          </div>
          <div className="mono-text" style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
            {maxScale.toFixed(1)} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b' }}>cm</span>
          </div>
        </div>
      </div>

    </div>
  );
}
