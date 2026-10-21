# TerraflowId
# TerraFlow — Industrial Portable Automatic Water Level Recorder (AWLR)
**PT Tanah Airku Teknologi**

TerraFlow is an end-to-end, industrial-grade portable **Automatic Water Level Recorder (AWLR)** and oceanographic tidal monitoring system. It integrates a **KhursLabs ESP32-S3 IoT Logger** edge controller, a **DYP-A16 River/Dam Ultrasonic Sensor** connected via the terminal header (`GPIO 8 SDA` / `GPIO 9 SCL`), an onboard **DS3231 RTC (I2C addr `0x68`)** with dynamic bus arbitration, an **SPI MicroSD card** (`CS=10, MOSI=11, SCK=12, MISO=13`) for zero-loss offline buffering, an **embedded MQTT broker/ingestion engine (Node.js)**, a partitioned **PostgreSQL time-series database**, and a modern **React + Vite telemetry dashboard**.

---

## 🌊 Key Features

1. **Edge MCU & Sensor Interface**:
   - **ESP32-S3 Industrial** dual-core MCU (240 MHz, FreeRTOS, 16MB Flash / 8MB PSRAM).
   - **A16 Ultrasonic Sensor (DYP-A16)** via Terminal Pin 1 (`GPIO 8 SDA` as RX) & Pin 2 (`GPIO 9 SCL` as TX), 50–1500 cm measurement range, IP68 rated.
   - **Onboard DS3231 Real-Time Clock (I2C addr `0x68`)**: Hardware RTC on `GPIO 8 (SDA)` & `GPIO 9 (SCL)` providing automatic POSIX time synchronization (`settimeofday`) without NTP dependency.
   - **Dynamic Bus Arbitration (Time-Multiplexed)**: Automatically arbitrates `GPIO 8 & 9` between I2C RTC and UART sensor sampling, keeping the RTC accessible during the 59-second idle period.
   - **SPI MicroSD Card Logging** (`GPIO 10 CS`, `GPIO 11 MOSI`, `GPIO 12 SCK`, `GPIO 13 MISO`) formatted as `/data/YYYY-MM-DD.csv`.
   - **Automatic Sensor Recovery**: Auto-reconnect sequence after consecutive read timeouts.

2. **Field Resilience & Watchdog Architecture**:
   - **Dual Watchdog**: Task Watchdog Timer (30s) + Interrupt Watchdog Timer (10s).
   - **RTC Fast Memory Persistence**: Tracks `boot_count`, `watchdog_count`, `brownout_count`, and `panic_count` across unexpected reboots.
   - **Crash Logging**: Anomaly audit dumps stored on `/logs/crash.log`.
   - **14 Field Alert Types**: Automatic detection and reporting of `WDT_RESET`, `SENSOR_FAIL`, `BROWNOUT`, `SD_CARD_FAIL`, `HEAP_LOW`, and more.

3. **Offline Buffering & Bulk Synchronization**:
   - **Offline-First Guarantee**: All 1-minute readings are stored to MicroSD (`sent=0`) before MQTT publishing.
   - **Chunked Bulk Sync**: Sends offline data in batches of 10 records to `terraflow/{device_id}/data/bulk` with server ACK verification on `terraflow/{device_id}/data/bulk/ack`.

4. **Oceanographic Tidal Analysis Engine**:
   - 30-minute moving average filter for surface wave ripple elimination.
   - Automated peak (*High Tide*) and trough (*Low Tide*) extraction.
   - Real-time dynamic state classification: `🔺 RISING`, `🔻 FALLING`, `➡️ SLACK`.
   - Key oceanographic metrics: **HHT** (Highest High Tide), **LLT** (Lowest Low Tide), **MSL** (Mean Sea Level), and **Tidal Range**.
   - Semi-diurnal period estimation (~12.3 to 12.4 hours).

5. **Web Dashboard (React + Vite)**:
   - Industrial Dark Theme with official company branding (**PT Tanah Airku Teknologi**).
   - Radial SVG Water Level Gauge (0–600 cm).
   - Real-time rolling 60-minute sparkline chart via WebSocket (Socket.IO).
   - 24-hour tidal wave area curve with peak/trough pins.
   - Monthly tidal calendar heatmap (Spring & Neap tide cycles).
   - Remote sensor calibration interface with live calculation simulator and MQTT dispatch.
   - Historical data viewer with date range filtering and sanitized CSV export.
   - Diagnostics and active alert management console with remote reboot capabilities.

---

## 🛠️ Hardware Pinout & Architecture (KhursLabs ESP32-S3 IoT Logger)

### 1. External Screw Terminal Header (6-Pin Terminal)
| Terminal Pin | Label / Signal | GPIO ESP32-S3 | Sensor Cable Connection | Description |
|---|---|---|---|---|
| **Pin 1** | **SDA** | **GPIO 8** | **Sensor TX (White Cable)** | ESP32-S3 UART2 RX & I2C SDA (Multiplexed) |
| **Pin 2** | **SCL** | **GPIO 9** | **Sensor RX (Yellow Cable)** | ESP32-S3 UART2 TX & I2C SCL (Multiplexed) |
| **Pin 3** | **+5V** | — | **Sensor VCC (Red Cable)** | Regulated +5V Power Supply Rail |
| **Pin 4** | **GND** | — | **Sensor GND (Black Cable)** | Common System & Logic Ground |
| **Pin 5** | **RS485 A+** | — | External RS485 A+ (Optional) | Differential Data Line (+) |
| **Pin 6** | **RS485 B-** | — | External RS485 B- (Optional) | Differential Data Line (-) |

### 2. Onboard Peripherals & Bus Specifications
| Component | Interface | Address / GPIO Pins | Function & Operating Notes |
|---|---|---|---|
| **DS3231 Real-Time Clock** | I2C (Wire) | **I2C Address: `0x68`**<br>SDA: **GPIO 8** &bull; SCL: **GPIO 9** | High-precision RTC synchronizing POSIX system time (`settimeofday`) on boot and loop. |
| **MicroSD Card Socket** | SPI Hardware | CS: **GPIO 10**<br>MOSI: **GPIO 11**<br>SCK: **GPIO 12**<br>MISO: **GPIO 13** | Dedicated SPI bus for zero-loss offline logging (`/data/YYYY-MM-DD.csv`). Fallback 10MHz &rarr; 4MHz. |
| **DYP-A16 Ultrasonic Sensor** | UART TTL | RX: **GPIO 8** &bull; TX: **GPIO 9** | Ultrasonic river/dam level sensor (50–1500 cm). |

> [!NOTE]
> **Dynamic Bus Arbitration / Time-Multiplexing (GPIO 8 & GPIO 9)**:
> Board KhursLabs ESP32-S3 IoT Logger menggunakan jalur fisik GPIO 8 & 9 bersamaan untuk RTC I2C onboard (`0x68`) dan Terminal Baut Eksternal (Pin 1 & Pin 2). Firmware TerraFlow mengimplementasikan sistem arbitrase otomatis: saat sampling (1x per menit), I2C dilepas (`Wire.end()`) untuk membuka UART membaca Sensor A16, kemudian port UART langsung ditutup seketika (`Serial2.end()`) sehingga GPIO 8 & 9 kembali bebas untuk diakses RTC DS3231 (`0x68`) selama 59 detik sisa siklus.

---

## 🗄️ Database Architecture (PostgreSQL `teraflowid`)

The PostgreSQL database leverages range partitioning to handle high-frequency 1-minute time-series data:
- `devices`: Registered AWLR instruments and GPS metadata.
- `readings`: Partitioned table (`readings_YYYY_MM`, `readings_default`) storing raw distance, calculated water level, temperature, signal quality, and data source (`live` vs `sd_buffer`).
- `calibrations`: Audit history of sensor height, offset, and slope adjustments.
- `device_alerts`: Incident tracking with severity levels (`CRITICAL`, `WARNING`, `INFO`).
- `device_diagnostics`: Hardware health snapshots (uptime, free heap, boot reason).

---

## 🚀 Getting Started

### 1. Database Setup
Ensure PostgreSQL is running locally on port 5432:
```bash
cd backend
cp .env.example .env      # sesuaikan DB_USER / DB_PASSWORD / DB_NAME
npm install
npm run migrate
npm run seed
npm run seed:users        # membuat akun admin & operator
```

### 2. Backend Server & Embedded MQTT Broker
```bash
cd backend
npm start
```
- REST API & WebSocket: `http://127.0.0.1:5000`
- Embedded MQTT Broker: `127.0.0.1:1883` (butuh `MQTT_USER` / `MQTT_PASS` bila diakses publik)

### 3. Frontend Web Dashboard
```bash
cd frontend
npm install
npm run build      # hasil build di frontend/dist, dilayani Nginx / Express
npm run dev        # mode pengembangan di http://localhost:5173
```

### 4. AWLR Hardware Simulator
Simulator Python untuk mensimulasikan perangkat AWLR (kurva pasang surut realistis + uji putus koneksi):
```bash
cd simulator
pip install -r requirements.txt
python3 awlr_simulator.py --broker 127.0.0.1 --port 1883 \
    --username terraflow --password "<password broker>" --device-id AWLR-001
```

### 5. Flash Firmware ke Perangkat AWLR

Kredensial broker **tidak** disimpan di Git (repo ini publik). Siapkan dulu file rahasia:
```bash
cd firmware
./setup-secrets.sh                                  # interaktif
# atau: ./setup-secrets.sh --user terraflow --pass "<password>"
```
Skrip tersebut membuat `firmware/src/config_secrets.h` (sudah masuk `.gitignore`).
Saat `pio run`, `scripts/build_check.py` akan memperingatkan bila file ini belum ada.

Build & upload:
```bash
pio run -e esp32-s3-devkitc-1 -t upload
pio device monitor -b 115200
```

Perangkat membuka portal web lokal (SoftAP `TerraFlow-<DEVICE_ID>`, IP `192.168.4.1`,
password default `password`) tempat `mq_host`, `mq_port`, `mq_user`, `mq_pass`
bisa diatur tanpa reflashing. Perubahan tersebut langsung diterapkan ke koneksi
MQTT tanpa perlu restart perangkat.

> **Penting:** `device_id` perangkat harus terdaftar di tabel `devices`
> (default `AWLR-001` dari seed), karena `device_diagnostics`, `device_alerts`,
> dan `calibrations` memakai foreign key ke `devices(device_id)`.


---

## 📄 License & Ownership
&copy; 2026 **PT Tanah Airku Teknologi**. All rights reserved.
