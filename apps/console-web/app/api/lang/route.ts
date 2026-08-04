import { NextRequest, NextResponse } from 'next/server';
import { isLang, DEFAULT_LANG } from '@transpo/i18n';
import { LANG_COOKIE } from '../../../lib/i18n';

// Choix de langue : posé en cookie pour que le rendu serveur sorte déjà dans la
// bonne langue et la bonne direction. Pas httpOnly — c'est une préférence
// d'affichage, pas un secret, et le client peut avoir à la lire.
export async function POST(req: NextRequest) {
  const { lang } = await req.json().catch(() => ({ lang: undefined }));
  const value = isLang(lang) ? lang : DEFAULT_LANG;
  const out = NextResponse.json({ ok: true, lang: value });
  const secure = (req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '')) === 'https';
  out.cookies.set(LANG_COOKIE, value, {
    httpOnly: false, sameSite: 'lax', path: '/', secure, maxAge: 60 * 60 * 24 * 365,
  });
  return out;
}
