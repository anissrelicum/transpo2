// Helpers E2E — tapent l'API réelle (conteneur). BASE fourni par l'env (API_URL).
export const BASE = process.env.API_URL || 'http://localhost:3000';

export async function api(path, { method = 'GET', token, tenant, body } = {}) {
  const headers = {};
  if (token) headers['authorization'] = `Bearer ${token}`;
  if (tenant) headers['x-tenant-slug'] = tenant;
  if (body) headers['content-type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* pas de corps JSON */ }
  return { status: res.status, json };
}

export async function login(tenant, email, password = 'transpo') {
  const r = await api('/v1/auth/login', { method: 'POST', tenant, body: { email, password } });
  if (r.status !== 200) throw new Error(`login ${email}@${tenant} → ${r.status} ${JSON.stringify(r.json)}`);
  return r.json.token;
}

export async function superLogin(email = 'ops@transpo.ma', password = 'transpo') {
  const r = await api('/v1/auth/super/login', { method: 'POST', body: { email, password } });
  if (r.status !== 200) throw new Error(`super login → ${r.status}`);
  return r.json.token;
}

/** Attend que l'API réponde (démarrage du conteneur). */
export async function waitForApi(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return;
    } catch { /* pas encore prêt */ }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error('API indisponible (timeout)');
}
