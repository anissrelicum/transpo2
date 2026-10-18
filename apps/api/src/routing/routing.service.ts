import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { haversineMeters } from '@transpo/domain';

/** Itinéraire par les rues : tracé, distance et durée totales, et le détail par tronçon. */
export interface Itineraire {
  /** `osrm` = routes réelles ; `estimation` = moteur indisponible, lignes droites estimées. */
  source: 'osrm' | 'estimation';
  distanceM: number;
  durationS: number;
  /** Tracé `[lat, lng]`. */
  geometry: [number, number][];
  /** Un tronçon par paire de points consécutifs. */
  legs: { distanceM: number; durationS: number }[];
}

type Point = { lat: number; lng: number };

const OSRM_URL = process.env.OSRM_URL ?? 'http://osrm:5000';
// OSRM donne des durées « route libre » : la ville réelle est plus lente (feux, trafic,
// stationnement). Facteur réglable, appliqué à toutes les durées.
const FACTEUR_DUREE = Number(process.env.ROUTING_DURATION_FACTOR ?? 1.25);
const MAX_POINTS = 60;
const CACHE_MAX = 800;
const CACHE_MS = 10 * 60_000;

/**
 * Calcul d'itinéraire (ADR 0007) : moteur OSRM auto-hébergé, carte OpenStreetMap.
 * Le résultat est mis en cache 10 min par suite de points (arrondis à ~10 m) : une app qui
 * relit sa tournée ne refait pas le calcul. Si le moteur ne répond pas, on rend une
 * estimation (vol d'oiseau × 1,3 à 25 km/h) marquée comme telle, jamais une erreur :
 * l'écran du livreur doit toujours afficher quelque chose.
 */
@Injectable()
export class RoutingService {
  private readonly log = new Logger('Routing');
  private readonly cache = new Map<string, { at: number; v: Itineraire }>();

  /** Lit `lat,lng;lat,lng;…`. */
  static lirePoints(s: string | undefined): Point[] {
    const pts = (s ?? '').split(';').filter(Boolean).map((p) => {
      const [lat, lng] = p.split(',').map(Number);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat!) > 90 || Math.abs(lng!) > 180) {
        throw new BadRequestException(`Point invalide : ${p}`);
      }
      return { lat: lat!, lng: lng! };
    });
    if (pts.length < 2) throw new BadRequestException('Au moins deux points.');
    if (pts.length > MAX_POINTS) throw new BadRequestException(`Au plus ${MAX_POINTS} points.`);
    return pts;
  }

  async route(points: Point[]): Promise<Itineraire> {
    const cle = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(';');
    const c = this.cache.get(cle);
    if (c && Date.now() - c.at < CACHE_MS) return c.v;
    let v: Itineraire;
    try {
      v = await this.osrm(points);
    } catch (e) {
      this.log.warn(`moteur indisponible, estimation : ${(e as Error).message}`);
      return estimation(points); // non mis en cache : on retentera le moteur au prochain appel
    }
    if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(cle, { at: Date.now(), v });
    return v;
  }

  private async osrm(points: Point[]): Promise<Itineraire> {
    const coords = points.map((p) => `${p.lng},${p.lat}`).join(';');
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    try {
      const r = await fetch(`${OSRM_URL}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`, { signal: ctrl.signal });
      const d = (await r.json()) as any;
      if (!r.ok || d.code !== 'Ok' || !d.routes?.[0]) throw new Error(d?.message ?? `HTTP ${r.status}`);
      const route = d.routes[0];
      return {
        source: 'osrm',
        distanceM: Math.round(route.distance),
        durationS: Math.round(route.duration * FACTEUR_DUREE),
        geometry: route.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]),
        legs: route.legs.map((l: any) => ({ distanceM: Math.round(l.distance), durationS: Math.round(l.duration * FACTEUR_DUREE) })),
      };
    } finally {
      clearTimeout(t);
    }
  }
}

/** Repli sans moteur : lignes droites, distances majorées des détours, 25 km/h. */
export function estimation(points: Point[]): Itineraire {
  const legs = points.slice(1).map((p, i) => {
    const d = haversineMeters(points[i]!.lat, points[i]!.lng, p.lat, p.lng) * 1.3;
    return { distanceM: Math.round(d), durationS: Math.round((d / 1000 / 25) * 3600) };
  });
  return {
    source: 'estimation',
    distanceM: legs.reduce((s, l) => s + l.distanceM, 0),
    durationS: legs.reduce((s, l) => s + l.durationS, 0),
    geometry: points.map((p) => [p.lat, p.lng]),
    legs,
  };
}
