import { NextRequest, NextResponse } from 'next/server';
import { API_URL, DEFAULT_TENANT, tenantFromHost } from '../../../lib/server';

// BFF : login côté serveur → pose un cookie httpOnly `token`. Pas de CORS (même origine).
// Le tenant est résolu depuis le HOST (sous-domaine) — l'utilisateur ne le saisit plus.
// Un `tenant` explicite dans le corps reste accepté (override dev/test).
export async function POST(req: NextRequest) {
  const { email, password, tenant: override, superAdmin } = await req.json();
  // Realm plateforme : aucun tenant, endpoint séparé (console SaaS).
  const tenant = superAdmin ? '' : (override || tenantFromHost(req.headers.get('host')) || DEFAULT_TENANT);

  const res = superAdmin
    ? await fetch(`${API_URL}/v1/auth/super/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
    : await fetch(`${API_URL}/v1/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-tenant-slug': tenant },
        body: JSON.stringify({ email, password }),
      });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return NextResponse.json({ error: data?.message ?? 'Échec de connexion' }, { status: res.status });
  }
  // `/v1/auth/super/login` ne renvoie que { token, name } : le rôle est implicite.
  const role = superAdmin ? 'SUPER_ADMIN' : data.role;
  const out = NextResponse.json({ ok: true, role, name: data.name, tenant });
  // `Secure` uniquement en HTTPS réel (rejeté par le navigateur sur http:// en Docker/E2E).
  const secure = (req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '')) === 'https';
  const opts = { httpOnly: true, sameSite: 'lax' as const, path: '/', secure };
  out.cookies.set('token', data.token, opts);
  out.cookies.set('tenant', tenant, opts);
  out.cookies.set('name', data.name ?? '', opts);
  out.cookies.set('role', role ?? '', opts);
  return out;
}
