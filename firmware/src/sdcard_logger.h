#ifndef SDCARD_LOGGER_H
#define SDCARD_LOGGER_H

#include <Arduino.h>
#include <FS.h>
#include <SD.h>
#include <SPI.h>

struct LogRecord {
  uint32_t timestamp;
  float rawDistanceCm;
  float waterLevelCm;
  float temperatureC;
  float batteryVoltage;
  int batteryPercent;
  bool isSent;
};

class SdCardLogger {
public:
  SdCardLogger();
  bool begin();
  bool isReady() const { return ready; }
  
  bool appendRecord(const String &filename, const LogRecord &record);
  bool markRecordSent(const String &filename, uint32_t timestamp);
  void logCrash(const String &reason, const String &details);
  
  int getPendingCount();
  void incrementPending();
  void decrementPending(int count = 1);
  
  float getFreeSpaceMB();
  std::vector<LogRecord> getUnsentRecords(const String &filename, int limit = 10);

private:
  bool ready;
  SPIClass spiBus;
  int pendingCount;
  void initDirectories();
};

#endif // SDCARD_LOGGER_H
