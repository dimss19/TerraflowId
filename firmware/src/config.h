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
#define PIN_SD_CS             10
#define PIN_SD_MOSI           11
#define PIN_SD_MISO           13  // MISO pada GPIO 13 (Sebelumnya terbalik dengan SCK)
#define PIN_SD_SCK            12  // SCK pada GPIO 12

// Onboard Real-Time Clock (DS3231 / DS1307 at 0x68)
// Terhubung secara internal pada board ke bus I2C (SDA GPIO 8 & SCL GPIO 9)
#define PIN_RTC_SDA           8
#define PIN_RTC_SCL           9
#define RTC_I2C_ADDR          0x68

// Serial2 (UART TTL) Interface to A16 Ultrasonic Sensor
// Terhubung ke Terminal Bawah Board KhursLabs (Pin 1 & Pin 2):
// - Pin 1 (SDA / GPIO 8) : ESP32 RX2 <- Sensor TX (Kabel Putih)
// - Pin 2 (SCL / GPIO 9) : ESP32 TX2 -> Sensor RX (Kabel Kuning)
// - Pin 3 (5V)           : Power VCC -> Sensor VCC (Kabel Merah)
// - Pin 4 (GND)          : Ground    -> Sensor GND (Kabel Hitam)
// CATATAN: Bus GPIO 8 & 9 digunakan secara dinamis (Time-Multiplexed)
// antara RTC I2C (0x68) dan pembacaan Sensor UART DYP-A16.
#define PIN_RS485_TX          9   // ESP32 TX2 (GPIO 9 / Terminal SCL) -> A16 RX (Kuning)
#define PIN_RS485_RX          8   // ESP32 RX2 (GPIO 8 / Terminal SDA) -> A16 TX (Putih)
#define PIN_RS485_DE_RE       -1  // Direct UART TTL (tidak memerlukan pin direction)

// Sensor Power Relay / MOSFET Gate (-1: sensor ditenagai langsung dari power rail)
#define PIN_SENSOR_PWR        -1

// Status Indicators
#define PIN_STATUS_LED        2

// ==========================================
// 3. OPERATING TIMINGS & INTERVALS
// ==========================================
#define SAMPLING_INTERVAL_MS  60000   // Default 1 reading per minute
#define HEALTH_CHECK_MS       1000    // Feed watchdog & network loop every 1 second (prevents WDT resets!)
#define DIAGNOSTICS_MS        3600000 // Hourly diagnostics report (1 hour)
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
#define TOPIC_CMD_RESTART     "terraflow/" DEVICE_ID "/command/restart"
#define TOPIC_CMD_SYNC        "terraflow/" DEVICE_ID "/command/sync_request"

// ==========================================
// 5. CALIBRATION DEFAULTS
// ==========================================
#define DEFAULT_SENSOR_HEIGHT 600.0f  // Default 600 cm height
#define DEFAULT_OFFSET        0.0f    // Default 0.0 cm offset
#define DEFAULT_SLOPE         1.0f    // Default 1.000000 slope

#endif // CONFIG_H
