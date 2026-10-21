/**
 * ==============================================================
 *  TerraFlow AWLR — Rule Engine Alert
 * ==============================================================
 *  Mengevaluasi rule yang tersimpan pada tabel `alert_rules` terhadap
 *  telemetry yang masuk, lalu membuat alert bila ambang batas terlampaui.
 *
 *  Sebelumnya tabel `alert_rules` hanya diisi oleh seed dan tidak pernah
 *  dibaca kode mana pun - rule yang dibuat tidak pernah dieksekusi.
 *
 *  Aturan cooldown: sebuah rule tidak akan memicu alert lagi selama
 *  `cooldown_minutes` sejak alert terakhir dengan kode yang sama.
 *
 *  Pemicu per-kode (lihat PRD):
 *   SENSOR_ANOMALY - lonjakan delta elevasi air > threshold (cm) dalam
 *                    satu menit. Sumber: dua pembacaan berturut-turut.
 *   TEMP_HIGH      - suhu internal ESP32 (esp_temp_c) > threshold (°C).
 *                    Sumber: laporan diagnostik, bukan suhu air.
 * ==============================================================
 */

const { query } = require('../db/connection');

// Definisi pemicu per alert_code.
//   source    : 'reading' (dari tabel readings) atau 'diagnostics'
//   severity  : tingkat keparahan default
//   compare   : 'gt' (lebih besar dari) atau 'abs_delta_gt'
const RULE_DEFINITIONS = {
  SENSOR_ANOMALY: {
    source: 'reading',
    compare: 'abs_delta_gt',
    severity: 'WARNING',
    label: 'lonjakan elevasi air',
    unit: 'cm',
  },
  TEMP_HIGH: {
    source: 'diagnostics',
    compare: 'gt',
    severity: 'WARNING',
    label: 'suhu internal ESP32',
    unit: '°C',
  },
};

// Cache rule per perangkat agar tidak query DB untuk tiap pembacaan.
const RULE_CACHE_TTL_MS = 30 * 1000;
const ruleCache = new Map();

/**
 * Ambil rule aktif untuk sebuah perangkat (dengan cache singkat).
 * @param {string} deviceId
 * @returns {Promise<Array>}
 */
async function getActiveRules(deviceId) {
  const cached = ruleCache.get(deviceId);
  const now = Date.now();
  if (cached && now - cached.loadedAt < RULE_CACHE_TTL_MS) {
    return cached.rules;
  }

  const res = await query(
    `SELECT id, alert_code, threshold_value, cooldown_minutes
       FROM alert_rules
      WHERE enabled = true
        AND (device_id = $1 OR device_id IS NULL)
      ORDER BY id`,
    [deviceId]
  );

  const rules = res.rows;
  ruleCache.set(deviceId, { loadedAt: now, rules });
  return rules;
}

/**
 * Apakah rule masih dalam masa cooldown?
 * @param {string} deviceId
 * @param {string} alertCode
 * @param {number} cooldownMinutes
 * @returns {Promise<boolean>}
 */
async function isInCooldown(deviceId, alertCode, cooldownMinutes) {
  if (!cooldownMinutes || cooldownMinutes <= 0) return false;

  const res = await query(
    `SELECT timestamp
       FROM device_alerts
      WHERE device_id = $1
        AND alert_code = $2
        AND timestamp > NOW() - ($3 || ' minutes')::INTERVAL
      LIMIT 1`,
    [deviceId, alertCode, String(cooldownMinutes)]
  );

  return res.rows.length > 0;
}

/**
 * Buat alert baru bila belum ada dalam masa cooldown.
 * @returns {Promise<object|null>} baris alert yang dibuat, atau null
 */
async function raiseAlert(deviceId, alertCode, severity, message, details) {
  const res = await query(
    `INSERT INTO device_alerts (
       device_id, timestamp, alert_code, severity, message, details, resolved
     )
     VALUES ($1, NOW(), $2, $3, $4, $5, false)
     RETURNING *`,
    [deviceId, alertCode, severity, message, JSON.stringify(details || {})]
  );

  const alert = res.rows[0] || null;
  if (alert) {
    console.warn(`[Rule Engine] [${alert.severity}] ${deviceId} ${alertCode}: ${alert.message}`);
  }
  return alert;
}

/**
 * Evaluasi rule terhadap satu pembacaan (delta antar-pembacaan).
 * Dipanggil setelah pembacaan tersimpan.
 * @param {string} deviceId
 * @param {object} reading - { timestamp, water_level_cm, temperature_c, ... }
 */
async function evaluateReadingRules(deviceId, reading) {
  if (!deviceId || !reading) return [];

  let rules;
  try {
    rules = await getActiveRules(deviceId);
  } catch (e) {
    console.warn('[Rule Engine] gagal memuat rule:', e.message);
    return [];
  }

  const triggered = [];

  for (const rule of rules) {
    const def = RULE_DEFINITIONS[rule.alert_code];
    if (!def || def.source !== 'reading') continue;

    const threshold = parseFloat(rule.threshold_value);
    if (!Number.isFinite(threshold)) continue;

    let measured = null;
    let details = {};

    if (def.compare === 'abs_delta_gt') {
      // Ambil pembacaan sebelumnya untuk menghitung delta
      const prev = await query(
        `SELECT water_level_cm
           FROM readings
          WHERE device_id = $1
            AND timestamp < $2
          ORDER BY timestamp DESC
          LIMIT 1`,
        [deviceId, reading.timestamp]
      );
      if (prev.rows.length === 0) continue;

      const prevLevel = parseFloat(prev.rows[0].water_level_cm);
      const currLevel = parseFloat(reading.water_level_cm);
      if (!Number.isFinite(prevLevel) || !Number.isFinite(currLevel)) continue;

      measured = Math.abs(currLevel - prevLevel);
      details = {
        delta_cm: +measured.toFixed(2),
        previous_level_cm: prevLevel,
        current_level_cm: currLevel,
        threshold_cm: threshold,
        window: '1 menit'
      };
      if (measured <= threshold) continue;
    } else {
      measured = parseFloat(reading.temperature_c);
      if (!Number.isFinite(measured)) continue;
      details = { temperature_c: measured, threshold_c: threshold };
      if (def.compare === 'gt' && measured <= threshold) continue;
    }

    if (await isInCooldown(deviceId, rule.alert_code, rule.cooldown_minutes)) {
      continue;
    }

    const message = `${def.label} ${measured.toFixed(2)} ${def.unit} melebihi ambang batas ${threshold} ${def.unit}.`;
    const alert = await raiseAlert(deviceId, rule.alert_code, def.severity, message, details);
    if (alert) triggered.push(alert);
  }

  return triggered;
}

/**
 * Evaluasi rule terhadap laporan diagnostik.
 * Dipanggil setelah diagnostic tersimpan.
 * @param {string} deviceId
 * @param {object} diagnostics - { esp_temp_c, ... }
 */
async function evaluateDiagnosticsRules(deviceId, diagnostics) {
  if (!deviceId || !diagnostics) return [];

  let rules;
  try {
    rules = await getActiveRules(deviceId);
  } catch (e) {
    console.warn('[Rule Engine] gagal memuat rule:', e.message);
    return [];
  }

  const triggered = [];

  for (const rule of rules) {
    const def = RULE_DEFINITIONS[rule.alert_code];
    if (!def || def.source !== 'diagnostics') continue;

    const threshold = parseFloat(rule.threshold_value);
    if (!Number.isFinite(threshold)) continue;

    const measured = parseFloat(diagnostics.esp_temp_c);
    if (!Number.isFinite(measured)) continue;
    if (def.compare === 'gt' && measured <= threshold) continue;

    if (await isInCooldown(deviceId, rule.alert_code, rule.cooldown_minutes)) {
      continue;
    }

    const message = `${def.label} ${measured.toFixed(2)} ${def.unit} melebihi ambang batas ${threshold} ${def.unit}.`;
    const alert = await raiseAlert(deviceId, rule.alert_code, def.severity, message, {
      esp_temp_c: measured,
      threshold_c: threshold
    });
    if (alert) triggered.push(alert);
  }

  return triggered;
}

/** Bersihkan cache rule (dipanggil dari proses lain bila perlu) */
function clearRuleCache() {
  ruleCache.clear();
}

module.exports = {
  RULE_DEFINITIONS,
  getActiveRules,
  evaluateReadingRules,
  evaluateDiagnosticsRules,
  clearRuleCache,
};
