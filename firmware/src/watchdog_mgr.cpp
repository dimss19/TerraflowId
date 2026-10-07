#include "watchdog_mgr.h"
#include "config.h"

// Variables preserved across soft resets and watchdog reboots in RTC fast memory
RTC_DATA_ATTR uint32_t rtc_boot_count = 0;
RTC_DATA_ATTR uint32_t rtc_watchdog_count = 0;
RTC_DATA_ATTR uint32_t rtc_brownout_count = 0;
RTC_DATA_ATTR uint32_t rtc_panic_count = 0;

void initWatchdog() {
  esp_task_wdt_init(WATCHDOG_TIMEOUT_SEC, true);
  esp_task_wdt_add(NULL); // Add current main task to watchdog
  Serial.printf("[WDT] Task Watchdog Timer armed (%d seconds timeout)\n", WATCHDOG_TIMEOUT_SEC);
}

void feedWatchdog() {
  esp_task_wdt_reset();
}

BootStats handleBootReason() {
  esp_reset_reason_t reason = esp_reset_reason();
  rtc_boot_count++;

  BootStats stats;
  stats.bootCount = rtc_boot_count;
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

  Serial.printf("[BOOT] Reason: %s | Total Boot: %d | WDT Count: %d\n",
    stats.reasonStr.c_str(), stats.bootCount, stats.watchdogCount);

  return stats;
}
