// La journée du livreur : ses missions vues comme une suite d'ARRÊTS ordonnés.
//
// Une mission est un arrêt unique à un instant donné : le point de retrait tant que le
// colis n'est pas récupéré, le point de livraison ensuite. L'ordre suit, dans cet ordre :
//  1. la tournée planifiée par l'exploitation (`getMyTour()`), qui fait foi ;
//  2. sinon le plus proche voisin depuis la position du livreur, sur les VRAIES
//     coordonnées des commandes (migration 0027). Les points saisis en texte seul,
//     sans coordonnées, passent en fin de liste : on ne leur invente pas de position.
import type { Order, OrderStatus } from '@transpo/domain';

export type LatLng = { lat: number; lng: number };

export type TypeArret = 'retrait' | 'livraison';

export interface Arret {
  /** Première commande de l'arrêt (celle qui le désigne dans les routes). */
  order: Order;
  /**
   * Toutes les commandes servies à cet arrêt. Un marchand qui confie quatre colis est UN
   * retrait, pas quatre arrêts superposés au même endroit.
   */
  commandes: Order[];
  type: TypeArret;
  /** Absent quand le point n'a été saisi qu'en texte. */
  pos: LatLng | null;
  adresse: string;
  contact: string | null;
  telephone: string | null;
  consigne: string | null;
  lienCarte: string | null;
  /**
   * Échéance la plus proche de l'arrêt (ADR 0006) : au retrait, le retrait limite ou la
   * livraison limite ; à la livraison, la livraison limite. `null` = sans contrainte.
   */
  echeance: string | null;
}

/** Échéance pertinente d'une commande pour l'arrêt où elle se trouve. */
export function echeanceDe(o: Order, type: TypeArret): string | null {
  const candidats = type === 'retrait' ? [o.pickupDueAt, o.dueAt] : [o.dueAt];
  const t = candidats.filter((d): d is string => !!d).map((d) => new Date(d).getTime());
  return t.length ? new Date(Math.min(...t)).toISOString() : null;
}

/** Une échéance dans l'heure fait passer l'arrêt devant le reste de la tournée. */
export const URGENT_MS = 60 * 60_000;
export function estUrgent(a: Arret, now = Date.now()): boolean {
  return !!a.echeance && new Date(a.echeance).getTime() - now <= URGENT_MS;
}

/** Statuts qui ne représentent plus un arrêt à visiter. */
export const TERMINAUX: OrderStatus[] = ['LIVREE', 'ANNULEE', 'ECHOUEE', 'RETOUR'];

const AVANT_RETRAIT: OrderStatus[] = ['PROGRAMMEE', 'NOUVELLE', 'ASSIGNEE', 'RETRAIT'];

export function arretDe(o: Order): Arret {
  const retrait = AVANT_RETRAIT.includes(o.status);
  if (retrait) {
    return {
      order: o, commandes: [o], type: 'retrait',
      pos: o.pickupLat != null && o.pickupLng != null ? { lat: o.pickupLat, lng: o.pickupLng } : null,
      adresse: [o.pickupAddress, o.fromCity].filter(Boolean).join(', '),
      contact: o.pickupContact || o.merchant || null,
      // Le téléphone du point de retrait est celui du marchand : il peut être appelé.
      telephone: o.pickupPhone || null,
      consigne: o.pickupNotes || null,
      lienCarte: o.pickupMapUrl || null,
      echeance: echeanceDe(o, 'retrait'),
    };
  }
  return {
    order: o, commandes: [o], type: 'livraison',
    pos: o.dropLat != null && o.dropLng != null ? { lat: o.dropLat, lng: o.dropLng } : null,
    adresse: [o.dropAddress, o.toCity].filter(Boolean).join(', '),
    contact: o.dropContact || null,
    // Le numéro du destinataire n'est jamais transmis à l'app (règle de confidentialité).
    telephone: null,
    consigne: o.dropNotes || null,
    lienCarte: o.dropMapUrl || null,
    echeance: echeanceDe(o, 'livraison'),
  };
}

/** Distance à vol d'oiseau en km (Haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/**
 * Temps de trajet estimé en minutes. Vol d'oiseau majoré de 30 % (détours urbains) à
 * 22 km/h de moyenne en ville — une estimation, affichée comme telle (« ~ »).
 */
export function minutesEstimees(km: number): number {
  return Math.max(1, Math.round(((km * 1.3) / 22) * 60));
}

/** Rayon dans lequel le livreur est considéré arrivé à l'arrêt. */
export const RAYON_ARRIVEE_M = 120;

export function estArrive(moi: LatLng | null, arret: Arret): boolean {
  if (!moi || !arret.pos) return false;
  return distanceKm(moi, arret.pos) * 1000 <= RAYON_ARRIVEE_M;
}

/** Deux points distants de moins de 40 m sont le même lieu (même porte, même immeuble). */
const MEME_LIEU_M = 40;

function memeLieu(a: Arret, b: Arret): boolean {
  if (a.type !== b.type) return false;
  if (a.pos && b.pos) return distanceKm(a.pos, b.pos) * 1000 <= MEME_LIEU_M;
  return !a.pos && !b.pos && !!a.adresse && a.adresse === b.adresse;
}

/**
 * Regroupe les RETRAITS d'un même lieu en un seul arrêt. Les livraisons restent séparées :
 * deux clients d'un même immeuble ont chacun leur preuve et leur encaissement.
 */
export function grouper(arrets: Arret[]): Arret[] {
  const out: Arret[] = [];
  for (const a of arrets) {
    const g = a.type === 'retrait' ? out.find((x) => memeLieu(x, a)) : undefined;
    if (g) {
      g.commandes.push(a.order);
      // L'arrêt groupé hérite de l'échéance la plus proche de ses colis.
      if (a.echeance && (!g.echeance || a.echeance < g.echeance)) g.echeance = a.echeance;
    } else out.push({ ...a, commandes: [a.order] });
  }
  return out;
}

/** Plus proche voisin, depuis `depart` (ou le premier arrêt localisé à défaut). */
function plusProcheVoisin(depart: LatLng | null, arrets: Arret[]): Arret[] {
  const reste = arrets.slice();
  const out: Arret[] = [];
  let cur = depart ?? reste[0]?.pos ?? null;
  while (reste.length) {
    let best = 0;
    let bestD = Infinity;
    reste.forEach((a, i) => {
      const d = cur && a.pos ? distanceKm(cur, a.pos) : Infinity;
      if (d < bestD) { bestD = d; best = i; }
    });
    const [next] = reste.splice(best, 1);
    out.push(next!);
    if (next!.pos) cur = next!.pos;
  }
  return out;
}

/**
 * Arrêts de la journée, dans l'ordre à suivre. `ordreManuel` : ordre choisi par le
 * livreur dans l'onglet Tournée ; il l'emporte sur le calcul, pas sur la tournée planifiée.
 */
export function ordonnerArrets(
  missions: Order[],
  opts: { tournee: string[] | null; ordreManuel: string[] | null; moi: LatLng | null; now?: number },
): Arret[] {
  const arrets = grouper(missions.filter((o) => !TERMINAUX.includes(o.status)).map(arretDe));
  // Rang d'un arrêt dans un ordre donné : celui de la première de ses commandes qui y figure.
  const rang = (a: Arret, refs: string[]) => {
    const r = a.commandes.map((o) => refs.indexOf(o.ref)).filter((i) => i >= 0);
    return r.length ? Math.min(...r) : Infinity;
  };
  const parRef = (refs: string[]) => {
    const pris = arrets.filter((a) => rang(a, refs) < Infinity).sort((x, y) => rang(x, refs) - rang(y, refs));
    return [...pris, ...arrets.filter((a) => rang(a, refs) === Infinity)];
  };
  if (opts.tournee && opts.tournee.length) return parRef(opts.tournee);
  if (opts.ordreManuel && opts.ordreManuel.length) {
    // Les nouvelles missions (absentes de l'ordre manuel) s'insèrent par calcul à la suite.
    const connus = parRef(opts.ordreManuel).filter((a) => rang(a, opts.ordreManuel!) < Infinity);
    const nouveaux = arrets.filter((a) => rang(a, opts.ordreManuel!) === Infinity);
    return [...connus, ...plusProcheVoisin(connus[connus.length - 1]?.pos ?? opts.moi, nouveaux)];
  }
  // Ordre calculé : les échéances dans l'heure d'abord (la plus proche en tête), puis le
  // plus proche voisin depuis le dernier arrêt urgent. Un plat ne patiente pas derrière
  // les colis du jour.
  const now = opts.now ?? Date.now();
  const urgents = arrets.filter((a) => estUrgent(a, now)).sort((x, y) => x.echeance!.localeCompare(y.echeance!));
  const reste = arrets.filter((a) => !urgents.includes(a));
  const depart = [...urgents].reverse().find((a) => a.pos)?.pos ?? opts.moi;
  const localises = reste.filter((a) => a.pos);
  const sansPos = reste.filter((a) => !a.pos);
  return [...urgents, ...plusProcheVoisin(depart, localises), ...sansPos];
}

/** Distance totale (km) d'un trajet partant de `depart` et passant par les arrêts localisés. */
export function distanceTournee(depart: LatLng | null, arrets: Arret[]): number {
  let d = 0;
  let prev = depart;
  for (const a of arrets) {
    if (!a.pos) continue;
    if (prev) d += distanceKm(prev, a.pos);
    prev = a.pos;
  }
  return d;
}

/** Format court d'une distance : « 850 m », « 3,4 km ». */
export function formatDistance(km: number, lang: 'fr' | 'ar'): string {
  if (km < 1) return `${Math.round(km * 1000)} ${lang === 'ar' ? 'م' : 'm'}`;
  return `${km.toFixed(1).replace('.', ',')} ${lang === 'ar' ? 'كم' : 'km'}`;
}

/** Seuils du temps de conduite : au-dessus de 7 km/h on roule ; un trou de plus de 5 min
 *  entre deux points (app en arrière-plan, GPS perdu) n'est pas compté. */
export const VITESSE_CONDUITE_KMH = 7;
export const TROU_GPS_MAX_MS = 5 * 60_000;

/** Temps de conduite entre deux points GPS : l'écart de temps s'il y a eu déplacement, sinon 0. */
export function dureeEnMouvement(a: { lat: number; lng: number; at: number }, b: { lat: number; lng: number; at: number }): number {
  const dt = b.at - a.at;
  if (dt <= 0 || dt > TROU_GPS_MAX_MS) return 0;
  return distanceKm(a, b) / (dt / 3_600_000) >= VITESSE_CONDUITE_KMH ? dt : 0;
}
