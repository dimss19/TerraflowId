const { query, pool } = require('./connection');

async function seedData() {
  console.log('[Seed] Seeding initial data for PT Tanah Airku Teknologi...');
  
  try {
    // 1. Seed or update primary AWLR device
    const deviceRes = await query(`
      INSERT INTO devices (device_id, name, location, latitude, longitude, sensor_height_cm, is_active, last_seen)
      VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
      ON CONFLICT (device_id) DO UPDATE SET
        name = EXCLUDED.name,
        location = EXCLUDED.location,
        sensor_height_cm = EXCLUDED.sensor_height_cm,
        last_seen = NOW()
      RETURNING *
    `, [
      'AWLR-001',
      'AWLR Portable Alpha - Mahakam River Estuary',
      'Muara Sanga-Sanga, Kalimantan Timur (PT Tanah Airku Teknologi)',
      -0.5892000,
      117.2415000,
      600.00
    ]);
    console.log('[Seed] Device AWLR-001 registered:', deviceRes.rows[0].name);

    // 2. Seed active calibration
    await query(`
      INSERT INTO calibrations (device_id, sensor_height_cm, offset_cm, slope, applied_at, applied_by, notes, is_active)
      VALUES ($1, $2, $3, $4, NOW(), $5, $6, true)
      ON CONFLICT DO NOTHING
    `, [
      'AWLR-001',
      600.00,
      0.00,
      1.000000,
      'Teknisi Lapangan PT Tanah Airku Teknologi',
      'Kalibrasi baseline nol awal di dermaga muara'
    ]);

    // 3. Seed alert rules
    const rules = [
      ['BATTERY_LOW', 11.50, 30],
      ['BATTERY_CRITICAL', 10.50, 15],
      ['SENSOR_ANOMALY', 50.00, 10],
      ['TEMP_HIGH', 60.00, 30],
    ];
    for (const [code, thresh, cooldown] of rules) {
      await query(`
        INSERT INTO alert_rules (device_id, alert_code, enabled, threshold_value, cooldown_minutes)
        VALUES ($1, $2, true, $3, $4)
        ON CONFLICT DO NOTHING
      `, ['AWLR-001', code, thresh, cooldown]);
    }

    // 4. Seed realistic 24-hour tidal wave readings (1440 data points = 1 per minute)
    console.log('[Seed] Generating 24-hour realistic tidal dataset...');
    const now = Date.now();
    const sensorHeight = 600.0;
    const baseMsl = 220.0; // Mean sea level 220 cm
    const tidalAmplitude = 110.0; // Tide range ~220 cm (from 110cm to 330cm)
    const tidalPeriodMs = 12.42 * 3600 * 1000; // Semi-diurnal M2 period ~12.42 hours

    const readingsBatch = [];
    for (let i = 1440; i >= 0; i--) {
      const timeMs = now - (i * 60 * 1000);
      const timestamp = new Date(timeMs).toISOString();

      // Dual harmonic tide model: M2 (12.42h) + S2 (12.0h) + subtle noise
      const phaseM2 = (2 * Math.PI * timeMs) / tidalPeriodMs;
      const phaseS2 = (2 * Math.PI * timeMs) / (12.0 * 3600 * 1000);
      const noise = (Math.sin(i * 0.1) * 0.8) + (Math.cos(i * 0.05) * 0.5);

      const waterLevel = +(baseMsl + (tidalAmplitude * Math.sin(phaseM2)) + (20.0 * Math.sin(phaseS2)) + noise).toFixed(2);
      const rawDistance = +(sensorHeight - waterLevel).toFixed(2);
      const temperature = +(28.2 + Math.sin(i / 100) * 1.5).toFixed(2);
      const batteryVoltage = +(12.45 - (i / 1440) * 0.15).toFixed(2);
      const batteryPercent = Math.min(100, Math.max(0, Math.round(((batteryVoltage - 10.5) / 2.3) * 100)));
      const signalQuality = -65 - Math.round(Math.abs(Math.sin(i)) * 10);

      readingsBatch.push([
        'AWLR-001',
        timestamp,
        rawDistance,
        waterLevel,
        temperature,
        batteryVoltage,
        batteryPercent,
        signalQuality,
        'ok',
        1441 - i,
        i > 60 ? 'sd_buffer' : 'live'
      ]);
    }

    // Insert readings in chunks of 100 using parameterized multi-row insert
    const chunkSize = 100;
    for (let c = 0; c < readingsBatch.length; c += chunkSize) {
      const chunk = readingsBatch.slice(c, c + chunkSize);
      const valueClauses = [];
      const flatParams = [];
      let paramIdx = 1;

      for (const row of chunk) {
        const placeholders = [];
        for (let p = 0; p < row.length; p++) {
          placeholders.push(`$${paramIdx++}`);
          flatParams.push(row[p]);
        }
        valueClauses.push(`(${placeholders.join(', ')})`);
      }

      const insertSql = `
        INSERT INTO readings (
          device_id, timestamp, raw_distance_cm, water_level_cm,
          temperature_c, battery_voltage, battery_percent,
          signal_quality, sd_status, reading_count, source
        )
        VALUES ${valueClauses.join(', ')}
        ON CONFLICT (device_id, timestamp) DO NOTHING
      `;
      await query(insertSql, flatParams);
    }
    console.log(`[Seed] Successfully inserted ${readingsBatch.length} historical readings.`);

    // 5. Seed sample alerts
    await query(`
      INSERT INTO device_alerts (device_id, timestamp, alert_code, severity, message, details, resolved)
      VALUES 
      ($1, NOW() - INTERVAL '3 hours', 'SENSOR_ANOMALY', 'WARNING', 'Perubahan elevasi terdeteksi melebihi batas rata-rata saat uji lapangan awal.', '{"delta_cm": 22.4}', true),
      ($1, NOW() - INTERVAL '15 minutes', 'BATTERY_LOW', 'WARNING', 'Tegangan baterai cadangan terdeteksi di bawah 12.3V.', '{"voltage": 12.28, "percent": 77}', false)
      ON CONFLICT DO NOTHING
    `, ['AWLR-001']);

    // 6. Seed sample diagnostic snapshot
    await query(`
      INSERT INTO device_diagnostics (
        device_id, timestamp, boot_reason, uptime_sec, boot_count,
        watchdog_count, brownout_count, panic_count, free_heap_bytes,
        wifi_rssi, sd_card_ok, sensor_ok, battery_voltage, esp_temp_c,
        pending_unsent, firmware_version
      )
      VALUES ($1, NOW(), 'POWERON_RESET', 86400, 1, 0, 0, 0, 168420, -66, true, true, 12.35, 41.2, 0, '1.0.0')
      ON CONFLICT DO NOTHING
    `, ['AWLR-001']);

    console.log('[Seed] Database seeding completed successfully!');
  } catch (err) {
    console.error('[Seed Error]', err.message);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  seedData();
}

module.exports = seedData;
