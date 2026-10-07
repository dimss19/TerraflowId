#include "sensor_a16.h"
#include "config.h"
#include <algorithm>
#include <vector>

// Hardware Serial2 for RS485 communication
HardwareSerial RS485Serial(2);

SensorA16::SensorA16() : consecutiveFails(0), lastValidDistance(0.0f) {}

void SensorA16::begin() {
  pinMode(PIN_SENSOR_PWR, OUTPUT);
  digitalWrite(PIN_SENSOR_PWR, HIGH); // Enable sensor power via MOSFET

  RS485Serial.begin(9600, SERIAL_8N1, PIN_RS485_RX, PIN_RS485_TX);
  delay(100);
  Serial.println("[A16] Initialized RS485 Modbus interface on GPIO 15(TX), 16(RX)");
}

void SensorA16::reinitBus() {
  Serial.println("[A16 AUTO-HEAL] Re-initializing RS485 UART bus...");
  RS485Serial.end();
  delay(100);
  RS485Serial.begin(9600, SERIAL_8N1, PIN_RS485_RX, PIN_RS485_TX);
  delay(50);
}

void SensorA16::powerCycle() {
  Serial.println("[A16 AUTO-HEAL] Power-cycling A16 ultrasonic sensor via GPIO 5 MOSFET...");
  digitalWrite(PIN_SENSOR_PWR, LOW);
  delay(1200);
  digitalWrite(PIN_SENSOR_PWR, HIGH);
  delay(1800); // Allow sensor internal MCU to finish cold-boot
  reinitBus();
  Serial.println("[A16 AUTO-HEAL] Sensor power cycle completed.");
}

float SensorA16::applyTemperatureCompensation(float rawDistCm, float tempC) {
  // Speed of sound: v = 331.3 * sqrt(1 + T / 273.15) m/s
  // A16 factory calibrated at standard T0 = 25.0 C (v0 = 346.13 m/s)
  float vActual = 331.3f * sqrtf(1.0f + (tempC / 273.15f));
  float vCalib = 331.3f * sqrtf(1.0f + (25.0f / 273.15f));
  float ratio = vActual / vCalib;
  return rawDistCm * ratio;
}

A16Reading SensorA16::readSingleRaw() {
  A16Reading reading;
  reading.isValid = false;
  reading.rawDistanceCm = 0.0f;
  reading.filteredDistanceCm = 0.0f;
  
  // Ambient temperature estimation (ESP32 chip sensor corrected or 28.0C fallback)
  #ifdef SOC_TEMP_SENSOR_SUPPORTED
  float chipTemp = temperatureRead();
  reading.temperatureC = (chipTemp > 0.0f && chipTemp < 80.0f) ? (chipTemp - 12.0f) : 28.5f;
  #else
  reading.temperatureC = 28.5f;
  #endif

  reading.timestamp = millis() / 1000;
  reading.validSamples = 0;

  // Flush buffer to discard stale bytes
  while (RS485Serial.available()) {
    RS485Serial.read();
  }

  // Modbus RTU Query Frame: Address 0x01, Function 0x03, Register 0x0100
  const uint8_t queryFrame[] = { 0x01, 0x03, 0x00, 0x01, 0x00, 0x01, 0xD5, 0xCA };
  RS485Serial.write(queryFrame, sizeof(queryFrame));
  RS485Serial.flush();

  // Wait for response with 1200ms timeout
  unsigned long startWait = millis();
  uint8_t buffer[16];
  int bytesRead = 0;

  while (millis() - startWait < 1200) {
    if (RS485Serial.available()) {
      buffer[bytesRead++] = RS485Serial.read();
      if (bytesRead >= 7) break;
    }
    delay(2);
  }

  if (bytesRead >= 7) {
    if (buffer[0] == 0x01 && buffer[1] == 0x03 && buffer[2] == 0x02) {
      uint16_t distanceMm = (buffer[3] << 8) | buffer[4];
      float distanceCm = distanceMm / 10.0f;

      // Validate A16 range (50 cm to 1500 cm)
      if (distanceCm >= 50.0f && distanceCm <= 1500.0f) {
        reading.isValid = true;
        reading.rawDistanceCm = distanceCm;
        reading.filteredDistanceCm = applyTemperatureCompensation(distanceCm, reading.temperatureC);
        reading.validSamples = 1;
        return reading;
      } else {
        reading.errorMsg = "OUT_OF_RANGE_BLIND_ZONE";
      }
    } else {
      reading.errorMsg = "INVALID_RESPONSE_HEADER";
    }
  } else if (bytesRead > 0) {
    // Attempt parsing UART Auto stream format (Header 0xFF, High, Low, Sum)
    for (int i = 0; i <= bytesRead - 4; i++) {
      if (buffer[i] == 0xFF) {
        uint8_t high = buffer[i + 1];
        uint8_t low = buffer[i + 2];
        uint8_t sum = buffer[i + 3];
        if (((0xFF + high + low) & 0xFF) == sum) {
          float distCm = ((high << 8) | low) / 10.0f;
          if (distCm >= 50.0f && distCm <= 1500.0f) {
            reading.isValid = true;
            reading.rawDistanceCm = distCm;
            reading.filteredDistanceCm = applyTemperatureCompensation(distCm, reading.temperatureC);
            reading.validSamples = 1;
            return reading;
          }
        }
      }
    }
    reading.errorMsg = "CHECKSUM_OR_FRAME_ERROR";
  } else {
    reading.errorMsg = "RS485_TIMEOUT_NO_RESPONSE";
  }

  return reading;
}

A16Reading SensorA16::readFilteredDistance(int sampleCount) {
  std::vector<float> validSamples;
  A16Reading lastAttempt;
  
  if (sampleCount < 1) sampleCount = 5;

  // Burst sampling to eliminate surface waves and debris anomalies
  for (int i = 0; i < sampleCount; i++) {
    lastAttempt = readSingleRaw();
    if (lastAttempt.isValid) {
      validSamples.push_back(lastAttempt.rawDistanceCm);
    }
    if (i < sampleCount - 1) {
      delay(60); // Short interval between acoustic burst pings
    }
  }

  // If we collected at least one valid sample
  if (!validSamples.empty()) {
    std::sort(validSamples.begin(), validSamples.end());
    
    // Pick median element
    float medianRaw = validSamples[validSamples.size() / 2];
    
    A16Reading result;
    result.isValid = true;
    result.rawDistanceCm = medianRaw;
    result.temperatureC = lastAttempt.temperatureC;
    result.filteredDistanceCm = applyTemperatureCompensation(medianRaw, result.temperatureC);
    result.timestamp = millis() / 1000;
    result.validSamples = (int)validSamples.size();
    
    lastValidDistance = result.filteredDistanceCm;
    consecutiveFails = 0; // Reset failure counter on success

    Serial.printf("[A16 WAVE-FILTER] Accepted %d/%d samples. Median Raw: %.1f cm -> Temp-Compensated: %.1f cm (T=%.1fC)\n",
      result.validSamples, sampleCount, result.rawDistanceCm, result.filteredDistanceCm, result.temperatureC);
      
    return result;
  }

  // If ALL burst samples failed -> Trigger Autonomous Self-Healing
  consecutiveFails++;
  Serial.printf("[A16 WARNING] All %d burst samples failed (%d consecutive cycle failures): %s\n",
    sampleCount, consecutiveFails, lastAttempt.errorMsg.c_str());

  if (consecutiveFails == 2) {
    // Stage 1 Auto-heal: Flush & Re-init UART bus
    reinitBus();
  } else if (consecutiveFails >= 4) {
    // Stage 2 Auto-heal: Hard power cycle sensor via MOSFET
    powerCycle();
  }

  lastAttempt.rawDistanceCm = lastValidDistance;
  lastAttempt.filteredDistanceCm = lastValidDistance;
  return lastAttempt;
}

uint16_t SensorA16::calculateCRC16(const uint8_t *buffer, uint16_t len) {
  uint16_t crc = 0xFFFF;
  for (uint16_t pos = 0; pos < len; pos++) {
    crc ^= (uint16_t)buffer[pos];
    for (int i = 8; i != 0; i--) {
      if ((crc & 0x0001) != 0) {
        crc >>= 1;
        crc ^= 0xA001;
      } else {
        crc >>= 1;
      }
    }
  }
  return crc;
}
