/**
 * TerraFlow AWLR — KhursLabs ESP32-S3 IoT Logger Hardware Diagnostic Tool
 * PT Tanah Airku Teknologi
 * 
 * Pengujian Lengkap:
 * 1. MicroSD Card SPI: CS=10, MOSI=11, SCK=12, MISO=13 (Mount, Info, Read/Write Test)
 * 2. Onboard RTC I2C: SDA=8, SCL=9 (Deteksi I2C Address 0x68 & Pembacaan Waktu)
 * 3. Sensor Ultrasonik DYP-A16: UART TTL pada Terminal SDA (GPIO 8 RX) & SCL (GPIO 9 TX)
 * 4. Bus RS485 Modbus: GPIO 15 (TX) & GPIO 16 (RX) / Terminal A+ & B-
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

// Hardware Serial instances
HardwareSerial SensorUART(2); // Direct Terminal SDA/SCL: RX=8, TX=9
HardwareSerial RS485Bus(1);   // Terminal A+/B-: RX=16, TX=15

static uint8_t bcd2dec(uint8_t val) { return ((val / 16 * 10) + (val % 16)); }

void testSdCard() {
  Serial.println("\n--------------------------------------------------------");
  Serial.println("📂 [PENGUJIAN 1] MicroSD Card SPI Interface");
  Serial.printf("   Konfigurasi Pin: CS=%d, MOSI=%d, SCK=%d, MISO=%d\n",
    PIN_SD_CS, PIN_SD_MOSI, PIN_SD_SCK, PIN_SD_MISO);

  pinMode(PIN_SD_CS, OUTPUT);
  digitalWrite(PIN_SD_CS, HIGH);
  pinMode(PIN_SD_MISO, INPUT_PULLUP);
  delay(10);

  SPIClass spi(FSPI);
  spi.begin(PIN_SD_SCK, PIN_SD_MISO, PIN_SD_MOSI, -1);
  delay(20);

  bool mounted = SD.begin(PIN_SD_CS, spi, 10000000);
  if (!mounted) {
    Serial.println("   [SD] 10MHz mount gagal, mencoba 4MHz...");
    mounted = SD.begin(PIN_SD_CS, spi, 4000000);
  }

  if (mounted) {
    uint8_t cardType = SD.cardType();
    const char *typeStr = "UNKNOWN";
    if (cardType == CARD_MMC) typeStr = "MMC";
    else if (cardType == CARD_SD) typeStr = "SDSC";
    else if (cardType == CARD_SDHC) typeStr = "SDHC/SDXC";

    uint64_t totalMB = SD.totalBytes() / (1024 * 1024);
    uint64_t usedMB  = SD.usedBytes() / (1024 * 1024);

    Serial.println("   ✅ MicroSD Card BERHASIL DI-MOUNT!");
    Serial.printf("   - Tipe Kartu : %s\n", typeStr);
    Serial.printf("   - Total Size : %llu MB\n", SD.cardSize() / (1024 * 1024));
    Serial.printf("   - Digunakan  : %llu MB / %llu MB\n", usedMB, totalMB);

    // Tes Tulis & Baca File
    File tf = SD.open("/terraflow_test.tmp", FILE_WRITE);
    if (tf) {
      tf.println("TERRAFLOW_SD_OK");
      tf.close();
      File rf = SD.open("/terraflow_test.tmp", FILE_READ);
      if (rf) {
        String content = rf.readStringUntil('\n');
        content.trim();
        rf.close();
        SD.remove("/terraflow_test.tmp");
        if (content == "TERRAFLOW_SD_OK") {
          Serial.println("   ✅ Verifikasi Read/Write MicroSD: 100% SUKSES!");
        }
      }
    }
    SD.end();
  } else {
    Serial.println("   ❌ GAGAL MOUNT MicroSD Card!");
    Serial.println("   Petunjuk: Pastikan kartu SD diformat FAT32 dan terpasang pas pada slot.");
  }
}

void testRtc() {
  Serial.println("\n--------------------------------------------------------");
  Serial.println("🕒 [PENGUJIAN 2] Onboard RTC I2C Bus Scan (0x68)");
  Serial.printf("   Konfigurasi Pin: SDA=GPIO %d, SCL=GPIO %d\n", PIN_RTC_SDA, PIN_RTC_SCL);

  Wire.begin(PIN_RTC_SDA, PIN_RTC_SCL, 100000);
  delay(10);

  Wire.beginTransmission(RTC_ADDR);
  uint8_t err = Wire.endTransmission();

  if (err == 0) {
    Serial.println("   ✅ Onboard RTC (0x68) TERDETEKSI pada bus I2C!");
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
      Serial.printf("   - Waktu RTC Saat Ini: %04d-%02d-%02d %02d:%02d:%02d (Hari #%d)\n",
        2000 + yr, mon, day, hour, min, sec, dow);
    }
  } else {
    Serial.printf("   ℹ️ RTC pada 0x68 belum merespons (Kode Error I2C: %d)\n", err);
    Serial.println("      (Wajar jika kabel sensor UART sedang aktif menarik garis SDA/SCL)");
  }

  Wire.end();
  delay(10);
}

void setup() {
  Serial.begin(115200);
  delay(1500);

  Serial.println("\n========================================================");
  Serial.println("  TERRAFLOW — DIAGNOSTIK HARDWARE KHURSLABS ESP32-S3    ");
  Serial.println("               PT Tanah Airku Teknologi                ");
  Serial.println("========================================================");
  Serial.println(" Terminal Board KhursLabs:");
  Serial.println("   [Pin 1] SDA (GPIO 8)  --> Onboard RTC SDA (0x68) / Sensor A16 TX (Kabel Putih)");
  Serial.println("   [Pin 2] SCL (GPIO 9)  --> Onboard RTC SCL (0x68) / Sensor A16 RX (Kabel Kuning)");
  Serial.println("   [Pin 3] 5V            --> Power VCC Sensor (Kabel Merah)");
  Serial.println("   [Pin 4] GND           --> Ground Sensor (Kabel Hitam)");
  Serial.println("   [Pin 5] RS485 A+      --> Eksternal RS485 A+ (Opsional)");
  Serial.println("   [Pin 6] RS485 B-      --> Eksternal RS485 B- (Opsional)");
  Serial.println("========================================================");

  // Jalankan Uji SD Card dan RTC saat boot
  testSdCard();
  testRtc();

  Serial.println("\n--------------------------------------------------------");
  Serial.println("🌊 [PENGUJIAN 3] Memulai Monitoring Sensor Ultrasonik A16...");
  Serial.println("   Mode UART TTL pada Terminal SDA (Pin 1) & SCL (Pin 2)");
  Serial.println("   Kirim trigger 0x01 setiap 2 detik ke kabel Kuning (RX Sensor)...");
  Serial.println("--------------------------------------------------------\n");

  RS485Bus.begin(9600, SERIAL_8N1, 16, 15);
  SensorUART.begin(9600, SERIAL_8N1, 8, 9);
}

unsigned long lastTriggerMs = 0;
int cycleNum = 0;

void loop() {
  // Cek data masuk dari sensor UART (Terminal SDA / GPIO 8)
  if (SensorUART.available()) {
    uint8_t b = SensorUART.read();
    if (b == 0xFF) {
      uint8_t frame[4];
      frame[0] = 0xFF;
      unsigned long tWait = millis();
      int count = 1;
      while (count < 4 && millis() - tWait < 60) {
        if (SensorUART.available()) frame[count++] = SensorUART.read();
      }

      if (count == 4) {
        uint8_t sum = (uint8_t)(0xFF + frame[1] + frame[2]);
        if (frame[3] == sum) {
          uint16_t distMm = ((uint16_t)frame[1] << 8) | frame[2];
          Serial.printf("✅ [SENSOR A16 UART] JARAK TERBACA: %u mm (%.1f cm)\n", distMm, distMm / 10.0f);
        } else {
          Serial.printf("[SENSOR UART] Frame Checksum Beda: %02X %02X %02X %02X\n", frame[0], frame[1], frame[2], frame[3]);
        }
      }
    } else {
      Serial.printf("[SENSOR RAW BYTE]: 0x%02X\n", b);
    }
  }

  // Cek data masuk dari RS485 (Terminal A+ & B-)
  if (RS485Bus.available()) {
    uint8_t b = RS485Bus.read();
    if (b == 0xFF) {
      uint8_t frame[4];
      frame[0] = 0xFF;
      unsigned long tWait = millis();
      int count = 1;
      while (count < 4 && millis() - tWait < 60) {
        if (RS485Bus.available()) frame[count++] = RS485Bus.read();
      }
      if (count == 4 && frame[3] == (uint8_t)(0xFF + frame[1] + frame[2])) {
        uint16_t distMm = ((uint16_t)frame[1] << 8) | frame[2];
        Serial.printf("✅ [RS485 STREAM] JARAK: %u mm (%.1f cm)\n", distMm, distMm / 10.0f);
      }
    }
  }

  // Trigger periodik setiap 2 detik
  if (millis() - lastTriggerMs > 2000) {
    lastTriggerMs = millis();
    cycleNum++;

    Serial.printf("\n[SIKLUS UJI #%d]\n", cycleNum);
    // Kirim trigger byte 0x01 ke kabel kuning (RX Sensor) di Terminal SCL (GPIO 9)
    SensorUART.write((uint8_t)0x01);

    // Kirim juga Modbus query register 0x0100 ke RS485
    const uint8_t queryDist[] = { 0x01, 0x03, 0x01, 0x00, 0x00, 0x01, 0x85, 0xF6 };
    while (RS485Bus.available()) RS485Bus.read();
    RS485Bus.write(queryDist, sizeof(queryDist));
    RS485Bus.flush();
  }

  delay(2);
}
