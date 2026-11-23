#include "sdcard_logger.h"
#include <driver/rtc_io.h>
#include <driver/gpio.h>
#include "config.h"

#include <algorithm>

SdCardLogger::SdCardLogger()
  : ready(false), spiBus(FSPI), pendingCount(0), consecutiveErrors(0),
    writeFailCount(0), lastWriteError(nullptr), sdMutex(NULL) {}

bool SdCardLogger::noteWriteFailure(const char *reasonCode, const char *detail) {
  writeFailCount++;
  lastWriteError = reasonCode;
  Serial.printf("[SD GAGAL TULIS] %s - %s (total gagal: %lu)\n",
    reasonCode, detail, (unsigned long)writeFailCount);
  return false;
}

const char *SdCardLogger::getSdStatus() const {
  if (!ready) return "no_card";              // 7 karakter
  if (lastWriteError) return lastWriteError; // dijamin <= 10 karakter di pemanggil
  return "ok";                               // 2 karakter
}

// ============================================================================
//  EKSPERIMENTAL - pelepasan pin SPI sebelum deep sleep
// ============================================================================
//  Diaktifkan lewat ENABLE_SD_POWERDOWN_ON_SLEEP di config.h (default false).
//
//  PROSEDUR UJI BENCH SEBELUM DIPAKAI DI LAPANGAN:
//   1. Set flag ke true, flash, pasang kartu MicroSD berisi data.
//   2. Biarkan melewati MINIMAL 10 siklus bangun-tidur berturut-turut
//      (turunkan sampling interval ke 15 detik agar cepat).
//   3. Pastikan SETIAP siklus menulis baris baru ke /data: periksa
//      write_fail_count TETAP 0 dan sd_status TETAP "ok" di payload MQTT.
//      Kegagalan remount akan muncul sebagai sd_status "no_card".
//   4. Ukur arus jalur baterai saat tidur dengan multimeter mode uA.
//      Harapan realistis: turun ~73 uA (kebocoran pull-up MISO hilang),
//      BUKAN turun ke bawah 150 uA - arus standby kartu tidak bisa
//      dihilangkan dari firmware, lihat catatan di config.h.
//   5. Bila ada satu saja siklus yang gagal remount, kembalikan flag ke
//      false. Kehilangan logging jauh lebih mahal daripada 73 uA.
void SdCardLogger::prepareForDeepSleep() {
#if defined(ENABLE_SD_POWERDOWN_ON_SLEEP) && ENABLE_SD_POWERDOWN_ON_SLEEP
  if (sdMutex) {
    // Jangan pernah melepas bus di tengah penulisan - tunggu sampai bebas.
    sdLock(2000);
  }

  SD.end();
  spiBus.end();

  // rtc_gpio_isolate() memutus pin sepenuhnya selama deep sleep: input dan
  // output dimatikan, pull-up/pull-down dilepas, lalu state itu di-hold.
  // Inilah cara yang didokumentasikan Espressif untuk menghilangkan
  // kebocoran pada pin yang punya pull-up - termasuk pull-up MISO yang
  // dipasang di begin() dan selama ini tetap aktif sepanjang tidur.
  const gpio_num_t spiPins[] = {
    (gpio_num_t)PIN_SD_CS, (gpio_num_t)PIN_SD_MOSI,
    (gpio_num_t)PIN_SD_SCK, (gpio_num_t)PIN_SD_MISO
  };
  for (gpio_num_t pin : spiPins) {
    if (rtc_gpio_is_valid_gpio(pin)) {
      rtc_gpio_isolate(pin);
    } else {
      // Fallback untuk pin non-RTC: minimal lepas pull-up/pull-down.
      gpio_pullup_dis(pin);
      gpio_pulldown_dis(pin);
    }
  }

  ready = false;  // Paksa begin() melakukan mount penuh di bangun berikutnya

  if (sdMutex) {
    sdUnlock();
  }
  Serial.println("[SD] Bus SPI dilepas & pin diisolasi untuk deep sleep (mode eksperimental).");
#endif
}

bool SdCardLogger::sdLock(uint32_t waitMs) {
  if (!sdMutex) return true;
  // Mutex REKURSIF: beberapa jalur memanggil sdLock() di dalam sdLock()
  // (mis. getUnsentRecords -> readSentLedger). Dengan mutex biasa,
  // pemanggilan kedua akan timeout dan mengembalikan nilai kosong.
  return xSemaphoreTakeRecursive(sdMutex, pdMS_TO_TICKS(waitMs)) == pdTRUE;
}

void SdCardLogger::sdUnlock() {
  if (sdMutex) {
    xSemaphoreGiveRecursive(sdMutex);
  }
}

bool SdCardLogger::begin() {
  if (!sdMutex) {
    sdMutex = xSemaphoreCreateRecursiveMutex();
  }

  // WAJIB PERTAMA: lepaskan hold RTC pada pin SPI.
  //
  // prepareForDeepSleep() memakai rtc_gpio_isolate() yang mengunci (hold)
  // state pin. Tanpa pelepasan di sini, pinMode()/SPI.begin() di bawah tidak
  // akan berefek dan kartu GAGAL MOUNT SECARA SENYAP di setiap bangun.
  // Dijalankan tanpa syarat flag: aman dipanggil pada pin yang tidak di-hold,
  // dan menjaga agar mematikan flag tetap memulihkan perangkat yang sudah
  // sempat tidur dengan pin terisolasi.
  const gpio_num_t spiPins[] = {
    (gpio_num_t)PIN_SD_CS, (gpio_num_t)PIN_SD_MOSI,
    (gpio_num_t)PIN_SD_SCK, (gpio_num_t)PIN_SD_MISO
  };
  for (gpio_num_t pin : spiPins) {
    if (rtc_gpio_is_valid_gpio(pin)) {
      rtc_gpio_hold_dis(pin);
      rtc_gpio_deinit(pin);
    }
    gpio_hold_dis(pin);
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
    if (!ready) {
      return noteWriteFailure("no_card", "Kartu MicroSD tidak termount & auto-recover gagal");
    }
  }

  if (!sdLock(1500)) {
    // Penyebab tersering: getUnsentRecords() menahan mutex selama 1-3 detik
    // saat memindai seluruh file log, melebihi batas tunggu 1500 ms di sini.
    return noteWriteFailure("lock_busy", "Timeout menunggu mutex SD (1500 ms)");
  }

  String path = "/data/" + filename;

  File file = SD.open(path, FILE_APPEND);
  if (!file) {
    consecutiveErrors++;
    Serial.printf("[SD ERROR] Failed to open %s. Errors: %d\n", path.c_str(), consecutiveErrors);
    sdUnlock();

    // Attempt auto-recovery
    if (autoRecover()) {
      if (!sdLock(1500)) {
        return noteWriteFailure("lock_busy", "Timeout mutex SD setelah auto-recover");
      }
      file = SD.open(path, FILE_APPEND);
      if (!file) {
        sdUnlock();
        return noteWriteFailure("open_fail", "SD.open gagal meski remount berhasil");
      }
    } else {
      return noteWriteFailure("open_fail", "SD.open gagal & auto-recover gagal");
    }
  }

  consecutiveErrors = 0;
  lastWriteError = nullptr;  // Tulis berhasil -> status kembali "ok"

  // Dihitung SETELAH remount: bila kartu baru saja di-remount, berkasnya bisa
  // benar-benar baru dan header CSV wajib ditulis. Menghitungnya sebelum
  // autoRecover() (perilaku lama) membuat header hilang pada kasus itu.
  bool isNewFile = (file.size() == 0);

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

// ==============================================================
//  Ledger "sudah terkirim" (append-only)
// ==============================================================
//  Kolom `sent` pada CSV tidak pernah bisa ditulis ulang di tempat
//  (Filesystem ESP32 tidak mendukung O_RDWR), dan rewrite penuh
//  tiap menit menguras umur MicroSD. Karena itu penandaan
//  "sudah terkirim" disimpan pada file ledger terpisah per hari -
//  hanya append, jauh lebih murah untuk kartu.
//
//  Format: satu epoch (detik) per baris, diurutkan menaik.

String SdCardLogger::sentLedgerPathFor(const String &filename) const {
  String base = filename;
  if (base.endsWith(".csv")) {
    base = base.substring(0, base.length() - 4);
  }
  return "/data/.sent_" + base;
}

std::vector<uint32_t> SdCardLogger::readSentLedger(const String &filename) {
  std::vector<uint32_t> out;
  if (!ready) return out;

  const String path = sentLedgerPathFor(filename);

  // Cache per berkas supaya tidak dibaca berulang
  if (sentLedgerCachedFor == filename) {
    return sentLedgerCache;
  }

  if (!sdLock(1500)) return out;
  File file = SD.open(path, FILE_READ);
  if (file) {
    while (file.available()) {
      String line = file.readStringUntil('\n');
      line.trim();
      if (line.length() == 0) continue;
      out.push_back((uint32_t)line.toInt());
    }
    file.close();
  }

  // Urutkan menaik agar bisa dicek dengan binary search.
  // Cache diperbarui di dalam critical section agar aman bila dua task
  // (sampling & MQTT) sama-sama accessing ledger.
  std::sort(out.begin(), out.end());
  sentLedgerCache = out;
  sentLedgerCachedFor = filename;

  sdUnlock();
  return out;
}

bool SdCardLogger::appendToSentLedger(const String &filename, uint32_t timestamp) {
  if (!ready) return false;
  if (!sdLock(1500)) return false;

  const String path = sentLedgerPathFor(filename);
  bool ok = false;
  File file = SD.open(path, FILE_APPEND);
  if (file) {
    file.printf("%lu\n", (unsigned long)timestamp);
    file.close();
    ok = true;
  } else {
    // Ledger belum ada -> buat baru
    file = SD.open(path, FILE_WRITE);
    if (file) {
      file.printf("%lu\n", (unsigned long)timestamp);
      file.close();
      ok = true;
    }
  }
  if (ok) {
    // Perbarui cache (di dalam critical section)
    if (sentLedgerCachedFor != filename) {
      sentLedgerCachedFor = filename;
      sentLedgerCache.clear();
    }
    sentLedgerCache.push_back(timestamp);
    std::sort(sentLedgerCache.begin(), sentLedgerCache.end());
  }
  sdUnlock();
  return ok;
}
bool SdCardLogger::markRecordSent(const String &filename, uint32_t timestamp) {
  if (!ready) return false;
  if (!appendToSentLedger(filename, timestamp)) {
    return false;
  }
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

  // Ledger "sudah terkirim" - authoritative, bukan kolom `sent` di CSV
  // (kolom itu tidak bisa ditulis ulang tanpa rewrite penuh berkas).
  std::vector<uint32_t> sentLedger = readSentLedger(filename);

  while (file.available() && (int)list.size() < limit) {
    String line = file.readStringUntil('\n');
    line.trim();
    if (line.length() < 10) continue;

    {
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
        // Lewati bila timestamp sudah tercatat di ledger "sudah terkirim"
        if (!std::binary_search(sentLedger.begin(), sentLedger.end(), rec.timestamp)) {
          list.push_back(rec);
        }
      } else if (tokens.size() >= 5) {
        // Fallback format
        rec.timestamp = (uint32_t)tokens[0].toInt();
        rec.rawDistanceCm = tokens[1].toFloat();
        rec.filteredDistanceCm = rec.rawDistanceCm;
        rec.waterLevelCm = tokens[2].toFloat();
        rec.temperatureC = tokens[3].toFloat();
        rec.isSent = false;
        if (!std::binary_search(sentLedger.begin(), sentLedger.end(), rec.timestamp)) {
          list.push_back(rec);
        }
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
      String fn = String(entry.name());
      int sl = fn.lastIndexOf('/');
      if (sl >= 0) fn = fn.substring(sl + 1);
      if (fn.startsWith(".") || (!entry.isDirectory() && !fn.endsWith(".csv"))) {
        entry.close();
        entry = dir.openNextFile();
        continue;
      }
      SdFileInfo info;
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
