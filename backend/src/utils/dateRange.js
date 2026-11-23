/**
 * Tambahkan filter rentang waktu (start/end) ke query. Nilai tanggal yang
 * tidak valid diabaikan (bukan error 500). Placeholder dihitung dari
 * panjang `params`, jadi panggil setelah parameter lain dimasukkan.
 */
function addDateRange(conditions, params, start, end) {
  for (const [value, op] of [[start, '>='], [end, '<=']]) {
    if (!value) continue;
    const date = new Date(value);
    if (isNaN(date.getTime())) continue;
    params.push(date.toISOString());
    conditions.push(`timestamp ${op} $${params.length}`);
  }
}

module.exports = { addDateRange };
