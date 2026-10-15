// Lecture d'un lien de localisation (Google Maps, Plans, Waze, OpenStreetMap…) ou de
// coordonnées brutes → { lat, lng }. Fonctions PURES : aucune entrée/sortie réseau ici
// (le suivi des liens courts vit dans `resolution-lien.ts`).
//
// Pourquoi : au Maroc, le client final envoie sa position par WhatsApp — un lien, rarement
// une adresse exploitable. Le marchand le colle tel quel dans l'assistant de création ;
// on en tire l'épingle, et on GARDE le lien pour le livreur.
//
// Ordre de préférence quand un lien porte plusieurs positions :
//   1. `!3dLAT!4dLNG` (Google) — la position du LIEU désigné, la plus précise ;
//   2. un point explicite : `?q=`, `?query=`, `?ll=`, `?mlat=&mlon=`, `/maps/search/lat,lng`… ;
//   3. le cadrage de la vue : `@lat,lng,17z` (Google), `#map=z/lat/lng` (OSM) — c'est le
//      centre de l'écran de celui qui a partagé, pas forcément l'endroit.
import { isLatitude, isLongitude, type LatLng } from '@transpo/domain';

export type SourceLien = 'google' | 'apple' | 'waze' | 'osm' | 'coordonnees' | 'autre';
/** exacte = lieu désigné ; point = point explicite ; vue = centre de la carte partagée. */
export type PrecisionLien = 'exacte' | 'point' | 'vue';

export interface CoordonneesLien extends LatLng {
  precision: PrecisionLien;
  source: SourceLien;
}

const NOMBRE = String.raw`[-+]?\d{1,3}(?:\.\d+)?`;
const DECIMAL = String.raw`[-+]?\d{1,3}\.\d+`;

/** Paire validée (bornes WGS84), `null` sinon. Arrondie à 7 décimales (~1 cm). */
export function paire(lat: unknown, lng: unknown): LatLng | null {
  const la = typeof lat === 'string' ? Number(lat) : lat;
  const lo = typeof lng === 'string' ? Number(lng) : lng;
  if (!isLatitude(la) || !isLongitude(lo)) return null;
  // (0, 0) est en plein golfe de Guinée : c'est toujours une valeur par défaut, jamais
  // une adresse de livraison.
  if (la === 0 && lo === 0) return null;
  const r = (n: number) => Math.round(n * 1e7) / 1e7;
  return { lat: r(la), lng: r(lo) };
}

/** Degrés-minutes-secondes : 33°34'23.2"N 7°35'23.3"W (format « copier » de Google). */
const DMS = new RegExp(
  String.raw`(\d{1,2})°\s*(\d{1,2})['′]\s*(\d{1,2}(?:\.\d+)?)["″]?\s*([NS])[\s,+]*(\d{1,3})°\s*(\d{1,2})['′]\s*(\d{1,2}(?:\.\d+)?)["″]?\s*([EW])`,
  'i',
);
function dms(texte: string): LatLng | null {
  const m = DMS.exec(texte);
  if (!m) return null;
  const v = (d: string, mi: string, s: string, h: string) =>
    (Number(d) + Number(mi) / 60 + Number(s) / 3600) * (/[SW]/i.test(h) ? -1 : 1);
  return paire(v(m[1], m[2], m[3], m[4]), v(m[5], m[6], m[7], m[8]));
}

/**
 * Coordonnées saisies telles quelles : « 33.5731, -7.5898 », « 33.5731 -7.5898 »,
 * « geo:33.5731,-7.5898 », ou en degrés-minutes-secondes. La chaîne entière doit être une
 * position : un nombre perdu dans une phrase n'en est pas une.
 */
export function coordonneesBrutes(texte: string): LatLng | null {
  const t = texte.trim().replace(/^geo:/i, '').replace(/\?.*$/, '');
  const m = new RegExp(String.raw`^(${DECIMAL})\s*[,;\s]\s*(${DECIMAL})$`).exec(t);
  if (m) return paire(m[1], m[2]);
  if (/^[\d°'′"″.\sNSEW,+]+$/i.test(t)) return dms(t);
  return null;
}

/**
 * Premier lien http(s) d'un texte. Un message WhatsApp transféré porte souvent du texte
 * autour : « 📍 Ma position : https://maps.app.goo.gl/AbC123 ».
 */
export function extraireUrl(texte: string): URL | null {
  // L'apostrophe reste dans le lien : Google l'emploie en clair dans les positions en
  // degrés-minutes-secondes (/maps/place/33°34'23.2"N…).
  const m = /https?:\/\/[^\s<>"`]+/i.exec(texte);
  const brut = m ? m[0].replace(/[).,;!?»]+$/, '') : null;
  if (!brut) return null;
  try {
    return new URL(brut);
  } catch {
    return null;
  }
}

/** Famille du lien, d'après l'hôte. */
export function sourceDeHote(hote: string): SourceLien {
  const h = hote.toLowerCase();
  if (h === 'goo.gl' || h === 'maps.app.goo.gl' || h === 'g.co' || /(^|\.)google\.[a-z.]{2,7}$/.test(h)) return 'google';
  if (h === 'maps.apple.com' || h === 'maps.apple') return 'apple';
  if (h === 'waze.com' || h.endsWith('.waze.com')) return 'waze';
  if (h === 'openstreetmap.org' || h.endsWith('.openstreetmap.org') || h === 'osm.org') return 'osm';
  return 'autre';
}

function decoder(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s.replace(/\+/g, ' ');
  }
}

/**
 * « lat,lng » en tête d'une valeur de paramètre, avec les préfixes rencontrés :
 * `loc:` (Google), `ll.` (Waze `to=ll.33.5,-7.6`). Un libellé peut suivre :
 * « 33.5731,-7.5898 (Twin Center) ».
 */
function paireEnTete(valeur: string): LatLng | null {
  const v = decoder(valeur).trim().replace(/^(loc:|ll\.)/i, '').trim();
  const m = new RegExp(String.raw`^(${NOMBRE})\s*,\s*(${NOMBRE})(?![\d.])`).exec(v);
  if (m && (m[1].includes('.') || m[2].includes('.'))) return paire(m[1], m[2]);
  return dms(v);
}

/** Paramètres portant un POINT, par ordre de préférence. */
const PARAMS_POINT = ['q', 'query', 'destination', 'daddr', 'll', 'sll', 'coordinate', 'latlng', 'to', 'center'];

/** Coordonnées portées par une URL de carte, `null` si elle n'en contient aucune. */
export function analyserUrl(url: URL): CoordonneesLien | null {
  const source = sourceDeHote(url.hostname);
  const href = url.href;

  // Page de consentement Google (serveurs européens) : la vraie adresse est en `continue`.
  if (url.hostname.toLowerCase() === 'consent.google.com') {
    const suite = url.searchParams.get('continue');
    if (suite) {
      try { return analyserUrl(new URL(suite)); } catch { return null; }
    }
    return null;
  }

  // 1. Lieu désigné (Google) : `!3dLAT!4dLNG`. Le DERNIER couple est celui du lieu ; les
  //    précédents, quand il y en a, décrivent la vue ou un trajet.
  const exacts = [...decoder(href).matchAll(new RegExp(String.raw`!3d(${DECIMAL})!4d(${DECIMAL})`, 'g'))];
  for (const m of exacts.reverse()) {
    const p = paire(m[1], m[2]);
    if (p) return { ...p, precision: 'exacte', source };
  }

  const qs = url.searchParams;
  // 2a. OpenStreetMap : marqueur explicite.
  if (qs.has('mlat') && qs.has('mlon')) {
    const p = paire(qs.get('mlat'), qs.get('mlon'));
    if (p) return { ...p, precision: 'point', source };
  }
  // 2b. Paramètres « lat,lng ».
  for (const cle of PARAMS_POINT) {
    const v = qs.get(cle);
    if (!v) continue;
    const p = paireEnTete(v);
    if (p) return { ...p, precision: cle === 'center' ? 'vue' : 'point', source };
  }
  // 2c. Paires séparées : `?lat=..&lng=..` / `&lon=..`.
  if (qs.has('lat') && (qs.has('lng') || qs.has('lon'))) {
    const p = paire(qs.get('lat'), qs.get('lng') ?? qs.get('lon'));
    if (p) return { ...p, precision: 'point', source };
  }
  // 2d. Chemin Google : /maps/search/33.57,+-7.58 · /maps/place/33.57,-7.58 ·
  //     /maps/dir/<départ>/<arrivée> (on retient l'ARRIVÉE, dernier segment).
  const segments = url.pathname.split('/').filter(Boolean).map(decoder);
  for (const seg of [...segments].reverse()) {
    if (seg.startsWith('@') || seg.startsWith('data=')) continue;
    const p = paireEnTete(seg.replace(/\s+/g, ''));
    if (p) return { ...p, precision: 'point', source };
    const d = dms(seg);
    if (d) return { ...d, precision: 'point', source };
  }

  // 3a. Vue Google : `@lat,lng,17z`.
  const vue = new RegExp(String.raw`@(${DECIMAL}),(${DECIMAL})`).exec(decoder(url.pathname));
  if (vue) {
    const p = paire(vue[1], vue[2]);
    if (p) return { ...p, precision: 'vue', source };
  }
  // 3b. Vue OpenStreetMap : `#map=17/33.5731/-7.5898`.
  const osm = new RegExp(String.raw`map=\d{1,2}/(${DECIMAL})/(${DECIMAL})`).exec(url.hash);
  if (osm) {
    const p = paire(osm[1], osm[2]);
    if (p) return { ...p, precision: 'vue', source };
  }
  return null;
}

/**
 * Point d'entrée « hors ligne » : coordonnées brutes, lien de carte, ou message contenant
 * un lien. `null` quand rien n'est lisible SANS réseau — c'est le cas des liens courts
 * (maps.app.goo.gl, goo.gl/maps…), que seul le résolveur peut suivre.
 */
export function analyserLien(texte: string): CoordonneesLien | null {
  const brut = coordonneesBrutes(texte);
  if (brut) return { ...brut, precision: 'exacte', source: 'coordonnees' };
  const url = extraireUrl(texte);
  if (url) return analyserUrl(url);
  // Message sans lien mais avec une position en clair (« je suis à 33.5731, -7.5898 »).
  const enClair = new RegExp(String.raw`(${DECIMAL})\s*,\s*(${DECIMAL})`).exec(texte);
  if (enClair) {
    const p = paire(enClair[1], enClair[2]);
    if (p) return { ...p, precision: 'exacte', source: 'coordonnees' };
  }
  const d = dms(texte);
  return d ? { ...d, precision: 'exacte', source: 'coordonnees' } : null;
}

/**
 * Requête textuelle portée par un lien sans coordonnées (`?q=Twin+Center`,
 * `?address=…` de Plans) : de quoi géocoder en dernier recours.
 */
export function requeteTextuelle(url: URL): string | null {
  for (const cle of ['q', 'query', 'address', 'daddr', 'destination']) {
    const v = url.searchParams.get(cle)?.trim();
    if (v && /[a-zà-ÿ؀-ۿ]/i.test(v)) return v.slice(0, 300);
  }
  // /maps/place/Twin+Center/… : le nom du lieu.
  const m = /\/maps\/(?:place|search)\/([^/@]+)/.exec(url.pathname);
  if (m) {
    const v = decoder(m[1]).trim();
    if (/[a-zà-ÿ؀-ۿ]/i.test(v)) return v.slice(0, 300);
  }
  return null;
}

/* ---------------------------------------------------------------------------------
 * Liste blanche des hôtes que le résolveur a le droit de CONTACTER (anti-SSRF).
 * Toute autre destination — y compris au détour d'une redirection — est refusée :
 * l'API ne doit jamais devenir un relais vers le réseau interne (métadonnées cloud,
 * base, services voisins) ni vers un site arbitraire.
 * ------------------------------------------------------------------------------- */
const HOTES_EXACTS = new Set([
  'maps.app.goo.gl', 'g.co',
  'maps.apple.com', 'maps.apple',
  'waze.com', 'www.waze.com', 'ul.waze.com',
  'openstreetmap.org', 'www.openstreetmap.org', 'osm.org',
]);
/** google.com, google.co.ma, google.fr, google.com.br… (domaines nationaux de Google). */
const GOOGLE = /^(?:(www|maps)\.)?google\.(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})$/;

export function hoteAutorise(url: URL): boolean {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== '80' && url.port !== '443') return false;
  const h = url.hostname.toLowerCase();
  if (HOTES_EXACTS.has(h)) return true;
  // goo.gl est l'ancien raccourcisseur générique de Google : seuls ses liens /maps passent.
  if (h === 'goo.gl') return url.pathname.startsWith('/maps');
  const g = GOOGLE.exec(h);
  if (g) return g[1] === 'maps' || url.pathname === '/maps' || url.pathname.startsWith('/maps/');
  return false;
}

/**
 * Coordonnées trouvées dans le HTML d'une page de carte, quand l'URL finale n'en porte
 * pas (lien court Google qui aboutit sur `?q=Nom+du+lieu&ftid=…`, page lieu Plans…).
 * Motifs, du plus sûr au moins sûr.
 */
export function coordonneesDansPage(html: string): CoordonneesLien | null {
  const motifs: [RegExp, PrecisionLien][] = [
    // Lieu Google.
    [new RegExp(String.raw`!3d(${DECIMAL})!4d(${DECIMAL})`), 'exacte'],
    // Métadonnées Open Graph « place » (Plans, d'autres) : latitude puis longitude.
    [new RegExp(String.raw`place:location:latitude"\s+content="(${DECIMAL})"[\s\S]{0,200}?place:location:longitude"\s+content="(${DECIMAL})"`), 'point'],
    // JSON-LD / JSON : "latitude": 33.5, "longitude": -7.5.
    [new RegExp(String.raw`"latitude"\s*:\s*"?(${DECIMAL})"?\s*,\s*"longitude"\s*:\s*"?(${DECIMAL})`), 'point'],
    // NB : la vignette `staticmap?center=` et `APP_INITIALIZATION_STATE` de Google ne sont
    // PAS lues : pour une recherche textuelle, elles portent le cadrage par défaut (déduit de
    // l'IP du serveur), pas le lieu — vérifié sur pièce, « Mosquée Hassan II » y tombait à
    // Bouskoura. Mieux vaut géocoder le nom du lieu que d'inventer une position.
    [new RegExp(String.raw`[?&;]ll=(${DECIMAL})(?:%2C|,)(${DECIMAL})`, 'i'), 'point'],
    [new RegExp(String.raw`@(${DECIMAL}),(${DECIMAL}),\d+(?:\.\d+)?z`), 'vue'],
  ];
  for (const [re, precision] of motifs) {
    const m = re.exec(html);
    if (!m) continue;
    const p = paire(m[1], m[2]);
    if (p) return { ...p, precision, source: 'autre' };
  }
  return null;
}
