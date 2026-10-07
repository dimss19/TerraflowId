#ifndef SENSOR_A16_H
#define SENSOR_A16_H

#include <stdint.h>
#include <Arduino.h>

/**
 * A16 Ultrasonic Sensor Reading Structure
 * Includes raw, temperature-compensated, and wave-filtered distance.
 */
struct A16Reading {
  bool isValid;
  float rawDistanceCm;          // Direct reading from sensor
  float filteredDistanceCm;     // Wave-filtered (median) & temperature compensated
  float temperatureC;           // Ambient temperature used for acoustic compensation
  uint32_t timestamp;           // Reading timestamp (seconds)
  int validSamples;             // Number of valid burst samples accepted in filter
  String errorMsg;              // Error description if invalid
};

class SensorA16 {
public:
  SensorA16();
  void begin();
  
  // Single raw poll (low-level)
  A16Reading readSingleRaw();
  
  // High-reliability burst sampling with Moving Median Wave Filter & Temperature Compensation
  A16Reading readFilteredDistance(int sampleCount = 5);
  
  // Self-Healing recovery routines
  void reinitBus();
  void powerCycle();
  
  int getConsecutiveFailures() const { return consecutiveFails; }
  void resetFailureCount() { consecutiveFails = 0; }
  float getLastValidDistance() const { return lastValidDistance; }

private:
  int consecutiveFails;
  float lastValidDistance;
  uint16_t calculateCRC16(const uint8_t *buffer, uint16_t len);
  float applyTemperatureCompensation(float rawDistCm, float tempC);
};

#endif // SENSOR_A16_H
