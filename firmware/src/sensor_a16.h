#ifndef SENSOR_A16_H
#define SENSOR_A16_H

#include <stdint.h>
#include <Arduino.h>

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
  String errorMsg;              // Error description if invalid
};

class SensorA16 {
public:
  SensorA16();
  void begin();
  
  // Single frame read (low-level, listen-only)
  A16Reading readSingleRaw();
  
  // Burst listen-only sampling dengan Median Wave Filter
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

  void attachUart();
  void flushRx();
  // Membaca satu frame valid [0xFF, H, L, SUM]. Return true bila frame lolos checksum.
  bool readFrame(uint16_t &distMm, unsigned long timeoutMs);
};

#endif // SENSOR_A16_H
