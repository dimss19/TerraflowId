-- Schema Migration: 004_device_assignment.sql
-- Add operator assignment to devices table for Role-Based Device Access Control

-- Penugasan awal ke operator default HANYA dilakukan saat kolom baru dibuat.
-- Sebelumnya UPDATE ini berjalan di setiap migrasi, sehingga device yang sengaja
-- dibiarkan tanpa operator selalu ditugaskan ulang secara diam-diam.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'devices' AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE devices ADD COLUMN assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL;

    -- Assign existing devices to the default operator so existing devices are immediately usable
    UPDATE devices
    SET assigned_to = (SELECT id FROM users WHERE role = 'operator' ORDER BY id ASC LIMIT 1)
    WHERE assigned_to IS NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_devices_assigned_to ON devices (assigned_to);
