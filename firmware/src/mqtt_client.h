#ifndef MQTT_CLIENT_H
#define MQTT_CLIENT_H

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include "sdcard_logger.h"

struct CalibrationData {
  float sensorHeightCm;
  float offsetCm;
  float slope;
};

class MqttManager {
public:
  MqttManager();
  void begin();
  void loop();
  bool isConnected();
  
  bool publishReading(const LogRecord &record, int readingCount);
  bool publishAlert(const String &code, const String &severity, const String &message, const String &detailsJson = "{}");
  bool publishDiagnostics(const String &bootReason, int bootCount, int wdtCount, float battV, int pendingCount);
  
  void triggerBulkSync(SdCardLogger &sdLogger);
  CalibrationData getCalibration() const { return calibration; }

private:
  WiFiClient wifiClient;
  PubSubClient client;
  Preferences prefs;
  CalibrationData calibration;
  
  void reconnect();
  void handleMessage(char *topic, byte *payload, unsigned int length);
  void saveCalibrationToNvs();
  void loadCalibrationFromNvs();
};

#endif // MQTT_CLIENT_H
