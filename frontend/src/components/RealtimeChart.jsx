import React, { useState } from 'react';
import { Activity, Clock } from 'lucide-react';

export default function RealtimeChart({ readings = [] }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 60 menit jendela waktu
  const startTime = now - windowMs;

  // Filter hanya data yang berada dalam rentang 60 menit terakhir (now - 60 menit s/d now)
  const displayData = readings.filter(d => {
    if (!d.timestamp) return false;
    const t = new Date(d.timestamp).getTime();
    return t >= startTime && t <= (now + 5000); // toleransi 5 detik jam client
  });

  // Ambil informasi data terakhir yang tersimpan di sistem jika ada
  const lastKnownReading = readings.length > 0 ? readings[readings.length - 1] : null;
  const lastKnownTs = lastKnownReading?.timestamp ? new Date(lastKnownReading.timestamp).getTime() : null;

  // Jika tidak ada data sama sekali dalam 60 menit terakhir
  if (displayData.length === 0) {
    const formatLastTime = () => {
      if (!lastKnownTs) return 'Belum ada data';
      const d = new Date(lastKnownTs);
      return `${d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
    };

    return (
      <div className="corporate-card" style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', height: '100%', minHeight: '260px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
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
          <span className="badge badge-navy" style={{ background: '#f1f5f9', color: '#64748b' }}>
            <Clock size={12} /> 0 Sampel
          </span>
        </div>

        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          background: '#f8fafc', 
          borderRadius: '12px', 
          border: '1px dashed #cbd5e1',
          padding: '28px 20px',
          textAlign: 'center',
          gap: '8px'
        }}>
          <Clock size={32} color="#94a3b8" />
          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#334155' }}>
            Tidak Ada Transmisi Telemetri dalam 60 Menit Terakhir
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', maxWidth: '420px', lineHeight: 1.4 }}>
            Grafik ini hanya menampilkan aliran data 1 jam terakhir secara langsung. 
            {lastKnownTs && (
              <span style={{ display: 'block', marginTop: '6px', fontWeight: 600, color: '#003882' }}>
                Data terakhir tercatat: {formatLastTime()} ({Number(lastKnownReading?.water_level_cm || 0).toFixed(1)} cm)
              </span>
            )}
          </div>
        </div>

        {/* Time axis footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', fontSize: '0.76rem', color: '#94a3b8', fontWeight: 600 }}>
          <span>60 Menit Lalu</span>
          <span>30 Menit Lalu</span>
          <span>Sekarang</span>
        </div>
      </div>
    );
  }

  // Jika ADA data dalam 60 menit terakhir:
  const latestTs = new Date(displayData[displayData.length - 1].timestamp).getTime();
  const isLatestFresh = (now - latestTs) < 10 * 60 * 1000;

  const values = displayData.map(d => Number(d.water_level_cm) || 0);
  const minVal = values.length ? Math.floor(Math.min(...values) - 5) : 100;
  const maxVal = values.length ? Math.ceil(Math.max(...values) + 5) : 350;
  const range = Math.max(10, maxVal - minVal);
  const currentVal = values.length ? values[values.length - 1] : null;

  // SVG dimensions
  const svgWidth = 600;
  const svgHeight = 220;
  const paddingX = 20;
  const paddingY = 25;

  // Sumbu X merepresentasikan 60 menit terakhir (startTime = now - 60 min, endTime = now)
  const points = displayData.map((d) => {
    const t = new Date(d.timestamp).getTime();
    const progress = Math.min(1, Math.max(0, (t - startTime) / windowMs));
    const x = paddingX + progress * (svgWidth - paddingX * 2);
    const y = svgHeight - paddingY - ((Number(d.water_level_cm) - minVal) / range) * (svgHeight - paddingY * 2);
    return { x, y, data: d };
  });

  const pathD = points.length > 0 
    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
    : '';

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z`
    : '';

  const formatPointTime = (ts) => {
    if (!ts) return '--:--:--';
    try {
      const date = typeof ts === 'number' && ts < 1e11 ? new Date(ts * 1000) : new Date(ts);
      if (isNaN(date.getTime())) return '--:--:--';
      const h = String(date.getHours()).padStart(2, '0');
      const m = String(date.getMinutes()).padStart(2, '0');
      const s = String(date.getSeconds()).padStart(2, '0');
      return `${h}:${m}:${s}`;
    } catch {
      return '--:--:--';
    }
  };

  const tooltipXPercent = hoveredPoint ? (hoveredPoint.x / svgWidth) * 100 : 0;
  const tooltipYPercent = hoveredPoint ? (hoveredPoint.y / svgHeight) * 100 : 0;
  const translateX = tooltipXPercent > 82 ? '-90%' : tooltipXPercent < 18 ? '-10%' : '-50%';
  const translateY = tooltipYPercent < 28 ? '15%' : '-115%';

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

          {/* Empty/Awaiting Live Data Zone if latest data stopped/stale */}
          {points.length > 0 && points[points.length - 1].x < (svgWidth - paddingX - 15) && (
            <g>
              <rect 
                x={points[points.length - 1].x} 
                y={paddingY} 
                width={(svgWidth - paddingX) - points[points.length - 1].x} 
                height={svgHeight - paddingY * 2} 
                fill="#f8fafc" 
                opacity="0.65"
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
                (Belum ada data terbaru)
              </text>
            </g>
          )}

          {/* Line Stroke */}
          <path d={pathD} fill="none" stroke="#003882" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className="chart-animated-line" />

          {/* Live Telemetry Beacon Ping on Latest Reading */}
          {points.length > 0 && isLatestFresh && (
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
            left: `${tooltipXPercent}%`,
            top: `${tooltipYPercent}%`,
            transform: `translate(${translateX}, ${translateY})`,
            background: '#ffffff',
            border: '1px solid #d0deee',
            padding: '8px 12px',
            borderRadius: '8px',
            boxShadow: '0 6px 20px rgba(0, 56, 130, 0.14)',
            pointerEvents: 'none',
            zIndex: 20,
            whiteSpace: 'nowrap',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#003882'
            }}>
              <Clock size={11} strokeWidth={2.5} />
              <span>{formatPointTime(hoveredPoint.data.timestamp)}</span>
            </div>
            <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
              {Number(hoveredPoint.data.water_level_cm).toFixed(1)} <span style={{ fontSize: '0.74rem', color: '#003882', fontWeight: 700 }}>cm</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
              Jarak: {Number(hoveredPoint.data.raw_distance_cm).toFixed(1)} cm
            </div>
          </div>
        )}
      </div>

      {/* Time axis footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>
        <span>60 Menit Lalu</span>
        <span>30 Menit Lalu</span>
        <span style={{ color: isLatestFresh ? '#003882' : '#d97706', fontWeight: 800 }}>
          {isLatestFresh 
            ? `Terkini (${currentVal?.toFixed(1)} cm)` 
            : latestTs 
              ? `Data Terakhir: ${Math.floor((now - latestTs) / 60000)} mnt lalu (${currentVal?.toFixed(1)} cm)`
              : 'Tidak ada data'}
        </span>
      </div>

    </div>
  );
}
