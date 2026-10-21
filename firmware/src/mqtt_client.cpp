#include "mqtt_client.h"
#include "config.h"
#include <esp_task_wdt.h>

MqttManager::MqttManager() : client(wifiClient), lastReconnectAttempt(0) {}

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
  wifiClient.setTimeout(3);
  client.setServer(s.mqttBroker, s.mqttPort);
  client.setBufferSize(2048); // Expand buffer for JSON bulk payloads
  client.setSocketTimeout(3);

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
      if (now - lastReconnectAttempt > 10000) {
        lastReconnectAttempt = now;
        reconnect();
      }
    } else {
      client.loop();
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
  String calibSetTopic = getTopic("calibration/set");
  String restartTopic  = getTopic("command/restart");

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

bool MqttManager::publishReading(const LogRecord &record, int readingCount, const char *source) {
  if (!isConnected()) return false;

  String devId = webServerMgr.getEffectiveDeviceId();
  JsonDocument doc;
  doc["device_id"] = devId;
  doc["timestamp"] = record.timestamp;
  doc["raw_distance_cm"] = record.rawDistanceCm;
  doc["water_level_cm"] = record.waterLevelCm;
  doc["temperature_c"] = record.temperatureC;
  doc["signal_quality"] = WiFi.RSSI();
  doc["sd_status"] = "ok";
  doc["reading_count"] = readingCount;
  doc["source"] = source;

  char buf[512];
  serializeJson(doc, buf);
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

bool MqttManager::publishDiagnostics(const String &bootReason, int bootCount, int wdtCount, int pendingCount) {
  if (!isConnected()) return false;

  String devId = webServerMgr.getEffectiveDeviceId();
  JsonDocument doc;
  doc["device_id"] = devId;
  doc["timestamp"] = millis() / 1000;
  doc["boot_reason"] = bootReason;
  doc["uptime_sec"] = millis() / 1000;
  doc["boot_count"] = bootCount;
  doc["watchdog_count"] = wdtCount;
  doc["brownout_count"] = 0;
  doc["panic_count"] = 0;
  doc["free_heap_bytes"] = esp_get_free_heap_size();
  doc["wifi_rssi"] = WiFi.RSSI();
  doc["sd_card_ok"] = true;
  doc["sensor_ok"] = true;
  doc["demo_mode"] = false;
  doc["esp_temp_c"] = temperatureRead();
  doc["pending_unsent"] = pendingCount;
  doc["firmware_version"] = FIRMWARE_VERSION;

  char buf[768];
  serializeJson(doc, buf);
  return client.publish(getTopic("diagnostics").c_str(), buf);
}

void MqttManager::triggerBulkSync(SdCardLogger &sdLogger) {
  if (!isConnected()) return;

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
  doc["batch_id"] = String("BATCH_") + String(millis());
  doc["chunk"] = 1;
  doc["total_chunks"] = 1;
  doc["source"] = "sd_buffer";
  doc["file_date"] = fileDate;

  JsonArray records = doc["records"].to<JsonArray>();
  for (const auto &r : unsent) {
    JsonObject obj = records.add<JsonObject>();
    obj["timestamp"] = r.timestamp;
    obj["raw_distance_cm"] = r.rawDistanceCm;
    obj["water_level_cm"] = r.waterLevelCm;
    obj["temperature_c"] = r.temperatureC;
  }

  char buf[2048];
  serializeJson(doc, buf);
  bool ok = client.publish(getTopic("data/bulk").c_str(), buf);
  if (ok) {
    sdLogger.decrementPending(unsent.size());
    Serial.printf("[BULK SYNC] Sukses mengirim %d baris buffered data. Sisa pending: %d\n",
      (int)unsent.size(), sdLogger.getPendingCount());
  }
  delay(BULK_THROTTLE_MS);
}
