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
  Clock
} from 'lucide-react';

export default function UserManagementView({ authToken, currentUser, onActionToast }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
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
        if (onActionToast) onActionToast(`❌ Gagal: ${data.error}`);
      }
    } catch (err) {
      if (onActionToast) onActionToast(`❌ Error koneksi: ${err.message}`);
    } finally {
      setLoading(false);
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
        if (onActionToast) onActionToast(`✅ Pengguna '${formData.username}' berhasil ditambahkan!`);
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
        if (onActionToast) onActionToast('✅ Perubahan data pengguna berhasil disimpan!');
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
      if (onActionToast) onActionToast('⚠️ Anda tidak dapat menonaktifkan akun sendiri');
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
        if (onActionToast) onActionToast(`✅ Status ${u.username} diubah menjadi ${!u.is_active ? 'Aktif' : 'Nonaktif'}`);
        fetchUsers();
      } else {
        if (onActionToast) onActionToast(`❌ Gagal: ${data.error}`);
      }
    } catch (err) {
      if (onActionToast) onActionToast(`❌ Error: ${err.message}`);
    }
  };

  // Handle Delete User
  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    if (deleteConfirmUser.id === currentUser?.id) {
      if (onActionToast) onActionToast('⚠️ Anda tidak dapat menghapus akun sendiri');
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
        if (onActionToast) onActionToast(`✅ Pengguna '${deleteConfirmUser.username}' berhasil dihapus`);
        setDeleteConfirmUser(null);
        fetchUsers();
      } else {
        if (onActionToast) onActionToast(`❌ Gagal: ${data.error}`);
      }
    } catch (err) {
      if (onActionToast) onActionToast(`❌ Error: ${err.message}`);
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
              onClick={fetchUsers} 
              disabled={loading}
              title="Segarkan data pengguna"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 14px',
                borderRadius: '8px',
                background: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            <button 
              onClick={() => { setFormError(null); setIsAddModalOpen(true); }}
              className="btn-corporate-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                fontSize: '0.88rem'
              }}
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
          <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text"
            placeholder="Cari nama, username, atau email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 38px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.88rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Filter Role:</label>
          <select 
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#1e293b',
              outline: 'none'
            }}
          >
            <option value="all">Semua Role</option>
            <option value="admin">Administrator</option>
            <option value="operator">Operator Lapangan</option>
            <option value="viewer">Viewer (Pemantau)</option>
          </select>
        </div>
      </div>

      {/* 4. Users Table */}
      <div className="corporate-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '14px 20px', fontWeight: 800 }}>PENGGUNA</th>
                <th style={{ padding: '14px 20px', fontWeight: 800 }}>EMAIL</th>
                <th style={{ padding: '14px 20px', fontWeight: 800 }}>HAK AKSES (ROLE)</th>
                <th style={{ padding: '14px 20px', fontWeight: 800 }}>STATUS KREDENSIAL</th>
                <th style={{ padding: '14px 20px', fontWeight: 800 }}>STATUS</th>
                <th style={{ padding: '14px 20px', fontWeight: 800 }}>LOGIN TERAKHIR</th>
                <th style={{ padding: '14px 20px', fontWeight: 800, textAlign: 'right' }}>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
                    {loading ? 'Memuat data pengguna...' : 'Tidak ada pengguna yang cocok dengan kriteria pencarian.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}>
                      {/* Name & Username */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: u.role === 'admin' ? '#003882' : (u.role === 'operator' ? '#059669' : '#64748b'),
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.85rem',
                            fontWeight: 800
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
                                  padding: '1px 5px',
                                  borderRadius: '4px'
                                }}>
                                  ANDA
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                              @{u.username}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td style={{ padding: '16px 20px', color: '#334155' }}>
                        {u.email}
                      </td>

                      {/* Role Badge */}
                      <td style={{ padding: '16px 20px' }}>
                        {u.role === 'admin' && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            background: '#eff6ff',
                            color: '#003882',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            letterSpacing: '0.04em'
                          }}>
                            <ShieldCheck size={13} />
                            ADMINISTRATOR
                          </span>
                        )}
                        {u.role === 'operator' && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            background: '#ecfdf5',
                            color: '#059669',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            letterSpacing: '0.04em'
                          }}>
                            <UserCheck size={13} />
                            OPERATOR
                          </span>
                        )}
                        {u.role === 'viewer' && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            background: '#f1f5f9',
                            color: '#475569',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            letterSpacing: '0.04em'
                          }}>
                            <User size={13} />
                            VIEWER
                          </span>
                        )}
                      </td>

                      {/* Password Security Badge */}
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          color: '#0284c7',
                          background: '#f0f9ff',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid #bae6fd'
                        }}>
                          <Lock size={12} />
                          Terenkripsi Aman
                        </span>
                      </td>

                      {/* Status Toggle */}
                      <td style={{ padding: '16px 20px' }}>
                        <button
                          onClick={() => handleToggleActive(u)}
                          disabled={isCurrent}
                          title={isCurrent ? 'Tidak dapat menonaktifkan akun sendiri' : 'Klik untuk mengubah status'}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: isCurrent ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            backgroundColor: u.is_active ? '#f0fdf4' : '#fef2f2',
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
                      <td style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.78rem' }}>
                        {u.last_login ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Clock size={13} color="#94a3b8" />
                            <span>{new Date(u.last_login).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</span>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Belum pernah</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={() => openEditModal(u)}
                            title="Edit data pengguna"
                            style={{
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#334155',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              transition: 'all 0.15s'
                            }}
                          >
                            <Edit3 size={14} />
                          </button>

                          <button
                            onClick={() => setDeleteConfirmUser(u)}
                            disabled={isCurrent}
                            title={isCurrent ? 'Tidak dapat menghapus akun sendiri' : 'Hapus pengguna'}
                            style={{
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: '1px solid #fecaca',
                              background: isCurrent ? '#f1f5f9' : '#fff1f2',
                              color: isCurrent ? '#94a3b8' : '#e11d48',
                              cursor: isCurrent ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              transition: 'all 0.15s'
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
      </div>

      {/* 5. Modal: Tambah Pengguna Baru */}
      {isAddModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="corporate-card" style={{ maxWidth: '520px', width: '100%', padding: '32px', position: 'relative' }}>
            <button 
              onClick={() => setIsAddModalOpen(false)}
              style={{ position: 'absolute', right: '20px', top: '20px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#edf2fc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#003882' }}>
                <UserPlus size={20} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Tambah Pengguna Baru
              </h3>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '20px' }}>
              Kredensial akun akan dienkripsi secara aman sesuai standar perlindungan data pengguna.
            </p>

            {formError && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertTriangle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  NAMA PENGGUNA (USERNAME) *
                </label>
                <input 
                  type="text"
                  required
                  placeholder="contoh: joko_operator"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  NAMA LENGKAP *
                </label>
                <input 
                  type="text"
                  required
                  placeholder="contoh: Joko Prasetyo, S.T."
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  ALAMAT EMAIL *
                </label>
                <input 
                  type="email"
                  required
                  placeholder="contoh: joko@tanahairku.co.id"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  KATA SANDI (MINIMAL 8 KARAKTER) *
                </label>
                <input 
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  HAK AKSES (ROLE) *
                </label>
                <select 
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.88rem', boxSizing: 'border-box' }}
                >
                  <option value="operator">Operator Lapangan (Pemantauan &amp; Ekspor)</option>
                  <option value="admin">Administrator (Akses Penuh &amp; Pengguna)</option>
                  <option value="viewer">Viewer (Hanya Baca)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{ padding: '9px 16px', borderRadius: '8px', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', fontWeight: 700, cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-corporate-primary"
                  style={{ padding: '9px 20px', fontSize: '0.88rem' }}
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
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="corporate-card" style={{ maxWidth: '520px', width: '100%', padding: '32px', position: 'relative' }}>
            <button 
              onClick={() => setIsEditModalOpen(false)}
              style={{ position: 'absolute', right: '20px', top: '20px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#edf2fc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#003882' }}>
                <Edit3 size={20} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Edit Data Pengguna
              </h3>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '20px' }}>
              Perbarui rincian identitas personel, peran otorisasi, atau atur ulang kata sandi.
            </p>

            {formError && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertTriangle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  NAMA LENGKAP *
                </label>
                <input 
                  type="text"
                  required
                  value={editFormData.full_name}
                  onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  ALAMAT EMAIL *
                </label>
                <input 
                  type="email"
                  required
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  HAK AKSES (ROLE) *
                </label>
                <select 
                  value={editFormData.role}
                  onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.88rem', boxSizing: 'border-box' }}
                >
                  <option value="operator">Operator Lapangan (Pemantauan &amp; Ekspor)</option>
                  <option value="admin">Administrator (Akses Penuh &amp; Pengguna)</option>
                  <option value="viewer">Viewer (Hanya Baca)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  GANTI KATA SANDI (KOSONGKAN JIKA TIDAK DIUBAH)
                </label>
                <input 
                  type="password"
                  placeholder="Minimal 8 karakter baru..."
                  value={editFormData.password}
                  onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input 
                  type="checkbox"
                  id="editIsActive"
                  checked={editFormData.is_active}
                  onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.checked })}
                  disabled={editingUserId === currentUser?.id}
                />
                <label htmlFor="editIsActive" style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 600, cursor: 'pointer' }}>
                  Akun berstatus Aktif (Dapat masuk ke dashboard)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  style={{ padding: '9px 16px', borderRadius: '8px', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', fontWeight: 700, cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-corporate-primary"
                  style={{ padding: '9px 20px', fontSize: '0.88rem' }}
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
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="corporate-card" style={{ maxWidth: '440px', width: '100%', padding: '28px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <Trash2 size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
              Hapus Pengguna?
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5, marginBottom: '20px' }}>
              Apakah Anda yakin ingin menghapus akun <strong>{deleteConfirmUser.full_name}</strong> (@{deleteConfirmUser.username})? Tindakan ini permanen dan tidak dapat dibatalkan.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                style={{ padding: '8px 16px', borderRadius: '8px', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', fontWeight: 700, cursor: 'pointer' }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={submitting}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
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
