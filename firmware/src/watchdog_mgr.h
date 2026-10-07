#ifndef WATCHDOG_MGR_H
#define WATCHDOG_MGR_H

#include <Arduino.h>
#include <esp_task_wdt.h>

struct BootStats {
  String reasonStr;
  uint32_t bootCount;
  uint32_t watchdogCount;
  uint32_t brownoutCount;
  uint32_t panicCount;
  bool isCrashReset;
};

void initWatchdog();
void feedWatchdog();
BootStats handleBootReason();

#endif // WATCHDOG_MGR_H
