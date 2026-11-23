const { query } = require('../db/connection');

/**
 * Periksa apakah user boleh mengakses/mengendalikan perangkat.
 * Admin: semua perangkat. Selain admin: hanya perangkat yang ditugaskan.
 * Bila ditolak, response 404/403 langsung dikirim dan fungsi mengembalikan null.
 * @param {{queryFn?: Function}} [opts] queryFn dapat diganti untuk unit test
 * @returns {Promise<object|null>} baris perangkat (device_id, assigned_to)
 */
async function checkDeviceAccess(req, res, deviceId, { queryFn = query } = {}) {
  const normalizedId = String(deviceId).replace(/\s+/g, '-');
  const dev = await queryFn(
    'SELECT device_id, assigned_to FROM devices WHERE device_id = $1 OR device_id = $2 LIMIT 1',
    [deviceId, normalizedId]
  );
  if (dev.rows.length === 0) {
    res.status(404).json({ success: false, error: 'Perangkat tidak ditemukan' });
    return null;
  }
  if (req.user?.role !== 'admin' && dev.rows[0].assigned_to !== req.user?.id) {
    res.status(403).json({ success: false, error: 'Akses ditolak: Stasiun ini tidak ditugaskan kepada Anda' });
    return null;
  }
  return dev.rows[0];
}

/**
 * Middleware Express untuk route ber-parameter :device_id.
 * Dipasang setelah authenticateToken. Menyimpan baris perangkat di req.device.
 */
async function requireDeviceAccess(req, res, next) {
  try {
    const device = await checkDeviceAccess(req, res, req.params.device_id);
    if (!device) return;
    req.device = device;
    next();
  } catch (err) {
    console.error('[Device Access Error]', err.message);
    res.status(500).json({ success: false, error: 'Gagal memeriksa akses perangkat' });
  }
}

module.exports = { checkDeviceAccess, requireDeviceAccess };
