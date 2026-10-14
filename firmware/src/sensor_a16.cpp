#include "sensor_a16.h"
#include "config.h"
#include <algorithm>
#include <vector>

// Hardware Serial2 for A16 communication (UART Auto / RS485)
HardwareSerial RS485Serial(2);

SensorA16::SensorA16() : consecutiveFails(0), lastValidDistance(0.0f) {}

void SensorA16::begin() {
  if (PIN_SENSOR_PWR >= 0) {
    pinMode(PIN_SENSOR_PWR, OUTPUT);
    digitalWrite(PIN_SENSOR_PWR, HIGH); // Enable sensor power via MOSFET (if present)
  }

  // ESP32 Serial2: 3rd arg = rxPin (GPIO 16), 4th arg = txPin (GPIO 15)
  // Pin 16 (RX2) -> Sensor TX (Kaki 4 / Kabel Putih)
  // Pin 15 (TX2) -> Sensor RX (Kaki 3 / Kabel Kuning)
  RS485Serial.begin(9600, SERIAL_8N1, PIN_RS485_RX, PIN_RS485_TX);
  delay(100);
  Serial.printf("[A16] Initialized Serial2 on GPIO %d(TX), %d(RX) at 9600 baud\n",
    PIN_RS485_TX, PIN_RS485_RX);
}

void SensorA16::reinitBus() {
  Serial.println("[A16 AUTO-HEAL] Re-initializing Serial2 UART bus...");
  RS485Serial.end();
  delay(100);
  RS485Serial.begin(9600, SERIAL_8N1, PIN_RS485_RX, PIN_RS485_TX);
  delay(50);
}

void SensorA16::powerCycle() {
  if (PIN_SENSOR_PWR >= 0) {
    Serial.printf("[A16 AUTO-HEAL] Power-cycling A16 ultrasonic sensor via GPIO %d MOSFET...\n", PIN_SENSOR_PWR);
    digitalWrite(PIN_SENSOR_PWR, LOW);
    delay(1200);
    digitalWrite(PIN_SENSOR_PWR, HIGH);
    delay(1800); // Allow sensor internal MCU to finish cold-boot
  }
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
  
  // Ambient temperature estimation (ESP32 chip sensor corrected or 28.5C fallback)
  #ifdef SOC_TEMP_SENSOR_SUPPORTED
  float chipTemp = temperatureRead();
  reading.temperatureC = (chipTemp > 0.0f && chipTemp < 80.0f) ? (chipTemp - 12.0f) : 28.5f;
  #else
  reading.temperatureC = 28.5f;
  #endif

  reading.timestamp = millis() / 1000;
  reading.validSamples = 0;

  // If buffer has accumulated a backlog of stale bytes, discard older bytes keeping only the latest frame window
  if (RS485Serial.available() > 16) {
    while (RS485Serial.available() > 8) {
      RS485Serial.read();
    }
  }

  // =========================================================================
  // PROTOCOL 1: UART AUTO (FF Protocol - ff_uart_auto_2024_ESP32)
  // The sensor broadcasts continuously: [0xFF, Data_High, Data_Low, Checksum]
  // Checksum = (0xFF + Data_High + Data_Low) & 0xFF
  // Distance (mm) = (Data_High << 8) | Data_Low
  // =========================================================================
  unsigned long startWait = millis();
  const unsigned long autoTimeoutMs = 400; // Sensor broadcasts every ~100ms

  while (millis() - startWait < autoTimeoutMs) {
    if (RS485Serial.available()) {
      uint8_t header = RS485Serial.read();
      if (header == 0xFF) {
        // Found potential frame header 0xFF; read the following 3 bytes
        uint8_t payload[3];
        int bytesRead = 0;
        unsigned long byteWait = millis();
        while (bytesRead < 3 && (millis() - byteWait < 120)) {
          if (RS485Serial.available()) {
            payload[bytesRead++] = RS485Serial.read();
          } else {
            delay(2);
          }
        }

        if (bytesRead == 3) {
          uint8_t dataH = payload[0];
          uint8_t dataL = payload[1];
          uint8_t checksum = payload[2];
          uint8_t expectedSum = (uint8_t)(0xFF + dataH + dataL);

          if (checksum == expectedSum) {
            uint16_t distMm = ((uint16_t)dataH << 8) | dataL;
            float distCm = distMm / 10.0f;

            // Range validation: A16 typical range 20cm - 1500cm (allow 15cm for bench testing)
            if (distMm > 0 && distCm >= 15.0f && distCm <= 1500.0f) {
              reading.isValid = true;
              reading.rawDistanceCm = distCm;
              reading.filteredDistanceCm = applyTemperatureCompensation(distCm, reading.temperatureC);
              reading.validSamples = 1;
              reading.errorMsg = "";
              Serial.printf("[A16 UART] Raw Distance: %u mm (%.1f cm)\n", distMm, distCm);
              return reading;
            } else if (distMm == 0) {
              reading.errorMsg = "NO_ECHO_OR_OUT_OF_RANGE";
            } else if (distCm < 15.0f) {
              reading.errorMsg = "OUT_OF_RANGE_BLIND_ZONE";
            } else {
              reading.errorMsg = "OUT_OF_MAX_RANGE";
            }
          }
        }
      }
    } else {
      delay(5);
    }
  }

  // =========================================================================
  // PROTOCOL 2: MODBUS RTU FALLBACK (Executed only if UART Auto broadcast is silent)
  // Query: 01 03 00 01 00 01 D5 CA
  // Response: 01 03 02 [Data_High] [Data_Low] [CRC_Low] [CRC_High]
  // =========================================================================
  while (RS485Serial.available()) {
    RS485Serial.read();
  }

  const uint8_t queryFrame[] = { 0x01, 0x03, 0x00, 0x01, 0x00, 0x01, 0xD5, 0xCA };
  RS485Serial.write(queryFrame, sizeof(queryFrame));
  RS485Serial.flush();

  startWait = millis();
  uint8_t mbBuffer[16];
  int mbBytes = 0;

  while (millis() - startWait < 400) {
    if (RS485Serial.available()) {
      mbBuffer[mbBytes++] = RS485Serial.read();
      if (mbBytes >= 7) break;
    }
    delay(2);
  }

  if (mbBytes >= 7 && mbBuffer[0] == 0x01 && mbBuffer[1] == 0x03 && mbBuffer[2] == 0x02) {
    uint16_t mbDistMm = ((uint16_t)mbBuffer[3] << 8) | mbBuffer[4];
    float mbDistCm = mbDistMm / 10.0f;
    if (mbDistCm >= 15.0f && mbDistCm <= 1500.0f) {
      reading.isValid = true;
      reading.rawDistanceCm = mbDistCm;
      reading.filteredDistanceCm = applyTemperatureCompensation(mbDistCm, reading.temperatureC);
      reading.validSamples = 1;
      reading.errorMsg = "";
      Serial.printf("[A16 MODBUS] Raw Distance: %u mm (%.1f cm)\n", mbDistMm, mbDistCm);
      return reading;
    } else {
      reading.errorMsg = "OUT_OF_RANGE_BLIND_ZONE";
    }
  } else {
    if (reading.errorMsg.length() == 0) {
      reading.errorMsg = "UART_TIMEOUT_NO_RESPONSE";
    }
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
      delay(70); // Short interval between acoustic burst pings
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
