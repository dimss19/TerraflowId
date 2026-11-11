# Panduan Lengkap Wiring Pemutus Daya Sensor DYP-A16 (Skema Pin 9)
**Sistem:** TerraFlow Portable AWLR  
**Board:** KhursLabs ESP32-S3 IoT Logger RS485  
**Sensor:** DYP-A1611AU Ultrasonic Level Sensor  
**Status RTC:** Dinonaktifkan (Sinkronisasi Waktu via Internet / NTP & POSIX ESP32)  
**Status RS485 (A+/B-):** Bersih & Dicadangkan untuk Sensor Baterai PZEM-017 (Modbus RTU)  
**Pembaruan Terakhir:** 3 November 2026  

---

## 1. Arsitektur Final Alokasi Pin Terminal KhursLabs (100% Pas & Bersih)

Dengan menonaktifkan RTC onboard, setiap lubang pada blok terminal baut bawah KhursLabs memiliki fungsi 1:1 yang sempurna:

```text
       ┌────────────────────────────────────────────────────────┐
       │     TERMINAL BAUT 6-PIN KHURSLABS ESP32-S3 (BAWAH)     │
       │                                                        │
       │   [ 8 ]    [ 9 ]   [ 5V ]   [ GND ]   [ A+ ]   [ B- ]  │
       └───┬────────┬────────┬────────┬─────────┬────────┬──────┘
           │        │        │        │         │        │
           │        │        │        │         └────────┴──► RESERVED: PZEM-017
           │        │        │        │                       (RS485 Modbus Baterai)
           │        │        │        │
           │        │        │        └─────────────────────► COMMON GROUND (GND)
           │        │        │
           │        │        └──────────────────────────────► POWER VCC (+5V INPUT SAKELAR)
           │        │
           │        └───────────────────────────────────────► KONTROL SAKELAR A16 (PIN_SENSOR_PWR)
           │                                                  (Ke Resistor 1 kΩ Base BC547)
           │
           └────────────────────────────────────────────────► DATA SENSOR A16 (UART RX2)
                                                              (Kabel Putih Sensor A16)
```

| Pin Terminal | Sinyal ESP32-S3 | Terhubung Ke | Fungsi / Keterangan |
| :---: | :---: | :--- | :--- |
| **`8`** | **GPIO 8** | **Kabel Putih Sensor A16** | Jalur Serial2 UART RX (Murni, tanpa time-multiplexing I2C) |
| **`9`** | **GPIO 9** | **Resistor 1 kΩ (Base BC547)** | **Pin Pengendali Daya Sensor (`PIN_SENSOR_PWR = 9`)** |
| **`5V`** | **Rel +5V** | **Kaki 3 (Source) P-MOSFET** | Sumber daya 5V untuk sensor ultrasonik |
| **`GND`** | **Ground** | **Common GND** | Ground bersama untuk semua modul |
| **`A+`** | **RS485 A+** | *(Dicadangkan untuk PZEM-017)* | RS485 Diferensial Non-Inverting (+) |
| **`B-`** | **RS485 B-** | *(Dicadangkan untuk PZEM-017)* | RS485 Diferensial Inverting (-) |

kaki ---

## 2. Diagram Skematik Rangkaian Elektronika Lengkap

```text
                   Terminal [ 5V ] KhursLabs
                        │
                        ├─────────────────────────────┐
                        │                             │
                        │                      [R2: 10 kΩ]
                        │                     (Pull-up Gate)
                        │                             │
                        ├────────── Source (Pin 3)    │
                        │           IRF9540N / 4905   │
                        │             (P-MOSFET)      │
                        │           Gate (Pin 1) ─────┴──────── Collector (Pin 1)
                        │                                          BC547 (NPN)
                        │           Drain (Pin 2)             Base (Pin 2) ──[R1: 1 kΩ]─── Terminal Pin [ 9 ]
                        │                │                         │                       (GPIO 9)
                        │                │                    [R3: 100 kΩ]
                        │                │                  (Pull-down Base)
                        │                │                         │
                        │                ├─────────┐               │
                        │                │         │               │
                        │               [D1]      [C1]             │
                        │              1N5819     104              │
                        │             (Katoda)  (0.1µF)            │
                        │                │         │               │
                        ▼                ▼         ▼               ▼
          =========================== (Anoda)      │          Emitter (Pin 3)
          KONEKSI 4 KABEL SENSOR A16     │         │               │
          ===========================    └─────────┴───────────────┴──────── Terminal [ GND ]
          1. MERAH  (VCC +5V)  <── Dari Drain MOSFET (Pin 2)
          2. HITAM  (GND)      <── Ke Terminal [ GND ]
          3. KUNING (RX Auto)  <── Diberi [R4: 10 kΩ] disambung ke Kabel MERAH (Drain)
          4. PUTIH  (TX Data)  <── Tetap langsung ke Terminal Pin [ 8 ]
```

---

## 3. Identifikasi Fisik Kaki Komponen

```text
       BC547 (TO-92)                 IRF9540N / IRF4905 (TO-220)          1N5819 (Dioda)
   ┌──────────────────┐               ┌───────────────────────┐         ┌───────────┬──┐
   │      BC547       │               │        TAB LOGAM      │         │   HITAM   │AB│
   │  (Sisi Tulisan)  │               │   (Belakang = Drain)  │         │   POLOS   │U │
   └───────┬──┬──┬────┘               ├───────────────────────┤         └───┬───────┴──┴──
           │  │  │                    │     Sisi Tulisan      │             │         │
           │  │  │                    └───────┬───┬───┬───────┘          (Anoda)   (Katoda)
           1  2  3                            │   │   │                     (+)       (-)
           C  B  E                            1   2   3
                                              G   D   S
```

* **BC547 (NPN)**: Tulisan menghadap Anda, kaki ke bawah:
  * **Pin 1 (Kiri)**: **Collector (C)**
  * **Pin 2 (Tengah)**: **Base (B)**
  * **Pin 3 (Kanan)**: **Emitter (E)**
* **IRF9540N / IRF4905 (P-MOSFET)**: Tulisan menghadap Anda (plat logam di belakang), kaki ke bawah:
  * **Pin 1 (Kiri)**: **Gate (G)**
  * **Pin 2 (Tengah)**: **Drain (D)** *(output ke kabel merah sensor)*
  * **Pin 3 (Kanan)**: **Source (S)** *(input 5V)*
* **Dioda Schottky 1N5819**: Sisi bergelang perak (**Katoda**), sisi hitam polos (**Anoda**).
* **Kapasitor 104 (0.1 µF)**: Non-polar (kaki bolak-balik bebas).

---

## 4. Panduan Perakitan Langkah demi Langkah

### Langkah 1: Merakit Bagian Transistor BC547
1. Pasang transistor **BC547**:
   * **Kaki 3 (Emitter - Kanan)** sambungkan ke kabel yang menuju **Terminal GND KhursLabs**.
   * **Kaki 2 (Base - Tengah)**:
     * Pasang **Resistor 1 kΩ (R1)**, ujung satunya masukkan ke **Terminal Pin 9 KhursLabs**.
     * Pasang **Resistor 100 kΩ (R3)** dari Kaki 2 ini langsung ke **Terminal GND**.
   * **Kaki 1 (Collector - Kiri)** sambungkan ke **Kaki 1 (Gate) P-MOSFET**.

### Langkah 2: Merakit P-MOSFET IRF9540N / IRF4905
2. Pasang MOSFET:
   * **Kaki 3 (Source - Kanan)** sambungkan kabel ke **Terminal 5V KhursLabs**.
   * **Antara Kaki 3 (Source) dan Kaki 1 (Gate)**: Pasang **Resistor 10 kΩ (R2)** sebagai pull-up.
   * **Kaki 1 (Gate - Kiri)**: Sudah tersambung ke Collector BC547 di Langkah 1.
   * **Kaki 2 (Drain - Tengah)**: Ini adalah jalur daya keluar (+5V Switched).

### Langkah 3: Memasang Proteksi Dioda & Kapasitor
3. Pasang **Dioda 1N5819 (D1)**:
   * Gelang perak (**Katoda**) $\rightarrow$ sambungkan ke **Kaki 2 (Drain) MOSFET**.
   * Badan hitam polos (**Anoda**) $\rightarrow$ sambungkan ke **Terminal GND**.
4. Pasang **Kapasitor 104 (C1)**:
   * Kaki 1 $\rightarrow$ ke **Kaki 2 (Drain) MOSFET**.
   * Kaki 2 $\rightarrow$ ke **Terminal GND**.

### Langkah 4: Menyambungkan 4 Kabel Sensor DYP-A16
5. Sambungkan kabel sensor ultrasonik:
   * **Kabel MERAH (VCC)**: Sambungkan ke **Kaki 2 (Drain) MOSFET**.
   * **Kabel HITAM (GND)**: Sambungkan ke **Terminal GND KhursLabs**.
   * **Kabel KUNING (RX)**: Sambungkan **Resistor 10 kΩ (R4)** antara Kabel Kuning dan **Kabel Merah (Drain)**.
   * **Kabel PUTIH (TX)**: Sambungkan langsung ke **Terminal Pin 8 KhursLabs**.

---

## 5. Checklist Pengujian Cepat Sebelum Sensor Dipasang

1. **Uji Korsleting (Tanpa Daya):**
   * Ukur dengan multimeter (mode continuity/buzzer) antara **Terminal 5V** dan **Terminal GND**. Pastikan **tidak berbunyi**.
   * Ukur antara **Drain MOSFET** dan **GND**. Pastikan **tidak berbunyi**.
2. **Uji Logika Tegangan (Board Diberi Daya USB):**
   * Saat Pin 9 = LOW (0V): Ukur tegangan antara **Drain MOSFET** dan **GND** $\rightarrow$ **Harus $0.00\text{V}$** (Maksimal $< 0.05\text{V}$).
   * Saat Pin 9 = HIGH (3.3V): Ukur tegangan antara **Drain MOSFET** dan **GND** $\rightarrow$ **Harus $+4.95\text{V} - +5.00\text{V}$**.
3. **Pasang Sensor:** Jika langkah 1 dan 2 lolos, pasang kabel sensor A16 dan verifikasi data di Serial Monitor.
