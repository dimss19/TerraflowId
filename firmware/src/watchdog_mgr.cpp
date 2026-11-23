#include "watchdog_mgr.h"
#include "config.h"

// Variables preserved across soft resets and watchdog reboots in RTC fast memory
RTC_DATA_ATTR uint32_t rtc_boot_count = 0;
RTC_DATA_ATTR uint32_t rtc_wake_count = 0;
RTC_DATA_ATTR uint32_t rtc_watchdog_count = 0;
RTC_DATA_ATTR uint32_t rtc_brownout_count = 0;
RTC_DATA_ATTR uint32_t rtc_panic_count = 0;

void initWatchdog() {
  // Nilai kembalian WAJIB diperiksa: bila TWDT sudah diinisialisasi dari sdkconfig
  // (umum pada Arduino-ESP32 2.x), panggilan ini mengembalikan ESP_ERR_INVALID_STATE
  // dan timeout WATCHDOG_TIMEOUT_SEC TIDAK diterapkan - watchdog tetap memakai
  // timeout default sdkconfig. Tanpa log ini, kegagalan tersebut tidak terlihat.
  esp_err_t err = esp_task_wdt_init(WATCHDOG_TIMEOUT_SEC, true);
  if (err == ESP_OK) {
    Serial.printf("[WDT] Task Watchdog Timer armed (%d seconds timeout)\n", WATCHDOG_TIMEOUT_SEC);
  } else {
    Serial.printf("[WDT PERINGATAN] esp_task_wdt_init gagal (%s). Timeout %d dtk TIDAK diterapkan; "
                  "watchdog memakai timeout default sdkconfig!\n",
      esp_err_to_name(err), WATCHDOG_TIMEOUT_SEC);
  }
}

void feedWatchdog() {
  esp_task_wdt_reset();
}

BootStats handleBootReason() {
  esp_reset_reason_t reason = esp_reset_reason();

  // Bangun dari deep sleep BUKAN sebuah boot. Menaikkan boot_count di sini
  // (perilaku lama) membuat alat sehat terlihat seperti crash-loop: 96 "boot"
  // per hari, ~35.000 per tahun, sehingga crash yang nyata tidak bisa dibedakan
  // dari operasi normal. Dua counter dipisah agar keduanya bermakna.
  bool isDeepSleepWake = (reason == ESP_RST_DEEPSLEEP);
  if (isDeepSleepWake) {
    rtc_wake_count++;
  } else {
    rtc_boot_count++;
  }

  BootStats stats;
  stats.bootCount = rtc_boot_count;
  stats.wakeCount = rtc_wake_count;
  stats.watchdogCount = rtc_watchdog_count;
  stats.brownoutCount = rtc_brownout_count;
  stats.panicCount = rtc_panic_count;
  stats.isCrashReset = false;

  switch (reason) {
    case ESP_RST_POWERON:
      stats.reasonStr = "POWERON_RESET";
      rtc_watchdog_count = 0;
      rtc_brownout_count = 0;
      rtc_panic_count = 0;
      rtc_wake_count = 0;
      stats.wakeCount = 0;
      break;

    // Bangun normal terjadwal. Tanpa case ini, reason jatuh ke default: dan
    // SELALU dilaporkan "OTHER_RESET" - akar masalah mengapa dashboard tidak
    // pernah bisa membedakan alat sehat dari alat yang reboot terus.
    case ESP_RST_DEEPSLEEP:
      stats.reasonStr = "DEEPSLEEP_WAKE";
      break;

    case ESP_RST_TASK_WDT:
    case ESP_RST_INT_WDT:
    case ESP_RST_WDT:
      stats.reasonStr = "WDT_RESET";
      rtc_watchdog_count++;
      stats.watchdogCount = rtc_watchdog_count;
      stats.isCrashReset = true;
      Serial.println("[CRITICAL] ESP32 rebooted due to Watchdog Timeout!");
      break;

    case ESP_RST_BROWNOUT:
      stats.reasonStr = "BROWNOUT_RST";
      rtc_brownout_count++;
      stats.brownoutCount = rtc_brownout_count;
      stats.isCrashReset = true;
      Serial.println("[CRITICAL] ESP32 rebooted due to Brownout (Power dip)!");
      break;

    case ESP_RST_PANIC:
      stats.reasonStr = "SW_CPU_RESET";
      rtc_panic_count++;
      stats.panicCount = rtc_panic_count;
      stats.isCrashReset = true;
      Serial.println("[CRITICAL] ESP32 rebooted due to Software Panic / Exception!");
      break;

    case ESP_RST_SW:
      stats.reasonStr = "SW_RESTART";
      break;

    default:
      stats.reasonStr = "OTHER_RESET";
      break;
  }

  Serial.printf("[BOOT] Reason: %s | Boot: %lu | Wake: %lu | WDT: %lu | Brownout: %lu | Panic: %lu\n",
    stats.reasonStr.c_str(), (unsigned long)stats.bootCount, (unsigned long)stats.wakeCount,
    (unsigned long)stats.watchdogCount, (unsigned long)stats.brownoutCount,
    (unsigned long)stats.panicCount);

  return stats;
}
