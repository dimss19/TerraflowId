#include "mqtt_client.h"
#include "config.h"

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
  client.setServer(s.mqttBroker, s.mqttPort);
  client.setBufferSize(2048); // Expand buffer for JSON bulk payloads

  client.setCallback([this](char *topic, byte *payload, unsigned int length) {
    this->handleMessage(topic, payload, length);
  });
  Serial.printf("[MQTT] Initialized for Broker: %s:%d (Device ID: %s)\n",
    s.mqttBroker, s.mqttPort, webServerMgr.getEffectiveDeviceId().c_str());
}

void MqttManager::loop() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!client.connected()) {
      unsigned long now = millis();
      if (now - lastReconnectAttempt > 5000) {
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

  if (client.connect(clientId.c_str(), s.mqttUser, s.mqttPass, willTopic.c_str(), 1, false, willPayload.c_str())) {
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
  doc["battery_voltage"] = record.batteryVoltage;
  doc["battery_percent"] = record.batteryPercent;
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

bool MqttManager::publishDiagnostics(const String &bootReason, int bootCount, int wdtCount, float battV, int pendingCount) {
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
  doc["sensor_ok"] = webServerMgr.isRealSensorEnabled();
  doc["demo_mode"] = webServerMgr.isDummySensorEnabled();
  doc["battery_voltage"] = battV;
  doc["esp_temp_c"] = temperatureRead();
  doc["pending_unsent"] = pendingCount;
  doc["firmware_version"] = FIRMWARE_VERSION;

  char buf[768];
  serializeJson(doc, buf);
  return client.publish(getTopic("diagnostics").c_str(), buf);
}

void MqttManager::triggerBulkSync(SdCardLogger &sdLogger) {
  if (!isConnected()) return;

  std::vector<LogRecord> unsent = sdLogger.getUnsentRecords("2026-10-07.csv", BULK_CHUNK_SIZE);
  if (unsent.empty()) return;

  String devId = webServerMgr.getEffectiveDeviceId();
  Serial.printf("[BULK SYNC] Syncing %d buffered records for %s...\n", unsent.size(), devId.c_str());

  JsonDocument doc;
  doc["device_id"] = devId;
  doc["batch_id"] = String("BATCH_") + String(millis());
  doc["chunk"] = 1;
  doc["total_chunks"] = 1;
  doc["source"] = "sd_buffer";
  doc["file_date"] = "2026-10-07";

  JsonArray records = doc["records"].to<JsonArray>();
  for (const auto &r : unsent) {
    JsonObject obj = records.add<JsonObject>();
    obj["timestamp"] = r.timestamp;
    obj["raw_distance_cm"] = r.rawDistanceCm;
    obj["water_level_cm"] = r.waterLevelCm;
    obj["temperature_c"] = r.temperatureC;
    obj["battery_voltage"] = r.batteryVoltage;
    obj["battery_percent"] = r.batteryPercent;
  }

  char buf[2048];
  serializeJson(doc, buf);
  client.publish(getTopic("data/bulk").c_str(), buf);
  delay(BULK_THROTTLE_MS);
}
