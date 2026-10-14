#ifndef WEB_SERVER_MGR_H
#define WEB_SERVER_MGR_H

#include <Arduino.h>
#include <WiFi.h>
#include <DNSServer.h>
#include <ESPAsyncWebServer.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include "sdcard_logger.h"

// Struct for complete device configuration persisted in NVS
struct DeviceSettings {
  char deviceId[33];
  char deviceName[65];
  char wifiSsid[33];
  char wifiPass[65];
  char mqttBroker[65];
  uint16_t mqttPort;
  char mqttUser[33];
  char mqttPass[65];
  float sensorHeightCm;
  float offsetCm;
  float slope;
  uint32_t samplingIntervalSec;
  bool realSensorEnabled;    // Mode 1: Real sensor A16 ON/OFF
  bool dummySensorEnabled;   // Mode 2: Dummy simulation ON/OFF
  char passHash[65];
};

// Struct for live telemetry shared with Web UI
struct TelemetrySnapshot {
  float waterLevelCm;
  float rawDistanceCm;
  float filteredDistanceCm;
  float temperatureC;
  float batteryVoltage;
  int batteryPercent;
  int signalRssi;
  bool sdCardOk;
  int pendingLogs;
  int readingCount;
  bool wifiConnected;
  bool mqttConnected;
  char dataSource[16]; // "live", "dummy", "paused"
  char lastSampleTime[32];
};

class WebServerManager {
public:
  WebServerManager();
  void begin(SdCardLogger *logger);
  void loop();

  // Thread-safe telemetry updates
  void updateTelemetry(const TelemetrySnapshot &snapshot);
  TelemetrySnapshot getTelemetry();

  // Settings & Operational Mode accessors
  DeviceSettings& getSettings() { return settings; }
  bool isRealSensorEnabled() const { return settings.realSensorEnabled; }
  bool isDummySensorEnabled() const { return settings.dummySensorEnabled; }
  void setRealSensorEnabled(bool en);
  void setDummySensorEnabled(bool en);
  void updateCalibration(float height, float offset, float slope);

  void loadSettings();
  void saveSettings();
  String getEffectiveDeviceId();
  String getSoftApSsid();
  String getCurrentLogFilename();

private:
  DNSServer dnsServer;
  AsyncWebServer server;
  Preferences prefs;
  DeviceSettings settings;
  TelemetrySnapshot telemetry;
  portMUX_TYPE telemetryMux;
  SdCardLogger *sdLoggerRef;

  char sessionToken[65];
  unsigned long sessionStart;
  bool apActive;
  unsigned long lastStaRetryMs;
  bool ntpConfigured;

  void startSoftAP();
  void stopSoftAP();
  void setupRoutes();
  bool isSessionValid(AsyncWebServerRequest *req);
  void generateSession();
  void clearSession();
  void loadSession();
  void saveSession();
  static void sha256Hex(const char *input, char *output);
  void syncNtp();
};

extern WebServerManager webServerMgr;

#endif // WEB_SERVER_MGR_H
