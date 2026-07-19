import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { API_URL } from '../../../lib/server';

// BFF : création de commande. Transmet le JWT (cookie httpOnly) à l'API.
export async function POST(req: NextRequest) {
  const token = cookies().get('token')?.value;
  if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const res = await fetch(`${API_URL}/v1/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return NextResponse.json({ error: data?.message ?? 'Création impossible' }, { status: res.status });
  }
  return NextResponse.json(data);
}
