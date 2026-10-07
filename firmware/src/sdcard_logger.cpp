#include "sdcard_logger.h"
#include "config.h"

SdCardLogger::SdCardLogger() : ready(false), spiBus(FSPI), pendingCount(0) {}

bool SdCardLogger::begin() {
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
  initDirectories();
  return true;
}

void SdCardLogger::initDirectories() {
  if (!ready) return;
  if (!SD.exists("/data")) SD.mkdir("/data");
  if (!SD.exists("/sent")) SD.mkdir("/sent");
  if (!SD.exists("/logs")) SD.mkdir("/logs");
}

bool SdCardLogger::appendRecord(const String &filename, const LogRecord &record) {
  if (!ready) return false;

  String path = "/data/" + filename;
  bool isNewFile = !SD.exists(path);

  File file = SD.open(path, FILE_APPEND);
  if (!file) {
    Serial.printf("[SD ERROR] Failed to open file for appending: %s\n", path.c_str());
    return false;
  }

  if (isNewFile) {
    file.println("timestamp,raw_distance_cm,water_level_cm,temperature_c,battery_voltage,battery_percent,sent");
  }

  char line[128];
  snprintf(line, sizeof(line), "%lu,%.1f,%.1f,%.1f,%.2f,%d,%d",
    record.timestamp,
    record.rawDistanceCm,
    record.waterLevelCm,
    record.temperatureC,
    record.batteryVoltage,
    record.batteryPercent,
    record.isSent ? 1 : 0
  );

  file.println(line);
  file.close();

  if (!record.isSent) {
    incrementPending();
  }

  return true;
}

void SdCardLogger::logCrash(const String &reason, const String &details) {
  if (!ready) return;
  File logFile = SD.open("/logs/crash.log", FILE_APPEND);
  if (logFile) {
    logFile.printf("[%lu] CRASH_EVENT: %s | %s\n", millis() / 1000, reason.c_str(), details.c_str());
    logFile.close();
    Serial.println("[SD] Crash event recorded to /logs/crash.log");
  }
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

std::vector<LogRecord> SdCardLogger::getUnsentRecords(const String &filename, int limit) {
  std::vector<LogRecord> list;
  if (!ready) return list;

  String path = "/data/" + filename;
  File file = SD.open(path, FILE_READ);
  if (!file) return list;

  // Skip CSV header
  if (file.available()) file.readStringUntil('\n');

  while (file.available() && (int)list.size() < limit) {
    String line = file.readStringUntil('\n');
    line.trim();
    if (line.length() < 10) continue;

    // Check last character for sent flag
    if (line.endsWith(",0")) {
      LogRecord rec;
      int t1 = line.indexOf(',');
      int t2 = line.indexOf(',', t1 + 1);
      int t3 = line.indexOf(',', t2 + 1);
      int t4 = line.indexOf(',', t3 + 1);
      int t5 = line.indexOf(',', t4 + 1);
      int t6 = line.indexOf(',', t5 + 1);

      rec.timestamp = line.substring(0, t1).toInt();
      rec.rawDistanceCm = line.substring(t1 + 1, t2).toFloat();
      rec.waterLevelCm = line.substring(t2 + 1, t3).toFloat();
      rec.temperatureC = line.substring(t3 + 1, t4).toFloat();
      rec.batteryVoltage = line.substring(t4 + 1, t5).toFloat();
      rec.batteryPercent = line.substring(t5 + 1, t6).toInt();
      rec.isSent = false;
      list.push_back(rec);
    }
  }

  file.close();
  return list;
}
