const { query } = require('../db/connection');

// Nilai bawaan bila perangkat belum punya kalibrasi aktif.
const DEFAULT_CALIBRATION = Object.freeze({ height: 600.0, offset: 0.0, slope: 1.0 });

/**
 * Ambil kalibrasi aktif terbaru sebuah perangkat.
 * @param {string} deviceId
 * @returns {Promise<{height:number, offset:number, slope:number}|null>} null bila belum ada.
 */
async function getActiveCalibration(deviceId) {
  const res = await query(
    `SELECT sensor_height_cm, offset_cm, slope
       FROM calibrations
      WHERE device_id = $1 AND is_active = true
      ORDER BY applied_at DESC LIMIT 1`,
    [deviceId]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    height: parseFloat(row.sensor_height_cm) || DEFAULT_CALIBRATION.height,
    offset: parseFloat(row.offset_cm) || DEFAULT_CALIBRATION.offset,
    slope: parseFloat(row.slope) || DEFAULT_CALIBRATION.slope
  };
}

/**
 * Seperti getActiveCalibration, tetapi selalu mengembalikan nilai
 * (fallback ke DEFAULT_CALIBRATION bila belum ada / query gagal).
 */
async function getDeviceCalibration(deviceId) {
  try {
    const calib = await getActiveCalibration(deviceId);
    if (calib) return calib;
  } catch (err) {
    console.warn('[Get Calibration Warning]', err.message);
  }
  return { ...DEFAULT_CALIBRATION };
}

/**
 * Rumus tinggi muka air (TMA):
 *   TMA = H - (jarak * slope + offset)
 * Harus identik dengan frontend/src/lib/waterLevel.js.
 */
function calcWaterLevel(distanceCm, calib) {
  return +(calib.height - (distanceCm * calib.slope + calib.offset)).toFixed(2);
}

module.exports = { DEFAULT_CALIBRATION, getActiveCalibration, getDeviceCalibration, calcWaterLevel };
