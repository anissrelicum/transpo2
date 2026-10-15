// Résolution d'un lien de localisation, réseau compris : suit les liens courts
// (maps.app.goo.gl, goo.gl/maps, ul.waze.com…) jusqu'à l'URL qui porte les coordonnées.
//
// SÉCURITÉ (SSRF) — l'API va chercher une URL fournie par l'utilisateur. Garde-fous :
//   - liste blanche d'hôtes (`hoteAutorise`), vérifiée AVANT chaque requête, redirections
//     comprises : un lien court ne peut pas rebondir vers le réseau interne ni ailleurs ;
//   - http/https seulement, ports standards, pas d'identifiants dans l'URL ;
//   - redirections suivies À LA MAIN (`redirect: 'manual'`), 5 au plus ;
//   - 5 s en tout (une seule échéance pour toute la chaîne) ;
//   - 512 Kio lus au plus sur la page finale, le reste est abandonné.
// Cf. docs/adr/0002-localisation-par-lien.md.
import { shareableMapUrl, type LatLng } from '@transpo/domain';
import {
  analyserLien, analyserUrl, coordonneesDansPage, extraireUrl, hoteAutorise, requeteTextuelle,
  sourceDeHote, type PrecisionLien, type SourceLien,
} from './lien-carte.js';

export type CodeErreurLien =
  | 'LIEN_VIDE'          // rien à lire
  | 'LIEN_NON_RECONNU'   // ni coordonnées ni lien de carte
  | 'HOTE_REFUSE'        // lien (ou redirection) hors liste blanche
  | 'LIEN_EXPIRE'        // le service répond 404/410 : lien court périmé ou supprimé
  | 'INJOIGNABLE'        // réseau, délai, trop de redirections, 5xx
  | 'SANS_COORDONNEES';  // la page a répondu mais ne livre aucune position

export class ErreurLienCarte extends Error {
  constructor(readonly code: CodeErreurLien, message: string) {
    super(message);
  }
}

export interface ResolutionLien extends LatLng {
  /** Le lien tel qu'il a été collé (celui qu'on transmet au livreur). */
  url: string;
  source: SourceLien;
  precision: PrecisionLien;
  /** Comment la position a été obtenue. */
  via: 'texte' | 'lien' | 'redirection' | 'page' | 'geocodage';
}

export interface OptionsResolution {
  fetch?: typeof fetch;
  timeoutMs?: number;
  maxRedirections?: number;
  maxOctets?: number;
  userAgent?: string;
  /** Géocodage d'une requête textuelle, dernier recours (lien « ?q=Twin+Center »). */
  geocoder?: (requete: string) => Promise<LatLng | null>;
}

export const LONGUEUR_MAX_TEXTE = 4096;

/** Lit au plus `max` octets du corps, puis abandonne le flux. */
async function lireBorne(res: Response, max: number): Promise<string> {
  if (!res.body) return '';
  const lecteur = res.body.getReader();
  const morceaux: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < max) {
      const { done, value } = await lecteur.read();
      if (done || !value) break;
      morceaux.push(value);
      total += value.byteLength;
    }
  } finally {
    await lecteur.cancel().catch(() => undefined);
  }
  const tout = new Uint8Array(Math.min(total, max));
  let i = 0;
  for (const m of morceaux) {
    const part = m.subarray(0, Math.max(0, tout.length - i));
    tout.set(part, i);
    i += part.length;
    if (i >= tout.length) break;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(tout);
}

export async function resoudreLien(texte: string, opts: OptionsResolution = {}): Promise<ResolutionLien> {
  const doFetch = opts.fetch ?? fetch;
  const maxRedir = opts.maxRedirections ?? 5;
  const maxOctets = opts.maxOctets ?? 512 * 1024;
  const t = (texte ?? '').trim();
  if (!t) throw new ErreurLienCarte('LIEN_VIDE', 'Collez un lien de localisation ou des coordonnées.');
  if (t.length > LONGUEUR_MAX_TEXTE) throw new ErreurLienCarte('LIEN_NON_RECONNU', 'Texte trop long pour un lien de localisation.');

  const original = extraireUrl(t);

  // 1. Lisible sans réseau : coordonnées brutes ou lien qui les porte déjà.
  const direct = analyserLien(t);
  if (direct) {
    // Le lien d'origine n'est conservé — et donc ouvert plus tard par le livreur — que
    // s'il pointe vers un service de carte connu. Des coordonnées lisibles dans un lien
    // quelconque restent exploitables, mais le livreur reçoit un lien Google Maps propre.
    const garde = original && hoteAutorise(original) ? original : null;
    return {
      lat: direct.lat, lng: direct.lng, precision: direct.precision,
      source: garde ? sourceDeHote(garde.hostname) : direct.source === 'coordonnees' ? 'coordonnees' : 'autre',
      url: garde?.href ?? shareableMapUrl(direct.lat, direct.lng),
      via: original ? 'lien' : 'texte',
    };
  }
  if (!original) throw new ErreurLienCarte('LIEN_NON_RECONNU', 'Aucun lien de carte ni coordonnées dans ce texte.');
  if (!hoteAutorise(original)) {
    throw new ErreurLienCarte('HOTE_REFUSE', `Lien non pris en charge (${original.hostname}) : Google Maps, Plans, Waze ou OpenStreetMap uniquement.`);
  }
  const resultat = (p: LatLng & { precision: PrecisionLien }, via: ResolutionLien['via']): ResolutionLien => ({
    lat: p.lat, lng: p.lng, precision: p.precision, via,
    source: sourceDeHote(original.hostname), url: original.href,
  });

  // Lien Plans sans coordonnées mais avec une adresse (`?address=`, `?q=`) : la page est
  // une application JavaScript qui n'en dira pas plus — on géocode directement. Pour
  // Google, la page (identifiant de lieu `ftid`) est plus fiable : on la lit d'abord.
  if (original.hostname.toLowerCase() === 'maps.apple.com' && opts.geocoder) {
    const q = requeteTextuelle(original);
    if (q) {
      const g = await opts.geocoder(q).catch(() => null);
      if (g) return resultat({ ...g, precision: 'point' }, 'geocodage');
    }
  }

  // 2. Suivi des redirections, une à une, sous liste blanche.
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 5000);
  let courant = original;
  for (let saut = 0; ; saut++) {
    let res: Response;
    try {
      res = await doFetch(courant.href, {
        method: 'GET',
        redirect: 'manual',
        signal,
        headers: {
          'user-agent': opts.userAgent ?? 'Mozilla/5.0 (compatible; PortrailBot/1.0)',
          'accept': 'text/html,application/xhtml+xml',
          'accept-language': 'fr-FR,fr;q=0.9',
          // Sans ce cookie, Google renvoie les serveurs européens vers consent.google.com.
          ...(sourceDeHote(courant.hostname) === 'google' ? { cookie: 'CONSENT=YES+cb; SOCS=CAI' } : {}),
        },
      });
    } catch {
      throw new ErreurLienCarte('INJOIGNABLE', 'Le service de carte ne répond pas (délai dépassé ou réseau indisponible).');
    }

    if (res.status >= 300 && res.status < 400) {
      await res.body?.cancel().catch(() => undefined);
      const loc = res.headers.get('location');
      if (!loc) throw new ErreurLienCarte('INJOIGNABLE', 'Redirection sans destination.');
      let suivant: URL;
      try { suivant = new URL(loc, courant); } catch { throw new ErreurLienCarte('INJOIGNABLE', 'Redirection invalide.'); }
      // Consentement Google (serveurs européens) : la vraie destination est en `continue`.
      if (suivant.hostname.toLowerCase() === 'consent.google.com') {
        const c = suivant.searchParams.get('continue');
        try { if (c) suivant = new URL(c); } catch { /* reste sur consent → refusé ci-dessous */ }
      }
      // Liste blanche AVANT toute lecture : une redirection hors liste arrête tout.
      if (!hoteAutorise(suivant)) {
        throw new ErreurLienCarte('HOTE_REFUSE', `Redirection refusée vers un hôte non autorisé (${suivant.hostname}).`);
      }
      // La destination porte souvent déjà la position : on s'arrête là, sans la contacter.
      const lu = analyserUrl(suivant);
      if (lu) return resultat(lu, 'redirection');
      if (saut + 1 > maxRedir) throw new ErreurLienCarte('INJOIGNABLE', 'Trop de redirections.');
      courant = suivant;
      continue;
    }

    if (res.status === 404 || res.status === 410) {
      await res.body?.cancel().catch(() => undefined);
      throw new ErreurLienCarte('LIEN_EXPIRE', 'Ce lien a expiré ou n’existe plus. Demandez au client de renvoyer sa position.');
    }
    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined);
      throw new ErreurLienCarte('INJOIGNABLE', `Le service de carte a répondu ${res.status}.`);
    }

    // 3. Page finale : l'URL d'abord, puis le contenu (borné).
    const lu = analyserUrl(courant);
    if (lu) { await res.body?.cancel().catch(() => undefined); return resultat(lu, saut ? 'redirection' : 'lien'); }
    let html: string;
    try { html = await lireBorne(res, maxOctets); } catch {
      throw new ErreurLienCarte('INJOIGNABLE', 'Lecture de la page de carte interrompue.');
    }
    const page = coordonneesDansPage(html);
    if (page) return resultat(page, 'page');
    // 4. Dernier recours : le nom du lieu, géocodé.
    const q = requeteTextuelle(courant);
    if (q && opts.geocoder) {
      const g = await opts.geocoder(q).catch(() => null);
      if (g) return resultat({ ...g, precision: 'point' }, 'geocodage');
    }
    throw new ErreurLienCarte('SANS_COORDONNEES', 'Le lien a bien été ouvert, mais il ne contient pas de position exploitable.');
  }
}
