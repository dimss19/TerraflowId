import React from 'react';
import { Waves, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function WaterLevelGauge({ reading, sensorHeight = 600, tidalStatus }) {
  // A16 Ultrasonic Sensor Datasheet: Measuring Range = 50 cm to 1500 cm (Max 15.00 Meter)
  const MAX_SENSOR_RANGE_M = 15.0; // 1500 cm dari Datasheet DYP-A16
  const waterLevelCm = Number(reading?.water_level_cm) || 0;
  const waterLevelM = waterLevelCm / 100.0;
  const rawDistanceCm = Number(reading?.raw_distance_cm) || 0;
  const rawDistanceM = rawDistanceCm / 100.0;

  // Percentage for gauge based on max sensor reading distance (15.0 Meter)
  const percent = Math.min(100, Math.max(0, (waterLevelM / MAX_SENSOR_RANGE_M) * 100));

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
        <span className="badge badge-navy">SKALA SENSOR A16 (15 M)</span>
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

          {/* Min / Max Labels at the ends of arc (0 m and 15 m based on A16 datasheet) */}
          <text x="56" y="190" fill="#94a3b8" fontSize="11" fontWeight="700" textAnchor="middle">0 m</text>
          <text x="224" y="190" fill="#94a3b8" fontSize="11" fontWeight="700" textAnchor="middle">15 m</text>
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
          {/* Main Water Level Number in METERS */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
            <span style={{
              fontSize: '2.5rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.03em',
              lineHeight: 1
            }}>
              {waterLevelM.toFixed(2)}
            </span>
            <span style={{
              fontSize: '1.05rem',
              fontWeight: 800,
              color: '#003882'
            }}>
              m
            </span>
          </div>

          {/* Sub-badge: cm equivalent */}
          <div style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            color: '#475569',
            marginTop: '6px',
            background: '#edf2fc',
            padding: '3px 12px',
            borderRadius: '20px',
            border: '1px solid #dbeafe'
          }}>
            {waterLevelCm.toFixed(1)} cm &bull; Elevasi Air
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
          {percent.toFixed(1)}% Jangkauan Sensor (15 m)
        </span>
      </div>

      {/* Secondary Metric Tiles */}
      <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
        <div className="subtle-panel">
          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Jarak Sensor (Raw)
          </div>
          <div className="mono-text" style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
            {rawDistanceM.toFixed(2)} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#003882' }}>m</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#64748b', marginLeft: '4px' }}>({rawDistanceCm.toFixed(1)} cm)</span>
          </div>
        </div>

        <div className="subtle-panel">
          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Jangkauan Maksimal A16
          </div>
          <div className="mono-text" style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
            15.00 <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#003882' }}>m</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#64748b', marginLeft: '4px' }}>(1500 cm)</span>
          </div>
        </div>
      </div>

    </div>
  );
}
