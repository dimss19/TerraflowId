import React, { useState } from 'react';
import { 
  User, 
  Lock, 
  Mail, 
  Phone, 
  Shield, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  KeyRound,
  Calendar,
  Clock
} from 'lucide-react';

export default function ProfileView({ 
  currentUser, 
  authToken, 
  onBackToDashboard, 
  onUpdateCurrentUser, 
  onActionToast 
}) {
  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    full_name: currentUser?.fullName || '',
    email: currentUser?.email || '',
    phone: currentUser?.phone || '',
    avatar_url: currentUser?.avatarUrl || ''
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState(null);

  // Password Form State
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState(null);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileFeedback(null);

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(profileForm)
      });
      const json = await res.json();

      if (json.success) {
        setProfileFeedback({ type: 'success', text: 'Profil pengguna berhasil diperbarui.' });
        if (onUpdateCurrentUser) {
          const updated = {
            ...currentUser,
            fullName: json.user.full_name,
            email: json.user.email,
            phone: json.user.phone || '',
            avatarUrl: json.user.avatar_url || ''
          };
          onUpdateCurrentUser(updated);
        }
        if (onActionToast) onActionToast('Profil berhasil diperbarui');
      } else {
        setProfileFeedback({ type: 'error', text: json.error || 'Gagal memperbarui profil' });
      }
    } catch (err) {
      setProfileFeedback({ type: 'error', text: err.message });
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordFeedback(null);

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordFeedback({ type: 'error', text: 'Konfirmasi kata sandi baru tidak cocok' });
      setPasswordLoading(false);
      return;
    }

    if (passwordForm.new_password.length < 8) {
      setPasswordFeedback({ type: 'error', text: 'Kata sandi baru minimal harus 8 karakter' });
      setPasswordLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/password', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          current_password: passwordForm.current_password,
          new_password: passwordForm.new_password
        })
      });
      const json = await res.json();

      if (json.success) {
        setPasswordFeedback({ type: 'success', text: 'Kata sandi berhasil diperbarui.' });
        setPasswordForm({
          current_password: '',
          new_password: '',
          confirm_password: ''
        });
        if (onActionToast) onActionToast('Kata sandi berhasil diubah');
      } else {
        setPasswordFeedback({ type: 'error', text: json.error || 'Gagal mengubah kata sandi' });
      }
    } catch (err) {
      setPasswordFeedback({ type: 'error', text: err.message });
    } finally {
      setPasswordLoading(false);
    }
  };

  const displayName = currentUser?.fullName || currentUser?.username || 'Pengguna';
  const userInitials = (displayName[0] || 'U').toUpperCase();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 1. Top Header Banner */}
      <div className="corporate-card" style={{ padding: '28px' }}>
        <button
          onClick={onBackToDashboard}
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '14px', padding: '6px 12px' }}
        >
          <ArrowLeft size={15} />
          <span>Kembali ke Dashboard</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {currentUser?.avatarUrl ? (
            <img
              src={currentUser.avatarUrl}
              alt={displayName}
              style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #003882' }}
            />
          ) : (
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#003882',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem',
              fontWeight: 800
            }}>
              {userInitials}
            </div>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                {displayName}
              </h2>
              <span style={{
                padding: '3px 10px',
                borderRadius: '16px',
                fontSize: '0.74rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                background: currentUser?.role === 'admin' ? '#eff6ff' : '#ecfdf5',
                color: currentUser?.role === 'admin' ? '#003882' : '#059669',
                border: `1px solid ${currentUser?.role === 'admin' ? '#bfdbfe' : '#a7f3d0'}`
              }}>
                {currentUser?.role || 'Operator'}
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
              @{currentUser?.username} &bull; {currentUser?.email}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Grid Forms */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', 
        gap: '24px' 
      }}>
        
        {/* Card 1: Informasi Profil */}
        <div className="corporate-card" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#edf2fc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#003882' }}>
              <User size={18} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Informasi Akun
            </h3>
          </div>

          {profileFeedback && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: profileFeedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
              color: profileFeedback.type === 'success' ? '#059669' : '#dc2626',
              border: `1px solid ${profileFeedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
              fontSize: '0.84rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              {profileFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {profileFeedback.text}
            </div>
          )}

          <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">
                <span>NAMA LENGKAP *</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={profileForm.full_name}
                onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span>ALAMAT EMAIL *</span>
              </label>
              <input
                type="email"
                className="form-input"
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span>NOMOR TELEPON / WHATSAPP</span>
              </label>
              <input
                type="tel"
                className="form-input"
                placeholder="+6281234567890"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span>URL FOTO PROFIL (OPSIONAL)</span>
              </label>
              <input
                type="url"
                className="form-input"
                placeholder="https://..."
                value={profileForm.avatar_url}
                onChange={(e) => setProfileForm({ ...profileForm, avatar_url: e.target.value })}
              />
            </div>

            <button
              type="submit"
              disabled={profileLoading}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '10px' }}
            >
              <Save size={16} />
              <span>{profileLoading ? 'Menyimpan...' : 'Simpan Perubahan Profil'}</span>
            </button>
          </form>
        </div>

        {/* Card 2: Ubah Kata Sandi */}
        <div className="corporate-card" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#edf2fc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#003882' }}>
              <Lock size={18} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Keamanan &amp; Ganti Kata Sandi
            </h3>
          </div>

          {passwordFeedback && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: passwordFeedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
              color: passwordFeedback.type === 'success' ? '#059669' : '#dc2626',
              border: `1px solid ${passwordFeedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
              fontSize: '0.84rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              {passwordFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {passwordFeedback.text}
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">
                <span>KATA SANDI SAAT INI *</span>
              </label>
              <input
                type="password"
                className="form-input"
                placeholder="Masukkan kata sandi lama"
                value={passwordForm.current_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span>KATA SANDI BARU *</span>
              </label>
              <input
                type="password"
                className="form-input"
                placeholder="Minimal 8 karakter baru"
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span>KONFIRMASI KATA SANDI BARU *</span>
              </label>
              <input
                type="password"
                className="form-input"
                placeholder="Ulangi kata sandi baru"
                value={passwordForm.confirm_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                required
              />
            </div>

            <button
              type="submit"
              disabled={passwordLoading}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '10px' }}
            >
              <KeyRound size={16} />
              <span>{passwordLoading ? 'Memproses...' : 'Perbarui Kata Sandi'}</span>
            </button>
          </form>
        </div>

      </div>

    </div>
  );
}
