import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Waves, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Anchor, 
  Layers, 
  BarChart2, 
  ChevronRight,
  FileText,
  Download,
  Filter,
  RefreshCw,
  ChevronLeft,
  Calendar,
  CheckCircle2,
  Minus,
  Maximize2,
  Minimize2,
  Camera,
  X,
  FileSpreadsheet,
  Globe,
  Radio,
  Sliders,
  Battery,
  Thermometer,
  Wifi
} from 'lucide-react';

// Helper kurva Bezier halus yang stabil
function createSmoothPath(pts) {
  if (!pts || pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
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

export default function AnalysisTab({ device, tidalData, onRefresh }) {
  // --- Historical & Filter State ---
  const [readings, setReadings] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Active parameter tab: 'water' | 'temp' | 'batt' | 'rssi'
  const [activeParam, setActiveParam] = useState('water');
  // Water unit toggle: 'm' | 'cm'
  const [waterUnit, setWaterUnit] = useState('m');

  // Active preset label
  const [activePreset, setActivePreset] = useState('none');
  const [isFilterApplied, setIsFilterApplied] = useState(false);

  // Filter dates
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // --- Zoom State ---
  const [zoomLevel, setZoomLevel] = useState(1);

  // --- Modal Download Logs State ---
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('txt'); // 'txt', 'csv', 'json'
  const [exportAggregate, setExportAggregate] = useState('raw'); // 'raw', '5m', '15m', '1h'
  const [exportTz, setExportTz] = useState('wib'); // 'wib', 'utc'
  const [exportUnit, setExportUnit] = useState('m'); // 'm', 'cm'

  // --- Tidal Analysis State ---
  const [sliderIndex, setSliderIndex] = useState(null);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const [customTidalData, setCustomTidalData] = useState(null);
  const [loadingTidal, setLoadingTidal] = useState(false);
  const svgRef = useRef(null);

  // Format Helper: YYYY-MM-DD (Tanggal saja tanpa format jam)
  const formatDateOnly = (d) => {
    if (!d) return '';
    const dateObj = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
    if (isNaN(dateObj.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
  };

  const effectiveTidal = isFilterApplied 
    ? (customTidalData || { series: [], stats: { hht: 0, llt: 0, msl: 0, tidalRange: 0 } }) 
    : (customTidalData || tidalData);
  const series = effectiveTidal?.series || [];
  const highTides = effectiveTidal?.highTides || [];
  const lowTides = effectiveTidal?.lowTides || [];
  const stats = effectiveTidal?.stats || { hht: 0, llt: 0, msl: 0, tidalRange: 0, avgPeriodHours: 12.42 };
  const currentStatus = effectiveTidal?.currentStatus || { status: 'SLACK', label: 'Air Tenang', ratePerHour: 0 };

  // Sinkronkan input tanggal dengan batas riil data
  useEffect(() => {
    if (!isFilterApplied && series.length > 0) {
      const firstTs = series[0]?.timestamp;
      const lastTs = series[series.length - 1]?.timestamp;
      if (firstTs && lastTs) {
        setStartDate(formatDateOnly(firstTs));
        setEndDate(formatDateOnly(lastTs));
      }
    }
  }, [series, isFilterApplied]);

  // Fetch Tidal Data
  const fetchTidal = async (applyFilter = isFilterApplied, sDate = startDate, eDate = endDate) => {
    if (!device?.device_id) return;
    setLoadingTidal(true);
    try {
      const q = new URLSearchParams();
      if (applyFilter) {
        if (sDate) {
          const s = sDate.length === 10 ? new Date(sDate + 'T00:00:00') : new Date(sDate);
          if (!isNaN(s.getTime())) q.set('start', s.toISOString());
        }
        if (eDate) {
          const e = eDate.length === 10 ? new Date(eDate + 'T23:59:59') : new Date(eDate);
          if (!isNaN(e.getTime())) q.set('end', e.toISOString());
        }
      }
      const res = await fetch(`/api/readings/${device.device_id}/tidal?${q}`);
      const json = await res.json();
      if (json.success) {
        setCustomTidalData(json);
        setSliderIndex(null);
        if (applyFilter) setIsFilterApplied(true);
      }
    } catch (e) {
      console.error('Error fetching tidal:', e);
    } finally {
      setLoadingTidal(false);
    }
  };

  // Fetch Historical Readings
  const fetchHistorical = async (applyFilter = isFilterApplied, sDate = startDate, eDate = endDate) => {
    if (!device?.device_id) return;
    setLoadingHistory(true);
    try {
      const q = new URLSearchParams({ limit: 1000 });
      if (applyFilter) {
        if (sDate) {
          const s = sDate.length === 10 ? new Date(sDate + 'T00:00:00') : new Date(sDate);
          if (!isNaN(s.getTime())) q.set('start', s.toISOString());
        }
        if (eDate) {
          const e = eDate.length === 10 ? new Date(eDate + 'T23:59:59') : new Date(eDate);
          if (!isNaN(e.getTime())) q.set('end', e.toISOString());
        }
      }
      const res = await fetch(`/api/readings/${device.device_id}?${q}`);
      const json = await res.json();
      if (json.success) {
        setReadings(json.data);
        setPage(1);
      }
    } catch (e) {
      console.error('Error fetching historical:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Preset Handler (Toggle: jika preset yang sama di-klik lagi, kembali ke no preset)
  const handlePreset = (hours, label) => {
    if (activePreset === label) {
      handleResetToLatest();
      return;
    }

    setActivePreset(label);
    const end = new Date();
    const start = new Date(Date.now() - hours * 3600 * 1000);
    const startStr = formatDateOnly(start);
    const endStr = formatDateOnly(end);
    setStartDate(startStr);
    setEndDate(endStr);
    setIsFilterApplied(true);
    fetchHistorical(true, startStr, endStr);
    fetchTidal(true, startStr, endStr);
  };

  const handleApplyFilter = () => {
    setActivePreset('custom');
    setIsFilterApplied(true);
    fetchHistorical(true, startDate, endDate);
    fetchTidal(true, startDate, endDate);
  };

  const handleResetToLatest = () => {
    setActivePreset('none');
    setStartDate('');
    setEndDate('');
    setIsFilterApplied(false);
    setCustomTidalData(null);
    setZoomLevel(1);
    fetchHistorical(false);
    fetchTidal(false);
    if (onRefresh) onRefresh();
  };

  useEffect(() => {
    if (device?.device_id) {
      fetchHistorical(false);
      fetchTidal(false);
    }
  }, [device?.device_id]);

  // Ekspor File Data (TXT / CSV / JSON)
  const handleDownloadFile = () => {
    if (!device?.device_id) return;

    // Instant client-side download for TXT formats (matching Luwes TXT standard)
    if (exportFormat === 'txt' && readings.length > 0) {
      const dataToExport = [...readings].reverse();
      const lines = [];
      dataToExport.forEach(r => {
        const d = new Date(r.timestamp);
        let adjusted = d;
        if (exportTz === 'wib') {
          adjusted = new Date(d.getTime() + 7 * 3600 * 1000);
        }
        const pad = (n) => String(n).padStart(2, '0');
        const YYYY = adjusted.getUTCFullYear();
        const MM = pad(adjusted.getUTCMonth() + 1);
        const DD = pad(adjusted.getUTCDate());
        const HH = pad(adjusted.getUTCHours());
        const mm = pad(adjusted.getUTCMinutes());
        const ss = pad(adjusted.getUTCSeconds());
        const timeStr = `${YYYY}-${MM}-${DD} ${HH}:${mm}:${ss}`;
        const wl = Number(r.water_level_cm) || 0;
        const val = exportUnit === 'cm' ? wl.toFixed(1) : (wl / 100).toFixed(3);
        lines.push(`${timeStr}   ${val}`);
      });

      const blob = new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${device?.device_id || 'AWLR-001'}_${exportAggregate}_${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      setShowExportModal(false);
      return;
    }

    const q = new URLSearchParams({
      format: exportFormat,
      aggregate: exportAggregate,
      tz: exportTz,
      unit: exportUnit
    });
    if (isFilterApplied) {
      if (startDate) {
        const s = startDate.length === 10 ? new Date(startDate + 'T00:00:00') : new Date(startDate);
        if (!isNaN(s.getTime())) q.set('start', s.toISOString());
      }
      if (endDate) {
        const e = endDate.length === 10 ? new Date(endDate + 'T23:59:59') : new Date(endDate);
        if (!isNaN(e.getTime())) q.set('end', e.toISOString());
      }
    }
    window.location.href = `/api/export/${device.device_id}?${q}`;
    setShowExportModal(false);
  };

  // Unduh Grafik sebagai PNG Gambar (Canvas Client-Side)
  const handleDownloadPNG = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 620;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Header Corporate Card
    ctx.fillStyle = '#003882';
    ctx.fillRect(0, 0, canvas.width, 70);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`${device?.device_id || 'AWLR-001'} — ${device?.station_name || 'Stasiun AWLR'}`, 40, 42);

    ctx.font = '13px "Inter", sans-serif';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText('PT Tanah Airku Teknologi • TerraFlow Telemetry Report', canvas.width - 360, 42);

    // Subheader info
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 14px "Inter", sans-serif';
    const paramLabel = activeParam === 'water' ? `Muka Air (${waterUnit === 'm' ? 'Meter' : 'Centimeter'})` : 'Kekuatan Sinyal RSSI (dBm)';
    ctx.fillText(`Parameter: ${paramLabel} | Periode: ${startDate ? startDate.replace('T', ' ') : '--'} s/d ${endDate ? endDate.replace('T', ' ') : '--'}`, 40, 105);

    // Chart bounds
    const cX = 60;
    const cY = 130;
    const cW = canvas.width - 120;
    const cH = 380;

    // Grid lines
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = cY + (i / 4) * cH;
      ctx.beginPath();
      ctx.moveTo(cX, y);
      ctx.lineTo(cX + cW, y);
      ctx.stroke();
    }

    if (points.length > 1) {
      // Scale points to canvas
      const cvPoints = points.map(p => ({
        x: cX + ((p.x - paddingX) / (svgWidth - paddingX * 2)) * cW,
        y: cY + ((p.y - paddingY) / (svgHeight - paddingY * 2)) * cH,
        val: p.val
      }));

      // Shaded area
      ctx.beginPath();
      ctx.moveTo(cvPoints[0].x, cY + cH);
      cvPoints.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.lineTo(cvPoints[cvPoints.length - 1].x, cY + cH);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, cY, 0, cY + cH);
      grad.addColorStop(0, 'rgba(2, 132, 199, 0.35)');
      grad.addColorStop(1, 'rgba(2, 132, 199, 0.0)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Line
      ctx.beginPath();
      cvPoints.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = '#003882';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Peak points
      highMarkers.forEach(hm => {
        const cvX = cX + ((hm.x - paddingX) / (svgWidth - paddingX * 2)) * cW;
        const cvY = cY + ((hm.y - paddingY) / (svgHeight - paddingY * 2)) * cH;
        ctx.fillStyle = '#003882';
        ctx.beginPath();
        ctx.arc(cvX, cvY, 5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Footer
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px "Inter", sans-serif';
    ctx.fillText(`Dicetak otomatis dari TerraFlow AWLR Platform • ${new Date().toLocaleString('id-ID')}`, 40, canvas.height - 20);

    // Download trigger
    const a = document.createElement('a');
    a.download = `${device?.device_id || 'AWLR-001'}_chart_${new Date().toISOString().slice(0, 10)}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    setShowExportModal(false);
  };

  // --- Chart Coordinates & Data Mapping ---
  const svgWidth = 850;
  const svgHeight = 280;
  const paddingX = 45;
  const paddingY = 35;

  // Extract values based on activeParam (Water Level or RSSI)
  const rawValues = series.map(s => {
    if (activeParam === 'rssi') return Number(s.signal_quality) || 0;
    // Water level
    const cm = Number(s.smoothed_level) || Number(s.water_level_cm) || 0;
    return waterUnit === 'm' ? cm / 100 : cm;
  });

  const minRaw = rawValues.length ? Math.min(...rawValues) : 0;
  const maxRaw = rawValues.length ? Math.max(...rawValues) : 10;
  const spread = Math.max(activeParam === 'water' ? (waterUnit === 'm' ? 0.05 : 5) : 5, maxRaw - minRaw);

  const minVal = minRaw - spread * 0.15;
  const maxVal = maxRaw + spread * 0.15;
  const valRange = Math.max(0.001, maxVal - minVal);

  const filterStartTime = startDate ? new Date(startDate).getTime() : (series.length ? new Date(series[0].timestamp).getTime() : 0);
  const filterEndTime = endDate ? new Date(endDate).getTime() : (series.length ? new Date(series[series.length - 1].timestamp).getTime() : 0);
  const totalDuration = Math.max(1000, filterEndTime - filterStartTime);

  const points = useMemo(() => {
    return series.map((s, i) => {
      let x;
      if (isFilterApplied && filterStartTime && filterEndTime && filterEndTime > filterStartTime && s.timestamp) {
        const pTime = new Date(s.timestamp).getTime();
        const progress = Math.min(1, Math.max(0, (pTime - filterStartTime) / totalDuration));
        x = paddingX + progress * (svgWidth - paddingX * 2);
      } else {
        x = paddingX + (i / Math.max(1, series.length - 1)) * (svgWidth - paddingX * 2);
      }

      let rawVal = 0;
      if (activeParam === 'rssi') {
        rawVal = Number(s.signal_quality) || 0;
      } else {
        const cm = Number(s.smoothed_level) || Number(s.water_level_cm) || 0;
        rawVal = waterUnit === 'm' ? cm / 100 : cm;
      }

      const y = svgHeight - paddingY - ((rawVal - minVal) / valRange) * (svgHeight - paddingY * 2);
      return { x, y, data: s, val: rawVal };
    });
  }, [series, activeParam, waterUnit, isFilterApplied, filterStartTime, filterEndTime, minVal, valRange]);

  const pathD = points.length > 0 ? createSmoothPath(points) : '';
  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z`
    : '';

  // Peak tidal markers
  const highMarkers = highTides.map(ht => {
    const found = points.find(p => p.data.timestamp === ht.timestamp) || points[0];
    return { ...ht, x: found ? found.x : paddingX, y: found ? found.y : paddingY };
  });

  const lowMarkers = lowTides.map(lt => {
    const found = points.find(p => p.data.timestamp === lt.timestamp) || points[0];
    return { ...lt, x: found ? found.x : paddingX, y: found ? found.y : paddingY };
  });

  // Active hover/slider point
  const activePointIndex = sliderIndex !== null 
    ? Math.min(Math.max(0, sliderIndex), Math.max(0, points.length - 1))
    : (points.length > 0 ? points.length - 1 : 0);
  const activePoint = points[activePointIndex] || null;

  const handlePointerMove = (e) => {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const offsetX = clientX - rect.left;
    const svgX = (offsetX / rect.width) * svgWidth;
    
    let closestIdx = 0;
    let minDist = Infinity;
    points.forEach((p, idx) => {
      const dist = Math.abs(p.x - svgX);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = idx;
      }
    });
    setSliderIndex(closestIdx);
  };

  // Last update time & relative ago string
  const latestTs = series.length ? new Date(series[series.length - 1].timestamp) : (readings.length ? new Date(readings[0].timestamp) : null);
  const getRelativeTime = (d) => {
    if (!d) return '--';
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSec < 60) return `${Math.max(1, diffSec)} detik lalu`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} menit lalu`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} jam lalu`;
    return `${Math.floor(diffSec / 86400)} hari lalu`;
  };

  // Formatter for table time (WIB standard)
  const formatTableTime = (tsIso) => {
    if (!tsIso) return '--';
    const d = new Date(tsIso);
    return d.toLocaleString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }) + ' WIB';
  };

  const totalPages = Math.ceil(readings.length / pageSize) || 1;
  const paginatedData = readings.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      
      {/* ========================================================= */}
      {/* 1. HEADER RINGKASAN STASIUN & SHORTCUT EKSPOR */}
      {/* ========================================================= */}
      <div className="corporate-card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          
          {/* Station Title & Live Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  {device?.station_name || device?.device_id || 'AWLR-001'}
                </h2>
                <span className="badge badge-navy" style={{ fontSize: '0.72rem' }}>
                  {device?.device_id || 'AWLR'}
                </span>
              </div>
              <p style={{ fontSize: '0.84rem', color: '#64748b', marginTop: '2px', marginBottom: 0 }}>
                {device?.location || 'Pemantauan Pos Hidrometri Muka Air Sungai & Estuari'}
              </p>
            </div>

            {/* Chip 1: Update Terakhir */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '6px 14px',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                Update Terakhir
              </span>
              <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#003882' }}>
                {latestTs ? `${latestTs.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} (${getRelativeTime(latestTs)})` : '--'}
              </span>
            </div>

            {/* Chip 2: Rentang Elevasi Air (Min - Max) */}
            <div style={{
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '8px',
              padding: '6px 14px',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase' }}>
                Rentang Muka Air ({waterUnit === 'm' ? 'Meter' : 'cm'})
              </span>
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0284c7' }}>
                {series.length > 0 ? (
                  waterUnit === 'm' 
                    ? `${(stats.llt / 100).toFixed(3)} m s/d ${(stats.hht / 100).toFixed(3)} m`
                    : `${Number(stats.llt).toFixed(1)} cm s/d ${Number(stats.hht).toFixed(1)} cm`
                ) : '--'}
              </span>
            </div>
          </div>

          {/* Tombol Ekspor & Download Logs Modal Trigger */}
          <button
            onClick={() => setShowExportModal(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: 700 }}
          >
            <Download size={17} />
            <span>Unduh Logs &amp; Ekspor</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. UNIFIED FILTER & PRESET BAR (SATU KONTROL TANGGAL) */}
      {/* ========================================================= */}
      <div className="corporate-card" style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          
          {/* Preset Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginRight: '4px' }}>
              Preset:
            </span>
            {[
              { label: '6 Jam', hours: 6, key: '6h' },
              { label: '12 Jam', hours: 12, key: '12h' },
              { label: '1 Hari', hours: 24, key: '1d' },
              { label: '3 Hari', hours: 72, key: '3d' },
              { label: '1 Minggu', hours: 168, key: '1w' },
              { label: '1 Bulan', hours: 720, key: '1m' },
              { label: '1 Tahun', hours: 8760, key: '1y' }
            ].map((p) => {
              const isActive = activePreset === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => handlePreset(p.hours, p.key)}
                  style={{
                    background: isActive ? '#003882' : '#ffffff',
                    color: isActive ? '#ffffff' : '#334155',
                    border: `1px solid ${isActive ? '#003882' : '#cbd5e1'}`,
                    borderRadius: '6px',
                    padding: '5px 10px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Custom Datepicker Form (Date only - tanggal tanpa format jam) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} color="#003882" />
              <input
                type="date"
                value={startDate ? startDate.slice(0, 10) : ''}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  fontSize: '0.76rem',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontWeight: 600,
                  color: '#0f172a'
                }}
              />
              <span style={{ fontSize: '0.74rem', color: '#64748b' }}>s/d</span>
              <input
                type="date"
                value={endDate ? endDate.slice(0, 10) : ''}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  fontSize: '0.76rem',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontWeight: 600,
                  color: '#0f172a'
                }}
              />
            </div>

            <button
              onClick={handleApplyFilter}
              disabled={loadingTidal}
              className="btn btn-primary"
              style={{ padding: '6px 14px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Filter size={13} />
              <span>{loadingTidal ? 'Memproses...' : 'Terapkan'}</span>
            </button>

            {isFilterApplied && (
              <button
                onClick={handleResetToLatest}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Reset ke kondisi live terbaru"
              >
                <RefreshCw size={13} />
                <span>Live Data</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. KURVA TELEMETRI DENGAN PARAMETER & HOVER TOOLTIP */}
      {/* ========================================================= */}
      <div className="corporate-card" style={{ padding: '24px' }}>
        
        {/* Toolbar Parameter & Units */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          
          {/* Parameter Switch Tabs: Muka Air & Sinyal RSSI */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'water', label: 'Muka Air (Water Level)', icon: Waves },
              { id: 'rssi', label: 'Kualitas Sinyal RSSI (dBm)', icon: Wifi }
            ].map(tab => {
              const Icon = tab.icon;
              const isSel = activeParam === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveParam(tab.id)}
                  style={{
                    background: isSel ? '#003882' : '#f8fafc',
                    color: isSel ? '#ffffff' : '#475569',
                    border: `1px solid ${isSel ? '#003882' : '#e2e8f0'}`,
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Unit Toggle & Quick Export */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {activeParam === 'water' && (
              <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: '6px', padding: '2px' }}>
                <button
                  onClick={() => setWaterUnit('m')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    background: waterUnit === 'm' ? '#003882' : 'transparent',
                    color: waterUnit === 'm' ? '#ffffff' : '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  Meter (m)
                </button>
                <button
                  onClick={() => setWaterUnit('cm')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    background: waterUnit === 'cm' ? '#003882' : 'transparent',
                    color: waterUnit === 'cm' ? '#ffffff' : '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  Centimeter (cm)
                </button>
              </div>
            )}

            <button
              onClick={handleDownloadPNG}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Simpan grafik sebagai gambar PNG"
            >
              <Camera size={14} />
              <span>Simpan Gambar</span>
            </button>
          </div>
        </div>

        {/* SVG Chart Area */}
        <div 
          style={{ 
            width: '100%', 
            background: '#ffffff', 
            borderRadius: '10px', 
            border: '1px solid #e2e8f0', 
            padding: '16px',
            position: 'relative',
            userSelect: 'none'
          }}
          onPointerUp={() => setIsDraggingSlider(false)}
          onPointerLeave={() => setIsDraggingSlider(false)}
        >
          {series.length === 0 ? (
            <div style={{ height: '240px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#94a3b8' }}>
              <Waves size={34} color="#cbd5e1" />
              <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#334155' }}>
                Belum ada data rekaman pada periode ini
              </span>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Pilih preset waktu lain atau klik Live Data
              </span>
            </div>
          ) : (
            <div>
              <svg 
                ref={svgRef}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
                style={{ 
                  width: '100%', 
                  height: 'auto', 
                  display: 'block', 
                  overflow: 'visible',
                  cursor: isDraggingSlider ? 'grabbing' : 'crosshair',
                  touchAction: 'none'
                }}
                onPointerDown={(e) => {
                  setIsDraggingSlider(true);
                  handlePointerMove(e);
                }}
                onPointerMove={(e) => {
                  if (isDraggingSlider || e.buttons === 1) {
                    handlePointerMove(e);
                  }
                }}
                onClick={handlePointerMove}
              >
                <defs>
                  <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#003882" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#003882" stopOpacity="0.0" />
                  </linearGradient>
                  <filter id="badgeShadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.2" />
                  </filter>
                </defs>

                {/* Horizontal Guide Lines */}
                {[0.25, 0.5, 0.75].map((pct, idx) => {
                  const y = paddingY + pct * (svgHeight - paddingY * 2);
                  const val = maxVal - pct * valRange;
                  const formattedVal = activeParam === 'water' && waterUnit === 'm' 
                    ? `${val.toFixed(3)} m`
                    : `${val.toFixed(1)} ${activeParam === 'temp' ? '°C' : activeParam === 'batt' ? 'V' : activeParam === 'rssi' ? 'dBm' : 'cm'}`;
                  return (
                    <g key={idx}>
                      <line x1={paddingX} y1={y} x2={svgWidth - paddingX} y2={y} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                      <text x={paddingX - 6} y={y + 3} fill="#94a3b8" fontSize="10" textAnchor="end" fontFamily="monospace">
                        {formattedVal}
                      </text>
                    </g>
                  );
                })}

                {/* Shaded Area Under Curve */}
                {areaD && <path d={areaD} fill="url(#curveGradient)" />}

                {/* Main Curve Line */}
                {pathD && <path d={pathD} fill="none" stroke="#003882" strokeWidth="2.6" strokeLinecap="round" />}

                {/* High / Low Tide Peak Markers (only on water level mode) */}
                {activeParam === 'water' && highMarkers.map((m, idx) => (
                  <g key={`ht-${idx}`}>
                    <circle cx={m.x} cy={m.y} r="5" fill="#003882" stroke="#ffffff" strokeWidth="2" />
                    <text x={m.x} y={m.y - 10} fill="#003882" fontSize="10" fontWeight="800" textAnchor="middle">
                      {waterUnit === 'm' ? `${(Number(m.water_level_cm) / 100).toFixed(2)}m` : `${Number(m.water_level_cm).toFixed(0)}cm`}
                    </text>
                  </g>
                ))}

                {activeParam === 'water' && lowMarkers.map((m, idx) => (
                  <g key={`lt-${idx}`}>
                    <circle cx={m.x} cy={m.y} r="5" fill="#d97706" stroke="#ffffff" strokeWidth="2" />
                    <text x={m.x} y={m.y + 16} fill="#d97706" fontSize="10" fontWeight="800" textAnchor="middle">
                      {waterUnit === 'm' ? `${(Number(m.water_level_cm) / 100).toFixed(2)}m` : `${Number(m.water_level_cm).toFixed(0)}cm`}
                    </text>
                  </g>
                ))}

                {/* ========================================= */}
                {/* INTERACTIVE HOVER GUIDE LINE & TOOLTIP */}
                {/* ========================================= */}
                {activePoint && (
                  <g style={{ cursor: 'ew-resize' }}>
                    {/* Dotted Vertical Guide Line */}
                    <line 
                      x1={activePoint.x} 
                      y1={paddingY - 8} 
                      x2={activePoint.x} 
                      y2={svgHeight - paddingY + 8} 
                      stroke="#0284c7" 
                      strokeWidth="1.8" 
                      strokeDasharray="4 3"
                    />

                    {/* Intersection Circle with Pulse Halo */}
                    <circle 
                      cx={activePoint.x} 
                      cy={activePoint.y} 
                      r="6.5" 
                      fill="#0284c7" 
                      stroke="#ffffff" 
                      strokeWidth="2.5" 
                      filter="url(#badgeShadow)"
                    />

                    {/* Floating Tooltip Box */}
                    <g 
                      transform={`translate(${Math.min(Math.max(activePoint.x, paddingX + 55), svgWidth - paddingX - 55)}, ${Math.max(26, activePoint.y - 32)})`}
                      filter="url(#badgeShadow)"
                    >
                      <rect 
                        x="-55" 
                        y="-22" 
                        width="110" 
                        height="30" 
                        rx="6" 
                        fill="#0f172a" 
                      />
                      <polygon points="-5,8 5,8 0,12" fill="#0f172a" />
                      <text x="0" y="-7" fill="#94a3b8" fontSize="9" fontWeight="600" textAnchor="middle">
                        {activePoint.data?.timestamp ? new Date(activePoint.data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                      </text>
                      <text x="0" y="5" fill="#ffffff" fontSize="11" fontWeight="800" fontFamily="monospace" textAnchor="middle">
                        {activeParam === 'water' 
                          ? `${Number(activePoint.val).toFixed(waterUnit === 'm' ? 3 : 1)} ${waterUnit}`
                          : `${Number(activePoint.val).toFixed(0)} dBm`}
                      </text>
                    </g>

                    {/* Bottom Time Badge */}
                    {activePoint.data?.timestamp && (
                      <g transform={`translate(${Math.min(Math.max(activePoint.x, paddingX + 45), svgWidth - paddingX - 45)}, ${svgHeight - paddingY + 24})`}>
                        <rect x="-42" y="-10" width="84" height="18" rx="4" fill="#e2e8f0" />
                        <text x="0" y="3" fill="#334155" fontSize="10" fontWeight="700" textAnchor="middle">
                          {new Date(activePoint.data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </text>
                      </g>
                    )}
                  </g>
                )}
              </svg>

              {/* Time Span Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', fontSize: '0.74rem', color: '#64748b' }}>
                <span>Awal: <b>{points.length > 0 && points[0].data?.timestamp ? new Date(points[0].data.timestamp).toLocaleString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--'}</b></span>
                <span>Total: <b>{points.length} Titik Sampel</b></span>
                <span>Terkini: <b>{points.length > 0 && points[points.length - 1].data?.timestamp ? new Date(points[points.length - 1].data.timestamp).toLocaleString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--'}</b></span>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ========================================================= */}
      {/* 4. DINAMIKA & HARMONIK PASANG SURUT TERRAFLOW */}
      {/* ========================================================= */}
      <div className="corporate-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#edf2fc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#003882' }}>
            <Anchor size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Karakteristik Oseanografi &amp; Pasang Surut
            </h3>
            <span style={{ fontSize: '0.76rem', color: '#64748b' }}>Estimasi harmonik air laut berdasarkan rentang filter aktif</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
          
          {/* Card: Status Dinamika */}
          <div className="subtle-panel" style={{ 
            borderLeft: `4px solid ${series.length === 0 ? '#94a3b8' : currentStatus.status === 'RISING' ? '#059669' : currentStatus.status === 'FALLING' ? '#d97706' : '#0284c7'}`
          }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>STATUS DINAMIKA</span>
            <div className="mono-text" style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
              {series.length === 0 ? 'N/A' : (currentStatus.label || 'Air Tenang')}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Laju: {Math.abs(Number(currentStatus.ratePerHour) || 0).toFixed(1)} cm/jam</div>
          </div>

          {/* Card: HHT */}
          <div className="subtle-panel" style={{ borderLeft: '4px solid #003882' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>HHT (PASANG TERTINGGI)</span>
            <div className="mono-text" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
              {series.length > 0 && stats.hht != null ? (stats.hht / 100).toFixed(2) : '--'} <span style={{ fontSize: '0.8rem', color: '#003882' }}>m</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{stats.hht != null ? `${Number(stats.hht).toFixed(1)} cm` : ''}</div>
          </div>

          {/* Card: LLT */}
          <div className="subtle-panel" style={{ borderLeft: '4px solid #d97706' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>LLT (SURUT TERENDAH)</span>
            <div className="mono-text" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
              {series.length > 0 && stats.llt != null ? (stats.llt / 100).toFixed(2) : '--'} <span style={{ fontSize: '0.8rem', color: '#d97706' }}>m</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{stats.llt != null ? `${Number(stats.llt).toFixed(1)} cm` : ''}</div>
          </div>

          {/* Card: MSL */}
          <div className="subtle-panel" style={{ borderLeft: '4px solid #059669' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>MSL (DUDUK TENGAH)</span>
            <div className="mono-text" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
              {series.length > 0 && stats.msl != null ? (stats.msl / 100).toFixed(2) : '--'} <span style={{ fontSize: '0.8rem', color: '#059669' }}>m</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{stats.msl != null ? `${Number(stats.msl).toFixed(1)} cm` : ''}</div>
          </div>

          {/* Card: Tunggang Air */}
          <div className="subtle-panel" style={{ borderLeft: '4px solid #7c3aed' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>TUNGGANG AIR (RANGE)</span>
            <div className="mono-text" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
              {series.length > 0 && stats.tidalRange != null ? (stats.tidalRange / 100).toFixed(2) : '--'} <span style={{ fontSize: '0.8rem', color: '#7c3aed' }}>m</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Periode: {stats.avgPeriodHours || '12.42'} jam</div>
          </div>

        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. TABEL RIWAYAT TELEMETRI */}
      {/* ========================================================= */}
      <div className="corporate-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Tabel Rekaman Telemetri
            </h3>
            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
              Menampilkan {readings.length > 0 ? (page - 1) * pageSize + 1 : 0} - {Math.min(page * pageSize, readings.length)} dari {readings.length} rekaman
            </span>
          </div>
        </div>

        <div className="table-responsive">
          <table className="corporate-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Waktu (WIB)</th>
                <th>Elevasi Air ({waterUnit === 'm' ? 'm' : 'cm'})</th>
                <th>Kualitas Sinyal (RSSI)</th>
              </tr>
            </thead>
            <tbody>
              {loadingHistory ? (
                <tr><td colSpan="3" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>Memuat data telemetri...</td></tr>
              ) : paginatedData.length === 0 ? (
                <tr><td colSpan="3" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>Tidak ada rekaman dalam rentang filter ini.</td></tr>
              ) : (
                paginatedData.map((row, idx) => (
                  <tr key={idx}>
                    <td className="mono-text" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      {formatTableTime(row.timestamp)}
                    </td>
                    <td className="mono-text" style={{ fontWeight: 800, color: '#003882', fontSize: '0.88rem' }}>
                      {row.water_level_cm != null ? (
                        waterUnit === 'm'
                          ? `${(Number(row.water_level_cm) / 100).toFixed(3)} m`
                          : `${Number(row.water_level_cm).toFixed(1)} cm`
                      ) : '--'}
                    </td>
                    <td className="mono-text">
                      {row.signal_quality != null ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          background: '#f1f5f9',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          color: '#334155'
                        }}>
                          <Wifi size={12} color="#0284c7" />
                          {row.signal_quality} dBm
                        </span>
                      ) : '--'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginasi */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ChevronLeft size={16} />
              <span>Sebelumnya</span>
            </button>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b' }}>
              Halaman {page} dari {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>Berikutnya</span>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 6. MODAL DOWNLOAD LOGS (LUWES-STYLE, CORPORATE THEME) */}
      {/* ========================================================= */}
      {showExportModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="corporate-card" style={{
            width: '100%',
            maxWidth: '560px',
            background: '#ffffff',
            borderRadius: '16px',
            padding: '26px',
            boxShadow: '0 20px 40px rgba(0, 56, 130, 0.25)',
            position: 'relative'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Unduh Rekaman Data (Download Logs)
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Stasiun: {device?.device_id || 'AWLR-001'} &bull; Rentang filter aktif
                </span>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* 1. Format Berkas (Tanpa format jam redundan) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', marginBottom: '8px' }}>
                  1. Format Berkas:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                  {[
                    { id: 'txt', label: 'TXT (Teks Log)' },
                    { id: 'csv', label: 'CSV Spreadsheet' },
                    { id: 'json', label: 'JSON API' }
                  ].map(f => (
                    <label key={f.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: exportFormat === f.id ? '#edf2fc' : '#f8fafc',
                      border: `1px solid ${exportFormat === f.id ? '#003882' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: exportFormat === f.id ? '#003882' : '#475569'
                    }}>
                      <input
                        type="radio"
                        name="expFormat"
                        checked={exportFormat === f.id}
                        onChange={() => setExportFormat(f.id)}
                        style={{ accentColor: '#003882' }}
                      />
                      <span>{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 2. Agregasi Data */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', marginBottom: '8px' }}>
                  2. Agregasi Waktu (Sampling):
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
                  {[
                    { id: 'raw', label: 'Raw (Asli)' },
                    { id: '5m', label: '5 Menit' },
                    { id: '15m', label: '15 Menit' },
                    { id: '1h', label: '1 Jam' }
                  ].map(a => (
                    <label key={a.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: exportAggregate === a.id ? '#edf2fc' : '#f8fafc',
                      border: `1px solid ${exportAggregate === a.id ? '#003882' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      padding: '8px 10px',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: exportAggregate === a.id ? '#003882' : '#475569'
                    }}>
                      <input
                        type="radio"
                        name="expAgg"
                        checked={exportAggregate === a.id}
                        onChange={() => setExportAggregate(a.id)}
                        style={{ accentColor: '#003882' }}
                      />
                      <span>{a.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 3. Zona Waktu & Satuan */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', marginBottom: '6px' }}>
                    3. Zona Waktu:
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                      <input type="radio" name="expTz" checked={exportTz === 'wib'} onChange={() => setExportTz('wib')} style={{ accentColor: '#003882' }} />
                      <span>WIB (GMT+7)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                      <input type="radio" name="expTz" checked={exportTz === 'utc'} onChange={() => setExportTz('utc')} style={{ accentColor: '#003882' }} />
                      <span>UTC (GMT+0)</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', marginBottom: '6px' }}>
                    4. Satuan Elevasi:
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                      <input type="radio" name="expUnit" checked={exportUnit === 'm'} onChange={() => setExportUnit('m')} style={{ accentColor: '#003882' }} />
                      <span>Meter (m)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                      <input type="radio" name="expUnit" checked={exportUnit === 'cm'} onChange={() => setExportUnit('cm')} style={{ accentColor: '#003882' }} />
                      <span>Centimeter (cm)</span>
                    </label>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '10px' }}>
              <button
                type="button"
                onClick={handleDownloadPNG}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '8px 14px' }}
              >
                <Camera size={15} />
                <span>Unduh Grafik PNG</span>
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '8px 14px' }}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDownloadFile}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '8px 18px', fontWeight: 700 }}
                >
                  <Download size={15} />
                  <span>Unduh File Data</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
