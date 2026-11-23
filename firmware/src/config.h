/**
 * TerraFlow AWLR — Hardware Configuration & Pinout
 * PT Tanah Airku Teknologi
 */

#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// ==========================================
// 1. DEVICE IDENTIFICATION & DEFAULTS
// ==========================================
// NOTE: DEVICE_ID below is used as factory default fallback only.
// The unified firmware auto-derives unique IDs (e.g. AWLR-<MAC>) if NVS is blank,
// or reads the custom Device ID configured via the local Web Portal (/settings).
#define DEVICE_ID             "AWLR-001"
#define FIRMWARE_VERSION      "1.3.0"
#define COMPANY_NAME          "PT Tanah Airku Teknologi"
#define SYSTEM_NAME           "TerraFlow Portable AWLR"

// ==========================================
// 2. HARDWARE PIN DEFINITIONS
// ==========================================
// MicroSD Card SPI Interface (KhursLabs ESP32-S3 IoT Logger)
// Pinout resmi board hanya mengekspos SS/MOSI/SCK/MISO - TIDAK ADA pin
// kontrol daya kartu. Konsekuensinya penting untuk anggaran daya, lihat
// catatan pada ENABLE_SD_POWERDOWN_ON_SLEEP di bawah.
#define PIN_SD_CS             10
#define PIN_SD_MOSI           11
#define PIN_SD_MISO           13  // MISO pada GPIO 13 (Sebelumnya terbalik dengan SCK)
#define PIN_SD_SCK            12  // SCK pada GPIO 12

// --------------------------------------------------------------------------
//  EKSPERIMENTAL - Lepaskan pin SPI MicroSD sebelum deep sleep
// --------------------------------------------------------------------------
//  Default MATI. JANGAN diaktifkan di alat lapangan sebelum lolos uji bench
//  (prosedur ada di komentar SdCardLogger::prepareForDeepSleep).
//
//  Apa yang ia perbaiki: pull-up internal pada MISO (dipasang di
//  SdCardLogger::begin) tetap aktif selama deep sleep. Bila kartu menahan
//  MISO rendah, 3.3V / 45k = ~73 uA bocor terus-menerus. rtc_gpio_isolate()
//  memutus keempat pin SPI sehingga kebocoran itu hilang.
//
//  Apa yang ia TIDAK perbaiki - penting agar tidak salah harap:
//  SD.end() TIDAK memutus daya kartu. VDD kartu berasal langsung dari rel
//  3.3V board tanpa sakelar, dan board ini tidak menyediakan pin kontrol
//  daya kartu. Jadi arus standby kartu itu sendiri (150-300 uA pada kartu
//  tipikal) TETAP ADA. Artinya target total < 150 uA kemungkinan besar
//  TIDAK TERCAPAI pada hardware ini selama kartu MicroSD terpasang -
//  butuh modifikasi hardware (sakelar daya kartu) untuk menembusnya.
//
//  RISIKO: bila kartu gagal remount setelah deep sleep, logging mati total.
//  Belum teruji pada hardware.
#define ENABLE_SD_POWERDOWN_ON_SLEEP  false

// ==========================================================================
//  PERINGATAN HARDWARE - WAJIB DIBACA SEBELUM MENGUBAH ALOKASI PIN
// ==========================================================================
//  Sumber: product_gpio_pinout.md (pinout resmi ESP32-S3 IoT Logger RS485).
//
//  Blok terminal baut board ini HANYA mengekspos GPIO 8 dan GPIO 9
//  (selain 5V, GND, A+, B-). Keduanya adalah pin bus I2C untuk chip RTC
//  DS3231M onboard, jadi keduanya punya RESISTOR PULL-UP FISIK ke 3.3V
//  di PCB (umumnya 4.7k atau 10k).
//
//  Menonaktifkan RTC di software (ENABLE_ONBOARD_RTC = false) TIDAK
//  menghapus resistor pull-up tersebut - chip DS3231M tetap terpasang.
//
//  AKIBAT NYATA pada GPIO 9 (PIN_SENSOR_PWR, sakelar daya sensor):
//  selama power-on, reset, dan booting - sebelum satu baris firmware pun
//  jalan - pull-up onboard menarik GPIO 9 ke 3.3V. Lewat R1 1k ke basis
//  BC547 itu memberi Ib ~456 uA, cukup membuat transistor SATURASI PENUH.
//  Artinya: SAKELAR DAYA SENSOR MENYALA SENDIRI SETIAP BOOT.
//
//  Resistor pull-down R3 100k pada dokumen WIRING-PEMUTUS-DAYA-A16.md
//  TIDAK cukup melawannya (kalah 10-20x); klaim "terkunci OFF saat reset"
//  di dokumen itu TIDAK berlaku untuk board ini. R3 harus ~1k.
//  Riwayat: kombinasi pull-up ini + R2 yang short (0.01 ohm) + regulator
//  MP1584 5V/3A sudah membakar satu BC547 tanpa perintah software apa pun.
//
//  RS485 yang SEBENARNYA ada di GPIO 15 (TX2) dan GPIO 16 (RX2), terhubung
//  ke terminal A+/B- lewat chip transceiver - dicadangkan untuk PZEM-017.
//  Makro PIN_RS485_* di bawah SALAH NAMA (sebenarnya jalur UART TTL sensor
//  di pin I2C); rename ditunda agar diff putaran ini tetap kecil.
// ==========================================================================

// Onboard Real-Time Clock DS3231M @ 0x68 - DINONAKTIFKAN.
// GPIO 9 (SCL) dialokasikan ulang sebagai PIN_SENSOR_PWR, sehingga bus I2C
// tidak bisa dipakai. Konsekuensi yang harus disadari: tidak ada penjaga
// waktu berbaterai, jadi ketepatan jam sepenuhnya bergantung pada NTP.
#define ENABLE_ONBOARD_RTC    false

// Serial2 (UART TTL) ke DYP-A1611AU (varian UART Auto, listen-only).
// Terminal baut bawah board KhursLabs:
// - Pin [8]  (GPIO 8, SDA I2C) : ESP32 RX2 <- Sensor TX (Kabel Putih, ~3.3V)
// - Pin [9]  (GPIO 9, SCL I2C) : Kontrol sakelar daya, lihat PIN_SENSOR_PWR
// - Pin [5V]                   : Source P-MOSFET -> Sensor VCC (Kabel Merah)
// - Pin [GND]                  : Ground -> Sensor GND (Kabel Hitam)
// Kabel Kuning (RX sensor) disambung lewat R 10k ke VCC_SW (drain MOSFET),
// BUKAN ke GPIO mana pun - supaya tidak ada back-powering saat sensor mati.
#define PIN_RS485_TX          -1  // Tidak dipakai: varian UART Auto tidak butuh trigger
#define PIN_RS485_RX          8   // ESP32 RX2 (GPIO 8 = SDA I2C!) <- A16 TX (Putih)

// Sakelar daya sensor: GPIO 9 HIGH = sensor menyala (via BC547 -> gate P-MOSFET).
// Baca blok PERINGATAN HARDWARE di atas sebelum menyentuh pin ini.
#define PIN_SENSOR_PWR        9

#define PIN_BOOT_BTN          0       // Onboard BOOT Button on GPIO 0 (Active LOW) untuk trigger portal

// ==========================================
// 3. OPERATING TIMINGS & INTERVALS
// ==========================================
#define SAMPLING_INTERVAL_MS  900000  // Default 15 menit (900 dtk) untuk mode hemat daya
#define PORTAL_WINDOW_SEC     180     // Window period 3 menit (180 dtk) Captive Portal saat cold-boot/tombol
#define DIAGNOSTICS_MS        3600000 // Jeda laporan diagnostik berkala di mode portal (1 jam)
#define WATCHDOG_TIMEOUT_SEC  30      // Task WDT 30s timeout
#define BULK_CHUNK_SIZE       10      // 10 records per bulk sync MQTT chunk
#define BULK_THROTTLE_MS      200     // Delay between chunks to prevent broker flooding
#define BULK_ACK_TIMEOUT_MS   30000   // Batas menunggu ACK server sebelum batch dianggap gagal & dikirim ulang

// ==========================================
// 4. NETWORK & MQTT SETTINGS
// ==========================================
#define WIFI_SSID             "RUANGAN_BAWAH"
#define WIFI_PASSWORD         "tanyahabib!!"

// Broker MQTT TerraFlow (VPS). Port 80 dipakai bersama HTTP lewat
// TCP multiplexer karena Security Group hanya membuka port 22 & 80.
#define MQTT_BROKER           "43.134.53.192"
#define MQTT_PORT             80

// Kredensial broker TIDAK disimpan di file ini (repo bersifat publik).
// Salin firmware/src/config_secrets.h.example menjadi
// firmware/src/config_secrets.h lalu isi nilainya. File tersebut
// sudah masuk .gitignore.
#if __has_include("config_secrets.h")
#include "config_secrets.h"
#else
#define MQTT_USER             ""
#define MQTT_PASS             ""
#endif

// MQTT Topic Templates
#define TOPIC_DATA            "terraflow/" DEVICE_ID "/data"
#define TOPIC_DATA_BULK       "terraflow/" DEVICE_ID "/data/bulk"
#define TOPIC_DATA_BULK_ACK   "terraflow/" DEVICE_ID "/data/bulk/ack"
#define TOPIC_STATUS          "terraflow/" DEVICE_ID "/status"
#define TOPIC_ALERT           "terraflow/" DEVICE_ID "/alert"
#define TOPIC_DIAGNOSTICS     "terraflow/" DEVICE_ID "/diagnostics"
#define TOPIC_CALIB_SET       "terraflow/" DEVICE_ID "/calibration/set"
#define TOPIC_CALIB_RESP      "terraflow/" DEVICE_ID "/calibration/response"
#define TOPIC_CONFIG_INTERVAL "terraflow/" DEVICE_ID "/config/interval"
#define TOPIC_CMD_RESTART     "terraflow/" DEVICE_ID "/command/restart"
#define TOPIC_CMD_SYNC        "terraflow/" DEVICE_ID "/command/sync_request"
#define TOPIC_CMD_TEST_MODE   "terraflow/" DEVICE_ID "/command/test_mode"
#define TOPIC_CMD_TEST_RESP   "terraflow/" DEVICE_ID "/command/test_mode/response"

// ==========================================
// 5. CALIBRATION DEFAULTS
// ==========================================
#define DEFAULT_SENSOR_HEIGHT 600.0f  // Default 600 cm height
#define DEFAULT_OFFSET        0.0f    // Default 0.0 cm offset
#define DEFAULT_SLOPE         1.0f    // Default 1.000000 slope

#endif // CONFIG_H
