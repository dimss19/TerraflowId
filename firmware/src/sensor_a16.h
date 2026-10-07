#ifndef SENSOR_A16_H
#define SENSOR_A16_H

#include <Arduino.h>

struct A16Reading {
  bool isValid;
  float rawDistanceCm;
  float temperatureC;
  uint32_t timestamp;
  String errorMsg;
};

class SensorA16 {
public:
  SensorA16();
  void begin();
  A16Reading readDistance();
  void powerCycle();
  int getConsecutiveFailures() const { return consecutiveFails; }
  void resetFailureCount() { consecutiveFails = 0; }

private:
  int consecutiveFails;
  float lastValidDistance;
  uint16_t calculateCRC16(const uint8_t *buffer, uint16_t len);
};

#endif // SENSOR_A16_H
