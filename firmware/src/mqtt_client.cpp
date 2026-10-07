#include "mqtt_client.h"
#include "config.h"

MqttManager::MqttManager() : client(wifiClient) {
  calibration.sensorHeightCm = DEFAULT_SENSOR_HEIGHT;
  calibration.offsetCm = DEFAULT_OFFSET;
  calibration.slope = DEFAULT_SLOPE;
}

void MqttManager::begin() {
  loadCalibrationFromNvs();

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[WIFI] Connecting to SSID: %s\n", WIFI_SSID);

  client.setServer(MQTT_BROKER, MQTT_PORT);
  client.setBufferSize(2048); // Expand buffer for JSON bulk payloads

  client.setCallback([this](char *topic, byte *payload, unsigned int length) {
    this->handleMessage(topic, payload, length);
  });
}

void MqttManager::loop() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!client.connected()) {
      reconnect();
    }
    client.loop();
  }
}

bool MqttManager::isConnected() {
  return WiFi.status() == WL_CONNECTED && client.connected();
}

void MqttManager::reconnect() {
  if (client.connected()) return;

  Serial.println("[MQTT] Attempting broker connection...");
  String clientId = String("ESP32S3_") + DEVICE_ID + "_" + String(random(0xffff), HEX);

  // LWT status topic
  String willTopic = TOPIC_STATUS;
  String willPayload = "{\"device_id\":\"" DEVICE_ID "\",\"status\":\"offline\"}";

  if (client.connect(clientId.c_str(), MQTT_USER, MQTT_PASS, willTopic.c_str(), 1, false, willPayload.c_str())) {
    Serial.println("[MQTT] Connected to broker successfully!");

    // Send online status
    client.publish(TOPIC_STATUS, "{\"device_id\":\"" DEVICE_ID "\",\"status\":\"online\"}", true);

    // Subscribe to commands
    client.subscribe(TOPIC_CALIB_SET);
    client.subscribe(TOPIC_CMD_RESTART);
    client.subscribe(TOPIC_CMD_SYNC);
    client.subscribe(TOPIC_DATA_BULK_ACK);
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

  if (String(topic) == TOPIC_CALIB_SET) {
    if (doc["sensor_height_cm"].is<float>()) {
      calibration.sensorHeightCm = doc["sensor_height_cm"];
    }
    if (doc["offset_cm"].is<float>()) {
      calibration.offsetCm = doc["offset_cm"];
    }
    if (doc["slope"].is<float>()) {
      calibration.slope = doc["slope"];
    }

    saveCalibrationToNvs();
    Serial.printf("[CALIBRATION] Updated: Height=%.1f, Offset=%.2f, Slope=%.6f\n",
      calibration.sensorHeightCm, calibration.offsetCm, calibration.slope);

    // Respond back
    JsonDocument resp;
    resp["device_id"] = DEVICE_ID;
    resp["status"] = "applied";
    resp["sensor_height_cm"] = calibration.sensorHeightCm;
    resp["offset_cm"] = calibration.offsetCm;
    resp["slope"] = calibration.slope;

    char respBuf[256];
    serializeJson(resp, respBuf);
    client.publish(TOPIC_CALIB_RESP, respBuf);
  } else if (String(topic) == TOPIC_CMD_RESTART) {
    Serial.println("[CMD] Remote reboot request received! Rebooting...");
    delay(500);
    esp_restart();
  }
}

bool MqttManager::publishReading(const LogRecord &record, int readingCount) {
  if (!isConnected()) return false;

  JsonDocument doc;
  doc["device_id"] = DEVICE_ID;
  doc["timestamp"] = record.timestamp;
  doc["raw_distance_cm"] = record.rawDistanceCm;
  doc["water_level_cm"] = record.waterLevelCm;
  doc["temperature_c"] = record.temperatureC;
  doc["battery_voltage"] = record.batteryVoltage;
  doc["battery_percent"] = record.batteryPercent;
  doc["signal_quality"] = WiFi.RSSI();
  doc["sd_status"] = "ok";
  doc["reading_count"] = readingCount;
  doc["source"] = "live";

  char buf[512];
  serializeJson(doc, buf);
  return client.publish(TOPIC_DATA, buf);
}

bool MqttManager::publishAlert(const String &code, const String &severity, const String &message, const String &detailsJson) {
  if (!isConnected()) return false;

  JsonDocument doc;
  doc["device_id"] = DEVICE_ID;
  doc["timestamp"] = millis() / 1000;
  doc["alert_code"] = code;
  doc["severity"] = severity;
  doc["message"] = message;

  JsonDocument detailsDoc;
  deserializeJson(detailsDoc, detailsJson);
  doc["details"] = detailsDoc;

  char buf[512];
  serializeJson(doc, buf);
  return client.publish(TOPIC_ALERT, buf);
}

bool MqttManager::publishDiagnostics(const String &bootReason, int bootCount, int wdtCount, float battV, int pendingCount) {
  if (!isConnected()) return false;

  JsonDocument doc;
  doc["device_id"] = DEVICE_ID;
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
  doc["battery_voltage"] = battV;
  doc["esp_temp_c"] = temperatureRead();
  doc["pending_unsent"] = pendingCount;
  doc["firmware_version"] = FIRMWARE_VERSION;

  char buf[768];
  serializeJson(doc, buf);
  return client.publish(TOPIC_DIAGNOSTICS, buf);
}

void MqttManager::triggerBulkSync(SdCardLogger &sdLogger) {
  if (!isConnected()) return;

  std::vector<LogRecord> unsent = sdLogger.getUnsentRecords("2026-10-07.csv", BULK_CHUNK_SIZE);
  if (unsent.empty()) return;

  Serial.printf("[BULK SYNC] Syncing %d buffered records...\n", unsent.size());

  JsonDocument doc;
  doc["device_id"] = DEVICE_ID;
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
  client.publish(TOPIC_DATA_BULK, buf);
  delay(BULK_THROTTLE_MS);
}

void MqttManager::saveCalibrationToNvs() {
  prefs.begin("terraflow", false);
  prefs.putFloat("height", calibration.sensorHeightCm);
  prefs.putFloat("offset", calibration.offsetCm);
  prefs.putFloat("slope", calibration.slope);
  prefs.end();
}

void MqttManager::loadCalibrationFromNvs() {
  prefs.begin("terraflow", true);
  calibration.sensorHeightCm = prefs.getFloat("height", DEFAULT_SENSOR_HEIGHT);
  calibration.offsetCm = prefs.getFloat("offset", DEFAULT_OFFSET);
  calibration.slope = prefs.getFloat("slope", DEFAULT_SLOPE);
  prefs.end();
  Serial.printf("[NVS] Loaded Calibration: Height=%.1f, Offset=%.2f, Slope=%.6f\n",
    calibration.sensorHeightCm, calibration.offsetCm, calibration.slope);
}
