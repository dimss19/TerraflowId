/**
 * TerraFlow — Portable Automatic Water Level Recorder (AWLR)
 * Main Firmware Entrypoint for ESP32-S3 Industrial
 * PT Tanah Airku Teknologi
 */

#include <Arduino.h>
#include "config.h"
#include "sensor_a16.h"
#include "sdcard_logger.h"
#include "mqtt_client.h"
#include "watchdog_mgr.h"

// Subsystem Instances
SensorA16 sensor;
SdCardLogger sdLogger;
MqttManager mqttMgr;

// Runtime state
BootStats bootStats;
int readingCount = 0;
unsigned long lastHourlyDiagMs = 0;

// Read battery voltage via ADC voltage divider
float readBatteryVoltage() {
  int rawAdc = analogRead(PIN_BATT_ADC);
  // 12V lead-acid / LiFePO4 battery divider ratio (e.g. 100k / 20k => factor ~6.0)
  float voltage = (rawAdc / 4095.0f) * 3.3f * 4.24f;
  return voltage;
}

// ==========================================
// FREERTOS TASK 1: SAMPLING (CORE 1)
// ==========================================
void samplingTask(void *pvParameters) {
  TickType_t lastWakeTime = xTaskGetTickCount();
  const TickType_t interval = pdMS_TO_TICKS(SAMPLING_INTERVAL_MS);

  while (true) {
    readingCount++;
    Serial.printf("\n[CYCLE #%d] Starting 1-minute AWLR sampling...\n", readingCount);

    // 1. Read A16 Ultrasonic Sensor via RS485
    A16Reading reading = sensor.readDistance();
    float batteryV = readBatteryVoltage();
    int batteryPct = min(100, max(0, (int)(((batteryV - 10.5f) / 2.3f) * 100.0f)));

    if (reading.isValid) {
      // 2. Apply NVS Calibration Formula:
      // Water Level = Sensor Height - (Raw Distance * Slope + Offset)
      CalibrationData calib = mqttMgr.getCalibration();
      float waterLevel = calib.sensorHeightCm - (reading.rawDistanceCm * calib.slope + calib.offsetCm);

      LogRecord record;
      record.timestamp = millis() / 1000;
      record.rawDistanceCm = reading.rawDistanceCm;
      record.waterLevelCm = waterLevel;
      record.temperatureC = reading.temperatureC;
      record.batteryVoltage = batteryV;
      record.batteryPercent = batteryPct;
      record.isSent = false;

      // 3. Mandatory Offline-First Storage on SD Card
      String filename = "2026-10-07.csv"; // In production, formatted from NTP/RTC date
      sdLogger.appendRecord(filename, record);

      // 4. Publish Real-time Telemetry via MQTT
      if (mqttMgr.isConnected()) {
        bool ok = mqttMgr.publishReading(record, readingCount);
        if (ok) {
          record.isSent = true;
          sdLogger.markRecordSent(filename, record.timestamp);
          Serial.printf("[TELEMETRY SENT] Level: %.1f cm | Dist: %.1f cm | Batt: %.2fV\n",
            waterLevel, reading.rawDistanceCm, batteryV);
        }

        // If there are unsent offline records, trigger bulk sync
        if (sdLogger.getPendingCount() > 0) {
          mqttMgr.triggerBulkSync(sdLogger);
        }
      } else {
        Serial.printf("[OFFLINE] No MQTT connection. Record buffered to SD Card (%d pending)\n",
          sdLogger.getPendingCount());
      }
    } else {
      Serial.printf("[SENSOR ERROR] Reading skipped: %s\n", reading.errorMsg.c_str());
    }

    // Wait until next 60-second cycle
    vTaskDelayUntil(&lastWakeTime, interval);
  }
}

// ==========================================
// FREERTOS TASK 2: HEALTH MONITOR (CORE 0)
// ==========================================
void healthTask(void *pvParameters) {
  while (true) {
    // 1. Feed Task Watchdog Timer
    feedWatchdog();

    // 2. Process MQTT loop
    mqttMgr.loop();

    // 3. Sensor Health Check
    if (sensor.getConsecutiveFailures() >= 5) {
      mqttMgr.publishAlert(
        "SENSOR_FAIL", "CRITICAL",
        "Sensor A16 RS485 gagal merespons 5 siklus berturut-turut. Siklus daya otomatis dijalankan."
      );
    }

    // 4. Battery Voltage Check
    float battV = readBatteryVoltage();
    if (battV < 10.5f) {
      mqttMgr.publishAlert("BATTERY_CRITICAL", "CRITICAL", "Tegangan baterai sangat rendah (<10.5V). Sistem siap sleep.");
    } else if (battV < 11.5f) {
      mqttMgr.publishAlert("BATTERY_LOW", "WARNING", "Tegangan baterai menurun di bawah ambang peringatan (<11.5V).");
    }

    // 5. Memory Health Check
    if (esp_get_free_heap_size() < 20480) {
      mqttMgr.publishAlert("HEAP_LOW", "WARNING", "Sisa heap memory mikrokontroler rendah (<20KB).");
    }

    // 6. Hourly Diagnostics Report
    if (millis() - lastHourlyDiagMs > DIAGNOSTICS_MS) {
      mqttMgr.publishDiagnostics(
        bootStats.reasonStr,
        bootStats.bootCount,
        bootStats.watchdogCount,
        battV,
        sdLogger.getPendingCount()
      );
      lastHourlyDiagMs = millis();
    }

    vTaskDelay(pdMS_TO_TICKS(HEALTH_CHECK_MS));
  }
}

// ==========================================
// SETUP & INITIALIZATION
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("==================================================");
  Serial.println("🌊 " SYSTEM_NAME);
  Serial.println("🏢 " COMPANY_NAME);
  Serial.println("==================================================");

  // 1. Inisialisasi Watchdog & Analisis Boot Reason
  bootStats = handleBootReason();
  initWatchdog();

  // 2. Inisialisasi MicroSD Card (SPI GPIO 10, 11, 12, 13)
  sdLogger.begin();
  if (bootStats.isCrashReset) {
    sdLogger.logCrash(bootStats.reasonStr, "Watchdog/Brownout reset detected at startup");
  }

  // 3. Inisialisasi Sensor A16 (RS485 GPIO 15, 16)
  sensor.begin();

  // 4. Inisialisasi WiFi & MQTT Manager
  mqttMgr.begin();

  // 5. Spawn FreeRTOS Tasks
  xTaskCreatePinnedToCore(
    samplingTask,
    "SamplingTask",
    8192,
    NULL,
    2,
    NULL,
    1 // Pin to Core 1
  );

  xTaskCreatePinnedToCore(
    healthTask,
    "HealthTask",
    8192,
    NULL,
    1,
    NULL,
    0 // Pin to Core 0
  );

  Serial.println("[SYSTEM] TerraFlow AWLR running in normal operational mode.");
}

void loop() {
  // Main loop remains empty as FreeRTOS tasks manage execution
  vTaskDelay(pdMS_TO_TICKS(1000));
}
