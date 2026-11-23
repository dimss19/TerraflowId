// Helper HTTP bersama untuk memanggil backend Terraflow.

/** Header Authorization (+ JSON bila diminta) untuk token JWT. */
export function authHeaders(token, { json = false } = {}) {
  const headers = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/**
 * fetch + parse JSON dengan header auth otomatis.
 * Melempar Error dengan pesan dari server bila `success` bernilai false
 * atau status HTTP bukan 2xx.
 * @param {string} path  mis. `/api/devices`
 * @param {{ token?: string, method?: string, body?: any }} opts
 */
export async function apiFetch(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: authHeaders(token, { json: body !== undefined }),
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // respons bukan JSON
  }
  if (!res.ok || (json && json.success === false)) {
    throw new Error(json?.error || `Permintaan gagal (HTTP ${res.status})`);
  }
  return json;
}
