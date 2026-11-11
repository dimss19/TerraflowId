#include "rtc_mgr.h"
#include "config.h"
#include "sensor_a16.h"

extern SensorA16 sensor;

// Singleton instance
RtcManager rtcMgr;

RtcManager::RtcManager() : rtcDetected(false), busAcquired(false), lastTemperature(25.0f) {}

float RtcManager::getTemperature() const {
#if defined(ENABLE_ONBOARD_RTC) && !ENABLE_ONBOARD_RTC
  return temperatureRead();
#else
  return lastTemperature;
#endif
}


uint8_t RtcManager::bcdToDec(uint8_t val) {
  return ((val / 16 * 10) + (val % 16));
}

uint8_t RtcManager::decToBcd(uint8_t val) {
  return ((val / 10 * 16) + (val % 10));
}

void RtcManager::acquireBus() {
#if defined(ENABLE_ONBOARD_RTC) && !ENABLE_ONBOARD_RTC
  return;
#else
  if (PIN_RTC_SDA < 0 || PIN_RTC_SCL < 0) return;
  if (busAcquired) return;
  Wire.begin(PIN_RTC_SDA, PIN_RTC_SCL, 100000);
  busAcquired = true;
  delay(5);
#endif
}

void RtcManager::releaseBus() {
#if defined(ENABLE_ONBOARD_RTC) && !ENABLE_ONBOARD_RTC
  return;
#else
  if (PIN_RTC_SDA < 0 || PIN_RTC_SCL < 0) return;
  if (!busAcquired) return;
  Wire.end();
  busAcquired = false;
  sensor.markUartDirty();
  delay(5);
#endif
}

bool RtcManager::probeDevice() {
#if defined(ENABLE_ONBOARD_RTC) && !ENABLE_ONBOARD_RTC
  return false;
#else
  if (PIN_RTC_SDA < 0 || PIN_RTC_SCL < 0) return false;
  acquireBus();
  Wire.beginTransmission(RTC_I2C_ADDR);
  uint8_t err = Wire.endTransmission();
  return (err == 0);
#endif
}

bool RtcManager::begin() {
#if defined(ENABLE_ONBOARD_RTC) && !ENABLE_ONBOARD_RTC
  Serial.println("[RTC] Onboard RTC dinonaktifkan di config.h (GPIO 9 dialokasikan untuk PIN_SENSOR_PWR).");
  Serial.println("[RTC] Waktu sistem disinkronkan otomatis via NTP / jaringan / MQTT.");
  rtcDetected = false;
  return false;
#else
  Serial.println("[RTC] Inisialisasi bus I2C Onboard RTC (DS3231/DS1307)...");
  Serial.printf("      - Pin SDA : GPIO %d\n", PIN_RTC_SDA);
  Serial.printf("      - Pin SCL : GPIO %d\n", PIN_RTC_SCL);
  Serial.printf("      - Alamat  : 0x%02X\n", RTC_I2C_ADDR);

  acquireBus();

  if (probeDevice()) {
    rtcDetected = true;
    Serial.println("[RTC] Chip RTC onboard ditemukan dan merespons pada alamat 0x68!");

    // Coba baca dan sinkronkan waktu ke sistem ESP32
    struct tm tmNow;
    if (readDateTime(tmNow)) {
      char buf[64];
      strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", &tmNow);
      Serial.printf("[RTC] Waktu RTC saat ini: %s (T=%.1f°C)\n", buf, lastTemperature);
      syncSystemTime();
    } else {
      Serial.println("[RTC] RTC terdeteksi namun pembacaan register waktu belum valid.");
    }
  } else {
    rtcDetected = false;
    Serial.println("[RTC] RTC onboard tidak merespons pada 0x68 (Mungkin sensor UART aktif di terminal).");
  }

  releaseBus();
  return rtcDetected;
#endif
}

bool RtcManager::readDateTime(struct tm &timeinfo) {
  acquireBus();

  // Reset pointer register RTC ke 0x00 (Seconds)
  Wire.beginTransmission(RTC_I2C_ADDR);
  Wire.write((uint8_t)0x00);
  if (Wire.endTransmission() != 0) {
    rtcDetected = false;
    releaseBus();
    return false;
  }

  // Minta 7 byte waktu: detik, menit, jam, hari-minggu, tanggal, bulan, tahun
  uint8_t count = Wire.requestFrom((uint8_t)RTC_I2C_ADDR, (uint8_t)7);
  if (count < 7) {
    releaseBus();
    return false;
  }

  uint8_t rawSec  = Wire.read() & 0x7F; // bit 7 CH (Clock Halt) pada DS1307
  uint8_t rawMin  = Wire.read() & 0x7F;
  uint8_t rawHour = Wire.read() & 0x3F; // 24-hour mode
  uint8_t rawDow  = Wire.read() & 0x07;
  uint8_t rawDay  = Wire.read() & 0x3F;
  uint8_t rawMon  = Wire.read() & 0x1F;
  uint8_t rawYear = Wire.read();

  int sec  = bcdToDec(rawSec);
  int min  = bcdToDec(rawMin);
  int hour = bcdToDec(rawHour);
  int day  = bcdToDec(rawDay);
  int mon  = bcdToDec(rawMon);
  int year = 2000 + bcdToDec(rawYear);

  // Validasi batas logis
  if (sec > 59 || min > 59 || hour > 23 || day < 1 || day > 31 || mon < 1 || mon > 12 || year < 2024 || year > 2099) {
    releaseBus();
    return false;
  }

  memset(&timeinfo, 0, sizeof(timeinfo));
  timeinfo.tm_sec  = sec;
  timeinfo.tm_min  = min;
  timeinfo.tm_hour = hour;
  timeinfo.tm_mday = day;
  timeinfo.tm_mon  = mon - 1;       // tm_mon 0-11
  timeinfo.tm_year = year - 1900;   // tm_year sejak 1900
  timeinfo.tm_wday = (rawDow % 7);

  // Baca suhu internal DS3231 jika ada (Register 0x11 & 0x12)
  Wire.beginTransmission(RTC_I2C_ADDR);
  Wire.write((uint8_t)0x11);
  if (Wire.endTransmission() == 0 && Wire.requestFrom((uint8_t)RTC_I2C_ADDR, (uint8_t)2) == 2) {
    int8_t tempMsb = (int8_t)Wire.read();
    uint8_t tempLsb = Wire.read();
    lastTemperature = (float)tempMsb + ((tempLsb >> 6) * 0.25f);
  }

  releaseBus();
  rtcDetected = true;
  return true;
}

bool RtcManager::setDateTime(const struct tm &timeinfo) {
  acquireBus();

  Wire.beginTransmission(RTC_I2C_ADDR);
  Wire.write((uint8_t)0x00); // Mulai dari register 0x00

  Wire.write(decToBcd(timeinfo.tm_sec));
  Wire.write(decToBcd(timeinfo.tm_min));
  Wire.write(decToBcd(timeinfo.tm_hour));
  Wire.write(decToBcd(timeinfo.tm_wday + 1));
  Wire.write(decToBcd(timeinfo.tm_mday));
  Wire.write(decToBcd(timeinfo.tm_mon + 1));
  int yr = (timeinfo.tm_year + 1900) % 100;
  Wire.write(decToBcd(yr));

  uint8_t err = Wire.endTransmission();
  releaseBus();
  if (err == 0) {
    rtcDetected = true;
    Serial.printf("[RTC] Berhasil memperbarui jam RTC ke %04d-%02d-%02d %02d:%02d:%02d\n",
      timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday,
      timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
    return true;
  }
  return false;
}

bool RtcManager::setEpochTime(time_t epochSec) {
#if defined(ENABLE_ONBOARD_RTC) && !ENABLE_ONBOARD_RTC
  if (epochSec > 1700000000) {
    struct timeval tv = { .tv_sec = epochSec, .tv_usec = 0 };
    settimeofday(&tv, nullptr);
    Serial.printf("[TIME SYNC] Jam internal ESP32 disinkronkan ke Epoch %lu via Web Portal.\n",
      (unsigned long)epochSec);
    return true;
  }
  return false;
#else
  struct tm timeinfo;
  if (localtime_r(&epochSec, &timeinfo)) {
    bool ok = setDateTime(timeinfo);
    if (ok) {
      struct timeval tv = { .tv_sec = epochSec, .tv_usec = 0 };
      settimeofday(&tv, nullptr);
    }
    return ok;
  }
  return false;
#endif
}

bool RtcManager::syncSystemTime() {
  struct tm rtcTime;
  if (!readDateTime(rtcTime)) {
    return false;
  }

  time_t epoch = mktime(&rtcTime);
  if (epoch > 1700000000) {
    struct timeval tv = { .tv_sec = epoch, .tv_usec = 0 };
    settimeofday(&tv, nullptr);
    Serial.printf("[RTC SYNC] Jam internal ESP32 berhasil disinkronkan dengan RTC: Epoch %lu\n",
      (unsigned long)epoch);
    return true;
  }
  return false;
}

bool RtcManager::syncFromSystem() {
  time_t now = time(nullptr);
  if (now > 1700000000) {
    struct tm timeinfo;
    if (localtime_r(&now, &timeinfo)) {
      return setDateTime(timeinfo);
    }
  }
  return false;
}

String RtcManager::getIsoTimestamp() {
  time_t now = time(nullptr);
  struct tm timeinfo;
  if (now > 1700000000 && localtime_r(&now, &timeinfo)) {
    char buf[32];
    strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", &timeinfo);
    return String(buf);
  }
  return String("OFFLINE-NO-RTC");
}

String RtcManager::getStatusJson() {
  char buf[128];
  snprintf(buf, sizeof(buf),
    "{\"ok\":%s,\"detected\":%s,\"temp_c\":%.1f,\"time\":\"%s\"}",
    rtcDetected ? "true" : "false",
    rtcDetected ? "true" : "false",
    lastTemperature,
    getIsoTimestamp().c_str()
  );
  return String(buf);
}
