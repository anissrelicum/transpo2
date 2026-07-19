import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { API_URL } from '../../../../lib/server';

// Proxy générique authentifié : transmet le JWT (cookie httpOnly) à l'API.
// La RBAC et le scoping tenant restent appliqués côté API — le proxy n'accorde
// aucun privilège supplémentaire (il ne fait que porter le token de l'utilisateur).
async function forward(req: NextRequest, path: string[], method: 'GET' | 'POST' | 'PATCH' | 'DELETE') {
  const token = cookies().get('token')?.value;
  if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const target = `${API_URL}/${path.map(encodeURIComponent).join('/')}`;
  const body = method !== 'GET' ? await req.text() : undefined;
  const res = await fetch(target, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return NextResponse.json({ error: data?.message ?? 'Action impossible' }, { status: res.status });
  return NextResponse.json(data ?? { ok: true });
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, params.path, 'POST');
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, params.path, 'GET');
}

export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, params.path, 'PATCH');
}

export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, params.path, 'DELETE');
}
