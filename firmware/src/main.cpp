#include <Arduino.h>
#include <esp_sleep.h>
#include <esp_wifi.h>
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

// Runtime state di RTC Slow Memory (persisten melewati siklus Deep Sleep)
RTC_DATA_ATTR static int persistentReadingCount = 0;

BootStats bootStats;
int readingCount = 0;
unsigned long lastHourlyDiagMs = 0;
unsigned long lastHealthPollMs = 0;

void enterDeepSleep();
void executeScheduledSamplingCycle();

// ==========================================
// FREERTOS TASK 1: SAMPLING (CORE 1)
// ==========================================
void samplingTask(void *pvParameters) {
  TickType_t lastWakeTime = xTaskGetTickCount();

  while (true) {
    bool inTestMode = webServerMgr.isTestModeActive();
    readingCount++;
    uint32_t intervalSec = inTestMode ? 1 : webServerMgr.getSettings().samplingIntervalSec;
    if (!inTestMode && intervalSec < 15) intervalSec = 15;
    TickType_t cycleInterval = pdMS_TO_TICKS(intervalSec * 1000);

    // 1. Akuisisi Data Sensor A16 (Fast Sample < 50ms saat mode test persis sensor_test.cpp)
    CalibrationData calib = mqttMgr.getCalibration();
    A16Reading reading;

    if (inTestMode) {
      reading = sensor.readFastSample();
    } else {
      Serial.printf("\n[SIKLUS #%d] Memulai sampling sensor AWLR (Interval: %lu dtk)...\n",
        readingCount, (unsigned long)intervalSec);
      reading = sensor.readFilteredDistance(9);
    }

    const char *dataSource = inTestMode ? "test" : "none";
    float effectiveDist = 0.0f;
    float waterLevel = 0.0f;

    if (reading.isValid) {
      dataSource = inTestMode ? "test" : ((reading.validSamples > 0) ? "live" : "hold");
      effectiveDist = (reading.filteredDistanceCm > 0.0f) ? reading.filteredDistanceCm : reading.rawDistanceCm;
      waterLevel = calib.sensorHeightCm - (effectiveDist * calib.slope + calib.offsetCm);
    } else if (reading.isBlindSpot) {
      dataSource = "blind_spot";
      effectiveDist = 50.0f;
      waterLevel = calib.sensorHeightCm - (effectiveDist * calib.slope + calib.offsetCm);
      if (!inTestMode) {
        Serial.println("🚨 [PERINGATAN AWLR] Blind Spot terdeteksi! Muka air berada <= 50 cm dari sensor (Potensi banjir ekstrem / luapan air)!");
        if (mqttMgr.isConnected()) {
          mqttMgr.publishAlert("BLIND_SPOT", "CRITICAL", "Muka air terdeteksi masuk ke zona buta (<= 50 cm). Sensor hampir terendam!");
        }
      }
    } else {
      dataSource = "error";
      effectiveDist = reading.rawDistanceCm;
      waterLevel = 0.0f;
      if (!inTestMode) {
        Serial.printf("[SENSOR PERINGATAN] Sensor A16 tidak terbaca: %s. Mencatat status menit ini agar kontinuitas data 1 menit tidak putus.\n",
          reading.errorMsg.c_str());
      }
    }

    // Tampilan Serial Monitor Persis seperti sensor_test.cpp saat Mode Uji Aktif
    if (inTestMode) {
      uint16_t distMm = (uint16_t)(reading.rawDistanceCm * 10.0f);
      if (reading.isValid) {
        Serial.printf("🎯 [OK VALID #%d] Raw: [%02X %02X %02X %02X] -> JARAK: %5u mm (%6.1f cm) | %5.2f meter | TMA: %6.1f cm\n",
          readingCount,
          reading.rawHex[0], reading.rawHex[1], reading.rawHex[2], reading.rawHex[3],
          distMm, reading.rawDistanceCm, reading.rawDistanceCm / 100.0f, waterLevel);
      } else if (reading.isBlindSpot) {
        Serial.printf("🚨 [BLIND SPOT TERDETEKSI! #%d] Raw: [%02X %02X %02X %02X] -> Jarak: %u mm (%.1f cm) (Objek/Air <= 50 cm di Zona Buta!)\n",
          readingCount,
          reading.rawHex[0], reading.rawHex[1], reading.rawHex[2], reading.rawHex[3],
          distMm, reading.rawDistanceCm);
      } else if (reading.errorMsg == "NO_ECHO") {
        Serial.printf("⚠️ [FRAME VALID | NO ECHO #%d] Raw: [%02X %02X %02X %02X] -> Jarak: 0 mm (Target terlalu jauh/miring)\n",
          readingCount,
          reading.rawHex[0], reading.rawHex[1], reading.rawHex[2], reading.rawHex[3]);
      } else {
        Serial.printf("❌ [A16 TIMEOUT #%d] Tidak ada frame valid dari sensor pada GPIO 8! (Memeriksa wiring sensor...)\n",
          readingCount);
      }
    }

    LogRecord record;
    memset(&record, 0, sizeof(record));

    time_t now = time(nullptr);
    struct tm timeinfo;
    if (inTestMode) {
      // Mode Test: detil detik real-time, JANGAN dibulatkan ke :00
      if (now > 1700000000 && localtime_r(&now, &timeinfo)) {
        strftime(record.date, sizeof(record.date), "%Y-%m-%d", &timeinfo);
        strftime(record.time, sizeof(record.time), "%H:%M:%S", &timeinfo);
        record.minute = (uint8_t)timeinfo.tm_min;
        record.timestamp = (uint32_t)now;
      } else {
        uint32_t upSec = millis() / 1000;
        uint32_t upMin = (upSec / 60) % 60;
        uint32_t upHour = (upSec / 3600) % 24;
        uint32_t upSecRem = upSec % 60;
        snprintf(record.date, sizeof(record.date), "1970-01-01");
        snprintf(record.time, sizeof(record.time), "%02u:%02u:%02u", upHour, upMin, upSecRem);
        record.minute = (uint8_t)upMin;
        record.timestamp = upSec;
      }
    } else {
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
    }

    record.rawDistanceCm = reading.rawDistanceCm;
    record.filteredDistanceCm = effectiveDist;
    record.waterLevelCm = waterLevel;
    record.temperatureC = reading.temperatureC;
    record.isSent = false;

    // 2. Simpan ke Kartu MicroSD (Hanya saat mode normal untuk performa instan mode uji)
    if (!inTestMode) {
      String filename = webServerMgr.getCurrentLogFilename();
      sdLogger.appendRecord(filename, record);
    }

    // 3. Publikasikan Telemetri via MQTT
    if (mqttMgr.isConnected()) {
      bool ok = mqttMgr.publishReading(record, readingCount, dataSource);
      if (ok && !inTestMode) {
        record.isSent = true;
        String filename = webServerMgr.getCurrentLogFilename();
        sdLogger.markRecordSent(filename, record.timestamp);
        Serial.printf("[TELEMETRI TERKIRIM] Level: %.1f cm | Jarak: %.1f cm | Suhu: %.1f°C | Sumber: %s | Jam: %s\n",
          waterLevel, reading.rawDistanceCm, reading.temperatureC, dataSource, record.time);
      }

      if (!inTestMode && sdLogger.getPendingCount() > 0) {
        mqttMgr.triggerBulkSync(sdLogger);
      }
    } else if (!inTestMode) {
      String filename = webServerMgr.getCurrentLogFilename();
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
    snap.spreadCm = reading.spreadCm;
    snap.validSamples = reading.validSamples;
    strncpy(snap.dataSource, dataSource, sizeof(snap.dataSource) - 1);
    snprintf(snap.lastSampleTime, sizeof(snap.lastSampleTime), "%lu s", (unsigned long)(millis() / 1000));
    webServerMgr.updateTelemetry(snap);

    // 5. Jeda siklus berikutnya: Mode test jeda 1 detik, mode normal tunggu batas menit
    if (inTestMode) {
      vTaskDelayUntil(&lastWakeTime, pdMS_TO_TICKS(1000));
    } else {
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
      lastWakeTime = xTaskGetTickCount();
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

    // 3b. Cek jika teknisi atau timer meminta tidur
    if (webServerMgr.isSleepRequested()) {
      enterDeepSleep();
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
// DEEP SLEEP & DUTY CYCLE ROUTINES
// ==========================================
void enterDeepSleep() {
  if (webServerMgr.isTestModeActive()) {
    Serial.println("ℹ️ [SLEEP DITOLAK] Mode Test 1 Detik sedang aktif. Deep sleep ditunda.");
    return;
  }
  feedWatchdog();
  uint32_t intervalSec = webServerMgr.getSettings().samplingIntervalSec;
  if (intervalSec < 15) intervalSec = 15;

  Serial.printf("\n💤 [SLEEP] Menyiapkan Deep Sleep selama %lu detik (%lu menit)...\n",
    (unsigned long)intervalSec, (unsigned long)(intervalSec / 60));
  Serial.println("   (Tekan tombol BOOT pada GPIO 0 atau reset untuk membuka kembali Web Portal)");
  Serial.flush();

  if (webServerMgr.isApActive()) {
    webServerMgr.stopSoftAP();
  }
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
  esp_wifi_stop();

  esp_sleep_enable_timer_wakeup((uint64_t)intervalSec * 1000000ULL);
  esp_sleep_enable_ext0_wakeup((gpio_num_t)PIN_BOOT_BTN, 0); // Active LOW on GPIO 0

  esp_deep_sleep_start();
}

void executeScheduledSamplingCycle() {
  persistentReadingCount++;
  uint32_t intervalSec = webServerMgr.getSettings().samplingIntervalSec;
  if (intervalSec < 15) intervalSec = 15;

  Serial.printf("\n==================================================\n");
  Serial.printf("⚡ [FAST DUTY CYCLE #%d] Bangun dari Deep Sleep (Interval: %lu dtk)\n",
    persistentReadingCount, (unsigned long)intervalSec);
  Serial.printf("==================================================\n");

  feedWatchdog();
  rtcMgr.begin();
  sdLogger.begin();
  sensor.begin();

  A16Reading reading = sensor.readFilteredDistance(9);
  const char *dataSource = "none";
  CalibrationData calib = mqttMgr.getCalibration();
  float effectiveDist = 0.0f;
  float waterLevel = 0.0f;

  if (reading.isValid) {
    dataSource = (reading.validSamples > 0) ? "live" : "hold";
    effectiveDist = (reading.filteredDistanceCm > 0.0f) ? reading.filteredDistanceCm : reading.rawDistanceCm;
    waterLevel = calib.sensorHeightCm - (effectiveDist * calib.slope + calib.offsetCm);
  } else if (reading.isBlindSpot) {
    dataSource = "blind_spot";
    effectiveDist = 50.0f;
    waterLevel = calib.sensorHeightCm - (effectiveDist * calib.slope + calib.offsetCm);
  } else {
    dataSource = "error";
  }

  LogRecord record;
  memset(&record, 0, sizeof(record));
  time_t now = time(nullptr);
  struct tm timeinfo;
  if (now > 1700000000 && localtime_r(&now, &timeinfo)) {
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
    }
  }

  record.rawDistanceCm = reading.rawDistanceCm;
  record.filteredDistanceCm = effectiveDist;
  record.waterLevelCm = waterLevel;
  record.temperatureC = reading.temperatureC;
  record.isSent = false;

  String filename = webServerMgr.getCurrentLogFilename();
  sdLogger.appendRecord(filename, record);

  DeviceSettings &s = webServerMgr.getSettings();
  if (strlen(s.wifiSsid) > 0) {
    Serial.printf("[WiFi] Menghubungkan ke %s...\n", s.wifiSsid);
    WiFi.mode(WIFI_STA);
    WiFi.begin(s.wifiSsid, s.wifiPass);

    unsigned long wifiStart = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - wifiStart < 12000) {
      delay(200);
      feedWatchdog();
    }

    if (WiFi.status() == WL_CONNECTED) {
      Serial.printf("[WiFi] Terhubung! IP: %s\n", WiFi.localIP().toString().c_str());
      mqttMgr.begin();

      unsigned long mqttStart = millis();
      while (!mqttMgr.isConnected() && millis() - mqttStart < 8000) {
        mqttMgr.loop();
        delay(200);
        feedWatchdog();
      }

      if (mqttMgr.isConnected()) {
        bool ok = mqttMgr.publishReading(record, persistentReadingCount, dataSource);
        if (ok) {
          record.isSent = true;
          sdLogger.markRecordSent(filename, record.timestamp);
          Serial.printf("[MQTT] Data terkirim: Level=%.1f cm | Jarak=%.1f cm\n", waterLevel, reading.rawDistanceCm);
        }
        if (sdLogger.getPendingCount() > 0) {
          mqttMgr.triggerBulkSync(sdLogger);
        }

        // Beri waktu 2.5 dtk untuk mendengarkan pesan MQTT retained (seperti config/interval)
        unsigned long listenStart = millis();
        while (millis() - listenStart < 2500) {
          mqttMgr.loop();
          delay(100);
          feedWatchdog();
        }

        if (webServerMgr.isTestModeActive()) {
          Serial.println("[DUTY CYCLE] Mode Test 1 Detik diaktifkan via MQTT! Me-restart ke mode aktif...");
          delay(200);
          ESP.restart();
          return;
        }
      }
    } else {
      Serial.println("[WiFi] Timeout koneksi. Data tersimpan aman di MicroSD.");
    }
  }

  enterDeepSleep();
}

// ==========================================
// SETUP & INITIALIZATION
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(500);

  // 0. Konfigurasi Timezone WIB (UTC+7)
  setenv("TZ", "WIB-7", 1);
  tzset();

  // 1. Inisialisasi Watchdog & Analisis Boot Reason
  bootStats = handleBootReason();
  initWatchdog();

  // 2. Load settings NVS awal
  webServerMgr.loadSettings();

  // 3. Evaluasi penyebab bangun (Wake Reason)
  esp_sleep_wakeup_cause_t wakeup_reason = esp_sleep_get_wakeup_cause();
  pinMode(PIN_BOOT_BTN, INPUT_PULLUP);

  // Jika bangun murni karena timer Deep Sleep DAN tombol BOOT tidak sedang ditahan:
  if (wakeup_reason == ESP_SLEEP_WAKEUP_TIMER && digitalRead(PIN_BOOT_BTN) == HIGH) {
    executeScheduledSamplingCycle();
    return; // Tidak pernah tercapai karena langsung deep sleep di dalam fungsi
  }

  // Jika sampai sini: Mode Captive Portal Aktif (Cold Boot / Reset / Tombol BOOT ditekan)
  Serial.println("==================================================");
  Serial.println("🌊 " SYSTEM_NAME);
  Serial.println("🏢 " COMPANY_NAME);
  Serial.println("📡 [MODE PORTAL AKTIF] Membuka Captive Portal selama 3 Menit (Window Period)...");
  Serial.println("==================================================");

  rtcMgr.begin();
  sdLogger.begin();
  if (bootStats.isCrashReset) {
    sdLogger.logCrash(bootStats.reasonStr, "Watchdog/Brownout reset detected at startup");
  }
  sensor.begin();

  webServerMgr.begin(&sdLogger);
  mqttMgr.begin();

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
  Serial.println("💡 [TIPS] Tekan 't' di Serial Monitor kapan saja untuk mulai pengujian 1 detik (seperti sensor_test.cpp)!");
}

void loop() {
  feedWatchdog();

  // Monitor perintah serial interaktif (seperti tools/sensor_test.cpp)
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == 't' || c == 'T') {
      Serial.println("\n⚡ [SERIAL CMD] Mengaktifkan Mode Uji Cepat 1 Detik (Durasi 60 detik)...");
      webServerMgr.setTestMode(true, 60);
    } else if (c == 'q' || c == 'Q') {
      Serial.println("\n⏹️ [SERIAL CMD] Menghentikan Mode Uji Cepat, kembali ke siklus normal...");
      webServerMgr.setTestMode(false);
    } else if (c == '?' || c == 'h' || c == 'H') {
      Serial.println("\n--- BANTUAN PERINTAH SERIAL TERRAFLOW ---");
      Serial.println("  't' : Mulai mode pengujian 1 detik seperti sensor_test.cpp (60 dtk)");
      Serial.println("  'q' : Hentikan mode pengujian (kembali ke siklus normal)");
      Serial.println("----------------------------------------");
    }
  }

  if (webServerMgr.isSleepRequested()) {
    enterDeepSleep();
  }
  vTaskDelay(pdMS_TO_TICKS(50));
}
