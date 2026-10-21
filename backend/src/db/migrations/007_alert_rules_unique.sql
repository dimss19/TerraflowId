-- Schema Migration: 007_alert_rules_unique.sql
-- Mencleanup duplikat pada tabel alert_rules dan menambahkan batasan
-- keunikan, supaya seeding tidak menambah baris yang sama berulang kali.
--
-- Latar belakang: tabel alert_rules tidak punya constraint unik pada
-- (device_id, alert_code). Seed memakai "ON CONFLICT DO NOTHING" yang
-- tanpa target conflict tidak pernah berkonflik, sehingga setiap
-- menjalankan seed menambah satu salinan rule yang sama. Setelah beberapa
-- kali seed, tabel berisi 8 baris untuk 2 rule yang seharusnya 2.
--
-- Idempotent: aman dijalankan berulang kali.

-- 1. Buang duplikat, sisakan yang tertua untuk tiap kombinasi
DELETE FROM alert_rules a
      USING alert_rules b
     WHERE a.id > b.id
       AND a.device_id IS NOT DISTINCT FROM b.device_id
       AND a.alert_code = b.alert_code;

-- 2. Jaga keunikan kombinasi device + kode alert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_alert_rules_device_code'
  ) THEN
    ALTER TABLE alert_rules
      ADD CONSTRAINT chk_alert_rules_device_code
      UNIQUE (device_id, alert_code);
  END IF;
END $$;
