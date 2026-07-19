import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { API_URL } from '../../../../../lib/server';

// BFF : actions sur une commande (advance | assign | cancel). Transmet le JWT.
const ALLOWED = new Set(['advance', 'assign', 'cancel']);

export async function POST(req: NextRequest, { params }: { params: { ref: string; action: string } }) {
  const token = cookies().get('token')?.value;
  if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (!ALLOWED.has(params.action)) return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${API_URL}/v1/orders/${encodeURIComponent(params.ref)}/${params.action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return NextResponse.json({ error: data?.message ?? 'Action impossible' }, { status: res.status });
  return NextResponse.json(data);
}
