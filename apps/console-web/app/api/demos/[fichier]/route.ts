import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createReadStream, promises as fs } from 'node:fs';
import { Readable } from 'node:stream';
import * as path from 'node:path';
import { API_URL } from '../../../../lib/server';
import { FICHIERS_DEMOS } from '../../../../lib/demos';

// Vidéos de démo, réservées au super-administrateur de la plateforme.
//
// Le cookie `role` ne prouve rien (il n'est qu'un raccourci d'affichage) : la session est
// vérifiée par l'API, sur un endpoint qu'elle réserve au realm plateforme. Le résultat est
// gardé quelques minutes par jeton — une lecture vidéo enchaîne des dizaines de requêtes
// Range, l'API n'a pas à être interrogée pour chacune.
const DOSSIER = process.env.DEMOS_DIR || path.join(process.cwd(), 'demos');
const VALIDITE_MS = 5 * 60_000;
const sessionsVerifiees = new Map<string, number>();

const TYPES: Record<string, string> = { '.mp4': 'video/mp4', '.vtt': 'text/vtt; charset=utf-8', '.jpg': 'image/jpeg' };

async function sessionPlateforme(token: string): Promise<boolean> {
  const jusqua = sessionsVerifiees.get(token);
  if (jusqua && jusqua > Date.now()) return true;
  const res = await fetch(`${API_URL}/v1/saas/plans`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  }).catch(() => null);
  if (!res?.ok) { sessionsVerifiees.delete(token); return false; }
  sessionsVerifiees.set(token, Date.now() + VALIDITE_MS);
  return true;
}

export async function GET(req: NextRequest, { params }: { params: { fichier: string } }) {
  const token = cookies().get('token')?.value;
  if (!token || !(await sessionPlateforme(token))) {
    return NextResponse.json({ error: 'Réservé à la console de la plateforme' }, { status: 401 });
  }
  // Liste fermée : le nom ne sert jamais à construire un chemin arbitraire.
  if (!FICHIERS_DEMOS.includes(params.fichier)) {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  }
  const chemin = path.join(DOSSIER, params.fichier);
  const stat = await fs.stat(chemin).catch(() => null);
  if (!stat) return NextResponse.json({ error: 'Vidéo non publiée sur ce serveur' }, { status: 404 });

  const type = TYPES[path.extname(chemin)] ?? 'application/octet-stream';
  const entetes = {
    'content-type': type,
    'accept-ranges': 'bytes',
    'cache-control': 'private, max-age=3600',
  };

  // Lecture partielle : indispensable pour se déplacer dans une vidéo sans tout télécharger.
  const plage = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') ?? '');
  if (plage && (plage[1] || plage[2])) {
    const debut = plage[1] ? Number(plage[1]) : Math.max(0, stat.size - Number(plage[2]));
    const fin = plage[1] && plage[2] ? Math.min(Number(plage[2]), stat.size - 1) : stat.size - 1;
    if (debut >= stat.size || debut > fin) {
      return new NextResponse(null, { status: 416, headers: { 'content-range': `bytes */${stat.size}` } });
    }
    const flux = Readable.toWeb(createReadStream(chemin, { start: debut, end: fin })) as ReadableStream;
    return new NextResponse(flux, {
      status: 206,
      headers: { ...entetes, 'content-length': String(fin - debut + 1), 'content-range': `bytes ${debut}-${fin}/${stat.size}` },
    });
  }
  const flux = Readable.toWeb(createReadStream(chemin)) as ReadableStream;
  return new NextResponse(flux, { status: 200, headers: { ...entetes, 'content-length': String(stat.size) } });
}
