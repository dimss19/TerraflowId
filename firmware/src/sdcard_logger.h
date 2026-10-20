#ifndef SDCARD_LOGGER_H
#define SDCARD_LOGGER_H

#include <stdint.h>
#include <Arduino.h>
#include <FS.h>
#include <SD.h>
#include <SPI.h>
#include <vector>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

struct LogRecord {
  char date[12];              // "YYYY-MM-DD"
  char time[9];               // "HH:MM:SS"
  uint8_t minute;             // 0-59
  uint32_t timestamp;
  float rawDistanceCm;
  float filteredDistanceCm;
  float waterLevelCm;
  float temperatureC;
  bool isSent;
};

struct SdFileInfo {
  char name[48];
  size_t size;
  bool isDirectory;
};

class SdCardLogger {
public:
  SdCardLogger();
  bool begin();
  bool isReady() const { return ready; }
  
  // FreeRTOS Mutex synchronization for thread-safe SD access
  bool sdLock(uint32_t waitMs = 1500);
  void sdUnlock();
  
  // Autonomous Self-Healing SPI / Card Re-mount
  bool autoRecover();
  
  bool appendRecord(const String &filename, const LogRecord &record);
  bool markRecordSent(const String &filename, uint32_t timestamp);
  void logCrash(const String &reason, const String &details);
  
  int getPendingCount();
  void incrementPending();
  void decrementPending(int count = 1);
  
  float getFreeSpaceMB();
  float getTotalSpaceMB();
  std::vector<LogRecord> getUnsentRecords(const String &filename, int limit = 10);
  
  // SD File Manager functions for Web Interface
  std::vector<SdFileInfo> listDataFiles();
  bool deleteFile(const String &path);

private:
  bool ready;
  SPIClass spiBus;
  int pendingCount;
  int consecutiveErrors;
  SemaphoreHandle_t sdMutex;
  void initDirectories();
};

#endif // SDCARD_LOGGER_H
