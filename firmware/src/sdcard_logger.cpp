#include "sdcard_logger.h"
#include "config.h"

SdCardLogger::SdCardLogger() : ready(false), spiBus(FSPI), pendingCount(0), consecutiveErrors(0), sdMutex(NULL) {}

bool SdCardLogger::sdLock(uint32_t waitMs) {
  if (!sdMutex) return true;
  return xSemaphoreTake(sdMutex, pdMS_TO_TICKS(waitMs)) == pdTRUE;
}

void SdCardLogger::sdUnlock() {
  if (sdMutex) {
    xSemaphoreGive(sdMutex);
  }
}

bool SdCardLogger::begin() {
  if (!sdMutex) {
    sdMutex = xSemaphoreCreateMutex();
  }

  // Initialize dedicated SPI bus with specified GPIOs (10, 11, 12, 13)
  spiBus.begin(PIN_SD_SCK, PIN_SD_MISO, PIN_SD_MOSI, PIN_SD_CS);

  if (!SD.begin(PIN_SD_CS, spiBus, 20000000)) {
    Serial.println("[SD ERROR] Failed to mount MicroSD Card! Fallback to RAM buffer.");
    ready = false;
    return false;
  }

  uint8_t cardType = SD.cardType();
  if (cardType == CARD_NONE) {
    Serial.println("[SD ERROR] No MicroSD Card detected in slot.");
    ready = false;
    return false;
  }

  Serial.printf("[SD] MicroSD Card mounted successfully. Size: %llu MB\n", SD.cardSize() / (1024 * 1024));
  ready = true;
  consecutiveErrors = 0;
  initDirectories();
  return true;
}

bool SdCardLogger::autoRecover() {
  if (!sdLock(2000)) return false;
  Serial.println("[SD AUTO-HEAL] Attempting MicroSD re-mount & SPI bus recovery...");
  SD.end();
  delay(100);
  spiBus.end();
  delay(50);

  spiBus.begin(PIN_SD_SCK, PIN_SD_MISO, PIN_SD_MOSI, PIN_SD_CS);
  delay(50);

  if (SD.begin(PIN_SD_CS, spiBus, 20000000)) {
    uint8_t cardType = SD.cardType();
    if (cardType != CARD_NONE) {
      ready = true;
      consecutiveErrors = 0;
      initDirectories();
      Serial.println("[SD AUTO-HEAL] MicroSD Card successfully recovered & re-mounted!");
      sdUnlock();
      return true;
    }
  }

  ready = false;
  Serial.println("[SD AUTO-HEAL] Card recovery failed. Slot may be unseated.");
  sdUnlock();
  return false;
}

void SdCardLogger::initDirectories() {
  if (!ready) return;
  if (!SD.exists("/data")) SD.mkdir("/data");
  if (!SD.exists("/sent")) SD.mkdir("/sent");
  if (!SD.exists("/logs")) SD.mkdir("/logs");
}

bool SdCardLogger::appendRecord(const String &filename, const LogRecord &record) {
  if (!ready) {
    autoRecover();
    if (!ready) return false;
  }

  if (!sdLock(1500)) return false;

  String path = "/data/" + filename;
  bool isNewFile = !SD.exists(path);

  File file = SD.open(path, FILE_APPEND);
  if (!file) {
    consecutiveErrors++;
    Serial.printf("[SD ERROR] Failed to open %s. Errors: %d\n", path.c_str(), consecutiveErrors);
    sdUnlock();
    
    // Attempt auto-recovery
    if (autoRecover()) {
      if (!sdLock(1500)) return false;
      file = SD.open(path, FILE_APPEND);
      if (!file) {
        sdUnlock();
        return false;
      }
    } else {
      return false;
    }
  }

  consecutiveErrors = 0;

  if (isNewFile) {
    file.println("date,time,minute,timestamp,raw_distance_cm,filtered_distance_cm,water_level_cm,temperature_c,battery_voltage,battery_percent,sent");
  }

  char line[160];
  snprintf(line, sizeof(line), "%s,%s,%u,%lu,%.1f,%.1f,%.1f,%.1f,%.2f,%d,%d",
    record.date[0] ? record.date : "2026-10-11",
    record.time[0] ? record.time : "00:00:00",
    record.minute,
    (unsigned long)record.timestamp,
    record.rawDistanceCm,
    record.filteredDistanceCm,
    record.waterLevelCm,
    record.temperatureC,
    record.batteryVoltage,
    record.batteryPercent,
    record.isSent ? 1 : 0
  );

  file.println(line);
  file.close();
  sdUnlock();

  if (!record.isSent) {
    incrementPending();
  }

  return true;
}

bool SdCardLogger::markRecordSent(const String &filename, uint32_t timestamp) {
  (void)filename;
  (void)timestamp;
  if (!ready) return false;
  decrementPending(1);
  return true;
}

void SdCardLogger::logCrash(const String &reason, const String &details) {
  if (!ready) {
    autoRecover();
    if (!ready) return;
  }
  if (!sdLock(1500)) return;
  File logFile = SD.open("/logs/crash.log", FILE_APPEND);
  if (logFile) {
    logFile.printf("[%lu] CRASH_EVENT: %s | %s\n", (unsigned long)(millis() / 1000), reason.c_str(), details.c_str());
    logFile.close();
    Serial.println("[SD] Crash event recorded to /logs/crash.log");
  }
  sdUnlock();
}

int SdCardLogger::getPendingCount() {
  return pendingCount;
}

void SdCardLogger::incrementPending() {
  pendingCount++;
}

void SdCardLogger::decrementPending(int count) {
  pendingCount = max(0, pendingCount - count);
}

float SdCardLogger::getFreeSpaceMB() {
  if (!ready) return 0.0f;
  return (float)(SD.totalBytes() - SD.usedBytes()) / (1024.0f * 1024.0f);
}

float SdCardLogger::getTotalSpaceMB() {
  if (!ready) return 0.0f;
  return (float)(SD.totalBytes()) / (1024.0f * 1024.0f);
}

std::vector<LogRecord> SdCardLogger::getUnsentRecords(const String &filename, int limit) {
  std::vector<LogRecord> list;
  if (!ready) {
    autoRecover();
    if (!ready) return list;
  }

  if (!sdLock(1500)) return list;

  String path = "/data/" + filename;
  File file = SD.open(path, FILE_READ);
  if (!file) {
    sdUnlock();
    return list;
  }

  // Skip CSV header
  if (file.available()) file.readStringUntil('\n');

  while (file.available() && (int)list.size() < limit) {
    String line = file.readStringUntil('\n');
    line.trim();
    if (line.length() < 10) continue;

    // Check last character for sent flag (ends with 0)
    if (line.endsWith(",0")) {
      LogRecord rec;
      memset(&rec, 0, sizeof(rec));

      std::vector<String> tokens;
      int start = 0;
      int idx = line.indexOf(',');
      while (idx >= 0) {
        tokens.push_back(line.substring(start, idx));
        start = idx + 1;
        idx = line.indexOf(',', start);
      }
      tokens.push_back(line.substring(start));

      if (tokens.size() >= 11) {
        // New format: date,time,minute,timestamp,raw_dist,filt_dist,water_level,temp,batt_v,batt_pct,sent
        strncpy(rec.date, tokens[0].c_str(), sizeof(rec.date) - 1);
        strncpy(rec.time, tokens[1].c_str(), sizeof(rec.time) - 1);
        rec.minute = (uint8_t)tokens[2].toInt();
        rec.timestamp = (uint32_t)tokens[3].toInt();
        rec.rawDistanceCm = tokens[4].toFloat();
        rec.filteredDistanceCm = tokens[5].toFloat();
        rec.waterLevelCm = tokens[6].toFloat();
        rec.temperatureC = tokens[7].toFloat();
        rec.batteryVoltage = tokens[8].toFloat();
        rec.batteryPercent = tokens[9].toInt();
        rec.isSent = false;
        list.push_back(rec);
      } else if (tokens.size() >= 7) {
        // Legacy format: timestamp,raw_distance_cm,water_level_cm,temperature_c,battery_voltage,battery_percent,sent
        rec.timestamp = (uint32_t)tokens[0].toInt();
        rec.rawDistanceCm = tokens[1].toFloat();
        rec.filteredDistanceCm = rec.rawDistanceCm;
        rec.waterLevelCm = tokens[2].toFloat();
        rec.temperatureC = tokens[3].toFloat();
        rec.batteryVoltage = tokens[4].toFloat();
        rec.batteryPercent = tokens[5].toInt();
        rec.isSent = false;
        list.push_back(rec);
      }
    }
  }

  file.close();
  sdUnlock();
  return list;
}

std::vector<SdFileInfo> SdCardLogger::listDataFiles() {
  std::vector<SdFileInfo> result;
  if (!ready) return result;
  if (!sdLock(2000)) return result;

  File dir = SD.open("/data");
  if (dir && dir.isDirectory()) {
    File entry = dir.openNextFile();
    while (entry && result.size() < 64) {
      SdFileInfo info;
      String fn = String(entry.name());
      int sl = fn.lastIndexOf('/');
      if (sl >= 0) fn = fn.substring(sl + 1);
      strncpy(info.name, fn.c_str(), sizeof(info.name) - 1);
      info.name[sizeof(info.name) - 1] = '\0';
      info.size = entry.size();
      info.isDirectory = entry.isDirectory();
      result.push_back(info);
      entry.close();
      entry = dir.openNextFile();
    }
    dir.close();
  }
  sdUnlock();
  return result;
}

bool SdCardLogger::deleteFile(const String &path) {
  if (!ready) return false;
  // Security check: only allow deleting files in /data/ or /logs/ and disallow traversal
  if (!path.startsWith("/data/") && !path.startsWith("/logs/")) return false;
  if (path.indexOf("..") >= 0) return false;

  if (!sdLock(1500)) return false;
  bool ok = false;
  if (SD.exists(path)) {
    ok = SD.remove(path);
  }
  sdUnlock();
  return ok;
}
