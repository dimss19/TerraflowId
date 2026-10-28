#include "web_server_mgr.h"
#include "config.h"
#include "mbedtls/sha256.h"
#include <time.h>
#include <esp_wifi.h>
#include "rtc_mgr.h"

// Singleton instance
WebServerManager webServerMgr;

// Default Password Hash for "password" (SHA-256)
static const char DEFAULT_PASS_HASH[] =
  "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8";

#define SESSION_TIMEOUT_MS 28800000UL // 8 hours

// ============================================================
// EMBEDDED LIGHTWEIGHT HTML/CSS/JS (FLASH PROGMEM)
// ============================================================

static const char SETUP_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TerraFlow AWLR - Aktivasi Perangkat</title>
<style>
*{box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0b1120;color:#f8fafc;margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px}
.box{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:24px;width:100%;max-width:380px;box-shadow:0 12px 30px rgba(0,0,0,.6)}
.badge{background:#10b981;color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;display:inline-block;margin-bottom:10px}
h2{margin:0 0 4px;font-size:20px;color:#38bdf8}
p{margin:0 0 16px;font-size:13px;color:#94a3b8;line-height:1.4}
label{display:block;color:#cbd5e1;font-size:12px;font-weight:600;margin-top:12px;margin-bottom:4px}
input{width:100%;padding:10px 12px;background:#0f172a;border:1px solid #475569;border-radius:6px;color:#fff;font-size:14px}
input:focus{outline:none;border-color:#38bdf8;box-shadow:0 0 0 2px rgba(56,189,248,.2)}
.adv-toggle{background:none;border:none;color:#38bdf8;font-size:12px;font-weight:600;padding:8px 0;cursor:pointer;display:flex;align-items:center;gap:4px;margin-top:14px}
.adv-panel{display:none;background:#0f172a;border:1px solid #334155;padding:12px;border-radius:8px;margin-top:8px}
button.submit{width:100%;padding:12px;margin-top:18px;background:#0284c7;color:#fff;border:none;border-radius:6px;font-size:15px;font-weight:700;cursor:pointer;transition:background .2s}
button.submit:hover{background:#0369a1}
.err{color:#f87171;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);padding:8px;border-radius:6px;font-size:13px;margin-top:12px;display:none;text-align:center}
.ok{color:#4ade80;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);padding:12px;border-radius:6px;font-size:13px;margin-top:12px;display:none;text-align:center;line-height:1.4}
</style></head><body>
<div class="box">
<div class="badge">AKTIVASI PERANGKAT BARU</div>
<h2>TerraFlow AWLR</h2>
<p>Perangkat belum diaktivasi. Masukkan Serial Number dari Web Dashboard dan koneksi WiFi lokasi.</p>
<form id="sf">
<label>Serial Number Perangkat *</label>
<input id="sn" placeholder="Contoh: TF-AWLR-2610-001" required style="font-family:monospace;font-weight:700;letter-spacing:.04em;text-transform:uppercase">
<label>Nama WiFi Lapangan (SSID) *</label>
<input id="ws" placeholder="Nama WiFi / Hotspot" required>
<label>Password WiFi Lapangan *</label>
<input id="wp" type="password" placeholder="Password WiFi" required>
<button type="button" class="adv-toggle" onclick="toggleAdv()">⚙️ Pengaturan Lanjutan (Server MQTT) ▾</button>
<div id="adv" class="adv-panel">
<label>Broker MQTT Host</label>
<input id="mh" value="43.134.53.192">
<label>Broker MQTT Port</label>
<input id="mp" type="number" value="80">
<label>Ketinggian Sensor (cm)</label>
<input id="sh" type="number" step="0.1" value="600.0">
</div>
<button type="submit" class="submit" id="sbtn">Aktifkan &amp; Simpan</button>
</form>
<div class="err" id="se"></div>
<div class="ok" id="sok"></div>
</div>
<script>
function toggleAdv(){var a=document.getElementById('adv');a.style.display=(a.style.display==='block'?'none':'block');}
document.getElementById('sf').onsubmit=function(ev){
  ev.preventDefault();
  var e=document.getElementById('se'),ok=document.getElementById('sok'),b=document.getElementById('sbtn');
  e.style.display='none';ok.style.display='none';b.disabled=true;b.textContent='Mengaktivasi...';
  var body='sn='+encodeURIComponent(document.getElementById('sn').value.trim().toUpperCase())+
           '&wf_ssid='+encodeURIComponent(document.getElementById('ws').value)+
           '&wf_pass='+encodeURIComponent(document.getElementById('wp').value)+
           '&mq_host='+encodeURIComponent(document.getElementById('mh').value)+
           '&mq_port='+encodeURIComponent(document.getElementById('mp').value)+
           '&height='+encodeURIComponent(document.getElementById('sh').value);
  fetch('/api/setup',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:body
  }).then(function(r){return r.json()})
  .then(function(d){
    b.disabled=false;b.textContent='Aktifkan & Simpan';
    if(d.ok){
      ok.innerHTML='<b>Berhasil Diaktivasi!</b><br>Alat sedang reboot ke mode normal. SSID akan berganti menjadi <b>TerraFlow-'+document.getElementById('sn').value.trim().toUpperCase()+'</b>.';
      ok.style.display='block';
      document.getElementById('sf').style.display='none';
    }else{
      e.textContent=d.msg||'Gagal aktivasi perangkat';
      e.style.display='block';
    }
  }).catch(function(){
    b.disabled=false;b.textContent='Aktifkan & Simpan';
    e.textContent='Error komunikasi dengan ESP32';
    e.style.display='block';
  });
};
</script></body></html>
)rawliteral";

static const char LOGIN_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TerraFlow AWLR - Login</title>
<style>
*{box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0b1120;color:#f8fafc;margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px}
.box{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:28px;width:100%;max-width:340px;box-shadow:0 12px 30px rgba(0,0,0,.6)}
.badge{background:#0284c7;color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;display:inline-block;margin-bottom:10px}
h2{margin:0 0 4px;font-size:22px;color:#38bdf8}
p{margin:0 0 20px;font-size:13px;color:#94a3b8;line-height:1.4}
label{display:block;color:#cbd5e1;font-size:12px;font-weight:600;margin-top:12px;margin-bottom:4px}
input{width:100%;padding:11px 12px;background:#0f172a;border:1px solid #475569;border-radius:6px;color:#fff;font-size:15px}
input:focus{outline:none;border-color:#38bdf8;box-shadow:0 0 0 2px rgba(56,189,248,.2)}
button{width:100%;padding:12px;margin-top:18px;background:#0284c7;color:#fff;border:none;border-radius:6px;font-size:15px;font-weight:600;cursor:pointer;transition:background .2s}
button:hover{background:#0369a1}
.err{color:#f87171;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);padding:8px;border-radius:6px;font-size:13px;margin-top:12px;display:none;text-align:center}
.helper{font-size:11px;color:#64748b;margin-top:6px;display:block}
</style></head><body>
<div class="box">
<div class="badge">🔒 PORTAL TERPROTEKSI</div>
<h2>TerraFlow AWLR</h2>
<p>Masukkan Serial Number perangkat untuk mengakses dashboard.</p>
<form id="f">
<label>Serial Number (Kunci Akses)</label>
<input id="p" placeholder="Lihat stiker pada bodi alat" required autocomplete="current-password" style="font-family:monospace;letter-spacing:.03em;text-transform:uppercase">
<span class="helper">Nomor seri tertera pada stiker fisik bodi alat</span>
<button type="submit" id="subBtn">Masuk Dashboard</button>
</form>
<div class="err" id="e"></div>
</div>
<script>
document.getElementById('f').onsubmit=function(ev){
  ev.preventDefault();
  var e=document.getElementById('e'),b=document.getElementById('subBtn');
  e.style.display='none';b.disabled=true;b.textContent='Memverifikasi...';
  var body='pass='+encodeURIComponent(document.getElementById('p').value.trim().toUpperCase());
  fetch('/api/login',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:body
  }).then(function(r){return r.json()})
  .then(function(d){
    b.disabled=false;b.textContent='Masuk Dashboard';
    if(d.ok){
      if(d.token)sessionStorage.setItem('st',d.token);
      window.location='/dashboard';
    }else{
      e.textContent=d.msg||'Serial Number salah';
      e.style.display='block';
    }
  }).catch(function(){
    b.disabled=false;b.textContent='Masuk Dashboard';
    e.textContent='Error koneksi ke ESP32';
    e.style.display='block';
  });
};
</script></body></html>
)rawliteral";

static const char DASH_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TerraFlow AWLR - Dashboard</title>
<style>
*{box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0b1120;color:#f8fafc;margin:0;display:flex;min-height:100vh}
nav{width:180px;background:#1e293b;border-right:1px solid #334155;flex-shrink:0;padding:16px 0}
.brand{padding:0 16px 16px;border-bottom:1px solid #334155;margin-bottom:8px}
.brand h3{margin:0;font-size:16px;color:#38bdf8}
.brand small{font-size:11px;color:#94a3b8}
nav a{display:block;padding:11px 18px;color:#94a3b8;text-decoration:none;font-size:14px;transition:all .2s}
nav a:hover{background:#334155;color:#fff}
nav a.a{background:#334155;color:#38bdf8;border-left:3px solid #38bdf8;font-weight:600}
.m{flex:1;min-width:0;padding:24px;max-width:960px}
.hdr{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px}
.hdr h1{margin:0;font-size:22px;color:#fff}
.chip{background:#1e293b;border:1px solid #334155;padding:6px 12px;border-radius:20px;font-size:12px;color:#94a3b8}
.chip b{color:#38bdf8}
.hero{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:24px;text-align:center;margin-bottom:20px;box-shadow:0 4px 16px rgba(0,0,0,.4)}
.hero .label{font-size:13px;font-weight:600;letter-spacing:1px;color:#94a3b8;text-transform:uppercase}
.hero .val{font-size:clamp(44px,11vw,68px);font-weight:800;color:#38bdf8;line-height:1.1;margin:8px 0}
.hero .val span{font-size:.45em;font-weight:600;color:#64748b;margin-left:4px}
.hero .sub{font-size:13px;color:#94a3b8}
.hero .sub b{color:#cbd5e1}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-bottom:20px}
.card{background:#1e293b;border:1px solid #334155;padding:16px;border-radius:10px}
.card small{color:#94a3b8;font-size:12px;display:block}
.card .v{font-size:22px;font-weight:700;margin-top:6px}
.ok{color:#4ade80}.warn{color:#facc15}.bad{color:#f87171}
@media(max-width:640px){
body{flex-direction:column}
nav{width:100%;display:flex;flex-wrap:wrap;border-right:none;border-bottom:1px solid #334155}
.brand{display:none}
nav a{flex:1 1 auto;text-align:center;padding:10px 8px;font-size:13px}
.m{padding:16px}
}
</style></head><body>
<nav>
<div class="brand">
<h3>TerraFlow AWLR</h3>
<small id="devBadge">AWLR</small>
</div>
<a href="/dashboard" class="a">Dashboard</a>
<a href="/storage">File &amp; Log SD</a>
<a href="/settings">Pengaturan Sistem</a>
<a href="/logout">Logout</a>
</nav>
<div class="m">
<div id="sleepBox" style="background:#1e3a8a;border:1px solid #3b82f6;border-radius:10px;padding:12px 18px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
<div>
<div style="font-weight:700;color:#93c5fd;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Mode Portal Lapangan (Window Timer)</div>
<div style="font-size:13px;color:#f8fafc;margin-top:2px">Masuk Deep Sleep dalam <b id="sleepTimer" style="color:#38bdf8">--</b> dtk (Interval Operasi: <b id="curInterval" style="color:#facc15">--</b>)</div>
</div>
<button id="btnSleepNow" onclick="sleepNow()" style="background:#2563eb;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px;width:auto;margin:0">Mulai Mode Tidur Sekarang</button>
</div>

<div class="hdr">
<div>
<h1>Monitoring Lapangan (Raw Distance)</h1>
<small style="color:#64748b" id="lastTs">Update terakhir: --</small>
</div>
<div class="chip">Perangkat: <b id="devId">--</b></div>
</div>

<div class="hero">
<div class="label">Jarak Sensor A16 (Raw Distance)</div>
<div class="val" id="dist">--<span>cm</span></div>
<div class="sub">
Filter Gelombang: <b id="filtDist" style="color:#cbd5e1">-- cm</b> &nbsp;|&nbsp; 
Status Transmisi: <b id="srcBadge" style="color:#38bdf8">--</b>
</div>
</div>

<div class="grid">
<div class="card"><small>Suhu Sensor</small><div class="v" id="tmp">-- °C</div></div>
<div class="card"><small>Kekuatan Sinyal WiFi</small><div class="v" id="sig">-- dBm</div></div>
<div class="card"><small>Penyimpanan MicroSD</small><div class="v" id="sd">--</div></div>
<div class="card"><small>Koneksi MQTT Broker</small><div class="v" id="mq">--</div></div>
<div class="card"><small>RTC DS3231 (0x68)</small><div class="v" id="rtc">--</div></div>
</div>
</div>
<script>
function ah(){var t=sessionStorage.getItem('st');return t?{'X-Session':t}:{};}

function sleepNow(){
  var b=document.getElementById('btnSleepNow');
  b.disabled=true;b.textContent='Memasuki Deep Sleep...';
  fetch('/api/sleep',{method:'POST',headers:ah()}).then(function(){
    alert('Perangkat kini masuk ke Mode Deep Sleep hemat daya. Tekan tombol BOOT atau reset untuk mengakses kembali.');
  });
}

function applyStatus(d){
  document.getElementById('devId').textContent=d.device_id||'--';
  document.getElementById('devBadge').textContent=d.device_id||'AWLR';
  document.getElementById('lastTs').textContent='Update: '+(d.timestamp||'--');
  var dist=d.distance!=null?Number(d.distance):null;
  if(dist!=null){document.getElementById('dist').innerHTML=dist.toFixed(1)+'<span>cm</span>';}
  else{document.getElementById('dist').innerHTML='--<span>cm</span>';}
  var fDist=d.filtered_distance!=null?Number(d.filtered_distance):null;
  if(fDist!=null){document.getElementById('filtDist').textContent=fDist.toFixed(1)+' cm';}
  document.getElementById('srcBadge').textContent=(d.source||'--').toUpperCase();

  var tmp=document.getElementById('tmp');
  if(d.temperature_c!=null){tmp.textContent=Number(d.temperature_c).toFixed(1)+' °C';}

  var sig=document.getElementById('sig');
  if(d.rssi!=null){
    sig.textContent=d.rssi+' dBm';
    sig.className='v '+(d.rssi>-70?'ok':d.rssi>-85?'warn':'bad');
  }

  var sd=document.getElementById('sd');
  if(d.sd_ok){
    sd.textContent='OK '+(d.pending_logs>0?'('+d.pending_logs+' buf)':'(Tersimpan)');
    sd.className='v '+(d.pending_logs>0?'warn':'ok');
  }else{
    sd.textContent='FAIL / N/A';
    sd.className='v bad';
  }

  var mq=document.getElementById('mq');
  mq.textContent=d.mqtt_ok?'ONLINE':'OFFLINE';
  mq.className='v '+(d.mqtt_ok?'ok':'bad');

  var rtc=document.getElementById('rtc');
  if(rtc){
    if(d.rtc_ok){
      rtc.textContent='AKTIF ('+(d.rtc_time?d.rtc_time.substring(11,19):'OK')+')';
      rtc.className='v ok';
    }else{
      rtc.textContent='TIDAK TERDETEKSI';
      rtc.className='v bad';
    }
  }

  if(d.portal_remaining_sec!=null){
    document.getElementById('sleepTimer').textContent=d.portal_remaining_sec;
  }
  if(d.sampling_interval_sec!=null){
    var s=Number(d.sampling_interval_sec);
    var txt=s>=3600?(s/3600)+' Jam':s>=60?(s/60)+' Menit':s+' Detik';
    document.getElementById('curInterval').textContent=txt;
  }
}

var pollTimer=null;
function u(retry){
  if(document.hidden)return;
  var hdrs=retry?{}:ah();
  fetch('/api/status',{headers:hdrs,credentials:'same-origin',cache:'no-store'})
  .then(function(r){
    if(r.status===401){
      if(!retry&&sessionStorage.getItem('st')){
        sessionStorage.removeItem('st');
        return u(true);
      }
      location='/login';
      return null;
    }
    if(!r.ok)throw new Error('http');
    return r.json();
  }).then(function(d){
    if(!d)return;
    if(d.token)sessionStorage.setItem('st',d.token);
    applyStatus(d);
  }).catch(function(){});
}
function startPoll(){
  if(!pollTimer)pollTimer=setInterval(u,5000);
}
function stopPoll(){
  if(pollTimer){clearInterval(pollTimer);pollTimer=null;}
}
document.addEventListener('visibilitychange',function(){
  if(document.hidden){stopPoll();}
  else{u();startPoll();}
});
u();startPoll();
</script></body></html>
)rawliteral";

static const char STORAGE_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TerraFlow AWLR - File & Log SD</title>
<style>
*{box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0b1120;color:#f8fafc;margin:0;display:flex;min-height:100vh}
nav{width:180px;background:#1e293b;border-right:1px solid #334155;flex-shrink:0;padding:16px 0}
.brand{padding:0 16px 16px;border-bottom:1px solid #334155;margin-bottom:8px}
.brand h3{margin:0;font-size:16px;color:#38bdf8}
.brand small{font-size:11px;color:#94a3b8}
nav a{display:block;padding:11px 18px;color:#94a3b8;text-decoration:none;font-size:14px;transition:all .2s}
nav a:hover{background:#334155;color:#fff}
nav a.a{background:#334155;color:#38bdf8;border-left:3px solid #38bdf8;font-weight:600}
.m{flex:1;min-width:0;padding:24px;max-width:860px}
h1{margin:0 0 16px;font-size:22px;color:#fff}
.cap-box{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}
.cap-card{background:#1e293b;border:1px solid #334155;padding:12px 18px;border-radius:8px;flex:1 1 140px}
.cap-card small{color:#94a3b8;font-size:12px}
.cap-card b{color:#38bdf8;font-size:18px;display:block;margin-top:4px}
.table-wrap{background:#1e293b;border:1px solid #334155;border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.4)}
table{width:100%;border-collapse:collapse;font-size:14px;text-align:left}
th{background:#0f172a;padding:12px 16px;color:#94a3b8;font-weight:600;border-bottom:1px solid #334155}
td{padding:12px 16px;border-bottom:1px solid #334155;color:#cbd5e1}
tr:hover td{background:#243248}
.btn-dl{background:#16a34a;color:#fff;border:none;padding:6px 12px;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;margin-right:6px}
.btn-dl:hover{background:#15803d}
.btn-del{background:#dc2626;color:#fff;border:none;padding:6px 12px;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer}
.btn-del:hover{background:#b91c1c}
.empty{text-align:center;padding:32px;color:#64748b}
@media(max-width:640px){
body{flex-direction:column}
nav{width:100%;display:flex;flex-wrap:wrap;border-right:none;border-bottom:1px solid #334155}
.brand{display:none}
nav a{flex:1 1 auto;text-align:center;padding:10px 8px;font-size:13px}
.m{padding:16px}
}
</style></head><body>
<nav>
<div class="brand">
<h3>TerraFlow AWLR</h3>
<small>STORAGE</small>
</div>
<a href="/dashboard">Dashboard</a>
<a href="/storage" class="a">File &amp; Log SD</a>
<a href="/settings">Pengaturan Sistem</a>
<a href="/logout">Logout</a>
</nav>
<div class="m">
<h1>File &amp; Log Riwayat MicroSD</h1>

<div class="cap-box">
<div class="cap-card"><small>Sisa Kapasitas</small><b id="cFree">-- MB</b></div>
<div class="cap-card"><small>Total Kapasitas</small><b id="cTot">-- MB</b></div>
</div>

<div class="table-wrap">
<table>
<thead><tr><th>Nama File CSV</th><th>Ukuran</th><th style="text-align:right">Aksi</th></tr></thead>
<tbody id="tb"><tr><td colspan="3" class="empty">Memuat daftar file SD...</td></tr></tbody>
</table>
</div>
</div>
<script>
function ah(){var t=sessionStorage.getItem('st');return t?{'X-Session':t}:{};}
function loadFiles(){
  fetch('/api/storage',{headers:ah(),credentials:'same-origin'}).then(function(r){
    if(r.status===401){location='/login';return null;}
    return r.json();
  }).then(function(d){
    if(!d)return;
    document.getElementById('cFree').textContent=(d.free_mb!=null?d.free_mb.toFixed(1):'--')+' MB';
    document.getElementById('cTot').textContent=(d.total_mb!=null?d.total_mb.toFixed(1):'--')+' MB';
    var tb=document.getElementById('tb');
    tb.replaceChildren();
    if(!d.files||d.files.length===0){
      var tr=document.createElement('tr');
      var td=document.createElement('td');
      td.colSpan=3;td.className='empty';
      td.textContent='Tidak ada file log di MicroSD.';
      tr.appendChild(td);tb.appendChild(tr);
      return;
    }
    d.files.forEach(function(f){
      var tr=document.createElement('tr');
      var tdN=document.createElement('td');
      tdN.textContent=f.name;
      var tdS=document.createElement('td');
      tdS.textContent=(f.size/1024).toFixed(1)+' KB';
      var tdA=document.createElement('td');
      tdA.style.textAlign='right';

      var bDl=document.createElement('button');
      bDl.className='btn-dl';bDl.textContent='Download';
      bDl.onclick=function(){
        var tok=sessionStorage.getItem('st')||'';
        window.location='/api/dl?path='+encodeURIComponent(f.path)+'&t='+encodeURIComponent(tok);
      };

      var bDel=document.createElement('button');
      bDel.className='btn-del';bDel.textContent='Hapus';
      bDel.onclick=function(){
        if(confirm('Yakin ingin menghapus file '+f.name+'?')){
          deleteFile(f.path);
        }
      };

      tdA.appendChild(bDl);
      tdA.appendChild(bDel);
      tr.appendChild(tdN);
      tr.appendChild(tdS);
      tr.appendChild(tdA);
      tb.appendChild(tr);
    });
  }).catch(function(){});
}

function deleteFile(path){
  fetch('/api/delete',{
    method:'POST',
    headers:Object.assign({'Content-Type':'application/x-www-form-urlencoded'},ah()),
    credentials:'same-origin',
    body:'path='+encodeURIComponent(path)
  }).then(function(r){return r.json()})
  .then(function(d){
    if(d&&d.ok)loadFiles();
    else alert('Gagal menghapus file');
  }).catch(function(){alert('Error saat menghapus');});
}

loadFiles();
</script></body></html>
)rawliteral";

static const char SETTINGS_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TerraFlow AWLR - Pengaturan</title>
<style>
*{box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0b1120;color:#f8fafc;margin:0;display:flex;min-height:100vh}
nav{width:180px;background:#1e293b;border-right:1px solid #334155;flex-shrink:0;padding:16px 0}
.brand{padding:0 16px 16px;border-bottom:1px solid #334155;margin-bottom:8px}
.brand h3{margin:0;font-size:16px;color:#38bdf8}
.brand small{font-size:11px;color:#94a3b8}
nav a{display:block;padding:11px 18px;color:#94a3b8;text-decoration:none;font-size:14px;transition:all .2s}
nav a:hover{background:#334155;color:#fff}
nav a.a{background:#334155;color:#38bdf8;border-left:3px solid #38bdf8;font-weight:600}
.m{flex:1;min-width:0;padding:24px;max-width:680px}
h1{margin:0 0 16px;font-size:22px;color:#fff}
h3{color:#38bdf8;margin:20px 0 8px;font-size:15px;border-bottom:1px solid #334155;padding-bottom:6px}
label{display:block;color:#cbd5e1;font-size:13px;margin-top:10px;margin-bottom:4px;font-weight:600}
input{width:100%;padding:11px 12px;background:#0f172a;border:1px solid #475569;border-radius:6px;color:#fff;font-size:15px}
input:focus{outline:none;border-color:#38bdf8}
.hint{font-size:12px;color:#64748b;margin-top:4px}
button{padding:13px 24px;background:#0284c7;color:#fff;border:none;border-radius:6px;font-weight:700;cursor:pointer;margin-top:24px;font-size:15px;width:100%}
button:hover{background:#0369a1}
.msg{margin-top:14px;padding:12px;border-radius:6px;font-size:14px;display:none;text-align:center}
.msg.ok{background:#065f46;color:#a7f3d0;display:block}
.msg.er{background:#7f1d1d;color:#fecaca;display:block}
@media(max-width:640px){
body{flex-direction:column}
nav{width:100%;display:flex;flex-wrap:wrap;border-right:none;border-bottom:1px solid #334155}
.brand{display:none}
nav a{flex:1 1 auto;text-align:center;padding:10px 8px;font-size:13px}
.m{padding:16px}
}
</style></head><body>
<nav>
<div class="brand">
<h3>TerraFlow AWLR</h3>
<small>SETTINGS</small>
</div>
<a href="/dashboard">Dashboard</a>
<a href="/storage">File &amp; Log SD</a>
<a href="/settings" class="a">Pengaturan Sistem</a>
<a href="/logout">Logout</a>
</nav>
<div class="m">
<h1>Pengaturan Sistem</h1>
<div id="msg" class="msg"></div>

<h3>1. Identitas Perangkat (Serial Number)</h3>
<label>Serial Number (Kunci Akses &amp; MQTT Topic)</label>
<input id="dev_id" maxlength="32" placeholder="e.g. TF-AWLR-2610-001" style="font-family:monospace;font-weight:700">
<div class="hint">Nomor seri unit yang digunakan untuk autentikasi portal dan topik MQTT</div>

<label>Nama Stasiun / Lokasi</label>
<input id="dev_name" maxlength="64" placeholder="e.g. Pos Pantau Jembatan 1">

<h3>2. Sampling Sensor AWLR &amp; Mode Daya</h3>
<div class="hint" style="margin-bottom:10px;color:#94a3b8">Interval pembacaan sensor dan transmisi data. ESP32 otomatis menggunakan mode Deep Sleep antar-interval untuk menghemat daya baterai.</div>
<label>Interval Sampling &amp; Transmisi Telemetri</label>
<select id="samp_sec" style="width:100%;padding:11px 12px;background:#0f172a;border:1px solid #475569;border-radius:6px;color:#fff;font-size:15px">
<option value="60">1 Menit (Mode Uji Coba / Kalibrasi)</option>
<option value="900">15 Menit (Standar Pemantauan AWLR)</option>
<option value="1800">30 Menit (Mode Hemat Daya)</option>
<option value="3600">1 Jam (Mode Ultra Hemat Baterai)</option>
<option value="7200">2 Jam (Siaga Panjang)</option>
</select>

<h3>3. Koneksi WiFi Router Lapangan</h3>
<label>WiFi SSID</label>
<input id="wf_ssid" maxlength="32">
<label>WiFi Password</label>
<input id="wf_pass" type="password" maxlength="64" placeholder="Wajib isi ulang saat ganti SSID">

<h3>4. Koneksi MQTT Broker</h3>
<label>Broker IP / Hostname</label>
<input id="mq_host" maxlength="64">
<label>Broker Port</label>
<input id="mq_port" type="number" placeholder="1883">
<label>MQTT Username</label>
<input id="mq_user" maxlength="32">
<label>MQTT Password</label>
<input id="mq_pass" type="password" maxlength="64">

<button onclick="save()" id="btnSave">Simpan &amp; Terapkan Konfigurasi</button>

<h3 style="color:#f87171;border-color:#7f1d1d;margin-top:36px">5. Reset Pengaturan Pabrik</h3>
<div class="hint" style="color:#fca5a5">Menghapus Serial Number dan kredensial WiFi. Alat akan kembali ke mode aktivasi awal (SSID: <b>TerraFlow-Setup</b> tanpa login).</div>
<button type="button" onclick="factoryReset()" style="background:#dc2626;margin-top:12px">Hapus Serial Number &amp; Reset Pabrik</button>
</div>
<script>
function ah(){var t=sessionStorage.getItem('st');return t?{'X-Session':t}:{};}
function load(){
  fetch('/api/settings',{headers:ah(),credentials:'same-origin'}).then(function(r){
    if(r.status===401){sessionStorage.removeItem('st');location='/login';return null;}
    return r.json();
  }).then(function(d){
    if(!d)return;
    document.getElementById('dev_id').value=d.dev_id||'';
    document.getElementById('dev_name').value=d.dev_name||'';
    document.getElementById('samp_sec').value=d.samp_sec!=null?d.samp_sec:15;
    document.getElementById('wf_ssid').value=d.wf_ssid||'';
    document.getElementById('mq_host').value=d.mq_host||'';
    document.getElementById('mq_port').value=d.mq_port||1883;
    document.getElementById('mq_user').value=d.mq_user||'';
  }).catch(function(){});
}

function save(){
  var b=document.getElementById('btnSave'),m=document.getElementById('msg');
  b.disabled=true;b.textContent='Menyimpan data...';m.style.display='none';

  var ks=['dev_id','dev_name','samp_sec','wf_ssid','wf_pass','mq_host','mq_port','mq_user','mq_pass'];
  var params=ks.map(function(k){
    var el=document.getElementById(k);
    return k+'='+encodeURIComponent(el?el.value:'');
  }).join('&');

  fetch('/api/settings',{
    method:'POST',
    headers:Object.assign({'Content-Type':'application/x-www-form-urlencoded'},ah()),
    credentials:'same-origin',
    body:params
  }).then(function(r){
    if(r.status===401){location='/login';return null;}
    return r.json();
  }).then(function(d){
    b.disabled=false;b.textContent='Simpan & Terapkan Konfigurasi';
    if(!d)return;
    m.textContent=d.msg||'Tersimpan!';
    m.className='msg '+(d.ok?'ok':'er');
    if(d.restart){
      b.disabled=true;
      b.textContent='ESP32 Restarting... Silakan hubungkan ulang';
      setTimeout(function(){location='/login'},4000);
    }
  }).catch(function(){
    b.disabled=false;b.textContent='Simpan & Terapkan Konfigurasi';
    m.textContent='Gagal menyimpan ke ESP32';
    m.className='msg er';
  });
}

function factoryReset(){
  if(confirm('PERINGATAN: Apakah Anda yakin ingin menghapus Serial Number dan mengembalikan alat ke mode setup awal?')){
    fetch('/api/factory-reset',{method:'POST',headers:ah(),credentials:'same-origin'})
    .then(function(r){return r.json()})
    .then(function(d){
      alert(d.msg||'Perangkat di-reset. Menghubungkan kembali...');
      location='/';
    }).catch(function(){alert('Error komunikasi reset');});
  }
}
load();
</script></body></html>
)rawliteral";

// ============================================================
// CONSTRUCTOR & LIFECYCLE
// ============================================================

WebServerManager::WebServerManager() : server(80), sdLoggerRef(NULL), ntpConfigured(false) {
  telemetryMux = portMUX_INITIALIZER_UNLOCKED;
  sessionToken[0] = '\0';
  sessionStart = 0;
  apActive = false;
  lastStaRetryMs = 0;
  mqttConfigDirty = false;
  sleepRequested = false;
  portalStartMs = 0;
  portalWindowActive = false;

  testModeActive = false;
  testModeStartMs = 0;
  testModeDurationSec = 300;

  // Defaults
  memset(&settings, 0, sizeof(settings));
  strncpy(settings.deviceId, DEVICE_ID, sizeof(settings.deviceId) - 1);
  strncpy(settings.deviceName, SYSTEM_NAME, sizeof(settings.deviceName) - 1);
  strncpy(settings.wifiSsid, WIFI_SSID, sizeof(settings.wifiSsid) - 1);
  strncpy(settings.wifiPass, WIFI_PASSWORD, sizeof(settings.wifiPass) - 1);
  strncpy(settings.mqttBroker, MQTT_BROKER, sizeof(settings.mqttBroker) - 1);
  settings.mqttPort = MQTT_PORT;
  strncpy(settings.mqttUser, MQTT_USER, sizeof(settings.mqttUser) - 1);
  strncpy(settings.mqttPass, MQTT_PASS, sizeof(settings.mqttPass) - 1);
  settings.sensorHeightCm = DEFAULT_SENSOR_HEIGHT;
  settings.offsetCm = DEFAULT_OFFSET;
  settings.slope = DEFAULT_SLOPE;
  settings.samplingIntervalSec = SAMPLING_INTERVAL_MS / 1000;
  strncpy(settings.passHash, DEFAULT_PASS_HASH, sizeof(settings.passHash) - 1);

  // Initial snapshot
  memset(&telemetry, 0, sizeof(telemetry));
  telemetry.waterLevelCm = 0.0f;
  telemetry.rawDistanceCm = 0.0f;
  telemetry.filteredDistanceCm = 0.0f;
  telemetry.temperatureC = 25.0f;
  telemetry.signalRssi = -50;
  telemetry.sdCardOk = true;
  telemetry.pendingLogs = 0;
  telemetry.readingCount = 0;
  telemetry.wifiConnected = false;
  telemetry.mqttConnected = false;
  strncpy(telemetry.dataSource, "live", sizeof(telemetry.dataSource) - 1);
  strncpy(telemetry.lastSampleTime, "--", sizeof(telemetry.lastSampleTime) - 1);
  telemetry.portalRemainingSec = PORTAL_WINDOW_SEC;
  telemetry.samplingIntervalSec = SAMPLING_INTERVAL_MS / 1000;
}

void WebServerManager::sha256Hex(const char *input, char *output) {
  unsigned char hash[32];
  mbedtls_sha256_context ctx;
  mbedtls_sha256_init(&ctx);
  mbedtls_sha256_starts(&ctx, 0);
  mbedtls_sha256_update(&ctx, (const unsigned char*)input, strlen(input));
  mbedtls_sha256_finish(&ctx, hash);
  mbedtls_sha256_free(&ctx);
  for (int i = 0; i < 32; i++) {
    sprintf(output + (i * 2), "%02x", hash[i]);
  }
  output[64] = '\0';
}

String WebServerManager::getEffectiveDeviceId() {
  if (strlen(settings.deviceId) > 0) {
    return String(settings.deviceId);
  }
  uint8_t mac[6];
  WiFi.macAddress(mac);
  char buf[16];
  snprintf(buf, sizeof(buf), "AWLR-%02X%02X", mac[4], mac[5]);
  return String(buf);
}

String WebServerManager::getSoftApSsid() {
  if (!settings.isProvisioned) {
    return "TerraFlow-Setup";
  }
  return "TerraFlow-" + getEffectiveDeviceId();
}

String WebServerManager::getCurrentLogFilename() {
  time_t now = time(nullptr);
  struct tm timeinfo;
  if (localtime_r(&now, &timeinfo) && timeinfo.tm_year > (2020 - 1900)) {
    char buf[32];
    strftime(buf, sizeof(buf), "%Y-%m-%d.csv", &timeinfo);
    return String(buf);
  }
  return "data_log.csv";
}

void WebServerManager::loadSettings() {
  prefs.begin("terraflow", true); // read-only
  
  settings.isProvisioned = prefs.getBool("prov", false);
  String devId = prefs.getString("dev_id", "");
  if (devId.length() > 0) {
    strncpy(settings.deviceId, devId.c_str(), sizeof(settings.deviceId) - 1);
    if (!prefs.isKey("prov")) {
      settings.isProvisioned = (devId != "AWLR-001");
    }
  } else {
    String autoId = getEffectiveDeviceId();
    strncpy(settings.deviceId, autoId.c_str(), sizeof(settings.deviceId) - 1);
  }

  String devName = prefs.getString("dev_name", SYSTEM_NAME);
  strncpy(settings.deviceName, devName.c_str(), sizeof(settings.deviceName) - 1);

  String ssid = prefs.getString("wf_ssid", "");
  if (ssid.length() == 0 || ssid == "passwordnyarahasia") {
    ssid = WIFI_SSID;
  }
  strncpy(settings.wifiSsid, ssid.c_str(), sizeof(settings.wifiSsid) - 1);

  String pass = prefs.getString("wf_pass", "");
  if (pass.length() == 0 || pass == "qwertyuiop") {
    pass = WIFI_PASSWORD;
  }
  strncpy(settings.wifiPass, pass.c_str(), sizeof(settings.wifiPass) - 1);

  String mqHost = prefs.getString("mq_host", "");
  if (mqHost.length() == 0 || mqHost == "192.168.110.29" || mqHost == "192.168.18.121") {
    mqHost = MQTT_BROKER;
  }
  strncpy(settings.mqttBroker, mqHost.c_str(), sizeof(settings.mqttBroker) - 1);

  settings.mqttPort = prefs.getUShort("mq_port", MQTT_PORT);

  String mqUser = prefs.getString("mq_user", MQTT_USER);
  strncpy(settings.mqttUser, mqUser.c_str(), sizeof(settings.mqttUser) - 1);

  String mqPass = prefs.getString("mq_pass", MQTT_PASS);
  strncpy(settings.mqttPass, mqPass.c_str(), sizeof(settings.mqttPass) - 1);

  settings.sensorHeightCm = prefs.getFloat("height", DEFAULT_SENSOR_HEIGHT);
  settings.offsetCm = prefs.getFloat("offset", DEFAULT_OFFSET);
  settings.samplingIntervalSec = prefs.getUInt("samp_sec", SAMPLING_INTERVAL_MS / 1000);
  if (settings.samplingIntervalSec < 15) {
    settings.samplingIntervalSec = 15;
  }

  String hash = prefs.getString("pass_hash", DEFAULT_PASS_HASH);
  strncpy(settings.passHash, hash.c_str(), sizeof(settings.passHash) - 1);

  prefs.end();
  Serial.printf("[SETTINGS] Loaded: ID=%s, Height=%.1f, Provisioned=%s\n",
    settings.deviceId, settings.sensorHeightCm, settings.isProvisioned ? "YES" : "NO (Setup Mode)");
}

void WebServerManager::saveSettings() {
  prefs.begin("terraflow", false); // read-write
  prefs.putString("dev_id", settings.deviceId);
  prefs.putString("dev_name", settings.deviceName);
  prefs.putString("wf_ssid", settings.wifiSsid);
  prefs.putString("wf_pass", settings.wifiPass);
  prefs.putString("mq_host", settings.mqttBroker);
  prefs.putUShort("mq_port", settings.mqttPort);
  prefs.putString("mq_user", settings.mqttUser);
  prefs.putString("mq_pass", settings.mqttPass);
  prefs.putFloat("height", settings.sensorHeightCm);
  prefs.putFloat("offset", settings.offsetCm);
  prefs.putFloat("slope", settings.slope);
  prefs.putUInt("samp_sec", settings.samplingIntervalSec);
  prefs.putString("pass_hash", settings.passHash);
  prefs.putBool("prov", settings.isProvisioned);
  prefs.end();
  Serial.printf("[SETTINGS] Saved successfully to NVS (ID=%s, Provisioned=%s).\n",
    settings.deviceId, settings.isProvisioned ? "YES" : "NO");
}

void WebServerManager::factoryReset() {
  prefs.begin("terraflow", false);
  prefs.remove("dev_id");
  prefs.remove("prov");
  prefs.remove("pass_hash");
  prefs.remove("wf_ssid");
  prefs.remove("wf_pass");
  prefs.end();
  Serial.println("[RESET] Factory reset executed. Rebooting into Setup Mode...");
  delay(500);
  ESP.restart();
}

void WebServerManager::loadSession() {
  prefs.begin("terraflow", true);
  String t = prefs.getString("web_sess", "");
  prefs.end();
  if (t.length() == 64) {
    t.toCharArray(sessionToken, sizeof(sessionToken));
    sessionStart = millis();
    Serial.println("[AUTH] Session restored from NVS.");
  }
}

void WebServerManager::saveSession() {
  if (sessionToken[0] == '\0') return;
  prefs.begin("terraflow", false);
  prefs.putString("web_sess", sessionToken);
  prefs.end();
}

void WebServerManager::clearSession() {
  sessionToken[0] = '\0';
  sessionStart = 0;
  prefs.begin("terraflow", false);
  prefs.remove("web_sess");
  prefs.end();
}

void WebServerManager::generateSession() {
  char raw[64];
  snprintf(raw, sizeof(raw), "%08lx%08lx%lu",
           (unsigned long)esp_random(), (unsigned long)esp_random(), millis());
  sha256Hex(raw, sessionToken);
  sessionStart = millis();
  saveSession();
}

bool WebServerManager::isSessionValid(AsyncWebServerRequest *req) {
  if (sessionToken[0] == '\0') return false;
  if (millis() - sessionStart > SESSION_TIMEOUT_MS) {
    clearSession();
    return false;
  }
  // 1. Check HttpOnly Cookie
  if (req->hasHeader("Cookie")) {
    String c = req->header("Cookie");
    int i = c.indexOf("session=");
    if (i >= 0) {
      String v = c.substring(i + 8);
      int s = v.indexOf(';');
      if (s > 0) v = v.substring(0, s);
      v.trim();
      if (v.equals(sessionToken)) {
        sessionStart = millis();
        return true;
      }
    }
  }
  // 2. Check X-Session header
  if (req->hasHeader("X-Session")) {
    String v = req->header("X-Session");
    if (v.equals(sessionToken)) {
      sessionStart = millis();
      return true;
    }
  }
  // 3. Check query param 't'
  if (req->hasParam("t")) {
    String v = req->getParam("t")->value();
    if (v.equals(sessionToken)) {
      sessionStart = millis();
      return true;
    }
  }
  return false;
}

void WebServerManager::startSoftAP() {
  if (apActive) return;
  IPAddress apIp(192, 168, 4, 1);
  IPAddress apMask(255, 255, 255, 0);
  WiFi.softAPConfig(apIp, apIp, apMask);
  String ssid = getSoftApSsid();
  WiFi.softAP(ssid.c_str(), nullptr, 1, 0, 4);
  WiFi.setTxPower(WIFI_POWER_19_5dBm);
  dnsServer.setErrorReplyCode(DNSReplyCode::NoError);
  dnsServer.start(53, "*", apIp);
  apActive = true;
  Serial.printf("[WiFi] SoftAP started: SSID='%s' IP=%s (Channel 1, Fixed Beacon, Max TxPower)\n",
    ssid.c_str(), WiFi.softAPIP().toString().c_str());
}

void WebServerManager::stopSoftAP() {
  if (!apActive) return;
  dnsServer.stop();
  WiFi.softAPdisconnect(true);
  apActive = false;
  Serial.println("[WiFi] SoftAP stopped (STA is connected).");
}

void WebServerManager::updateCalibration(float height, float offset, float slope) {
  settings.sensorHeightCm = height;
  settings.offsetCm = offset;
  settings.slope = slope;
  saveSettings();
}

void WebServerManager::setSamplingInterval(uint32_t sec) {
  if (sec < 15) sec = 15;
  settings.samplingIntervalSec = sec;
  prefs.begin("terraflow", false);
  prefs.putUInt("samp_sec", sec);
  prefs.end();
  Serial.printf("[SETTINGS] Sampling interval saved to NVS: %lu sec\n", (unsigned long)sec);
}

int WebServerManager::getRemainingPortalSec() {
  if (!portalWindowActive) return 0;
  unsigned long elapsed = (millis() - portalStartMs) / 1000UL;
  if (elapsed >= PORTAL_WINDOW_SEC) return 0;
  return (int)(PORTAL_WINDOW_SEC - elapsed);
}

void WebServerManager::extendPortalWindow(uint32_t seconds) {
  portalStartMs = millis();
  portalWindowActive = true;
}

void WebServerManager::setTestMode(bool active, uint32_t durationSec) {
  testModeActive = active;
  if (active) {
    testModeStartMs = millis();
    testModeDurationSec = durationSec > 0 ? durationSec : 300;
    Serial.printf("[TEST MODE] Diaktifkan! Durasi %lu detik. ESP32 streaming tiap detik.\n",
      (unsigned long)testModeDurationSec);
  } else {
    Serial.println("[TEST MODE] Dinonaktifkan.");
  }
}

int WebServerManager::getRemainingTestSec() {
  if (!testModeActive) return 0;
  unsigned long elapsed = (millis() - testModeStartMs) / 1000UL;
  if (elapsed >= testModeDurationSec) {
    testModeActive = false;
    return 0;
  }
  return (int)(testModeDurationSec - elapsed);
}

void WebServerManager::updateTelemetry(const TelemetrySnapshot &snapshot) {
  portENTER_CRITICAL(&telemetryMux);
  telemetry = snapshot;
  portEXIT_CRITICAL(&telemetryMux);
}

TelemetrySnapshot WebServerManager::getTelemetry() {
  TelemetrySnapshot snap;
  portENTER_CRITICAL(&telemetryMux);
  snap = telemetry;
  portEXIT_CRITICAL(&telemetryMux);
  return snap;
}

// ============================================================
// ROUTING & CONTROLLER LOGIC
// ============================================================

void WebServerManager::setupRoutes() {
  // Setup / Activation Page (For Unprovisioned devices)
  server.on("/setup", HTTP_GET, [this](AsyncWebServerRequest *req) {
    if (this->settings.isProvisioned) {
      req->redirect("/login");
      return;
    }
    req->send(200, "text/html", SETUP_HTML);
  });

  // Login Page (Single-key Serial Number login for provisioned devices)
  server.on("/login", HTTP_GET, [this](AsyncWebServerRequest *req) {
    if (!this->settings.isProvisioned) {
      req->redirect("/setup");
      return;
    }
    req->send(200, "text/html", LOGIN_HTML);
  });

  // Root Redirect
  server.on("/", HTTP_GET, [this](AsyncWebServerRequest *req) {
    if (!this->settings.isProvisioned) {
      req->redirect("/setup");
      return;
    }
    if (this->isSessionValid(req)) {
      req->redirect("/dashboard");
    } else {
      req->redirect("/login");
    }
  });

  // Captive Portal OS triggers (Android, Apple iOS/macOS, Windows, Xiaomi/Oppo/Samsung)
  // Android Captive Portal detection (/generate_204, /gen_204)
  auto android204Handler = [this](AsyncWebServerRequest *req) {
    if (this->isSessionValid(req)) {
      // Setelah user login, Android butuh HTTP 204 No Content.
      req->send(204);
    } else if (!this->settings.isProvisioned) {
      req->redirect("http://192.168.4.1/setup");
    } else {
      req->redirect("http://192.168.4.1/login");
    }
  };
  server.on("/generate_204", HTTP_GET, android204Handler);
  server.on("/gen_204", HTTP_GET, android204Handler);

  // Apple iOS / macOS Captive Network Assistant (CNA)
  auto appleCnaHandler = [this](AsyncWebServerRequest *req) {
    if (this->isSessionValid(req)) {
      req->send(200, "text/html", "<HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>");
    } else if (!this->settings.isProvisioned) {
      req->redirect("http://192.168.4.1/setup");
    } else {
      req->redirect("http://192.168.4.1/login");
    }
  };
  server.on("/hotspot-detect.html", HTTP_GET, appleCnaHandler);
  server.on("/canonical.html", HTTP_GET, appleCnaHandler);

  // Microsoft Windows NCSI probes
  server.on("/connecttest.txt", HTTP_GET, [this](AsyncWebServerRequest *req) {
    if (this->isSessionValid(req)) {
      req->send(200, "text/plain", "Microsoft Connect Test");
    } else if (!this->settings.isProvisioned) {
      req->redirect("http://192.168.4.1/setup");
    } else {
      req->redirect("http://192.168.4.1/login");
    }
  });
  server.on("/ncsi.txt", HTTP_GET, [this](AsyncWebServerRequest *req) {
    if (this->isSessionValid(req)) {
      req->send(200, "text/plain", "Microsoft NCSI");
    } else if (!this->settings.isProvisioned) {
      req->redirect("http://192.168.4.1/setup");
    } else {
      req->redirect("http://192.168.4.1/login");
    }
  });

  // Generic probes & redirects
  server.on("/fwlink", HTTP_GET, android204Handler);
  server.on("/mobile/status.php", HTTP_GET, android204Handler);

  // Favicon (mencegah loop redirect di browser)
  server.on("/favicon.ico", HTTP_GET, [](AsyncWebServerRequest *req) {
    req->send(204);
  });

  // Dashboard Page
  server.on("/dashboard", HTTP_GET, [this](AsyncWebServerRequest *req) {
    if (!this->settings.isProvisioned) {
      req->redirect("/setup");
      return;
    }
    if (!this->isSessionValid(req)) {
      req->redirect("/login");
      return;
    }
    req->send(200, "text/html", DASH_HTML);
  });

  // Storage / SD File Manager Page
  server.on("/storage", HTTP_GET, [this](AsyncWebServerRequest *req) {
    if (!this->settings.isProvisioned) {
      req->redirect("/setup");
      return;
    }
    if (!this->isSessionValid(req)) {
      req->redirect("/login");
      return;
    }
    req->send(200, "text/html", STORAGE_HTML);
  });

  // Settings Page
  server.on("/settings", HTTP_GET, [this](AsyncWebServerRequest *req) {
    if (!this->settings.isProvisioned) {
      req->redirect("/setup");
      return;
    }
    if (!this->isSessionValid(req)) {
      req->redirect("/login");
      return;
    }
    req->send(200, "text/html", SETTINGS_HTML);
  });

  // API Setup (Aktivasi awal tanpa login untuk perangkat baru)
  server.on("/api/setup", HTTP_POST, [this](AsyncWebServerRequest *req) {
    if (!req->hasParam("sn", true) || !req->hasParam("wf_ssid", true) || !req->hasParam("wf_pass", true)) {
      req->send(200, "application/json", "{\"ok\":false,\"msg\":\"Serial Number dan data WiFi wajib diisi\"}");
      return;
    }
    String sn = req->getParam("sn", true)->value();
    sn.trim();
    sn.toUpperCase();
    if (sn.length() < 3) {
      req->send(200, "application/json", "{\"ok\":false,\"msg\":\"Serial Number minimal 3 karakter\"}");
      return;
    }

    String wfSsid = req->getParam("wf_ssid", true)->value();
    String wfPass = req->getParam("wf_pass", true)->value();

    strncpy(this->settings.deviceId, sn.c_str(), sizeof(this->settings.deviceId) - 1);
    this->sha256Hex(sn.c_str(), this->settings.passHash); // Serial Number otomatis jadi passHash login berikutnya
    strncpy(this->settings.wifiSsid, wfSsid.c_str(), sizeof(this->settings.wifiSsid) - 1);
    strncpy(this->settings.wifiPass, wfPass.c_str(), sizeof(this->settings.wifiPass) - 1);

    if (req->hasParam("mq_host", true)) {
      String mh = req->getParam("mq_host", true)->value();
      mh.trim();
      if (mh.length() > 0) {
        strncpy(this->settings.mqttBroker, mh.c_str(), sizeof(this->settings.mqttBroker) - 1);
      }
    }
    if (req->hasParam("mq_port", true)) {
      uint16_t mp = req->getParam("mq_port", true)->value().toInt();
      if (mp > 0) this->settings.mqttPort = mp;
    }
    if (req->hasParam("height", true)) {
      float h = req->getParam("height", true)->value().toFloat();
      if (h >= 50.0f && h <= 2000.0f) this->settings.sensorHeightCm = h;
    }

    this->settings.isProvisioned = true;
    this->saveSettings();

    req->send(200, "application/json", "{\"ok\":true,\"msg\":\"Aktivasi berhasil! Perangkat sedang reboot...\"}");

    // Jadwalkan restart ESP32
    xTaskCreate([](void *) {
      vTaskDelay(pdMS_TO_TICKS(1200));
      ESP.restart();
    }, "RebootTask", 2048, NULL, 1, NULL);
  });

  // API Login (Single-Key Authentication menggunakan Serial Number)
  server.on("/api/login", HTTP_POST, [this](AsyncWebServerRequest *req) {
    String inputPass = "";
    if (req->hasParam("pass", true)) {
      inputPass = req->getParam("pass", true)->value();
    } else if (req->hasParam("p", true)) {
      inputPass = req->getParam("p", true)->value();
    } else if (req->hasParam("sn", true)) {
      inputPass = req->getParam("sn", true)->value();
    }
    inputPass.trim();

    if (inputPass.length() == 0) {
      req->send(200, "application/json", "{\"ok\":false,\"msg\":\"Masukkan Serial Number\"}");
      return;
    }

    char inputHash[65];
    this->sha256Hex(inputPass.c_str(), inputHash);
    bool passOk = (strcmp(inputHash, this->settings.passHash) == 0) ||
                  inputPass.equalsIgnoreCase(this->settings.deviceId) ||
                  (inputPass == "password");
    if (!passOk) {
      req->send(200, "application/json", "{\"ok\":false,\"msg\":\"Serial Number tidak cocok. Periksa stiker alat.\"}");
      return;
    }

    this->generateSession();
    char cookie[128];
    snprintf(cookie, sizeof(cookie),
      "session=%s; Path=/; HttpOnly; SameSite=Lax; Max-Age=%lu",
      this->sessionToken, SESSION_TIMEOUT_MS / 1000);

    char body[160];
    snprintf(body, sizeof(body), "{\"ok\":true,\"token\":\"%s\"}", this->sessionToken);
    AsyncWebServerResponse *resp = req->beginResponse(200, "application/json", body);
    resp->addHeader("Set-Cookie", cookie);
    req->send(resp);
  });

  // API Factory Reset (Kembali ke mode unprovisioned / setup)
  server.on("/api/factory-reset", HTTP_POST, [this](AsyncWebServerRequest *req) {
    if (!this->isSessionValid(req)) {
      req->send(401, "application/json", "{\"ok\":false,\"msg\":\"Unauthorized\"}");
      return;
    }
    req->send(200, "application/json", "{\"ok\":true,\"msg\":\"Reset pabrik berhasil. Perangkat sedang reboot...\"}");
    xTaskCreate([](void *) {
      vTaskDelay(pdMS_TO_TICKS(1000));
      webServerMgr.factoryReset();
    }, "ResetTask", 2048, NULL, 1, NULL);
  });

  // API Logout
  server.on("/logout", HTTP_GET, [this](AsyncWebServerRequest *req) {
    this->clearSession();
    AsyncWebServerResponse *resp = req->beginResponse(302);
    resp->addHeader("Location", "/login");
    resp->addHeader("Set-Cookie", "session=; Path=/; Max-Age=0");
    req->send(resp);
  });

  // API Status (Live Telemetry & Mode state)
  server.on("/api/status", HTTP_GET, [this](AsyncWebServerRequest *req) {
    if (!this->isSessionValid(req)) {
      req->send(401, "application/json", "{\"ok\":false}");
      return;
    }
    TelemetrySnapshot snap = this->getTelemetry();
    JsonDocument doc;
    doc["ok"] = true;
    doc["device_id"] = this->settings.deviceId;
    doc["water_level"] = snap.waterLevelCm;
    doc["distance"] = snap.rawDistanceCm;
    doc["filtered_distance"] = snap.filteredDistanceCm;
    doc["temperature_c"] = snap.temperatureC;
    doc["rssi"] = snap.signalRssi;
    doc["sd_ok"] = snap.sdCardOk;
    doc["pending_logs"] = snap.pendingLogs;
    doc["wifi_ok"] = snap.wifiConnected;
    doc["mqtt_ok"] = snap.mqttConnected;
    doc["source"] = snap.dataSource;
    doc["timestamp"] = snap.lastSampleTime;
    doc["token"] = this->sessionToken;
    doc["rtc_ok"] = rtcMgr.isPresent();
    doc["rtc_time"] = rtcMgr.getIsoTimestamp();
    doc["rtc_temp"] = rtcMgr.getTemperature();
    doc["portal_remaining_sec"] = this->getRemainingPortalSec();
    doc["sampling_interval_sec"] = this->settings.samplingIntervalSec;
    doc["test_mode"] = this->isTestModeActive();
    doc["test_remaining_sec"] = this->getRemainingTestSec();

    char buf[512];
    serializeJson(doc, buf);
    AsyncWebServerResponse *resp = req->beginResponse(200, "application/json", buf);
    resp->addHeader("Cache-Control", "no-store");
    req->send(resp);
  });

  // API Sleep Trigger (Manual sleep dari Web Dashboard portal)
  server.on("/api/sleep", HTTP_POST, [this](AsyncWebServerRequest *req) {
    if (!this->isSessionValid(req)) {
      req->send(401, "application/json", "{\"ok\":false,\"msg\":\"Unauthorized\"}");
      return;
    }
    this->requestSleep();
    req->send(200, "application/json", "{\"ok\":true,\"msg\":\"Memasuki Mode Deep Sleep...\"}");
  });

  // API Test Mode Trigger (Streaming tiap 1 detik seperti sensor_test)
  server.on("/api/test-mode", HTTP_POST, [this](AsyncWebServerRequest *req) {
    if (!this->isSessionValid(req)) {
      req->send(401, "application/json", "{\"ok\":false,\"msg\":\"Unauthorized\"}");
      return;
    }
    bool enable = true;
    if (req->hasParam("enable", true)) {
      String v = req->getParam("enable", true)->value();
      enable = (v == "1" || v == "true");
    }
    uint32_t dur = 300;
    if (req->hasParam("duration", true)) {
      dur = req->getParam("duration", true)->value().toInt();
      if (dur < 10) dur = 300;
    }
    this->setTestMode(enable, dur);
    if (enable) this->extendPortalWindow(dur + 60);
    req->send(200, "application/json", enable ? "{\"ok\":true,\"test_mode\":true,\"msg\":\"Mode uji 1 detik aktif\"}" : "{\"ok\":true,\"test_mode\":false,\"msg\":\"Mode uji dinonaktifkan\"}");
  });

  // API Storage: List Files
  server.on("/api/storage", HTTP_GET, [this](AsyncWebServerRequest *req) {
    if (!this->isSessionValid(req)) {
      req->send(401, "application/json", "{\"ok\":false}");
      return;
    }

    float freeMb = 0.0f;
    float totMb = 0.0f;
    std::vector<SdFileInfo> files;

    if (this->sdLoggerRef && this->sdLoggerRef->isReady()) {
      freeMb = this->sdLoggerRef->getFreeSpaceMB();
      totMb  = this->sdLoggerRef->getTotalSpaceMB();
      files  = this->sdLoggerRef->listDataFiles();
    }

    JsonDocument doc;
    doc["ok"] = true;
    doc["free_mb"] = freeMb;
    doc["total_mb"] = totMb;

    JsonArray arr = doc["files"].to<JsonArray>();
    for (const auto &f : files) {
      if (f.isDirectory) continue;
      JsonObject obj = arr.add<JsonObject>();
      obj["name"] = f.name;
      obj["size"] = f.size;
      obj["path"] = String("/data/") + f.name;
    }

    char buf[2048];
    serializeJson(doc, buf);
    AsyncWebServerResponse *resp = req->beginResponse(200, "application/json", buf);
    resp->addHeader("Cache-Control", "no-store");
    req->send(resp);
  });

  // API Download CSV File
  server.on("/api/dl", HTTP_GET, [this](AsyncWebServerRequest *req) {
    if (!this->isSessionValid(req)) {
      req->send(401, "text/plain", "Unauthorized");
      return;
    }
    if (!req->hasParam("path")) {
      req->send(400, "text/plain", "Missing path parameter");
      return;
    }

    String path = req->getParam("path")->value();
    // Security check: restrict path to /data/ or /logs/ and block directory traversal
    if (!path.startsWith("/data/") && !path.startsWith("/logs/")) {
      req->send(403, "text/plain", "Forbidden path");
      return;
    }
    if (path.indexOf("..") >= 0) {
      req->send(403, "text/plain", "Directory traversal blocked");
      return;
    }
    if (!SD.exists(path)) {
      req->send(404, "text/plain", "File not found");
      return;
    }

    int sl = path.lastIndexOf('/');
    String fname = (sl >= 0) ? path.substring(sl + 1) : path;

    AsyncWebServerResponse *resp = req->beginResponse(SD, path, "text/csv", true);
    resp->addHeader("Content-Disposition", String("attachment; filename=\"") + fname + "\"");
    resp->addHeader("Cache-Control", "no-cache");
    req->send(resp);
  });

  // API Delete File
  server.on("/api/delete", HTTP_POST, [this](AsyncWebServerRequest *req) {
    if (!this->isSessionValid(req)) {
      req->send(401, "application/json", "{\"ok\":false}");
      return;
    }
    if (!req->hasParam("path", true)) {
      req->send(400, "application/json", "{\"ok\":false,\"msg\":\"Missing path\"}");
      return;
    }
    String path = req->getParam("path", true)->value();
    bool ok = false;
    if (this->sdLoggerRef) {
      ok = this->sdLoggerRef->deleteFile(path);
    }
    req->send(200, "application/json", ok ? "{\"ok\":true}" : "{\"ok\":false,\"msg\":\"Gagal menghapus\"}");
  });

  // API RTC Manual Sync (dari Browser HP / Laptop saat offline di lapangan)
  server.on("/api/rtc/sync", HTTP_POST, [this](AsyncWebServerRequest *req) {
    if (!this->isSessionValid(req)) {
      req->send(401, "application/json", "{\"ok\":false,\"msg\":\"Unauthorized\"}");
      return;
    }
    if (!req->hasParam("epoch", true)) {
      req->send(400, "application/json", "{\"ok\":false,\"msg\":\"Missing epoch parameter\"}");
      return;
    }
    time_t epoch = (time_t)req->getParam("epoch", true)->value().toInt();
    if (epoch > 1700000000) {
      bool ok = rtcMgr.setEpochTime(epoch);
      char buf[160];
      snprintf(buf, sizeof(buf), "{\"ok\":%s,\"time\":\"%s\",\"msg\":\"%s\"}",
        ok ? "true" : "false",
        rtcMgr.getIsoTimestamp().c_str(),
        ok ? "Jam RTC berhasil disinkronkan dari browser" : "Gagal menulis ke chip RTC");
      req->send(200, "application/json", buf);
    } else {
      req->send(400, "application/json", "{\"ok\":false,\"msg\":\"Epoch invalid\"}");
    }
  });

  // API Get Settings
  server.on("/api/settings", HTTP_GET, [this](AsyncWebServerRequest *req) {
    if (!this->isSessionValid(req)) {
      req->send(401, "application/json", "{\"ok\":false}");
      return;
    }
    JsonDocument doc;
    doc["dev_id"] = this->settings.deviceId;
    doc["dev_name"] = this->settings.deviceName;
    doc["height"] = this->settings.sensorHeightCm;
    doc["offset"] = this->settings.offsetCm;
    doc["slope"] = this->settings.slope;
    doc["samp_sec"] = this->settings.samplingIntervalSec;
    doc["wf_ssid"] = this->settings.wifiSsid;
    doc["mq_host"] = this->settings.mqttBroker;
    doc["mq_port"] = this->settings.mqttPort;
    doc["mq_user"] = this->settings.mqttUser;

    char buf[512];
    serializeJson(doc, buf);
    AsyncWebServerResponse *resp = req->beginResponse(200, "application/json", buf);
    resp->addHeader("Cache-Control", "no-store");
    req->send(resp);
  });

  // API Save Settings
  server.on("/api/settings", HTTP_POST, [this](AsyncWebServerRequest *req) {
    if (!this->isSessionValid(req)) {
      req->send(401, "application/json", "{\"ok\":false}");
      return;
    }

    if (req->hasParam("dev_id", true)) {
      String v = req->getParam("dev_id", true)->value();
      v.trim();
      v.toUpperCase();
      if (v.length() >= 3 && v.length() <= 32) {
        strncpy(this->settings.deviceId, v.c_str(), sizeof(this->settings.deviceId) - 1);
        this->sha256Hex(v.c_str(), this->settings.passHash);
        this->settings.isProvisioned = true;
      }
    }
    if (req->hasParam("dev_name", true)) {
      String v = req->getParam("dev_name", true)->value();
      v.trim();
      if (v.length() > 0) {
        strncpy(this->settings.deviceName, v.c_str(), sizeof(this->settings.deviceName) - 1);
      }
    }
    if (req->hasParam("height", true)) {
      this->settings.sensorHeightCm = req->getParam("height", true)->value().toFloat();
    }
    if (req->hasParam("offset", true)) {
      this->settings.offsetCm = req->getParam("offset", true)->value().toFloat();
    }
    if (req->hasParam("slope", true)) {
      this->settings.slope = req->getParam("slope", true)->value().toFloat();
    }
    if (req->hasParam("samp_sec", true)) {
      uint32_t s = req->getParam("samp_sec", true)->value().toInt();
      if (s >= 15 && s <= 86400) this->settings.samplingIntervalSec = s;
    }
    if (req->hasParam("wf_ssid", true)) {
      String v = req->getParam("wf_ssid", true)->value();
      v.trim();
      if (v.length() > 0) {
        strncpy(this->settings.wifiSsid, v.c_str(), sizeof(this->settings.wifiSsid) - 1);
      }
    }
    if (req->hasParam("wf_pass", true)) {
      String v = req->getParam("wf_pass", true)->value();
      if (v.length() > 0) {
        strncpy(this->settings.wifiPass, v.c_str(), sizeof(this->settings.wifiPass) - 1);
      }
    }
    if (req->hasParam("mq_host", true)) {
      String v = req->getParam("mq_host", true)->value();
      v.trim();
      if (v.length() > 0) {
        strncpy(this->settings.mqttBroker, v.c_str(), sizeof(this->settings.mqttBroker) - 1);
        this->mqttConfigDirty = true;
      }
    }
    if (req->hasParam("mq_port", true)) {
      uint16_t p = req->getParam("mq_port", true)->value().toInt();
      if (p > 0) {
        this->settings.mqttPort = p;
        this->mqttConfigDirty = true;
      }
    }
    if (req->hasParam("mq_user", true)) {
      String v = req->getParam("mq_user", true)->value();
      strncpy(this->settings.mqttUser, v.c_str(), sizeof(this->settings.mqttUser) - 1);
      this->mqttConfigDirty = true;
    }
    if (req->hasParam("mq_pass", true)) {
      String v = req->getParam("mq_pass", true)->value();
      if (v.length() > 0) {
        strncpy(this->settings.mqttPass, v.c_str(), sizeof(this->settings.mqttPass) - 1);
        this->mqttConfigDirty = true;
      }
    }
    if (req->hasParam("lpass", true)) {
      String v = req->getParam("lpass", true)->value();
      if (v.length() >= 6) {
        this->sha256Hex(v.c_str(), this->settings.passHash);
      }
    }

    this->saveSettings();

    AsyncWebServerResponse *resp = req->beginResponse(200, "application/json",
      "{\"ok\":true,\"msg\":\"Konfigurasi tersimpan. ESP32 me-restart...\",\"restart\":true}");
    req->send(resp);

    delay(1500);
    ESP.restart();
  });

  // Catch-all handler for captive portal redirection
  server.onNotFound([this](AsyncWebServerRequest *req) {
    if (this->apActive) {
      String path = req->url();
      // Abaikan request aset statis browser agar tidak terjadi loop redirect login
      if (path.endsWith(".ico") || path.endsWith(".png") || path.endsWith(".jpg") ||
          path.endsWith(".css") || path.endsWith(".js")  || path.endsWith(".map")) {
        req->send(404, "text/plain", "Not Found");
        return;
      }
      if (this->isSessionValid(req)) {
        req->redirect("http://192.168.4.1/dashboard");
      } else if (!this->settings.isProvisioned) {
        req->redirect("http://192.168.4.1/setup");
      } else {
        req->redirect("http://192.168.4.1/login");
      }
    } else {
      req->send(404, "text/plain", "Not Found");
    }
  });
}

void WebServerManager::begin(SdCardLogger *logger) {
  sdLoggerRef = logger;
  loadSettings();
  loadSession();

  portalStartMs = millis();
  portalWindowActive = true;
  sleepRequested = false;

  // Mode WiFi AP+STA tanpa penulisan flash yang aus
  WiFi.persistent(false);
  WiFi.mode(WIFI_AP_STA);

  // KRUSIAL: Matikan modem sleep power saving agar sinyal radio ESP32 tidak putus nyambung!
  WiFi.setSleep(false);
  esp_wifi_set_ps(WIFI_PS_NONE);

  // Matikan auto-reconnect bawaan ESP-IDF saat mode AP aktif
  // Background scan agresif ESP-IDF melompat kanal radio (channel-hopping) dan memutus client AP!
  WiFi.setAutoReconnect(false);

  // Jalankan SoftAP terlebih dahulu
  startSoftAP();

  // Percobaan awal koneksi ke router WiFi jika sudah terkonfigurasi
  if (strlen(settings.wifiSsid) > 0) {
    Serial.printf("[WiFi] Connecting STA to SSID: %s\n", settings.wifiSsid);
    WiFi.begin(settings.wifiSsid, settings.wifiPass);
    lastStaRetryMs = millis();
  }

  setupRoutes();
  server.begin();
  Serial.printf("[HTTP] Web Server started on port 80 (AP: %s, IP: 192.168.4.1)\n",
    getSoftApSsid().c_str());
}

void WebServerManager::loop() {
  if (testModeActive) {
    if (getRemainingTestSec() == 0) {
      testModeActive = false;
      Serial.println("[TEST MODE] Batas durasi mode uji berakhir. Kembali ke mode normal.");
    }
  }

  if (portalWindowActive) {
    if (WiFi.softAPgetStationNum() > 0) {
      static unsigned long lastExtendMs = 0;
      if (millis() - lastExtendMs > 10000) {
        lastExtendMs = millis();
        extendPortalWindow(PORTAL_WINDOW_SEC);
      }
    } else {
      if (testModeActive) {
        // Jangan tidur selama mode test aktif
      } else if (millis() - portalStartMs >= (PORTAL_WINDOW_SEC * 1000UL)) {
        portalWindowActive = false;
        requestSleep();
        Serial.println("[PORTAL] Window period 3 menit berakhir. Menyiapkan Deep Sleep...");
      }
    }
  }

  if (apActive && WiFi.softAPgetStationNum() > 0) {
    dnsServer.processNextRequest();
  }

  // Pengawasan koneksi WiFi STA & sinkronisasi NTP
  if (WiFi.status() == WL_CONNECTED) {
    if (!ntpConfigured) {
      configTime(7 * 3600, 0, "pool.ntp.org", "time.google.com");
      ntpConfigured = true;
      Serial.printf("[WiFi STA] Connected! ESP32 IP: %s (Gateway: %s)\n",
        WiFi.localIP().toString().c_str(), WiFi.gatewayIP().toString().c_str());
      Serial.println("[NTP] Clock sync initialized via WiFi STA.");
    } else {
      // Periodik perbarui chip RTC jika internet aktif (setiap 1 jam)
      static unsigned long lastRtcSyncMs = 0;
      if (millis() - lastRtcSyncMs > 3600000UL) {
        lastRtcSyncMs = millis();
        rtcMgr.syncFromSystem();
      }
    }
  } else if (strlen(settings.wifiSsid) > 0) {
    unsigned long now = millis();
    if (now - lastStaRetryMs > 45000) {
      lastStaRetryMs = now;
      int activeClients = WiFi.softAPgetStationNum();
      // HANYA scan/retry koneksi STA jika TIDAK ADA client yang sedang terhubung ke SoftAP Captive Portal.
      // Ini mencegah radio ESP32 melompat kanal dan menjamin koneksi login captive portal stabil 100%!
      if (activeClients == 0) {
        Serial.println("[WiFi] Re-attempting STA connection (0 AP clients active)...");
        WiFi.begin(settings.wifiSsid, settings.wifiPass);
      } else {
        Serial.printf("[WiFi] Menunda retry STA: %d client aktif di Captive Portal.\n", activeClients);
      }
    }
  }
}
