-- Schema Migration: 009_honest_diagnostics.sql
-- Menampung field diagnostik baru dari firmware, dan menutup satu celah
-- yang menyebabkan kehilangan data telemetri secara senyap.
--
-- Latar belakang:
--
-- (1) Firmware sebelumnya mengirim beberapa field kesehatan yang DI-HARDCODE
--     "sehat": sd_status selalu 'ok', sd_card_ok/sensor_ok selalu true,
--     panic_count selalu 0. Firmware kini mengirim nilai sebenarnya, plus
--     field baru: sensor_error (NO_ECHO / TIMEOUT / checksum), write_fail_count,
--     wake_count (bangun dari deep sleep, dipisah dari boot_count), serta
--     sensor_fail_streak dan sensor_power_on.
--     Handler MQTT memilih kolom satu per satu (cherry-pick), jadi tanpa
--     kolom di sini field baru tidak error - tapi hilang tanpa jejak.
--
-- (2) readings.sd_status semula VARCHAR(10). Insert telemetri di
--     src/mqtt/subscriber.js tidak dibungkus try/catch lokal, sehingga string
--     lebih dari 10 karakter memicu error Postgres 22001 (value too long)
--     yang ditelan catch-all terluar - dan SELURUH baris telemetri siklus itu
--     hilang tanpa retry, tanpa alert, tanpa baris DB. Dengan nilai yang kini
--     jujur (mis. 'write_err', 'lock_busy', 'open_fail'), ranjau ini harus
--     ditutup permanen, bukan sekadar dihindari dengan disiplin panjang string.
--
-- Idempotent: aman dijalankan berulang kali (migrate.js menjalankan seluruh
-- berkas migrasi setiap kali start).

-- ---------------------------------------------------------------------------
-- 1. Perlebar sd_status agar kesalahan panjang string tidak lagi fatal
-- ---------------------------------------------------------------------------
-- WAJIB bersyarat: migrate.js tidak punya tabel pelacak, sehingga SELURUH
-- berkas migrasi dijalankan ulang setiap kali - dan seluruhnya di dalam satu
-- transaksi. ALTER COLUMN ... TYPE tanpa penjagaan akan menulis ulang tabel
-- readings sambil menahan lock ACCESS EXCLUSIVE pada SETIAP kali migrasi
-- berjalan; pada tabel berisi telemetri berbulan-bulan itu mahal dan
-- memblokir ingest MQTT. Dengan guard ini, ALTER hanya terjadi sekali.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'readings'
       AND column_name = 'sd_status'
       AND character_maximum_length < 20
  ) THEN
    ALTER TABLE readings ALTER COLUMN sd_status TYPE VARCHAR(20);
    RAISE NOTICE 'readings.sd_status diperlebar ke VARCHAR(20).';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Field baru pada tabel readings (dikirim tiap pembacaan)
-- ---------------------------------------------------------------------------
ALTER TABLE readings
  ADD COLUMN IF NOT EXISTS sensor_error     VARCHAR(20),
  ADD COLUMN IF NOT EXISTS write_fail_count INTEGER;

COMMENT ON COLUMN readings.sensor_error IS
  'Penyebab spesifik kegagalan sensor A16 (NO_ECHO / TIMEOUT / checksum). NULL bila pembacaan normal.';
COMMENT ON COLUMN readings.write_fail_count IS
  'Akumulasi sampel yang gagal ditulis ke MicroSD sejak boot terakhir.';
COMMENT ON COLUMN readings.sd_status IS
  'Status MicroSD sebenarnya: ok / no_card / lock_busy / open_fail. Sebelum migrasi 009 nilainya selalu di-hardcode ok.';

-- ---------------------------------------------------------------------------
-- 3. Field baru pada tabel device_diagnostics
-- ---------------------------------------------------------------------------
ALTER TABLE device_diagnostics
  ADD COLUMN IF NOT EXISTS wake_count         INTEGER,
  ADD COLUMN IF NOT EXISTS sd_status          VARCHAR(20),
  ADD COLUMN IF NOT EXISTS sensor_error       VARCHAR(20),
  ADD COLUMN IF NOT EXISTS sensor_fail_streak INTEGER,
  ADD COLUMN IF NOT EXISTS sensor_power_on    BOOLEAN,
  ADD COLUMN IF NOT EXISTS write_fail_count   INTEGER;

COMMENT ON COLUMN device_diagnostics.wake_count IS
  'Jumlah bangun normal dari deep sleep. Dipisah dari boot_count supaya boot_count kembali bermakna sebagai hitungan boot/crash sebenarnya.';
COMMENT ON COLUMN device_diagnostics.boot_reason IS
  'POWERON_RESET / DEEPSLEEP_WAKE / WDT_RESET / BROWNOUT_RST / SW_CPU_RESET / SW_RESTART. Sebelum migrasi 009 firmware selalu melaporkan OTHER_RESET untuk bangun normal.';
COMMENT ON COLUMN device_diagnostics.sensor_power_on IS
  'Posisi sakelar daya sensor (GPIO 9) saat laporan dibuat.';

-- ---------------------------------------------------------------------------
-- 4. Indeks untuk pencarian riwayat diagnostik per perangkat
-- ---------------------------------------------------------------------------
-- Endpoint /api/diagnostics/:id mengambil baris terbaru per perangkat;
-- tabel ini kini bertambah ~96 baris/hari/alat (sebelumnya 0 karena payload
-- diagnostik tidak pernah terkirim sama sekali).
CREATE INDEX IF NOT EXISTS idx_diagnostics_device_time
  ON device_diagnostics (device_id, timestamp DESC);
