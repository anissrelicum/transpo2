import { NextRequest, NextResponse } from 'next/server';
import { API_URL, tenantFromHost } from '../../../lib/server';

// BFF : login côté serveur → pose un cookie httpOnly `token`. Pas de CORS (même origine).
// Le tenant est résolu depuis le HOST (sous-domaine) — l'utilisateur ne le saisit plus.
// Un `tenant` explicite dans le corps reste accepté (override dev/test).
export async function POST(req: NextRequest) {
  const { email, password, tenant: override, superAdmin } = await req.json();
  // Le comptage anti-bruteforce de l'API se fait aussi par source : sans cette chaîne,
  // toutes les tentatives lui arrivent avec l'adresse du BFF et se confondent.
  const ipClient = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? '';
  // Realm plateforme : aucun tenant, endpoint séparé (console SaaS).
  // Sans sous-domaine ni `?org=`, l'API déduit la société de l'adresse e-mail : plus de
  // société « par défaut » qui refusait les comptes de toutes les autres.
  const tenant = superAdmin ? '' : (override || tenantFromHost(req.headers.get('host')) || '');

  const res = superAdmin
    ? await fetch(`${API_URL}/v1/auth/super/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(ipClient ? { 'x-forwarded-for': ipClient } : {}) },
        body: JSON.stringify({ email, password }),
      })
    : await fetch(`${API_URL}/v1/auth/login`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(tenant ? { 'x-tenant-slug': tenant } : {}),
          ...(ipClient ? { 'x-forwarded-for': ipClient } : {}),
        },
        body: JSON.stringify({ email, password }),
      });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // 409 : compte présent dans plusieurs sociétés (mot de passe déjà vérifié) → à choisir.
    return NextResponse.json({ error: data?.message ?? 'Échec de connexion', societes: data?.societes }, { status: res.status });
  }
  const societe = superAdmin ? '' : (data.tenant ?? tenant);
  // `/v1/auth/super/login` ne renvoie que { token, name } : le rôle est implicite.
  const role = superAdmin ? 'SUPER_ADMIN' : data.role;
  const out = NextResponse.json({ ok: true, role, name: data.name, tenant: societe });
  // `Secure` uniquement en HTTPS réel (rejeté par le navigateur sur http:// en Docker/E2E).
  const secure = (req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '')) === 'https';
  const opts = { httpOnly: true, sameSite: 'lax' as const, path: '/', secure };
  out.cookies.set('token', data.token, opts);
  out.cookies.set('tenant', societe, opts);
  out.cookies.set('name', data.name ?? '', opts);
  out.cookies.set('role', role ?? '', opts);
  // Le marchand agit POUR une boutique, qui ne porte pas forcément son nom : sans elle,
  // l'espace marchand n'affichait que la personne connectée et rien ne disait au nom de
  // quelle enseigne les commandes étaient passées (constat TC-N01, 14/09).
  out.cookies.set('merchant', data.merchant ?? '', opts);
  return out;
}
