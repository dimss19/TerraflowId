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
#include "web_server_mgr.h"

// Subsystem Instances
SensorA16 sensor;
SdCardLogger sdLogger;
MqttManager mqttMgr;

// Runtime state
BootStats bootStats;
int readingCount = 0;
unsigned long lastHourlyDiagMs = 0;
unsigned long lastHealthPollMs = 0;

// Read battery voltage via ADC voltage divider (safe fallback when hardware is not present)
float readBatteryVoltage() {
  if (PIN_BATT_ADC < 0) {
    return 0.0f; // Modul pembagi tegangan aki tidak terpasang
  }
  int rawAdc = analogRead(PIN_BATT_ADC);
  // 12V lead-acid / LiFePO4 battery divider ratio
  float voltage = (rawAdc / 4095.0f) * 3.3f * 4.24f;
  return voltage;
}

// ==========================================
// FREERTOS TASK 1: SAMPLING (CORE 1)
// ==========================================
void samplingTask(void *pvParameters) {
  TickType_t lastWakeTime = xTaskGetTickCount();

  while (true) {
    readingCount++;
    uint32_t intervalSec = webServerMgr.getSettings().samplingIntervalSec;
    if (intervalSec < 5) intervalSec = 60;
    TickType_t cycleInterval = pdMS_TO_TICKS(intervalSec * 1000);

    Serial.printf("\n[CYCLE #%d] Starting AWLR sampling (Interval: %lu s)...\n",
      readingCount, (unsigned long)intervalSec);

    bool realActive = webServerMgr.isRealSensorEnabled();
    bool dummyActive = webServerMgr.isDummySensorEnabled();
    const char *dataSource = "none";
    A16Reading reading;
    reading.isValid = false;

    float batteryV = readBatteryVoltage();
    int batteryPct = min(100, max(0, (int)(((batteryV - 10.5f) / 2.3f) * 100.0f)));

    // 1. Data Acquisition Strategy (Real Sensor vs Dummy / Demo Simulation)
    if (realActive) {
      // Mode operasional sungai normal di lapangan (RS485 A16)
      reading = sensor.readFilteredDistance(5);
      if (reading.isValid) {
        dataSource = "live";
      } else if (dummyActive) {
        Serial.printf("[SENSOR FALLBACK] Real sensor disconnected/failed (%s). Fallback to dummy simulation.\n",
          reading.errorMsg.c_str());
      }
    }

    if (!reading.isValid && dummyActive) {
      // Mode demo meja pameran / presentasi tanpa sensor fisik
      static float simPhase = 0.0f;
      simPhase += 0.25f;
      CalibrationData calib = mqttMgr.getCalibration();
      float dummyWaterLevel = 250.0f + sinf(simPhase) * 18.0f + ((float)(esp_random() % 100) / 100.0f - 0.5f) * 3.0f;
      float effectiveDist = calib.sensorHeightCm - dummyWaterLevel;

      reading.isValid = true;
      reading.rawDistanceCm = effectiveDist;
      reading.filteredDistanceCm = effectiveDist;
      reading.temperatureC = 27.5f;
      reading.validSamples = 5;
      reading.errorMsg = "";
      dataSource = "dummy";
      Serial.printf("[DEMO MODE] Generated dummy wave: Level=%.1f cm (Dist=%.1f cm)\n",
        dummyWaterLevel, effectiveDist);
    }

    // 2. Process Telemetry when Valid Data Exists
    if (reading.isValid) {
      CalibrationData calib = mqttMgr.getCalibration();
      float effectiveDist = (reading.filteredDistanceCm > 0.0f) ? reading.filteredDistanceCm : reading.rawDistanceCm;
      float waterLevel = calib.sensorHeightCm - (effectiveDist * calib.slope + calib.offsetCm);

      LogRecord record;
      memset(&record, 0, sizeof(record));

      time_t now = time(nullptr);
      struct tm timeinfo;
      if (now > 1700000000 && localtime_r(&now, &timeinfo)) {
        strftime(record.date, sizeof(record.date), "%Y-%m-%d", &timeinfo);
        strftime(record.time, sizeof(record.time), "%H:%M:%S", &timeinfo);
        record.minute = (uint8_t)timeinfo.tm_min;
        record.timestamp = (uint32_t)now;
      } else {
        uint32_t upSec = millis() / 1000;
        uint32_t upMin = (upSec / 60) % 60;
        uint32_t upHour = (upSec / 3600) % 24;
        uint32_t upDay = 1 + (upSec / 86400);
        snprintf(record.date, sizeof(record.date), "2026-10-%02u", upDay > 31 ? 31 : upDay);
        snprintf(record.time, sizeof(record.time), "%02u:%02u:%02u", upHour, upMin, upSec % 60);
        record.minute = (uint8_t)upMin;
        record.timestamp = upSec;
      }

      record.rawDistanceCm = reading.rawDistanceCm;
      record.filteredDistanceCm = effectiveDist;
      record.waterLevelCm = waterLevel;
      record.temperatureC = reading.temperatureC;
      record.batteryVoltage = batteryV;
      record.batteryPercent = batteryPct;
      record.isSent = false;

      // 3. Mandatory Offline-First Storage on SD Card (Dynamic NTP-based filename)
      String filename = webServerMgr.getCurrentLogFilename();
      sdLogger.appendRecord(filename, record);

      // 4. Publish Real-time Telemetry via MQTT
      if (mqttMgr.isConnected()) {
        bool ok = mqttMgr.publishReading(record, readingCount, dataSource);
        if (ok) {
          record.isSent = true;
          sdLogger.markRecordSent(filename, record.timestamp);
          Serial.printf("[TELEMETRY SENT (%s)] Level: %.1f cm | Dist: %.1f cm | Batt: %.2fV\n",
            dataSource, waterLevel, reading.rawDistanceCm, batteryV);
        }

        // Trigger bulk sync if offline buffer has pending records
        if (sdLogger.getPendingCount() > 0) {
          mqttMgr.triggerBulkSync(sdLogger);
        }
      } else {
        Serial.printf("[OFFLINE] No MQTT. Buffered to SD Card %s (%d pending)\n",
          filename.c_str(), sdLogger.getPendingCount());
      }

      // 5. Update Web Telemetry Snapshot for local Web Dashboard
      TelemetrySnapshot snap;
      snap.waterLevelCm = waterLevel;
      snap.rawDistanceCm = reading.rawDistanceCm;
      snap.filteredDistanceCm = effectiveDist;
      snap.temperatureC = reading.temperatureC;
      snap.batteryVoltage = batteryV;
      snap.batteryPercent = batteryPct;
      snap.signalRssi = WiFi.RSSI();
      snap.sdCardOk = sdLogger.isReady();
      snap.pendingLogs = sdLogger.getPendingCount();
      snap.readingCount = readingCount;
      snap.wifiConnected = (WiFi.status() == WL_CONNECTED);
      snap.mqttConnected = mqttMgr.isConnected();
      strncpy(snap.dataSource, dataSource, sizeof(snap.dataSource) - 1);
      snprintf(snap.lastSampleTime, sizeof(snap.lastSampleTime), "%lu s", (unsigned long)(millis() / 1000));
      webServerMgr.updateTelemetry(snap);

    } else {
      if (!realActive && !dummyActive) {
        Serial.println("[STANDBY] Both Real Sensor and Dummy Simulation are OFF. Sampling paused.");
        TelemetrySnapshot snap = webServerMgr.getTelemetry();
        strncpy(snap.dataSource, "paused", sizeof(snap.dataSource) - 1);
        snap.batteryVoltage = batteryV;
        snap.batteryPercent = batteryPct;
        webServerMgr.updateTelemetry(snap);
      } else {
        Serial.printf("[SENSOR ERROR] Reading skipped: %s\n", reading.errorMsg.c_str());
      }
    }

    // Wait until next configured cycle interval
    vTaskDelayUntil(&lastWakeTime, cycleInterval);
  }
}

// ==========================================
// FREERTOS TASK 2: HEALTH & NETWORK MONITOR (CORE 0)
// ==========================================
void healthTask(void *pvParameters) {
  unsigned long lastWdtFeedMs = 0;

  while (true) {
    unsigned long now = millis();

    // 1. Feed Task Watchdog Timer every 1 second (completely prevents WDT timeouts!)
    if (now - lastWdtFeedMs >= 1000) {
      feedWatchdog();
      lastWdtFeedMs = now;
    }

    // 2. Process MQTT network loop
    mqttMgr.loop();

    // 3. Process Web Server background / Captive Portal DNS
    webServerMgr.loop();

    // Periodic slower health evaluations (every 30 seconds)
    if (now - lastHealthPollMs >= 30000) {
      lastHealthPollMs = now;

      // Sensor Health Check (only active when physical real sensor is enabled)
      if (webServerMgr.isRealSensorEnabled() && sensor.getConsecutiveFailures() >= 5) {
        mqttMgr.publishAlert(
          "SENSOR_FAIL", "CRITICAL",
          "Sensor A16 RS485 gagal merespons 5 siklus berturut-turut. Siklus daya otomatis dijalankan."
        );
      }

      // Battery Voltage Check (only active if hardware divider pin is defined)
      if (PIN_BATT_ADC >= 0) {
        float battV = readBatteryVoltage();
        if (battV > 1.0f && battV < 10.5f) {
          mqttMgr.publishAlert("BATTERY_CRITICAL", "CRITICAL", "Tegangan baterai sangat rendah (<10.5V).");
        } else if (battV >= 10.5f && battV < 11.5f) {
          mqttMgr.publishAlert("BATTERY_LOW", "WARNING", "Tegangan baterai menurun di bawah ambang (<11.5V).");
        }
      }

      // Memory Health Check
      if (esp_get_free_heap_size() < 20480) {
        mqttMgr.publishAlert("HEAP_LOW", "WARNING", "Sisa heap memory ESP32 rendah (<20KB).");
      }
    }

    // 4. Hourly Diagnostics Report
    if (now - lastHourlyDiagMs > DIAGNOSTICS_MS) {
      float battV = readBatteryVoltage();
      mqttMgr.publishDiagnostics(
        bootStats.reasonStr,
        bootStats.bootCount,
        bootStats.watchdogCount,
        battV,
        sdLogger.getPendingCount()
      );
      lastHourlyDiagMs = now;
    }

    // Fast 30ms yield allows instant DNS resolution and responsive captive portal HTTP handling
    vTaskDelay(pdMS_TO_TICKS(30));
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

  // 4. Inisialisasi Web Server Manager dengan SD Logger Reference
  webServerMgr.begin(&sdLogger);

  // 5. Inisialisasi MQTT Manager (menggunakan dynamic settings dari WebServerMgr)
  mqttMgr.begin();

  // 6. Spawn FreeRTOS Tasks
  xTaskCreatePinnedToCore(
    samplingTask,
    "SamplingTask",
    8192,
    NULL,
    2,
    NULL,
    1 // Pin to Core 1 (Sensor & Sampling)
  );

  xTaskCreatePinnedToCore(
    healthTask,
    "HealthTask",
    8192,
    NULL,
    1,
    NULL,
    0 // Pin to Core 0 (Network & WDT)
  );

  Serial.printf("[SYSTEM] TerraFlow AWLR running for Device '%s' with Multi-Device Unified Firmware.\n",
    webServerMgr.getEffectiveDeviceId().c_str());
}

void loop() {
  // Main loop yields as FreeRTOS tasks manage execution
  vTaskDelay(pdMS_TO_TICKS(1000));
}
