-- Schema Migration: 008_add_sampling_interval.sql
-- Menambahkan kolom sampling_interval_sec pada tabel devices untuk sinkronisasi interval telemetri / deep sleep
-- Idempotent: aman dijalankan berulang kali.

ALTER TABLE devices ADD COLUMN IF NOT EXISTS sampling_interval_sec INTEGER DEFAULT 900;
