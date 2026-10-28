# 🔌 Panduan Pemilihan & Rangkaian MOSFET Switch Sensor AWLR TerraFlow
**PT Tanah Airku Teknologi — Sistem Monitoring Ketinggian Air (AWLR)**

Dokumen ini berisi daftar komponen MOSFET / modul sakelar daya DC yang direkomendasikan dan mudah dibeli di marketplace Indonesia (*Tokopedia / Shopee / toko komponen lokal*), beserta skematik rangkaian dan panduan integrasi ke mikrokontroler **KhursLabs ESP32-S3 IoT Logger**.

---

## ⚠️ Prinsip Wajib: High-Side Switching

Sensor ultrasonik **DYP-A16** ditenagai tegangan **+5V DC** dan berkomunikasi lewat jalur UART TTL (**GPIO 8 RX** & **GPIO 9 TX**).

> [!CAUTION]
> **JANGAN PERNAH MEMUTUS JALUR GROUND (LOW-SIDE SWITCHING)!**  
> Jika Ground diputus sementara jalur +5V tetap terhubung:
> 1. Sensor akan mencari jalur ground alternatif melalui pin data TX/RX.
> 2. Arus listrik 5V akan mengalir masuk (*back-powering / phantom power*) ke pin GPIO ESP32 melalui diode proteksi internal chip.
> 3. Hal ini menyebabkan ESP32 **gagal tidur nyenyak (*deep sleep current leak*)**, pembacaan I2C/UART korup, atau merusak pin GPIO ESP32.
>
> **SOLUSI**: Selalu gunakan **High-Side Switch** (memutus jalur **+5V VCC**, sedangkan **GND tetap tersambung secara permanen**).

---

## 🛒 Daftar Komponen & Modul yang Sesuai (Bisa Dibeli di Marketplace)

### Opsi 1: Modul Siap Pakai (Plug-and-Play, Tanpa Repot Rakit)

Sangat direkomendasikan jika ingin pemasangan cepat menggunakan kabel jumper tanpa menyolder banyak komponen diskret.

| No | Nama Modul / Produk | Kata Kunci Pencarian (Tokopedia/Shopee) | Estimasi Harga | Catatan Teknis |
|:--:|---|---|:--:|---|
| 1 | **Modul MOSFET Optocoupler (Trigger 3.3V/5V)** | `modul mosfet optocoupler 3.3v` / `mosfet switch module isolasi opto` | Rp 8.000 – Rp 15.000 | Tipe FR120N / LR7843 dengan isolasi opto. Pastikan mendukung level trigger logika 3.3V. |
| 2 | **Modul Solid State Relay (SSR) Mini 3.3V / 5V DC** | `modul ssr 1 channel 3.3v` / `solid state relay 5v dc low trigger` | Rp 12.000 – Rp 22.000 | Tidak ada suara klik mekanik, kontak bersih, *zero leakage current* saat off. |
| 3 | **Modul Relay Mini 1-Channel 3.3V (Optocoupler)** | `modul relay 3.3v 1 channel` / `relay optocoupler 3v 3.3v` | Rp 6.000 – Rp 10.000 | Paling mudah ditemukan. Menggunakan kontak mekanik kering (COM ke 5V, NO ke VCC sensor). |

---

### Opsi 2: Komponen Diskret Through-Hole (Kaki Jarum, Mudah Disolder di PCB Bolong)

Pilihan ideal jika Anda merakit sirkuit di *prototype board* / PCB bolong industri. Membutuhkan 1 P-MOSFET, 1 Transistor NPN, dan 2 Resistor.

#### 1. P-Channel MOSFET (Pilih salah satu yang tersedia):
* **IRF9540N** (TO-220, -100V, -23A) — **Paling populer & stok melimpah di toko elektronik lokal**. Harga: ~Rp 6.000 – Rp 9.000.
* **FQP27P06** (TO-220, -60V, -27A) — Karakteristik $R_{DS(on)}$ sangat baik untuk switching 5V. Harga: ~Rp 7.000 – Rp 10.000.
* **IRF4905** (TO-220, -55V, -74A) — Alternatif setara jika seri 9540 kosong. Harga: ~Rp 8.000 – Rp 12.000.

#### 2. Transistor Driver NPN (Level shifter logika 3.3V ke 5V):
* **BC547** atau **2N2222** atau **2N3904** (Kemasan TO-92). Harga: ~Rp 500 – Rp 1.000/pcs.

#### 3. Resistor:
* $1\times$ **Resistor 10 kΩ (1/4 Watt)** — Pull-up dari Gate MOSFET ke +5V.
* $1\times$ **Resistor 1 kΩ (1/4 Watt)** — Pembatas arus dari GPIO ESP32 ke Basis Transistor.

---

### Opsi 3: Komponen Mini SMD (Ukuran Paling Kecil & Efisien)

Gunakan opsi ini jika Anda mencetak PCB custom atau memakai modul adapter SOT-23 to DIP.

* **AO3401A** (P-Channel MOSFET, SOT-23, -30V, -4A) — Sangat hemat tempat, $V_{GS(th)}$ rendah (~ -0.9V). Harga: ~Rp 500 – Rp 1.500.
* **2N7002** (N-Channel MOSFET, SOT-23) atau **MMBT3904** (NPN Transistor, SOT-23) sebagai driver.

---

## 📐 Skematik Rangkaian High-Side Switch (Opsi Komponen Diskret)

```
             +5V Power Rail (Pin 3 Terminal Board KhursLabs)
                   │
                   ├───[ Resistor 10 kΩ ]───┐
                   │                        │
                   S (Source)               │
                ┌──┴──┐                     │
                │  P-MOSFET                 │
                │(IRF9540N)                 │
                └──┬──┘                     │
                   │ G (Gate) ──────────────┤
                   │                        │
                   D (Drain)                C (Collector)
                   │                     ┌──┴──┐
                   ▼                     │ NPN │ (BC547 / 2N2222)
          VCC Sensor A16                 └──┬──┘
          (Kabel Merah)                     │ B (Base) ──[ Resistor 1 kΩ ]── GPIO Kontrol ESP32
                                            │                              (Contoh: GPIO 4)
                                            E (Emitter)
                                            │
                                           GND (Common Ground)
```

### Penjelasan Cara Kerja Rangkaian:
1. **Kondisi Tidur (Deep Sleep)**:
   * GPIO ESP32 dalam kondisi *floating / LOW* (0V).
   * Transistor NPN mati (Cut-off).
   * Gate P-MOSFET ditarik ke +5V oleh resistor pull-up 10 kΩ $\rightarrow V_{GS} = 0\text{V}$.
   * P-MOSFET mati total (**OFF**) $\rightarrow$ **Daya ke sensor A16 terputus 100% (Arus 0 µA)**.

2. **Kondisi Bangun (Pengukuran Sensor)**:
   * ESP32 mengatur `GPIO 4 = HIGH` (3.3V).
   * Transistor NPN aktif (Saturasi) dan menarik Gate P-MOSFET ke GND ($0\text{V}$).
   * Tegangan $V_{GS} = -5\text{V}$, P-MOSFET menyala penuh (**ON**).
   * Arus 5V mengalir menyalakan sensor A16.
   * Setelah sensor selesai dibaca (~200 ms), ESP32 mengembalikan `GPIO 4 = LOW` sebelum masuk *Deep Sleep*.

---

## 🛠️ Panduan Integrasi ke Firmware ESP32

Pada file konfigurasi firmware [config.h](file:///d:/laragon/www/Terraflow/firmware/src/config.h):

```cpp
// Sensor Power Relay / MOSFET Gate Control Pin
// -1 : Jika sensor ditenagai langsung dari power rail tanpa switch
// >=0: Nomor pin GPIO yang terhubung ke Base resistor transistor (contoh: GPIO 4)
#define PIN_SENSOR_PWR        4 
```

### Logika Eksekusi di `sensor_a16.cpp`:
```cpp
void SensorA16::powerOn() {
  if (PIN_SENSOR_PWR >= 0) {
    pinMode(PIN_SENSOR_PWR, OUTPUT);
    digitalWrite(PIN_SENSOR_PWR, HIGH); // Nyalakan sensor
    delay(150); // Jeda stabilisasi sensor ultrasonik A16
  }
}

void SensorA16::powerOff() {
  if (PIN_SENSOR_PWR >= 0) {
    digitalWrite(PIN_SENSOR_PWR, LOW);  // Matikan daya sensor total
    pinMode(PIN_SENSOR_PWR, INPUT);     // High impedance saat tidur
  }
}
```

---

## 🔋 Simulasi Penghematan Daya Baterai

Perbandingan daya tahan pada **Aki / Baterai 12V 7Ah** (dengan efisiensi buck converter 5V ~85%, interval pembacaan 15 menit):

| Parameter | Tanpa Sakelar Daya (Sensor On 24/7) | Dengan High-Side MOSFET Switch |
|---|:---:|:---:|
| **Arus Saat Tidur** | ~25 mA (Sensor aktif terus) | **< 150 µA (0.15 mA)** |
| **Arus Saat Bangun** | ~180 mA (WiFi + Sensor) | ~180 mA (WiFi + Sensor) |
| **Durasi Bangun** | Tiap 15 mnt bangun 5 dtk | Tiap 15 mnt bangun 5 dtk |
| **Konsumsi Rata-rata** | ~26.2 mA | **~1.15 mA** |
| **Estimasi Daya Tahan Baterai** | **~9 – 11 Hari** | **~210 – 250 Hari (> 7 Bulan!)** |
