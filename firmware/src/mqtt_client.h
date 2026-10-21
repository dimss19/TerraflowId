#ifndef MQTT_CLIENT_H
#define MQTT_CLIENT_H

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "sdcard_logger.h"
#include "web_server_mgr.h"

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

  // Terapkan ulang konfigurasi broker (dipanggil bila pengaturan portal berubah)
  void reconfigure();

  // True bila kredensial broker tersedia (kosong = broker akan menolak koneksi)
  bool hasCredentials() const;
  
  bool publishReading(const LogRecord &record, int readingCount, const char *source = "live");
  bool publishAlert(const String &code, const String &severity, const String &message, const String &detailsJson = "{}");
  bool publishDiagnostics(const String &bootReason, int bootCount, int wdtCount, int pendingCount);
  
  void triggerBulkSync(SdCardLogger &sdLogger);
  CalibrationData getCalibration() const;

private:
  WiFiClient wifiClient;
  PubSubClient client;
  unsigned long lastReconnectAttempt;
  
  void reconnect();
  void handleMessage(char *topic, byte *payload, unsigned int length);
  
  // Topic helpers
  String getTopic(const char *subtopic);
};

#endif // MQTT_CLIENT_H
