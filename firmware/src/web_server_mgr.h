#ifndef WEB_SERVER_MGR_H
#define WEB_SERVER_MGR_H

#include <Arduino.h>
#include <WiFi.h>
#include <DNSServer.h>
#include <ESPAsyncWebServer.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include "config.h"
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
  char passHash[65];
  bool isProvisioned;
};

// Struct for live telemetry shared with Web UI
struct TelemetrySnapshot {
  float waterLevelCm;
  float rawDistanceCm;
  float filteredDistanceCm;
  float temperatureC;
  int signalRssi;
  bool sdCardOk;
  int pendingLogs;
  int readingCount;
  bool wifiConnected;
  bool mqttConnected;
  char dataSource[16]; // "live", "paused"
  char lastSampleTime[32];
  int portalRemainingSec;
  uint32_t samplingIntervalSec;
};

class WebServerManager {
public:
  WebServerManager();
  void begin(SdCardLogger *logger);
  void loop();

  // Thread-safe telemetry updates
  void updateTelemetry(const TelemetrySnapshot &snapshot);
  TelemetrySnapshot getTelemetry();

  // Settings & Calibration accessors
  DeviceSettings& getSettings() { return settings; }
  void updateCalibration(float height, float offset, float slope);
  void setSamplingInterval(uint32_t sec);

  // Akses ke logger MicroSD (dipakai MqttManager untuk menandai record
  // terkirim setelah server mengonfirmasi lewat ACK).
  SdCardLogger* getSdLogger() const { return sdLoggerRef; }

  void loadSettings();
  void saveSettings();
  void factoryReset();
  bool isProvisioned() const { return settings.isProvisioned; }
  String getEffectiveDeviceId();
  String getSoftApSsid();
  String getCurrentLogFilename();

  // Kontrol SoftAP & Mode Tidur
  void startSoftAP();
  void stopSoftAP();
  bool isApActive() const { return apActive; }
  bool isSleepRequested() const { return sleepRequested; }
  void requestSleep() { sleepRequested = true; }
  int getRemainingPortalSec();
  void extendPortalWindow(uint32_t seconds = PORTAL_WINDOW_SEC);
  bool isPortalWindowActive() const { return portalWindowActive; }

  // Test Mode (Streaming data setiap detik seperti uji laboratorium/lapangan)
  bool isTestModeActive();
  void setTestMode(bool active, uint32_t durationSec = 300);
  int getRemainingTestSec();

  // Dipanggil true bila pengaturan broker MQTT berubah lewat portal.
  // Main loop mengambil flag ini lalu meminta MqttManager menerapkan
  // ulang konfigurasi, sehingga tidak perlu restart perangkat.
  bool consumeMqttConfigDirty() {
    bool v = mqttConfigDirty;
    mqttConfigDirty = false;
    return v;
  }

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
  bool mqttConfigDirty;

  bool sleepRequested;
  unsigned long portalStartMs;
  bool portalWindowActive;

  // Test Mode Fields
  bool testModeActive;
  unsigned long testModeStartMs;
  uint32_t testModeDurationSec;

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
