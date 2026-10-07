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
  Cpu,
  Layers
} from 'lucide-react';

export default function LoginView({ onLoginSuccess, onBackToLanding }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!username.trim() || !password.trim()) {
      setErrorMessage('Silakan masukkan nama pengguna dan kata sandi.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });

      const data = await response.json();

      if (data.success && data.token) {
        onLoginSuccess(data.token, data.user);
      } else {
        setErrorMessage(data.error || 'Autentikasi gagal. Periksa kembali kredensial Anda.');
      }
    } catch (err) {
      setErrorMessage('Gagal menghubungi server autentikasi: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fillQuickCredentials = (user, pass) => {
    setUsername(user);
    setPassword(pass);
    setErrorMessage('');
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

          {/* Argon2 Security Pill */}
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
            <span>PROTEKSI HASH ARGON2ID ENKRIPSI</span>
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
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Nama Pengguna / Akun
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center'
              }}>
                <User size={18} />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username (contoh: admin)"
                required
                style={{
                  width: '100%',
                  padding: '11px 12px 11px 40px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Kata Sandi
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center'
              }}>
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi"
                required
                style={{
                  width: '100%',
                  padding: '11px 40px 11px 40px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
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
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="btn-corporate-primary"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '0.92rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '6px'
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
                <span>Memverifikasi Argon2...</span>
              </>
            ) : (
              <>
                <KeyRound size={18} />
                <span>Masuk ke Sistem Monitoring</span>
              </>
            )}
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
            AKUN TERSEDIA (ARGON2 ENCRYPTED):
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
              <div style={{ fontWeight: 800, color: '#003882' }}>👑 Administrator</div>
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
              <div style={{ fontWeight: 800, color: '#059669' }}>👷 Teknisi AWLR</div>
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
          Hashing: <strong>Argon2id</strong> (m=64MB, t=3, p=4) &bull; Token JWT 24 Jam
        </div>
      </div>
    </div>
  );
}
