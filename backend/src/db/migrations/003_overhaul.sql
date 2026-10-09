-- Schema Migration: 003_overhaul.sql
-- User Profile & Role Overhaul for TerraFlow AWLR System

-- 1. Add phone and avatar_url columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255);

-- 2. Migrate any existing 'viewer' roles to 'operator'
UPDATE users SET role = 'operator' WHERE role = 'viewer';

-- 3. Enforce role check constraint for only 'admin' and 'operator'
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_role'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_role CHECK (role IN ('admin', 'operator'));
  END IF;
END $$;
