import React from 'react';
import { Droplet, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function WaterLevelGauge({ reading, sensorHeight = 600, tidalStatus }) {
  // Dynamic scale based on station sensor installation height
  const maxScaleCm = Number(sensorHeight) > 0 ? Number(sensorHeight) : 600.0;
  const maxScaleM = maxScaleCm / 100.0;
  const waterLevelCm = Number(reading?.water_level_cm) || 0;
  const waterLevelM = waterLevelCm / 100.0;
  const rawDistanceCm = Number(reading?.raw_distance_cm) || 0;
  const rawDistanceM = rawDistanceCm / 100.0;

  // Percentage for gauge based on configured reference height
  const percent = Math.min(100, Math.max(0, (waterLevelCm / maxScaleCm) * 100));

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
      <div style={{ width: '100%', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '8px',
            background: '#edf2fc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#003882',
            flexShrink: 0,
            marginTop: '2px'
          }}>
            <Droplet size={18} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.25 }}>
              Elevasi Permukaan Air
            </h3>
            <div>
              <span className="badge badge-navy" style={{ fontSize: '0.68rem', padding: '2px 8px', fontWeight: 700 }}>
                TINGGI ACUAN ({maxScaleM.toFixed(1)} M)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Radial SVG Gauge Container (Fully Responsive) */}
      <div style={{ position: 'relative', width: '100%', maxWidth: '280px', display: 'flex', justifyContent: 'center' }}>
        <svg
          viewBox="0 0 280 200"
          style={{ width: '100%', height: 'auto', display: 'block' }}
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
              transition: 'stroke-dashoffset 1.4s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            r={normalizedRadius}
            cx="140"
            cy="125"
            strokeLinecap="round"
          />

          {/* Main Water Level Number in METERS */}
          <text
            x="140"
            y="98"
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)' }}
          >
            <tspan fontSize="36" fontWeight="800" fill="#0f172a" letterSpacing="-0.03em">
              {waterLevelM.toFixed(2)}
            </tspan>
            <tspan fontSize="18" fontWeight="800" fill="#003882" dx="4">
              m
            </tspan>
          </text>

          {/* Sub-badge: cm equivalent (Compact Pill) */}
          <g>
            <rect
              x="96"
              y="118"
              width="88"
              height="20"
              rx="10"
              fill="#edf2fc"
              stroke="#dbeafe"
              strokeWidth="1"
            />
            <text
              x="140"
              y="128"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="10"
              fontWeight="700"
              fill="#003882"
              style={{ fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)' }}
            >
              {waterLevelCm.toFixed(1)} cm
            </text>
          </g>

          {/* Min / Max Labels at the ends of arc */}
          <text x="56" y="190" fill="#94a3b8" fontSize="11" fontWeight="700" textAnchor="middle">0 m</text>
          <text x="224" y="190" fill="#94a3b8" fontSize="11" fontWeight="700" textAnchor="middle">{maxScaleM.toFixed(1)} m</text>
        </svg>
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
        justifyContent: 'space-between',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <StatusIcon size={16} />
          <span>{statusText}</span>
        </div>
        <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
          {percent.toFixed(1)}% Terhadap Acuan ({maxScaleM.toFixed(1)} m)
        </span>
      </div>

      {/* Secondary Metric Tiles */}
      <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginTop: '16px' }}>
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
            Tinggi Acuan Pemasangan
          </div>
          <div className="mono-text" style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
            {maxScaleM.toFixed(2)} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#003882' }}>m</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#64748b', marginLeft: '4px' }}>({maxScaleCm.toFixed(0)} cm)</span>
          </div>
        </div>
      </div>

    </div>
  );
}
