#include "mqtt_client.h"
#include "config.h"
#include "sensor_a16.h"
#include <esp_task_wdt.h>

MqttManager::MqttManager() : client(wifiClient), lastReconnectAttempt(0) {
  pendingBulk.active = false;
  pendingBulk.sentAtMs = 0;
}

String MqttManager::getTopic(const char *subtopic) {
  String devId = webServerMgr.getEffectiveDeviceId();
  return "terraflow/" + devId + "/" + subtopic;
}

CalibrationData MqttManager::getCalibration() const {
  DeviceSettings &s = webServerMgr.getSettings();
  CalibrationData calib;
  calib.sensorHeightCm = s.sensorHeightCm;
  calib.offsetCm = s.offsetCm;
  calib.slope = s.slope;
  return calib;
}

void MqttManager::begin() {
  DeviceSettings &s = webServerMgr.getSettings();
  wifiClient.setTimeout(10000); // 10.000 ms (Stream::setTimeout menggunakan milidetik)
  client.setServer(s.mqttBroker, s.mqttPort);
  client.setBufferSize(2048); // Expand buffer for JSON bulk payloads
  client.setSocketTimeout(10); // 10 detik (PubSubClient::setSocketTimeout menggunakan detik)

  client.setCallback([this](char *topic, byte *payload, unsigned int length) {
    this->handleMessage(topic, payload, length);
  });
  Serial.printf("[MQTT] Initialized for Broker: %s:%d (Device ID: %s)\n",
    s.mqttBroker, s.mqttPort, webServerMgr.getEffectiveDeviceId().c_str());

  if (!hasCredentials()) {
    Serial.println("[MQTT] ==========================================================");
    Serial.println("[MQTT] PERINGATAN: kredensial broker MQTT KOSONG!");
    Serial.println("[MQTT] Broker TerraFlow mewajibkan username/password, jadi");
    Serial.println("[MQTT] koneksi AKAN DITOLAK. Perbaiki salah satu:");
    Serial.println("[MQTT]   1) firmware/src/config_secrets.h  (lalu build ulang)");
    Serial.println("[MQTT]   2) portal perangkat /settings -> mq_user & mq_pass");
    Serial.println("[MQTT] ==========================================================");
  }
}

bool MqttManager::hasCredentials() const {
  const DeviceSettings &s = webServerMgr.getSettings();
  return strlen(s.mqttUser) > 0 && strlen(s.mqttPass) > 0;
}

void MqttManager::reconfigure() {
  Serial.println("[MQTT] Menerapkan ulang konfigurasi broker (dari portal /settings)...");
  client.disconnect();
  begin();     // setServer() + setCallback() dengan nilai terbaru
  reconnect(); // langsung coba sambung, tanpa perlu restart perangkat
}

void MqttManager::loop() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!client.connected()) {
      unsigned long now = millis();
      if (lastReconnectAttempt == 0 || now - lastReconnectAttempt > 5000) {
        lastReconnectAttempt = (now == 0) ? 1 : now;
        reconnect();
      }
    } else {
      client.loop();
      // Batch yang menunggu ACK terlalu lama -> dianggap gagal dan
      // akan dikirim ulang pada siklus triggerBulkSync berikutnya.
      expireBulkAck();
    }
  }
}

bool MqttManager::isConnected() {
  return WiFi.status() == WL_CONNECTED && client.connected();
}

void MqttManager::reconnect() {
  if (client.connected()) return;

  DeviceSettings &s = webServerMgr.getSettings();
  String devId = webServerMgr.getEffectiveDeviceId();
  String clientId = String("ESP32S3_") + devId + "_" + String(random(0xffff), HEX);

  // LWT status topic
  String willTopic = getTopic("status");
  String willPayload = "{\"device_id\":\"" + devId + "\",\"status\":\"offline\"}";

  Serial.printf("[MQTT] Connecting as '%s' to %s:%d...\n", clientId.c_str(), s.mqttBroker, s.mqttPort);

  esp_task_wdt_reset();
  const char *u = (s.mqttUser[0] != '\0') ? s.mqttUser : nullptr;
  const char *p = (s.mqttPass[0] != '\0') ? s.mqttPass : nullptr;

  bool ok = client.connect(clientId.c_str(), u, p, willTopic.c_str(), 1, false, willPayload.c_str());
  esp_task_wdt_reset();

  if (ok) {
    Serial.println("[MQTT] Connected to broker successfully!");

    // Send online status
    String onlinePayload = "{\"device_id\":\"" + devId + "\",\"status\":\"online\"}";
    client.publish(willTopic.c_str(), onlinePayload.c_str(), true);

    // Subscribe to dynamic commands
    client.subscribe(getTopic("calibration/set").c_str());
    client.subscribe(getTopic("command/restart").c_str());
    client.subscribe(getTopic("command/sync_request").c_str());
    client.subscribe(getTopic("data/bulk/ack").c_str());
    client.subscribe(getTopic("config/interval").c_str());
    client.subscribe(getTopic("command/test_mode").c_str());
    client.subscribe(getTopic("command/sensor_power").c_str());
    client.subscribe(getTopic("command/sleep").c_str());
    
    Serial.printf("[MQTT] Subscribed to commands for '%s'\n", devId.c_str());
  } else {
    Serial.printf("[MQTT ERROR] Connect failed, rc=%d\n", client.state());
  }
}

void MqttManager::handleMessage(char *topic, byte *payload, unsigned int length) {
  char msg[length + 1];
  memcpy(msg, payload, length);
  msg[length] = '\0';

  Serial.printf("[MQTT RECV] %s : %s\n", topic, msg);

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, msg);
  if (err) return;

  String topicStr(topic);
  String calibSetTopic    = getTopic("calibration/set");
  String restartTopic     = getTopic("command/restart");
  String bulkAckTopic     = getTopic("data/bulk/ack");
  String intervalTopic    = getTopic("config/interval");
  String testModeTopic    = getTopic("command/test_mode");
  String sensorPowerTopic = getTopic("command/sensor_power");
  String sleepTopic       = getTopic("command/sleep");

  if (topicStr == sensorPowerTopic) {
    bool enablePower = doc["power"] | (doc["state"].as<int>() == 1);
    if (enablePower) {
      sensor.powerOn();
    } else {
      sensor.powerOff();
    }
    Serial.printf("[MQTT CMD] Sensor Power: %s\n", enablePower ? "ON" : "OFF");

    JsonDocument resp;
    resp["device_id"] = webServerMgr.getEffectiveDeviceId();
    resp["power"] = sensor.isPowered();
    resp["status"] = sensor.isPowered() ? "ON" : "OFF";
    char respBuf[128];
    serializeJson(resp, respBuf);
    client.publish(getTopic("command/sensor_power/response").c_str(), respBuf);
    return;
  }

  if (topicStr == sleepTopic) {
    Serial.println("[MQTT CMD] Deep Sleep command received. Memasuki mode hemat daya...");
    JsonDocument resp;
    resp["device_id"] = webServerMgr.getEffectiveDeviceId();
    resp["status"] = "entering_sleep";
    char respBuf[128];
    serializeJson(resp, respBuf);
    client.publish(getTopic("command/sleep/response").c_str(), respBuf);
    delay(100);
    webServerMgr.requestSleep();
    return;
  }

  if (topicStr == bulkAckTopic) {
    handleBulkAck(doc);
    return;
  }

  if (topicStr == testModeTopic) {
    bool enable = doc["test_mode"] | doc["enabled"] | false;
    uint32_t dur = doc["duration_sec"].is<uint32_t>() ? doc["duration_sec"].as<uint32_t>() : 300;
    webServerMgr.setTestMode(enable, dur);
    if (enable) {
      webServerMgr.extendPortalWindow(dur + 60);
    }
    Serial.printf("[MQTT CMD] Test Mode: %s (Durasi: %lu dtk)\n",
      enable ? "AKTIF (Stream 1 Detik)" : "NONAKTIF", (unsigned long)dur);

    JsonDocument resp;
    resp["device_id"] = webServerMgr.getEffectiveDeviceId();
    resp["test_mode"] = enable;
    resp["duration_sec"] = dur;
    resp["status"] = enable ? "active" : "standby";
    char respBuf[256];
    serializeJson(resp, respBuf);
    client.publish(getTopic("command/test_mode/response").c_str(), respBuf);
    return;
  }

  if (topicStr == intervalTopic) {
    uint32_t newInterval = 0;
    if (doc["sampling_interval_sec"].is<uint32_t>()) {
      newInterval = doc["sampling_interval_sec"].as<uint32_t>();
    } else if (doc["interval_sec"].is<uint32_t>()) {
      newInterval = doc["interval_sec"].as<uint32_t>();
    } else if (doc["interval_min"].is<uint32_t>()) {
      newInterval = doc["interval_min"].as<uint32_t>() * 60;
    }

    if (newInterval >= 15 && newInterval <= 86400) {
      webServerMgr.setSamplingInterval(newInterval);
      Serial.printf("[MQTT CONFIG] Sampling interval diperbarui dari broker: %lu detik\n",
        (unsigned long)newInterval);
    }
    return;
  }

  if (topicStr == calibSetTopic) {
    DeviceSettings &s = webServerMgr.getSettings();
    float newHeight = s.sensorHeightCm;
    float newOffset = s.offsetCm;
    float newSlope  = s.slope;

    if (doc["sensor_height_cm"].is<float>()) {
      newHeight = doc["sensor_height_cm"];
    }
    if (doc["offset_cm"].is<float>()) {
      newOffset = doc["offset_cm"];
    }
    if (doc["slope"].is<float>()) {
      newSlope = doc["slope"];
    }

    webServerMgr.updateCalibration(newHeight, newOffset, newSlope);
    Serial.printf("[CALIBRATION] Applied from MQTT: Height=%.1f, Offset=%.2f, Slope=%.6f\n",
      newHeight, newOffset, newSlope);

    // Respond back
    JsonDocument resp;
    resp["device_id"] = webServerMgr.getEffectiveDeviceId();
    resp["status"] = "applied";
    resp["sensor_height_cm"] = newHeight;
    resp["offset_cm"] = newOffset;
    resp["slope"] = newSlope;

    char respBuf[256];
    serializeJson(resp, respBuf);
    client.publish(getTopic("calibration/response").c_str(), respBuf);
  } else if (topicStr == restartTopic) {
    Serial.println("[CMD] Remote reboot request received! Rebooting in 500ms...");
    delay(500);
    esp_restart();
  }
}

bool MqttManager::publishReading(const LogRecord &record, int readingCount, const char *source,
                                 const char *sensorError) {
  if (!isConnected()) return false;

  String devId = webServerMgr.getEffectiveDeviceId();
  JsonDocument doc;
  doc["device_id"] = devId;
  doc["timestamp"] = record.timestamp;
  doc["raw_distance_cm"] = record.rawDistanceCm;
  doc["raw_distance_mm"] = (uint32_t)(record.rawDistanceCm * 10.0f);
  doc["filtered_distance_cm"] = record.filteredDistanceCm;
  doc["water_level_cm"] = record.waterLevelCm;
  doc["temperature_c"] = record.temperatureC;
  doc["signal_quality"] = WiFi.RSSI();

  // Status MicroSD yang SEBENARNYA. Sebelumnya di-hardcode "ok", sehingga
  // kartu yang tidak terpasang pun dilaporkan sehat dan teknisi dikirim
  // mencari penyebab lain. getSdStatus() dijamin <= 10 karakter.
  doc["sd_status"] = sdLogger.getSdStatus();
  doc["write_fail_count"] = sdLogger.getWriteFailCount();

  doc["reading_count"] = readingCount;
  doc["source"] = source;
  doc["is_test"] = webServerMgr.isTestModeActive();

  // Penyebab spesifik kegagalan sensor, hanya disertakan bila ada - supaya
  // payload siklus normal tidak membengkak.
  if (sensorError && sensorError[0]) {
    doc["sensor_error"] = sensorError;
  }

  TelemetrySnapshot snap = webServerMgr.getTelemetry();
  doc["spread_cm"] = snap.spreadCm;
  doc["valid_samples"] = snap.validSamples;

  char buf[640];
  size_t len = serializeJson(doc, buf, sizeof(buf));
  if (len == 0 || len >= sizeof(buf) - 1) {
    Serial.printf("[MQTT PERINGATAN] Payload reading terpotong (%u byte)! Data siklus ini tidak dikirim.\n",
      (unsigned)len);
    return false;
  }
  return client.publish(getTopic("data").c_str(), buf);
}

bool MqttManager::publishAlert(const String &code, const String &severity, const String &message, const String &detailsJson) {
  if (!isConnected()) return false;

  String devId = webServerMgr.getEffectiveDeviceId();
  JsonDocument doc;
  doc["device_id"] = devId;
  doc["timestamp"] = millis() / 1000;
  doc["alert_code"] = code;
  doc["severity"] = severity;
  doc["message"] = message;

  JsonDocument detailsDoc;
  deserializeJson(detailsDoc, detailsJson);
  doc["details"] = detailsDoc;

  char buf[512];
  serializeJson(doc, buf);
  return client.publish(getTopic("alert").c_str(), buf);
}

bool MqttManager::publishDiagnostics(const BootStats &stats, int pendingCount, const char *sensorError) {
  if (!isConnected()) return false;

  String devId = webServerMgr.getEffectiveDeviceId();
  JsonDocument doc;
  doc["device_id"] = devId;

  // Epoch sebenarnya, bukan millis()/1000. Nilai lama tidak berguna sebagai
  // timestamp: di mode duty-cycle millis() reset setiap bangun, sehingga
  // seluruh baris diagnostik tercatat beberapa detik setelah 1970.
  time_t now = time(nullptr);
  doc["timestamp"] = (now > 1700000000) ? (uint32_t)now : 0;
  doc["uptime_sec"] = millis() / 1000;

  doc["boot_reason"] = stats.reasonStr;
  doc["boot_count"] = stats.bootCount;   // Boot sebenarnya (tidak lagi dinaikkan tiap wake)
  doc["wake_count"] = stats.wakeCount;   // Bangun normal dari deep sleep
  doc["watchdog_count"] = stats.watchdogCount;
  doc["brownout_count"] = stats.brownoutCount;
  doc["panic_count"] = stats.panicCount; // Sebelumnya di-hardcode 0

  doc["free_heap_bytes"] = esp_get_free_heap_size();
  doc["wifi_rssi"] = WiFi.RSSI();

  // Status nyata, sebelumnya ketiganya di-hardcode. Endpoint diagnostik yang
  // selalu melaporkan sehat lebih buruk daripada tidak ada diagnostik sama
  // sekali - ia mengirim teknisi mencari di tempat yang salah.
  doc["sd_card_ok"] = sdLogger.isReady();
  doc["sd_status"] = sdLogger.getSdStatus();
  doc["write_fail_count"] = sdLogger.getWriteFailCount();
  doc["sensor_ok"] = (sensor.getConsecutiveFailures() == 0);
  doc["sensor_fail_streak"] = sensor.getConsecutiveFailures();
  doc["sensor_power_on"] = sensor.isPowered();
  if (sensorError && sensorError[0]) {
    doc["sensor_error"] = sensorError;
  }

  // Suhu die ESP32 - BUKAN suhu ambient. Saat radio aktif nilainya 10-25 C
  // di atas suhu lingkungan, jadi jangan dipakai untuk analisa hidrologi.
  doc["esp_temp_c"] = temperatureRead();
  doc["pending_unsent"] = pendingCount;
  doc["firmware_version"] = FIRMWARE_VERSION;

  char buf[1024];
  size_t len = serializeJson(doc, buf, sizeof(buf));
  if (len == 0 || len >= sizeof(buf) - 1) {
    Serial.printf("[MQTT PERINGATAN] Payload diagnostik terpotong (%u byte)!\n", (unsigned)len);
    return false;
  }
  return client.publish(getTopic("diagnostics").c_str(), buf);
}

void MqttManager::triggerBulkSync(SdCardLogger &sdLogger) {
  if (!isConnected()) return;

  // Jangan kirim batch baru selagi masih menunggu ACK batch sebelumnya -
  // yang lama akan kedaluwarsa lewat expireBulkAck() dan dikirim ulang.
  if (pendingBulk.active) {
    return;
  }

  String currentFilename = webServerMgr.getCurrentLogFilename();
  std::vector<LogRecord> unsent = sdLogger.getUnsentRecords(currentFilename.c_str(), BULK_CHUNK_SIZE);
  if (unsent.empty()) return;

  String devId = webServerMgr.getEffectiveDeviceId();
  Serial.printf("[BULK SYNC] Syncing %d buffered records from %s for %s...\n", unsent.size(), currentFilename.c_str(), devId.c_str());

  String fileDate = currentFilename;
  if (fileDate.endsWith(".csv")) {
    fileDate = fileDate.substring(0, fileDate.length() - 4);
  }

  JsonDocument doc;
  doc["device_id"] = devId;
  const String batchId = String("BATCH_") + String(millis());
  doc["batch_id"] = batchId;
  doc["chunk"] = 1;
  doc["total_chunks"] = 1;
  doc["source"] = "sd_buffer";
  doc["file_date"] = fileDate;

  JsonArray records = doc["records"].to<JsonArray>();
  std::vector<uint32_t> batchTimestamps;
  for (const auto &r : unsent) {
    JsonObject obj = records.add<JsonObject>();
    obj["timestamp"] = r.timestamp;
    obj["raw_distance_cm"] = r.rawDistanceCm;
    obj["water_level_cm"] = r.waterLevelCm;
    obj["temperature_c"] = r.temperatureC;
    batchTimestamps.push_back(r.timestamp);
  }

  char buf[2048];
  serializeJson(doc, buf);
  bool ok = client.publish(getTopic("data/bulk").c_str(), buf);
  if (ok) {
    // PENTING: record BELUM ditandai terkirim di sini. Penandaan hanya
    // dilakukan setelah server membalas ACK lewat terraflow/{id}/data/bulk/ack.
    // Bila ACK tidak pernah datang, record tetap pending dan dikirim ulang
    // pada siklus berikutnya - tidak ada data yang hilang diam-diam.
    pendingBulk.active = true;
    pendingBulk.batchId = batchId;
    pendingBulk.filename = currentFilename;
    pendingBulk.timestamps = batchTimestamps;
    pendingBulk.sentAtMs = millis();
    Serial.printf("[BULK SYNC] Terkirim %d baris (batch %s), menunggu ACK server...\n",
      (int)unsent.size(), batchId.c_str());
  }
  delay(BULK_THROTTLE_MS);
}

// ------------------------------------------------------------
//  Handler ACK sinkronisasi bulk
// ------------------------------------------------------------
void MqttManager::handleBulkAck(JsonDocument &doc) {
  const String status = doc["status"] | "error";
  const String ackBatchId = doc["batch_id"] | "";

  if (!pendingBulk.active) {
    Serial.println("[BULK ACK] ACK diterima tanpa batch tertunda - diabaikan.");
    return;
  }
  if (!ackBatchId.isEmpty() && ackBatchId != pendingBulk.batchId) {
    Serial.printf("[BULK ACK] batch_id tidak cocok (terkirim: %s, ack: %s) - diabaikan.\n",
      pendingBulk.batchId.c_str(), ackBatchId.c_str());
    return;
  }

  if (status == "error") {
    Serial.printf("[BULK ACK] Server gagal menyimpan batch %s - record akan dikirim ulang.\n",
      pendingBulk.batchId.c_str());
    pendingBulk.active = false;
    pendingBulk.timestamps.clear();
    return;
  }

  // Timestamp yang gagal disimpan - hanya yang ini yang perlu dikirim ulang.
  std::vector<uint32_t> failed;
  JsonArray failedArr = doc["failed_timestamps"];
  if (!failedArr.isNull()) {
    for (JsonVariant v : failedArr) {
      failed.push_back((uint32_t)(long)v.as<long>());
    }
  }

  int marked = 0;
  SdCardLogger *sdLogger = webServerMgr.getSdLogger();
  for (uint32_t ts : pendingBulk.timestamps) {
    bool isFailed = false;
    for (uint32_t f : failed) {
      if (f == ts) { isFailed = true; break; }
    }
    if (isFailed) continue;
    // Tandai terkirim di ledger MicroSD
    if (sdLogger && sdLogger->markRecordSent(pendingBulk.filename, ts)) {
      marked++;
    }
  }

  Serial.printf("[BULK ACK] Batch %s: %d record ditandai terkirim, %d gagal (total pending: %d)\n",
    pendingBulk.batchId.c_str(), marked, (int)failed.size(),
    sdLogger ? sdLogger->getPendingCount() : -1);

  pendingBulk.active = false;
  pendingBulk.timestamps.clear();
}

// ------------------------------------------------------------
//  Kadaluarsa ACK - batch dianggap gagal agar dikirim ulang
// ------------------------------------------------------------
void MqttManager::expireBulkAck() {
  if (!pendingBulk.active) return;
  if (millis() - pendingBulk.sentAtMs < BULK_ACK_TIMEOUT_MS) return;

  Serial.printf("[BULK ACK] Timeout %lu ms menunggu ACK batch %s - akan dikirim ulang.\n",
    (unsigned long)BULK_ACK_TIMEOUT_MS, pendingBulk.batchId.c_str());
  pendingBulk.active = false;
  pendingBulk.timestamps.clear();
}
