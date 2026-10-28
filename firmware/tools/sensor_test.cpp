/**
 * TerraFlow AWLR — Tool Khusus Diagnostik & Troubleshooting Sensor DYP-A1611AU
 * PT Tanah Airku Teknologi
 * 
 * Fokus Pengujian:
 * 1. Monitor data stream UART Auto (9600 8N1) secara listen-only pada GPIO 8 (Terminal SDA).
 * 2. Analisa integritas frame [0xFF, Data_H, Data_L, Checksum].
 * 3. Deteksi kondisi: Normal (50-1500 cm), Blind Zone (<50 cm), No Echo (0 mm), atau Corrupted Checksum.
 * 4. Statistik real-time: Frames per second (FPS), persentase frame valid, dan sebaran jitter.
 */

#include <Arduino.h>
#include <SPI.h>
#include <SD.h>
#include <Wire.h>

// MicroSD Pins
#define PIN_SD_CS   10
#define PIN_SD_MOSI 11
#define PIN_SD_SCK  12
#define PIN_SD_MISO 13

// RTC I2C Pins & Address
#define PIN_RTC_SDA 8
#define PIN_RTC_SCL 9
#define RTC_ADDR    0x68

// Serial2 Listen-Only untuk Sensor (GPIO 8 RX, TX tidak dipakai / -1)
#define PIN_SENSOR_RX 8
#define PIN_SENSOR_TX -1

HardwareSerial SensorUART(2);

static uint8_t bcd2dec(uint8_t val) { return ((val / 16 * 10) + (val % 16)); }

void testSdCard() {
  Serial.println("\n--------------------------------------------------------");
  Serial.println("📂 [DIAGNOSTIK 1] MicroSD Card SPI Interface");
  pinMode(PIN_SD_CS, OUTPUT);
  digitalWrite(PIN_SD_CS, HIGH);
  pinMode(PIN_SD_MISO, INPUT_PULLUP);
  delay(10);

  SPIClass spi(FSPI);
  spi.begin(PIN_SD_SCK, PIN_SD_MISO, PIN_SD_MOSI, -1);
  delay(20);

  bool mounted = SD.begin(PIN_SD_CS, spi, 4000000);
  if (mounted) {
    Serial.printf("   ✅ MicroSD OK! Size: %llu MB\n", SD.cardSize() / (1024 * 1024));
    SD.end();
  } else {
    Serial.println("   ⚠️ MicroSD tidak terpasang (Bukan masalah untuk tes sensor).");
  }
}

void testRtc() {
  Serial.println("\n--------------------------------------------------------");
  Serial.println("🕒 [DIAGNOSTIK 2] Onboard RTC I2C (0x68)");
  Wire.begin(PIN_RTC_SDA, PIN_RTC_SCL, 100000);
  delay(10);

  Wire.beginTransmission(RTC_ADDR);
  uint8_t err = Wire.endTransmission();

  if (err == 0) {
    Serial.println("   ✅ Onboard RTC (0x68) terdeteksi normal!");
    Wire.beginTransmission(RTC_ADDR);
    Wire.write((uint8_t)0x00);
    if (Wire.endTransmission() == 0 && Wire.requestFrom((uint8_t)RTC_ADDR, (uint8_t)7) == 7) {
      uint8_t sec  = bcd2dec(Wire.read() & 0x7F);
      uint8_t min  = bcd2dec(Wire.read() & 0x7F);
      uint8_t hour = bcd2dec(Wire.read() & 0x3F);
      uint8_t dow  = bcd2dec(Wire.read() & 0x07);
      uint8_t day  = bcd2dec(Wire.read() & 0x3F);
      uint8_t mon  = bcd2dec(Wire.read() & 0x1F);
      uint8_t yr   = bcd2dec(Wire.read());
      Serial.printf("   - Waktu RTC: %04d-%02d-%02d %02d:%02d:%02d\n", 2000 + yr, mon, day, hour, min, sec);
    }
  } else {
    Serial.printf("   ℹ️ RTC tidak merespons (Kode Error I2C: %d)\n", err);
  }

  // Wajib lepaskan bus I2C agar GPIO 8 bebas digunakan untuk UART Sensor
  Wire.end();
  delay(20);
}

void setup() {
  Serial.begin(115200);
  delay(1500);

  Serial.println("\n========================================================");
  Serial.println("   TERRAFLOW — LIVE SENSOR TROUBLESHOOTING TOOL        ");
  Serial.println("          Sensor Ultrasonik DYP-A1611AU                 ");
  Serial.println("               PT Tanah Airku Teknologi                ");
  Serial.println("========================================================");
  Serial.println(" Wiring yang Diharapkan Saat Ini:");
  Serial.println("   [Pin 1] SDA (GPIO 8)  <-- Kabel PUTIH (TX Sensor)");
  Serial.println("   [Pin 3] 5V            <-- Kabel MERAH (VCC Sensor)");
  Serial.println("   [Pin 4] GND           <-- Kabel HITAM (GND) & Kabel KUNING (RX Real-Time)");
  Serial.println("   [Mode Operasi]        <-- Real-Time Mode (~500ms respons instan)");
  Serial.println("========================================================");

  // Uji SD & RTC awal
  testSdCard();
  testRtc();

  // Inisialisasi Serial2 khusus RX (Listen-Only)
  Serial.println("\n--------------------------------------------------------");
  Serial.println("🎧 Memulai mode LISTEN-ONLY Serial2 UART (9600 8N1)...");
  Serial.println("   Mendengarkan data stream otomatis dari Kabel Putih di GPIO 8...");
  Serial.println("--------------------------------------------------------\n");

  SensorUART.begin(9600, SERIAL_8N1, PIN_SENSOR_RX, PIN_SENSOR_TX);
}

// Statistik Troubleshooter
unsigned long totalBytesRx = 0;
unsigned long validFrames = 0;
unsigned long checksumErrors = 0;
unsigned long noEchoCount = 0;
unsigned long blindZoneCount = 0;
unsigned long normalRangeCount = 0;
unsigned long outOfMaxCount = 0;

float minDistanceCm = 9999.0f;
float maxDistanceCm = 0.0f;
float lastValidDistanceCm = 0.0f;

unsigned long lastStatsPrintMs = 0;
unsigned long lastByteReceivedMs = 0;
uint8_t win[4];
int filled = 0;

void loop() {
  while (SensorUART.available()) {
    uint8_t b = (uint8_t)SensorUART.read();
    totalBytesRx++;
    lastByteReceivedMs = millis();

    // Sliding window 4 byte
    if (filled < 4) {
      win[filled++] = b;
    } else {
      win[0] = win[1];
      win[1] = win[2];
      win[2] = win[3];
      win[3] = b;
    }

    // Evaluasi jika frame diawali 0xFF
    if (filled == 4 && win[0] == 0xFF) {
      uint8_t expectedChecksum = (uint8_t)(win[0] + win[1] + win[2]);
      uint8_t actualChecksum = win[3];

      if (expectedChecksum == actualChecksum) {
        validFrames++;
        uint16_t distMm = ((uint16_t)win[1] << 8) | win[2];
        float distCm = distMm / 10.0f;

        // Cetak frame live
        if (distMm == 0) {
          noEchoCount++;
          Serial.printf("⚠️ [FRAME VALID | NO ECHO] Raw Hex: [%02X %02X %02X %02X] -> Jarak: 0 mm (Target terlalu jauh/miring)\n",
            win[0], win[1], win[2], win[3]);
        } else if (distMm <= 500) {
          blindZoneCount++;
          Serial.printf("🚨 [BLIND SPOT TERDETEKSI!] Raw Hex: [%02X %02X %02X %02X] -> Jarak: %u mm (%.1f cm) (Objek/Air <= 50 cm di Zona Buta!)\n",
            win[0], win[1], win[2], win[3], distMm, distCm);
        } else if (distMm > 15000) {
          outOfMaxCount++;
          Serial.printf("⚠️ [FRAME VALID | OUT OF MAX] Raw Hex: [%02X %02X %02X %02X] -> Jarak: %u mm (%.1f cm) (> 15 m)\n",
            win[0], win[1], win[2], win[3], distMm, distCm);
        } else {
          normalRangeCount++;
          lastValidDistanceCm = distCm;
          if (distCm < minDistanceCm) minDistanceCm = distCm;
          if (distCm > maxDistanceCm) maxDistanceCm = distCm;

          Serial.printf("🎯 [OK VALID] Raw: [%02X %02X %02X %02X] -> JARAK: %5u mm (%6.1f cm) | %5.2f meter\n",
            win[0], win[1], win[2], win[3], distMm, distCm, distCm / 100.0f);
        }
      } else {
        checksumErrors++;
        Serial.printf("❌ [CHECKSUM ERROR] Hex: [%02X %02X %02X %02X] (Dihitung: 0x%02X != Diterima: 0x%02X)\n",
          win[0], win[1], win[2], win[3], expectedChecksum, actualChecksum);
      }
    }
  }

  // Ringkasan Statistik Diagnostik setiap 3 detik
  unsigned long now = millis();
  if (now - lastStatsPrintMs >= 3000) {
    lastStatsPrintMs = now;

    Serial.println("\n----------------- 📊 RINGKASAN DIAGNOSTIK -----------------");
    if (totalBytesRx == 0) {
      Serial.println("❌ TIDAK ADA DATA SAMA SEKALI DARI SENSOR!");
      Serial.println("   Pemeriksaan Fisik:");
      Serial.println("   1. Pastikan Kabel Putih (TX Sensor) kencang di Terminal SDA (GPIO 8).");
      Serial.println("   2. Pastikan Kabel Merah terhubung ke 5V dan Kabel Hitam ke GND.");
      Serial.println("   3. Ukur tegangan kabel putih: harus ada tegangan aktif ~3.1V.");
    } else if (now - lastByteReceivedMs > 2000) {
      Serial.println("⚠️ ALIRAN DATA BERHENTI (Data freeze)! Tidak ada byte masuk dalam 2 detik terakhir.");
    } else {
      float validPercent = (validFrames + checksumErrors > 0) 
        ? ((float)validFrames / (validFrames + checksumErrors) * 100.0f) : 0.0f;
      float spread = (maxDistanceCm >= minDistanceCm && minDistanceCm < 9000.0f) 
        ? (maxDistanceCm - minDistanceCm) : 0.0f;

      Serial.printf("• Total Byte Diterima : %lu bytes\n", totalBytesRx);
      Serial.printf("• Frame Valid         : %lu (%.1f%% dari total frame)\n", validFrames, validPercent);
      Serial.printf("• Checksum Mismatch   : %lu\n", checksumErrors);
      Serial.printf("• Kategori Pantulan   : Normal=%lu | No-Echo=%lu | BlindZone=%lu\n",
        normalRangeCount, noEchoCount, blindZoneCount);

      if (normalRangeCount > 0) {
        Serial.printf("• Jarak Terakhir      : %.1f cm (%.2f m)\n", lastValidDistanceCm, lastValidDistanceCm / 100.0f);
        Serial.printf("• Rentang Fluktuasi   : Min=%.1f cm, Max=%.1f cm (Jitter: ±%.1f cm)\n",
          minDistanceCm, maxDistanceCm, spread / 2.0f);
      }

      // Reset min/max lokal per jendela agar jitter selalu aktual
      minDistanceCm = 9999.0f;
      maxDistanceCm = 0.0f;
    }
    Serial.println("-----------------------------------------------------------\n");
  }

  delay(2);
}
