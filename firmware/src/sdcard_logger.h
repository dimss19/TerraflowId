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

  // Tandai satu record sebagai sudah terkirim (dikonfirmasi server via ACK).
  // Dicatat pada ledger append-only per hari - bukan dengan menulis ulang
  // CSV, karena rewrite penuh tiap menit akan menguras umur MicroSD.
  bool markRecordSent(const String &filename, uint32_t timestamp);

  void logCrash(const String &reason, const String &details);
  
  int getPendingCount();
  void incrementPending();
  void decrementPending(int count = 1);

  // ------------------------------------------------------------
  //  Pelaporan kegagalan tulis (untuk troubleshooting lapangan)
  // ------------------------------------------------------------
  //  appendRecord() punya 5 jalur `return false` dan sebelumnya hampir
  //  semuanya senyap - pemanggil mengabaikan nilai kembaliannya, sehingga
  //  satu sampel bisa hilang tanpa log, tanpa counter, tanpa alert. Di
  //  lapangan yang terlihat hanya lubang di data, tanpa petunjuk penyebab.
  uint32_t getWriteFailCount() const { return writeFailCount; }
  int getConsecutiveErrors() const { return consecutiveErrors; }

  // Kode status singkat untuk payload MQTT. WAJIB <= 10 karakter:
  // kolom readings.sd_status di Postgres adalah VARCHAR(10) dan insert-nya
  // tidak di-try/catch, sehingga string lebih panjang memicu error 22001
  // yang MENGHAPUS seluruh baris telemetri siklus itu tanpa jejak.
  const char *getSdStatus() const;

  // EKSPERIMENTAL (lihat ENABLE_SD_POWERDOWN_ON_SLEEP di config.h).
  // Lepaskan bus SPI & isolasi pin kartu sebelum esp_deep_sleep_start().
  // No-op bila flag di config.h masih false.
  void prepareForDeepSleep();

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
  uint32_t writeFailCount;      // Akumulasi sampel yang gagal ditulis ke MicroSD
  const char *lastWriteError;   // Kode penyebab kegagalan terakhir (<= 10 karakter)
  SemaphoreHandle_t sdMutex;
  void initDirectories();

  // Catat satu kegagalan tulis + alasannya, lalu kembalikan false agar
  // bisa dipakai langsung sebagai `return noteWriteFailure("...")`.
  bool noteWriteFailure(const char *reasonCode, const char *detail);

  // Ledger "sudah terkirim" per berkas log (append-only, 1 timestamp per baris)
  String sentLedgerPathFor(const String &filename) const;
  std::vector<uint32_t> readSentLedger(const String &filename);
  bool appendToSentLedger(const String &filename, uint32_t timestamp);
  std::vector<uint32_t> sentLedgerCache;
  String sentLedgerCachedFor;
};

// Instance global (didefinisikan di main.cpp), mengikuti pola yang sudah
// dipakai `sensor` (sensor_a16.h) dan `webServerMgr` (web_server_mgr.h).
extern SdCardLogger sdLogger;

#endif // SDCARD_LOGGER_H
