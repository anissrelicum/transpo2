import fs from 'node:fs';
import { Readable } from 'node:stream';
import { cookies } from 'next/headers';
import { cheminDeLaPreuve } from '../../../../lib/recette';

export const dynamic = 'force-dynamic';

const TYPES: Record<string, string> = { webm: 'video/webm', mp4: 'video/mp4' };
const CONSOLE = ['ADMIN', 'DISPATCHER', 'COMPTABLE', 'SUPER_ADMIN'];

/**
 * Sert un enregistrement de recette au lecteur de la page `/docs`.
 *
 * Deux précautions. Le chemin n'est JAMAIS composé à partir de la requête : il est
 * cherché dans l'inventaire construit côté serveur (`cheminDeLaPreuve`), ce qui exclut
 * par construction toute remontée d'arborescence. Et la route est fermée aux rôles hors
 * console — ces vidéos montrent des écrans d'exploitation avec des données réelles.
 */
export async function GET(req: Request): Promise<Response> {
  const jar = cookies();
  if (!jar.get('token')?.value || !CONSOLE.includes(jar.get('role')?.value || '')) {
    return new Response('Accès refusé.', { status: 403 });
  }

  const url = new URL(req.url);
  const run = url.searchParams.get('run') || '';
  const fichier = url.searchParams.get('f') || '';
  const chemin = run && fichier ? cheminDeLaPreuve(run, fichier) : null;
  if (!chemin) return new Response('Preuve introuvable.', { status: 404 });

  let taille: number;
  try { taille = fs.statSync(chemin).size; } catch { return new Response('Preuve introuvable.', { status: 404 }); }
  const type = TYPES[(/\.(\w+)$/.exec(fichier)?.[1] || '').toLowerCase()] ?? 'application/octet-stream';

  // Le lecteur vidéo demande des plages : sans 206, on ne peut pas se déplacer dans
  // l'enregistrement, et certains navigateurs refusent même de le démarrer.
  const plage = req.headers.get('range');
  const m = plage ? /^bytes=(\d*)-(\d*)$/.exec(plage) : null;
  if (m) {
    const debut = m[1] ? Number(m[1]) : 0;
    const fin = m[2] ? Math.min(Number(m[2]), taille - 1) : taille - 1;
    if (!Number.isFinite(debut) || debut > fin || debut >= taille) {
      return new Response(null, { status: 416, headers: { 'content-range': `bytes */${taille}` } });
    }
    const flux = Readable.toWeb(fs.createReadStream(chemin, { start: debut, end: fin })) as unknown as ReadableStream;
    return new Response(flux, {
      status: 206,
      headers: {
        'content-type': type,
        'content-length': String(fin - debut + 1),
        'content-range': `bytes ${debut}-${fin}/${taille}`,
        'accept-ranges': 'bytes',
        'cache-control': 'private, max-age=0, must-revalidate',
      },
    });
  }

  const flux = Readable.toWeb(fs.createReadStream(chemin)) as unknown as ReadableStream;
  return new Response(flux, {
    headers: {
      'content-type': type,
      'content-length': String(taille),
      'accept-ranges': 'bytes',
      'cache-control': 'private, max-age=0, must-revalidate',
    },
  });
}
