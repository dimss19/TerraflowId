-- Schema Migration: 004_device_assignment.sql
-- Add operator assignment to devices table for Role-Based Device Access Control

ALTER TABLE devices ADD COLUMN IF NOT EXISTS assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_devices_assigned_to ON devices (assigned_to);

-- Assign existing devices to the default operator so existing devices are immediately usable
UPDATE devices 
SET assigned_to = (SELECT id FROM users WHERE role = 'operator' ORDER BY id ASC LIMIT 1)
WHERE assigned_to IS NULL;
