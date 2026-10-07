#include "sensor_a16.h"
#include "config.h"

// Hardware Serial2 for RS485 communication
HardwareSerial RS485Serial(2);

SensorA16::SensorA16() : consecutiveFails(0), lastValidDistance(0.0f) {}

void SensorA16::begin() {
  pinMode(PIN_SENSOR_PWR, OUTPUT);
  digitalWrite(PIN_SENSOR_PWR, HIGH); // Enable sensor power

  RS485Serial.begin(9600, SERIAL_8N1, PIN_RS485_RX, PIN_RS485_TX);
  delay(100);
  Serial.println("[A16] Initialized RS485 Modbus interface on GPIO 15(TX), 16(RX)");
}

A16Reading SensorA16::readDistance() {
  A16Reading reading;
  reading.isValid = false;
  reading.rawDistanceCm = 0.0f;
  reading.temperatureC = 28.0f; // Ambient fallback
  reading.timestamp = millis() / 1000;

  // Flush buffer
  while (RS485Serial.available()) {
    RS485Serial.read();
  }

  // Modbus RTU Query Frame: Address 0x01, Function 0x03, Start 0x0100, 1 Register
  // Or direct command trigger 0x01, 0x03, 0x00, 0x01, 0x00, 0x01, 0xD5, 0xCA
  const uint8_t queryFrame[] = { 0x01, 0x03, 0x00, 0x01, 0x00, 0x01, 0xD5, 0xCA };
  RS485Serial.write(queryFrame, sizeof(queryFrame));
  RS485Serial.flush();

  // Wait for response with 1500ms timeout
  unsigned long startWait = millis();
  uint8_t buffer[16];
  int bytesRead = 0;

  while (millis() - startWait < 1500) {
    if (RS485Serial.available()) {
      buffer[bytesRead++] = RS485Serial.read();
      if (bytesRead >= 7) break; // Modbus response is typically 7 bytes
    }
    delay(2);
  }

  if (bytesRead >= 7) {
    // Check Address and Function Code
    if (buffer[0] == 0x01 && buffer[1] == 0x03 && buffer[2] == 0x02) {
      uint16_t distanceMm = (buffer[3] << 8) | buffer[4];
      float distanceCm = distanceMm / 10.0f;

      // Validate A16 range (50 cm to 1500 cm)
      if (distanceCm >= 50.0f && distanceCm <= 1500.0f) {
        reading.isValid = true;
        reading.rawDistanceCm = distanceCm;
        lastValidDistance = distanceCm;
        consecutiveFails = 0;
        return reading;
      } else {
        reading.errorMsg = "OUT_OF_RANGE_BLIND_ZONE";
      }
    } else {
      reading.errorMsg = "INVALID_RESPONSE_HEADER";
    }
  } else if (bytesRead > 0) {
    // Attempt parsing UART Auto stream format (Header 0xFF, High, Low, Sum)
    for (int i = 0; i < bytesRead - 3; i++) {
      if (buffer[i] == 0xFF) {
        uint8_t high = buffer[i + 1];
        uint8_t low = buffer[i + 2];
        uint8_t sum = buffer[i + 3];
        if (((0xFF + high + low) & 0xFF) == sum) {
          float distCm = ((high << 8) | low) / 10.0f;
          if (distCm >= 50.0f && distCm <= 1500.0f) {
            reading.isValid = true;
            reading.rawDistanceCm = distCm;
            lastValidDistance = distCm;
            consecutiveFails = 0;
            return reading;
          }
        }
      }
    }
    reading.errorMsg = "CHECKSUM_OR_FRAME_ERROR";
  } else {
    reading.errorMsg = "RS485_TIMEOUT_NO_RESPONSE";
  }

  consecutiveFails++;
  Serial.printf("[A16 WARNING] Read failed (%d consecutive): %s\n", consecutiveFails, reading.errorMsg.c_str());

  if (consecutiveFails >= 5) {
    Serial.println("[A16 CRITICAL] 5 consecutive failures! Power cycling sensor...");
    powerCycle();
  }

  return reading;
}

void SensorA16::powerCycle() {
  digitalWrite(PIN_SENSOR_PWR, LOW);
  delay(1000);
  digitalWrite(PIN_SENSOR_PWR, HIGH);
  delay(1500); // Allow sensor internal MCU to boot
  Serial.println("[A16] Sensor power cycled.");
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
