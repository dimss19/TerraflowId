#include "timekeeping.h"

bool isSystemTimeValid() {
  return time(nullptr) > TIME_SYNCED_EPOCH_MIN;
}

float readDieTemperatureC() {
  return temperatureRead();
}

String getIsoTimestamp() {
  time_t now = time(nullptr);
  struct tm timeinfo;
  if (now > TIME_SYNCED_EPOCH_MIN && localtime_r(&now, &timeinfo)) {
    char buf[32];
    strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", &timeinfo);
    return String(buf);
  }
  // Penanda eksplisit, bukan tanggal palsu: teknisi harus bisa melihat bahwa
  // jam belum tersinkron, karena seluruh timestamp log bergantung padanya.
  return String("BELUM-SINKRON");
}

bool setSystemEpoch(time_t epochSec) {
  if (epochSec <= TIME_SYNCED_EPOCH_MIN) {
    Serial.printf("[TIME SYNC] Epoch %lu ditolak (tidak masuk akal / sebelum ambang).\n",
      (unsigned long)epochSec);
    return false;
  }
  struct timeval tv = { .tv_sec = epochSec, .tv_usec = 0 };
  settimeofday(&tv, nullptr);
  Serial.printf("[TIME SYNC] Jam internal ESP32 disetel ke %s (epoch %lu).\n",
    getIsoTimestamp().c_str(), (unsigned long)epochSec);
  return true;
}
