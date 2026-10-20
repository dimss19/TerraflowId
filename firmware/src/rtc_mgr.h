#ifndef RTC_MGR_H
#define RTC_MGR_H

#include <Arduino.h>
#include <Wire.h>
#include <time.h>
#include <sys/time.h>

class RtcManager {
public:
  RtcManager();

  // Lifecycle
  bool begin();
  bool isPresent() const { return rtcDetected; }
  float getTemperature() const { return lastTemperature; }

  // Bus arbitrase (Time-multiplexing dengan UART Sensor pada GPIO 8 & 9)
  void acquireBus();
  void releaseBus();

  // Pembacaan & Pengaturan Waktu
  bool readDateTime(struct tm &timeinfo);
  bool setDateTime(const struct tm &timeinfo);
  bool setEpochTime(time_t epochSec);

  // Sinkronisasi
  bool syncSystemTime();   // Salin waktu RTC ke internal POSIX time ESP32
  bool syncFromSystem();   // Salin internal POSIX / NTP time ke RTC

  // Diagnostik & String Formatter
  String getIsoTimestamp();
  String getStatusJson();

private:
  bool rtcDetected;
  bool busAcquired;
  float lastTemperature;

  static uint8_t bcdToDec(uint8_t val);
  static uint8_t decToBcd(uint8_t val);
  bool probeDevice();
};

extern RtcManager rtcMgr;

#endif // RTC_MGR_H
