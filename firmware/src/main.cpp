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
#include "rtc_mgr.h"

// Subsystem Instances
SensorA16 sensor;
SdCardLogger sdLogger;
MqttManager mqttMgr;

// Runtime state
BootStats bootStats;
int readingCount = 0;
unsigned long lastHourlyDiagMs = 0;
unsigned long lastHealthPollMs = 0;

// ==========================================
// FREERTOS TASK 1: SAMPLING (CORE 1)
// ==========================================
void samplingTask(void *pvParameters) {
  TickType_t lastWakeTime = xTaskGetTickCount();

  while (true) {
    readingCount++;
    uint32_t intervalSec = webServerMgr.getSettings().samplingIntervalSec;
    if (intervalSec < 60) intervalSec = 60;
    TickType_t cycleInterval = pdMS_TO_TICKS(intervalSec * 1000);

    Serial.printf("\n[SIKLUS #%d] Memulai sampling sensor AWLR (Interval: %lu dtk)...\n",
      readingCount, (unsigned long)intervalSec);

    // 1. Akuisisi Data dari Sensor Fisik A16
    A16Reading reading = sensor.readFilteredDistance(3);
    const char *dataSource = "none";

    CalibrationData calib = mqttMgr.getCalibration();
    float effectiveDist = 0.0f;
    float waterLevel = 0.0f;

    if (reading.isValid) {
      dataSource = (reading.validSamples > 0) ? "live" : "hold";
      effectiveDist = (reading.filteredDistanceCm > 0.0f) ? reading.filteredDistanceCm : reading.rawDistanceCm;
      waterLevel = calib.sensorHeightCm - (effectiveDist * calib.slope + calib.offsetCm);
    } else {
      dataSource = "error";
      Serial.printf("[SENSOR PERINGATAN] Sensor A16 tidak terbaca: %s. Mencatat status menit ini agar kontinuitas data 1 menit tidak putus.\n",
        reading.errorMsg.c_str());
    }

    LogRecord record;
    memset(&record, 0, sizeof(record));

    time_t now = time(nullptr);
    struct tm timeinfo;
    if (now > 1700000000 && localtime_r(&now, &timeinfo)) {
      // Bulatkan timestamp ke batas menit (:00) agar tidak terjadi duplikasi dalam 1 menit
      time_t minAligned = (now / 60) * 60;
      struct tm alignedTm;
      localtime_r(&minAligned, &alignedTm);
      strftime(record.date, sizeof(record.date), "%Y-%m-%d", &alignedTm);
      strftime(record.time, sizeof(record.time), "%H:%M:00", &alignedTm);
      record.minute = (uint8_t)alignedTm.tm_min;
      record.timestamp = (uint32_t)minAligned;
    } else {
      struct tm rtcTm;
      if (rtcMgr.readDateTime(rtcTm)) {
        time_t epoch = mktime(&rtcTm);
        time_t minAligned = (epoch / 60) * 60;
        struct tm alignedTm;
        localtime_r(&minAligned, &alignedTm);
        strftime(record.date, sizeof(record.date), "%Y-%m-%d", &alignedTm);
        strftime(record.time, sizeof(record.time), "%H:%M:00", &alignedTm);
        record.minute = (uint8_t)alignedTm.tm_min;
        record.timestamp = (uint32_t)minAligned;
        struct timeval tv = { .tv_sec = epoch, .tv_usec = 0 };
        settimeofday(&tv, nullptr);
      } else {
        uint32_t upSec = millis() / 1000;
        uint32_t upAligned = (upSec / 60) * 60;
        uint32_t upMin = (upAligned / 60) % 60;
        uint32_t upHour = (upAligned / 3600) % 24;
        uint32_t upDay = 1 + (upAligned / 86400);
        snprintf(record.date, sizeof(record.date), "1970-01-%02u", upDay > 31 ? 31 : upDay);
        snprintf(record.time, sizeof(record.time), "%02u:%02u:00", upHour, upMin);
        record.minute = (uint8_t)upMin;
        record.timestamp = upAligned;
      }
    }

    record.rawDistanceCm = reading.rawDistanceCm;
    record.filteredDistanceCm = effectiveDist;
    record.waterLevelCm = waterLevel;
    record.temperatureC = reading.temperatureC;
    record.isSent = false;

    // 2. Simpan ke Kartu MicroSD (Offline-First)
    String filename = webServerMgr.getCurrentLogFilename();
    sdLogger.appendRecord(filename, record);

    // 3. Publikasikan Telemetri via MQTT
    if (mqttMgr.isConnected()) {
      bool ok = mqttMgr.publishReading(record, readingCount, dataSource);
      if (ok) {
        record.isSent = true;
        sdLogger.markRecordSent(filename, record.timestamp);
        Serial.printf("[TELEMETRI TERKIRIM] Level: %.1f cm | Jarak: %.1f cm | Suhu: %.1f°C | Sumber: %s | Jam: %s\n",
          waterLevel, reading.rawDistanceCm, reading.temperatureC, dataSource, record.time);
      }

      if (sdLogger.getPendingCount() > 0) {
        mqttMgr.triggerBulkSync(sdLogger);
      }
    } else {
      Serial.printf("[OFFLINE] MQTT tidak terhubung. Disimpan ke SD Card %s (%d antrean pending)\n",
        filename.c_str(), sdLogger.getPendingCount());
    }

    // 4. Perbarui Snapshot Telemetri Web Lokal
    TelemetrySnapshot snap;
    snap.waterLevelCm = waterLevel;
    snap.rawDistanceCm = reading.rawDistanceCm;
    snap.filteredDistanceCm = effectiveDist;
    snap.temperatureC = reading.temperatureC;
    snap.signalRssi = WiFi.RSSI();
    snap.sdCardOk = sdLogger.isReady();
    snap.pendingLogs = sdLogger.getPendingCount();
    snap.readingCount = readingCount;
    snap.wifiConnected = (WiFi.status() == WL_CONNECTED);
    snap.mqttConnected = mqttMgr.isConnected();
    strncpy(snap.dataSource, dataSource, sizeof(snap.dataSource) - 1);
    snprintf(snap.lastSampleTime, sizeof(snap.lastSampleTime), "%lu s", (unsigned long)(millis() / 1000));
    webServerMgr.updateTelemetry(snap);

    // 5. Sinkronisasi tidur presisi ke batas menit berikutnya (:00)
    time_t curNow = time(nullptr);
    struct tm curTm;
    if (curNow > 1700000000 && localtime_r(&curNow, &curTm)) {
      int secUntilNextMin = 60 - curTm.tm_sec;
      if (secUntilNextMin <= 0) secUntilNextMin = 60;
      Serial.printf("[SINKRONISASI MENIT] Menunggu %d detik menuju awal menit berikutnya (:00)...\n", secUntilNextMin);
      vTaskDelay(pdMS_TO_TICKS(secUntilNextMin * 1000));
    } else {
      vTaskDelayUntil(&lastWakeTime, cycleInterval);
    }
  }
}

// ==========================================
// FREERTOS TASK 2: HEALTH & NETWORK MONITOR (CORE 0)
// ==========================================
void healthTask(void *pvParameters) {
  esp_task_wdt_add(NULL);
  unsigned long lastWdtFeedMs = 0;

  while (true) {
    unsigned long now = millis();

    // 1. Feed Watchdog Timer setiap 1 detik
    if (now - lastWdtFeedMs >= 1000) {
      feedWatchdog();
      lastWdtFeedMs = now;
    }

    // 2. MQTT network loop
    mqttMgr.loop();

    // 2b. Terapkan ulang konfigurasi broker bila diubah lewat portal /settings
    if (webServerMgr.consumeMqttConfigDirty()) {
      mqttMgr.reconfigure();
    }

    // 3. Web Server background & DNS
    webServerMgr.loop();

    // Evaluasi kesehatan periodik (setiap 30 detik)
    if (now - lastHealthPollMs >= 30000) {
      lastHealthPollMs = now;

      // Cek Sensor A16 jika gagal 5 siklus berturut-turut
      if (sensor.getConsecutiveFailures() >= 5) {
        mqttMgr.publishAlert(
          "SENSOR_DISCONNECTED", "CRITICAL",
          "Sensor A16 tidak merespons 5 siklus berturut-turut. Periksa koneksi kabel TX/RX dan power sensor."
        );
      }

      // Cek Heap Memory
      if (esp_get_free_heap_size() < 20480) {
        mqttMgr.publishAlert("HEAP_LOW", "WARNING", "Sisa heap memory ESP32 rendah (<20KB).");
      }
    }

    // 4. Laporan Diagnostik Berkala (1 Jam)
    if (now - lastHourlyDiagMs > DIAGNOSTICS_MS) {
      mqttMgr.publishDiagnostics(
        bootStats.reasonStr,
        bootStats.bootCount,
        bootStats.watchdogCount,
        sdLogger.getPendingCount(),
        (int)bootStats.brownoutCount
      );
      lastHourlyDiagMs = now;
    }

    vTaskDelay(pdMS_TO_TICKS(50));
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

  // 0. Konfigurasi Timezone WIB (UTC+7)
  setenv("TZ", "WIB-7", 1);
  tzset();

  // 1. Inisialisasi Watchdog & Analisis Boot Reason
  bootStats = handleBootReason();
  initWatchdog();

  // 2. Inisialisasi Onboard Real-Time Clock (DS3231/DS1307 at 0x68 via GPIO 8 & 9)
  rtcMgr.begin();

  // 3. Inisialisasi MicroSD Card (SPI GPIO 10 CS, 11 MOSI, 12 SCK, 13 MISO)
  sdLogger.begin();
  if (bootStats.isCrashReset) {
    sdLogger.logCrash(bootStats.reasonStr, "Watchdog/Brownout reset detected at startup");
  }

  // 4. Inisialisasi Sensor A16 (UART TTL GPIO 8 RX, 9 TX)
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
  feedWatchdog();
  vTaskDelay(pdMS_TO_TICKS(1000));
}
