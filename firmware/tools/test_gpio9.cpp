/**
 * TerraFlow AWLR — Tool Pengujian Sakelar Daya GPIO 9 (P-MOSFET IRF4905 + NPN BC547)
 * PT Tanah Airku Teknologi
 * 
 * Fungsi Pengujian:
 * 1. Mode Interaktif Serial (Ketik '1' untuk ON / '0' untuk OFF).
 * 2. Mode Otomatis Toggle (Blink setiap 3 detik).
 * 3. Indikator LED Onboard (GPIO 2) sinkron dengan status daya.
 */

#include <Arduino.h>

#define PIN_SWITCH_CONTROL  9   // Terminal Pin 9 KhursLabs (Kontrol Base BC547 via Resistor 1k)
#define PIN_STATUS_LED      2   // LED Onboard ESP32-S3

bool autoToggleMode = false;
unsigned long lastToggleTime = 0;
const unsigned long TOGGLE_INTERVAL_MS = 3000; // Toggle tiap 3 detik
bool currentPinState = false;

void printStatus(bool state) {
  currentPinState = state;
  digitalWrite(PIN_SWITCH_CONTROL, state ? HIGH : LOW);
  digitalWrite(PIN_STATUS_LED, state ? HIGH : LOW);

  Serial.println("\n========================================================");
  if (state) {
    Serial.println("[STATUS: SAKELAR AKTIF (HIGH / ON)]");
    Serial.println("  Sinyal GPIO 9            : 3.3V (HIGH)");
    Serial.println("  Status Transistor BC547  : ON (Saturasi)");
    Serial.println("  Tegangan Gate IRF4905    : ~0.1V (Ditarik ke Ground)");
    Serial.println("  Tegangan Drain IRF4905   : +5.0V (OUTPUT DAYA SENSOR NYALA)");
  } else {
    Serial.println("[STATUS: SAKELAR MATI (LOW / OFF)]");
    Serial.println("  Sinyal GPIO 9            : 0.0V (LOW)");
    Serial.println("  Status Transistor BC547  : OFF (Cut-off)");
    Serial.println("  Tegangan Gate IRF4905    : +5.0V (Ditarik ke 5V via R 10k)");
    Serial.println("  Tegangan Drain IRF4905   : 0.0V (DAYA SENSOR TERPUTUS TOTAL)");
  }
  Serial.println("--------------------------------------------------------");
  Serial.println("Titik Ukur Multimeter (Probe Hitam ke GND):");
  Serial.printf("  1. Terminal Pin 9 (GPIO 9) -> %s\n", state ? "~3.3V" : "0.0V");
  Serial.printf("  2. Kaki 2 (Base) BC547     -> %s\n", state ? "~0.7V" : "0.0V");
  Serial.printf("  3. Kaki 1 (Gate) IRF4905   -> %s\n", state ? "~0.1V" : "~5.0V");
  Serial.printf("  4. Kaki 2 (Drain) IRF4905  -> %s  <-- OUTPUT KE SENSOR\n", state ? "~5.0V" : "0.0V");
  Serial.println("========================================================");
}

void printHelp() {
  Serial.println("\n--- PANDUAN PENGUJIAN SAKELAR GPIO 9 ---");
  Serial.println("Ketik perintah di Serial Monitor lalu Enter:");
  Serial.println("  '1' atau 'h' : Set GPIO 9 = HIGH (Nyalakan Daya 5V)");
  Serial.println("  '0' atau 'l' : Set GPIO 9 = LOW  (Matikan Daya 0V)");
  Serial.println("  'a'          : Mode Otomatis Toggle (Blink tiap 3 detik)");
  Serial.println("  '?'          : Tampilkan menu bantuan ini");
  Serial.println("----------------------------------------");
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(PIN_SWITCH_CONTROL, OUTPUT);
  pinMode(PIN_STATUS_LED, OUTPUT);

  // Default saat awal boot: Matikan dulu (LOW / 0V)
  printStatus(false);
  printHelp();
}

void loop() {
  // 1. Baca Perintah Serial Interaktif
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '1' || c == 'h' || c == 'H') {
      autoToggleMode = false;
      Serial.println("\n[CMD] Perintah Manual: Set HIGH (ON)");
      printStatus(true);
    } else if (c == '0' || c == 'l' || c == 'L') {
      autoToggleMode = false;
      Serial.println("\n[CMD] Perintah Manual: Set LOW (OFF)");
      printStatus(false);
    } else if (c == 'a' || c == 'A') {
      autoToggleMode = !autoToggleMode;
      lastToggleTime = millis();
      Serial.printf("\n[CMD] Mode Otomatis Toggle: %s\n", autoToggleMode ? "AKTIF (Tiap 3 dtk)" : "NONAKTIF");
    } else if (c == '?' || c == 'm' || c == 'M') {
      printHelp();
    }
  }

  // 2. Logika Mode Otomatis
  if (autoToggleMode) {
    unsigned long now = millis();
    if (now - lastToggleTime >= TOGGLE_INTERVAL_MS) {
      lastToggleTime = now;
      printStatus(!currentPinState);
    }
  }

  delay(20);
}

