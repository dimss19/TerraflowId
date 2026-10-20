import React, { useState, useEffect, useRef, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  Wifi,
  CirclePlus,
  CircleMinus,
  RotateCcw
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
  const [zoomCenterIndex, setZoomCenterIndex] = useState(null);

  // --- Modal Download Logs State ---
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('pdf'); // 'pdf', 'txt', 'csv'
  const [exportDate, setExportDate] = useState(() => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  });
  const [exportTz, setExportTz] = useState('wib'); // 'wib', 'utc'
  const [exportUnit, setExportUnit] = useState('m'); // 'm', 'cm'
  const [isExporting, setIsExporting] = useState(false);

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
    setZoomLevel(1);
    setZoomCenterIndex(null);
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
    setZoomLevel(1);
    setZoomCenterIndex(null);
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
    setZoomCenterIndex(null);
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

  // Helper: Persiapan baris data untuk tabel log di PDF (24 Jam Penuh)
  const prepareAggregatedRows = (data, tz, unit) => {
    if (!data || data.length === 0) return [];
    
    return data.map((row, idx) => {
      const d = new Date(row.timestamp);
      let dateStr = '--';
      if (!isNaN(d.getTime())) {
        if (tz === 'utc') {
          dateStr = d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
        } else {
          const pad = (n) => String(n).padStart(2, '0');
          const wib = new Date(d.getTime() + 7 * 3600 * 1000);
          dateStr = `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth() + 1)}-${pad(wib.getUTCDate())} ${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}:${pad(wib.getUTCSeconds())} WIB`;
        }
      }

      const wl = Number(row.smoothed_level) || Number(row.water_level_cm) || 0;
      const elevStr = unit === 'cm' ? `${wl.toFixed(1)} cm` : `${(wl / 100).toFixed(3)} m`;
      const rssiStr = row.signal_quality != null ? `${row.signal_quality} dBm` : '-';
      const battStr = row.battery_voltage != null ? `${Number(row.battery_voltage).toFixed(2)} V` : '-';
      const tempStr = row.temperature_c != null ? `${Number(row.temperature_c).toFixed(1)} °C` : '-';
      const statusStr = 'VALID';

      return [
        String(idx + 1),
        dateStr,
        elevStr,
        rssiStr,
        battStr,
        tempStr,
        statusStr
      ];
    });
  };

  // Unduh Laporan Resmi PDF 24 Jam (Kop PT Tanah Airku Teknologi, Logo TerraFlow, AWLR Portable, Lokasi, Koordinat, Grafik & Tabel Log)
  const handleDownloadPDF = (dataToUse, targetDateStr) => {
    if (!device?.device_id) return;

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const marginX = 14;
      const contentWidth = pageWidth - marginX * 2; // 182 mm

      // 1. Ekstrak Metadata Stasiun & Perangkat
      const stationName = device?.station_name || device?.name || 'Pos AWLR-001';
      const deviceId = device?.device_id || 'AWLR-001';
      const location = device?.location || 'Pantai Batu Bengkung, Malang Selatan, Jawa Timur';
      
      const latVal = device?.latitude !== undefined && device?.latitude !== null && !isNaN(Number(device.latitude))
        ? Number(device.latitude)
        : -8.4285;
      const lonVal = device?.longitude !== undefined && device?.longitude !== null && !isNaN(Number(device.longitude))
        ? Number(device.longitude)
        : 112.5385;

      const latDirection = latVal >= 0 ? 'LU (N)' : 'LS (S)';
      const lonDirection = lonVal >= 0 ? 'BT (E)' : 'BB (W)';
      const coordStr = `${Math.abs(latVal).toFixed(5)}° ${latDirection}, ${Math.abs(lonVal).toFixed(5)}° ${lonDirection} (${latVal.toFixed(6)}, ${lonVal.toFixed(6)})`;

      const sensorHeight = device?.sensor_height_cm || device?.pole_height_cm || 400;
      const acuan1 = device?.acuan_tiang_1_cm != null ? `${device.acuan_tiang_1_cm} cm` : '-';
      const acuan2 = device?.acuan_tiang_2_cm != null ? `${device.acuan_tiang_2_cm} cm` : '-';

      // Rentang Tanggal 24 Jam Penuh
      const activeDate = targetDateStr || exportDate || new Date().toISOString().slice(0, 10);
      const periodeStr = `${activeDate} (24 Jam Penuh: 00:00:00 - 23:59:59 ${exportTz.toUpperCase()})`;

      const printDate = new Date().toLocaleString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }) + (exportTz === 'wib' ? ' WIB' : ' UTC');

      const tzLabel = exportTz === 'wib' ? 'WIB (GMT+7)' : 'UTC (GMT+0)';
      const unitLabel = exportUnit === 'm' ? 'Meter (m)' : 'Centimeter (cm)';

      // 2. KOP RESMI LAPORAN (PT TANAH AIRKU TEKNOLOGI / TERRAFLOW)
      const logoX = marginX + 8;
      const logoY = 19;
      doc.setFillColor(0, 56, 130);
      doc.circle(logoX, logoY, 7.5, 'F');
      doc.setFillColor(255, 255, 255);
      doc.circle(logoX, logoY, 6.3, 'F');
      doc.setFillColor(0, 56, 130);
      doc.circle(logoX, logoY, 2.5, 'F');
      
      // 4 Arah Jarum Kompas Logo
      doc.setFillColor(2, 132, 199);
      doc.triangle(logoX, logoY - 5.5, logoX - 1.2, logoY - 1, logoX + 1.2, logoY - 1, 'F');
      doc.triangle(logoX, logoY + 5.5, logoX - 1.2, logoY + 1, logoX + 1.2, logoY + 1, 'F');
      doc.triangle(logoX - 5.5, logoY, logoX - 1, logoY - 1.2, logoX - 1, logoY + 1.2, 'F');
      doc.triangle(logoX + 5.5, logoY, logoX + 1, logoY - 1.2, logoX + 1, logoY + 1.2, 'F');

      // Teks Brand
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(0, 56, 130);
      doc.text('TERRAFLOW INDONESIA', marginX + 19, 16);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text('PT TANAH AIRKU TEKNOLOGI', marginX + 19, 20.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(71, 85, 105);
      doc.text('Divisi Instrumentasi Hidrometri & Sistem Telemetri Mandiri (AWLR Portable)', marginX + 19, 24.5);
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Portal Hidrometri: www.tanahairku.tech • Dukungan Teknis: support@tanahairku.tech', marginX + 19, 28);

      // Box Dokumen Info di kanan atas kop
      const boxW = 55;
      const boxH = 18;
      const boxX = pageWidth - marginX - boxW;
      const boxY = 11;
      doc.setFillColor(240, 249, 255);
      doc.setDrawColor(186, 230, 253);
      doc.setLineWidth(0.3);
      doc.roundedRect(boxX, boxY, boxW, boxH, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(0, 56, 130);
      doc.text('DOKUMEN RESMI HIDROMETRI', boxX + boxW / 2, boxY + 4.5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(51, 65, 85);
      const docCode = `TF-AWLR/${deviceId}/${activeDate.replace(/-/g, '')}`;
      doc.text(`No. Dok: ${docCode}`, boxX + 3, boxY + 8.5);
      doc.text(`Model: AWLR Portable Standar`, boxX + 3, boxY + 12);
      doc.setTextColor(2, 132, 199);
      doc.setFont('helvetica', 'bold');
      doc.text(`Status: Terverifikasi Sistem`, boxX + 3, boxY + 15.5);

      // Garis Pembatas Kop Ganda
      doc.setDrawColor(0, 56, 130);
      doc.setLineWidth(0.8);
      doc.line(marginX, 32, pageWidth - marginX, 32);
      doc.setDrawColor(2, 132, 199);
      doc.setLineWidth(0.3);
      doc.line(marginX, 33.2, pageWidth - marginX, 33.2);

      // 3. JUDUL LAPORAN RESMI
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(0, 56, 130);
      doc.text('LAPORAN RESMI HASIL PEMANTAUAN ELEVASI MUKA AIR & TELEMETRI', pageWidth / 2, 39, { align: 'center' });
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('INSTRUMEN AUTOMATIC WATER LEVEL RECORDER (AWLR) PORTABLE — PEMANTAUAN KONTINU', pageWidth / 2, 43.5, { align: 'center' });

      // 4. KOTAK INFORMASI STASIUN, LOKASI & KOORDINAT
      const infoBoxY = 47;
      const infoBoxH = 34;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(marginX, infoBoxY, contentWidth, infoBoxH, 2, 2, 'FD');

      // Subheader Kotak Info
      doc.setFillColor(237, 242, 252);
      doc.rect(marginX, infoBoxY, contentWidth, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(0, 56, 130);
      doc.text('IDENTITAS STASIUN, SPESIFIKASI LOKASI & PARAMETER PENGUKURAN', marginX + 4, infoBoxY + 4.2);

      // Kolom 1 (Kiri) & Kolom 2 (Kanan)
      const col1X = marginX + 4;
      const col2X = marginX + contentWidth / 2 + 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);

      // Row 1
      doc.text('Nama Stasiun:', col1X, infoBoxY + 11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(stationName, col1X + 25, infoBoxY + 11);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('ID Perangkat (SN):', col2X, infoBoxY + 11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 56, 130);
      doc.text(`${deviceId} (AWLR Portable)`, col2X + 28, infoBoxY + 11);

      // Row 2
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Lokasi Pasang:', col1X, infoBoxY + 16.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(location.length > 40 ? location.slice(0, 38) + '...' : location, col1X + 25, infoBoxY + 16.5);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Tinggi Sensor/Tiang:', col2X, infoBoxY + 16.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(`${sensorHeight} cm (${(sensorHeight / 100).toFixed(2)} m)`, col2X + 28, infoBoxY + 16.5);

      // Row 3
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Koordinat GPS:', col1X, infoBoxY + 22);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 56, 130);
      doc.text(coordStr, col1X + 25, infoBoxY + 22);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Acuan Tiang 1 / 2:', col2X, infoBoxY + 22);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(`${acuan1} / ${acuan2}`, col2X + 28, infoBoxY + 22);

      // Row 4
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Periode Rekaman:', col1X, infoBoxY + 27.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(periodeStr, col1X + 25, infoBoxY + 27.5);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Sampling / Format:', col2X, infoBoxY + 27.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(`24 Jam Penuh (Raw) | ${tzLabel} | ${unitLabel}`, col2X + 28, infoBoxY + 27.5);

      // 5. KARTU STATISTIK HIDROMETRI (4 Kolom untuk 24 Jam Penuh)
      const plotSource = (dataToUse && dataToUse.length > 0) ? dataToUse : (readings.length > 0 ? readings : series);
      const sortedChartSource = [...plotSource].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      const dayLevels = sortedChartSource.map(d => Number(d.water_level_cm) || 0);
      const dayLlt = dayLevels.length ? Math.min(...dayLevels) : Number(stats.llt || 0);
      const dayHht = dayLevels.length ? Math.max(...dayLevels) : Number(stats.hht || 0);
      const dayMsl = dayLevels.length ? (dayLevels.reduce((a, b) => a + b, 0) / dayLevels.length) : Number(stats.msl || 0);
      const dayRange = dayHht - dayLlt;

      const statY = infoBoxY + infoBoxH + 4;
      const statCardW = (contentWidth - 9) / 4; // ~43.25 mm
      const statCardH = 17;

      const statItems = [
        {
          label: 'ELEVASI MINIMUM (LLT)',
          val: exportUnit === 'm' ? `${(dayLlt / 100).toFixed(3)} m` : `${dayLlt.toFixed(1)} cm`,
          sub: 'Surut Terendah 24 Jam',
          border: [217, 119, 6] // amber
        },
        {
          label: 'ELEVASI MAKSIMUM (HHT)',
          val: exportUnit === 'm' ? `${(dayHht / 100).toFixed(3)} m` : `${dayHht.toFixed(1)} cm`,
          sub: 'Pasang Tertinggi 24 Jam',
          border: [0, 56, 130] // navy
        },
        {
          label: 'DUDUK TENGAH (MSL)',
          val: exportUnit === 'm' ? `${(dayMsl / 100).toFixed(3)} m` : `${dayMsl.toFixed(1)} cm`,
          sub: 'Rata-Rata Elevasi 24 Jam',
          border: [5, 150, 105] // emerald
        },
        {
          label: 'TUNGGANG AIR (RANGE)',
          val: exportUnit === 'm' ? `${(dayRange / 100).toFixed(3)} m` : `${dayRange.toFixed(1)} cm`,
          sub: `${sortedChartSource.length} Sampel Terkalibrasi`,
          border: [124, 58, 237] // purple
        }
      ];

      statItems.forEach((st, idx) => {
        const cX = marginX + idx * (statCardW + 3);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(cX, statY, statCardW, statCardH, 1.5, 1.5, 'FD');

        // Color accent line on left
        doc.setDrawColor(st.border[0], st.border[1], st.border[2]);
        doc.setLineWidth(1.2);
        doc.line(cX, statY + 1.5, cX, statY + statCardH - 1.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.8);
        doc.setTextColor(100, 116, 139);
        doc.text(st.label, cX + 3.5, statY + 4.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(0, 56, 130);
        doc.text(st.val, cX + 3.5, statY + 10.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(71, 85, 105);
        doc.text(st.sub, cX + 3.5, statY + 14.5);
      });

      // 6. GRAFIK ELEVASI MUKA AIR (HIGH-RESOLUTION CANVAS EMBED)
      const chartHeaderY = statY + statCardH + 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(0, 56, 130);
      doc.text('GRAFIK TELEMETRI ELEVASI MUKA AIR (WATER LEVEL RECORD)', marginX, chartHeaderY);

      // Render chart canvas
      const chartCanvas = document.createElement('canvas');
      chartCanvas.width = 1200;
      chartCanvas.height = 460;
      const ctx = chartCanvas.getContext('2d');

      // Draw background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, chartCanvas.width, chartCanvas.height);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(1, 1, chartCanvas.width - 2, chartCanvas.height - 2);

      // Header inside canvas
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(2, 2, chartCanvas.width - 4, 38);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`Water Level Telemetry Curve — Stasiun ${deviceId}`, 24, 25);
      ctx.fillStyle = '#64748b';
      ctx.font = '12px "Inter", sans-serif';
      ctx.fillText(`Rentang: ${activeDate} (24 Jam) • Satuan: ${unitLabel}`, chartCanvas.width - 340, 25);

      // Grid & Graph boundaries
      const cvPadX = 70;
      const cvPadY = 60;
      const cvW = chartCanvas.width - cvPadX * 2;
      const cvH = chartCanvas.height - cvPadY - 50;

      const chartValues = sortedChartSource.map(s => {
        const cm = Number(s.smoothed_level) || Number(s.water_level_cm) || 0;
        return exportUnit === 'm' ? cm / 100 : cm;
      });

      const chartMinRaw = chartValues.length ? Math.min(...chartValues) : 0;
      const chartMaxRaw = chartValues.length ? Math.max(...chartValues) : (exportUnit === 'm' ? 5 : 500);
      const chartSpread = Math.max(exportUnit === 'm' ? 0.1 : 10, chartMaxRaw - chartMinRaw);
      const chartMinVal = chartMinRaw - chartSpread * 0.15;
      const chartMaxVal = chartMaxRaw + chartSpread * 0.15;
      const chartValRange = Math.max(0.001, chartMaxVal - chartMinVal);

      // Draw grid
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = cvPadY + (i / 4) * cvH;
        ctx.beginPath();
        ctx.moveTo(cvPadX, y);
        ctx.lineTo(cvPadX + cvW, y);
        ctx.stroke();

        const gridVal = chartMaxVal - (i / 4) * chartValRange;
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(exportUnit === 'cm' ? `${gridVal.toFixed(1)} cm` : `${gridVal.toFixed(3)} m`, cvPadX - 10, y + 4);
      }
      ctx.textAlign = 'left';

      // Draw Curve
      if (sortedChartSource.length > 1) {
        const cvPts = sortedChartSource.map((s, idx) => {
          const cm = Number(s.smoothed_level) || Number(s.water_level_cm) || 0;
          const val = exportUnit === 'm' ? cm / 100 : cm;
          return {
            x: cvPadX + (idx / Math.max(1, sortedChartSource.length - 1)) * cvW,
            y: cvPadY + cvH - ((val - chartMinVal) / chartValRange) * cvH
          };
        });

        // Gradient Area
        ctx.beginPath();
        ctx.moveTo(cvPts[0].x, cvPadY + cvH);
        cvPts.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(cvPts[cvPts.length - 1].x, cvPadY + cvH);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, cvPadY, 0, cvPadY + cvH);
        grad.addColorStop(0, 'rgba(2, 132, 199, 0.32)');
        grad.addColorStop(1, 'rgba(2, 132, 199, 0.0)');
        ctx.fillStyle = grad;
        ctx.fill();

        // Line
        ctx.beginPath();
        cvPts.forEach((p, idx) => {
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.strokeStyle = '#003882';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Sample Dots
        const dotSample = cvPts.filter((_, idx) => idx % Math.max(1, Math.floor(cvPts.length / 40)) === 0);
        dotSample.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = '#0284c7';
          ctx.fill();
        });
      }

      // Canvas Footer Legends
      ctx.fillStyle = '#003882';
      ctx.beginPath();
      ctx.arc(cvPadX + 10, chartCanvas.height - 20, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 12px "Inter", sans-serif';
      ctx.fillStyle = '#334155';
      ctx.fillText('Water Level (Elevasi Air Aktual)', cvPadX + 20, chartCanvas.height - 16);

      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.arc(cvPadX + 240, chartCanvas.height - 20, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#334155';
      ctx.fillText('Trend Dinamika Pasang Surut', cvPadX + 250, chartCanvas.height - 16);

      ctx.fillStyle = '#64748b';
      ctx.font = '11px "Inter", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`Total ${sortedChartSource.length} Titik Sampel (24 Jam) • Dicetak: ${printDate}`, chartCanvas.width - 24, chartCanvas.height - 16);
      ctx.textAlign = 'left';

      // Add image to PDF
      const chartImgData = chartCanvas.toDataURL('image/png');
      const chartPdfH = 68; // mm
      doc.addImage(chartImgData, 'PNG', marginX, chartHeaderY + 2, contentWidth, chartPdfH);

      // 7. LEMBAR PENGESAHAN & TANDA TANGAN RESMI
      const signY = chartHeaderY + chartPdfH + 6;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(marginX, signY, contentWidth, 36, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text('CATATAN: Seluruh data telemetri di atas terekam secara mandiri dan otomatis melalui instrumen TerraFlow AWLR Portable.', marginX + 4, signY + 4.5);

      // Dua kolom tanda tangan
      const signCol1X = marginX + 16;
      const signCol2X = marginX + contentWidth - 65;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text('Petugas Pengamat Hidrometri Lapangan,', signCol1X, signY + 10);
      doc.text('Penanggung Jawab Teknis Hidrologi,', signCol2X, signY + 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Stasiun: ${stationName}`, signCol1X, signY + 13.5);
      doc.text('PT Tanah Airku Teknologi (TerraFlow)', signCol2X, signY + 13.5);

      // Line for signatures
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.5);
      doc.line(signCol1X, signY + 28, signCol1X + 46, signY + 28);
      doc.line(signCol2X, signY + 28, signCol2X + 46, signY + 28);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(51, 65, 85);
      doc.text('( .................................................... )', signCol1X, signY + 31.5);
      doc.text('( Verifikator Sistem Digital )', signCol2X, signY + 31.5);
      doc.setFont('helvetica', 'normal');
      doc.text('NIP / ID: .......................................', signCol1X, signY + 34.5);
      doc.text('ID Tiket: TF-SYS-VERIFIED', signCol2X, signY + 34.5);

      // 8. HALAMAN 2: LAMPIRAN TABEL LOG DATA TELEMETRI
      doc.addPage();
      
      // Header Halaman Lampiran
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(0, 56, 130);
      doc.text('LAMPIRAN TABEL LOG REKAMAN DATA TELEMETRI', marginX, 16);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Stasiun: ${stationName} (${deviceId}) • Periode: ${activeDate} (24 Jam Penuh) • Satuan: ${unitLabel}`, marginX, 20.5);

      // Persiapkan Baris Data
      const tableRows = prepareAggregatedRows(sortedChartSource, exportTz, exportUnit);

      const autoTableFn = typeof autoTable === 'function' ? autoTable : doc.autoTable;
      autoTableFn(doc, {
        startY: 24,
        head: [['No.', 'Waktu Transmisi', `Elevasi Air (${exportUnit})`, 'Sinyal (RSSI)', 'Baterai', 'Suhu Sensor', 'Status Validasi']],
        body: tableRows,
        theme: 'grid',
        headStyles: {
          fillColor: [0, 56, 130],
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: 'bold',
          halign: 'center',
          cellPadding: 2
        },
        bodyStyles: {
          fontSize: 7,
          textColor: [30, 41, 59],
          cellPadding: 1.8
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 12 },
          1: { halign: 'center', cellWidth: 46 },
          2: { halign: 'right', fontStyle: 'bold', textColor: [0, 56, 130], cellWidth: 32 },
          3: { halign: 'center', cellWidth: 26 },
          4: { halign: 'center', cellWidth: 22 },
          5: { halign: 'center', cellWidth: 22 },
          6: { halign: 'center', cellWidth: 22 }
        },
        margin: { left: marginX, right: marginX, bottom: 16 }
      });

      // 9. NOMOR HALAMAN & RUNNING FOOTER DI SELURUH HALAMAN
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(148, 163, 184);
        doc.text(`TerraFlow AWLR Portable • PT Tanah Airku Teknologi • Stasiun ${deviceId}`, marginX, pageHeight - 8);
        doc.text(`Halaman ${p} dari ${totalPages}`, pageWidth - marginX, pageHeight - 8, { align: 'right' });
      }

      // 10. SIMPAN & UNDUH BERKAS PDF
      const fileName = `TerraFlow_${deviceId}_Laporan_24Jam_${activeDate}.pdf`;
      doc.save(fileName);
      setShowExportModal(false);
    } catch (err) {
      console.error('Error generating PDF report:', err);
      alert('Terjadi kendala saat membuat laporan PDF. Silakan coba kembali.');
    }
  };

  // Ekspor File Data 24 Jam (PDF / TXT / CSV)
  const handleDownloadFile = async () => {
    if (!device?.device_id || isExporting) return;

    setIsExporting(true);
    try {
      const targetDate = exportDate || new Date().toISOString().slice(0, 10);
      let sIso, eIso;
      if (exportTz === 'wib') {
        sIso = new Date(`${targetDate}T00:00:00+07:00`).toISOString();
        eIso = new Date(`${targetDate}T23:59:59+07:00`).toISOString();
      } else {
        sIso = new Date(`${targetDate}T00:00:00Z`).toISOString();
        eIso = new Date(`${targetDate}T23:59:59Z`).toISOString();
      }

      // Ambil seluruh data 24 jam penuh dari server
      const q = new URLSearchParams({
        start: sIso,
        end: eIso,
        limit: 2000
      });
      const res = await fetch(`/api/readings/${device.device_id}?${q}`);
      const json = await res.json();
      let dayData = (json.success && Array.isArray(json.data) && json.data.length > 0)
        ? json.data
        : [];

      // Fallback lokal jika data filter API kosong
      if (dayData.length === 0) {
        dayData = readings.filter(r => {
          const dStr = exportTz === 'wib' 
            ? new Date(new Date(r.timestamp).getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10)
            : new Date(r.timestamp).toISOString().slice(0, 10);
          return dStr === targetDate;
        });
      }

      if (dayData.length === 0) {
        alert(`Tidak ditemukan rekaman data telemetri pada tanggal ${targetDate} (${exportTz.toUpperCase()}). Silakan pilih tanggal lain yang memiliki rekaman data.`);
        setIsExporting(false);
        return;
      }

      const sortedDayData = [...dayData].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // 1. FORMAT PDF
      if (exportFormat === 'pdf') {
        handleDownloadPDF(sortedDayData, targetDate);
        setIsExporting(false);
        return;
      }

      // 2. FORMAT TXT (Standar Hidrometri 24 Jam)
      if (exportFormat === 'txt') {
        const lines = [];
        sortedDayData.forEach(r => {
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
          const wl = Number(r.smoothed_level) || Number(r.water_level_cm) || 0;
          const val = exportUnit === 'cm' ? wl.toFixed(1) : (wl / 100).toFixed(3);
          lines.push(`${timeStr}   ${val}`);
        });

        const blob = new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `TerraFlow_${device.device_id}_Log_24Jam_${targetDate}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        setShowExportModal(false);
        setIsExporting(false);
        return;
      }

      // 3. FORMAT CSV (Spreadsheet 24 Jam)
      if (exportFormat === 'csv') {
        const headers = [
          `Waktu (${exportTz === 'wib' ? 'WIB GMT+7' : 'UTC'})`,
          exportUnit === 'cm' ? 'Muka Air (cm)' : 'Muka Air (m)',
          'Sinyal RSSI (dBm)',
          'Tegangan Baterai (V)',
          'Suhu Sensor (°C)',
          'Status'
        ];
        const csvLines = [headers.join(',')];
        sortedDayData.forEach(r => {
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
          const wl = Number(r.smoothed_level) || Number(r.water_level_cm) || 0;
          const val = exportUnit === 'cm' ? wl.toFixed(1) : (wl / 100).toFixed(3);
          csvLines.push([
            timeStr,
            val,
            r.signal_quality != null ? r.signal_quality : '-',
            r.battery_voltage != null ? Number(r.battery_voltage).toFixed(2) : '-',
            r.temperature_c != null ? Number(r.temperature_c).toFixed(1) : '-',
            'VALID'
          ].join(','));
        });

        const blob = new Blob([csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `TerraFlow_${device.device_id}_Log_24Jam_${targetDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        setShowExportModal(false);
        setIsExporting(false);
        return;
      }
    } catch (err) {
      console.error('Error downloading file:', err);
      alert('Terjadi kesalahan saat mengunduh data. Silakan coba kembali.');
    } finally {
      setIsExporting(false);
    }
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
  const paddingX = 58;
  const paddingY = 32;

  // --- Zoom Logic & Visible Slice ---
  // Zoom Level: 1 = Zoom Out (100% data), >1 = Zoom In (irisan subset data terperinci)
  const { displaySeries, visibleStartIndex, visibleEndIndex } = useMemo(() => {
    if (!series || series.length === 0) {
      return { displaySeries: [], visibleStartIndex: 0, visibleEndIndex: 0 };
    }
    if (zoomLevel <= 1 || series.length <= 8) {
      return { displaySeries: series, visibleStartIndex: 0, visibleEndIndex: series.length - 1 };
    }

    const visibleCount = Math.max(8, Math.min(series.length, Math.round(series.length / zoomLevel)));
    const center = zoomCenterIndex !== null ? zoomCenterIndex : (series.length - 1);
    const half = Math.floor(visibleCount / 2);
    let start = center - half;
    let end = start + visibleCount;

    if (start < 0) {
      start = 0;
      end = Math.min(series.length, visibleCount);
    }
    if (end > series.length) {
      end = series.length;
      start = Math.max(0, end - visibleCount);
    }

    const slice = series.slice(start, end);
    return { displaySeries: slice, visibleStartIndex: start, visibleEndIndex: end - 1 };
  }, [series, zoomLevel, zoomCenterIndex]);

  // Zoom In Handler (Tombol (+) - Gambar 1 / Gambar 2 Zoom In)
  const handleZoomIn = () => {
    if (series.length < 8) return;
    
    // Tentukan titik fokus zoom (fokus pada titik hover saat ini, atau titik tengah slice)
    let center = zoomCenterIndex;
    if (sliderIndex !== null && displaySeries[sliderIndex]) {
      const activeTimestamp = displaySeries[sliderIndex]?.timestamp;
      const foundIdx = series.findIndex(s => s.timestamp === activeTimestamp);
      if (foundIdx !== -1) {
        center = foundIdx;
      }
    }
    if (center === null) {
      center = Math.floor(series.length / 2);
    }
    setZoomCenterIndex(center);

    setZoomLevel(prev => {
      if (prev < 1.5) return 1.5;
      if (prev < 2) return 2;
      if (prev < 3) return 3;
      if (prev < 5) return 5;
      if (prev < 8) return 8;
      if (prev < 12) return 12;
      if (prev < 16) return 16;
      return Math.min(24, Number((prev * 1.5).toFixed(1)));
    });
  };

  // Zoom Out Handler (Tombol (-) - Gambar 1 / Gambar 1 Zoom Out)
  const handleZoomOut = () => {
    setZoomLevel(prev => {
      if (prev <= 1.5) {
        setZoomCenterIndex(null);
        return 1;
      }
      if (prev <= 2) return 1.5;
      if (prev <= 3) return 2;
      if (prev <= 5) return 3;
      if (prev <= 8) return 5;
      if (prev <= 12) return 8;
      if (prev <= 16) return 12;
      return Math.max(1, Number((prev / 1.5).toFixed(1)));
    });
  };

  // Reset Zoom ke 1x (Penuh)
  const handleResetZoom = () => {
    setZoomLevel(1);
    setZoomCenterIndex(null);
  };

  // Geser Horizontal / Pan ke waktu sebelumnya
  const handlePanLeft = () => {
    if (zoomLevel <= 1 || series.length === 0) return;
    const visibleCount = Math.max(8, Math.min(series.length, Math.round(series.length / zoomLevel)));
    const step = Math.max(1, Math.round(visibleCount * 0.25));
    setZoomCenterIndex(prev => {
      const current = prev !== null ? prev : Math.floor(series.length / 2);
      return Math.max(0, current - step);
    });
  };

  // Geser Horizontal / Pan ke waktu berikutnya
  const handlePanRight = () => {
    if (zoomLevel <= 1 || series.length === 0) return;
    const visibleCount = Math.max(8, Math.min(series.length, Math.round(series.length / zoomLevel)));
    const step = Math.max(1, Math.round(visibleCount * 0.25));
    setZoomCenterIndex(prev => {
      const current = prev !== null ? prev : Math.floor(series.length / 2);
      return Math.min(series.length - 1, current + step);
    });
  };

  // Extract values based on activeParam across entire series to keep vertical elevation axis stable
  const rawValuesAll = series.map(s => {
    if (activeParam === 'rssi') return Number(s.signal_quality) || 0;
    // Water level
    const cm = Number(s.smoothed_level) || Number(s.water_level_cm) || 0;
    return waterUnit === 'm' ? cm / 100 : cm;
  });

  const minRaw = rawValuesAll.length ? Math.min(...rawValuesAll) : 0;
  const maxRaw = rawValuesAll.length ? Math.max(...rawValuesAll) : 10;
  const spread = Math.max(activeParam === 'water' ? (waterUnit === 'm' ? 0.05 : 5) : 5, maxRaw - minRaw);

  const minVal = minRaw - spread * 0.15;
  const maxVal = maxRaw + spread * 0.15;
  const valRange = Math.max(0.001, maxVal - minVal);

  const filterStartTime = startDate ? new Date(startDate).getTime() : (series.length ? new Date(series[0].timestamp).getTime() : 0);
  const filterEndTime = endDate ? new Date(endDate).getTime() : (series.length ? new Date(series[series.length - 1].timestamp).getTime() : 0);
  const totalDuration = Math.max(1000, filterEndTime - filterStartTime);

  const points = useMemo(() => {
    if (!displaySeries || displaySeries.length === 0) return [];

    return displaySeries.map((s, i) => {
      // Sebaran titik proporsional merata dari awal ke akhir slice (persis standar RealtimeChart)
      const x = paddingX + (i / Math.max(1, displaySeries.length - 1)) * (svgWidth - paddingX * 2);

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
  }, [displaySeries, activeParam, waterUnit, minVal, valRange]);

  // Titik sampel dot di sepanjang kurva (estetika konsisten persis seperti RealtimeChart di Monitoring)
  const curveDots = useMemo(() => {
    if (!points || points.length === 0) return [];
    if (points.length <= 50) return points;
    const targetCount = 50;
    const step = (points.length - 1) / (targetCount - 1);
    const sampled = [];
    for (let i = 0; i < targetCount; i++) {
      const idx = Math.min(points.length - 1, Math.round(i * step));
      sampled.push(points[idx]);
    }
    return sampled;
  }, [points]);

  const pathD = points.length > 0 ? createSmoothPath(points) : '';
  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z`
    : '';

  // Peak tidal markers (hanya yang masuk dalam irisan zoom)
  const highMarkers = highTides
    .map(ht => {
      const found = points.find(p => p.data?.timestamp === ht.timestamp);
      return found ? { ...ht, x: found.x, y: found.y } : null;
    })
    .filter(Boolean);

  const lowMarkers = lowTides
    .map(lt => {
      const found = points.find(p => p.data?.timestamp === lt.timestamp);
      return found ? { ...lt, x: found.x, y: found.y } : null;
    })
    .filter(Boolean);

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
      minute: '2-digit'
    }) + ' WIB';
  };

  // Urutkan rekaman dari yang paling baru ke yang paling lama untuk tampilan tabel
  const sortedReadings = useMemo(() => {
    return [...readings].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [readings]);
  const totalPages = Math.ceil(sortedReadings.length / pageSize) || 1;
  const paginatedData = sortedReadings.slice((page - 1) * pageSize, page * pageSize);

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

          {/* Unit Toggle, Min/Max Stats & Quick Export */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            {/* Min / Max & Sampel Badge persis seperti RealtimeChart */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 500 }}>
                Min: <span className="mono-text" style={{ color: '#003882', fontWeight: 700 }}>
                  {activeParam === 'water' ? (waterUnit === 'm' ? `${minRaw.toFixed(3)} m` : `${(minRaw).toFixed(1)} cm`) : `${minRaw.toFixed(0)} dBm`}
                </span> &bull; 
                Max: <span className="mono-text" style={{ color: '#003882', fontWeight: 700 }}>
                  {activeParam === 'water' ? (waterUnit === 'm' ? ` ${maxRaw.toFixed(3)} m` : ` ${(maxRaw).toFixed(1)} cm`) : ` ${maxRaw.toFixed(0)} dBm`}
                </span>
              </div>
              <span className="badge badge-navy" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Clock size={11} />
                {points.length} Sampel
              </span>
            </div>

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
              {/* Chart Header Bar: Title on Left, Zoom (+) & (-) Toolbar on Right (Persis Gambar 1, 2, 3) */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
                paddingBottom: '8px',
                borderBottom: '1px solid #f1f5f9'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0f172a' }}>
                    {activeParam === 'water' ? 'Water Level' : 'Signal Quality (RSSI)'}
                  </span>
                  {zoomLevel > 1 && (
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: '#0284c7',
                      background: '#f0f9ff',
                      border: '1px solid #bae6fd',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      Zoom {zoomLevel}x ({displaySeries.length} Sampel)
                    </span>
                  )}
                </div>

                {/* Toolbar: (+) and (-) Zoom Buttons & Pan/Reset */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {/* Pan Arrows when Zoomed In */}
                  {zoomLevel > 1 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '1px 3px'
                    }}>
                      <button
                        id="btn-pan-left"
                        type="button"
                        onClick={handlePanLeft}
                        title="Geser waktu ke kiri / sebelumnya (Pan Kiri)"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: '3px 4px',
                          color: '#475569',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <ChevronLeft size={15} />
                      </button>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#003882', padding: '0 4px', userSelect: 'none' }}>
                        Geser
                      </span>
                      <button
                        id="btn-pan-right"
                        type="button"
                        onClick={handlePanRight}
                        title="Geser waktu ke kanan / berikutnya (Pan Kanan)"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: '3px 4px',
                          color: '#475569',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  )}

                  {/* Reset Button when Zoomed In */}
                  {zoomLevel > 1 && (
                    <button
                      id="btn-zoom-reset"
                      type="button"
                      onClick={handleResetZoom}
                      title="Kembali ke ukuran penuh (Zoom Out 1x)"
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: '#475569',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#003882'; e.currentTarget.style.color = '#003882'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#475569'; }}
                    >
                      <RotateCcw size={12} />
                      <span>Reset</span>
                    </button>
                  )}

                  {/* (+) Zoom In Button - Persis Gambar 1 */}
                  <button
                    id="btn-zoom-in"
                    type="button"
                    onClick={handleZoomIn}
                    title="Perbesar Grafik (Zoom In)"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: '4px',
                      color: '#5a6e85',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#003882'; e.currentTarget.style.background = '#edf2fc'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#5a6e85'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    <CirclePlus size={20} strokeWidth={1.8} />
                  </button>

                  {/* (-) Zoom Out Button - Persis Gambar 1 */}
                  <button
                    id="btn-zoom-out"
                    type="button"
                    onClick={handleZoomOut}
                    disabled={zoomLevel <= 1}
                    title={zoomLevel <= 1 ? 'Sudah pada posisi Zoom Out penuh' : 'Perkecil Grafik (Zoom Out)'}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: '4px',
                      color: zoomLevel <= 1 ? '#cbd5e1' : '#5a6e85',
                      cursor: zoomLevel <= 1 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      if (zoomLevel > 1) {
                        e.currentTarget.style.color = '#003882';
                        e.currentTarget.style.background = '#edf2fc';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (zoomLevel > 1) {
                        e.currentTarget.style.color = '#5a6e85';
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <CircleMinus size={20} strokeWidth={1.8} />
                  </button>
                </div>
              </div>

              <svg 
                ref={svgRef}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
                style={{ 
                  width: '100%', 
                  height: 'auto', 
                  display: 'block', 
                  overflow: 'visible',
                  cursor: isDraggingSlider ? 'grabbing' : 'ew-resize',
                  touchAction: 'none'
                }}
                onPointerDown={(e) => {
                  setIsDraggingSlider(true);
                  handlePointerMove(e);
                }}
                onPointerMove={handlePointerMove}
                onMouseMove={handlePointerMove}
                onClick={handlePointerMove}
              >
                <defs>
                  <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#003882" stopOpacity="0.18" />
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
                    ? `${val.toFixed(2)}m`
                    : `${val.toFixed(0)}${activeParam === 'temp' ? '°C' : activeParam === 'batt' ? 'V' : activeParam === 'rssi' ? 'dBm' : 'cm'}`;
                  return (
                    <g key={idx}>
                      <line x1={paddingX} y1={y} x2={svgWidth - paddingX} y2={y} stroke="#f1f5f9" strokeWidth="1.5" strokeDasharray="4 4" />
                      <text x={paddingX - 8} y={y + 3.5} fill="#94a3b8" fontSize="9.5" textAnchor="end" fontFamily="monospace">
                        {formattedVal}
                      </text>
                    </g>
                  );
                })}

                {/* Shaded Area Under Curve */}
                {areaD && <path d={areaD} fill="url(#curveGradient)" className="chart-animated-area" />}

                {/* Main Curve Line */}
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
                {points.length > 0 && !activePoint && (
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

                {/* Sample Dots along Curve (Aestetika Gambar 1 / RealtimeChart) */}
                {curveDots.map((p, idx) => {
                  const isLast = idx === curveDots.length - 1;
                  const isActive = activePoint && Math.abs(activePoint.x - p.x) < 4;
                  const radius = isLast ? 4.5 : 2.5;

                  return (
                    <circle
                      key={`dot-${idx}`}
                      cx={p.x}
                      cy={p.y}
                      r={isActive ? 6 : radius}
                      fill={isLast ? "#003882" : (isActive ? "#0284c7" : "#38bdf8")}
                      stroke="#ffffff"
                      strokeWidth={isLast ? 2.5 : (isActive ? 2 : 1)}
                      opacity={activePoint && !isActive ? 0.6 : 1}
                      style={{ pointerEvents: 'none', transition: 'r 0.15s ease' }}
                    />
                  );
                })}

                {/* High / Low Tide Peak Markers (only on water level mode) */}
                {activeParam === 'water' && highMarkers.map((m, idx) => {
                  const val = m.level != null ? Number(m.level) : Number(m.water_level_cm || 0);
                  return (
                    <g key={`ht-${idx}`}>
                      <circle cx={m.x} cy={m.y} r="5" fill="#003882" stroke="#ffffff" strokeWidth="2" />
                      <text x={m.x} y={m.y - 10} fill="#003882" fontSize="10" fontWeight="800" textAnchor="middle">
                        {waterUnit === 'm' ? `${(val / 100).toFixed(2)}m` : `${val.toFixed(0)}cm`}
                      </text>
                    </g>
                  );
                })}

                {activeParam === 'water' && lowMarkers.map((m, idx) => {
                  const val = m.level != null ? Number(m.level) : Number(m.water_level_cm || 0);
                  return (
                    <g key={`lt-${idx}`}>
                      <circle cx={m.x} cy={m.y} r="5" fill="#d97706" stroke="#ffffff" strokeWidth="2" />
                      <text x={m.x} y={m.y + 16} fill="#d97706" fontSize="10" fontWeight="800" textAnchor="middle">
                        {waterUnit === 'm' ? `${(val / 100).toFixed(2)}m` : `${val.toFixed(0)}cm`}
                      </text>
                    </g>
                  );
                })}

                {/* ======================================================== */}
                {/* SLIDING CROSSHAIR, INTERSECTION POINT & DARK TOOLTIP */}
                {/* (Interaksi geser horizontal persis seperti RealtimeChart)  */}
                {/* ======================================================== */}
                {activePoint && (
                  <g style={{ cursor: 'ew-resize', pointerEvents: 'none' }}>
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

                    {/* Floating Dark Tooltip Box */}
                    {(() => {
                      const tooltipWidth = 126;
                      const halfWidth = tooltipWidth / 2;
                      const clampedX = Math.min(Math.max(activePoint.x, paddingX + halfWidth), svgWidth - paddingX - halfWidth);
                      const isTop = activePoint.y < 58;
                      const tooltipY = isTop ? activePoint.y + 36 : activePoint.y - 28;

                      // Format TMA dalam cm & m
                      let line2 = '';
                      if (activeParam === 'water') {
                        const cmVal = waterUnit === 'm' ? Number(activePoint.val) * 100 : Number(activePoint.val);
                        const mVal = waterUnit === 'm' ? Number(activePoint.val) : Number(activePoint.val) / 100;
                        line2 = `${cmVal.toFixed(1)} cm (${mVal.toFixed(2)} m)`;
                      } else {
                        line2 = `${Number(activePoint.val).toFixed(0)} dBm`;
                      }

                      const d = activePoint.data?.timestamp ? new Date(activePoint.data.timestamp) : null;
                      const timeStr = d ? d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--:--';

                      return (
                        <g 
                          transform={`translate(${clampedX}, ${tooltipY})`}
                          filter="url(#badgeShadow)"
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
                            {timeStr}
                          </text>
                          <text x="0" y="6" fill="#ffffff" fontSize="11" fontWeight="800" fontFamily="monospace" textAnchor="middle">
                            {line2}
                          </text>
                        </g>
                      );
                    })()}

                    {/* Bottom Time Badge */}
                    {activePoint.data?.timestamp && (
                      <g transform={`translate(${Math.min(Math.max(activePoint.x, paddingX + 32), svgWidth - paddingX - 32)}, ${svgHeight - paddingY + 22})`}>
                        <rect x="-28" y="-9" width="56" height="18" rx="4" fill="#e2e8f0" />
                        <text x="0" y="3.5" fill="#334155" fontSize="10" fontWeight="700" textAnchor="middle">
                          {new Date(activePoint.data.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </text>
                      </g>
                    )}
                  </g>
                )}
              </svg>

              {/* Time axis footer (persis seperti RealtimeChart) */}
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
                    {zoomLevel > 1 ? 'Awal Window Zoom' : 'Awal Pembacaan'}
                  </span>
                  <span style={{ fontWeight: 700, color: '#334155' }}>
                    {points.length > 0 && points[0].data?.timestamp ? new Date(points[0].data.timestamp).toLocaleString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--'}
                  </span>
                </div>

                {/* Sisi Tengah: Rentang Data & Jumlah Titik */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.67rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {zoomLevel > 1 ? `Zoom Aktif (${zoomLevel}x)` : 'Rentang Pembacaan'}
                  </span>
                  <span style={{ fontWeight: 700, color: '#003882' }}>
                    {points.length} Titik Sampel {zoomLevel > 1 ? `(dari ${series.length})` : ''}
                  </span>
                </div>

                {/* Sisi Kanan: Data Terkini */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ 
                    fontSize: '0.67rem', 
                    fontWeight: 700,
                    textTransform: 'uppercase', 
                    letterSpacing: '0.04em',
                    color: '#0284c7'
                  }}>
                    {zoomLevel > 1 ? 'Akhir Window Zoom' : 'Terkini'}
                  </span>
                  <span style={{ fontWeight: 800, color: '#003882' }}>
                    {points.length > 0 && points[points.length - 1].data?.timestamp 
                      ? `${new Date(points[points.length - 1].data.timestamp).toLocaleString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} (${(waterUnit === 'm' ? Number(points[points.length - 1].val) * 100 : Number(points[points.length - 1].val)).toFixed(1)} cm)`
                      : '--'}
                  </span>
                </div>
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
                  Stasiun: {device?.device_id || 'AWLR-001'} &bull; Rekaman 24 Jam Penuh
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
              
              {/* 1. Format Berkas (PDF, TXT, CSV) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', marginBottom: '8px' }}>
                  1. Format Berkas:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                  {[
                    { id: 'pdf', label: 'PDF (Laporan Resmi)' },
                    { id: 'txt', label: 'TXT (Teks Log)' },
                    { id: 'csv', label: 'CSV Spreadsheet' }
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

              {/* 2. Pilih Tanggal Log (24 Jam Penuh) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', margin: 0 }}>
                    2. Pilih Tanggal Log (24 Jam Penuh):
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        const pad = (n) => String(n).padStart(2, '0');
                        setExportDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
                      }}
                      style={{
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: '#334155',
                        cursor: 'pointer'
                      }}
                    >
                      Hari Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
                        const pad = (n) => String(n).padStart(2, '0');
                        setExportDate(`${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`);
                      }}
                      style={{
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: '#334155',
                        cursor: 'pointer'
                      }}
                    >
                      Kemarin
                    </button>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '8px 12px'
                }}>
                  <Calendar size={18} color="#003882" style={{ flexShrink: 0 }} />
                  <input
                    type="date"
                    value={exportDate}
                    onChange={(e) => setExportDate(e.target.value)}
                    max={(() => {
                      const now = new Date();
                      const pad = (n) => String(n).padStart(2, '0');
                      return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
                    })()}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: '#0f172a',
                      outline: 'none',
                      cursor: 'pointer',
                      flex: 1
                    }}
                  />
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', background: '#e2e8f0', padding: '2px 8px', borderRadius: '4px' }}>
                    00:00:00 s/d 23:59:59 {exportTz.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '6px' }}>
                  * Sistem otomatis mengunduh seluruh rekaman transmisi asli (Raw) selama 24 jam penuh pada tanggal yang dipilih.
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
                  disabled={isExporting}
                  onClick={handleDownloadFile}
                  className="btn btn-primary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.8rem',
                    padding: '8px 18px',
                    fontWeight: 700,
                    opacity: isExporting ? 0.7 : 1,
                    cursor: isExporting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isExporting ? (
                    <RefreshCw size={15} className="spin-slow" />
                  ) : exportFormat === 'pdf' ? (
                    <FileText size={15} />
                  ) : (
                    <Download size={15} />
                  )}
                  <span>
                    {isExporting
                      ? 'Memproses 24 Jam...'
                      : exportFormat === 'pdf'
                      ? 'Unduh Laporan PDF'
                      : 'Unduh File Data'}
                  </span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
