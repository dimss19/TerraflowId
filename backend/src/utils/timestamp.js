/**
 * ==============================================================
 *  TerraFlow AWLR — Parser Timestamp Terpusat
 * ==============================================================
 *  Semua jalur penerimaan data - MQTT live, MQTT bulk sync, dan HTTP
 *  offline-sync / offline-batch - memakai modul ini agar interpretasi
 *  waktu selalu identik.
 *
 *  Aturan:
 *   1. Field `timestamp` (epoch detik/milidetik, atau string ISO) adalah
 *      sumber utama. Tidak ambigu terhadap zona waktu.
 *   2. Fallback `date` + `hour` + `minute` (+ `second`) diinterpretasi
 *      sebagai WIB (UTC+7), sesuai zona waktu perangkat yang memakai
 *      setenv("TZ", "WIB-7", 1) pada firmware.
 *      Sebelumnya fallback ini memakai waktu lokal server, sehingga data
 *      meleset 1 jam bila server tidak berada di zona WIB.
 *   3. RTC perangkat kadang menyimpan waktu lokal sebagai nilai epoch,
 *      sehingga timestamp tampak 7 jam di masa depan. Dikoreksi bila
 *      hasil koreksinya masuk akal.
 * ==============================================================
 */

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const FUTURE_GUARD_MS = 10 * 60 * 1000;
// Batas atas epoch "detik" agar tidak tertukar dengan milidetik.
// 1e11 detik = tahun 5138, 1e11 ms = 1973.
const EPOCH_SECONDS_MAX = 1e11;

/**
 * Ubah nilai timestamp menjadi Date.
 * Menerima epoch detik, epoch milidetik, string angka, atau string tanggal.
 * @param {number|string|undefined|null} value
 * @returns {Date|null}
 */
function toDate(value) {
  if (value === undefined || value === null || value === '') return null;

  let date;
  if (typeof value === 'number') {
    date = new Date(Math.abs(value) < EPOCH_SECONDS_MAX ? value * 1000 : value);
  } else {
    const raw = String(value).trim();
    const numeric = Number(raw);
    date = raw !== '' && !Number.isNaN(numeric)
      ? new Date(Math.abs(numeric) < EPOCH_SECONDS_MAX ? numeric * 1000 : numeric)
      : new Date(raw);
  }

  return isNaN(date.getTime()) ? null : date;
}

/**
 * Susun Date dari date + hour + minute + second dalam zona WIB (UTC+7).
 * @returns {Date|null}
 */
function fromWibParts(dateStr, hour, minute, second) {
  if (!dateStr) return null;

  const pad = (n) => String(n).padStart(2, '0');
  const h = Math.max(0, Math.min(23, parseInt(hour, 10) || 0));
  const m = Math.max(0, Math.min(59, parseInt(minute, 10) || 0));
  const s = Math.max(0, Math.min(59, parseInt(second, 10) || 0));

  const date = new Date(`${String(dateStr).trim()}T${pad(h)}:${pad(m)}:${pad(s)}+07:00`);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Koreksi timestamp yang tampak di masa depan - indikasi RTC perangkat
 * menyimpan waktu lokal (WIB) sebagai nilai epoch.
 * @param {Date|null} date
 * @returns {Date|null}
 */
function guardFutureRtc(date) {
  if (!date) return null;
  if (date.getTime() > Date.now() + FUTURE_GUARD_MS) {
    const corrected = new Date(date.getTime() - WIB_OFFSET_MS);
    if (corrected.getTime() <= Date.now() + 60000) {
      return corrected;
    }
  }
  return date;
}

/**
 * Parse timestamp satu record telemetry/offline.
 * Field `timestamp` menang; date+jam hanya dipakai sebagai fallback.
 * @param {object} item
 * @returns {Date|null}
 */
function parseTelemetryTimestamp(item) {
  if (!item) return null;

  const primary = guardFutureRtc(toDate(item.timestamp));
  if (primary) return primary;

  return fromWibParts(item.date, item.hour, item.minute, item.second);
}

/**
 * Bulatkan ke menit penuh (:00 detik) - menjamin 1 record per menit
 * dan mencegah duplikasi antarmalur (MQTT vs HTTP) pada menit yang sama.
 * @param {Date|null} date
 * @returns {Date|null}
 */
function alignToMinute(date) {
  if (!date) return null;
  return new Date(Math.floor(date.getTime() / 60000) * 60000);
}

module.exports = {
  WIB_OFFSET_MS,
  EPOCH_SECONDS_MAX,
  toDate,
  fromWibParts,
  guardFutureRtc,
  parseTelemetryTimestamp,
  alignToMinute,
};
