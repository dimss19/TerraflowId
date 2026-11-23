// Unit test helper inti backend. Jalankan: npm test (di folder backend).
// Tidak butuh database/MQTT: query DB diganti stub.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const { parseTelemetryTimestamp, alignToMinute } = require('../src/utils/timestamp');
const { calcWaterLevel, DEFAULT_CALIBRATION } = require('../src/services/calibration');
const { addDateRange } = require('../src/utils/dateRange');
const { checkDeviceAccess } = require('../src/middleware/deviceAccess');

// ---------------------------------------------------------------------------
// parseTelemetryTimestamp
// ---------------------------------------------------------------------------
test('timestamp: epoch detik valid dipakai apa adanya', () => {
  const d = parseTelemetryTimestamp({ timestamp: 1763900000 });
  assert.equal(d.toISOString(), '2025-11-23T12:13:20.000Z');
});

test('timestamp: epoch milidetik dikenali', () => {
  const d = parseTelemetryTimestamp({ timestamp: 1763900000000 });
  assert.equal(d.toISOString(), '2025-11-23T12:13:20.000Z');
});

test('timestamp: uptime (jam belum sinkron) ditolak, bukan tahun 1970', () => {
  assert.equal(parseTelemetryTimestamp({ timestamp: 3600 }), null);
  assert.equal(parseTelemetryTimestamp({ timestamp: 3600, date: '1970-01-01', hour: 1, minute: 0 }), null);
});

test('timestamp: fallback date+jam diinterpretasi sebagai WIB', () => {
  const d = parseTelemetryTimestamp({ date: '2026-11-23', hour: 10, minute: 5, second: 0 });
  assert.equal(d.toISOString(), '2026-11-23T03:05:00.000Z');
});

test('timestamp: timestamp tak valid jatuh ke fallback date+jam', () => {
  const d = parseTelemetryTimestamp({ timestamp: 120, date: '2026-11-23', hour: 7, minute: 0 });
  assert.equal(d.toISOString(), '2026-11-23T00:00:00.000Z');
});

test('timestamp: input kosong -> null', () => {
  assert.equal(parseTelemetryTimestamp(null), null);
  assert.equal(parseTelemetryTimestamp({}), null);
});

test('alignToMinute membulatkan ke bawah', () => {
  const d = alignToMinute(new Date('2026-11-23T03:05:42.123Z'));
  assert.equal(d.toISOString(), '2026-11-23T03:05:00.000Z');
  assert.equal(alignToMinute(null), null);
});

// ---------------------------------------------------------------------------
// calcWaterLevel (backend == frontend)
// ---------------------------------------------------------------------------
test('calcWaterLevel: TMA = H - (D*slope + offset)', () => {
  assert.equal(calcWaterLevel(420, { height: 600, offset: 2, slope: 1.01 }), 173.8);
  assert.equal(calcWaterLevel(420, DEFAULT_CALIBRATION), 180);
});

test('calcWaterLevel: rumus frontend identik dengan backend', async () => {
  const feUrl = pathToFileURL(path.resolve(__dirname, '../../frontend/src/lib/device.js')).href;
  const fe = await import(feUrl);
  const cases = [
    [420, { height: 600, offset: 2, slope: 1.01 }],
    [0, { height: 600, offset: 0, slope: 1 }],
    [599.5, { height: 750, offset: -3.25, slope: 0.98 }],
  ];
  for (const [dist, calib] of cases) {
    assert.equal(+fe.calcWaterLevel(dist, calib).toFixed(2), calcWaterLevel(dist, calib));
  }
});

// ---------------------------------------------------------------------------
// addDateRange
// ---------------------------------------------------------------------------
test('addDateRange: start & end valid menambah 2 kondisi dengan placeholder berurutan', () => {
  const conditions = ['device_id = $1'];
  const params = ['AWLR-001'];
  addDateRange(conditions, params, '2026-11-01T00:00:00Z', '2026-11-02T00:00:00Z');
  assert.deepEqual(conditions, ['device_id = $1', 'timestamp >= $2', 'timestamp <= $3']);
  assert.deepEqual(params, ['AWLR-001', '2026-11-01T00:00:00.000Z', '2026-11-02T00:00:00.000Z']);
});

test('addDateRange: tanggal tidak valid diabaikan (tidak melempar)', () => {
  const conditions = ['x'];
  const params = ['a', 'b'];
  addDateRange(conditions, params, 'bukan-tanggal', '2026-11-02');
  assert.deepEqual(conditions, ['x', 'timestamp <= $3']);
  assert.equal(params.length, 3);
});

test('addDateRange: tanpa start/end tidak mengubah apa pun', () => {
  const conditions = ['x'];
  const params = ['a'];
  addDateRange(conditions, params, undefined, '');
  assert.deepEqual(conditions, ['x']);
  assert.deepEqual(params, ['a']);
});

// ---------------------------------------------------------------------------
// checkDeviceAccess
// ---------------------------------------------------------------------------
function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}
const deviceRow = (assigned_to) => async () => ({ rows: [{ device_id: 'AWLR-001', assigned_to }] });
const noDevice = async () => ({ rows: [] });

test('checkDeviceAccess: admin boleh akses perangkat siapa pun', async () => {
  const res = mockRes();
  const dev = await checkDeviceAccess({ user: { id: 1, role: 'admin' } }, res, 'AWLR-001', { queryFn: deviceRow(2) });
  assert.equal(dev.device_id, 'AWLR-001');
  assert.equal(res.statusCode, null);
});

test('checkDeviceAccess: operator boleh akses perangkat yang ditugaskan', async () => {
  const res = mockRes();
  const dev = await checkDeviceAccess({ user: { id: 2, role: 'operator' } }, res, 'AWLR-001', { queryFn: deviceRow(2) });
  assert.ok(dev);
  assert.equal(res.statusCode, null);
});

test('checkDeviceAccess: operator lain ditolak 403', async () => {
  const res = mockRes();
  const dev = await checkDeviceAccess({ user: { id: 3, role: 'operator' } }, res, 'AWLR-001', { queryFn: deviceRow(2) });
  assert.equal(dev, null);
  assert.equal(res.statusCode, 403);
});

test('checkDeviceAccess: perangkat belum ditugaskan ditolak untuk operator', async () => {
  const res = mockRes();
  const dev = await checkDeviceAccess({ user: { id: 2, role: 'operator' } }, res, 'AWLR-001', { queryFn: deviceRow(null) });
  assert.equal(dev, null);
  assert.equal(res.statusCode, 403);
});

test('checkDeviceAccess: perangkat tidak ada -> 404', async () => {
  const res = mockRes();
  const dev = await checkDeviceAccess({ user: { id: 1, role: 'admin' } }, res, 'NOPE', { queryFn: noDevice });
  assert.equal(dev, null);
  assert.equal(res.statusCode, 404);
});

test('checkDeviceAccess: ID dengan spasi dinormalisasi jadi tanda hubung', async () => {
  let captured;
  const queryFn = async (_sql, params) => { captured = params; return { rows: [{ device_id: 'AWLR-001', assigned_to: 1 }] }; };
  await checkDeviceAccess({ user: { id: 1, role: 'admin' } }, mockRes(), 'AWLR 001', { queryFn });
  assert.deepEqual(captured, ['AWLR 001', 'AWLR-001']);
});
