#include "sensor_a16.h"
#include "config.h"
#include "rtc_mgr.h"
#include <algorithm>
#include <vector>

// Hardware Serial2 for A16 communication (UART Auto / Controlled / RS485)
HardwareSerial RS485Serial(2);

SensorA16::SensorA16() : consecutiveFails(0), lastValidDistance(0.0f) {}

void SensorA16::begin() {
  if (PIN_SENSOR_PWR >= 0) {
    pinMode(PIN_SENSOR_PWR, OUTPUT);
    digitalWrite(PIN_SENSOR_PWR, HIGH); // Enable sensor power via MOSFET (if present)
  }

  // Serial2 Hardware UART langsung ke GPIO 8 (RX) dan GPIO 9 (TX)
  rtcMgr.releaseBus();
  RS485Serial.begin(9600, SERIAL_8N1, PIN_RS485_RX, PIN_RS485_TX);
  delay(100);
  
  // Bersihkan buffer awal
  while (RS485Serial.available()) {
    RS485Serial.read();
  }

  Serial.println("[A16] Inisialisasi Serial2 UART untuk Sensor A16:");
  Serial.printf("      - ESP32 TX2 (GPIO %d / Terminal SCL) -> Sensor RX (Kabel Kuning)\n", PIN_RS485_TX);
  Serial.printf("      - ESP32 RX2 (GPIO %d / Terminal SDA) -> Sensor TX (Kabel Putih)\n", PIN_RS485_RX);
  Serial.println("      - Baudrate: 9600 8N1 (Mode Direct UART TTL)");
  Serial.println("[A16] Port Serial2 UART aktif dan terkunci untuk sensor.");
}

void SensorA16::reinitBus() {
  Serial.println("[A16 AUTO-HEAL] Re-inisialisasi bus Serial2 UART...");
  RS485Serial.end();
  delay(80);
  RS485Serial.begin(9600, SERIAL_8N1, PIN_RS485_RX, PIN_RS485_TX);
  delay(50);
  while (RS485Serial.available()) {
    RS485Serial.read();
  }
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

float SensorA16::applyTemperatureCompensation(float rawDistCm, float tempC) {
  // Kecepatan suara: v = 331.3 * sqrt(1 + T / 273.15) m/s
  // Kalibrasi pabrik standar A16 pada T0 = 25.0 C (v0 = 346.13 m/s)
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
  
  #ifdef SOC_TEMP_SENSOR_SUPPORTED
  float chipTemp = temperatureRead();
  reading.temperatureC = (chipTemp > 0.0f && chipTemp < 80.0f) ? (chipTemp - 12.0f) : 28.5f;
  #else
  reading.temperatureC = 28.5f;
  #endif

  reading.timestamp = millis() / 1000;
  reading.validSamples = 0;
  reading.errorMsg = "";

  // Bersihkan buffer sebelum membaca untuk membuang byte basi
  while (RS485Serial.available()) {
    RS485Serial.read();
  }

  // =========================================================================
  // METODE 1: UART CONTROLLED / AUTO (Protokol Standar DYP-A16 4-Byte)
  // Frame format: [0xFF, Data_High, Data_Low, Checksum]
  // Checksum = (0xFF + Data_High + Data_Low) & 0xFF
  // Distance (mm) = (Data_High << 8) | Data_Low
  // =========================================================================
  // Kirim trigger byte (0x01) ke Pin RX sensor (Terminal SCL / GPIO 9)
  // Untuk varian UART Controlled, trigger ini memicu tembakan pulsa akustik.
  // Untuk varian UART Auto, trigger ini diabaikan dengan aman oleh sensor.
  RS485Serial.write((uint8_t)0x01);
  RS485Serial.flush();

  unsigned long startWait = millis();
  const unsigned long uartTimeoutMs = 500; // Cukup untuk siklus streaming / echo 15m
  uint8_t rxBuf[64];
  int rxCount = 0;

  while (millis() - startWait < uartTimeoutMs) {
    while (RS485Serial.available() && rxCount < (int)sizeof(rxBuf)) {
      rxBuf[rxCount++] = (uint8_t)RS485Serial.read();
    }

    // Cari frame 0xFF dengan sliding window
    for (int i = 0; i <= rxCount - 4; i++) {
      if (rxBuf[i] == 0xFF) {
        uint8_t dataH = rxBuf[i + 1];
        uint8_t dataL = rxBuf[i + 2];
        uint8_t checksum = rxBuf[i + 3];
        uint8_t expectedSum = (uint8_t)(0xFF + dataH + dataL);

        if (checksum == expectedSum) {
          uint16_t distMm = ((uint16_t)dataH << 8) | dataL;
          float distCm = distMm / 10.0f;

          // Validasi rentang A16: 15cm - 1500cm (spesifikasi 50cm-1500cm, toleransi meja uji 15cm)
          if (distMm > 0 && distCm >= 15.0f && distCm <= 1500.0f) {
            reading.isValid = true;
            reading.rawDistanceCm = distCm;
            reading.filteredDistanceCm = applyTemperatureCompensation(distCm, reading.temperatureC);
            reading.validSamples = 1;
            reading.errorMsg = "";
            Serial.printf("[A16 UART] SUKSES! Jarak Raw: %u mm (%.1f cm) | Kompensasi Suhu (%.1fC): %.1f cm\n",
              distMm, distCm, reading.temperatureC, reading.filteredDistanceCm);
            return reading;
          } else if (distMm == 0) {
            reading.errorMsg = "NO_ECHO_OR_OUT_OF_RANGE";
          } else if (distCm < 15.0f) {
            reading.errorMsg = "OUT_OF_RANGE_BLIND_ZONE (<15cm)";
          } else {
            reading.errorMsg = "OUT_OF_MAX_RANGE (>1500cm)";
          }
        }
      }
    }
    delay(5);
  }

  // =========================================================================
  // METODE 2: MODBUS RTU REGISTER 0x0100 (Fallback jika varian RS485 Modbus)
  // Register 0x0100 = Processed Distance dalam mm
  // Query: 01 03 01 00 00 01 85 F6
  // Respons: 01 03 02 [Data_High] [Data_Low] [CRC_Low] [CRC_High]
  // =========================================================================
  while (RS485Serial.available()) {
    RS485Serial.read();
  }

  const uint8_t modbusQuery[] = { 0x01, 0x03, 0x01, 0x00, 0x00, 0x01, 0x85, 0xF6 };
  RS485Serial.write(modbusQuery, sizeof(modbusQuery));
  RS485Serial.flush();

  startWait = millis();
  uint8_t mbBuf[24];
  int mbBytes = 0;

  while (millis() - startWait < 200) {
    while (RS485Serial.available() && mbBytes < (int)sizeof(mbBuf)) {
      mbBuf[mbBytes++] = (uint8_t)RS485Serial.read();
    }

    if (mbBytes >= 7) {
      for (int i = 0; i <= mbBytes - 7; i++) {
        if (mbBuf[i] == 0x01 && mbBuf[i + 1] == 0x03 && mbBuf[i + 2] == 0x02) {
          uint16_t calcCrc = calculateCRC16(&mbBuf[i], 5);
          uint16_t recvCrc = (uint16_t)mbBuf[i + 5] | ((uint16_t)mbBuf[i + 6] << 8);

          if (calcCrc == recvCrc) {
            uint16_t mbDistMm = ((uint16_t)mbBuf[i + 3] << 8) | mbBuf[i + 4];
            float mbDistCm = mbDistMm / 10.0f;
            if (mbDistMm > 0 && mbDistCm >= 15.0f && mbDistCm <= 1500.0f) {
              reading.isValid = true;
              reading.rawDistanceCm = mbDistCm;
              reading.filteredDistanceCm = applyTemperatureCompensation(mbDistCm, reading.temperatureC);
              reading.validSamples = 1;
              reading.errorMsg = "";
              Serial.printf("[A16 MODBUS] SUKSES! Jarak Raw: %u mm (%.1f cm)\n", mbDistMm, mbDistCm);
              return reading;
            }
          }
        }
      }
    }
    delay(4);
  }

  // =========================================================================
  // LOGGING DIAGNOSTIK HARDWARE (Membantu verifikasi fisik wiring di lapangan)
  // =========================================================================
  if (rxCount == 0 && mbBytes == 0) {
    reading.errorMsg = "TIDAK_ADA_DATA_DARI_SENSOR (0 bytes)";
    Serial.printf("[A16 DIAGNOSTIK] ⚠️ Tidak ada data dari sensor pada GPIO %d (Terminal SDA).\n", PIN_RS485_RX);
    Serial.println("  Periksa wiring koneksi KhursLabs:");
    Serial.println("  1. Terminal Pin 1 (SDA) -> Kabel Putih (TX Sensor)");
    Serial.println("  2. Terminal Pin 2 (SCL) -> Kabel Kuning (RX Sensor)");
    Serial.println("  3. Terminal Pin 3 (5V)  -> Kabel Merah (VCC Sensor)");
    Serial.println("  4. Terminal Pin 4 (GND) -> Kabel Hitam (GND Sensor)");
  } else {
    reading.errorMsg = "FORMAT_DATA_INVALID";
    Serial.printf("[A16 DIAGNOSTIK] ⚠️ Menerima data serial (%d bytes UART, %d bytes MB), frame tidak cocok: ",
      rxCount, mbBytes);
    for (int k = 0; k < rxCount && k < 16; k++) {
      Serial.printf("%02X ", rxBuf[k]);
    }
    Serial.println();
  }

  return reading;
}

A16Reading SensorA16::readFilteredDistance(int sampleCount) {
  std::vector<float> validSamples;
  A16Reading lastAttempt;
  
  if (sampleCount < 1) sampleCount = 3;

  // Bersihkan sisa byte di buffer sebelum burst sampling
  while (RS485Serial.available()) {
    RS485Serial.read();
  }

  // Burst sampling untuk menyaring gelombang air dan riak permukaan
  for (int pass = 0; pass < 3 && validSamples.empty(); pass++) {
    if (pass > 0) {
      delay(150);
    }
    for (int i = 0; i < sampleCount; i++) {
      lastAttempt = readSingleRaw();
      if (lastAttempt.isValid) {
        validSamples.push_back(lastAttempt.rawDistanceCm);
      }
      if (i < sampleCount - 1) {
        delay(120); // Jeda antar pulsa akustik agar pantulan tidak tumpang tindih
      }
    }
  }

  // Jika setidaknya ada 1 sampel valid yang diterima dari sensor nyata
  if (!validSamples.empty()) {
    std::sort(validSamples.begin(), validSamples.end());
    
    // Ambil nilai median
    float medianRaw = validSamples[validSamples.size() / 2];
    
    A16Reading result;
    result.isValid = true;
    result.rawDistanceCm = medianRaw;
    result.temperatureC = lastAttempt.temperatureC;
    result.filteredDistanceCm = applyTemperatureCompensation(medianRaw, result.temperatureC);
    result.timestamp = millis() / 1000;
    result.validSamples = (int)validSamples.size();
    result.errorMsg = "";
    
    lastValidDistance = result.filteredDistanceCm;
    consecutiveFails = 0;

    Serial.printf("[A16 WAVE-FILTER] Diterima %d sampel nyata. Median Raw: %.1f cm -> Temp-Compensated: %.1f cm (T=%.1fC)\n",
      result.validSamples, result.rawDistanceCm, result.filteredDistanceCm, result.temperatureC);
      
    return result;
  }

  // JIKA SENSOR NYATA GAGAL / DISCONNECTED SETELAH 3 KALI RETRY:
  consecutiveFails++;
  Serial.printf("[A16 GAGAL] Semua percobaan burst sensor gagal (Kegagalan berturut-turut: %d): %s\n",
    consecutiveFails, lastAttempt.errorMsg.c_str());

  if (consecutiveFails >= 2) {
    reinitBus();
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
    holdResult.temperatureC = lastAttempt.temperatureC;
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
