# Analisis Teknis & Perbandingan Rangkaian Power Switch Sensor DYP-A16 (5V)
**Sistem:** KhursLabs ESP32-S3 IoT Logger — Portable AWLR TerraFlow  
**Referensi Datasheet:** *BEST SENSOR DYP-A16 Series*, *Vishay IRF9540N*, *TI TPS22918/TPS22919*, *Silergy SY6280AAAC*, *Microchip MIC2005A*, & *Espressif ESP32-S3 Datasheet*.

---

## Ringkasan Spesifikasi Beban (Datasheet DYP-A16)
Sebelum membandingkan sakelar daya, berikut parameter elektrikal nyata sensor **DYP-A16** yang wajib ditangani:
* **Tegangan Kerja ($V_{CC}$)**: $3.2\text{V} - 24\text{V DC}$ (Tipikal **$5.0\text{V DC}$**).
* **Arus Rata-Rata ($I_{\text{avg}}$)**: $\le 15\text{ mA}$.
* **Arus Puncak Transmisi Ultrasonik ($I_{\text{peak}}$)**: **$50\text{ mA}\text{ (min)} - 70\text{ mA}\text{ (max)}$**.
* **Batas Ripple & Noise Input**: Ripple $\le 50\text{ mV}_{\text{p-p}}$, Noise $\le 100\text{ mV}_{\text{p-p}}$. *(Artinya: sakelar daya harus memiliki resistansi $R_{DS(\text{on})} < 0.5\ \Omega$ agar saat pulsa $70\text{ mA}$ ditembakkan, jatuh tegangan $\Delta V < 35\text{ mV}$).*

---

## 1. Opsi Mana yang Paling Direkomendasikan untuk Prototipe vs. Produksi?

| Tahap | Rekomendasi Terbaik | Alasan Teknis |
| :--- | :--- | :--- |
| **Prototipe Cepat (PCB Bolong / Kabel Jumper)** | **Opsi 1 yang Dioptimalkan** (P-MOSFET *Logic-Level* **AO3401A / FQP27P06** + NPN **2N2222 / BC547**) atau **IC Load Switch di atas papan adapter SOT-23 ke DIP** | Komponen *through-hole* mudah disolder tangan tanpa cetak PCB, mudah diukur per-titik dengan multimeter, dan tersedia di toko elektronik lokal. |
| **Produksi & Unit Lapangan Jangka Panjang** | **Opsi 2 (IC Load Switch 5V Terintegrasi)** | Menggantikan 4 komponen diskret (10 titik solder) menjadi 1 chip. Memiliki *Controlled Slew-Rate* (mencegah *brownout* rel 5V saat kapasitor sensor terisi), *Quick Output Discharge (QOD)* (membuang sisa muatan di VCC sensor ke 0V saat OFF), *Reverse Current Blocking*, dan arus bocor tidur yang dijamin pabrik $< 0.5\ \mu\text{A}$. |

---

## 2. Apakah IC Load Switch Benar-Benar Lebih Sederhana dan Hemat Daya dibanding MOSFET + NPN?

**Ya, secara terukur jauh lebih hemat daya (terutama saat ON) dan lebih sederhana.**

Mari hitung konsumsi arus nyata kedua rangkaian pada $V_{CC} = 5.0\text{V}$ dan $V_{\text{GPIO}} = 3.3\text{V}$:

### A. Saat Kondisi Aktif (Sensor Menyala / Pengukuran):
1. **Rangkaian P-MOSFET + NPN + Resistor $10\text{ k}\Omega$ & $1\text{ k}\Omega$**:
   * Arus dari GPIO 3.3V ke Basis NPN melalui $R_B = 1\text{ k}\Omega$:
     $$I_B = \frac{3.3\text{V} - V_{BE(\text{on})}}{1\text{ k}\Omega} = \frac{3.3\text{V} - 0.7\text{V}}{1000\ \Omega} = \mathbf{2.60\text{ mA}}$$
   * Arus dari +5V melalui resistor pull-up Gate $R_{PU} = 10\text{ k}\Omega$ ke Kolektor NPN ke GND:
     $$I_{PU} = \frac{5.0\text{V} - V_{CE(\text{sat})}}{10\text{ k}\Omega} = \frac{5.0\text{V} - 0.1\text{V}}{10000\ \Omega} = \mathbf{0.49\text{ mA}}$$
   * **Total Arus Parasit Sakelar Saat ON**: **$3.09\text{ mA}$** *(membuang ~20% ekstra dari arus kerja sensor A16 sendiri yang $\le 15\text{ mA}$)*.
2. **IC Load Switch (Contoh: TI TPS22919 / Silergy SY6280A)**:
   * Arus pin Enable ($I_{EN}$): **$< 0.1\ \mu\text{A}$** (input CMOS impedansi tinggi).
   * *Quiescent Current* IC saat ON ($I_Q$): **$8.5\ \mu\text{A} - 15\ \mu\text{A}$** ($0.0085\text{ mA}$).
   * **Penghematan saat ON**: IC Load Switch **$300\times$ lebih hemat arus kontrol** dibanding MOSFET + NPN.

### B. Saat Kondisi Tidur (Deep Sleep / Sensor OFF):
1. **Rangkaian P-MOSFET (IRF9540N) + NPN**:
   * Menurut datasheet Vishay IRF9540N, *Zero Gate Voltage Drain Current* ($I_{DSS}$) maksimum adalah **$25\ \mu\text{A}$ pada $25^\circ\text{C}$** dan naik drastis hingga **$250\ \mu\text{A}$ pada suhu tinggi** (akibat luas *die* silikon MOSFET daya besar). Ditambah kebocoran kolektor NPN $I_{CEX} \approx 0.05\ \mu\text{A}$.
2. **IC Load Switch (TPS22919 / SY6280A)**:
   * *Shutdown Supply Current* ($I_{SD}$): **$0.05\ \mu\text{A}$ tipikal (maksimum $0.5\ \mu\text{A} - 1.0\ \mu\text{A}$)**.

---

## 3. Apakah GPIO 3.3V Bisa Mengontrol Enable IC Load Switch Secara Langsung?

**Bisa 100% secara langsung tanpa transistor perantara**, selama Anda memilih IC Load Switch dengan spesifikasi input logika rendah (*Low-Voltage Logic Threshold*).

* Pada ESP32-S3 (datasheet Espressif), tegangan output logika HIGH ($V_{OH}$) minimal adalah $0.8 \times V_{DD} = \mathbf{2.64\text{V}}$ (tipikal **$3.3\text{V}$**).
* Pada datasheet **TI TPS22919** (@ $V_{IN} = 5.0\text{V}$): Ambang batas nyala pin ON ($V_{IH}$) adalah **$1.0\text{V}$ (min)** dan batas mati ($V_{IL}$) adalah **$0.4\text{V}$ (max)**.
* Pada datasheet **Silergy SY6280A** (@ $V_{IN} = 5.0\text{V}$): $V_{IH} = \mathbf{1.2\text{V}}$ (min) dan $V_{IL} = \mathbf{0.4\text{V}}$ (max).
* Karena $3.3\text{V} \gg 1.2\text{V}$, GPIO ESP32-S3 mampu menggerakkan pin `EN` IC Load Switch secara langsung dan tegas.

---

## 4. Apakah IRF9540N Cocok untuk Switching 5V Jika Dikendalikan Transistor NPN?

**Kesimpulan Teknis: BISA bekerja pada suhu ruang untuk beban ringan 70 mA, TETAPI TIDAK IDEAL dan berisiko pada produksi.**

Berdasarkan **Datasheet Vishay Siliconix IRF9540N**:
1. **Bukan Logic-Level MOSFET**: Spesifikasi $R_{DS(\text{on})} = 0.117\ \Omega$ hanya dijamin pada tegangan Gate **$V_{GS} = -10\text{V}$**. Datasheet sama sekali tidak memberikan jaminan nilai $R_{DS(\text{on})}$ pada $V_{GS} = -4.5\text{V}$ atau $-5.0\text{V}$.
2. **Toleransi $V_{GS(\text{th})}$ yang Lebar**: Ambang tegangan Gate ($V_{GS(\text{th})}$) adalah **$-2.0\text{V}$ hingga $-4.0\text{V}$** (diukur pada arus baru mengalir $250\ \mu\text{A}$).
   * Saat NPN saturasi ($V_{CE(\text{sat})} \approx 0.1\text{V}$), tegangan Gate-Source yang didapat adalah $V_{GS} = 0.1\text{V} - 5.0\text{V} = \mathbf{-4.9\text{V}}$.
   * Berdasarkan kurva *Typical Transfer Characteristics* (Fig. 3 datasheet IRF9540N), pada $V_{GS} = -4.9\text{V}$, MOSFET memang sudah bisa melewatkan arus puncak A16 ($70\text{ mA}$).
   * **Risiko Nyata**: Jika Anda mendapat batch komponen IRF9540N dengan $V_{GS(\text{th})}$ mendekati batas atas ($-4.0\text{V}$) dan alat dipasang di sungai pegunungan yang dingin (nilai $|V_{GS(\text{th})}|$ membesar saat suhu turun), maka *gate overdrive* ($|V_{GS}| - |V_{GS(\text{th})}|$) tinggal $< 0.8\text{V}$. MOSFET akan bekerja di daerah semi-linear dengan resistansi tinggi saat menerima pulsa *inrush* $70\text{ mA}$, memicu drop tegangan $> 100\text{ mV}$ yang melanggar spesifikasi ripple/noise DYP-A16 ($\le 50 - 100\text{ mV}$).
3. **Jika Tetap Memakai Opsi 1 (Diskret)**: Ganti IRF9540N dengan **AO3401A** (SOT-23, $V_{GS(\text{th})} = -0.9\text{V}$, $R_{DS(\text{on})} = 60\text{ m}\Omega \text{ @ } V_{GS} = -4.5\text{V}$, $I_{DSS} < 1\ \mu\text{A}$) atau untuk kemasan TO-220 gunakan **NDP6020P** / **FQP27P06**.

---

## 5. Bagaimana Mencegah Arus Masuk (*Back-Powering*) melalui Pin UART TX/RX Saat Sensor Dimatikan?

### Mengapa Back-Powering Terjadi?
Ketika jalur **+5V VCC sensor diputus ($0\text{V}$)** sementara **GND tetap terhubung**, rel internal $V_{DD}$ di dalam MCU sensor DYP-A16 turun ke $0\text{V}$. Setiap pin I/O pada MCU sensor memiliki **diode proteksi ESD internal** dari pin menuju rel $V_{DD}$ sensor:
$$\text{Pin GPIO ESP32 (3.3V)} \longrightarrow \text{Pin RX/TX Sensor} \xrightarrow{\text{Diode ESD }(V_F \approx 0.4\text{V})} V_{DD\text{ Sensor}}$$
Standar protokol UART menahan jalur TX pada logika **HIGH ($3.3\text{V}$)** saat *idle*. Jika GPIO 9 (TX) atau pull-up pada GPIO 8 (RX) tetap bertegangan $3.3\text{V}$ saat VCC sensor diputus, arus sebesar **$2\text{ mA} - 12\text{ mA}$** akan bocor dari ESP32-S3 masuk ke sensor melalui diode ESD tersebut!

### Temuan Kritis pada Board KhursLabs ESP32-S3 IoT Logger (GPIO 8 & GPIO 9):
Di board KhursLabs Anda, **GPIO 8 dan GPIO 9 dipakai bersama dengan jalur I2C RTC Onboard (SDA = GPIO 8, SCL = GPIO 9)**.
* Bus I2C onboard memiliki **resistor pull-up fisik di PCB ke rel +3.3V** (umumnya $4.7\text{ k}\Omega$ atau $10\text{ k}\Omega$).
* Artinya: **Meskipun di software Anda sudah mengubah GPIO 8 & GPIO 9 menjadi `INPUT` (High-Z)** saat deep sleep, resistor pull-up I2C onboard tetap akan menarik jalur GPIO 8 & GPIO 9 ke $+3.3\text{V}$!
* Ketika tersambung ke pin TX/RX sensor DYP-A16 yang sedang mati ($0\text{V}$), resistor pull-up onboard tersebut akan terus-menerus mengalirkan arus bocor:
  $$I_{\text{leak}} = \frac{3.3\text{V} - 0.5\text{V}}{4.7\text{ k}\Omega} \approx \mathbf{595\ \mu\text{A}\text{ per jalur}} \quad (\approx \mathbf{1.2\text{ mA}\text{ untuk 2 jalur!}})$$
  Ini **langsung menggagalkan target deep sleep $< 150\ \mu\text{A}$** dan mengganggu tegangan bus I2C RTC!

### Solusi Tuntas Anti Back-Powering:
1. **Di Sisi Software (Wajib)**: Sebelum memutus VCC sensor, panggil `RS485Serial.end()`, matikan pull-up internal (`gpio_pullup_dis`), dan set pin UART ke High-Z (`INPUT`).
2. **Di Sisi Hardware untuk Jalur GPIO 8 & GPIO 9**:
   * **Jika menggunakan DYP-A16 mode UART Auto**: Kabel Kuning (RX Sensor) **tidak perlu disambung ke GPIO 9**. Sambungkan Kabel Kuning melalui resistor $10\text{ k}\Omega$ langsung ke **`VCC_SW` (output 5V setelah Load Switch)**. Saat sensor dimatikan, `VCC_SW` menjadi $0\text{V}$ sehingga tidak ada back-powering sama sekali di pin RX sensor!
   * **Untuk Jalur TX Sensor (Kabel Putih) $\rightarrow$ GPIO 8 (RX ESP32)**: Pasang **1 buah Diode Schottky sinyal kecil (1N5819 / BAT54)** secara seri dengan **Katoda (garis gelang) menghadap ke Pin TX Sensor** dan **Anoda menghadap ke GPIO 8 ESP32**.
     * *Cara kerja*: Saat GPIO 8 ditarik ke $3.3\text{V}$ oleh pull-up onboard KhursLabs sementara sensor mati ($0\text{V}$), diode Schottky memblokir total arus dari ESP32 ke sensor ($I_{\text{leak}} < 0.2\ \mu\text{A}$)!. Saat sensor menyala dan mengirim bit `0` ($0\text{V}$), sensor menarik GPIO 8 ke rendah ($\approx 0.25\text{V}$), dan saat mengirim bit `1` ($3.3\text{V}$), pull-up di sisi ESP32 menarik GPIO 8 ke $3.3\text{V}$.
   * **Jika menggunakan DYP-A16 mode UART Controlled (GPIO 9 aktif sebagai TX trigger)**: Gunakan diode Schottky serupa atau pindahkan UART sensor ke pin GPIO bebas yang tidak berbagi dengan I2C RTC.

---

## 6. Apakah Diperlukan Resistor Pull-Up, Pull-Down, atau Resistor Seri pada Jalur UART?

| Komponen pada Jalur UART | Status | Nilai & Posisi | Fungsi Teknis |
| :--- | :---: | :--- | :--- |
| **Resistor Seri ($R_{\text{series}}$)** | **WAJIB** | **$1\text{ k}\Omega$** dipasang seri pada jalur RX (GPIO 8) dan TX (GPIO 9) | Membatasi arus transien (*fault current limiting* $< 3\text{ mA}$) jika terjadi selisih waktu milidetik saat switching power, serta meredam *ringing*/ESD dari kabel sensor. |
| **Diode Blocking (Khusus Pin Share I2C GPIO 8/9)** | **SANGAT DISARANKAN** | **BAT54 / 1N5819** (Katoda ke Sensor, Anoda ke sisi ESP32) | Memblokir arus bocor dari resistor pull-up I2C RTC onboard ($3.3\text{V}$) agar tidak mengalir masuk ke sensor saat VCC sensor diputus. |
| **Resistor Pull-Up Eksternal** | **JANGAN ke 3.3V Permanen!** | **$10\text{ k}\Omega$ ditarik ke `VCC_SW`** (Hanya jika tidak ada pull-up onboard) | Jika pull-up ditarik ke `VCC_SW` (5V/3.3V *setelah* sakelar), maka saat sensor OFF, tegangan pull-up otomatis ikut menjadi $0\text{V}$ (bebas bocor). |
| **Resistor Pull-Down pada Pin EN Sakelar** | **WAJIB** | **$100\text{ k}\Omega$** dari Pin `EN` (atau Basis NPN) ke `GND` | Memastikan sakelar tetap terkunci **OFF** saat ESP32-S3 sedang reset, booting, atau pin mengambang (*floating*). |

---

## 7. Apakah Konsumsi Deep Sleep di Bawah 150 µA Realistis Setelah Semua Komponen dan Board Diperhitungkan?

**Jawabannya secara jujur berdasarkan datasheet: TIDAK REALISTIS jika langsung mengukur dari input 5V board KhursLabs standar tanpa melihat regulator onboard, TETAPI SANGAT REALISTIS ($\approx 35 - 110\ \mu\text{A}$) untuk rangkaian sakelar + ESP32-S3 jika jalur daya diatur dengan benar.**

Berikut rincian *Current Budget* nyata dari datasheet setiap komponen pada board logger:

| Komponen di Board | Arus Tidur (Datasheet) | Catatan Realita Hardware |
| :--- | :---: | :--- |
| **1. Modul ESP32-S3-WROOM-1** | **$7\ \mu\text{A} - 8\ \mu\text{A}$** | RTC Timer + RTC Slow Memory aktif. |
| **2. IC Load Switch (TPS22919 / SY6280A) + DYP-A16 (OFF)** | **$0.1\ \mu\text{A} - 0.5\ \mu\text{A}$** | Sensor DYP-A16 terputus total ($0\ \mu\text{A}$). |
| **3. RTC Onboard (DS3231 / DS1307)** | **$3\ \mu\text{A}$** (via $V_{\text{BAT}}$) / **$110\ \mu\text{A}$** (via $V_{CC}$) | Jika pin $V_{CC}$ DS3231 disuplai terus dari rel 3.3V, DS3231 menarik $\sim 110\ \mu\text{A}$ saat standby I2C idle. |
| **4. Kartu MicroSD (Standby Idle)** | **$150\ \mu\text{A} - 300\ \mu\text{A}$** | Kartu MicroSD yang tetap diberi 3.3V (meski CS HIGH) menyedot $150 - 300\ \mu\text{A}$ dalam mode standby SPI! |
| **5. LDO Regulator 3.3V & LED Power Board** | **$50\ \mu\text{A}$ s/d $5.000\ \mu\text{A}$** | Jika board memakai LDO tipe **AMS1117-3.3**, *quiescent current*-nya sendiri **$5\text{ mA}$ ($5000\ \mu\text{A}$)** dan LED Power memakan **$2\text{ mA}$**. Jika memakai LDO CMOS Low-$I_Q$ (seperti ME6211 / AP2112 / HT7833), $I_Q$ hanya **$40 - 55\ \mu\text{A}$**. |

**Kesimpulan Target $< 150\ \mu\text{A}$**:
* Kontribusi dari **Rangkaian Sakelar + Sensor A16 yang dimatikan** hanya **$< 1\ \mu\text{A}$** (100% memenuhi syarat).
* Namun untuk membuat **total seluruh board** di bawah $150\ \mu\text{A}$, Anda harus memastikan:
  1. LED indikator *Power ON* pada board dilepas/diputus jalurnya.
  2. Tidak ada arus bocor dari pull-up I2C GPIO 8/9 ke sensor yang mati.
  3. (Opsional untuk ultra-low power) Ikut memutus VCC MicroSD atau memastikan kartu masuk *SPI Idle State* sebelum tidur.

---

## 8. Skema Wiring Lengkap dengan Nama Pin dan Nilai Komponen

### A. Skema Opsi 2 (TERBAIK): IC Load Switch (`Silergy SY6280AAAC` / `TI TPS22919`)
*Menggunakan GPIO 4 sebagai pin kontrol `PIN_SENSOR_PWR`, GPIO 8 sebagai RX, dan GPIO 9 sebagai TX.*

```text
+5V Utama (Terminal 5V Board KhursLabs)
  │
  ├──────┬─────────────────────────┐
  │      │                         │
  │   [C_IN] 1 µF Ceramic       Pin 5 (IN)
  │      │                    ┌────┴────────────┐
  │     GND                   │  IC LOAD SWITCH │
  │                           │   SY6280AAAC    │
  │                           │  (SOT-23-5)     │
  │                           │                 │
  │  GPIO 4 (ESP32-S3) ───────┤ Pin 4 (EN)      │
  │                     │     │                 │
  │                  [R_PD]   │      Pin 1 (OUT)├──────┬──────────────────────► Pin 1 (VCC / Kabel Merah)
  │                  100 kΩ   │                 │      │                        Sensor DYP-A16
  │                     │     │     Pin 3 (ISET)│   [C_OUT] 0.1 µF
  │                    GND    └───┬─────────┬───┘      │
  │                            Pin 2 (GND)  │         GND
  │                               │      [R_SET]
  │                               │       33 kΩ (Set batas arus ~206 mA)
  │                               │         │
  └───────────────────────────────┴─────────┴─────────────────────────────────► Pin 2 (GND / Kabel Hitam)
                                                                                Sensor DYP-A16 (Permanen)

JALUR KOMUNIKASI UART (ANTI BACK-POWERING):
---------------------------------------------------------------------------------------------------------
GPIO 8 (ESP32 RX2) ───[ R1: 1 kΩ ]───►|─── (Katoda: 1N5819 / BAT54) ──────────► Pin 4 (TX / Kabel Putih)
                                                                                Sensor DYP-A16

GPIO 9 (ESP32 TX2) ───[ R2: 1 kΩ ]────────────────────────────────────────────► Pin 3 (RX / Kabel Kuning)
*(Catatan: Jika memakai A16 mode UART Auto / Listen-Only, JANGAN sambung        Sensor DYP-A16
  Kabel Kuning ke GPIO 9; cukup hubungkan Kabel Kuning via R 10kΩ ke Pin 1 OUT Load Switch!)*
```

---

### B. Skema Opsi 1 (Alternatif Diskret): P-MOSFET + Transistor NPN
*Jika merakit di PCB bolong menggunakan komponen diskret:*

```text
+5V Utama (Terminal 5V Board KhursLabs)
  │
  ├──────────────┬──────────────────────┐
  │              │                      │
  │         [R_PU: 10 kΩ]            Source (S)
  │              │                 ┌────┴─────┐
  │              │                 │ P-MOSFET │  Rekomendasi: AO3401A (SMD)
  │              ├─────────────────┤ Gate (G) │  atau FQP27P06 / NDP6020P (TO-220)
  │              │                 │          │  (Darurat: IRF9540N)
  │              │                 └────┬─────┘
  │         Collector (C)            Drain (D)
  │          ┌───┴───┐                  │
  │          │  NPN  │ 2N2222 /         ├─────────────► Pin 1 (VCC / Kabel Merah) Sensor DYP-A16
  │          │BC547  │ 2N3904           │
  │          └─┬───┬─┘               [C_OUT] 0.1 µF
  │   Base (B) │   │ Emitter (E)        │
  │            │   └────────────────────┴─────────────► Pin 2 (GND / Kabel Hitam) Sensor DYP-A16
  │            │                                        (Tersambung Permanen ke GND Board)
  │       [R_B: 1 kΩ]
  │            │
  │            ├───────[ R_PD: 100 kΩ ]───► GND
  │            │
  └────── GPIO 4 (ESP32-S3 PIN_SENSOR_PWR)
```

---

## 9. Kode Implementasi `powerOn()` dan `powerOff()` yang Aman untuk ESP32-S3 Deep Sleep

Urutan waktu (*timing sequence*) sangat krusial:
* **Saat menyalakan (`powerOn`)**: Nyalakan VCC 5V terlebih dahulu $\rightarrow$ tunggu kapasitor dan MCU sensor booting ($\ge 250\text{ ms}$) $\rightarrow$ **baru** aktifkan pin UART.
* **Saat mematikan (`powerOff`)**: Matikan periferal UART terlebih dahulu $\rightarrow$ cabut pull-up dan netralkan pin GPIO 8 & 9 $\rightarrow$ **baru** putus VCC 5V sensor $\rightarrow$ kunci pin kontrol daya dengan `gpio_hold_en` selama deep sleep.

```cpp
#include <Arduino.h>
#include <driver/gpio.h>
#include <esp_sleep.h>

// Definisi Pin (Sesuaikan di config.h)
#define PIN_SENSOR_PWR   4   // GPIO pengontrol EN Load Switch / Basis NPN (Active HIGH)
#define PIN_UART_RX      8   // GPIO 8 (ESP32 RX2 <- Sensor TX)
#define PIN_UART_TX      9   // GPIO 9 (ESP32 TX2 -> Sensor RX), set -1 jika mode UART Auto

/**
 * @brief Menyalakan daya 5V sensor DYP-A16 dan menginisialisasi UART dengan aman.
 *        Mencegah injeksi arus ke pin RX/TX sebelum VCC sensor stabil.
 */
void SensorA16::powerOn() {
  // 1. Pastikan RTC bus I2C dilepas dulu jika berbagi pin GPIO 8 & 9
  rtcMgr.releaseBus();

  // 2. Selama VCC sensor belum menyala, tahan pin UART di High-Z tanpa pull-up
  RS485Serial.end();
  gpio_pullup_dis((gpio_num_t)PIN_UART_RX);
  gpio_pulldown_dis((gpio_num_t)PIN_UART_RX);
  pinMode(PIN_UART_RX, INPUT);

  if (PIN_UART_TX >= 0) {
    gpio_pullup_dis((gpio_num_t)PIN_UART_TX);
    gpio_pulldown_dis((gpio_num_t)PIN_UART_TX);
    pinMode(PIN_UART_TX, INPUT);
  }

  // 3. Lepaskan kuncian deep-sleep hold pada pin power switch & nyalakan VCC 5V sensor
  if (PIN_SENSOR_PWR >= 0) {
    gpio_hold_dis((gpio_num_t)PIN_SENSOR_PWR);
    pinMode(PIN_SENSOR_PWR, OUTPUT);
    digitalWrite(PIN_SENSOR_PWR, HIGH); // EN = HIGH -> 5V mengalir ke DYP-A16
  }

  // 4. Tunggu waktu inisialisasi internal MCU sensor DYP-A16 (datasheet: siklus 500ms)
  delay(300);

  // 5. Setelah VCC sensor stabil di 5.0V, baru aktifkan periferal UART ESP32-S3
  RS485Serial.begin(9600, SERIAL_8N1, PIN_UART_RX, PIN_UART_TX);
  delay(50);
  flushRx(); // Bersihkan byte sampah saat transisi power-on
}

/**
 * @brief Mematikan UART dan memutus daya 5V sensor DYP-A16 secara total.
 *        Wajib dipanggil tepat sebelum esp_deep_sleep_start().
 */
void SensorA16::powerOff() {
  // 1. WAJIB PERTAMA: Hentikan periferal UART agar pin TX tidak lagi menahan 3.3V!
  RS485Serial.flush();
  RS485Serial.end();

  // 2. Putus semua internal pull-up pada GPIO 8 (RX) dan GPIO 9 (TX)
  //    agar tidak terjadi back-powering melalui diode ESD sensor saat VCC = 0V
  gpio_reset_pin((gpio_num_t)PIN_UART_RX);
  gpio_pullup_dis((gpio_num_t)PIN_UART_RX);
  gpio_pulldown_dis((gpio_num_t)PIN_UART_RX);
  pinMode(PIN_UART_RX, INPUT); // High-Impedance murni

  if (PIN_UART_TX >= 0) {
    gpio_reset_pin((gpio_num_t)PIN_UART_TX);
    gpio_pullup_dis((gpio_num_t)PIN_UART_TX);
    gpio_pulldown_dis((gpio_num_t)PIN_UART_TX);
    pinMode(PIN_UART_TX, INPUT); // High-Impedance murni
  }

  // Beri jeda 5 ms agar tegangan bus UART benar-benar turun
  delay(5);

  // 3. Matikan sakelar daya 5V (Load Switch EN = LOW / NPN Cut-off)
  if (PIN_SENSOR_PWR >= 0) {
    pinMode(PIN_SENSOR_PWR, OUTPUT);
    digitalWrite(PIN_SENSOR_PWR, LOW);

    // 4. Kunci level LOW pada pin power selama ESP32-S3 berada di Deep Sleep
    gpio_hold_en((gpio_num_t)PIN_SENSOR_PWR);
    gpio_deep_sleep_hold_en();
  }
}
```

---

## 10. Rekomendasi IC Load Switch yang Sesuai (5V Supply, Beban A16, Enable 3.3V)

Berikut **3 IC Load Switch terbaik** berdasarkan datasheet resmi yang 100% memenuhi spesifikasi Anda:

| Parameter Datasheet | **1. TI TPS22919DCKR** *(Paling Direkomendasikan)* | **2. Silergy SY6280AAAC** *(Paling Mudah Dibeli di Lokal)* | **3. Microchip MIC2005A-1YM5** *(Alternatif Industrial)* |
| :--- | :--- | :--- | :--- |
| **Rentang Tegangan Input ($V_{IN}$)** | $1.6\text{V} - 5.5\text{V}$ | $2.4\text{V} - 5.5\text{V}$ | $2.5\text{V} - 5.5\text{V}$ |
| **Arus Kontinu Maksimum ($I_{\text{MAX}}$)** | $1.5\text{ A}$ (A16 butuh $0.07\text{ A}$) | Programmable s/d $2.0\text{ A}$ | $0.5\text{ A} - 1.2\text{ A}$ |
| **Resistansi Sakelar ($R_{ON}$ @ 5V)** | **$90\text{ m}\Omega$** ($\Delta V = 6.3\text{ mV}$ @ 70mA) | **$73\text{ m}\Omega$** ($\Delta V = 5.1\text{ mV}$ @ 70mA) | **$70\text{ m}\Omega$** ($\Delta V = 4.9\text{ mV}$ @ 70mA) |
| **Tegangan Enable HIGH ($V_{IH}$)** | **$\ge 1.0\text{V}$** (Active HIGH) | **$\ge 1.2\text{V}$** (Active HIGH) | **$\ge 1.5\text{V}$** (Active HIGH) |
| **Kompatibilitas GPIO 3.3V** | **Langsung (Direct)** | **Langsung (Direct)** | **Langsung (Direct)** |
| **Arus Bocor Saat OFF ($I_{SD}$)** | **$0.05\ \mu\text{A}$ typ** ($0.5\ \mu\text{A}$ max) | **$0.1\ \mu\text{A}$ typ** ($1.0\ \mu\text{A}$ max) | **$0.1\ \mu\text{A}$ typ** ($1.0\ \mu\text{A}$ max) |
| **Arus Kerja Saat ON ($I_Q$)** | **$8.5\ \mu\text{A}$** | **$15\ \mu\text{A}$** | **$11\ \mu\text{A}$** |
| **Fitur Proteksi Internal** | *Quick Output Discharge (QOD)*, *Controlled Slew Rate*, Thermal Shutdown, Internal Pull-Down EN | *Reverse Current Blocking*, *Adjustable Current Limit* ($R_{SET}$), Soft-Start, Thermal Shutdown | *Current Limiting*, *Thermal Shutdown*, *Soft-Start* ($1\text{ ms}$), *Undervoltage Lockout* |
| **Kemasan Fisik** | SC-70-6 (SOT-363) | **SOT-23-5** (Mudah disolder di adapter DIP) | **SOT-23-5** |

---

## KEPUTUSAN FINAL

### 1. Opsi Terbaik yang Dipilih:
* **Gunakan Opsi 2: IC Load Switch `Silergy SY6280AAAC` (SOT-23-5) atau `TI TPS22919` yang dipasang pada papan breakout/adapter SOT-23-5 ke DIP.**
* *(Jika dalam 1–2 hari ke depan Anda harus menguji di breadboard/PCB bolong sebelum IC Load Switch tiba, gunakan **Opsi 1** tetapi **ganti IRF9540N dengan P-MOSFET Logic-Level `AO3401A` atau `FQP27P06`**).*

### 2. Alasan Teknis Keputusan:
1. **Efisiensi Daya Mutlak**: Menghemat **$3.09\text{ mA}$** arus buang saat pengukuran dan menekan arus bocor saat deep sleep hingga **$\le 0.1\ \mu\text{A}$** (dibanding IRF9540N yang bisa bocor hingga $25\ \mu\text{A}$ dan memiliki $V_{GS(\text{th})}$ hingga $-4.0\text{V}$ yang rawan drop tegangan pada suplai 5V).
2. **Keamanan Rel 5V & Sensor**: Fitur *Soft-Start* bawaan IC Load Switch mencegah lonjakan arus (*inrush spike*) saat mengisi kapasitor filter DYP-A16 yang dapat me-reset ESP32-S3, sementara fitur *Quick Output Discharge* memastikan tegangan VCC sensor benar-benar jatuh ke $0.0\text{V}$ saat tidur.
3. **Koneksi Langsung 3.3V**: Ambang $V_{IH} \ge 1.0\text{V}-1.2\text{V}$ memungkinkan kontrol langsung dari GPIO ESP32-S3 tanpa rangkaian penggeser level NPN.

### 3. Daftar Komponen yang Harus Dibeli (BOM):
1. **IC Load Switch Utama**: **2–5 pcs `SY6280AAAC` (SOT-23-5)** *(kata kunci Tokopedia/Shopee: `IC SY6280` atau `SY6280AAAC` — harga ~Rp 2.500/pcs)* atau **`TPS22919DCKR` / `MIC2005A-1YM5`**.
2. **Papan Adapter (Untuk Prototipe)**: **2 pcs `PCB Adapter Converter SOT-23-5 / SOT23-6 to DIP-6`** *(harga ~Rp 1.000/pcs, agar IC SMD bisa dipasang di PCB bolong/header)*.
3. **Diode Proteksi Back-Powering UART**: **2 pcs Diode Schottky `1N5819` atau `BAT54`** *(harga ~Rp 500/pcs)*.
4. **Resistor Pasif (1/4W Metal Film 1%)**:
   * $2\times$ **$1\text{ k}\Omega$** (Resistor seri pelindung GPIO 8 RX & GPIO 9 TX).
   * $1\times$ **$100\text{ k}\Omega$** (Pull-down pin `EN` ke GND).
   * $1\times$ **$33\text{ k}\Omega$** (Khusus untuk pin `ISET` pada SY6280AAAC guna membatasi arus maksimum di $\sim 206\text{ mA}$).
5. **Kapasitor Keramik (MLCC)**:
   * $1\times$ **$1\ \mu\text{F}$ (16V/25V)** untuk bypass input `IN` Load Switch.
   * $1\times$ **$0.1\ \mu\text{F}$ (100nF)** untuk dekoupling output `OUT` Load Switch.

### 4. Risiko yang Masih Perlu Diuji di Lapangan:
1. **Kebocoran Pull-Up Bus I2C Onboard pada GPIO 8 & GPIO 9**: Karena KhursLabs ESP32-S3 menyatukan GPIO 8 & 9 dengan chip RTC onboard, wajib ukur tegangan pada pin VCC sensor saat `powerOff()`. Jika masih terukur tegangan $> 0.1\text{V}$ saat sensor mati, artinya pull-up I2C onboard membocorkan arus ke pin TX/RX sensor — pastikan diode seri `1N5819` terpasang atau pindahkan jalur UART sensor ke pin GPIO bebas (misal GPIO 4/5/6/7).
2. **Quiescent Current LDO & MicroSD Board KhursLabs**: Ukur arus total di jalur baterai saat deep sleep menggunakan multimeter mode $\mu\text{A}$. Jika arus tidur total masih di atas $150\ \mu\text{A}$ (misal $2\text{ mA} - 5\text{ mA}$) padahal arus ke sensor A16 sudah $0.0\ \mu\text{A}$, penyebabnya adalah LED Power onboard dan kartu MicroSD di slot SPI.
3. **Waktu Stabilisasi Pertama (*Cold Start Delay*) DYP-A16**: Uji pada berbagai suhu lapangan (pagi hari dingin vs siang terik) apakah `delay(300)` setelah `powerOn()` sudah cukup bagi filter internal DYP-A16 untuk mengeluarkan frame valid pertama tanpa *false reading*, atau perlu dinaikkan menjadi `500 ms` sesuai catatan *duty cycle* datasheet.

---

## KEPUTUSAN FINAL

### 1. Opsi Terbaik yang Dipilih:
* **Gunakan Opsi 2: IC Load Switch `Silergy SY6280AAAC` (SOT-23-5) atau `TI TPS22919` yang dipasang pada papan breakout/adapter SOT-23-5 ke DIP.**
* *(Jika dalam 1–2 hari ke depan Anda harus menguji di breadboard/PCB bolong sebelum IC Load Switch tiba, gunakan **Opsi 1** tetapi **ganti IRF9540N dengan P-MOSFET Logic-Level `AO3401A` atau `FQP27P06`**).*

### 2. Alasan Teknis Keputusan:
1. **Efisiensi Daya Mutlak**: Menghemat **$3.09\text{ mA}$** arus buang saat pengukuran dan menekan arus bocor saat deep sleep hingga **$\le 0.1\ \mu\text{A}$** (dibanding IRF9540N yang bisa bocor hingga $25\ \mu\text{A}$ dan memiliki $V_{GS(\text{th})}$ hingga $-4.0\text{V}$ yang rawan drop tegangan pada suplai 5V).
2. **Keamanan Rel 5V & Sensor**: Fitur *Soft-Start* bawaan IC Load Switch mencegah lonjakan arus (*inrush spike*) saat mengisi kapasitor filter DYP-A16 yang dapat me-reset ESP32-S3, sementara fitur *Quick Output Discharge* memastikan tegangan VCC sensor benar-benar jatuh ke $0.0\text{V}$ saat tidur.
3. **Koneksi Langsung 3.3V**: Ambang $V_{IH} \ge 1.0\text{V}-1.2\text{V}$ memungkinkan kontrol langsung dari GPIO ESP32-S3 tanpa rangkaian penggeser level NPN.

### 3. Daftar Komponen yang Harus Dibeli (BOM):
1. **IC Load Switch Utama**: **2–5 pcs `SY6280AAAC` (SOT-23-5)** *(kata kunci Tokopedia/Shopee: `IC SY6280` atau `SY6280AAAC` — harga ~Rp 2.500/pcs)* atau **`TPS22919DCKR` / `MIC2005A-1YM5`**.
2. **Papan Adapter (Untuk Prototipe)**: **2 pcs `PCB Adapter Converter SOT-23-5 / SOT23-6 to DIP-6`** *(harga ~Rp 1.000/pcs, agar IC SMD bisa dipasang di PCB bolong/header)*.
3. **Diode Proteksi Back-Powering UART**: **2 pcs Diode Schottky `1N5819` atau `BAT54`** *(harga ~Rp 500/pcs)*.
4. **Resistor Pasif (1/4W Metal Film 1%)**:
   * $2\times$ **$1\text{ k}\Omega$** (Resistor seri pelindung GPIO 8 RX & GPIO 9 TX).
   * $1\times$ **$100\text{ k}\Omega$** (Pull-down pin `EN` ke GND).
   * $1\times$ **$33\text{ k}\Omega$** (Khusus untuk pin `ISET` pada SY6280AAAC guna membatasi arus maksimum di $\sim 206\text{ mA}$).
5. **Kapasitor Keramik (MLCC)**:
   * $1\times$ **$1\ \mu\text{F}$ (16V/25V)** untuk bypass input `IN` Load Switch.
   * $1\times$ **$0.1\ \mu\text{F}$ (100nF)** untuk dekoupling output `OUT` Load Switch.

### 4. Risiko yang Masih Perlu Diuji di Lapangan:
1. **Kebocoran Pull-Up Bus I2C Onboard pada GPIO 8 & GPIO 9**: Karena KhursLabs ESP32-S3 menyatukan GPIO 8 & 9 dengan chip RTC onboard, wajib ukur tegangan pada pin VCC sensor saat `powerOff()`. Jika masih terukur tegangan $> 0.1\text{V}$ saat sensor mati, artinya pull-up I2C onboard membocorkan arus ke pin TX/RX sensor — pastikan diode seri `1N5819` terpasang atau pindahkan jalur UART sensor ke pin GPIO bebas (misal GPIO 4/5/6/7).
2. **Quiescent Current LDO & MicroSD Board KhursLabs**: Ukur arus total di jalur baterai saat deep sleep menggunakan multimeter mode $\mu\text{A}$. Jika arus tidur total masih di atas $150\ \mu\text{A}$ (misal $2\text{ mA} - 5\text{ mA}$) padahal arus ke sensor A16 sudah $0.0\ \mu\text{A}$, penyebabnya adalah LED Power onboard dan kartu MicroSD di slot SPI.
3. **Waktu Stabilisasi Pertama (*Cold Start Delay*) DYP-A16**: Uji pada berbagai suhu lapangan (pagi hari dingin vs siang terik) apakah `delay(300)` setelah `powerOn()` sudah cukup bagi filter internal DYP-A16 untuk mengeluarkan frame valid pertama tanpa *false reading*, atau perlu dinaikkan menjadi `500 ms` sesuai catatan *duty cycle* datasheet.

