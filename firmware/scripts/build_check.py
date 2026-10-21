"""
==============================================================
 TerraFlow AWLR — Pemeriksaan pra-build
==============================================================
 Script PlatformIO `pre:` untuk memastikan kredensial broker MQTT
 tersedia sebelum flash.

 Broker TerraFlow mewajibkan username/password. Bila file
 src/config_secrets.h tidak ada, build tetap berjalan (kredensial
 boleh diisi lewat portal perangkat), namun perangkat PASTI ditolak
 broker saat runtime. Karena itu build menampilkan peringatan
 mencolok, bukan error, supaya development tidak terhambat.

 Usage (otomatis via platformio.ini):
     extra_scripts = pre:scripts/build_check.py
"""

import os
import sys

# File ini dijalankan sebagai SConscript oleh PlatformIO, sehingga `__file__`
# TIDAK tersedia di konteks tersebut. PROJECT_DIR diambil dari env SCons;
# fallback ke direktori kerja bila dijalankan manual.
PROJECT_DIR = None
try:
    Import("env")  # noqa: F821  (inject oleh SCons)
    PROJECT_DIR = env["PROJECT_DIR"]  # noqa: F821
except Exception:
    PROJECT_DIR = os.getcwd()

SECRETS = os.path.join(PROJECT_DIR, "src", "config_secrets.h")


def main():
    print("")
    print("=" * 64)
    print("  TerraFlow AWLR - Pemeriksaan kredensial broker MQTT")
    print("=" * 64)

    if os.path.isfile(SECRETS):
        print("  [OK]    src/config_secrets.h ditemukan")
        print("          Kredensial broker akan di-bundle ke firmware.")
        print("=" * 64)
        print("")
        return

    print("  [WARN]  src/config_secrets.h TIDAK ditemukan")
    print("")
    print("          Broker TerraFlow mewajibkan username/password.")
    print("          TANPA file ini, perangkat akan flash dengan")
    print("          kredensial kosong dan koneksi MQTT DITOLAK.")
    print("")
    print("          Cara 1 (disarankan, sebelum build):")
    print("              ./firmware/setup-secrets.sh")
    print("")
    print("          Cara 2 (tanpa build ulang):")
    print("              Hubungkan perangkat ke portal lokal")
    print("              http://192.168.4.1/login  (password: password)")
    print("              -> /settings -> isi mq_user & mq_pass")
    print("")
    print("=" * 64)
    print("")
    return


try:
    main()
except Exception as exc:  # jangan pernah menggagalkan build
    print("[build_check] dilewati: %s" % exc, file=sys.stderr)
