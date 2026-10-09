import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  PlusCircle, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ArrowLeft, 
  MapPin, 
  RefreshCw, 
  Search, 
  Sliders, 
  X, 
  Save, 
  Check, 
  Compass, 
  Activity,
  User
} from 'lucide-react';

export default function DeviceManagementView({ 
  authToken, 
  onBackToDashboard, 
  onActionToast 
}) {
  const [devices, setDevices] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null); // null = Add mode, object = Edit mode
  const [formData, setFormData] = useState({
    device_id: '',
    name: '',
    location: '',
    latitude: '',
    longitude: '',
    sensor_height_cm: 600.0,
    is_active: true,
    assigned_to: ''
  });
  const [modalError, setModalError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirmation Modal State
  const [deletingDevice, setDeletingDevice] = useState(null);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/devices', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const json = await res.json();
      if (json.success) {
        setDevices(json.data);
      }
    } catch (e) {
      console.error('Error fetching devices:', e);
      if (onActionToast) onActionToast(`Gagal mengambil daftar perangkat: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshClick = async () => {
    setIsSpinning(true);
    try {
      await fetchDevices();
    } finally {
      setTimeout(() => {
        setIsSpinning(false);
      }, 750);
    }
  };

  const fetchOperators = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const json = await res.json();
      if (json.success) {
        // Filter active operators
        const opList = (json.data || []).filter(u => u.role === 'operator' && u.is_active);
        setOperators(opList);
      }
    } catch (e) {
      console.error('Error fetching operators list:', e);
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchOperators();
  }, []);

  const openAddModal = () => {
    setEditingDevice(null);
    setFormData({
      device_id: '',
      name: '',
      location: '',
      latitude: '',
      longitude: '',
      sensor_height_cm: 600.0,
      is_active: true,
      assigned_to: ''
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (dev) => {
    setEditingDevice(dev);
    setFormData({
      device_id: dev.device_id,
      name: dev.name,
      location: dev.location || '',
      latitude: dev.latitude != null ? String(dev.latitude) : '',
      longitude: dev.longitude != null ? String(dev.longitude) : '',
      sensor_height_cm: dev.sensor_height_cm != null ? Number(dev.sensor_height_cm) : 600.0,
      is_active: Boolean(dev.is_active),
      assigned_to: dev.assigned_to != null ? String(dev.assigned_to) : ''
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);

    const isEdit = Boolean(editingDevice);
    const url = isEdit ? `/api/devices/${editingDevice.device_id}` : '/api/devices';
    const method = isEdit ? 'PATCH' : 'POST';

    const payload = {
      ...formData,
      assigned_to: formData.assigned_to ? Number(formData.assigned_to) : null
    };

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (json.success) {
        setIsModalOpen(false);
        fetchDevices();
        if (onActionToast) {
          onActionToast(isEdit 
            ? `Stasiun ${formData.device_id} berhasil diperbarui` 
            : `Stasiun ${formData.device_id} berhasil didaftarkan`);
        }
      } else {
        setModalError(json.error || 'Terjadi kesalahan saat menyimpan data');
      }
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (dev) => {
    try {
      const res = await fetch(`/api/devices/${dev.device_id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const json = await res.json();
      if (json.success) {
        fetchDevices();
        if (onActionToast) onActionToast(`${json.message}`);
      } else {
        if (onActionToast) onActionToast(`Gagal: ${json.error}`);
      }
    } catch (err) {
      if (onActionToast) onActionToast(`Error: ${err.message}`);
    }
  };

  const handleDeleteDevice = async () => {
    if (!deletingDevice) return;
    try {
      const res = await fetch(`/api/devices/${deletingDevice.device_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const json = await res.json();
      if (json.success) {
        setDeletingDevice(null);
        fetchDevices();
        if (onActionToast) onActionToast(`${json.message}`);
      } else {
        if (onActionToast) onActionToast(`Gagal: ${json.error}`);
      }
    } catch (err) {
      if (onActionToast) onActionToast(`Error: ${err.message}`);
    }
  };

  const filteredDevices = devices.filter(d => {
    const q = searchQuery.toLowerCase();
    return d.device_id.toLowerCase().includes(q) || 
           d.name.toLowerCase().includes(q) || 
           (d.location && d.location.toLowerCase().includes(q)) ||
           (d.assigned_operator_name && d.assigned_operator_name.toLowerCase().includes(q)) ||
           (d.assigned_operator_username && d.assigned_operator_username.toLowerCase().includes(q));
  });

  const totalCount = devices.length;
  const activeCount = devices.filter(d => d.is_active).length;
  const inactiveCount = totalCount - activeCount;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 1. Header Hero Card */}
      <div className="corporate-card" style={{ padding: '28px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <button
              onClick={onBackToDashboard}
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '18px', padding: '7px 14px', fontSize: '0.82rem' }}
            >
              <ArrowLeft size={15} />
              <span>Kembali ke Ringkasan Stasiun</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #edf2fc 0%, #e2ecfc 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#003882',
                boxShadow: '0 2px 6px rgba(0, 56, 130, 0.08)'
              }}>
                <Radio size={24} />
              </div>
              <div>
                <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                  Kelola Stasiun Perangkat AWLR
                </h1>
                <p style={{ fontSize: '0.86rem', color: '#64748b', marginTop: '4px', marginBottom: 0 }}>
                  Konfigurasi jaringan perangkat telemetri lapangan, kalibrasi ketinggian acuan sensor, dan parameter operasional.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={handleRefreshClick}
              disabled={loading || isSpinning}
              className="btn btn-secondary"
              title="Segarkan Data"
            >
              <RefreshCw size={15} className={loading || isSpinning ? 'spin' : ''} />
              <span>Segarkan</span>
            </button>

            <button
              onClick={openAddModal}
              className="btn btn-primary"
            >
              <PlusCircle size={16} />
              <span>Tambah Stasiun Baru</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '16px', 
          marginTop: '24px',
          paddingTop: '20px',
          borderTop: '1px solid #f1f5f9'
        }}>
          <div className="subtle-panel" style={{ padding: '14px 18px', borderLeft: '4px solid #003882' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              TOTAL STASIUN TERDAFTAR
            </span>
            <div className="mono-text" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
              {totalCount} <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Unit</span>
            </div>
          </div>

          <div className="subtle-panel" style={{ padding: '14px 18px', borderLeft: '4px solid #059669' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              STASIUN AKTIF
            </span>
            <div className="mono-text" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
              {activeCount} <span style={{ fontSize: '0.85rem', color: '#059669', fontWeight: 600 }}>Operasional</span>
            </div>
          </div>

          <div className="subtle-panel" style={{ padding: '14px 18px', borderLeft: '4px solid #cbd5e1' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              NONAKTIF / DITANGGUHKAN
            </span>
            <div className="mono-text" style={{ fontSize: '1.5rem', fontWeight: 800, color: inactiveCount > 0 ? '#dc2626' : '#64748b', marginTop: '4px' }}>
              {inactiveCount} <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Unit</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Devices Table Card */}
      <div className="corporate-card" style={{ padding: '28px 32px' }}>
        
        {/* Search & Counter Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Cari ID perangkat, nama, atau lokasi..."
              className="form-input"
              style={{ paddingLeft: '40px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b' }}>
            Menampilkan <span style={{ color: '#003882' }}>{filteredDevices.length}</span> dari {totalCount} stasiun pemantauan
          </div>
        </div>

        {/* Table */}
        <div className="table-responsive">
          <table className="corporate-table">
            <thead>
              <tr>
                <th>ID Perangkat</th>
                <th>Nama Stasiun</th>
                <th>Lokasi Geografis</th>
                <th>Operator Penanggung Jawab</th>
                <th>Tinggi Acuan Sensor</th>
                <th>Status Operasional</th>
                <th>Terakhir Aktif</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      <RefreshCw size={18} className="spin" color="#003882" />
                      <span>Memuat data stasiun AWLR...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '44px 20px', color: '#94a3b8' }}>
                    <div style={{ maxWidth: '360px', margin: '0 auto' }}>
                      <Radio size={36} color="#cbd5e1" style={{ marginBottom: '12px' }} />
                      <div style={{ fontWeight: 700, color: '#475569', fontSize: '0.95rem' }}>
                        {searchQuery ? 'Tidak ada stasiun yang cocok' : 'Belum ada stasiun terdaftar'}
                      </div>
                      <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                        {searchQuery ? 'Coba gunakan kata kunci pencarian yang berbeda.' : 'Klik tombol Tambah Stasiun Baru untuk mendaftarkan perangkat pertama.'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDevices.map((dev) => (
                  <tr key={dev.device_id}>
                    <td>
                      <span className="mono-text" style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        background: '#edf2fc',
                        color: '#003882',
                        borderRadius: '6px',
                        fontWeight: 800,
                        fontSize: '0.82rem',
                        letterSpacing: '0.02em'
                      }}>
                        {dev.device_id}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>
                        {dev.name}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontSize: '0.84rem' }}>
                        <MapPin size={13} color="#94a3b8" />
                        <span>{dev.location || 'Lokasi belum diatur'}</span>
                      </div>
                      {dev.latitude && dev.longitude && (
                        <div className="mono-text" style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px', marginLeft: '19px' }}>
                          {dev.latitude}, {dev.longitude}
                        </div>
                      )}
                    </td>
                    <td>
                      {dev.assigned_operator_name ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            background: '#edf2fc',
                            color: '#003882',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            flexShrink: 0
                          }}>
                            {(dev.assigned_operator_name[0] || 'O').toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.84rem', lineHeight: 1.2 }}>
                              {dev.assigned_operator_name}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              @{dev.assigned_operator_username}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          background: '#f1f5f9',
                          color: '#64748b',
                          fontSize: '0.74rem',
                          fontWeight: 600
                        }}>
                          Belum Ditugaskan
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="mono-text" style={{ fontWeight: 800, color: '#0f172a' }}>
                        {(Number(dev.sensor_height_cm || 600) / 100).toFixed(2)} m
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                        ({Number(dev.sensor_height_cm || 600).toFixed(0)} cm acuan)
                      </div>
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleActive(dev)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '5px 12px',
                          borderRadius: '20px',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          background: dev.is_active ? '#ecfdf5' : '#f8fafc',
                          color: dev.is_active ? '#059669' : '#94a3b8',
                          outline: `1px solid ${dev.is_active ? '#a7f3d0' : '#e2e8f0'}`,
                          transition: 'all 0.15s'
                        }}
                        title="Klik untuk mengubah status operasional stasiun"
                      >
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: dev.is_active ? '#10b981' : '#cbd5e1'
                        }} />
                        <span>{dev.is_active ? 'Aktif' : 'Nonaktif'}</span>
                      </button>
                    </td>
                    <td className="mono-text" style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {dev.last_seen 
                        ? new Date(dev.last_seen).toLocaleString('id-ID', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) 
                        : 'Belum pernah'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                          onClick={() => openEditModal(dev)}
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', borderRadius: '8px' }}
                          title="Edit Konfigurasi"
                        >
                          <Edit3 size={14} color="#003882" />
                        </button>

                        <button
                          onClick={() => setDeletingDevice(dev)}
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', borderRadius: '8px' }}
                          title="Hapus Stasiun"
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = '#fca5a5'}
                          onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                        >
                          <Trash2 size={14} color="#dc2626" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Modal Add / Edit Device (Redesigned with Top-Tier Aesthetics) */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className="modal-card">
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #edf2fc 0%, #e2ecfc 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#003882'
                }}>
                  <Radio size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                    {editingDevice ? 'Edit Konfigurasi Stasiun' : 'Daftarkan Stasiun Baru'}
                  </h2>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px', marginBottom: 0 }}>
                    {editingDevice ? 'Perbarui informasi dan tinggi acuan stasiun AWLR' : 'Tambahkan stasiun pemantauan baru ke jaringan'}
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setIsModalOpen(false)} 
                className="modal-close-btn"
                title="Tutup dialog"
              >
                <X size={16} />
              </button>
            </div>

            {/* Error Banner */}
            {modalError && (
              <div style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                fontSize: '0.84rem',
                fontWeight: 600,
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertTriangle size={16} />
                <span>{modalError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Field 1: Device ID */}
              <div className="form-group">
                <label className="form-label">
                  <span>ID PERANGKAT (KODE UNIK MQTT) *</span>
                  {editingDevice && <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>TIDAK DAPAT DIUBAH</span>}
                </label>
                <input
                  type="text"
                  className="form-input mono-text"
                  placeholder="Contoh: AWLR-002"
                  value={formData.device_id}
                  onChange={(e) => setFormData({ ...formData, device_id: e.target.value.toUpperCase() })}
                  disabled={Boolean(editingDevice)}
                  required
                />
                <span className="form-helper">
                  Digunakan sebagai pengenal topik MQTT (misal: <code>terraflow/{formData.device_id || 'ID'}/data</code>)
                </span>
              </div>

              {/* Field 2: Station Name */}
              <div className="form-group">
                <label className="form-label">
                  <span>NAMA STASIUN PEMANTAU *</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contoh: Stasiun Muara Pelabuhan"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
                <span className="form-helper">
                  Nama resmi stasiun yang ditampilkan pada seluruh dasbor pemantauan
                </span>
              </div>

              {/* Field 3: Location */}
              <div className="form-group">
                <label className="form-label">
                  <span>LOKASI / KETERANGAN WILAYAH</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contoh: Dermaga Barat, Teluk Balikpapan"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
                <span className="form-helper">
                  Penjelasan titik stasiun atau batas wilayah administrasi
                </span>
              </div>

              {/* Field 4 & 5: Coordinates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    <span>LATITUDE</span>
                  </label>
                  <input
                    type="number"
                    step="0.0000001"
                    className="form-input mono-text"
                    placeholder="-0.5892000"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    <span>LONGITUDE</span>
                  </label>
                  <input
                    type="number"
                    step="0.0000001"
                    className="form-input mono-text"
                    placeholder="117.2415000"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  />
                </div>
              </div>

              {/* Field 6: Sensor Height */}
              <div className="form-group">
                <label className="form-label">
                  <span>TINGGI PEMASANGAN SENSOR (CM) *</span>
                  <span style={{ color: '#003882', fontWeight: 800 }}>
                    {(Number(formData.sensor_height_cm || 0) / 100).toFixed(2)} Meter
                  </span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="50"
                  max="2000"
                  className="form-input mono-text"
                  value={formData.sensor_height_cm}
                  onChange={(e) => setFormData({ ...formData, sensor_height_cm: e.target.value })}
                  required
                />
                <span className="form-helper">
                  Jarak vertikal dari bibir sensor ke titik nol acuan elevasi hidrometri (50 - 2000 cm)
                </span>
              </div>

              {/* Field 7: Operator Assignment */}
              <div className="form-group">
                <label className="form-label">
                  <span>TUGASKAN KE OPERATOR</span>
                  <span style={{ color: '#003882', fontWeight: 700, fontSize: '0.74rem' }}>
                    PENUGASAN STASIUN
                  </span>
                </label>
                <select
                  className="form-input"
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  style={{ background: '#ffffff', cursor: 'pointer' }}
                >
                  <option value="">-- Belum Ditugaskan (Akses Bebas untuk Seluruh Administrator) --</option>
                  {operators.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.full_name} (@{op.username}) &bull; {op.email}
                    </option>
                  ))}
                </select>
                <span className="form-helper">
                  Tentukan operator lapangan yang berhak memantau dan mengoperasikan stasiun telemetri ini.
                </span>
              </div>

              {/* Field 8: Active Toggle Card */}
              <div 
                onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  background: formData.is_active ? '#f0fdf4' : '#f8fafc',
                  border: `1.5px solid ${formData.is_active ? '#86efac' : '#e2e8f0'}`,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  userSelect: 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: formData.is_active ? '#dcfce7' : '#f1f5f9',
                    color: formData.is_active ? '#16a34a' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}>
                    <Activity size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                      Status Stasiun Aktif
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                      {formData.is_active ? 'Stasiun beroperasi normal & mencatat telemetri' : 'Stasiun dinonaktifkan sementara'}
                    </div>
                  </div>
                </div>

                {/* Pill Switch */}
                <div style={{
                  width: '46px',
                  height: '26px',
                  borderRadius: '13px',
                  background: formData.is_active ? '#16a34a' : '#cbd5e1',
                  padding: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: formData.is_active ? 'flex-end' : 'flex-start',
                  transition: 'background-color 0.2s'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: '#ffffff',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }} />
                </div>
              </div>

              {/* Modal Actions */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-end', 
                gap: '12px', 
                marginTop: '16px', 
                paddingTop: '16px', 
                borderTop: '1px solid #f1f5f9' 
              }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  <Save size={16} />
                  <span>{submitting ? 'Menyimpan...' : (editingDevice ? 'Simpan Perubahan' : 'Daftarkan Stasiun')}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 4. Modal Konfirmasi Hapus (Redesigned) */}
      {deletingDevice && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setDeletingDevice(null); }}>
          <div className="modal-card" style={{ maxWidth: '440px', textAlign: 'center' }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: '#fef2f2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              border: '1px solid #fecaca'
            }}>
              <AlertTriangle size={26} />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
              Hapus Stasiun AWLR?
            </h3>

            <p style={{ fontSize: '0.86rem', color: '#64748b', lineHeight: 1.6, marginBottom: '24px' }}>
              Apakah Anda yakin ingin menghapus stasiun <strong>{deletingDevice.name} ({deletingDevice.device_id})</strong>? Seluruh rekaman telemetri dan log kalibrasi stasiun ini akan dihapus secara permanen dari basis data.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                onClick={() => setDeletingDevice(null)}
                className="btn btn-secondary"
              >
                Batal
              </button>

              <button
                onClick={handleDeleteDevice}
                className="btn btn-danger"
              >
                Ya, Hapus Stasiun
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
