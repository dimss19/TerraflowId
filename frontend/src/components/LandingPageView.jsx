import React from 'react';
import { 
  Compass, 
  Activity, 
  ShieldCheck, 
  Cpu, 
  HardDrive, 
  Radio, 
  MapPin, 
  Phone, 
  Mail, 
  ArrowRight, 
  CheckCircle2, 
  ExternalLink,
  Database,
  KeyRound,
  FileText,
  Globe,
  Share2,
  Waves,
  TrendingUp,
  Battery,
  Thermometer
} from 'lucide-react';

export default function LandingPageView({ onGoToLogin }) {
  const handleScrollToSection = (id) => (e) => {
    e.preventDefault();
    const elem = document.getElementById(id);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
      elem.classList.remove('section-scroll-highlight');
      void elem.offsetWidth; // trigger reflow
      elem.classList.add('section-scroll-highlight');
    }
  };

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
          <div 
            onClick={handleScrollToSection('beranda')}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
          >
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
          <nav className="landing-nav">
            <a 
              href="#beranda" 
              onClick={handleScrollToSection('beranda')}
              style={{ fontSize: '0.92rem', color: '#003882', fontWeight: 700, textDecoration: 'none', cursor: 'pointer' }}
            >
              Beranda
            </a>
            <a 
              href="#solusi-awlr" 
              onClick={handleScrollToSection('solusi-awlr')}
              style={{ fontSize: '0.92rem', color: '#475569', fontWeight: 500, textDecoration: 'none', cursor: 'pointer' }}
            >
              Solusi AWLR
            </a>
            <a 
              href="#layanan" 
              onClick={handleScrollToSection('layanan')}
              style={{ fontSize: '0.92rem', color: '#475569', fontWeight: 500, textDecoration: 'none', cursor: 'pointer' }}
            >
              Layanan
            </a>
            <a 
              href="#keamanan" 
              onClick={handleScrollToSection('keamanan')}
              style={{ fontSize: '0.92rem', color: '#475569', fontWeight: 500, textDecoration: 'none', cursor: 'pointer' }}
            >
              Keamanan &amp; Akses
            </a>
            <a 
              href="#kontak" 
              onClick={handleScrollToSection('kontak')}
              style={{ fontSize: '0.92rem', color: '#475569', fontWeight: 500, textDecoration: 'none', cursor: 'pointer' }}
            >
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
                padding: '10px 20px',
                fontSize: '0.88rem',
                cursor: 'pointer'
              }}
            >
              <KeyRound size={16} />
              <span>Login</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section id="beranda" className="landing-section" style={{
        maxWidth: '1440px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div className="landing-hero-grid">
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
              fontSize: 'clamp(2.1rem, 4.5vw, 3.1rem)',
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
              Solusi instrumentasi Automatic Water Level Recorder (AWLR) portabel industri. Terintegrasi sensor level air presisi, transmisi data real-time, pencatatan offline mandiri, dan <strong>sistem keamanan akses terenkripsi</strong>.
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
                <span>Login ke Portal Monitoring</span>
                <ArrowRight size={18} />
              </button>

              <button
                type="button"
                onClick={handleScrollToSection('solusi-awlr')}
                className="btn-corporate-outline"
                style={{
                  padding: '14px 24px',
                  fontSize: '0.95rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <span>Pelajari Fitur Teknis</span>
              </button>
            </div>

            {/* Trust Points */}
            <div style={{ display: 'flex', gap: '28px', marginTop: '36px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', color: '#334155', fontWeight: 600 }}>
                <CheckCircle2 size={18} color="#059669" />
                <span>Keamanan Akses Terenkripsi</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', color: '#334155', fontWeight: 600 }}>
                <CheckCircle2 size={18} color="#059669" />
                <span>Telemetri Industri Real-Time</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', color: '#334155', fontWeight: 600 }}>
                <CheckCircle2 size={18} color="#059669" />
                <span>Pencatatan Offline Mandiri</span>
              </div>
            </div>
          </div>

          {/* Right Hero Content: Clean Animated AWLR Station & Waves Frame */}
          <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <div className="awlr-hero-frame">
              


              {/* Vector SVG: Side Mast, Cantilever, Downward Sensor Lamp & Animated Waves */}
              <div style={{ width: '100%', height: '340px', position: 'relative', overflow: 'hidden' }}>
                <svg
                  viewBox="0 0 520 340"
                  preserveAspectRatio="xMidYMid meet"
                  style={{ width: '100%', height: '100%', display: 'block' }}
                >
                  <defs>
                    <linearGradient id="skyAtmosphere" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#f0f7ff" />
                      <stop offset="60%" stopColor="#e2effe" />
                      <stop offset="100%" stopColor="#cce4fb" />
                    </linearGradient>

                    <linearGradient id="mastSteelGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#0a1d37" />
                      <stop offset="40%" stopColor="#003882" />
                      <stop offset="75%" stopColor="#2563eb" />
                      <stop offset="100%" stopColor="#0f2647" />
                    </linearGradient>

                    <linearGradient id="boomSteelGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#1e40af" />
                      <stop offset="50%" stopColor="#003882" />
                      <stop offset="100%" stopColor="#0a1d37" />
                    </linearGradient>

                    <linearGradient id="solarPanelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#0f172a" />
                      <stop offset="100%" stopColor="#1e3a8a" />
                    </linearGradient>

                    <linearGradient id="sensorConeBeam" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#0284c7" stopOpacity="0.55" />
                      <stop offset="45%" stopColor="#38bdf8" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.03" />
                    </linearGradient>

                    <linearGradient id="waterDeepGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#0369a1" />
                      <stop offset="100%" stopColor="#001e4a" />
                    </linearGradient>

                    <linearGradient id="waterMidGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#0284c7" />
                      <stop offset="100%" stopColor="#002b66" />
                    </linearGradient>

                    <linearGradient id="waterFrontGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="25%" stopColor="#0284c7" />
                      <stop offset="100%" stopColor="#00173b" />
                    </linearGradient>
                  </defs>

                  {/* 1. Sky Backdrop */}
                  <rect width="520" height="340" fill="url(#skyAtmosphere)" />

                  {/* Subtle distance horizontal guidelines */}
                  <line x1="0" y1="125" x2="520" y2="125" stroke="#bfdbfe" strokeWidth="1" strokeDasharray="4 6" opacity="0.4" />
                  <line x1="0" y1="200" x2="520" y2="200" stroke="#bfdbfe" strokeWidth="1" strokeDasharray="4 6" opacity="0.4" />

                  {/* 2. Downward Spotlight / Acoustic Measuring Beam Cone */}
                  <polygon
                    points="274,124 286,124 332,268 228,268"
                    fill="url(#sensorConeBeam)"
                    className="sensor-cone-anim"
                  />

                  {/* Traveling Sonar / Acoustic Pulse Rings */}
                  <g pointerEvents="none">
                    <ellipse cx="280" cy="126" rx="14" ry="4" fill="none" stroke="#0284c7" strokeWidth="2.5" className="sonar-ping-1" />
                    <ellipse cx="280" cy="126" rx="14" ry="4" fill="none" stroke="#0284c7" strokeWidth="2.5" className="sonar-ping-2" />
                    <ellipse cx="280" cy="126" rx="14" ry="4" fill="none" stroke="#0284c7" strokeWidth="2.5" className="sonar-ping-3" />
                  </g>

                  {/* Water Surface Impact Ripples */}
                  <g pointerEvents="none">
                    <ellipse cx="280" cy="268" rx="14" ry="4" fill="none" stroke="#38bdf8" strokeWidth="2.2" className="impact-ripple-1" />
                    <ellipse cx="280" cy="268" rx="14" ry="4" fill="none" stroke="#0284c7" strokeWidth="1.5" className="impact-ripple-2" />
                  </g>



                  {/* 3. Layered Animated Water Waves */}
                  {/* Layer 1: Deep Wave */}
                  <g>
                    <path
                      d="M 0 248 Q 65 238 130 248 T 260 248 T 390 248 T 520 248 T 650 248 T 780 248 T 910 248 T 1040 248 L 1040 340 L 0 340 Z"
                      fill="url(#waterDeepGrad)"
                      opacity="0.55"
                      className="wave-anim-2"
                    />
                  </g>

                  {/* Layer 2: Mid Oceanic Wave */}
                  <g>
                    <path
                      d="M 0 258 Q 65 268 130 258 T 260 258 T 390 258 T 520 258 T 650 258 T 780 258 T 910 258 T 1040 258 L 1040 340 L 0 340 Z"
                      fill="url(#waterMidGrad)"
                      opacity="0.75"
                      className="wave-anim-1"
                    />
                  </g>

                  {/* Layer 3: Front Wave with Highlight Crest */}
                  <g>
                    <path
                      d="M 0 268 Q 65 258 130 268 T 260 268 T 390 268 T 520 268 T 650 268 T 780 268 T 910 268 T 1040 268 L 1040 340 L 0 340 Z"
                      fill="url(#waterFrontGrad)"
                      className="wave-anim-3"
                    />
                    <path
                      d="M 0 268 Q 65 258 130 268 T 260 268 T 390 268 T 520 268 T 650 268 T 780 268 T 910 268 T 1040 268"
                      fill="none"
                      stroke="#bae6fd"
                      strokeWidth="2.5"
                      opacity="0.9"
                      className="wave-anim-3"
                    />
                  </g>

                  {/* 4. Left Concrete Bank & Pier Foundation */}
                  <path
                    d="M 0 190 L 50 220 L 68 240 L 68 340 L 0 340 Z"
                    fill="#334155"
                  />
                  <path
                    d="M 0 190 L 50 220 L 50 340 L 0 340 Z"
                    fill="#1e293b"
                    opacity="0.75"
                  />

                  {/* Steel Base Flange */}
                  <rect x="36" y="216" width="30" height="8" rx="2" fill="#0f172a" />
                  <circle cx="42" cy="220" r="2" fill="#94a3b8" />
                  <circle cx="60" cy="220" r="2" fill="#94a3b8" />

                  {/* 5. Vertical Steel Mast Column ("tiang dari samping") */}
                  <rect x="46" y="44" width="10" height="174" rx="2" fill="url(#mastSteelGrad)" />

                  {/* Solar Panel on Top */}
                  <polygon
                    points="18,40 64,30 67,42 21,52"
                    fill="url(#solarPanelGrad)"
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                  />
                  <line x1="33" y1="37" x2="36" y2="49" stroke="#60a5fa" strokeWidth="1" opacity="0.8" />
                  <line x1="48" y1="34" x2="51" y2="46" stroke="#60a5fa" strokeWidth="1" opacity="0.8" />

                  {/* Telemetry Enclosure Box & Blinking LED */}
                  <rect x="56" y="125" width="28" height="38" rx="4" fill="#ffffff" stroke="#003882" strokeWidth="2" />
                  <rect x="60" y="129" width="20" height="28" rx="2" fill="#edf2fc" />
                  <line x1="70" y1="125" x2="70" y2="105" stroke="#003882" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="70" cy="105" r="2.5" fill="#0284c7" />
                  <circle cx="76" cy="138" r="2.8" fill="#10b981" className="mast-led-anim" />

                  {/* Cantilever Horizontal Boom extending over water */}
                  <rect x="46" y="66" width="238" height="9" rx="2" fill="url(#boomSteelGrad)" />
                  {/* Diagonal Engineering Truss Support */}
                  <line x1="51" y1="110" x2="135" y2="75" stroke="#003882" strokeWidth="3.5" strokeLinecap="round" />

                  {/* Cable conduit running along boom */}
                  <path d="M 56 125 Q 52 75 80 75 L 274 75" fill="none" stroke="#0f172a" strokeWidth="1.8" />

                  {/* Tip End Mounting Bracket */}
                  <circle cx="280" cy="70.5" r="6" fill="#003882" stroke="#ffffff" strokeWidth="1.5" />

                  {/* 6. Downward Sensor ("sensor menghadap kebawah seperti lampu") */}
                  {/* Hanging stem / pendant drop */}
                  <rect x="278" y="75" width="4" height="20" fill="#0f172a" />

                  {/* Sensor Bell / Horn Housing (Industrial Downlight Lamp Shape) */}
                  <path
                    d="M 273 95 L 287 95 L 298 119 L 262 119 Z"
                    fill="#0f172a"
                    stroke="#0284c7"
                    strokeWidth="1.8"
                  />
                  {/* Sensor Base Rim */}
                  <rect x="260" y="119" width="40" height="5" rx="2" fill="#0284c7" />
                  {/* Emitter Lens Face */}
                  <ellipse cx="280" cy="122" rx="15" ry="2.5" fill="#38bdf8" />
                </svg>
              </div>

              {/* Bottom Minimal Frame Footer */}
              <div style={{
                padding: '12px 20px',
                background: 'rgba(255, 255, 255, 0.92)',
                backdropFilter: 'blur(8px)',
                borderTop: '1px solid #dbeafe',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.76rem',
                color: '#003882'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Radio size={14} />
                  <span>Stasiun AWLR Cantilever &bull; Sensor Akustik Terarah</span>
                </div>
                <span className="mono-text" style={{ fontWeight: 700, color: '#64748b' }}>
                  PT Tanah Airku Teknologi
                </span>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* 3. AWLR Technical Highlights */}
      <section id="solusi-awlr" className="landing-section" style={{
        background: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        borderBottom: '1px solid #e2e8f0'
      }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 56px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#003882', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
              INSTRUMENTASI TERPADU
            </div>
            <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.4rem)', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: '0 0 16px' }}>
              Teknologi Monitoring Level Air Otomatis
            </h2>
            <p style={{ fontSize: '1rem', color: '#64748b', lineHeight: 1.6 }}>
              Dirancang untuk ketahanan lapangan ekstrem di muara, pelabuhan, sungai, dan bendungan dengan arsitektur mikrokomputer cerdas.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '28px' }}>
            {/* Card 1 */}
            <div className="corporate-card" style={{ padding: '32px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#edf2fc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#003882', marginBottom: '20px' }}>
                <Cpu size={22} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>
                Sensor Pemantau Presisi Industri
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.6 }}>
                Sensor elevasi digital berakurasi tinggi dengan kompensasi temperatur otomatis, filter stabilitas median multi-sampel, dan transmisi terproteksi bebas interferensi.
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
                Penyimpanan mandiri saat jaringan seluler atau WiFi terputus, dilengkapi mekanisme sinkronisasi otomatis (*catch-up*) saat kembali online.
              </p>
            </div>

            {/* Card 3 */}
            <div id="keamanan" className="corporate-card" style={{ padding: '32px' }}>
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

      {/* 5. Services & Geospatial Solutions */}
      <section id="layanan" className="landing-section" style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 56px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#003882', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
              LAYANAN GEOSPATIAL PT TANAH AIRKU TEKNOLOGI
            </div>
            <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.4rem)', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: '0 0 16px' }}>
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
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '36px',
          paddingBottom: '36px',
          borderBottom: '1px solid #d8e4f4'
        }}>
          {/* Col 1 (Kiri) */}
          <div style={{ maxWidth: '520px' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#003882', marginBottom: '12px' }}>
              Terraflow Indonesia
            </h4>
            <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6 }}>
              <strong>PT Tanah Airku Teknologi</strong> menghadirkan layanan instrumentasi telemetri otomatis dan pemetaan geospatial berstandar industri hidrometri.
            </p>
          </div>

          {/* Col 2 (Paling Kanan) */}
          <div style={{ textAlign: 'left', minWidth: '260px' }}>
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
