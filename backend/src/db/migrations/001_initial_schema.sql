-- Schema Migration: 001_initial_schema.sql
-- TerraFlow Portable AWLR Database Initialization

-- Enable pgcrypto for UUID generation if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Devices Table
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(200),
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    sensor_height_cm DECIMAL(8, 2) DEFAULT 600.00,
    is_active BOOLEAN DEFAULT true,
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Sensor Readings (Partitioned by Range on timestamp)
CREATE TABLE IF NOT EXISTS readings (
    id BIGSERIAL,
    device_id VARCHAR(50) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    raw_distance_cm DECIMAL(8, 2),
    water_level_cm DECIMAL(8, 2),
    temperature_c DECIMAL(5, 2),
    battery_voltage DECIMAL(5, 2),
    battery_percent SMALLINT,
    signal_quality SMALLINT,
    sd_status VARCHAR(10),
    reading_count INTEGER,
    source VARCHAR(20) DEFAULT 'live',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (device_id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Monthly Partitions
CREATE TABLE IF NOT EXISTS readings_2026_10 PARTITION OF readings
    FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS readings_2026_11 PARTITION OF readings
    FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');

-- Default Partition for any other range
CREATE TABLE IF NOT EXISTS readings_default PARTITION OF readings DEFAULT;

-- 3. Calibrations History Table
CREATE TABLE IF NOT EXISTS calibrations (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    sensor_height_cm DECIMAL(8, 2) NOT NULL,
    offset_cm DECIMAL(8, 2) DEFAULT 0.00,
    slope DECIMAL(8, 6) DEFAULT 1.000000,
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    applied_by VARCHAR(100),
    notes TEXT,
    is_active BOOLEAN DEFAULT true
);

-- 4. Device Alerts Table
CREATE TABLE IF NOT EXISTS device_alerts (
    id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    alert_code VARCHAR(30) NOT NULL,
    severity VARCHAR(10) NOT NULL,     -- 'CRITICAL', 'WARNING', 'INFO'
    message TEXT NOT NULL,
    details JSONB,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Device Diagnostics Snapshots
CREATE TABLE IF NOT EXISTS device_diagnostics (
    id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    boot_reason VARCHAR(30),
    uptime_sec INTEGER,
    boot_count INTEGER,
    watchdog_count INTEGER,
    brownout_count INTEGER,
    panic_count INTEGER,
    free_heap_bytes INTEGER,
    wifi_rssi SMALLINT,
    sd_card_ok BOOLEAN,
    sensor_ok BOOLEAN,
    battery_voltage DECIMAL(5, 2),
    esp_temp_c DECIMAL(5, 2),
    pending_unsent INTEGER,
    firmware_version VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Alert Rules Table
CREATE TABLE IF NOT EXISTS alert_rules (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(50) REFERENCES devices(device_id) ON DELETE CASCADE,
    alert_code VARCHAR(30) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    threshold_value DECIMAL(10, 2),
    cooldown_minutes INTEGER DEFAULT 30,
    notify_email BOOLEAN DEFAULT false,
    notify_webhook BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_readings_time ON readings (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_readings_device_time ON readings (device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_calibrations_device_active ON calibrations (device_id, is_active);
CREATE INDEX IF NOT EXISTS idx_alerts_device_resolved ON device_alerts (device_id, resolved, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_diagnostics_device_time ON device_diagnostics (device_id, timestamp DESC);
