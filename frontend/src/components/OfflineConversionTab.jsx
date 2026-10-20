import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Upload, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  Database, 
  Sliders
} from 'lucide-react';

export default function OfflineConversionTab({ device, authToken, onRefresh }) {
  // Parameter kalibrasi resmi dari konfigurasi Admin stasiun
  const sensorHeightCm = Number(device?.sensor_height_cm) || 600.0;
  const calibOffset = Number(device?.offset_cm) || 0.0;
  const calibSlope = Number(device?.slope) || 1.0;

  // File parsing & data states
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [parsedRows, setParsedRows] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState(null);

  // Status sinkronisasi ke database
  const [isSubmittingToDb, setIsSubmittingToDb] = useState(false);
  const [dbSyncSuccess, setDbSyncSuccess] = useState(false);

  // Unit toggle untuk pratinjau: 'm' | 'cm'
  const [previewUnit, setPreviewUnit] = useState('m');

  // Paginasi tabel pratinjau
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const fileInputRef = useRef(null);
  const dragCounterRef = useRef(0);
  const [isDragOver, setIsDragOver] = useState(false);

  // Mencegah browser membuka file di tab baru jika user melepas drop di luar kotak
  useEffect(() => {
    const preventDefault = (e) => e.preventDefault();
    window.addEventListener('dragover', preventDefault);
    window.addEventListener('drop', preventDefault);
    return () => {
      window.removeEventListener('dragover', preventDefault);
      window.removeEventListener('drop', preventDefault);
    };
  }, []);

  // Helper konversi format tanggal ISO / waktu lokal
  const extractDateParts = (timestampMsOrEpoch) => {
    let dateObj;
    if (typeof timestampMsOrEpoch === 'number') {
      dateObj = timestampMsOrEpoch < 1e11 ? new Date(timestampMsOrEpoch * 1000) : new Date(timestampMsOrEpoch);
    } else {
      dateObj = new Date(timestampMsOrEpoch);
    }

    if (isNaN(dateObj.getTime())) {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      return {
        dateStr: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
        hour: now.getHours(),
        minute: now.getMinutes(),
        second: now.getSeconds(),
        timeStr: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
      };
    }

    const pad = (n) => String(n).padStart(2, '0');
    return {
      dateStr: `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`,
      hour: dateObj.getHours(),
      minute: dateObj.getMinutes(),
      second: dateObj.getSeconds(),
      timeStr: `${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(dateObj.getSeconds())}`
    };
  };

  // Parser CSV / Log SD Card otomatis
  const processLogText = (text, name, size) => {
    try {
      setIsParsing(true);
      setParseError(null);
      setDbSyncSuccess(false);

      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) {
        throw new Error('Berkas log SD Card kosong atau tidak memiliki baris data telemetri.');
      }

      // Deteksi separator (koma atau titik koma)
      const headerLine = lines[0];
      const sep = headerLine.includes(';') ? ';' : ',';
      const headers = headerLine.split(sep).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

      // Pemetaan indeks kolom standar
      const idxDate = headers.findIndex(h => h === 'date' || h === 'tanggal');
      const idxTime = headers.findIndex(h => h === 'time' || h === 'jam' || h === 'waktu');
      const idxMinute = headers.findIndex(h => h === 'minute' || h === 'menit');
      const idxTs = headers.findIndex(h => h === 'timestamp' || h === 'ts' || h === 'epoch');
      const idxRaw = headers.findIndex(h => h.includes('raw') || h.includes('jarak') || h.includes('dist'));
      const idxFilt = headers.findIndex(h => h.includes('filter'));
      const idxWl = headers.findIndex(h => h.includes('water_level') || h.includes('tma') || h.includes('level'));

      const rows = [];
      const nowEpoch = Math.floor(Date.now() / 1000);

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(sep).map(p => p.trim().replace(/['"]/g, ''));
        if (parts.length < 2) continue;

        let dateStr = '';
        let hour = 0;
        let minute = 0;
        let second = 0;
        let timeStr = '';

        if (idxDate >= 0 && parts[idxDate]) {
          dateStr = parts[idxDate];
          if (idxTime >= 0 && parts[idxTime]) {
            const timeParts = parts[idxTime].split(':');
            hour = parseInt(timeParts[0], 10) || 0;
            minute = parseInt(timeParts[1], 10) || 0;
            second = parseInt(timeParts[2], 10) || 0;
            timeStr = parts[idxTime];
          } else if (idxMinute >= 0 && parts[idxMinute]) {
            minute = parseInt(parts[idxMinute], 10) || 0;
            const pad = (n) => String(n).padStart(2, '0');
            timeStr = `${pad(hour)}:${pad(minute)}:00`;
          }
        } else if (idxTs >= 0 && parts[idxTs]) {
          const tsVal = Number(parts[idxTs]);
          const ext = extractDateParts(tsVal);
          dateStr = ext.dateStr;
          hour = ext.hour;
          minute = ext.minute;
          second = ext.second;
          timeStr = ext.timeStr;
        } else {
          // Fallback sequential 1-minute steps
          const stepTs = nowEpoch - (lines.length - i) * 60;
          const ext = extractDateParts(stepTs);
          dateStr = ext.dateStr;
          hour = ext.hour;
          minute = ext.minute;
          second = ext.second;
          timeStr = ext.timeStr;
        }

        const rawDist = idxRaw >= 0 ? parseFloat(parts[idxRaw]) || 0 : 0;
        const filtDist = idxFilt >= 0 ? parseFloat(parts[idxFilt]) || rawDist : rawDist;
        const effectiveDist = (filtDist > 0) ? filtDist : rawDist;

        // Hitung otomatis menggunakan parameter resmi sensor Admin:
        // TMA = sensor_height - (distance * slope + offset)
        let waterLevelCm = 0;
        if (idxWl >= 0 && parts[idxWl] !== '' && !isNaN(parseFloat(parts[idxWl]))) {
          waterLevelCm = parseFloat(parts[idxWl]);
        } else {
          waterLevelCm = sensorHeightCm - (effectiveDist * calibSlope + calibOffset);
        }

        const pad = (n) => String(n).padStart(2, '0');
        const formattedFullTime = `${dateStr} ${timeStr || `${pad(hour)}:${pad(minute)}:${pad(second)}`}`;

        rows.push({
          id: i,
          date: dateStr,
          hour,
          minute,
          second,
          timeFull: formattedFullTime,
          rawDistanceCm: Math.round(rawDist * 10) / 10,
          waterLevelCm: Math.round(waterLevelCm * 10) / 10,
          waterLevelM: Number((waterLevelCm / 100).toFixed(3))
        });
      }

      if (rows.length === 0) {
        throw new Error('Tidak ditemukan baris data yang valid pada berkas ini.');
      }

      setFileName(name || 'data_sdcard.csv');
      setFileSize(size || 0);
      setParsedRows(rows);
      setPage(1);
    } catch (err) {
      setParseError(err.message || 'Gagal memproses berkas log SD Card');
      setParsedRows([]);
    } finally {
      setIsParsing(false);
    }
  };

  // Helper proses berkas
  const processFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        processLogText(text, file.name, file.size);
      }
    };
    reader.readAsText(file);
  };

  // Handler Upload Berkas via Input
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  // Handler Drag and Drop
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragOver(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  // Handler Reset Berkas
  const handleResetFile = () => {
    setFileName('');
    setFileSize(0);
    setParsedRows([]);
    setParseError(null);
    setDbSyncSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Unduh Berkas TXT Standar Hidrometri (2 kolom: YYYY-MM-DD HH:mm:ss   <water_level>)
  const handleDownloadTxt = () => {
    if (parsedRows.length === 0) return;
    const lines = [];
    parsedRows.forEach(r => {
      const val = previewUnit === 'cm' ? r.waterLevelCm.toFixed(1) : r.waterLevelM.toFixed(3);
      lines.push(`${r.timeFull}   ${val}`);
    });

    const blob = new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `konversi_${device?.device_id || 'AWLR'}_${fileName.replace(/\.[^/.]+$/, '')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Unduh Berkas CSV Standar Spreadsheet
  const handleDownloadCsv = () => {
    if (parsedRows.length === 0) return;
    const headers = ['Waktu (WIB)', 'TMA (m)', 'TMA (cm)'];
    const csvLines = [headers.join(',')];

    parsedRows.forEach(r => {
      csvLines.push([
        `"${r.timeFull}"`,
        r.waterLevelM.toFixed(3),
        r.waterLevelCm.toFixed(1)
      ].join(','));
    });

    const blob = new Blob([csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `konversi_${device?.device_id || 'AWLR'}_${fileName.replace(/\.[^/.]+$/, '')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Simpan Sekaligus ke Database Stasiun
  const handleSaveToDatabase = async () => {
    if (parsedRows.length === 0 || isSubmittingToDb) return;
    setIsSubmittingToDb(true);
    try {
      const devId = device?.device_id || 'AWLR-001';
      const records = parsedRows.map(r => ({
        date: r.date,
        hour: r.hour,
        minute: r.minute,
        second: r.second || 0,
        raw_distance_cm: r.rawDistanceCm,
        water_level_cm: r.waterLevelCm
      }));

      const res = await fetch('/api/readings/offline-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          device_id: devId,
          records,
          recalculate: false
        })
      });

      const json = await res.json();
      if (json.success) {
        setDbSyncSuccess(true);
        if (onRefresh) onRefresh();
      } else {
        alert(json.error || 'Gagal menyimpan data ke database server');
      }
    } catch (err) {
      alert('Terjadi kesalahan saat menyimpan data: ' + err.message);
    } finally {
      setIsSubmittingToDb(false);
    }
  };

  // Ringkasan Statistik
  const stats = useMemo(() => {
    if (parsedRows.length === 0) return { minWl: 0, maxWl: 0, startTime: '--', endTime: '--' };
    const levels = parsedRows.map(r => r.waterLevelCm);
    return {
      minWl: Math.min(...levels),
      maxWl: Math.max(...levels),
      startTime: parsedRows[0].timeFull,
      endTime: parsedRows[parsedRows.length - 1].timeFull
    };
  }, [parsedRows]);

  const totalPages = Math.ceil(parsedRows.length / pageSize) || 1;
  const paginatedRows = parsedRows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>

      {/* ========================================================= */}
      {/* 1. INFORMASI STASIUN & PARAMETER SENSOR OTOMATIS */}
      {/* ========================================================= */}
      <div className="corporate-card" style={{ padding: '22px 26px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Konversi Data SD Card (Mode Offline)
              </h2>
              <span className="badge badge-navy" style={{ fontSize: '0.72rem' }}>
                {device?.device_id || 'AWLR'}
              </span>
            </div>
            <p style={{ fontSize: '0.84rem', color: '#64748b', marginTop: '4px', marginBottom: 0 }}>
              Digunakan saat perangkat tidak memperoleh jaringan. Berkas log dari MicroSD Card dikonversi otomatis sesuai konfigurasi sensor stasiun.
            </p>
          </div>

          {/* Badge Parameter Sensor Admin */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#003882',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sliders size={18} />
            </div>
            <div>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>
                Parameter Acuan Sensor
              </span>
              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                Tinggi Acuan: <span style={{ color: '#003882' }}>{sensorHeightCm.toFixed(1)} cm</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. AREA UNGGAH BERKAS SD CARD */}
      {/* ========================================================= */}
      <div className="corporate-card" style={{ padding: '28px' }}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".csv,.txt,.dat"
          style={{ display: 'none' }}
        />

        {parsedRows.length === 0 ? (
          <div
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${isDragOver ? '#0284c7' : '#93c5fd'}`,
              borderRadius: '14px',
              background: isDragOver ? '#f0f9ff' : '#f8fafc',
              padding: '46px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              transform: isDragOver ? 'scale(1.01)' : 'scale(1)',
              boxShadow: isDragOver ? '0 10px 25px -5px rgba(2, 132, 199, 0.2)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (!isDragOver) e.currentTarget.style.background = '#f0f9ff';
            }}
            onMouseLeave={(e) => {
              if (!isDragOver) e.currentTarget.style.background = '#f8fafc';
            }}
          >
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: isDragOver ? '#0284c7' : '#edf2fc',
              color: isDragOver ? '#ffffff' : '#003882',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              transform: isDragOver ? 'scale(1.15) translateY(-2px)' : 'scale(1)',
              pointerEvents: 'none'
            }}>
              <Upload size={28} />
            </div>

            <div style={{ pointerEvents: 'none' }}>
              <h3 style={{ fontSize: '1.08rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
                {isDragOver ? 'Lepaskan Berkas Log SD Card di Sini' : 'Klik atau Seret Berkas Log SD Card ke Sini'}
              </h3>
              <p style={{ fontSize: '0.82rem', color: isDragOver ? '#0284c7' : '#64748b', fontWeight: isDragOver ? 700 : 400, margin: 0 }}>
                {isDragOver ? 'Berkas akan langsung dibaca dan dikonversi otomatis' : 'Mendukung berkas rekaman harian dari MicroSD (*.csv, *.txt, *.dat)'}
              </p>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: '8px', padding: '8px 20px', fontSize: '0.82rem', pointerEvents: 'none' }}
            >
              Pilih Berkas dari Kartu SD
            </button>

            {isParsing && (
              <span style={{ fontSize: '0.8rem', color: '#003882', fontWeight: 700 }}>
                Memproses dan mengonversi data...
              </span>
            )}
          </div>
        ) : (
          <div>
            {/* Kartu Ringkasan Berkas yang Terunggah */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '18px 22px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: '#ecfdf5',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h4 style={{ fontSize: '1.02rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      {fileName}
                    </h4>
                    <span className="badge badge-emerald" style={{ fontSize: '0.7rem' }}>
                      {parsedRows.length} Baris Terkonversi
                    </span>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Ukuran: {(fileSize / 1024).toFixed(1)} KB &bull; Parameter: {sensorHeightCm} cm
                  </span>
                </div>
              </div>

              {/* Tombol Ganti Berkas */}
              <button
                onClick={handleResetFile}
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '6px 14px' }}
              >
                Ganti Berkas
              </button>
            </div>

            {/* Panel Ringkasan Rentang & TMA */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '22px' }}>
              <div className="subtle-panel" style={{ borderLeft: '4px solid #003882' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>WAKTU AWAL LOG</span>
                <div className="mono-text" style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                  {stats.startTime}
                </div>
              </div>

              <div className="subtle-panel" style={{ borderLeft: '4px solid #0284c7' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>WAKTU AKHIR LOG</span>
                <div className="mono-text" style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                  {stats.endTime}
                </div>
              </div>

              <div className="subtle-panel" style={{ borderLeft: '4px solid #059669' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>RENTANG MUKA AIR</span>
                <div className="mono-text" style={{ fontSize: '0.88rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                  {(stats.minWl / 100).toFixed(3)} m s/d {(stats.maxWl / 100).toFixed(3)} m
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  {stats.minWl.toFixed(1)} cm - {stats.maxWl.toFixed(1)} cm
                </div>
              </div>
            </div>

            {/* ========================================================= */}
            {/* 3. TOMBOL UNDUH HASIL KONVERSI */}
            {/* ========================================================= */}
            <div style={{
              background: '#ffffff',
              border: '1.5px solid #003882',
              borderRadius: '12px',
              padding: '18px 22px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px',
              marginBottom: '24px'
            }}>
              <div>
                <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#003882', margin: 0 }}>
                  Unduh Berkas Hasil Konversi
                </h4>
                <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  Data siap diunduh dalam format standar hidrologi internasional
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {/* Unduh TXT Standar */}
                <button
                  onClick={handleDownloadTxt}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px', fontWeight: 700 }}
                  title="Unduh format TXT 2-kolom (Waktu   Muka Air)"
                >
                  <FileText size={16} />
                  <span>Unduh TXT (Format Standar)</span>
                </button>

                {/* Unduh CSV Spreadsheet */}
                <button
                  onClick={handleDownloadCsv}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 16px', fontWeight: 700 }}
                  title="Unduh format CSV Spreadsheet"
                >
                  <FileSpreadsheet size={16} />
                  <span>Unduh CSV Spreadsheet</span>
                </button>

                {/* Simpan ke Database Server */}
                <button
                  onClick={handleSaveToDatabase}
                  disabled={isSubmittingToDb || dbSyncSuccess}
                  className="btn btn-secondary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 16px',
                    fontWeight: 700,
                    background: dbSyncSuccess ? '#ecfdf5' : '#ffffff',
                    color: dbSyncSuccess ? '#059669' : '#0f172a',
                    border: `1px solid ${dbSyncSuccess ? '#a7f3d0' : '#cbd5e1'}`
                  }}
                  title="Simpan data ke server agar langsung tampil di grafik stasiun"
                >
                  <Database size={16} />
                  <span>{isSubmittingToDb ? 'Menyimpan...' : dbSyncSuccess ? 'Tersimpan di Database' : 'Simpan ke Server'}</span>
                </button>
              </div>
            </div>

            {/* ========================================================= */}
            {/* 4. TABEL PRATINJAU RINGKAS */}
            {/* ========================================================= */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
              <h4 style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Pratinjau Data Terkonversi
              </h4>

              {/* Satuan Pratinjau Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: '6px', padding: '2px' }}>
                <button
                  onClick={() => setPreviewUnit('m')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    background: previewUnit === 'm' ? '#003882' : 'transparent',
                    color: previewUnit === 'm' ? '#ffffff' : '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  Meter (m)
                </button>
                <button
                  onClick={() => setPreviewUnit('cm')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    background: previewUnit === 'cm' ? '#003882' : 'transparent',
                    color: previewUnit === 'cm' ? '#ffffff' : '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  Centimeter (cm)
                </button>
              </div>
            </div>

            <div className="table-responsive">
              <table className="corporate-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Waktu (WIB)</th>
                    <th>Tinggi Muka Air (m)</th>
                    <th>Tinggi Muka Air (cm)</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row) => (
                    <tr key={row.id}>
                      <td className="mono-text" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                        {row.timeFull}
                      </td>
                      <td className="mono-text" style={{ fontWeight: 800, color: '#003882', fontSize: '0.86rem' }}>
                        {row.waterLevelM.toFixed(3)} m
                      </td>
                      <td className="mono-text" style={{ fontWeight: 700, color: '#0369a1', fontSize: '0.86rem' }}>
                        {row.waterLevelCm.toFixed(1)} cm
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginasi Pratinjau */}
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
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>
                  Halaman {page} dari {totalPages} ({parsedRows.length} baris)
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
        )}

        {/* Notifikasi Error jika parsing gagal */}
        {parseError && (
          <div style={{
            marginTop: '16px',
            padding: '12px 16px',
            borderRadius: '8px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.82rem',
            fontWeight: 700
          }}>
            <AlertCircle size={18} />
            <span>{parseError}</span>
          </div>
        )}
      </div>

    </div>
  );
}
