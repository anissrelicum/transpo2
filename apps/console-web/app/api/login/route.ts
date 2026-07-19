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
  const secure = process.env.NODE_ENV === 'production';
  out.cookies.set('token', data.token, { httpOnly: true, sameSite: 'lax', path: '/', secure });
  out.cookies.set('tenant', tenant ?? '', { httpOnly: true, sameSite: 'lax', path: '/', secure });
  return out;
}
