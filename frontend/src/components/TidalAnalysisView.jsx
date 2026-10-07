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
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Waves size={24} color="#06b6d4" />
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc' }}>
                Kurva &amp; Dinamika Pasang Surut Air Laut (Tidal Analysis)
              </h2>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Deteksi otomatis gelombang pasang semi-diurnal (M2/S2) &bull; Estuari Sungai Mahakam &bull; PT Tanah Airku Teknologi
            </p>
          </div>

          {/* Current Tide Dynamic Status Badge */}
          <div style={{
            padding: '12px 20px',
            borderRadius: '12px',
            background: currentStatus.status === 'RISING' 
              ? 'rgba(16, 185, 129, 0.15)' 
              : currentStatus.status === 'FALLING' 
                ? 'rgba(245, 158, 11, 0.15)' 
                : 'rgba(59, 130, 246, 0.15)',
            border: `1px solid ${currentStatus.status === 'RISING' ? '#10b981' : currentStatus.status === 'FALLING' ? '#f59e0b' : '#3b82f6'}55`,
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            {currentStatus.status === 'RISING' ? (
              <TrendingUp size={24} color="#10b981" />
            ) : currentStatus.status === 'FALLING' ? (
              <TrendingDown size={24} color="#f59e0b" />
            ) : (
              <Compass size={24} color="#38bdf8" />
            )}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>STATUS PASANG SURUT SAAT INI</div>
              <div style={{ 
                fontSize: '1.05rem', 
                fontWeight: 800, 
                color: currentStatus.status === 'RISING' ? '#34d399' : currentStatus.status === 'FALLING' ? '#fbbf24' : '#38bdf8' 
              }}>
                {currentStatus.label}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {currentStatus.description}
              </div>
            </div>
          </div>
        </div>

        {/* Oceanographic Statistics Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', 
          gap: '16px', 
          marginTop: '24px' 
        }}>
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>HIGHEST HIGH TIDE (HHT)</div>
            <div className="mono-text" style={{ fontSize: '1.35rem', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
              {stats.hht.toFixed(1)} cm
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Puncak Tertinggi 24 Jam</div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>LOWEST LOW TIDE (LLT)</div>
            <div className="mono-text" style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>
              {stats.llt.toFixed(1)} cm
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Titik Surut Terendah</div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>MEAN SEA LEVEL (MSL)</div>
            <div className="mono-text" style={{ fontSize: '1.35rem', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
              {stats.msl.toFixed(1)} cm
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Elevasi Rata-Rata Acuan</div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TIDAL RANGE</div>
            <div className="mono-text" style={{ fontSize: '1.35rem', fontWeight: 800, color: '#818cf8', marginTop: '4px' }}>
              {stats.tidalRange.toFixed(1)} cm
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Rentang Pasang - Surut</div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>PERIODE PASUT TERDETEKSI</div>
            <div className="mono-text" style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f472b6', marginTop: '4px' }}>
              {stats.avgPeriodHours ? `${stats.avgPeriodHours} Jam` : '~12.4 Jam'}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Tipe Semi-Diurnal (Ganda)</div>
          </div>
        </div>
      </div>

      {/* 2. 24-Hour Area Tidal Curve Chart */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
              Kurva Pasang Surut 24 Jam (24-Hour Tidal Wave Curve)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Data ketinggian air dengan pin deteksi puncak (🔺 High Tide) dan lembah (🔻 Low Tide)
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <span className="badge badge-cyan">
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#06b6d4' }}></span>
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
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.55" />
                <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0.0" />
              </linearGradient>

              <linearGradient id="tidalLine" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="50%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#818cf8" />
              </linearGradient>
            </defs>

            {/* Mean Sea Level (MSL) Reference Line */}
            {stats.msl > 0 && (
              <line
                x1={paddingX}
                y1={svgHeight - paddingY - ((stats.msl - minLevel) / levelRange) * (svgHeight - paddingY * 2)}
                x2={svgWidth - paddingX}
                y2={svgHeight - paddingY - ((stats.msl - minLevel) / levelRange) * (svgHeight - paddingY * 2)}
                stroke="#10b981"
                strokeDasharray="6 4"
                strokeWidth="1.5"
                opacity="0.6"
              />
            )}

            {/* Grid references */}
            <line x1={paddingX} y1={paddingY} x2={svgWidth - paddingX} y2={paddingY} stroke="rgba(148, 163, 184, 0.1)" strokeDasharray="4 4" />
            <line x1={paddingX} y1={svgHeight - paddingY} x2={svgWidth - paddingX} y2={svgHeight - paddingY} stroke="rgba(148, 163, 184, 0.1)" strokeDasharray="4 4" />

            {/* Shaded Ocean Area */}
            <path d={areaD} fill="url(#tidalGradient)" />

            {/* Wave Curve Line */}
            <path d={pathD} fill="none" stroke="url(#tidalLine)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />

            {/* High Tide Markers (🔺) */}
            {highMarkers.map((hm, i) => (
              <g key={`ht-${i}`} style={{ cursor: 'pointer' }}>
                <circle cx={hm.x} cy={hm.y} r="8" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                <text x={hm.x} y={hm.y - 14} textAnchor="middle" fill="#34d399" fontSize="11" fontWeight="700">
                  🔺 {Number(hm.level).toFixed(1)} cm
                </text>
              </g>
            ))}

            {/* Low Tide Markers (🔻) */}
            {lowMarkers.map((lm, i) => (
              <g key={`lt-${i}`} style={{ cursor: 'pointer' }}>
                <circle cx={lm.x} cy={lm.y} r="8" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
                <text x={lm.x} y={lm.y + 22} textAnchor="middle" fill="#fbbf24" fontSize="11" fontWeight="700">
                  🔻 {Number(lm.level).toFixed(1)} cm
                </text>
              </g>
            ))}

            {/* Interactive hover points */}
            {points.map((p, idx) => (
              <circle
                key={idx}
                cx={p.x}
                cy={p.y}
                r="4"
                opacity="0"
                style={{ cursor: 'pointer' }}
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
              padding: '8px 14px',
              borderRadius: '8px',
              pointerEvents: 'none',
              boxShadow: '0 4px 14px rgba(0,0,0,0.6)',
              zIndex: 10
            }}>
              <div className="mono-text" style={{ fontSize: '0.9rem', fontWeight: 800, color: '#38bdf8' }}>
                {hoveredPoint.val.toFixed(1)} cm
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {new Date(hoveredPoint.data.timestamp).toLocaleTimeString('id-ID')}
              </div>
            </div>
          )}
        </div>

        {/* X-Axis Labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>-24 Jam (Kemarin)</span>
          <span>-18 Jam</span>
          <span>-12 Jam</span>
          <span>-6 Jam</span>
          <span style={{ color: '#06b6d4', fontWeight: 600 }}>Sekarang</span>
        </div>
      </div>

      {/* 3. High / Low Tide Events Table + Monthly Calendar Heatmap */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        
        {/* Tide Events Table */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Anchor size={20} color="#38bdf8" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
              Jadwal Puncak Pasang &amp; Titik Surut
            </h3>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(59, 130, 246, 0.2)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 8px' }}>Waktu Kejadian</th>
                  <th style={{ padding: '10px 8px' }}>Kategori</th>
                  <th style={{ padding: '10px 8px' }}>Elevasi Air</th>
                  <th style={{ padding: '10px 8px' }}>Deviasi dari MSL</th>
                </tr>
              </thead>
              <tbody>
                {[...highTides, ...lowTides]
                  .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                  .map((evt, idx) => {
                    const diffMsl = +(evt.level - stats.msl).toFixed(1);
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                        <td className="mono-text" style={{ padding: '10px 8px', color: '#f8fafc' }}>
                          {new Date(evt.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <span className={`badge ${evt.type === 'HIGH_TIDE' ? 'badge-emerald' : 'badge-amber'}`}>
                            {evt.type === 'HIGH_TIDE' ? '🔺 PASANG' : '🔻 SURUT'}
                          </span>
                        </td>
                        <td className="mono-text" style={{ padding: '10px 8px', fontWeight: 700, color: evt.type === 'HIGH_TIDE' ? '#34d399' : '#fbbf24' }}>
                          {Number(evt.level).toFixed(1)} cm
                        </td>
                        <td className="mono-text" style={{ padding: '10px 8px', color: diffMsl >= 0 ? '#38bdf8' : '#f59e0b' }}>
                          {diffMsl >= 0 ? `+${diffMsl}` : diffMsl} cm
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Monthly Heatmap Calendar */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={20} color="#818cf8" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
                Kalender Siklus Pasut Bulanan (Oktober 2026)
              </h3>
            </div>
            <span className="badge badge-cyan">Purnama / Perbani</span>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Warna gelap mencerminkan pasang perbani (*neap tide*), warna biru cerah mencerminkan pasang purnama (*spring tide*).
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
            {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', paddingBottom: '4px' }}>
                {d}
              </div>
            ))}

            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
              // Synthetic tidal cycle intensity: Full moon spring tide around day 12-16 and day 28
              const cycle = Math.sin((day / 29.5) * 2 * Math.PI * 2);
              const intensity = 0.3 + 0.7 * ((cycle + 1) / 2);
              const isSelected = selectedDay === day;

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  style={{
                    aspectRatio: '1/1',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    background: isSelected 
                      ? '#06b6d4' 
                      : `rgba(6, 182, 212, ${intensity * 0.4})`,
                    border: isSelected ? '2px solid #ffffff' : '1px solid rgba(59, 130, 246, 0.2)',
                    color: isSelected ? '#0f172a' : '#f8fafc',
                    fontWeight: isSelected ? 800 : 600,
                    fontSize: '0.85rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>{day}</span>
                  {day === 14 && <span style={{ fontSize: '0.55rem', fontWeight: 800 }}>🌕</span>}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>Rendah (Neap)</span>
            <div style={{ width: '120px', height: '8px', borderRadius: '4px', background: 'linear-gradient(to right, rgba(6,182,212,0.1), #06b6d4)' }} />
            <span>Tinggi (Spring Tide)</span>
          </div>
        </div>

      </div>

    </div>
  );
}
