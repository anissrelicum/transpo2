// Géocodage OpenStreetMap (Nominatim) — best-effort, jamais bloquant.
//
// Politique d'usage du service public (https://operations.osmfoundation.org/policies/nominatim/),
// respectée ici :
//   - User-Agent identifiant l'application (NOMINATIM_USER_AGENT) ;
//   - 1 requête par seconde au plus, pour toute l'instance d'API (file sérialisée) ;
//   - résultats mis en cache (pas de requête répétée pour le même point) ;
//   - aucun usage en masse : une requête par geste utilisateur (collage d'un lien).
// Hors de ces limites — ou pour de gros volumes — pointer NOMINATIM_URL vers une instance
// auto-hébergée. NOMINATIM_URL vide (`NOMINATIM_URL=`) désactive le géocodage.
import type { LatLng } from '@transpo/domain';

const BASE = (process.env.NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org').replace(/\/+$/, '');
const UA = process.env.NOMINATIM_USER_AGENT || 'Portrail/1.0 (livraison du dernier kilometre)';
const EMAIL = process.env.NOMINATIM_EMAIL || '';
const DELAI_MS = 3000;
const INTERVALLE_MS = 1000;
const CACHE_MAX = 500;

const cache = new Map<string, unknown>();
function mettreEnCache(cle: string, v: unknown) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(cle, v);
}

// File sérialisée : chaque appel attend que le précédent soit parti depuis ≥ 1 s.
let file: Promise<unknown> = Promise.resolve();
let dernier = 0;
function cadencer<T>(f: () => Promise<T>): Promise<T> {
  const suite = file.then(async () => {
    const attente = dernier + INTERVALLE_MS - Date.now();
    if (attente > 0) await new Promise((r) => setTimeout(r, attente));
    dernier = Date.now();
    return f();
  });
  file = suite.catch(() => undefined);
  return suite;
}

async function appeler(chemin: string, params: Record<string, string>): Promise<any> {
  if (!BASE) return null;
  const qs = new URLSearchParams({ format: 'jsonv2', ...params, ...(EMAIL ? { email: EMAIL } : {}) });
  const res = await cadencer(() => fetch(`${BASE}${chemin}?${qs}`, {
    headers: { 'user-agent': UA, 'accept-language': params['accept-language'] ?? 'fr' },
    signal: AbortSignal.timeout(DELAI_MS),
  }));
  if (!res.ok) return null;
  return res.json();
}

/** Adresse lisible d'un point, ou `null` (service indisponible, point en mer…). */
export async function adresseDe(lat: number, lng: number, langue: 'fr' | 'ar' = 'fr'): Promise<string | null> {
  const cle = `r:${langue}:${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (cache.has(cle)) return cache.get(cle) as string | null;
  try {
    const j = await appeler('/reverse', { lat: String(lat), lon: String(lng), zoom: '18', 'accept-language': langue });
    const a = j?.address ?? {};
    // Forme courte, utile au livreur : n° + rue, quartier, ville — plutôt que le
    // `display_name` complet (région, code postal, pays…).
    const rue = [a.house_number, a.road ?? a.pedestrian ?? a.footway].filter(Boolean).join(' ');
    const quartier = a.neighbourhood ?? a.suburb ?? a.quarter ?? a.city_district;
    const ville = a.city ?? a.town ?? a.village;
    const court = [rue, quartier, ville].filter(Boolean).join(', ');
    const adresse: string | null = court || (typeof j?.display_name === 'string' ? j.display_name : null);
    mettreEnCache(cle, adresse);
    return adresse;
  } catch {
    return null; // jamais d'échec pour l'appelant : l'adresse est un confort
  }
}

/** Position d'une requête textuelle (nom de lieu, adresse), ou `null`. */
export async function geocoder(requete: string): Promise<LatLng | null> {
  const cle = `s:${requete.toLowerCase()}`;
  if (cache.has(cle)) return cache.get(cle) as LatLng | null;
  try {
    const j = await appeler('/search', { q: requete, limit: '1' });
    const r = Array.isArray(j) ? j[0] : null;
    const p = r ? { lat: Number(r.lat), lng: Number(r.lon) } : null;
    const ok = p && Number.isFinite(p.lat) && Number.isFinite(p.lng) ? p : null;
    mettreEnCache(cle, ok);
    return ok;
  } catch {
    return null;
  }
}
