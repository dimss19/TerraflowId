import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle, 
  Compass,
  Mail,
  Clock,
  X,
  UserPlus,
  Phone,
  HelpCircle,
  MessageSquare
} from 'lucide-react';

export default function LoginView({ onLoginSuccess, onBackToLanding }) {
  // Login Form States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingApprovalNotice, setPendingApprovalNotice] = useState(false);

  // Modal: Hubungi Admin untuk Lupa Kata Sandi
  const [isForgotContactModalOpen, setIsForgotContactModalOpen] = useState(false);

  // Modal: Pendaftaran Operator Baru
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [regData, setRegData] = useState({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState(false);

  // Submit Login
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setPendingApprovalNotice(false);

    if (!username.trim() || !password.trim()) {
      setErrorMessage('Silakan masukkan nama pengguna dan kata sandi.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: username.trim(), 
          password, 
          remember_me: rememberMe 
        })
      });

      const data = await response.json();

      if (data.success && data.token) {
        onLoginSuccess(data.token, data.user, rememberMe);
      } else {
        if (data.pending_approval) {
          setPendingApprovalNotice(true);
        } else {
          setErrorMessage(data.error || 'Autentikasi gagal. Periksa kembali kredensial Anda.');
        }
      }
    } catch (err) {
      setErrorMessage('Gagal menghubungi server autentikasi: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Registration
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegError('');

    if (!regData.fullName.trim() || !regData.username.trim() || !regData.email.trim() || !regData.password) {
      setRegError('Semua kolom bertanda wajib harus diisi.');
      return;
    }

    if (regData.password.length < 8) {
      setRegError('Kata sandi minimal harus 8 karakter.');
      return;
    }

    if (regData.password !== regData.confirmPassword) {
      setRegError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setRegLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: regData.fullName.trim(),
          username: regData.username.trim().toLowerCase(),
          email: regData.email.trim().toLowerCase(),
          phone: regData.phone.trim(),
          password: regData.password
        })
      });

      const data = await res.json();

      if (data.success) {
        setRegSuccess(true);
      } else {
        setRegError(data.error || 'Gagal mendaftar akun baru.');
      }
    } catch (err) {
      setRegError('Koneksi terputus: ' + err.message);
    } finally {
      setRegLoading(false);
    }
  };

  const handleCloseRegisterModal = () => {
    setIsRegisterModalOpen(false);
    setRegSuccess(false);
    setRegError('');
    setRegData({
      fullName: '',
      username: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: ''
    });
  };

  const fillQuickCredentials = (user, pass) => {
    setUsername(user);
    setPassword(pass);
    setErrorMessage('');
    setPendingApprovalNotice(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8fafc 0%, #edf3fb 100%)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '24px 16px',
      position: 'relative'
    }}>
      {/* Background Decorative Circles */}
      <div style={{
        position: 'absolute',
        top: '-120px',
        right: '-120px',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0, 56, 130, 0.05) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-120px',
        left: '-120px',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(2, 132, 199, 0.05) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      {/* Top Back Navigation */}
      <div style={{ width: '100%', maxWidth: '440px', marginBottom: '16px' }}>
        <button
          onClick={onBackToLanding}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            color: '#003882',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: 'pointer',
            padding: '6px 0'
          }}
        >
          <ArrowLeft size={16} />
          <span>Kembali ke Beranda Terraflow</span>
        </button>
      </div>

      {/* Main Login Card */}
      <div className="corporate-card" style={{
        width: '100%',
        maxWidth: '440px',
        padding: '36px 32px',
        boxShadow: '0 12px 36px rgba(0, 56, 130, 0.08)',
        position: 'relative',
        zIndex: 2
      }}>
        {/* Header Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: '2.5px solid #003882',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#003882',
            marginBottom: '12px'
          }}>
            <Compass size={28} strokeWidth={2.5} />
          </div>
          
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#003882', letterSpacing: '-0.02em', margin: 0 }}>
            Terraflow Indonesia
          </h2>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginTop: '4px' }}>
            PT Tanah Airku Teknologi &bull; Portal Autentikasi AWLR
          </div>

          {/* Security Pill */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#059669',
            padding: '4px 12px',
            borderRadius: '16px',
            fontSize: '0.74rem',
            fontWeight: 800,
            marginTop: '12px'
          }}>
            <ShieldCheck size={14} />
            <span>PORTAL TERENKRIPSI &bull; AKSES RESMI</span>
          </div>
        </div>

        {/* Error Alert Banner */}
        {errorMessage && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '20px'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Username Field */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ marginBottom: 2 }}>
              <span>NAMA PENGGUNA (USERNAME)</span>
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none'
              }}>
                <User size={18} />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="contoh: admin"
                required
                className="form-input"
                style={{ paddingLeft: '42px' }}
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ marginBottom: 2 }}>
              <span>KATA SANDI</span>
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none'
              }}>
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi"
                required
                className="form-input"
                style={{ paddingLeft: '42px', paddingRight: '42px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Remember Me Checkbox & Forgot Password Link */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginTop: '10px' 
            }}>
              <label style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                userSelect: 'none',
                fontSize: '0.82rem',
                color: '#334155',
                fontWeight: 600
              }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{
                    width: '16px',
                    height: '16px',
                    accentColor: '#003882',
                    cursor: 'pointer'
                  }}
                />
                <span>Ingat Saya</span>
              </label>

              <button
                type="button"
                onClick={() => setIsForgotContactModalOpen(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#003882',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Lupa Kata Sandi?
              </button>
            </div>
          </div>

          {/* Pending Approval Notice Banner */}
          {pendingApprovalNotice && (
            <div style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}>
              <Clock size={18} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#92400e' }}>
                  Akun Menunggu Konfirmasi Administrator
                </div>
                <div style={{ fontSize: '0.76rem', color: '#b45309', marginTop: '2px', lineHeight: 1.4 }}>
                  Pendaftaran akun operator Anda telah diterima. Akses stasiun AWLR akan aktif setelah disetujui oleh Administrator.
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '0.94rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '4px'
            }}
          >
            {isLoading ? (
              <>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#ffffff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <span>Memverifikasi Kredensial...</span>
              </>
            ) : (
              <>
                <KeyRound size={18} />
                <span>Masuk ke Sistem Monitoring</span>
              </>
            )}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
            <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>atau</span>
            <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
          </div>

          {/* Clean Register Button */}
          <button
            type="button"
            onClick={() => {
              setRegError('');
              setRegSuccess(false);
              setIsRegisterModalOpen(true);
            }}
            className="btn btn-secondary"
            style={{
              width: '100%',
              padding: '11px',
              borderRadius: '8px',
              border: '1.5px solid #003882',
              background: '#f8fafc',
              color: '#003882',
              fontSize: '0.88rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <UserPlus size={17} />
            <span>Daftar Akun Baru</span>
          </button>
        </form>

        {/* Quick Demo Credentials Helper */}
        <div style={{
          marginTop: '24px',
          padding: '14px',
          background: '#edf2fc',
          borderRadius: '8px',
          border: '1px solid #d0deff'
        }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#003882', textTransform: 'uppercase', marginBottom: '8px' }}>
            AKUN OPERASIONAL TERSEDIA:
          </div>
          
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => fillQuickCredentials('admin', 'Terraflow2024!')}
              style={{
                flex: '1 1 calc(50% - 4px)',
                padding: '8px 10px',
                borderRadius: '6px',
                background: '#ffffff',
                border: '1px solid #bfdbfe',
                fontSize: '0.76rem',
                color: '#0f172a',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <div style={{ fontWeight: 800, color: '#003882' }}>Administrator</div>
              <div style={{ color: '#64748b', fontSize: '0.7rem' }}>admin / Terraflow2024!</div>
            </button>

            <button
              type="button"
              onClick={() => fillQuickCredentials('operator', 'Operator2024!')}
              style={{
                flex: '1 1 calc(50% - 4px)',
                padding: '8px 10px',
                borderRadius: '6px',
                background: '#ffffff',
                border: '1px solid #bfdbfe',
                fontSize: '0.76rem',
                color: '#0f172a',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <div style={{ fontWeight: 800, color: '#059669' }}>Teknisi AWLR</div>
              <div style={{ color: '#64748b', fontSize: '0.7rem' }}>operator / Operator2024!</div>
            </button>
          </div>
        </div>

        {/* Security Specs Footer */}
        <div style={{
          marginTop: '18px',
          fontSize: '0.72rem',
          color: '#64748b',
          textAlign: 'center',
          lineHeight: 1.5
        }}>
          Sistem Autentikasi Terenkripsi &bull; Sesi Token JWT Terproteksi
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL: HUBUNGI ADMIN UNTUK PERGANTIAN KATA SANDI */}
      {/* ========================================================= */}
      {isForgotContactModalOpen && (
        <div 
          onClick={() => setIsForgotContactModalOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '460px',
              width: '100%',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.2)',
              border: '1px solid #e2e8f0',
              position: 'relative'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: '#fef3c7',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <HelpCircle size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Pergantian Kata Sandi
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0' }}>
                    Protokol Keamanan &amp; Bantuan Kredensial Akun
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsForgotContactModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Policy Info */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px',
              marginBottom: '18px'
            }}>
              <p style={{ fontSize: '0.84rem', color: '#334155', lineHeight: 1.55, margin: 0 }}>
                Untuk memastikan integritas data telemetri stasiun AWLR serta keamanan operasional hidrometri, <strong>reset atau pergantian kata sandi dikelola secara terpusat oleh Administrator Sistem.</strong>
              </p>
              <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5, marginTop: '8px', marginBottom: 0 }}>
                Silakan hubungi Administrator atau Helpdesk TI resmi instansi Anda untuk memverifikasi identitas dan memperoleh pembaruan kata sandi.
              </p>
            </div>

            {/* Official Contact Card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '22px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '8px',
                background: '#ffffff',
                border: '1px solid #cbd5e1'
              }}>
                <div style={{ color: '#003882' }}><Mail size={18} /></div>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Email Administrator</div>
                  <a href="mailto:admin@terraflow.id" style={{ fontSize: '0.86rem', fontWeight: 700, color: '#003882', textDecoration: 'none' }}>
                    admin@terraflow.id
                  </a>
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '8px',
                background: '#ffffff',
                border: '1px solid #cbd5e1'
              }}>
                <div style={{ color: '#059669' }}><MessageSquare size={18} /></div>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>WhatsApp Hotline / Helpdesk</div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a' }}>
                    +62 812-3456-7890 (Siaga Operasional AWLR)
                  </div>
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.74rem',
                color: '#64748b',
                padding: '4px 8px'
              }}>
                <Clock size={14} color="#64748b" />
                <span>Jam Layanan Helpdesk: 08:00 &ndash; 17:00 WIB (Siaga Banjir 24 Jam)</span>
              </div>
            </div>

            {/* Button Close */}
            <button
              type="button"
              onClick={() => setIsForgotContactModalOpen(false)}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '0.88rem'
              }}
            >
              Saya Mengerti &bull; Tutup Bantuan
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: PENDAFTARAN AKUN OPERATOR BARU (REGISTER) */}
      {/* ========================================================= */}
      {isRegisterModalOpen && (
        <div 
          onClick={handleCloseRegisterModal}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e2e8f0',
              position: 'relative'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#eff6ff',
                  color: '#003882',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <UserPlus size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Daftar Akun Operator Baru
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0' }}>
                    Registrasi personel teknisi stasiun AWLR Terraflow
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseRegisterModal}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Approval Notice Badge */}
            <div style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              padding: '10px 12px',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.78rem',
              color: '#92400e',
              lineHeight: 1.4
            }}>
              <Clock size={16} style={{ flexShrink: 0 }} />
              <span>
                <strong>Catatan Otorisasi:</strong> Akun baru akan berstatus <em>Menunggu Persetujuan Admin</em> dan aktif setelah stasiun AWLR ditugaskan.
              </span>
            </div>

            {regSuccess ? (
              /* Success Confirmation View */
              <div style={{ textAlign: 'center', padding: '16px 8px' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: '#ecfdf5',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px'
                }}>
                  <CheckCircle2 size={32} />
                </div>

                <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#065f46', margin: '0 0 8px' }}>
                  Pendaftaran Berhasil Dikirim!
                </h4>

                <p style={{ fontSize: '0.84rem', color: '#334155', lineHeight: 1.5, margin: '0 0 16px' }}>
                  Akun operator untuk <strong>{regData.fullName}</strong> (@{regData.username}) telah berhasil didaftarkan ke sistem Terraflow.
                </p>

                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '0.78rem',
                  color: '#64748b',
                  lineHeight: 1.5,
                  marginBottom: '20px',
                  textAlign: 'left'
                }}>
                  Administrator akan memverifikasi permohonan Anda dan menugaskan stasiun AWLR yang bersangkutan. Anda akan dapat masuk ke sistem setelah disetujui.
                </div>

                <button
                  type="button"
                  onClick={handleCloseRegisterModal}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '10px' }}
                >
                  Selesai &bull; Kembali ke Login
                </button>
              </div>
            ) : (
              /* Register Form */
              <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {regError && (
                  <div style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#b91c1c',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                    <span>{regError}</span>
                  </div>
                )}

                {/* Full Name */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 2 }}>
                    <span>NAMA LENGKAP *</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="contoh: Budi Santoso"
                    value={regData.fullName}
                    onChange={(e) => setRegData({ ...regData, fullName: e.target.value })}
                    className="form-input"
                  />
                </div>

                {/* Username */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 2 }}>
                    <span>NAMA PENGGUNA (USERNAME) *</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="contoh: budi_awlr"
                    value={regData.username}
                    onChange={(e) => setRegData({ ...regData, username: e.target.value })}
                    className="form-input"
                  />
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>
                    Hanya huruf, angka, dan garis bawah tanpa spasi (min. 3 karakter)
                  </div>
                </div>

                {/* Email */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 2 }}>
                    <span>ALAMAT EMAIL *</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="contoh: budi@instansi.go.id"
                    value={regData.email}
                    onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                    className="form-input"
                  />
                </div>

                {/* Phone */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 2 }}>
                    <span>NOMOR TELEPON / WHATSAPP</span>
                  </label>
                  <input
                    type="text"
                    placeholder="contoh: 08123456789"
                    value={regData.phone}
                    onChange={(e) => setRegData({ ...regData, phone: e.target.value })}
                    className="form-input"
                  />
                </div>

                {/* Password */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 2 }}>
                    <span>KATA SANDI *</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      placeholder="Minimal 8 karakter"
                      value={regData.password}
                      onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                      className="form-input"
                      style={{ paddingRight: '38px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 2 }}>
                    <span>KONFIRMASI KATA SANDI *</span>
                  </label>
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    placeholder="Ulangi kata sandi"
                    value={regData.confirmPassword}
                    onChange={(e) => setRegData({ ...regData, confirmPassword: e.target.value })}
                    className="form-input"
                  />
                </div>

                {/* Modal Buttons */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={handleCloseRegisterModal}
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: '10px', fontSize: '0.86rem' }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={regLoading}
                    className="btn btn-primary"
                    style={{ flex: 1.5, padding: '10px', fontSize: '0.86rem' }}
                  >
                    {regLoading ? 'Mendaftarkan...' : 'Kirim Pendaftaran'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
