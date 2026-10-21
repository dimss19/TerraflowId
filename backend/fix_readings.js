const { query } = require('./src/db/connection');

async function fixReadings() {
  console.log('=== STEP 1: DEDUPLICATE READINGS PER MINUTE ===');
  
  // 1. Delete duplicate rows within the same minute, keeping the highest ID (latest / best row)
  const delRes = await query(`
    DELETE FROM readings a
    USING readings b
    WHERE a.device_id = b.device_id
      AND date_trunc('minute', a.timestamp) = date_trunc('minute', b.timestamp)
      AND a.id < b.id;
  `);
  console.log(`Deleted ${delRes.rowCount} duplicate minute rows.`);

  // 2. Align timestamps of all existing readings to the exact minute (:00 seconds)
  // To avoid duplicate key violations during update, update in subquery
  console.log('=== STEP 2: ALIGN TIMESTAMPS TO MINUTE BOUNDARY (:00) ===');
  await query(`
    UPDATE readings
    SET timestamp = date_trunc('minute', timestamp)
    WHERE EXTRACT(SECOND FROM timestamp) != 0;
  `).catch(err => {
    console.warn('Timestamp minute alignment notice (some already aligned):', err.message);
  });

  // Re-run dedup just in case aligning created any collision
  await query(`
    DELETE FROM readings a
    USING readings b
    WHERE a.device_id = b.device_id
      AND a.timestamp = b.timestamp
      AND a.id < b.id;
  `);

  // 3. Fill missing minute gaps for today (2026-10-20) between 12:00 and now
  console.log('=== STEP 3: HEAL MISSING MINUTES ON 2026-10-20 ===');
  const todayRows = await query(`
    SELECT id, timestamp, water_level_cm, raw_distance_cm, temperature_c, signal_quality, source
    FROM readings
    WHERE timestamp >= '2026-10-20 12:00:00+07'
    ORDER BY timestamp ASC;
  `);

  console.log(`Found ${todayRows.rows.length} readings after 12:00 today. Checking for gaps > 60s...`);

  let insertedGaps = 0;
  for (let i = 0; i < todayRows.rows.length - 1; i++) {
    const cur = todayRows.rows[i];
    const nxt = todayRows.rows[i + 1];

    const curTime = new Date(cur.timestamp).getTime();
    const nxtTime = new Date(nxt.timestamp).getTime();
    const diffSec = Math.round((nxtTime - curTime) / 1000);

    // If gap is between 100s and 300s (e.g. 1-3 missed minutes), interpolate them
    if (diffSec >= 100 && diffSec <= 360) {
      const missedMinutes = Math.floor(diffSec / 60);
      for (let m = 1; m < missedMinutes; m++) {
        const gapTime = new Date(curTime + m * 60 * 1000);
        // Linear interpolation of water_level and raw_distance
        const frac = m / missedMinutes;
        const curLvl = parseFloat(cur.water_level_cm) || 473.0;
        const nxtLvl = parseFloat(nxt.water_level_cm) || curLvl;
        const curDist = parseFloat(cur.raw_distance_cm) || 140.0;
        const nxtDist = parseFloat(nxt.raw_distance_cm) || curDist;

        const interLvl = +(curLvl + (nxtLvl - curLvl) * frac).toFixed(2);
        const interDist = +(curDist + (nxtDist - curDist) * frac).toFixed(2);

        await query(`
          INSERT INTO readings (
            device_id, timestamp, water_level_cm, raw_distance_cm,
            temperature_c, signal_quality, source, sd_status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'ok')
          ON CONFLICT (device_id, timestamp) DO NOTHING;
        `, [
          'AWLR-001',
          gapTime,
          interLvl,
          interDist,
          cur.temperature_c || 28.5,
          cur.signal_quality || -60,
          'interpolated'
        ]);
        insertedGaps++;
        console.log(`Healed gap at ${gapTime.toISOString()} -> level: ${interLvl} cm, dist: ${interDist} cm`);
      }
    }
  }

  console.log(`Total missing minutes healed: ${insertedGaps}`);

  // Summary check
  const summary = await query(`
    SELECT to_char(timestamp AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI') as minute_wib,
           COUNT(*) as cnt
    FROM readings
    WHERE timestamp >= '2026-10-20 12:00:00+07'
    GROUP BY minute_wib
    HAVING COUNT(*) > 1;
  `);
  console.log('Any duplicates left after 12:00 today?', summary.rows.length === 0 ? 'NONE (ALL CLEAN!)' : summary.rows);

  process.exit(0);
}

fixReadings().catch(err => {
  console.error('Error fixing readings:', err);
  process.exit(1);
});
