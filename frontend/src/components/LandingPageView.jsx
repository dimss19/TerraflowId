import React from 'react';
import { 
  Compass, 
  Waves, 
  Activity, 
  ShieldCheck, 
  Lock, 
  Cpu, 
  HardDrive, 
  Radio, 
  MapPin, 
  Phone, 
  Mail, 
  ArrowRight, 
  CheckCircle2, 
  ExternalLink,
  ChevronRight,
  Database,
  KeyRound,
  FileText,
  Globe,
  Share2
} from 'lucide-react';

export default function LandingPageView({ onGoToLogin, latestReading, device }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc', color: '#0f172a' }}>
      
      {/* 1. Official Navigation Bar */}
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid #eef2f7',
        padding: '16px 40px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 2px 10px rgba(0, 56, 130, 0.04)'
      }}>
        <div style={{
          maxWidth: '1440px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          {/* Brand Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              border: '2.5px solid #003882',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#003882'
            }}>
              <Compass size={24} strokeWidth={2.5} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#003882', letterSpacing: '-0.02em' }}>
                Terraflow
              </span>
              <span style={{ fontSize: '1.3rem', fontWeight: 500, color: '#003882' }}>
                Indonesia
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
            <a href="#beranda" style={{ fontSize: '0.92rem', color: '#003882', fontWeight: 700, textDecoration: 'none' }}>
              Beranda
            </a>
            <a href="#solusi-awlr" style={{ fontSize: '0.92rem', color: '#475569', fontWeight: 500, textDecoration: 'none' }}>
              Solusi AWLR
            </a>
            <a href="#layanan" style={{ fontSize: '0.92rem', color: '#475569', fontWeight: 500, textDecoration: 'none' }}>
              Layanan
            </a>
            <a href="#keamanan" style={{ fontSize: '0.92rem', color: '#475569', fontWeight: 500, textDecoration: 'none' }}>
              Keamanan &amp; Akses
            </a>
            <a href="#kontak" style={{ fontSize: '0.92rem', color: '#475569', fontWeight: 500, textDecoration: 'none' }}>
              Kontak
            </a>
          </nav>

          {/* Login Action CTA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={onGoToLogin}
              className="btn-corporate-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 22px',
                fontSize: '0.88rem',
                cursor: 'pointer'
              }}
            >
              <KeyRound size={16} />
              <span>Masuk ke Sistem (Login)</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section id="beranda" style={{
        padding: '72px 40px 60px',
        maxWidth: '1440px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.35fr) minmax(360px, 1fr)',
          gap: '48px',
          alignItems: 'center'
        }}>
          {/* Left Hero Content */}
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '20px',
              background: '#edf2fc',
              border: '1px solid #d0deff',
              color: '#003882',
              fontSize: '0.78rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '20px'
            }}>
              <ShieldCheck size={16} />
              <span>PT TANAH AIRKU TEKNOLOGI &bull; SISTEM AWLR ENTERPRISE</span>
            </div>

            <h1 style={{
              fontSize: '3.1rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.035em',
              lineHeight: 1.15,
              marginBottom: '20px'
            }}>
              Presisi Pemetaan Geospatial &amp; Monitoring <span style={{ color: '#003882' }}>AWLR Pintar.</span>
            </h1>

            <p style={{
              fontSize: '1.08rem',
              color: '#475569',
              lineHeight: 1.65,
              maxWidth: '640px',
              marginBottom: '32px'
            }}>
              Solusi instrumentasi Automatic Water Level Recorder (AWLR) portabel industri. Terintegrasi sensor ultrasonik RS485 Modbus A16, transmisi MQTT real-time, pencatatan MicroSD mandiri, dan <strong>sistem keamanan akses terenkripsi</strong>.
            </p>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <button
                onClick={onGoToLogin}
                className="btn-corporate-primary"
                style={{
                  padding: '14px 28px',
                  fontSize: '0.98rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer'
                }}
              >
                <span>Buka Portal Monitoring (Login)</span>
                <ArrowRight size={18} />
              </button>

              <a
                href="#solusi-awlr"
                style={{
                  padding: '14px 24px',
                  borderRadius: '8px',
                  background: '#ffffff',
                  color: '#003882',
                  border: '1.5px solid #bfdbfe',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                Pelajari Fitur Teknis
              </a>
            </div>

            {/* Trust Points */}
            <div style={{ display: 'flex', gap: '28px', marginTop: '36px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', color: '#334155', fontWeight: 600 }}>
                <CheckCircle2 size={18} color="#059669" />
                <span>Keamanan Akses Terenkripsi</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', color: '#334155', fontWeight: 600 }}>
                <CheckCircle2 size={18} color="#059669" />
                <span>Telemetri Modbus RS485</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', color: '#334155', fontWeight: 600 }}>
                <CheckCircle2 size={18} color="#059669" />
                <span>Pencatatan Offline MicroSD</span>
              </div>
            </div>
          </div>

          {/* Right Hero Card: Live Instrument Preview */}
          <div className="corporate-card" style={{
            padding: '32px',
            background: '#ffffff',
            boxShadow: '0 16px 40px rgba(0, 56, 130, 0.08)',
            border: '1px solid #d8e4f4',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#edf2fc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#003882' }}>
                  <Waves size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>STATUS STASIUN TELEMETRI</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>{device?.name || 'AWLR-001 (Alpha Station)'}</div>
                </div>
              </div>
              <span className="badge badge-navy" style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
                &bull; SISTEM AKTIF
              </span>
            </div>

            {/* Readout Highlight Box */}
            <div style={{
              background: 'linear-gradient(135deg, #003882 0%, #0284c7 100%)',
              borderRadius: '12px',
              padding: '24px',
              color: '#ffffff',
              textAlign: 'center',
              marginBottom: '20px'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                ELEVASI PASANG SURUT TERKINI
              </div>
              <div style={{ fontSize: '2.8rem', fontWeight: 800, margin: '8px 0 4px', letterSpacing: '-0.03em' }}>
                {latestReading?.water_level_cm ? (Number(latestReading.water_level_cm) / 100).toFixed(2) : '2.26'} <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>m</span>
              </div>
              <div style={{ fontSize: '0.88rem', color: '#e0f2fe', fontWeight: 600 }}>
                {latestReading?.water_level_cm ? Number(latestReading.water_level_cm).toFixed(1) : '226.2'} cm &bull; Jangkauan Maks 15.0 m
              </div>
            </div>

            {/* Grid Metrics Snippet */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="subtle-panel" style={{ padding: '12px' }}>
                <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>JARAK SENSOR (RAW)</div>
                <div className="mono-text" style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                  {latestReading?.raw_distance_cm ? (Number(latestReading.raw_distance_cm) / 100).toFixed(2) : '3.74'} m
                </div>
              </div>
              <div className="subtle-panel" style={{ padding: '12px' }}>
                <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>STATUS INTEGRITAS</div>
                <div className="mono-text" style={{ fontSize: '1.05rem', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                  TERVERIFIKASI
                </div>
              </div>
            </div>

            {/* Prompt to Login */}
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button
                onClick={onGoToLogin}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  background: '#edf2fc',
                  color: '#003882',
                  border: '1px solid #bfdbfe',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <span>Masuk untuk Kontrol Penuh &amp; Analisis Tidal</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. AWLR Technical Highlights */}
      <section id="solusi-awlr" style={{
        background: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        borderBottom: '1px solid #e2e8f0',
        padding: '80px 40px'
      }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 56px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#003882', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
              INSTRUMENTASI TERPADU
            </div>
            <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: '0 0 16px' }}>
              Teknologi Monitoring Level Air Otomatis
            </h2>
            <p style={{ fontSize: '1rem', color: '#64748b', lineHeight: 1.6 }}>
              Dirancang untuk ketahanan lapangan ekstrem di muara, pelabuhan, sungai, dan bendungan dengan arsitektur mikrokomputer cerdas.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '28px' }}>
            {/* Card 1 */}
            <div className="corporate-card" style={{ padding: '32px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#edf2fc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#003882', marginBottom: '20px' }}>
                <Cpu size={22} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>
                Sensor Modbus RS485 A16
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.6 }}>
                Rentang pengukuran 25 cm hingga 600 cm dengan kompensasi temperatur akustik otomatis, filter stabilitas median, dan komunikasi industri RS485 bebas interferensi.
              </p>
            </div>

            {/* Card 2 */}
            <div className="corporate-card" style={{ padding: '32px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#edf2fc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#003882', marginBottom: '20px' }}>
                <HardDrive size={22} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>
                Dual-Storage &amp; Auto Sync
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.6 }}>
                Penyimpanan mandiri pada MicroSD card FAT32 saat jaringan seluler atau WiFi terputus, dilengkapi mekanisme sinkronisasi otomatis (*catch-up*) saat kembali online.
              </p>
            </div>

            {/* Card 3 */}
            <div className="corporate-card" style={{ padding: '32px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#edf2fc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#003882', marginBottom: '20px' }}>
                <ShieldCheck size={22} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>
                Keamanan Sistem &amp; Hak Akses
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.6 }}>
                Seluruh kredensial operator dan administrator dilindungi enkripsi terstandar untuk menangkal akses tidak sah serta menjamin integritas monitoring hidrologi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Security & Architecture Spotlight Section */}
      <section id="keamanan" style={{ padding: '80px 40px', background: '#f8fafc' }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
          <div style={{
            background: 'linear-gradient(135deg, #002d69 0%, #003882 100%)',
            borderRadius: '20px',
            padding: '56px 48px',
            color: '#ffffff',
            boxShadow: '0 20px 48px rgba(0, 56, 130, 0.16)'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 1fr)',
              gap: '48px',
              alignItems: 'center'
            }}>
              <div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(255, 255, 255, 0.14)',
                  padding: '5px 14px',
                  borderRadius: '16px',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  marginBottom: '16px',
                  color: '#93c5fd'
                }}>
                  <Lock size={14} />
                  <span>STANDAR INDUSTRI &amp; KEAMANAN SISTEM</span>
                </div>

                <h2 style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 18px', lineHeight: 1.2 }}>
                  Arsitektur Keandalan &amp; Standar Keamanan TerraFlow
                </h2>

                <p style={{ fontSize: '0.96rem', color: '#dbeafe', lineHeight: 1.7, marginBottom: '24px' }}>
                  TerraFlow menggabungkan keandalan hardware industri dengan sistem keamanan modern. Setiap transmisi data telemetri, perintah kalibrasi jarak jauh, dan autentikasi personel diproteksi dengan enkripsi serta pengawasan multi-tier untuk menjamin integritas monitoring hidrologi.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckCircle2 size={18} color="#67e8f9" />
                    <span style={{ fontSize: '0.9rem', color: '#ffffff' }}>Enkripsi Kredensial: Hashing kriptografis memori tinggi &amp; proteksi brute-force</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckCircle2 size={18} color="#67e8f9" />
                    <span style={{ fontSize: '0.9rem', color: '#ffffff' }}>Integritas Telemetri: Protokol MQTT terautentikasi &amp; failover MicroSD lokal</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckCircle2 size={18} color="#67e8f9" />
                    <span style={{ fontSize: '0.9rem', color: '#ffffff' }}>Sesi Akses: Token JSON Web Token (JWT) dengan pembatasan masa berlaku aman</span>
                  </div>
                </div>

                <div style={{ marginTop: '32px' }}>
                  <button
                    onClick={onGoToLogin}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '8px',
                      background: '#ffffff',
                      color: '#003882',
                      border: 'none',
                      fontSize: '0.92rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>Buka Portal Monitoring Sekarang</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>

              {/* Security Blueprint Panel */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.16)',
                borderRadius: '16px',
                padding: '28px',
                fontFamily: 'monospace',
                fontSize: '0.82rem'
              }}>
                <div style={{ color: '#93c5fd', fontWeight: 800, marginBottom: '12px', fontSize: '0.78rem' }}>
                  // ARSITEKTUR ALIRAN AUTENTIKASI:
                </div>
                <div style={{ color: '#e2e8f0', lineHeight: 1.8 }}>
                  1. Akses Portal &amp; Autentikasi Personel<br />
                  &nbsp;&nbsp;&darr; (Koneksi Terenkripsi)<br />
                  2. Validasi Kredensial &amp; Role-Based Access (RBAC)<br />
                  &nbsp;&nbsp;&darr; (Pengecekan Hash Aman)<br />
                  3. Penerbitan Token Sesi Terproteksi<br />
                  &nbsp;&nbsp;&darr;<br />
                  4. Akses Real-Time Telemetri &amp; Analisis Diberikan
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Services & Geospatial Solutions */}
      <section id="layanan" style={{ padding: '80px 40px', background: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 56px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#003882', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
              LAYANAN GEOSPATIAL PT TANAH AIRKU TEKNOLOGI
            </div>
            <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: '0 0 16px' }}>
              Solusi Survei, Pemetaan &amp; Telemetri
            </h2>
            <p style={{ fontSize: '1rem', color: '#64748b', lineHeight: 1.6 }}>
              Menghadirkan layanan pemetaan pada bidang geospatial untuk mendukung kebutuhan survei, analisis, serta pengolahan data spasial secara efektif dan terukur.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
            <div className="corporate-card" style={{ padding: '28px' }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#003882', marginBottom: '8px' }}>Survei Topografi</h4>
              <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.6 }}>Pengukuran kontur terestris berpresisi tinggi untuk perencanaan teknik sipil dan infrastruktur.</p>
            </div>
            <div className="corporate-card" style={{ padding: '28px' }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#003882', marginBottom: '8px' }}>Survei GNSS Geodetik</h4>
              <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.6 }}>Penentuan titik kontrol orde tinggi dengan teknologi RTK dan post-processing statis.</p>
            </div>
            <div className="corporate-card" style={{ padding: '28px' }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#003882', marginBottom: '8px' }}>Aerial Mapping (UAV)</h4>
              <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.6 }}>Pemotretan udara drone fotogrametri dan LiDAR resolusi tinggi untuk ortofoto dan DEM/DSM.</p>
            </div>
            <div className="corporate-card" style={{ padding: '28px' }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#003882', marginBottom: '8px' }}>Survei Batimetri &amp; AWLR</h4>
              <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.6 }}>Pemeruman alur navigasi dan pemantauan dinamika pasang surut air laut berkelanjutan.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Partner Accreditation Bar */}
      <section style={{ padding: '40px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '18px' }}>
            MITRA &amp; AKREDITASI INDUSTRI
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '48px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#475569', letterSpacing: '0.04em' }}>ASRI</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#475569', letterSpacing: '0.04em' }}>ISO 9001</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#475569', letterSpacing: '0.04em' }}>ISI</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#475569', letterSpacing: '0.04em' }}>BIG</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#475569', letterSpacing: '0.04em' }}>KADIN</span>
          </div>
        </div>
      </section>

      {/* 7. Corporate Contact & Footer */}
      <footer id="kontak" style={{ background: '#edf3fb', padding: '56px 40px 24px', marginTop: 'auto' }}>
        <div style={{
          maxWidth: '1440px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '36px',
          paddingBottom: '36px',
          borderBottom: '1px solid #d8e4f4'
        }}>
          {/* Col 1 */}
          <div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#003882', marginBottom: '12px' }}>
              Terraflow Indonesia
            </h4>
            <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6 }}>
              <strong>PT Tanah Airku Teknologi</strong> menghadirkan layanan instrumentasi telemetri otomatis dan pemetaan geospatial berstandar industri.
            </p>
          </div>

          {/* Col 2 */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '12px' }}>
              Layanan Utama
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem', color: '#475569' }}>
              <li>Automatic Water Level Recorder</li>
              <li>Survei Batimetri &amp; Alur Laut</li>
              <li>Topografi Terestris</li>
              <li>Pemotretan Udara UAV</li>
            </ul>
          </div>

          {/* Col 3 */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '12px' }}>
              Kantor Pusat &amp; Stasiun
            </h4>
            <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6 }}>
              Perumahan Griyashanta Blok L/249<br />
              Kota Malang, Jawa Timur<br />
              WhatsApp: +62 813 5858 3775<br />
              Email: terraflow.pt@gmail.com
            </div>
          </div>

          {/* Col 4 */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '12px' }}>
              Portal Akses
            </h4>
            <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '16px' }}>
              Akses sistem monitoring telemetri dengan kredensial resmi.
            </p>
            <button
              onClick={onGoToLogin}
              className="btn-corporate-primary"
              style={{ padding: '8px 18px', fontSize: '0.82rem', cursor: 'pointer' }}
            >
              Masuk ke Portal Login
            </button>
          </div>
        </div>

        <div style={{
          maxWidth: '1440px',
          margin: '0 auto',
          paddingTop: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          fontSize: '0.78rem',
          color: '#64748b'
        }}>
          <div>
            &copy; 2024 <strong>PT Tanah Airku Teknologi</strong> &bull; Terraflow Indonesia. Precision in Every Pixel.
          </div>
          <div>
            Dilindungi oleh Sistem Keamanan Terenkripsi
          </div>
        </div>
      </footer>

    </div>
  );
}
