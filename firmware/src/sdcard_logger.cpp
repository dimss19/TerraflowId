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

  // Siapkan pin CS dan pull-up MISO untuk kestabilan transmisi SPI
  pinMode(PIN_SD_CS, OUTPUT);
  digitalWrite(PIN_SD_CS, HIGH);
  pinMode(PIN_SD_MISO, INPUT_PULLUP);
  delay(10);

  // Initialize dedicated SPI bus with specified GPIOs (10 CS, 11 MOSI, 12 SCK, 13 MISO)
  // Gunakan -1 pada argumen SS hardware agar SD library mengendalikan pin CS secara mandiri
  spiBus.begin(PIN_SD_SCK, PIN_SD_MISO, PIN_SD_MOSI, -1);
  delay(20);

  // Percobaan 1: Kecepatan standar 10 MHz
  bool mounted = SD.begin(PIN_SD_CS, spiBus, 10000000);
  if (!mounted) {
    // Percobaan 2 (Fallback): Kecepatan aman 4 MHz jika kartu SD lambat / sinyal panjang
    Serial.println("[SD] Mount 10MHz gagal, mencoba fallback ke 4MHz...");
    delay(50);
    mounted = SD.begin(PIN_SD_CS, spiBus, 4000000);
  }

  if (!mounted) {
    Serial.println("[SD ERROR] Gagal mount MicroSD Card! Periksa slot/format FAT32 (Fallback ke RAM).");
    ready = false;
    return false;
  }

  uint8_t cardType = SD.cardType();
  if (cardType == CARD_NONE) {
    Serial.println("[SD ERROR] Kartu MicroSD tidak terdeteksi dalam slot (CARD_NONE).");
    ready = false;
    return false;
  }

  const char *typeStr = "UNKNOWN";
  if (cardType == CARD_MMC) typeStr = "MMC";
  else if (cardType == CARD_SD) typeStr = "SDSC";
  else if (cardType == CARD_SDHC) typeStr = "SDHC/SDXC";

  Serial.printf("[SD] MicroSD Card mounted successfully (%s). Size: %llu MB\n",
    typeStr, SD.cardSize() / (1024 * 1024));
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

  pinMode(PIN_SD_CS, OUTPUT);
  digitalWrite(PIN_SD_CS, HIGH);
  pinMode(PIN_SD_MISO, INPUT_PULLUP);
  delay(10);

  spiBus.begin(PIN_SD_SCK, PIN_SD_MISO, PIN_SD_MOSI, -1);
  delay(50);

  bool mounted = SD.begin(PIN_SD_CS, spiBus, 10000000);
  if (!mounted) {
    delay(50);
    mounted = SD.begin(PIN_SD_CS, spiBus, 4000000);
  }

  if (mounted) {
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
    file.println("date,time,minute,timestamp,raw_distance_cm,filtered_distance_cm,water_level_cm,temperature_c,sent");
  }

  char fallbackDate[16] = "1970-01-01";
  char fallbackTime[16] = "00:00:00";
  time_t nowSec = time(nullptr);
  struct tm ti;
  if (nowSec > 1700000000 && localtime_r(&nowSec, &ti)) {
    strftime(fallbackDate, sizeof(fallbackDate), "%Y-%m-%d", &ti);
    strftime(fallbackTime, sizeof(fallbackTime), "%H:%M:%S", &ti);
  }

  char line[160];
  snprintf(line, sizeof(line), "%s,%s,%u,%lu,%.1f,%.1f,%.1f,%.1f,%d",
    record.date[0] ? record.date : fallbackDate,
    record.time[0] ? record.time : fallbackTime,
    record.minute,
    (unsigned long)record.timestamp,
    record.rawDistanceCm,
    record.filteredDistanceCm,
    record.waterLevelCm,
    record.temperatureC,
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

      if (tokens.size() >= 9) {
        // Standard format: date,time,minute,timestamp,raw_dist,filt_dist,water_level,temp,sent
        strncpy(rec.date, tokens[0].c_str(), sizeof(rec.date) - 1);
        strncpy(rec.time, tokens[1].c_str(), sizeof(rec.time) - 1);
        rec.minute = (uint8_t)tokens[2].toInt();
        rec.timestamp = (uint32_t)tokens[3].toInt();
        rec.rawDistanceCm = tokens[4].toFloat();
        rec.filteredDistanceCm = tokens[5].toFloat();
        rec.waterLevelCm = tokens[6].toFloat();
        rec.temperatureC = tokens[7].toFloat();
        rec.isSent = false;
        list.push_back(rec);
      } else if (tokens.size() >= 5) {
        // Fallback format
        rec.timestamp = (uint32_t)tokens[0].toInt();
        rec.rawDistanceCm = tokens[1].toFloat();
        rec.filteredDistanceCm = rec.rawDistanceCm;
        rec.waterLevelCm = tokens[2].toFloat();
        rec.temperatureC = tokens[3].toFloat();
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
