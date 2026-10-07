# TerraflowId
# TerraFlow — Industrial Portable Automatic Water Level Recorder (AWLR)
**PT Tanah Airku Teknologi**

TerraFlow is an end-to-end, industrial-grade portable **Automatic Water Level Recorder (AWLR)** and oceanographic tidal monitoring system. It integrates an **ESP32-S3 Industrial** edge controller, an **A16 River/Dam Ultrasonic Sensor** via RS485 Modbus RTU, an **SPI MicroSD card** for zero-loss offline buffering, an **embedded MQTT broker/ingestion engine (Node.js)**, a partitioned **PostgreSQL time-series database**, and a modern **React + Vite telemetry dashboard**.

---

## 🌊 Key Features

1. **Edge MCU & Sensor Interface**:
   - **ESP32-S3 Industrial** dual-core MCU (240 MHz, FreeRTOS).
   - **A16 Ultrasonic Sensor (DYP-A16NY4W-V1.0)** via RS485 Modbus RTU (`GPIO 15 TX`, `GPIO 16 RX`), 50–1500 cm range, IP68 rated.
   - **SPI MicroSD Card Logging** (`GPIO 10 CS`, `GPIO 11 MOSI`, `GPIO 12 MISO`, `GPIO 13 SCK`) formatted as `/data/YYYY-MM-DD.csv`.
   - **Automatic Sensor Recovery**: Hardware power-cycle relay trigger after 5 consecutive read timeouts.

2. **Field Resilience & Watchdog Architecture**:
   - **Dual Watchdog**: Task Watchdog Timer (30s) + Interrupt Watchdog Timer (10s).
   - **RTC Fast Memory Persistence**: Tracks `boot_count`, `watchdog_count`, `brownout_count`, and `panic_count` across unexpected reboots.
   - **Crash Logging**: Anomaly audit dumps stored on `/logs/crash.log`.
   - **14 Field Alert Types**: Automatic detection and reporting of `WDT_RESET`, `SENSOR_FAIL`, `BATTERY_CRITICAL`, `SD_CARD_FAIL`, `HEAP_LOW`, and more.

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

## 🛠️ Hardware Pinout (ESP32-S3)

| Component | Signal | GPIO | Description |
|---|---|---|---|
| **MicroSD Module** | SPI CS | **GPIO 10** | Chip Select |
| **MicroSD Module** | SPI MOSI | **GPIO 11** | Master Out Slave In |
| **MicroSD Module** | SPI MISO | **GPIO 12** | Master In Slave Out |
| **MicroSD Module** | SPI SCK | **GPIO 13** | SPI Clock |
| **RS485 Transceiver** | TX | **GPIO 15** | UART2 TX (to A16 RX) |
| **RS485 Transceiver** | RX | **GPIO 16** | UART2 RX (to A16 TX) |
| **Battery Voltage** | ADC | **GPIO 4** | Voltage Divider (12V Battery) |
| **Sensor Power Gate** | MOSFET/Relay | **GPIO 5** | Power cycle control |

---

## 🗄️ Database Architecture (PostgreSQL `teraflowid`)

The PostgreSQL database leverages range partitioning to handle high-frequency 1-minute time-series data:
- `devices`: Registered AWLR instruments and GPS metadata.
- `readings`: Partitioned table (`readings_YYYY_MM`, `readings_default`) storing raw distance, calculated water level, temperature, battery voltage, and data source (`live` vs `sd_buffer`).
- `calibrations`: Audit history of sensor height, offset, and slope adjustments.
- `device_alerts`: Incident tracking with severity levels (`CRITICAL`, `WARNING`, `INFO`).
- `device_diagnostics`: Hardware health snapshots (uptime, free heap, boot reason).

---

## 🚀 Getting Started

### 1. Database Setup
Ensure PostgreSQL is running locally on port 5432:
```bash
# Database name: teraflowid, Password: 123
cd backend
npm run migrate
npm run seed
```

### 2. Backend Server & Embedded MQTT Broker
```bash
cd backend
npm start
```
- REST API & WebSocket: `http://127.0.0.1:5000`
- Embedded MQTT Broker: `127.0.0.1:1883`

### 3. Frontend Web Dashboard
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

### 4. AWLR Hardware Simulator
Run the simulator to generate realistic sinusoidal tidal curves and test network drops:
```bash
cd backend
npm run simulate
```

---

## 📄 License & Ownership
&copy; 2026 **PT Tanah Airku Teknologi**. All rights reserved.
