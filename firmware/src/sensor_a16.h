#ifndef SENSOR_A16_H
#define SENSOR_A16_H

#include <stdint.h>
#include <Arduino.h>
#include <vector>

/**
 * A16 Ultrasonic Sensor Reading Structure
 * Sensor DYP-A1611AU (UART Auto) sudah melakukan kompensasi suhu internal,
 * sehingga jarak dari sensor dipakai apa adanya (hanya difilter median).
 */
struct A16Reading {
  bool isValid;
  bool isBlindSpot;             // Flag khusus: true jika target/air masuk ke zona buta (<= 50 cm)
  float rawDistanceCm;          // Median jarak dari sensor (tanpa koreksi tambahan)
  float filteredDistanceCm;     // Jarak yang dipakai sistem (median burst / nilai hold)
  float temperatureC;           // Suhu board dari RTC DS3231 (informasi saja, tidak dipakai koreksi)
  uint32_t timestamp;           // Reading timestamp (seconds)
  int validSamples;             // Number of valid burst samples accepted in filter
  float spreadCm;               // Sebaran sampel (max - min) untuk analisa sudut & kestabilan
  String errorMsg;              // Error description if invalid
  uint8_t rawHex[4];            // 4-byte raw frame [0xFF, H, L, SUM] seperti di sensor_test.cpp
};

class SensorA16 {
public:
  SensorA16();
  void begin();
  
  // Single frame read (low-level, listen-only)
  A16Reading readSingleRaw();
  
  // Fast 1-sample live stream untuk mode testing (respons instan < 50ms seperti sensor_test.cpp)
  A16Reading readFastSample();

  // Burst listen-only sampling dengan Median Wave Filter (mode operasional 9-sampel)
  A16Reading readFilteredDistance(int sampleCount = 9);
  
  // Self-Healing recovery routines
  void reinitBus();
  void powerCycle();
  
  int getConsecutiveFailures() const { return consecutiveFails; }
  void resetFailureCount() { consecutiveFails = 0; }
  float getLastValidDistance() const { return lastValidDistance; }

private:
  int consecutiveFails;
  float lastValidDistance;
  bool uartActive;
  std::vector<float> fastHistory;

  void attachUart();
  void flushRx();
  // Membaca satu frame valid [0xFF, H, L, SUM]. Return true bila frame lolos checksum.
  bool readFrame(uint16_t &distMm, unsigned long timeoutMs, uint8_t *outHex = nullptr);
};

#endif // SENSOR_A16_H
