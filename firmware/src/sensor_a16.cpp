#include "sensor_a16.h"
#include "config.h"
#include "rtc_mgr.h"
#include <algorithm>
#include <vector>

// Hardware Serial2 untuk sensor DYP-A1611AU (UART Auto, listen-only)
HardwareSerial RS485Serial(2);

namespace {
// Batas valid sesuai spesifikasi A16: zona buta 50 cm, jangkauan maks 15 m
constexpr uint16_t A16_MIN_MM = 500;
constexpr uint16_t A16_MAX_MM = 15000;
// Batas tunggu satu frame. Mode output terproses bisa update lebih lambat.
constexpr unsigned long A16_FRAME_TIMEOUT_MS = 1500;
// Total waktu maksimum satu burst (aman terhadap Task WDT 30 detik)
constexpr unsigned long A16_BURST_BUDGET_MS = 6000;
}

SensorA16::SensorA16() : consecutiveFails(0), lastValidDistance(0.0f), uartActive(false) {}

void SensorA16::flushRx() {
  while (RS485Serial.available()) {
    RS485Serial.read();
  }
}

void SensorA16::attachUart() {
  // GPIO 8 juga dipakai I2C (SDA) RTC. Lepaskan Wire dulu, lalu pasang ulang UART
  // agar pin matrix GPIO 8 pasti kembali ke RX2 setelah akses RTC.
  rtcMgr.releaseBus();
  RS485Serial.end();
  pinMode(PIN_RS485_RX, INPUT); // Reset mode pin dari Open-Drain I2C ke digital INPUT
  delay(10);
  // Listen-only: TX = PIN_RS485_TX (-1 = tidak dipakai). Sensor UART Auto tidak butuh
  // trigger; pin RX sensor (kabel kuning) dipull-up agar output "terproses" (stabil).
  RS485Serial.begin(9600, SERIAL_8N1, PIN_RS485_RX, PIN_RS485_TX);
  delay(15);
  flushRx();
  uartActive = true;
}

void SensorA16::begin() {
  if (PIN_SENSOR_PWR >= 0) {
    pinMode(PIN_SENSOR_PWR, OUTPUT);
    digitalWrite(PIN_SENSOR_PWR, HIGH); // Enable sensor power via MOSFET (if present)
  }

  attachUart();

  Serial.println("[A16] Inisialisasi Serial2 UART untuk Sensor DYP-A1611AU (UART Auto):");
  Serial.printf("      - ESP32 RX2 (GPIO %d / Terminal SDA) <- Sensor TX (Kabel Putih)\n", PIN_RS485_RX);
  Serial.println("      - Sensor RX (Kabel Kuning) -> pull-up 10k ke VCC sensor (output terproses)");
  Serial.println("      - Baudrate: 9600 8N1, mode listen-only (tanpa trigger)");
}

void SensorA16::reinitBus() {
  Serial.println("[A16 AUTO-HEAL] Re-inisialisasi bus Serial2 UART...");
  attachUart();
}

void SensorA16::powerCycle() {
  if (PIN_SENSOR_PWR >= 0) {
    Serial.printf("[A16 AUTO-HEAL] Power-cycling sensor via GPIO %d...\n", PIN_SENSOR_PWR);
    digitalWrite(PIN_SENSOR_PWR, LOW);
    delay(1000);
    digitalWrite(PIN_SENSOR_PWR, HIGH);
    delay(1500);
  }
  reinitBus();
}

bool SensorA16::readFrame(uint16_t &distMm, unsigned long timeoutMs, uint8_t *outHex) {
  // Sliding window 4 byte: tahan terhadap mulai membaca di tengah frame
  uint8_t win[4] = {0, 0, 0, 0};
  int filled = 0;
  unsigned long start = millis();

  while (millis() - start < timeoutMs) {
    while (RS485Serial.available()) {
      uint8_t b = (uint8_t)RS485Serial.read();
      if (filled < 4) {
        win[filled++] = b;
      } else {
        win[0] = win[1];
        win[1] = win[2];
        win[2] = win[3];
        win[3] = b;
      }

      if (filled == 4 && win[0] == 0xFF &&
          (uint8_t)(win[0] + win[1] + win[2]) == win[3]) {
        distMm = ((uint16_t)win[1] << 8) | win[2];
        if (outHex) {
          memcpy(outHex, win, 4);
        }
        return true;
      }
    }
    delay(2);
  }
  return false;
}

A16Reading SensorA16::readSingleRaw() {
  A16Reading reading;
  reading.isValid = false;
  reading.isBlindSpot = false;
  reading.rawDistanceCm = 0.0f;
  reading.filteredDistanceCm = 0.0f;
  reading.temperatureC = rtcMgr.getTemperature();
  reading.timestamp = millis() / 1000;
  reading.validSamples = 0;
  reading.spreadCm = 0.0f;
  reading.errorMsg = "";
  memset(reading.rawHex, 0, 4);

  uint16_t distMm = 0;
  if (!readFrame(distMm, A16_FRAME_TIMEOUT_MS, reading.rawHex)) {
    reading.errorMsg = "TIDAK_ADA_FRAME_VALID";
    return reading;
  }

  if (distMm == 0) {
    reading.errorMsg = "NO_ECHO";
  } else if (distMm <= A16_MIN_MM) {
    reading.isBlindSpot = true;
    reading.rawDistanceCm = distMm / 10.0f;
    reading.filteredDistanceCm = 50.0f;
    reading.errorMsg = "BLIND_SPOT (<=50cm)";
  } else if (distMm > A16_MAX_MM) {
    reading.errorMsg = "OUT_OF_MAX_RANGE (>1500cm)";
  } else {
    reading.isValid = true;
    reading.rawDistanceCm = distMm / 10.0f;
    reading.filteredDistanceCm = reading.rawDistanceCm;
    reading.validSamples = 1;
  }
  return reading;
}

A16Reading SensorA16::readFastSample() {
  if (!uartActive) {
    attachUart();
  }

  A16Reading reading;
  reading.isValid = false;
  reading.isBlindSpot = false;
  reading.rawDistanceCm = 0.0f;
  reading.filteredDistanceCm = 0.0f;
  reading.temperatureC = rtcMgr.getTemperature();
  reading.timestamp = millis() / 1000;
  reading.validSamples = 0;
  reading.spreadCm = 0.0f;
  reading.errorMsg = "TIDAK_ADA_FRAME_VALID";
  memset(reading.rawHex, 0, 4);

  uint8_t win[4] = {0, 0, 0, 0};
  int filled = 0;
  uint16_t latestDistMm = 0;
  bool foundValid = false;
  uint8_t latestHex[4] = {0, 0, 0, 0};

  unsigned long start = millis();
  // Mode Real-Time mengirimkan frame otomatis setiap ~100-300 ms.
  // Tunggu maksimal 350 ms untuk mendapatkan frame paling segar dari kabel sensor.
  while (millis() - start < 350) {
    while (RS485Serial.available()) {
      uint8_t b = (uint8_t)RS485Serial.read();
      if (filled < 4) {
        win[filled++] = b;
      } else {
        win[0] = win[1];
        win[1] = win[2];
        win[2] = win[3];
        win[3] = b;
      }

      if (filled == 4 && win[0] == 0xFF) {
        uint8_t expectedChecksum = (uint8_t)(win[0] + win[1] + win[2]);
        uint8_t actualChecksum = win[3];
        if (expectedChecksum == actualChecksum) {
          latestDistMm = ((uint16_t)win[1] << 8) | win[2];
          memcpy(latestHex, win, 4);
          foundValid = true;
        }
      }
    }
    // Jika sudah menemukan frame valid dan buffer serial sudah terkuras habis
    if (foundValid && !RS485Serial.available()) {
      break;
    }
    delay(2);
  }

  if (!foundValid) {
    consecutiveFails++;
    return reading;
  }

  consecutiveFails = 0;
  memcpy(reading.rawHex, latestHex, 4);
  float distCm = latestDistMm / 10.0f;
  reading.rawDistanceCm = distCm;

  if (latestDistMm == 0) {
    reading.errorMsg = "NO_ECHO";
  } else if (latestDistMm <= A16_MIN_MM) {
    reading.isBlindSpot = true;
    reading.filteredDistanceCm = 50.0f;
    reading.errorMsg = "BLIND_SPOT";
  } else if (latestDistMm > A16_MAX_MM) {
    reading.errorMsg = "OUT_OF_MAX_RANGE";
  } else {
    reading.isValid = true;
    reading.filteredDistanceCm = distCm;
    reading.validSamples = 1;
    lastValidDistance = distCm;
    reading.errorMsg = "";

    // Simpan ke riwayat geser 10 sampel untuk hitung jitter / fluktuasi sudut
    fastHistory.push_back(distCm);
    if (fastHistory.size() > 10) {
      fastHistory.erase(fastHistory.begin());
    }
    if (fastHistory.size() >= 2) {
      float minD = *std::min_element(fastHistory.begin(), fastHistory.end());
      float maxD = *std::max_element(fastHistory.begin(), fastHistory.end());
      reading.spreadCm = maxD - minD;
    }
  }

  return reading;
}

A16Reading SensorA16::readFilteredDistance(int sampleCount) {
  if (sampleCount < 1) sampleCount = 9;
  const int minValid = std::max(1, sampleCount / 3);

  // Pastikan UART terpasang di GPIO 8 jika belum aktif
  if (!uartActive) {
    attachUart();
  }

  std::vector<float> validSamples;
  validSamples.reserve(sampleCount);
  int framesTotal = 0, framesNoEcho = 0, framesOutOfRange = 0, framesBlindSpot = 0;
  A16Reading lastAttempt;
  lastAttempt.isValid = false;
  lastAttempt.isBlindSpot = false;
  lastAttempt.rawDistanceCm = 0.0f;
  lastAttempt.filteredDistanceCm = 0.0f;
  lastAttempt.temperatureC = rtcMgr.getTemperature();
  lastAttempt.timestamp = millis() / 1000;
  lastAttempt.validSamples = 0;
  lastAttempt.errorMsg = "TIDAK_ADA_FRAME_VALID";

  unsigned long burstStart = millis();
  while ((int)validSamples.size() < sampleCount &&
         millis() - burstStart < A16_BURST_BUDGET_MS) {
    lastAttempt = readSingleRaw();
    if (lastAttempt.errorMsg == "TIDAK_ADA_FRAME_VALID") {
      // Tidak ada frame sama sekali dalam 1.5 detik -> sensor diam / wiring putus
      break;
    }
    framesTotal++;
    if (lastAttempt.isValid) {
      validSamples.push_back(lastAttempt.rawDistanceCm);
    } else if (lastAttempt.isBlindSpot) {
      framesBlindSpot++;
    } else if (lastAttempt.errorMsg == "NO_ECHO") {
      framesNoEcho++;
    } else {
      framesOutOfRange++;
    }
  }

  // 1. Prioritas Deteksi Blind Spot: Jika dominan frame terdeteksi di zona buta (<= 50 cm)
  if (framesBlindSpot >= minValid || (framesBlindSpot > 0 && validSamples.empty())) {
    A16Reading blindResult;
    blindResult.isValid = false;
    blindResult.isBlindSpot = true;
    blindResult.rawDistanceCm = 50.0f;
    blindResult.filteredDistanceCm = 50.0f;
    blindResult.temperatureC = rtcMgr.getTemperature();
    blindResult.timestamp = millis() / 1000;
    blindResult.validSamples = 0;
    blindResult.errorMsg = "BLIND_SPOT";
    consecutiveFails = 0; // Bukan sensor mati/putus, tetapi air/objek terlalu dekat
    Serial.printf("🚨 [A16 BLIND SPOT TERDETEKSI] %d/%d frame berada pada zona buta (<= 50 cm)! Air/objek terlalu dekat.\n",
      framesBlindSpot, framesTotal);
    return blindResult;
  }

  // 2. Jika sampel valid di luar zona buta mencukupi
  if ((int)validSamples.size() >= minValid) {
    std::sort(validSamples.begin(), validSamples.end());
    float medianCm = validSamples[validSamples.size() / 2];
    float spreadCm = validSamples.back() - validSamples.front();

    A16Reading result;
    result.isValid = true;
    result.isBlindSpot = false;
    result.rawDistanceCm = medianCm;
    result.filteredDistanceCm = medianCm; // Tanpa kompensasi suhu ganda
    result.temperatureC = rtcMgr.getTemperature();
    result.timestamp = millis() / 1000;
    result.validSamples = (int)validSamples.size();
    result.spreadCm = spreadCm;
    result.errorMsg = "";

    lastValidDistance = result.filteredDistanceCm;
    consecutiveFails = 0;

    Serial.printf("[A16 WAVE-FILTER] Median: %.1f cm | Valid %d/%d frame (no-echo %d, blind-spot %d, luar rentang %d) | Sebaran %.1f cm\n",
      medianCm, result.validSamples, framesTotal, framesNoEcho, framesBlindSpot, framesOutOfRange, spreadCm);
    return result;
  }

  // Burst gagal
  consecutiveFails++;
  Serial.printf("[A16 GAGAL] Valid %d/%d frame (min %d, no-echo %d, blind-spot %d, luar rentang %d). Gagal berturut-turut: %d (%s)\n",
    (int)validSamples.size(), framesTotal, minValid, framesNoEcho, framesBlindSpot, framesOutOfRange,
    consecutiveFails, lastAttempt.errorMsg.c_str());

  if (framesTotal == 0) {
    Serial.printf("[A16 DIAGNOSTIK] Tidak ada frame dari sensor pada GPIO %d (Terminal SDA). Periksa:\n", PIN_RS485_RX);
    Serial.println("  1. Terminal Pin 1 (SDA) -> Kabel Putih (TX Sensor)");
    Serial.println("  2. Terminal Pin 4 (GND) -> Kabel Kuning & Kabel Hitam (GND & Mode Real-Time)");
    Serial.println("  3. Terminal Pin 3 (5V)  -> Kabel Merah (VCC Sensor)");
  }

  // Jika sebelumnya ada jarak valid dan sensor hanya drop sesaat (<10 menit):
  // Pertahankan nilai valid terakhir (Hold) agar data 1 menit tidak bolong/hilang!
  if (lastValidDistance > 0.0f && consecutiveFails <= 10) {
    Serial.printf("[A16 HOLD] Mempertahankan jarak valid terakhir (%.1f cm) agar kontinuitas 1 menit terjaga.\n",
      lastValidDistance);
    A16Reading holdResult;
    holdResult.isValid = true;
    holdResult.rawDistanceCm = lastValidDistance;
    holdResult.filteredDistanceCm = lastValidDistance;
    holdResult.temperatureC = rtcMgr.getTemperature();
    holdResult.timestamp = millis() / 1000;
    holdResult.validSamples = 0; // 0 menandakan nilai hold / kontinuitas
    holdResult.errorMsg = "HELD_LAST_VALID";
    return holdResult;
  }

  // Return objek gagal jika memang benar-benar disconnected lama / tidak ada acuan
  lastAttempt.isValid = false;
  lastAttempt.rawDistanceCm = 0.0f;
  lastAttempt.filteredDistanceCm = 0.0f;
  lastAttempt.validSamples = 0;
  return lastAttempt;
}
