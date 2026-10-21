#!/usr/bin/env bash
# ==============================================================
#  TerraFlow AWLR — Generator firmware/src/config_secrets.h
# ==============================================================
#  Broker MQTT TerraFlow mewajibkan username/password. Karena repo
#  ini publik, kredensial TIDAK disimpan di dalam Git. Jalankan skrip
#  ini sekali sebelum build/flash:
#
#      ./firmware/setup-secrets.sh
#      ./firmware/setup-secrets.sh --user terraflow --pass "password-anda"
#
#  Environment variable yang juga dibaca:
#      MQTT_USER, MQTT_PASS
#
#  Output : firmware/src/config_secrets.h (mode 600, sudah di .gitignore)
# ==============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$SCRIPT_DIR/src/config_secrets.h"
TEMPLATE="$SCRIPT_DIR/src/config_secrets.h.example"

MQTT_USER_ARG=""
MQTT_PASS_ARG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --user) MQTT_USER_ARG="${2:-}"; shift 2 ;;
    --pass) MQTT_PASS_ARG="${2:-}"; shift 2 ;;
    -h|--help)
      sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "Argumen tidak dikenal: $1" >&2; exit 1 ;;
  esac
done

USER_VAL="${MQTT_USER_ARG:-${MQTT_USER:-}}"
PASS_VAL="${MQTT_PASS_ARG:-${MQTT_PASS:-}}"

if [[ -z "$USER_VAL" || -z "$PASS_VAL" ]]; then
  echo "Mohon isi kredensial broker MQTT TerraFlow."
  echo
  read -rp "  MQTT username [terraflow]: " USER_VAL
  USER_VAL="${USER_VAL:-terraflow}"
  read -rsp "  MQTT password  : " PASS_VAL; echo
  echo
fi

if [[ -z "$PASS_VAL" ]]; then
  echo "Password tidak boleh kosong." >&2
  exit 1
fi

if [[ ! -f "$TEMPLATE" ]]; then
  echo "Template tidak ditemukan: $TEMPLATE" >&2
  exit 1
fi

umask 077
cat > "$TARGET" <<EOF
/**
 * TerraFlow AWLR — Kredensial Rahasia Broker MQTT
 * Dibuat otomatis oleh firmware/setup-secrets.sh
 * File ini DI-GITIGNORE, jangan di-commit.
 */

#ifndef CONFIG_SECRETS_H
#define CONFIG_SECRETS_H

#define MQTT_USER             "$USER_VAL"
#define MQTT_PASS             "$PASS_VAL"

#endif // CONFIG_SECRETS_H
EOF

chmod 600 "$TARGET"

echo "OK  -> $TARGET"
echo "     MQTT_USER = $USER_VAL"
echo "     MQTT_PASS = (disembunyikan, $(printf '%*s' ${#PASS_VAL} '' | tr ' ' '*'))"
echo
echo "Lanjut build/flash:"
echo "     pio run -e esp32-s3-devkitc-1 -t upload"
