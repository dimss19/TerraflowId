-- Schema Migration: 006_remove_battery_fields.sql
-- Menghapus pembacaan tegangan baterai dari seluruh sistem.
--
-- Latar belakang: perangkat AWLR tidak memiliki rangkaian pengukur
-- tegangan baterai (tidak ada pin ADC untuk pengukuran tersebut di firmware),
-- sehingga kolom battery_voltage / battery_percent tidak pernah terisi
-- oleh data perangkat nyata - hanya oleh data seed/simulator.
-- Kolom tersebut cukup membingungkan operator (selalu kosong) sehingga
-- dihapus altogether, beserta rule dan alert terkait.
--
-- Idempotent: aman dijalankan berulang kali.

-- 1. Kolom pada tabel readings (tabel ter-partisi)
ALTER TABLE readings DROP COLUMN IF EXISTS battery_voltage;
ALTER TABLE readings DROP COLUMN IF EXISTS battery_percent;

-- 2. Kolom pada tabel device_diagnostics
ALTER TABLE device_diagnostics DROP COLUMN IF EXISTS battery_voltage;

-- 3. Rule alert bertenaga baterai
DELETE FROM alert_rules WHERE alert_code IN ('BATTERY_LOW', 'BATTERY_CRITICAL');

-- 4. Riwayat alert bertenaga baterai
DELETE FROM device_alerts WHERE alert_code IN ('BATTERY_LOW', 'BATTERY_CRITICAL');
