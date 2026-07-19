import { NextRequest, NextResponse } from 'next/server';
import { API_URL } from '../../../lib/server';

// BFF : login côté serveur → pose un cookie httpOnly `token`. Pas de CORS (même origine).
export async function POST(req: NextRequest) {
  const { email, password, tenant } = await req.json();
  const res = await fetch(`${API_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-slug': tenant ?? '' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return NextResponse.json({ error: data?.message ?? 'Échec de connexion' }, { status: res.status });
  }
  const out = NextResponse.json({ ok: true, role: data.role, name: data.name });
  // `Secure` uniquement en HTTPS réel : un cookie Secure est rejeté par le navigateur
  // sur http:// (cas Docker/E2E). Derrière un proxy TLS, x-forwarded-proto=https le réactive.
  const secure = (req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '')) === 'https';
  const opts = { httpOnly: true, sameSite: 'lax' as const, path: '/', secure };
  out.cookies.set('token', data.token, opts);
  out.cookies.set('tenant', tenant ?? '', opts);
  out.cookies.set('name', data.name ?? '', opts);
  out.cookies.set('role', data.role ?? '', opts);
  return out;
}
