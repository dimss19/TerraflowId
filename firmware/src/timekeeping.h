#ifndef TIMEKEEPING_H
#define TIMEKEEPING_H

#include <Arduino.h>
#include <time.h>
#include <sys/time.h>

/**
 * Waktu & suhu die - pengganti modul rtc_mgr yang dihapus.
 *
 * RTC DS3231M onboard dinonaktifkan (ENABLE_ONBOARD_RTC = false) karena
 * GPIO 9 / SCL dialokasikan ulang sebagai sakelar daya sensor. Modul lama
 * menyisakan ~197 baris kode mati, dan yang lebih berbahaya: setDateTime()
 * serta readDateTime() tidak punya guard, sehingga masih melakukan operasi
 * I2C pada pin default Wire (SDA = GPIO 8, SCL = GPIO 9) - yaitu jalur data
 * sensor dan gate MOSFET daya sensor. Modul ini hanya menyisakan fungsi yang
 * benar-benar dipakai, tanpa menyentuh Wire/I2C sama sekali.
 */

// Ambang epoch untuk membedakan jam yang sudah disinkronkan dari jam yang
// masih di 1970. Sebelumnya konstanta 1700000000 ditulis berulang di 6 tempat.
#define TIME_SYNCED_EPOCH_MIN 1700000000

// True bila jam sistem sudah pernah disinkronkan (NTP atau jam HP teknisi).
bool isSystemTimeValid();

// Suhu DIE ESP32-S3, bukan suhu ambient. Saat radio aktif nilainya 10-25 C
// di atas suhu lingkungan - jangan dipakai untuk analisa hidrologi.
float readDieTemperatureC();

// "YYYY-MM-DD HH:MM:SS", atau penanda eksplisit bila jam belum sinkron.
String getIsoTimestamp();

// Set jam sistem dari epoch. Dipakai oleh endpoint /api/rtc/sync, yaitu
// tombol "Sinkronkan Jam HP" di dashboard - satu-satunya cara menyetel jam
// di lokasi tanpa internet (NTP tidak tersedia, RTC berbaterai tidak ada).
bool setSystemEpoch(time_t epochSec);

#endif // TIMEKEEPING_H
