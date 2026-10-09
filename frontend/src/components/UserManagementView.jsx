import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Shield, 
  UserCheck, 
  UserX, 
  Edit3, 
  Trash2, 
  Search, 
  RefreshCw, 
  Lock, 
  Mail, 
  User, 
  CheckCircle2, 
  AlertTriangle, 
  KeyRound,
  X,
  Clock,
  ArrowLeft
} from 'lucide-react';

export default function UserManagementView({ authToken, currentUser, onActionToast, onBackToDashboard }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    email: '',
    password: '',
    role: 'operator',
    is_active: true
  });
  const [editingUserId, setEditingUserId] = useState(null);
  const [editFormData, setEditFormData] = useState({
    full_name: '',
    email: '',
    role: 'operator',
    password: '',
    is_active: true
  });

  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch all users from backend API
  const fetchUsers = async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const res = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      } else {
        if (onActionToast) onActionToast(`Gagal: ${data.error}`);
      }
    } catch (err) {
      if (onActionToast) onActionToast(`Error koneksi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshClick = async () => {
    setIsSpinning(true);
    try {
      await fetchUsers();
    } finally {
      setTimeout(() => {
        setIsSpinning(false);
      }, 750);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [authToken]);

  // Handle Add User Form Submission
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (formData.password.length < 8) {
      setFormError('Kata sandi harus minimal 8 karakter');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        if (onActionToast) onActionToast(`Pengguna '${formData.username}' berhasil ditambahkan!`);
        setIsAddModalOpen(false);
        setFormData({
          username: '',
          full_name: '',
          email: '',
          password: '',
          role: 'operator',
          is_active: true
        });
        fetchUsers();
      } else {
        setFormError(data.error || 'Gagal menambahkan pengguna');
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (u) => {
    setEditingUserId(u.id);
    setEditFormData({
      full_name: u.full_name || '',
      email: u.email || '',
      role: u.role || 'operator',
      password: '',
      is_active: u.is_active
    });
    setFormError(null);
    setIsEditModalOpen(true);
  };

  // Handle Edit User Form Submission
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    const payload = {
      full_name: editFormData.full_name,
      email: editFormData.email,
      role: editFormData.role,
      is_active: editFormData.is_active
    };

    if (editFormData.password) {
      if (editFormData.password.length < 8) {
        setFormError('Kata sandi baru harus minimal 8 karakter');
        return;
      }
      payload.password = editFormData.password;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/users/${editingUserId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        if (onActionToast) onActionToast('Perubahan data pengguna berhasil disimpan!');
        setIsEditModalOpen(false);
        fetchUsers();
      } else {
        setFormError(data.error || 'Gagal memperbarui pengguna');
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Quick toggle active / inactive status
  const handleToggleActive = async (u) => {
    if (u.id === currentUser?.id) {
      if (onActionToast) onActionToast('Anda tidak dapat menonaktifkan akun sendiri');
      return;
    }
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: !u.is_active })
      });
      const data = await res.json();
      if (data.success) {
        if (onActionToast) onActionToast(`Status ${u.username} diubah menjadi ${!u.is_active ? 'Aktif' : 'Nonaktif'}`);
        fetchUsers();
      } else {
        if (onActionToast) onActionToast(`Gagal: ${data.error}`);
      }
    } catch (err) {
      if (onActionToast) onActionToast(`Error: ${err.message}`);
    }
  };

  // Handle Delete User
  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    if (deleteConfirmUser.id === currentUser?.id) {
      if (onActionToast) onActionToast('Anda tidak dapat menghapus akun sendiri');
      setDeleteConfirmUser(null);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/users/${deleteConfirmUser.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (data.success) {
        if (onActionToast) onActionToast(`Pengguna '${deleteConfirmUser.username}' berhasil dihapus`);
        setDeleteConfirmUser(null);
        fetchUsers();
      } else {
        if (onActionToast) onActionToast(`Gagal: ${data.error}`);
      }
    } catch (err) {
      if (onActionToast) onActionToast(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch = 
      (u.username && u.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.full_name && u.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Calculate Metrics
  const totalUsers = users.length;
  const adminCount = users.filter(u => u.role === 'admin').length;
  const operatorCount = users.filter(u => u.role === 'operator').length;
  const activeCount = users.filter(u => u.is_active).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* 1. Top Header Card */}
      <div className="corporate-card" style={{ padding: '28px' }}>
        {onBackToDashboard && (
          <button
            onClick={onBackToDashboard}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '14px', padding: '6px 12px' }}
          >
            <ArrowLeft size={15} />
            <span>Kembali ke Dashboard</span>
          </button>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: '#edf2fc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#003882'
              }}>
                <Users size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
                  Web Admin &bull; Manajemen Pengguna
                </h2>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
                  Kontrol otorisasi personel, Role-Based Access Control (RBAC), serta proteksi kredensial berstandar industri.
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button 
              onClick={handleRefreshClick} 
              disabled={loading || isSpinning}
              title="Segarkan data pengguna"
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={15} className={loading || isSpinning ? 'spin' : ''} />
              <span>Segarkan</span>
            </button>

            <button 
              onClick={() => { setFormError(null); setIsAddModalOpen(true); }}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <UserPlus size={17} />
              <span>Tambah Pengguna</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Statistical Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px' }}>
        <div className="corporate-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>TOTAL PENGGUNA</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#edf2fc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#003882' }}>
              <Users size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', marginTop: '10px' }}>
            {totalUsers}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
            Terdaftar dalam database sistem
          </div>
        </div>

        <div className="corporate-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>ADMINISTRATOR</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#003882' }}>
              <ShieldCheck size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#003882', marginTop: '10px' }}>
            {adminCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#003882', fontWeight: 600, marginTop: '2px' }}>
            Hak akses penuh konfigurasi &amp; audit
          </div>
        </div>

        <div className="corporate-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>OPERATOR LAPANGAN</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
              <UserCheck size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#059669', marginTop: '10px' }}>
            {operatorCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
            Petugas pemantauan hidrologi
          </div>
        </div>

        <div className="corporate-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>STATUS AKTIF</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#16a34a', marginTop: '10px' }}>
            {activeCount} <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>/ {totalUsers}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600, marginTop: '2px' }}>
            Memiliki izin masuk aktif
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="corporate-card" style={{ padding: '16px 20px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 280px' }}>
          <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text"
            placeholder="Cari nama lengkap, username, atau email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="corporate-input"
            style={{ paddingLeft: '40px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '0.76rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Filter Role:</label>
          <select 
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="corporate-input"
            style={{ width: 'auto', minWidth: '160px', padding: '9px 14px' }}
          >
            <option value="all">Semua Role</option>
            <option value="admin">Administrator</option>
            <option value="operator">Operator Lapangan</option>
          </select>
        </div>
      </div>

      {/* 4. Users Table */}
      <div className="table-responsive">
        <table className="corporate-table">
          <thead>
            <tr>
              <th>PENGGUNA</th>
              <th>EMAIL</th>
              <th>HAK AKSES (ROLE)</th>
              <th>STATUS KREDENSIAL</th>
              <th>STATUS</th>
              <th>LOGIN TERAKHIR</th>
              <th style={{ textAlign: 'right' }}>AKSI</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8' }}>
                  {loading ? 'Memuat data pengguna...' : 'Tidak ada pengguna yang cocok dengan kriteria pencarian.'}
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => {
                const isCurrent = u.id === currentUser?.id;
                return (
                  <tr key={u.id}>
                    {/* Name & Username */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          background: u.role === 'admin' ? 'linear-gradient(135deg, #003882 0%, #002860 100%)' : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.88rem',
                          fontWeight: 800,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                        }}>
                          {(u.full_name || u.username || 'U')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{u.full_name}</span>
                            {isCurrent && (
                              <span style={{
                                background: '#e0f2fe',
                                color: '#0369a1',
                                fontSize: '0.62rem',
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                letterSpacing: '0.04em'
                              }}>
                                ANDA
                              </span>
                            )}
                          </div>
                          <div className="mono-text" style={{ fontSize: '0.74rem', color: '#64748b' }}>
                            @{u.username}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td style={{ color: '#334155' }}>
                      {u.email}
                    </td>

                    {/* Role Badge */}
                    <td>
                      {u.role === 'admin' ? (
                        <span className="badge badge-navy">
                          <ShieldCheck size={13} />
                          ADMINISTRATOR
                        </span>
                      ) : (
                        <span className="badge badge-emerald">
                          <UserCheck size={13} />
                          OPERATOR
                        </span>
                      )}
                    </td>

                    {/* Password Security Badge */}
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        color: '#0284c7',
                        background: '#f0f9ff',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        border: '1px solid #bae6fd'
                      }}>
                        <Lock size={12} />
                        Terenkripsi BCrypt
                      </span>
                    </td>

                    {/* Status Toggle */}
                    <td>
                      <button
                        onClick={() => handleToggleActive(u)}
                        disabled={isCurrent}
                        title={isCurrent ? 'Tidak dapat menonaktifkan akun sendiri' : 'Klik untuk mengubah status'}
                        style={{
                          background: u.is_active ? '#f0fdf4' : '#fef2f2',
                          border: `1px solid ${u.is_active ? '#bbf7d0' : '#fecaca'}`,
                          cursor: isCurrent ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          color: u.is_active ? '#16a34a' : '#dc2626',
                          fontWeight: 700,
                          fontSize: '0.74rem'
                        }}
                      >
                        <span style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          background: u.is_active ? '#16a34a' : '#dc2626'
                        }} />
                        {u.is_active ? 'Aktif' : 'Nonaktif'}
                      </button>
                    </td>

                    {/* Last Login */}
                    <td style={{ color: '#64748b', fontSize: '0.78rem' }}>
                      {u.last_login ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Clock size={13} color="#94a3b8" />
                          <span className="mono-text">{new Date(u.last_login).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Belum pernah</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          onClick={() => openEditModal(u)}
                          title="Edit data pengguna"
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', borderRadius: '8px' }}
                        >
                          <Edit3 size={14} />
                        </button>

                        <button
                          onClick={() => setDeleteConfirmUser(u)}
                          disabled={isCurrent}
                          title={isCurrent ? 'Tidak dapat menghapus akun sendiri' : 'Hapus pengguna'}
                          className="btn btn-secondary"
                          style={{
                            padding: '6px 10px',
                            borderRadius: '8px',
                            borderColor: isCurrent ? '#e2e8f0' : '#fecaca',
                            color: isCurrent ? '#cbd5e1' : '#dc2626',
                            background: isCurrent ? '#f8fafc' : '#fff1f2'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 5. Modal: Tambah Pengguna Baru */}
      {isAddModalOpen && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setIsAddModalOpen(false); }}>
          <div className="modal-card">
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
                  <UserPlus size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                    Tambah Pengguna Baru
                  </h2>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px', marginBottom: 0 }}>
                    Kredensial akun dienkripsi secara aman sesuai standar industri
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setIsAddModalOpen(false)} 
                className="modal-close-btn"
                title="Tutup dialog"
              >
                <X size={16} />
              </button>
            </div>

            {formError && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                padding: '12px 16px',
                borderRadius: '10px',
                fontSize: '0.84rem',
                fontWeight: 600,
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertTriangle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">
                  <span>NAMA PENGGUNA (USERNAME) *</span>
                </label>
                <input 
                  type="text"
                  required
                  placeholder="contoh: joko_operator"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="form-input mono-text"
                />
                <span className="form-helper">Digunakan sebagai identitas masuk sistem (huruf kecil dan tanpa spasi)</span>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>NAMA LENGKAP *</span>
                </label>
                <input 
                  type="text"
                  required
                  placeholder="contoh: Joko Prasetyo, S.T."
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>ALAMAT EMAIL *</span>
                </label>
                <input 
                  type="email"
                  required
                  placeholder="contoh: joko@tanahairku.co.id"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>KATA SANDI (MINIMAL 8 KARAKTER) *</span>
                </label>
                <input 
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>HAK AKSES (ROLE) *</span>
                </label>
                <select 
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="form-input"
                >
                  <option value="operator">Operator Lapangan (Pemantauan &amp; Ekspor Data)</option>
                  <option value="admin">Administrator (Akses Penuh Konfigurasi &amp; Pengguna)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Pengguna'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal: Edit Pengguna */}
      {isEditModalOpen && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setIsEditModalOpen(false); }}>
          <div className="modal-card">
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
                  <Edit3 size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                    Edit Data Pengguna
                  </h2>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px', marginBottom: 0 }}>
                    Perbarui rincian identitas personel, peran otorisasi, atau atur ulang kata sandi
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setIsEditModalOpen(false)} 
                className="modal-close-btn"
                title="Tutup dialog"
              >
                <X size={16} />
              </button>
            </div>

            {formError && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                padding: '12px 16px',
                borderRadius: '10px',
                fontSize: '0.84rem',
                fontWeight: 600,
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertTriangle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">
                  <span>NAMA LENGKAP *</span>
                </label>
                <input 
                  type="text"
                  required
                  value={editFormData.full_name}
                  onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>ALAMAT EMAIL *</span>
                </label>
                <input 
                  type="email"
                  required
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>HAK AKSES (ROLE) *</span>
                </label>
                <select 
                  value={editFormData.role}
                  onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                  className="form-input"
                >
                  <option value="operator">Operator Lapangan (Pemantauan &amp; Ekspor Data)</option>
                  <option value="admin">Administrator (Akses Penuh Konfigurasi &amp; Pengguna)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>GANTI KATA SANDI (KOSONGKAN JIKA TIDAK DIUBAH)</span>
                </label>
                <input 
                  type="password"
                  placeholder="Minimal 8 karakter baru..."
                  value={editFormData.password}
                  onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                  className="form-input"
                />
              </div>

              {/* Active Toggle Card */}
              <div 
                onClick={() => {
                  if (editingUserId !== currentUser?.id) {
                    setEditFormData({ ...editFormData, is_active: !editFormData.is_active });
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  background: editFormData.is_active ? '#f0fdf4' : '#f8fafc',
                  border: `1.5px solid ${editFormData.is_active ? '#86efac' : '#e2e8f0'}`,
                  borderRadius: '12px',
                  cursor: editingUserId === currentUser?.id ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  userSelect: 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: editFormData.is_active ? '#dcfce7' : '#f1f5f9',
                    color: editFormData.is_active ? '#16a34a' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 800, color: editFormData.is_active ? '#166534' : '#475569' }}>
                      {editFormData.is_active ? 'Akun Berstatus Aktif' : 'Akun Dinonaktifkan'}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                      {editFormData.is_active ? 'Pengguna dapat masuk ke dalam dashboard' : 'Akses masuk dashboard ditangguhkan'}
                    </div>
                  </div>
                </div>

                {/* Pill Switch */}
                <div style={{
                  width: '44px',
                  height: '24px',
                  borderRadius: '12px',
                  background: editFormData.is_active ? '#16a34a' : '#cbd5e1',
                  position: 'relative',
                  transition: 'background 0.2s'
                }}>
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: '#ffffff',
                    position: 'absolute',
                    top: '3px',
                    left: editFormData.is_active ? '23px' : '3px',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Modal: Konfirmasi Hapus */}
      {deleteConfirmUser && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirmUser(null); }}>
          <div className="modal-card" style={{ maxWidth: '440px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <Trash2 size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
              Hapus Pengguna?
            </h3>
            <p style={{ fontSize: '0.86rem', color: '#64748b', lineHeight: 1.5, marginBottom: '22px' }}>
              Apakah Anda yakin ingin menghapus akun <strong>{deleteConfirmUser.full_name}</strong> (@{deleteConfirmUser.username})? Tindakan ini permanen dan tidak dapat dibatalkan.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                className="btn btn-secondary"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={submitting}
                className="btn btn-danger"
              >
                {submitting ? 'Menghapus...' : 'Ya, Hapus Akun'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
