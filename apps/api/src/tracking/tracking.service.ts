import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { withTenantDb, driverPositions, geofences } from '@transpo/db';
import { desc, eq } from 'drizzle-orm';
import { haversineMeters } from '@transpo/domain';

@Injectable()
export class TrackingService {
  /** Ingestion d'une position (le livreur ne pousse que la sienne). */
  async ingest(schema: string, driver: string | undefined, lat: number, lng: number) {
    if (!driver) throw new ForbiddenException('Compte non rattaché à un livreur.');
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new BadRequestException('lat/lng invalides.');
    return withTenantDb(schema, async (db) => {
      const [r] = await db.insert(driverPositions).values({ driver, lat, lng }).returning();
      return { ok: true, at: r.at instanceof Date ? r.at.toISOString() : r.at };
    });
  }

  async createGeofence(schema: string, g: { driver: string; name: string; centerLat: number; centerLng: number; radiusM?: number }) {
    if (!g?.driver || !g?.name) throw new BadRequestException('driver et name requis.');
    if (!Number.isFinite(g.centerLat) || !Number.isFinite(g.centerLng)) throw new BadRequestException('centre invalide.');
    return withTenantDb(schema, async (db) => {
      const [r] = await db.insert(geofences).values({
        driver: g.driver, name: g.name, centerLat: g.centerLat, centerLng: g.centerLng, radiusM: g.radiusM ?? 5000,
      }).returning();
      return r;
    });
  }

  /** Snapshot live : dernière position par livreur + statut géofence. */
  async live(schema: string) {
    return withTenantDb(schema, async (db) => {
      const positions = await db.select().from(driverPositions).orderBy(desc(driverPositions.at));
      const fences = await db.select().from(geofences);
      const latest = new Map<string, typeof positions[number]>();
      for (const p of positions) if (!latest.has(p.driver)) latest.set(p.driver, p); // 1re = plus récente
      return [...latest.values()].map((p) => {
        const f = fences.find((x) => x.driver === p.driver);
        let outOfZone = false, distanceM: number | null = null, zone: string | null = null;
        if (f) {
          zone = f.name;
          distanceM = haversineMeters(p.lat, p.lng, f.centerLat, f.centerLng);
          outOfZone = distanceM > f.radiusM;
        }
        return {
          driver: p.driver, lat: p.lat, lng: p.lng,
          at: p.at instanceof Date ? p.at.toISOString() : p.at,
          zone, distanceM, outOfZone,
        };
      });
    });
  }

  /** Alertes : livreurs actuellement hors de leur zone. */
  async alerts(schema: string) {
    const snap = await this.live(schema);
    return snap.filter((s) => s.outOfZone);
  }
}
