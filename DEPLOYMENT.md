# TerraFlow AWLR — Deployment Documentation

Deployment VPS ini dibuat otomatis. Dokumentasi ini merangkum konfigurasi,
kredensial, langkah operasional, dan hal yang masih perlu dituntaskan manual.

---

## 1. Arsitektur

```
Internet
   │
   │  :22   SSH
   │  :80   HTTP + MQTT  (dialihkan TCP multiplexer)
   │  :443  HTTPS        (Nginx langsung; aktif setelah 443 dibuka)
   ▼
┌───────────────────────────────────────────────────────┐
│ TCP Multiplexer  (terraflow-mux.service)              │
│  :80 → klasifikasi 4 byte pertama:                    │
│    • metode HTTP  → Nginx  127.0.0.1:8080 (+ PROXY)  │
│    • biner (MQTT)  → Broker 127.0.0.1:1883            │
│  /opt/terraflow/stream-mux.js                         │
└───────────────────────────────────────────────────────┘
   │                          │
   ▼                          ▼
┌──────────────────────┐  ┌───────────────────────────┐
│ Nginx  (HTTP/HTTPS)  │  │ Aedes MQTT Broker         │
│  :8080 internal      │  │  127.0.0.1:1883           │
│  :443 public (TLS)   │  │  + autentikasi user/pass  │
│  • static SPA        │  └───────────────────────────┘
│  • proxy /api        │               ▲
│  • proxy /socket.io  │               │ mqtt (user/pass)
└──────────────────────┘               │
   │                                   │
   ▼                                   │
┌───────────────────────────────────────────────────────┐
│ Backend Node.js  (terraflow.service)                  │
│  Express REST + Socket.IO + Aedes MQTT Broker         │
│  user: terraflow   bind: 127.0.0.1:5000               │
└───────────────────────────────────────────────────────┘
   │  127.0.0.1:5432  (TCP, scram-sha-256)
   ▼
┌───────────────────────────────────────────────────────┐
│ PostgreSQL 18  (db: teraflowid)                       │
│  readings = RANGE partitioned by timestamp             │
└───────────────────────────────────────────────────────┘
```

**Lokasi aplikasi:** `/var/www/terraflow` (backend + frontend + firmware)

### Mengapa ada TCP multiplexer?

Security Group Tencent Cloud pada VPS ini hanya meneruskan **port 22 dan 80**.
Port 443 dan 1883 diblokir di sisi cloud, sehingga:

- HTTPS tidak dapat diakses dari luar (sertifikat tetap terpasang & siap)
- ESP32 di lapangan tidak dapat connect ke broker MQTT di port 1883

Modul `preread` milik Nginx tidak tersedia di paket distro Ubuntu, sehingga
deteksi protokol HTTP-vs-MQTT dilakukan di level aplikasi oleh
`/opt/terraflow/stream-mux.js` (Node.js). Broker Aedes dilayani **tanpa**
PROXY protocol (Aedes tidak memahforkannya), sedangkan HTTP memakai PROXY
protocol v1 agar Nginx tetap mengetahui IP asli klien.

---

## 2. Akses

| Layanan | URL | Catatan |
|---|---|---|
| Dashboard | `http://43.134.53.192` | Aktif & terverifikasi |
| Dashboard (TLS) | `https://43.134.53.192` | Terpasang; butuh port 443 dibuka di Security Group |
| Health check | `http://43.134.53.192/health` | JSON status + koneksi DB |
| MQTT broker | `mqtt://43.134.53.192:80` | **Port 80** (bukan 1883) |
| MQTT broker (internal) | `mqtt://127.0.0.1:1883` | Dipakai backend & multiplexer |

### Kredensial MQTT

| Item | Nilai |
|---|---|
| Username | `terraflow` |
| Password | `/root/.terraflow_mqtt` (root-only, chmod 600) |

Broker **menolak** koneksi tanpa kredensial maupun dengan kredensial salah.
Tersimpan juga di `firmware/src/config.h` (bisa diubah lewat portal lokal
perangkat `/settings` → `mq_host`, `mq_port`, `mq_user`, `mq_pass`).

### Kredensial default aplikasi (seed)

| Username | Password | Role |
|---|---|---|
| `admin` | `Terraflow2024!` | admin |
| `operator` | `Operator2024!` | operator |

> **Segera ganti password ini** setelah login pertama (menu Manajemen Pengguna),
> dan ganti juga password database PostgreSQL (lihat §7.3).

---

## 3. Struktur Direktori

```
/var/www/terraflow/
├── backend/                 # Express + Socket.IO + MQTT broker
│   ├── .env                 # konfigurasi (chmod 600, owner: terraflow)
│   ├── .jwt_secret          # secret JWT (chmod 600, dibuat otomatis)
│   ├── node_modules/
│   └── src/db/migrations/   # 001..005 (005 = tambahan lokal, lihat §8)
├── frontend/
│   ├── dist/                # hasil build Vite — served oleh Nginx
│   └── node_modules/
├── firmware/                # source ESP32 (tidak di-build di server)
├── deploy.sh                # script update deployment
└── DEPLOYMENT.md            # dokumen ini

/opt/terraflow/
└── stream-mux.js            # TCP multiplexer HTTP+MQTT (port 80)

/etc/nginx/
├── nginx.conf                          # + blok stream dihapus (tidak dipakai)
├── sites-available/terraflow           # server :8080 (internal) & :443 (TLS)
├── snippets/terraflow-locations.conf   # konfigurasi HTTP bersama
└── snippets/terraflow-force-https.conf # toggle redirect HTTPS
```

---

## 4. Service & Perintah Operasional

```bash
# Status
systemctl status terraflow terraflow-mux nginx postgresql

# Log
journalctl -u terraflow -f          # backend + broker MQTT
journalctl -u terraflow-mux -f      # multiplexer
tail -f /var/log/nginx/terraflow.access.log
tail -f /var/log/nginx/terraflow.error.log

# Restart
systemctl restart terraflow
systemctl restart terraflow-mux
systemctl reload nginx

# Update aplikasi (git pull + build + migrate + restart)
sudo /var/www/terraflow/deploy.sh
```

### Firewall (ufw) — sudah aktif

| Port | Service |
|---|---|
| 22/tcp | SSH |
| 80/tcp | HTTP + MQTT (multiplexer) |
| 443/tcp | HTTPS (menunggu Security Group) |
| 1883/tcp | MQTT langsung (menunggu Security Group) |

```bash
ufw status verbose
```

---

## 5. TLS / Let's Encrypt

Sertifikat untuk **IP address** dengan profil `shortlived` (masa berlaku 6 hari).

```
Sertifikat : /etc/letsencrypt/live/43.134.53.192/fullchain.pem
Private key: /etc/letsencrypt/live/43.134.53.192/privkey.pem
Issuer     : Let's Encrypt (CN=YE1), SAN = IP:43.134.53.192
Exp        : 6 hari (rotasi otomatis)
```

- Renewal otomatis oleh `snap.certbot.renew.timer` (2× sehari).
- Hook `systemctl reload nginx` dijalankan setelah renewal sukses
  (disimpan sebagai `renew_hook` di renewal conf — certbot 5.x membaca
  `renew_hook` sebagai `deploy_hook`).
- Tantangan HTTP-01 dilayani dari `/var/www/certbot`, melalui jalur
  mux → Nginx (port 80 tetap HTTP, **tidak** dialihkan ke HTTPS).

```bash
certbot certificates
certbot renew --dry-run          # uji renewal
```

> Sertifikat hanya valid untuk IP publik `43.134.53.192`. Browser yang
> mengakses via `10.3.0.9` (IP privat) akan melihat sertifikat tidak cocok.

---

## 6. PostgreSQL

```bash
sudo -u postgres psql -d teraflowid     # masuk psql sebagai superuser
sudo -u postgres psql -d teraflowid -c "\dt"
```

| Item | Nilai |
|---|---|
| Database | `teraflowid` |
| Role aplikasi | `terraflow` (bukan superuser) |
| Password | `/root/.terraflow_dbpass` (root-only, chmod 600) |
| Listen | `127.0.0.1:5432` (tidak publik) |
| Auth | `scram-sha-256` via TCP |
| Timezone | `Asia/Jakarta` (WIB) |

Tabel: `devices`, `readings` (partitioned: `readings_2026_10`, `readings_2026_11`,
`readings_default`), `calibrations`, `device_alerts`, `device_diagnostics`,
`alert_rules`, `users`, `password_resets`.

### Zona waktu

Server **dan** PostgreSQL disetel ke `Asia/Jakarta` (WIB, UTC+7) agar sesuai
dengan perangkat, yang memakai `setenv("TZ", "WIB-7", 1)` di firmware. Kolom
`TIMESTAMPTZ` tetap menyimpan instants absolut, jadi tidak ada data yang bergeser
saat zona waktu diubah.

```bash
timedatectl set-timezone Asia/Jakarta
# PostgreSQL punya setelannya sendiri:
sed -i "s/^timezone = '.*'/timezone = 'Asia\/Jakarta'/" /etc/postgresql/18/main/postgresql.conf
sed -i "s/^log_timezone = '.*'/log_timezone = 'Asia\/Jakarta'/" /etc/postgresql/18/main/postgresql.conf
systemctl restart postgresql
```

Seluruh jalur penerimaan data (MQTT live, MQTT bulk sync, HTTP
`offline-sync`/`offline-batch`) memakai parser terpusat di
`backend/src/utils/timestamp.js`:

1. Field `timestamp` (epoch) adalah sumber utama — unambiguous.
2. Fallback `date` + `hour` + `minute` diinterpretasi eksplisit sebagai WIB
   (`+07:00`), **bukan** waktu lokal server. Sebelumnya fallback ini memakai
   waktu lokal server sehingga data meleset 1 jam bila server tidak di WIB.
3. Epoch yang tampak 7 jam di masa depan (indikasi RTC perangkat menyimpan
   waktu lokal) dikoreksi otomatis.

---

## 7. Tasks Yang Masih Perlu Dikerjakan Manual

### 7.1 Buka port di Security Group Tencent Cloud  (WAJIB)

UFW sudah terbuka, tapi **Security Group di konsol Tencent Cloud** hanya
meneruskan port 22 dan 80. Tambahkan:

| Protokol | Port | Sumber | Fungsi |
|---|---|---|---|
| TCP | 443 | `0.0.0.0/0` | HTTPS (sertifikat sudah siap) |
| TCP | 1883 | `0.0.0.0/0` atau IP perangkat AWLR | MQTT langsung (alternatif multiplexer) |

_consoles_ → Cloud Virtual Machine → Instance → Security Groups → Aturan masuk.

Verifikasi dari luar: `nc -zv 43.134.53.192 443`

> Port 1883 bersifat opsional — MQTT sudah bisa diakses lewat port 80.
> Membuka 443 memberi akses HTTPS.

### 7.2 Aktifkan redirect HTTPS (setelah 7.1 selesai)

```bash
echo 'return 301 https://$host$request_uri;' > /etc/nginx/snippets/terraflow-force-https.conf
nginx -t && systemctl reload nginx
```

### 7.3 Ganti password default

1. Login dashboard → Manajemen Pengguna → ganti password `admin` & `operator`.
2. Ganti password role database:
   ```bash
   NEWPASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 28)
   sudo -u postgres psql -c "ALTER ROLE terraflow WITH PASSWORD '$NEWPASS';"
   sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=$NEWPASS|" /var/www/terraflow/backend/.env
   chown terraflow:terraflow /var/www/terraflow/backend/.env && chmod 600 /var/www/terraflow/backend/.env
   systemctl restart terraflow
   ```
3. Ganti password MQTT (kalau diubah, update juga `.env`, `firmware/src/config.h`):
   ```bash
   NEWQ=$(openssl rand -base64 24 | tr -d '/+=' | head -c 28)
   sed -i "s|^MQTT_PASS=.*|MQTT_PASS=$NEWQ|" /var/www/terraflow/backend/.env
   printf 'MQTT_USER=terraflow\nMQTT_PASS=%s\n' "$NEWQ" > /root/.terraflow_mqtt
   systemctl restart terraflow
   ```

### 7.4 Firmware

`firmware/src/config.h` sudah diarahkan ke server ini:

```c
#define MQTT_BROKER  "43.134.53.192"
#define MQTT_PORT    80
```

Kredensial broker ada di `firmware/src/config_secrets.h` (gitignored) — buat di
PC tempat Anda melakukan build:

```bash
cd firmware
./setup-secrets.sh          # atau: --user terraflow --pass "<password>"
pio run -e esp32-s3-devkitc-1 -t upload
```

> `pio run -t upload` **tidak** menghapus NVS. Bila perangkat pernah memakai
> `dev_id` lain, nilai lama masih terbaca. Untuk kondisi factory (kembali ke
> `AWLR-001` dan kredensial default): `pio run -e esp32-s3-devkitc-1 -t erase`
> baru `pio run -e esp32-s3-devkitc-1 -t upload`.

Perangkat juga dapat diubah saat runtime lewat portal lokal `/settings`
(`mq_host`, `mq_port`, `mq_user`, `mq_pass`) tanpa reflashing — perubahan
diterapkan ke koneksi MQTT seketika tanpa restart perangkat.

Portal lokal: SoftAP `TerraFlow-<DEVICE_ID>` (tanpa password), IP `192.168.4.1`,
login password default `password`.

### Sinkronisasi bulk & konfirmasi (ACK)

Data offline di MicroSD hanya ditandai "sudah terkirim" **setelah** server
mengonfirmasi lewat topik `terraflow/{device_id}/data/bulk/ack`. Server mengirim
ACK berisi `status` (`ok` / `partial` / `error`), `records_saved`,
`records_failed`, dan `failed_timestamps` — hanya record yang benar-benar
tersimpan yang ditandai. Bila ACK tidak datang dalam 30 detik, batch dianggap
gagal dan dikirim ulang; record tetap `pending` sehingga tidak ada data yang
hilang diam-diam.

Penandaan "sudah terkirim" disimpan pada **file ledger append-only**
`/data/.sent_<YYYY-MM-DD>` (satu epoch per baris), bukan dengan menulis ulang
kolom `sent` di CSV. Filesystem ESP32 tidak mendukung tulis in-place
(`O_RDWR`), sedangkan rewrite penuh berkas tiap menit akan menguras umur
MicroSD (±176 MB/hari). File ledger ini akan terlihat di portal perangkat pada
daftar file — itu normal, bukan berkas data.

> Kolom `sent` pada kolom terakhir CSV bersifat historis dan tidak lagi
> diperbarui. Yang otoritatif adalah file ledger `.sent_*`.

Backup konfigurasi asli: `firmware/src/config.h.bak`

> **`device_id` harus `AWLR-001`** (atau device_id lain yang terdaftar di tabel
> `devices`). Tabel `readings` tidak punya FK, tetapi `device_diagnostics`,
> `device_alerts`, dan `calibrations` punya FK ke `devices(device_id)` — data
> perangkat yang tidak terdaftar akan gagal disimpan di tabel-tabel tersebut
> dan tidak muncul di dashboard.

### 7.5 Toolchain firmware (WAJIB)

`firmware/platformio.ini` di-pin ke **Arduino-ESP32 core 2.0.17**
(`platform = espressif32 @ 6.6.0`). Alasannya: pada core 3.x, ESPAsyncWebServer
membutuhkan library `Network` terpisah, yang tidak bisa dipetakan Library
Dependency Finder PlatformIO (folder `Network`, tetapi `library.properties`
menuliskan `name=Networking` tanpa `includes=`) — build gagal dengan
`fatal error: Network.h: No such file or directory`.

ESPAsyncWebServer di-pin ke commit `2d2da07` (v2.9.1) — versi terakhir yang
memakai API `beginResponse()` **dan** masih mendukung core 2.x. Repo upstream
sudah dipindah ke `ESP32Async/ESPAsyncWebServer` tanpa tag lama, sehingga
versinya di-pin lewat commit, bukan tag.

```bash
cd firmware
./setup-secrets.sh
pio run -e esp32-s3-devkitc-1 -t upload
```

Hasil build yang terverifikasi: RAM 14.3% (46.996 B), Flash 28.8% (962.381 B).

### 7.6 Backlog MQTT di masa depan

Topik `terraflow/+/data/bulk` (bulk sync offline) ditangani di
`backend/src/mqtt/subscriber.js`. Pastikan alur chunk 10 record + ACK
(`terraflow/{device_id}/data/bulk/ack`) diuji bersama perangkat nyata.

---

## 8. Perbaikan Schema Lokal

Migrasi `001`–`004` di repository **tidak sinkron** dengan kode backend:
`routes/auth.js` & `routes/users.js` memakai kolom/tabel yang belum pernah dibuat
(`users.is_approved`, `users.google_id`, tabel `password_resets`), sehingga
login gagal dengan error `column "is_approved" does not exist`.

Perbaikan: file baru `backend/src/db/migrations/005_auth_schema_sync.sql`
(idempotent, aman dijalankan ulang). File ini **belum ada di repository GitHub** —
perlu di-*commit* & di-*push* ke `dimss19/TerraflowId` agar deployment berikutnya
di server lain tidak mengalami error yang sama.

---

## 9. Perintah Verifikasi

```bash
# Service
systemctl is-active terraflow terraflow-mux nginx postgresql

# API dari server
curl -s http://127.0.0.1:5000/health

# API lewat Nginx (publik)
curl -s http://43.134.53.192/health

# Login
curl -s -X POST http://43.134.53.192/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Terraflow2024!"}'

# WebSocket
curl -s -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  "http://43.134.53.192/socket.io/?EIO=4&transport=websocket" --max-time 4

# Uji autentikasi & pub/sub MQTT (melalui port 80 publik)
node /root/mqtt-auth-test.js 43.134.53.192 80
```
