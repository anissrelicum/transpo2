// Itinéraires par les rues pour l'app livreur (ADR 0007) : le trajet vers le prochain arrêt
// et la suite de la journée, calculés par le moteur d'itinéraire de l'API.
//
// Deux requêtes plutôt qu'une : « position → prochain arrêt » change à chaque déplacement,
// « prochain arrêt → … → dernier » seulement quand la tournée change. La position est
// arrondie (~100 m) pour ne pas recalculer à chaque relevé GPS.
import * as React from 'react';
import type { Itineraire } from '@transpo/api-client';
import { authedClient } from './api';
import type { LatLng } from './journee';

const cache = new Map<string, Itineraire>();

function cle(points: LatLng[]): string {
  return points.map((p) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`).join(';');
}

/** Itinéraire par les points donnés ; `null` tant qu'il n'est pas connu (ou hors réseau). */
export function useItineraire(points: LatLng[] | null): Itineraire | null {
  const k = points && points.length >= 2 ? cle(points) : null;
  const [v, setV] = React.useState<Itineraire | null>(k ? cache.get(k) ?? null : null);
  React.useEffect(() => {
    if (!k || !points) { setV(null); return; }
    const deja = cache.get(k);
    if (deja) { setV(deja); return; }
    let vivant = true;
    authedClient().getRoute(points)
      .then((r) => { cache.set(k, r); if (vivant) setV(r); })
      .catch(() => { if (vivant) setV(null); }); // hors réseau : la carte garde les lignes droites
    return () => { vivant = false; };
    // `k` résume `points` (arrondis) : inutile de dépendre du tableau lui-même.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);
  return v;
}

/** « 12 min », « 1 h 05 ». */
export function formatDuree(s: number, lang: 'fr' | 'ar'): string {
  const min = Math.max(1, Math.round(s / 60));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (lang === 'ar') return h ? `${h} س ${m} د` : `${m} د`;
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}
