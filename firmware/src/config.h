/**
 * TerraFlow AWLR — Hardware Configuration & Pinout
 * PT Tanah Airku Teknologi
 */

#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// ==========================================
// 1. DEVICE IDENTIFICATION
// ==========================================
#define DEVICE_ID             "AWLR-001"
#define FIRMWARE_VERSION      "1.2.0"
#define COMPANY_NAME          "PT Tanah Airku Teknologi"
#define SYSTEM_NAME           "TerraFlow Portable AWLR"

// ==========================================
// 2. HARDWARE PIN DEFINITIONS
// ==========================================
// MicroSD Card SPI Interface
#define PIN_SD_CS             10
#define PIN_SD_MOSI           11
#define PIN_SD_MISO           12
#define PIN_SD_SCK            13

// RS485 Interface to A16 Ultrasonic Sensor (Serial2)
#define PIN_RS485_TX          15  // Connect to A16 RX / MAX485 DI
#define PIN_RS485_RX          16  // Connect to A16 TX / MAX485 RO
#define PIN_RS485_DE_RE       -1  // Set pin if hardware auto-direction is not used

// Battery Voltage ADC Monitor
#define PIN_BATT_ADC          4   // Voltage divider from 12V battery

// Sensor Power Relay / MOSFET Gate (for power cycling hung sensor)
#define PIN_SENSOR_PWR        5

// Status Indicators
#define PIN_STATUS_LED        2

// ==========================================
// 3. OPERATING TIMINGS & INTERVALS
// ==========================================
#define SAMPLING_INTERVAL_MS  60000   // 1 reading per minute
#define HEALTH_CHECK_MS       30000   // Health check every 30 seconds
#define DIAGNOSTICS_MS        3600000 // Hourly diagnostics report (1 hour)
#define WATCHDOG_TIMEOUT_SEC  30      // Task WDT 30s timeout
#define BULK_CHUNK_SIZE       10      // 10 records per bulk sync MQTT chunk
#define BULK_THROTTLE_MS      200     // Delay between chunks to prevent broker flooding

// ==========================================
// 4. NETWORK & MQTT SETTINGS
// ==========================================
#define WIFI_SSID             "passwordnyarahasia"
#define WIFI_PASSWORD         "qwertyuiop"

#define MQTT_BROKER           "192.168.110.29"
#define MQTT_PORT             1883
#define MQTT_USER             "awlr_device"
#define MQTT_PASS             "terraflow_secure_token"

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
