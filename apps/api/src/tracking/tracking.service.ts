import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { withTenantDb, driverPositions, geofences } from '@transpo/db';
import { haversineMeters, zoneStatus, pathLengthM, speedKmh } from '@transpo/domain';

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

  /**
   * Snapshot live du PC flotte : dernière position de chaque livreur, sa trace récente,
   * sa vitesse, sa situation vis-à-vis de SES zones dessinées (repli : géofence circulaire
   * historique), ce qu'il est en train de faire et ses chiffres du jour.
   *
   * L'ancienne version relisait TOUT l'historique des positions à chaque appel : avec dix
   * livreurs qui émettent toutes les 20 s, la table grossit de ~40 000 lignes par jour.
   * On ne lit plus que la dernière position (DISTINCT ON, index driver/at) et 15 minutes de
   * trace.
   */
  async live(schema: string) {
    return withTenantDb(schema, async (db, client) => {
      const tz = await this.fuseau(client);
      const { rows: dernieres } = await client.query(
        `SELECT DISTINCT ON (driver) driver, lat, lng, at FROM driver_positions ORDER BY driver, at DESC`,
      );
      const { rows: traces } = await client.query(
        `SELECT driver, lat, lng, at FROM driver_positions WHERE at > now() - interval '15 minutes' ORDER BY driver, at`,
      );
      const { rows: zones } = await client.query(`SELECT name_fr, polygon, drivers FROM zones`);
      const { rows: fiches } = await client.query(`SELECT name, vehicle, available FROM drivers`);
      const { rows: actives } = await client.query(
        `SELECT driver, status, count(*)::int AS n,
                count(*) FILTER (WHERE now() > LEAST(due_at, CASE WHEN picked_at IS NULL THEN pickup_due_at END))::int AS retards
           FROM orders
          WHERE driver IS NOT NULL AND status IN ('ASSIGNEE','RETRAIT','RECUPEREE','LIVRAISON')
          GROUP BY driver, status`,
      );
      const { rows: jour } = await client.query(
        `SELECT o.driver,
                count(*) FILTER (WHERE e.status = 'LIVREE')::int  AS livrees,
                count(*) FILTER (WHERE e.status = 'ECHOUEE')::int AS echecs,
                coalesce(sum(o.cod) FILTER (WHERE e.status = 'LIVREE' AND o.cod_paid), 0)::float AS cod
           FROM order_events e JOIN orders o ON o.ref = e.ref
          WHERE e.status IN ('LIVREE','ECHOUEE') AND e.at >= (date_trunc('day', now() AT TIME ZONE $1) AT TIME ZONE $1)
            AND o.driver IS NOT NULL
          GROUP BY o.driver`, [tz],
      );
      const fences = await db.select().from(geofences);
      const maintenant = Date.now();
      return dernieres.map((p: any) => {
        const point = { lat: p.lat, lng: p.lng };
        const sesZones = zones.filter((z: any) => (z.drivers ?? []).includes(p.driver))
          .map((z: any) => ({ nameFr: z.name_fr, polygon: Array.isArray(z.polygon) ? z.polygon : null }));
        let { zone, outOfZone, distanceM } = zoneStatus(point, sesZones);
        if (!sesZones.length) {
          const f = fences.find((x) => x.driver === p.driver);
          if (f) {
            zone = f.name;
            distanceM = haversineMeters(p.lat, p.lng, f.centerLat, f.centerLng);
            outOfZone = distanceM > f.radiusM;
          }
        }
        const trace = traces.filter((t: any) => t.driver === p.driver);
        const at = p.at instanceof Date ? p.at.toISOString() : p.at;
        const par = (st: string) => actives.find((a: any) => a.driver === p.driver && a.status === st)?.n ?? 0;
        const enCours = par('ASSIGNEE') + par('RETRAIT') + par('RECUPEREE') + par('LIVRAISON');
        const retards = actives.filter((a: any) => a.driver === p.driver).reduce((n: number, a: any) => n + (a.retards ?? 0), 0);
        const j = jour.find((x: any) => x.driver === p.driver);
        const fiche = fiches.find((d: any) => d.name === p.driver);
        // Ce que le livreur fait : sans position depuis 5 min, on ne sait plus — « inactif ».
        const activite = maintenant - new Date(at).getTime() > 5 * 60_000 ? 'inactif'
          : par('LIVRAISON') ? 'livraison' : par('RETRAIT') ? 'retrait' : enCours ? 'mission' : 'libre';
        return {
          driver: p.driver, lat: p.lat, lng: p.lng, at, zone, distanceM, outOfZone,
          trail: trace.map((t: any) => [t.lat, t.lng] as [number, number]),
          speedKmh: speedKmh(trace.slice(-2).map((t: any) => ({ lat: t.lat, lng: t.lng, at: t.at }))),
          activite, vehicle: fiche?.vehicle ?? null, available: fiche?.available ?? null,
          missions: enCours, retards, livrees: j?.livrees ?? 0, echecs: j?.echecs ?? 0, codJour: j?.cod ?? 0,
        };
      });
    });
  }

  /**
   * Fiche d'un livreur pour le PC flotte : ses missions en cours (avec le point à atteindre),
   * ses livraisons du jour, sa trace du jour et les indicateurs qui en découlent.
   */
  async driverDetail(schema: string, driver: string) {
    return withTenantDb(schema, async (_db, client) => {
      const tz = await this.fuseau(client);
      const debut = `(date_trunc('day', now() AT TIME ZONE $2) AT TIME ZONE $2)`;
      const { rows: trace } = await client.query(
        `SELECT lat, lng, at FROM driver_positions WHERE driver = $1 AND at >= ${debut} ORDER BY at`, [driver, tz],
      );
      const { rows: missions } = await client.query(
        `SELECT ref, code, status, merchant, cod, cod_paid, size, proof_level,
                pickup_contact, pickup_address, pickup_lat, pickup_lng, from_city,
                drop_contact, drop_address, drop_lat, drop_lng, to_city,
                delay_mode, delay_minutes, delay_heure, due_at, pickup_due_at
           FROM orders
          WHERE driver = $1 AND status IN ('ASSIGNEE','RETRAIT','RECUPEREE','LIVRAISON')
          ORDER BY created_at`, [driver],
      );
      const { rows: faites } = await client.query(
        `SELECT o.ref, o.drop_contact, o.drop_address, o.to_city, o.cod, o.cod_paid, e.status, e.at
           FROM order_events e JOIN orders o ON o.ref = e.ref
          WHERE o.driver = $1 AND e.status IN ('LIVREE','ECHOUEE') AND e.at >= ${debut}
          ORDER BY e.at DESC`, [driver, tz],
      );
      const { rows: [fiche] } = await client.query(
        `SELECT name, vehicle, available, phone, city FROM drivers WHERE name = $1`, [driver],
      );
      const pos = trace.length ? trace[trace.length - 1] : null;
      let cur0: { lat: number; lng: number } | null = null;
      // Le point à atteindre : le retrait tant que le colis n'est pas en main, puis la livraison.
      const arrets = missions.map((m: any) => {
        const retrait = m.status === 'ASSIGNEE' || m.status === 'RETRAIT';
        const lat = retrait ? m.pickup_lat : m.drop_lat;
        const lng = retrait ? m.pickup_lng : m.drop_lng;
        return {
          ref: m.ref, code: m.code, status: m.status, type: retrait ? 'retrait' : 'livraison',
          contact: retrait ? (m.pickup_contact || m.merchant) : m.drop_contact,
          adresse: [retrait ? m.pickup_address : m.drop_address, retrait ? m.from_city : m.to_city].filter(Boolean).join(', '),
          lat: lat ?? null, lng: lng ?? null, cod: Number(m.cod) || 0, codPaid: m.cod_paid, size: m.size,
          delayMode: m.delay_mode, delayMinutes: m.delay_minutes, delayHeure: m.delay_heure,
          dueAt: m.due_at ? new Date(m.due_at).toISOString() : null,
          pickupDueAt: !retrait || !m.pickup_due_at ? null : new Date(m.pickup_due_at).toISOString(),
        };
      });
      // Ordre conseillé : d'abord les arrêts dont l'échéance tombe dans l'heure (la plus proche
      // d'abord), puis le plus proche voisin depuis la position actuelle.
      const echeance = (a: (typeof arrets)[number]) => Math.min(...[a.dueAt, a.pickupDueAt].filter(Boolean).map((d) => new Date(d!).getTime()), Infinity);
      const dansLHeure = Date.now() + 60 * 60_000;
      const urgents = arrets.filter((a) => a.lat != null && echeance(a) <= dansLHeure).sort((x, y) => echeance(x) - echeance(y));
      const ordonnes: typeof arrets = [...urgents];
      const reste = arrets.filter((a) => a.lat != null && !urgents.includes(a));
      if (urgents.length) {
        const dernier = urgents[urgents.length - 1]!;
        // Le plus proche voisin repart du dernier arrêt urgent.
        cur0 = { lat: dernier.lat!, lng: dernier.lng! };
      }
      let cur = cur0 ?? (pos ? { lat: pos.lat, lng: pos.lng } : reste[0] ? { lat: reste[0].lat!, lng: reste[0].lng! } : null);
      while (reste.length && cur) {
        let i = 0, best = Infinity;
        reste.forEach((a, k) => { const d = haversineMeters(cur!.lat, cur!.lng, a.lat!, a.lng!); if (d < best) { best = d; i = k; } });
        const [a] = reste.splice(i, 1);
        ordonnes.push(a!);
        cur = { lat: a!.lat!, lng: a!.lng! };
      }
      ordonnes.push(...arrets.filter((a) => a.lat == null));
      const restantM = pathLengthM([...(pos ? [{ lat: pos.lat, lng: pos.lng }] : []), ...ordonnes.filter((a) => a.lat != null).map((a) => ({ lat: a.lat!, lng: a.lng! }))]);
      const parcourusM = pathLengthM(trace);
      const livrees = faites.filter((f: any) => f.status === 'LIVREE');
      const premier = trace[0]?.at ? new Date(trace[0].at).getTime() : null;
      const heures = premier ? Math.max(0.25, (Date.now() - premier) / 3_600_000) : null;
      // Échantillon de la trace (≤ 400 points) : la carte n'a pas besoin de chaque relevé.
      const pas = Math.max(1, Math.ceil(trace.length / 400));
      return {
        driver, vehicle: fiche?.vehicle ?? null, available: fiche?.available ?? null, phone: fiche?.phone ?? null,
        position: pos ? { lat: pos.lat, lng: pos.lng, at: pos.at instanceof Date ? pos.at.toISOString() : pos.at } : null,
        trace: trace.filter((_: any, i: number) => i % pas === 0 || i === trace.length - 1).map((t: any) => [t.lat, t.lng]),
        arrets: ordonnes,
        faites: faites.map((f: any) => ({
          ref: f.ref, status: f.status, contact: f.drop_contact, adresse: [f.drop_address, f.to_city].filter(Boolean).join(', '),
          cod: Number(f.cod) || 0, codPaid: f.cod_paid, at: f.at instanceof Date ? f.at.toISOString() : f.at,
        })),
        indicateurs: {
          livrees: livrees.length,
          echecs: faites.length - livrees.length,
          tauxReussite: faites.length ? Math.round((livrees.length / faites.length) * 100) : null,
          codEncaisse: livrees.reduce((s: number, f: any) => s + (f.cod_paid ? Number(f.cod) || 0 : 0), 0),
          kmParcourus: Math.round(parcourusM / 100) / 10,
          kmRestants: Math.round(restantM / 100) / 10,
          livraisonsParHeure: heures ? Math.round((livrees.length / heures) * 10) / 10 : null,
          // Mètres roulés par livraison : un livreur qui zigzague en fait beaucoup plus que
          // ses collègues pour le même travail — c'est l'indicateur d'itinéraire à surveiller.
          kmParLivraison: livrees.length ? Math.round(parcourusM / livrees.length / 100) / 10 : null,
        },
      };
    });
  }

  private async fuseau(client: any): Promise<string> {
    const { rows } = await client.query(`SELECT timezone FROM company_settings WHERE id = 'default'`).catch(() => ({ rows: [] }));
    return rows[0]?.timezone ?? 'Africa/Casablanca';
  }

  /** Alertes : livreurs actuellement hors de leur zone. */
  async alerts(schema: string) {
    const snap = await this.live(schema);
    return snap.filter((s) => s.outOfZone);
  }
}
