// Helper bersama untuk status perangkat, waktu, dan perhitungan muka air.

// Perangkat dianggap online bila terlihat dalam 2 menit terakhir.
export const ONLINE_THRESHOLD_SEC = 120;

/**
 * @param {string|number|Date|null|undefined} lastSeen
 * @returns {boolean}
 */
export function isDeviceOnline(lastSeen) {
  if (!lastSeen) return false;
  const diffSeconds = (Date.now() - new Date(lastSeen).getTime()) / 1000;
  return diffSeconds < ONLINE_THRESHOLD_SEC;
}

/**
 * Ubah timestamp (epoch detik, epoch ms, atau string tanggal) ke ISO string.
 * Tanpa nilai -> waktu sekarang.
 */
export function toIsoTimestamp(ts) {
  if (!ts) return new Date().toISOString();
  const date = typeof ts === 'number' && ts < 1e11 ? new Date(ts * 1000) : new Date(ts);
  return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

/**
 * Rumus tinggi muka air (TMA):
 *   TMA = H - (jarak * slope + offset)
 * Harus identik dengan backend/src/services/calibration.js.
 * @param {number} distanceCm
 * @param {{height:number, offset:number, slope:number}} calib
 */
export function calcWaterLevel(distanceCm, { height, offset, slope }) {
  return height - (distanceCm * slope + offset);
}
