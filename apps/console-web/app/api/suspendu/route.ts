import { NextResponse } from 'next/server';

/**
 * Sortie de secours du paywall (AN-10) : l'API refuse un tenant suspendu par un 403
 * « Espace suspendu » — cette route purge la session (le JWT resterait sinon valable
 * 12 h dans le navigateur) puis renvoie vers /login avec le message à afficher.
 */
export async function GET(request: Request) {
  const out = NextResponse.redirect(new URL('/login?suspendu=1', request.url));
  out.cookies.delete('token');
  out.cookies.delete('tenant');
  out.cookies.delete('name');
  out.cookies.delete('role');
  return out;
}
