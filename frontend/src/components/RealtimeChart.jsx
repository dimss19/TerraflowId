import React, { useState, useRef } from 'react';
import { Activity, Clock, Zap } from 'lucide-react';

/**
 * RealtimeChart: Menampilkan telemetri ketinggian air secara real-time.
 * 
 * Logic penyesuaian:
 * 1. "Semakin banyak akan semakin kecil": 
 *    - Titik data terdistribusi merata dari batas kiri (awal pembacaan) ke batas kanan (terkini).
 *    - Jarak (step interval) antar titik mengecil secara otomatis seiring bertambahnya sampel.
 *    - Ukuran dot (radius lingkaran) mengecil secara adaptif saat jumlah data bertambah banyak.
 * 2. "Jika tidak ada data sama sekali selama beberapa jam, gunakan acuan data terbaru sebagai awal pembacaan":
 *    - Menghilangkan cutoff 60 menit kaku yang sebelumnya membuang data lama atau membuat data berhimpit di pojok kanan.
 *    - Buffer data terbaru (hingga 60 sampel terakhir) langsung digunakan sebagai deret aktif.
 *    - Titik pertama dari deret terbaru menjadi acuan "Awal Pembacaan" dan titik terakhir menjadi "Terkini".
 */

// Helper untuk menghasilkan kurva Bezier halus yang stabil
function createSmoothPath(pts) {
  if (!pts || pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export default function RealtimeChart({ readings = [] }) {
  const [sliderIndex, setSliderIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const svgRef = useRef(null);

  // Ambil hanya data yang memiliki timestamp dan water_level_cm yang valid
  const validReadings = (readings || []).filter(d => {
    return d && d.timestamp && !isNaN(new Date(d.timestamp).getTime()) && d.water_level_cm !== null && d.water_level_cm !== undefined;
  });

  // Ambil hingga 60 sampel terbaru sebagai deret aktif
  const displayData = validReadings.slice(-60);
  const totalCount = displayData.length;

  // Jika belum ada data telemetri sama sekali
  if (totalCount === 0) {
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
              Grafik Telemetri Real-Time
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
            Belum Ada Transmisi Telemetri
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', maxWidth: '420px', lineHeight: 1.4 }}>
            Menunggu sinyal data dari perangkat AWLR melalui koneksi MQTT/HTTP.
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', fontSize: '0.76rem', color: '#94a3b8', fontWeight: 600 }}>
          <span>Awal Pembacaan</span>
          <span>Rentang Sampel</span>
          <span>Terkini</span>
        </div>
      </div>
    );
  }

  // Parameter waktu data
  const firstItem = displayData[0];
  const latestItem = displayData[totalCount - 1];
  const firstTs = new Date(firstItem.timestamp).getTime();
  const latestTs = new Date(latestItem.timestamp).getTime();
  const timeSpanMs = Math.max(0, latestTs - firstTs);
  const now = Date.now();
  const isLatestFresh = (now - latestTs) < 5 * 60 * 1000; // Fresh jika diterima dalam 5 menit terakhir

  // Kalkulasi statistik nilai air
  const values = displayData.map(d => Number(d.water_level_cm) || 0);
  const minRaw = Math.min(...values);
  const maxRaw = Math.max(...values);
  const spread = maxRaw - minRaw;
  const paddingVal = spread < 2 ? 10 : Math.max(4, spread * 0.15);
  const minVal = Math.max(0, Math.floor(minRaw - paddingVal));
  const maxVal = Math.ceil(maxRaw + paddingVal);
  const range = Math.max(5, maxVal - minVal);
  const currentVal = values[totalCount - 1];

  // SVG Canvas dimensions
  const svgWidth = 600;
  const svgHeight = 220;
  const paddingLeft = 52;
  const paddingRight = 24;
  const paddingY = 28;
  const usableWidth = svgWidth - paddingLeft - paddingRight;
  const usableHeight = svgHeight - paddingY * 2;

  // Pemetaan titik (X & Y)
  // X: Terdistribusi merata dari 0 s/d (totalCount - 1). 
  // Semakin banyak data (totalCount bertambah), jarak antar titik (usableWidth / (totalCount - 1)) semakin kecil.
  const points = displayData.map((d, idx) => {
    const x = totalCount === 1 
      ? paddingLeft + usableWidth / 2 
      : paddingLeft + (idx / (totalCount - 1)) * usableWidth;
    
    const yVal = Number(d.water_level_cm) || 0;
    const y = svgHeight - paddingY - ((yVal - minVal) / range) * usableHeight;
    return { x, y, data: d, index: idx };
  });

  const pathD = totalCount > 1 ? createSmoothPath(points) : '';
  const areaD = totalCount > 1
    ? `${pathD} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z`
    : '';

  // Adaptive radius: semakin banyak titik data, ukuran lingkaran semakin mengecil
  const baseDotRadius = totalCount <= 12 ? 4.2 : totalCount <= 25 ? 3.0 : totalCount <= 40 ? 2.2 : 1.7;

  // Format Waktu
  const formatTimeStr = (ts, includeDate = false) => {
    if (!ts) return '--:--';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '--:--';
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    if (includeDate) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${day}/${month} ${hours}:${mins}`;
    }
    return `${hours}:${mins}`;
  };

  // Cek apakah rentang data melewati pergantian hari
  const isMultiDay = new Date(firstTs).toDateString() !== new Date(latestTs).toDateString();

  // Format durasi rentang
  const formatTimeSpan = () => {
    if (totalCount <= 1) return '1 Titik Data';
    if (timeSpanMs < 60000) {
      return `${Math.max(1, Math.round(timeSpanMs / 1000))} dtk (${totalCount} sampel)`;
    }
    if (timeSpanMs < 3600000) {
      return `${Math.round(timeSpanMs / 60000)} menit (${totalCount} sampel)`;
    }
    return `${(timeSpanMs / 3600000).toFixed(1)} jam (${totalCount} sampel)`;
  };

  // Interaksi Scrubbing / Geser Kursor (persis seperti Gambar 2)
  const handlePointerMove = (e) => {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const offsetX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const svgX = (offsetX / rect.width) * svgWidth;

    let closestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(points[i].x - svgX);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = i;
      }
    }
    setSliderIndex(closestIdx);
  };

  const handlePointerDown = (e) => {
    setIsDragging(true);
    handlePointerMove(e);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const handlePointerLeave = () => {
    setIsDragging(false);
  };

  const activePointIndex = sliderIndex !== null 
    ? Math.min(Math.max(0, sliderIndex), Math.max(0, points.length - 1))
    : (points.length > 0 ? points.length - 1 : null);
  const activePoint = activePointIndex !== null ? points[activePointIndex] : null;

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
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Grafik Telemetri Real-Time
            </h3>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 500 }}>
            Min: <span className="mono-text" style={{ color: '#003882', fontWeight: 700 }}>{minRaw.toFixed(1)} cm</span> &bull; 
            Max: <span className="mono-text" style={{ color: '#003882', fontWeight: 700 }}> {maxRaw.toFixed(1)} cm</span>
          </div>
          <span className="badge badge-navy" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            {isLatestFresh ? <Zap size={11} color="#0284c7" /> : <Clock size={11} />}
            {totalCount} Sampel
          </span>
        </div>
      </div>

      {/* SVG Chart Area dengan Fitur Geser / Crosshair Slider */}
      <div 
        style={{ 
          position: 'relative', 
          width: '100%', 
          flex: 1, 
          minHeight: '200px',
          cursor: 'ew-resize',
          userSelect: 'none',
          touchAction: 'none'
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerLeave}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: '100%', overflow: 'visible', display: 'block' }}
        >
          <defs>
            <linearGradient id="realtimeAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#003882" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#003882" stopOpacity="0.0" />
            </linearGradient>
            <filter id="realtimeBadgeShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.2" />
            </filter>
          </defs>

          {/* Horizontal Guide Lines & Elevation Indicators (Penunjuk Sumbu Y - Persis Gambar No 2) */}
          {[0.25, 0.5, 0.75].map((pct, idx) => {
            const y = paddingY + pct * usableHeight;
            const valCm = maxVal - pct * range;
            const formattedVal = `${(valCm / 100).toFixed(2)}m`;
            return (
              <g key={idx}>
                <line 
                  x1={paddingLeft} 
                  y1={y} 
                  x2={svgWidth - paddingRight} 
                  y2={y} 
                  stroke="#f1f5f9" 
                  strokeDasharray="4 4" 
                  strokeWidth="1.5" 
                />
                <text 
                  x={paddingLeft - 8} 
                  y={y + 3.5} 
                  fill="#94a3b8" 
                  fontSize="9.5" 
                  textAnchor="end" 
                  fontFamily="monospace"
                >
                  {formattedVal}
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          {areaD && (
            <path d={areaD} fill="url(#realtimeAreaGrad)" className="chart-animated-area" />
          )}

          {/* Line Stroke */}
          {pathD && (
            <path 
              d={pathD} 
              fill="none" 
              stroke="#003882" 
              strokeWidth="2.8" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="chart-animated-line" 
            />
          )}

          {/* Live Telemetry Beacon Ping on Latest Reading */}
          {points.length > 0 && isLatestFresh && !activePoint && (
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

          {/* Data Points on Curve (Aestetika Gambar 1) */}
          {points.map((p, idx) => {
            const isLast = idx === points.length - 1;
            const isActive = activePoint?.index === idx;
            const radius = isLast ? Math.max(4.5, baseDotRadius * 1.4) : baseDotRadius;

            return (
              <circle
                key={idx}
                cx={p.x}
                cy={p.y}
                r={isActive ? 6 : radius}
                fill={isLast ? "#003882" : (isActive ? "#0284c7" : "#38bdf8")}
                stroke="#ffffff"
                strokeWidth={isLast ? 2.5 : (isActive ? 2 : 1)}
                opacity={activePoint && !isActive ? 0.5 : 1}
                style={{ pointerEvents: 'none', transition: 'opacity 0.15s ease, r 0.15s ease' }}
              />
            );
          })}

          {/* ======================================================== */}
          {/* SLIDING CROSSHAIR, INTERSECTION POINT & DARK TOOLTIP */}
          {/* (Interaksi geser horizontal persis seperti Gambar 2)      */}
          {/* ======================================================== */}
          {activePoint && (
            <g style={{ pointerEvents: 'none' }}>
              {/* Garis Vertikal Putus-putus Biru */}
              <line 
                x1={activePoint.x} 
                y1={paddingY - 8} 
                x2={activePoint.x} 
                y2={svgHeight - paddingY + 8} 
                stroke="#0284c7" 
                strokeWidth="1.8" 
                strokeDasharray="4 3"
              />

              {/* Titik Temu Lingkaran Putih-Biru */}
              <circle 
                cx={activePoint.x} 
                cy={activePoint.y} 
                r="6.5" 
                fill="#0284c7" 
                stroke="#ffffff" 
                strokeWidth="2.5" 
                filter="url(#realtimeBadgeShadow)"
              />

              {/* Floating Dark Tooltip Box */}
              {(() => {
                const tooltipWidth = 126;
                const halfWidth = tooltipWidth / 2;
                const clampedX = Math.min(Math.max(activePoint.x, paddingLeft + halfWidth), svgWidth - paddingRight - halfWidth);
                const isTop = activePoint.y < 58;
                const tooltipY = isTop ? activePoint.y + 36 : activePoint.y - 28;

                return (
                  <g 
                    transform={`translate(${clampedX}, ${tooltipY})`}
                    filter="url(#realtimeBadgeShadow)"
                  >
                    <rect 
                      x={-halfWidth} 
                      y="-22" 
                      width={tooltipWidth} 
                      height="32" 
                      rx="6" 
                      fill="#0f172a" 
                    />
                    {isTop ? (
                      <polygon points="-5,-22 5,-22 0,-26" fill="#0f172a" />
                    ) : (
                      <polygon points="-5,10 5,10 0,14" fill="#0f172a" />
                    )}
                    <text x="0" y="-8" fill="#94a3b8" fontSize="9" fontWeight="600" textAnchor="middle">
                      {formatTimeStr(activePoint.data.timestamp, isMultiDay)}
                    </text>
                    <text x="0" y="6" fill="#ffffff" fontSize="11" fontWeight="800" fontFamily="monospace" textAnchor="middle">
                      {Number(activePoint.data.water_level_cm).toFixed(1)} cm ({(Number(activePoint.data.water_level_cm) / 100).toFixed(2)} m)
                    </text>
                  </g>
                );
              })()}

              {/* Pill Badge Waktu di Bawah Sumbu X */}
              {activePoint.data?.timestamp && (
                <g transform={`translate(${Math.min(Math.max(activePoint.x, paddingLeft + 42), svgWidth - paddingRight - 42)}, ${svgHeight - paddingY + 22})`}>
                  <rect x="-38" y="-9" width="76" height="18" rx="4" fill="#e2e8f0" />
                  <text x="0" y="3.5" fill="#334155" fontSize="10" fontWeight="700" textAnchor="middle">
                    {formatTimeStr(activePoint.data.timestamp, false)}
                  </text>
                </g>
              )}
            </g>
          )}
        </svg>
      </div>

      {/* Time axis footer */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginTop: '14px', 
        paddingTop: '10px',
        borderTop: '1px solid #f1f5f9',
        fontSize: '0.76rem'
      }}>
        {/* Sisi Kiri: Awal Pembacaan Data */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '0.67rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Awal Pembacaan
          </span>
          <span style={{ fontWeight: 700, color: '#334155' }}>
            {formatTimeStr(firstTs, isMultiDay)}
          </span>
        </div>

        {/* Sisi Tengah: Rentang Data & Jumlah Titik */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '0.67rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Rentang Pembacaan
          </span>
          <span style={{ fontWeight: 700, color: '#003882' }}>
            {formatTimeSpan()}
          </span>
        </div>

        {/* Sisi Kanan: Data Terkini */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ 
            fontSize: '0.67rem', 
            fontWeight: 700,
            textTransform: 'uppercase', 
            letterSpacing: '0.04em',
            color: isLatestFresh ? '#0284c7' : '#d97706',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            {isLatestFresh ? 'Terkini (Live)' : 'Data Terakhir'}
          </span>
          <span style={{ fontWeight: 800, color: isLatestFresh ? '#003882' : '#b45309' }}>
            {formatTimeStr(latestTs, isMultiDay)} ({currentVal?.toFixed(1)} cm)
          </span>
        </div>
      </div>

    </div>
  );
}
