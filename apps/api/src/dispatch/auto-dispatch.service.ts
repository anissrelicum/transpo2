import {
  Injectable, Inject, Logger, BadRequestException, ConflictException, ForbiddenException, NotFoundException,
  type OnModuleInit, type OnModuleDestroy,
} from '@nestjs/common';
import type pg from 'pg';
import { pool, withTenantDb } from '@transpo/db';
import {
  AUTO_DISPATCH_DEFAULTS, DAILY_CAPACITY_BOUNDS, DISPATCH_EXCEPTION_META, OFFER_TIMEOUT_BOUNDS,
  planAutoDispatch, dayInTimeZone, isUrgent,
  type AutoDispatchSettings, type DispatchCandidate, type DispatchException, type DispatchZone, type Order,
} from '@transpo/domain';
import { NotificationsService } from '../notifications/notifications.service.js';

/** Résultat d'une tentative de placement — utile aux tests et au journal applicatif. */
export type DispatchOutcome =
  | { kind: 'offer'; ref: string; driver: string; offerId: string; expiresAt: string }
  | { kind: 'exception'; ref: string; reason: DispatchException }
  | { kind: 'skip'; ref: string; why: 'disabled' | 'busy' | 'not_pending' | 'offer_pending' | 'not_found' };

/** Proposition telle que l'app livreur la reçoit (aucune donnée personnelle du client final). */
export interface DriverOffer {
  id: string; ref: string; status: string; offeredAt: string; expiresAt: string; serverNow: string;
  order: Pick<Order, 'ref' | 'code' | 'fromCity' | 'toCity' | 'cod' | 'size' | 'merchant'> & {
    pickupAddress: string | null; dropAddress: string | null; distanceKm: number | null; fragile: boolean;
    /** Délai de livraison (ADR 0006) : le livreur sait s'il s'engage sur une course urgente. */
    delayMode: string; delayMinutes: number | null; delayHeure: string | null; dueAt: string | null; pickupDueAt: string | null;
  };
}

const TZ_DEFAUT = 'Africa/Casablanca';
/** Nombre maximal de commandes balayées par tenant et par passe (borne la durée d'un tick). */
const BALAYAGE_MAX = 50;

const iso = (d: unknown): string => (d instanceof Date ? d.toISOString() : String(d));
const slugDuSchema = (schema: string): string => schema.replace(/^tenant_/, '');

/** Exécute `fn` dans une transaction sur la connexion du tenant. */
async function enTransaction<T>(client: pg.PoolClient, fn: () => Promise<T>): Promise<T> {
  await client.query('BEGIN');
  try {
    const r = await fn();
    await client.query('COMMIT');
    return r;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  }
}

async function journaliser(client: pg.PoolClient, ref: string, status: string, actor: string | null, note: string | null) {
  await client.query('INSERT INTO order_events (ref, status, actor, note) VALUES ($1, $2, $3, $4)', [ref, status, actor, note]);
}

/**
 * Affectation automatique ÉQUITABLE avec acceptation du livreur (ADR 0004).
 *
 * Trois portes d'entrée :
 *  · une commande devient `NOUVELLE` (création, ou programmée arrivée à échéance) ;
 *  · un livreur refuse une proposition, ou la laisse expirer ;
 *  · la passe périodique (`tick`), qui expire les propositions échues et rattrape les
 *    commandes laissées de côté (API redémarrée, interrupteur fraîchement activé…).
 *
 * Sûreté à plusieurs répliques d'API — aucune double affectation, aucune double proposition :
 *  · le placement d'une commande prend un verrou consultatif TRANSACTIONNEL sur
 *    (schéma, réf) en mode « essai » : une réplique qui ne l'obtient pas passe son tour ;
 *  · un index unique partiel interdit deux propositions `PROPOSEE` sur la même commande ;
 *  · l'expiration est un `UPDATE … WHERE status = 'PROPOSEE' AND expires_at < now()
 *    RETURNING` : chaque proposition échue n'est rendue qu'à UNE réplique ;
 *  · l'acceptation verrouille la proposition (`FOR UPDATE`) et n'affecte la commande que si
 *    elle est encore libre (`WHERE driver IS NULL AND status = 'NOUVELLE'`).
 */
@Injectable()
export class AutoDispatchService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('AutoDispatch');
  private minuterie: NodeJS.Timeout | null = null;
  private enCours = false;

  // @Inject explicite : requis sous tsx/esbuild (pas de métadonnée de type émise).
  constructor(@Inject(NotificationsService) private readonly notifs: NotificationsService) {}

  /* ============================ Passe périodique ============================ */

  onModuleInit() {
    // 0 désactive la passe (outil en ligne de commande, tests unitaires du module).
    const ms = Number(process.env.AUTO_DISPATCH_INTERVAL_MS ?? 15000);
    if (!Number.isFinite(ms) || ms <= 0) return;
    this.minuterie = setInterval(() => { void this.tick(); }, ms);
    // La minuterie ne doit pas retenir le processus à l'arrêt (cron, scripts).
    this.minuterie.unref?.();
  }

  onModuleDestroy() {
    if (this.minuterie) clearInterval(this.minuterie);
    this.minuterie = null;
  }

  /** Une passe sur tous les tenants actifs. Jamais deux passes simultanées dans un processus. */
  async tick(): Promise<void> {
    if (this.enCours) return;
    this.enCours = true;
    try {
      const { rows } = await pool.query<{ slug: string }>(
        `SELECT slug FROM platform.tenants WHERE status <> 'SUSPENDU' ORDER BY slug`,
      );
      for (const r of rows) {
        try {
          await this.processTenant(`tenant_${r.slug}`);
        } catch (e) {
          // Un tenant en erreur (migration en retard…) ne doit pas bloquer les autres.
          this.log.warn(`passe ${r.slug} : ${(e as Error).message}`);
        }
      }
    } catch (e) {
      this.log.warn(`passe : ${(e as Error).message}`);
    } finally {
      this.enCours = false;
    }
  }

  /**
   * Passe sur un tenant : expire les propositions échues (et propose au suivant), annule
   * celles devenues sans objet, puis place les commandes nouvelles encore sans proposition.
   */
  async processTenant(schema: string): Promise<{ expired: number; dispatched: DispatchOutcome[] }> {
    // 1) Expiration atomique : l'UPDATE … RETURNING ne rend chaque proposition qu'à une
    //    seule réplique, et le fait est journalisé dans la MÊME instruction.
    const expirees = await withTenantDb(schema, async (_db, client) => {
      const { rows } = await client.query<{ ref: string }>(
        `WITH exp AS (
           UPDATE order_offers SET status = 'EXPIREE', responded_at = now()
            WHERE status = 'PROPOSEE' AND expires_at < now()
            RETURNING ref, driver
         )
         INSERT INTO order_events (ref, status, actor, note)
         SELECT ref, 'OFFRE_EXPIREE', NULL, 'Sans réponse de ' || driver || ' dans le délai'
           FROM exp
         RETURNING ref`,
      );
      // 2) Propositions sans objet : la commande a été affectée ou annulée entre-temps
      //    (affectation manuelle, tournée, annulation).
      await client.query(
        `WITH obs AS (
           UPDATE order_offers f SET status = 'ANNULEE', responded_at = now()
             FROM orders o
            WHERE f.ref = o.ref AND f.status = 'PROPOSEE'
              AND (o.driver IS NOT NULL OR o.status <> 'NOUVELLE')
            RETURNING f.ref, f.driver
         )
         INSERT INTO order_events (ref, status, actor, note)
         SELECT ref, 'OFFRE_ANNULEE', NULL, 'Proposition à ' || driver || ' retirée : commande déjà traitée'
           FROM obs`,
      );
      return rows.map((r) => r.ref);
    });

    const dispatched: DispatchOutcome[] = [];
    for (const ref of [...new Set(expirees)]) dispatched.push(await this.dispatch(schema, ref));

    // 3) Rattrapage : commandes nouvelles, libres, sans proposition ni exception.
    const settings = await this.getSettings(schema);
    if (settings.autoDispatch) {
      const aPlacer = await withTenantDb(schema, async (_db, client) => {
        const { rows } = await client.query<{ ref: string }>(
          `SELECT o.ref FROM orders o
            WHERE o.status = 'NOUVELLE' AND o.driver IS NULL AND o.dispatch_exception IS NULL
              AND NOT EXISTS (SELECT 1 FROM order_offers f WHERE f.ref = o.ref AND f.status = 'PROPOSEE')
            -- Les échéances les plus proches d'abord : un plat ou un pli urgent ne patiente
            -- pas derrière les colis du jour.
            ORDER BY LEAST(o.due_at, o.pickup_due_at) NULLS LAST, o.created_at
            LIMIT ${BALAYAGE_MAX}`,
        );
        return rows.map((r) => r.ref);
      });
      for (const ref of aPlacer) dispatched.push(await this.dispatch(schema, ref));
    }
    return { expired: expirees.length, dispatched };
  }

  /* ============================ Réglages ============================ */

  async getSettings(schema: string): Promise<AutoDispatchSettings & { timezone: string }> {
    return withTenantDb(schema, async (_db, client) => {
      const { rows } = await client.query(
        `SELECT auto_dispatch, offer_timeout_min, default_daily_capacity, timezone
           FROM company_settings WHERE id = 'default'`,
      );
      const r = rows[0];
      return {
        autoDispatch: r?.auto_dispatch ?? AUTO_DISPATCH_DEFAULTS.autoDispatch,
        offerTimeoutMin: r?.offer_timeout_min ?? AUTO_DISPATCH_DEFAULTS.offerTimeoutMin,
        defaultDailyCapacity: r?.default_daily_capacity ?? AUTO_DISPATCH_DEFAULTS.defaultDailyCapacity,
        timezone: r?.timezone ?? TZ_DEFAUT,
      };
    });
  }

  async saveSettings(schema: string, input: Partial<AutoDispatchSettings>, actor?: string) {
    const cur = await this.getSettings(schema);
    const autoDispatch = input.autoDispatch === undefined ? cur.autoDispatch : input.autoDispatch;
    if (typeof autoDispatch !== 'boolean') throw new BadRequestException('autoDispatch : booléen attendu.');
    const entier = (v: unknown, def: number, b: { min: number; max: number }, champ: string) => {
      if (v === undefined) return def;
      const n = Number(v);
      if (!Number.isInteger(n) || n < b.min || n > b.max) {
        throw new BadRequestException(`${champ} : entier entre ${b.min} et ${b.max} attendu.`);
      }
      return n;
    };
    const offerTimeoutMin = entier(input.offerTimeoutMin, cur.offerTimeoutMin, OFFER_TIMEOUT_BOUNDS, 'Délai d’acceptation (min)');
    const defaultDailyCapacity = entier(input.defaultDailyCapacity, cur.defaultDailyCapacity, DAILY_CAPACITY_BOUNDS, 'Capacité journalière');
    await withTenantDb(schema, async (_db, client) => {
      await client.query(
        `INSERT INTO company_settings (id, auto_dispatch, offer_timeout_min, default_daily_capacity, updated_at)
         VALUES ('default', $1, $2, $3, now())
         ON CONFLICT (id) DO UPDATE SET auto_dispatch = $1, offer_timeout_min = $2,
           default_daily_capacity = $3, updated_at = now()`,
        [autoDispatch, offerTimeoutMin, defaultDailyCapacity],
      );
    });
    if (autoDispatch && !cur.autoDispatch) {
      this.log.log(`${schema} : affectation automatique activée${actor ? ` par ${actor}` : ''}`);
    }
    return { autoDispatch, offerTimeoutMin, defaultDailyCapacity };
  }

  /* ============================ Placement ============================ */

  /**
   * Point d'entrée des événements métier (commande devenue NOUVELLE). Ne fait rien si
   * l'interrupteur est coupé, et n'échoue JAMAIS : la création d'une commande ne doit pas
   * dépendre de l'automate.
   */
  async onOrderReady(schema: string, ref: string): Promise<DispatchOutcome | null> {
    try {
      return await this.dispatch(schema, ref);
    } catch (e) {
      this.log.warn(`placement ${ref} : ${(e as Error).message}`);
      return null;
    }
  }

  /**
   * Tente de placer une commande : propose au livreur éligible le moins chargé, ou
   * consigne l'exception. `force` ignore l'interrupteur (relance explicite par un humain).
   */
  async dispatch(schema: string, ref: string, opts: { force?: boolean } = {}): Promise<DispatchOutcome> {
    type Effet =
      | { out: DispatchOutcome; driver?: undefined }
      | { out: DispatchOutcome; driver: string; code: string; ville: string; delai: number }
      | { out: DispatchOutcome; exception: DispatchException; nouvelle: boolean };

    const effet: Effet = await withTenantDb(schema, async (_db, client) => {
      try {
        return await enTransaction(client, async (): Promise<Effet> => {
          const { rows: verrou } = await client.query<{ ok: boolean }>(
            'SELECT pg_try_advisory_xact_lock(hashtext($1)) AS ok', [`${schema}:dispatch:${ref}`],
          );
          if (!verrou[0]?.ok) return { out: { kind: 'skip', ref, why: 'busy' } };

          const { rows: cmd } = await client.query(
            `SELECT ref, code, status, driver, from_city, to_city, pickup_lat, pickup_lng,
                    dispatch_exception, dispatch_round,
                    delay_mode, delay_minutes, delay_heure, retrait_minutes, due_at, pickup_due_at
               FROM orders WHERE ref = $1 FOR UPDATE`, [ref],
          );
          const o = cmd[0];
          if (!o) return { out: { kind: 'skip', ref, why: 'not_found' } };
          if (o.status !== 'NOUVELLE' || o.driver) return { out: { kind: 'skip', ref, why: 'not_pending' } };

          const { rows: enAttente } = await client.query(
            `SELECT 1 FROM order_offers WHERE ref = $1 AND status = 'PROPOSEE'`, [ref],
          );
          if (enAttente.length) return { out: { kind: 'skip', ref, why: 'offer_pending' } };

          const { rows: cfg } = await client.query(
            `SELECT auto_dispatch, offer_timeout_min, default_daily_capacity, timezone
               FROM company_settings WHERE id = 'default'`,
          );
          const s = cfg[0];
          const actif = s?.auto_dispatch ?? AUTO_DISPATCH_DEFAULTS.autoDispatch;
          if (!actif && !opts.force) return { out: { kind: 'skip', ref, why: 'disabled' } };
          const delai: number = s?.offer_timeout_min ?? AUTO_DISPATCH_DEFAULTS.offerTimeoutMin;
          const capaciteDefaut: number = s?.default_daily_capacity ?? AUTO_DISPATCH_DEFAULTS.defaultDailyCapacity;
          const tz: string = s?.timezone ?? TZ_DEFAUT;

          const candidats = await this.candidats(client, capaciteDefaut, tz);
          const { rows: zonesRows } = await client.query(
            'SELECT name_fr, drivers, polygon, province, commune, region FROM zones',
          );
          const zones: DispatchZone[] = zonesRows.map((z) => ({
            nameFr: z.name_fr, drivers: z.drivers ?? [], polygon: Array.isArray(z.polygon) ? z.polygon : null,
            province: z.province, commune: z.commune, region: z.region,
          }));
          // Sollicités dans le TOUR courant : un refus ou un silence exclut le livreur pour
          // cette commande, jusqu'à ce qu'un humain relance (nouveau tour).
          const { rows: sollicites } = await client.query<{ driver: string }>(
            `SELECT DISTINCT driver FROM order_offers
              WHERE ref = $1 AND round = $2 AND status IN ('REFUSEE', 'EXPIREE')`,
            [ref, o.dispatch_round],
          );

          const point = o.pickup_lat != null && o.pickup_lng != null ? { lat: o.pickup_lat, lng: o.pickup_lng } : null;
          const plan = planAutoDispatch({
            pickup: { city: o.from_city, point },
            drivers: candidats, zones,
            alreadyAsked: sollicites.map((x) => x.driver),
            today: dayInTimeZone(new Date(), tz),
            urgent: isUrgent({
              policy: { mode: o.delay_mode, minutes: o.delay_minutes, heure: o.delay_heure, retraitMinutes: o.retrait_minutes },
              dueAt: o.due_at, pickupDueAt: o.pickup_due_at, now: new Date(),
            }),
          });

          if (plan.kind === 'exception') {
            const nouvelle = o.dispatch_exception !== plan.reason;
            if (nouvelle) {
              await client.query(
                `UPDATE orders SET dispatch_exception = $2, dispatch_exception_at = now() WHERE ref = $1`,
                [ref, plan.reason],
              );
              await journaliser(client, ref, 'EXCEPTION_DISPATCH', null,
                `${DISPATCH_EXCEPTION_META[plan.reason].fr} — ${DISPATCH_EXCEPTION_META[plan.reason].hintFr}`);
            }
            return { out: { kind: 'exception', ref, reason: plan.reason }, exception: plan.reason, nouvelle };
          }

          const d = plan.driver;
          const motif = `charge ${d.load}/${d.capacity}`
            + (d.distanceKm != null ? ` · ${String(d.distanceKm).replace('.', ',')} km du retrait` : '')
            + (plan.ranking.length > 1 ? ` · 1er sur ${plan.ranking.length} éligibles` : ' · seul éligible');
          const { rows: ins } = await client.query<{ id: string; expires_at: Date }>(
            `INSERT INTO order_offers (ref, driver, round, reason, expires_at)
             VALUES ($1, $2, $3, $4, now() + make_interval(mins => $5))
             RETURNING id, expires_at`,
            [ref, d.name, o.dispatch_round, motif, delai],
          );
          await client.query(
            'UPDATE orders SET dispatch_exception = NULL, dispatch_exception_at = NULL WHERE ref = $1', [ref],
          );
          await journaliser(client, ref, 'OFFRE_PROPOSEE', null,
            `Proposée à ${d.name} (${motif}) — réponse attendue sous ${delai} min`);
          return {
            out: { kind: 'offer', ref, driver: d.name, offerId: ins[0]!.id, expiresAt: iso(ins[0]!.expires_at) },
            driver: d.name, code: o.code, ville: o.to_city, delai,
          };
        });
      } catch (e) {
        // 23505 : une autre réplique vient de poser la proposition (index unique partiel).
        if ((e as { code?: string }).code === '23505') return { out: { kind: 'skip', ref, why: 'busy' } };
        throw e;
      }
    });

    // Effets de bord APRÈS validation de la transaction : une notification ne doit jamais
    // retenir ni défaire l'écriture métier.
    if ('driver' in effet && effet.driver) {
      await this.notifs.notifierLivreur(schema, slugDuSchema(schema), effet.driver, 'driver.offer', {
        code: effet.code, ville: effet.ville, delai: String(effet.delai),
      }, { type: 'offer', ref, offerId: (effet.out as { offerId: string }).offerId });
    } else if ('exception' in effet && effet.nouvelle) {
      await this.notifs.notifierConsole(schema, 'dispatch.exception', {
        ref, motif: DISPATCH_EXCEPTION_META[effet.exception].fr,
      });
    }
    return effet.out;
  }

  /**
   * Livreurs du tenant avec leur charge du jour (commandes affectées aujourd'hui dans le
   * fuseau de l'entreprise, hors annulées, + propositions en cours), leur capacité, l'état
   * de leur compte d'app et leur dernière position connue.
   */
  private async candidats(client: pg.PoolClient, capaciteDefaut: number, tz: string): Promise<DispatchCandidate[]> {
    const { rows } = await client.query(
      `SELECT d.name, d.available, d.license_due, d.medical_due, d.daily_capacity,
              EXISTS (SELECT 1 FROM users u WHERE u.role = 'DRIVER' AND u.driver = d.name AND u.active) AS account_active,
              (SELECT count(*)::int FROM orders o
                WHERE o.driver = d.name AND o.assigned_at IS NOT NULL AND o.status <> 'ANNULEE'
                  AND (o.assigned_at AT TIME ZONE $1)::date = (now() AT TIME ZONE $1)::date) AS assigned_today,
              (SELECT count(*)::int FROM order_offers f WHERE f.driver = d.name AND f.status = 'PROPOSEE') AS pending,
              p.lat, p.lng
         FROM drivers d
         LEFT JOIN LATERAL (
           SELECT lat, lng FROM driver_positions dp WHERE dp.driver = d.name ORDER BY dp.at DESC LIMIT 1
         ) p ON true`,
      [tz],
    );
    return rows.map((r) => ({
      name: r.name,
      available: r.available,
      accountActive: r.account_active,
      licenseDue: r.license_due,
      medicalDue: r.medical_due,
      capacity: r.daily_capacity ?? capaciteDefaut,
      load: r.assigned_today + r.pending,
      lastPosition: r.lat != null && r.lng != null ? { lat: r.lat, lng: r.lng } : null,
    }));
  }

  /* ============================ Côté livreur ============================ */

  /** Propositions en cours pour un livreur (non échues). */
  async driverOffers(schema: string, driver?: string): Promise<DriverOffer[]> {
    if (!driver) throw new ForbiddenException('Compte non rattaché à un livreur.');
    return withTenantDb(schema, async (_db, client) => {
      const { rows } = await client.query(
        `SELECT f.id, f.ref, f.status, f.offered_at, f.expires_at, now() AS server_now,
                o.code, o.from_city, o.to_city, o.cod, o.size, o.merchant,
                o.pickup_address, o.drop_address, o.distance_km, o.fragile,
                o.delay_mode, o.delay_minutes, o.delay_heure, o.due_at, o.pickup_due_at
           FROM order_offers f JOIN orders o ON o.ref = f.ref
          WHERE f.driver = $1 AND f.status = 'PROPOSEE' AND f.expires_at > now()
          ORDER BY f.expires_at`,
        [driver],
      );
      return rows.map((r) => ({
        id: r.id, ref: r.ref, status: r.status,
        offeredAt: iso(r.offered_at), expiresAt: iso(r.expires_at), serverNow: iso(r.server_now),
        // Ni nom ni téléphone du destinataire : la proposition n'en a pas besoin, et un
        // livreur qui refuse ne doit rien emporter du client.
        order: {
          ref: r.ref, code: r.code, fromCity: r.from_city, toCity: r.to_city, cod: r.cod, size: r.size,
          merchant: r.merchant, pickupAddress: r.pickup_address, dropAddress: r.drop_address,
          distanceKm: r.distance_km, fragile: r.fragile,
          delayMode: r.delay_mode, delayMinutes: r.delay_minutes, delayHeure: r.delay_heure,
          dueAt: r.due_at ? iso(r.due_at) : null, pickupDueAt: r.pickup_due_at ? iso(r.pickup_due_at) : null,
        },
      }));
    });
  }

  /**
   * Réponse du livreur à une proposition. IDEMPOTENT : rejouer la même décision rend le
   * même résultat (file hors ligne). Une décision contraire à un état déjà acquis, ou une
   * acceptation après échéance, est refusée (409) — le serveur fait foi.
   */
  async respond(schema: string, driver: string | undefined, offerId: string, decision: 'accept' | 'refuse') {
    if (!driver) throw new ForbiddenException('Compte non rattaché à un livreur.');
    if (!/^[0-9a-f-]{36}$/i.test(offerId)) throw new NotFoundException('Proposition introuvable.');

    const res = await withTenantDb(schema, async (_db, client) => enTransaction(client, async () => {
      const { rows } = await client.query(
        'SELECT id, ref, driver, status, expires_at, expires_at <= now() AS echue FROM order_offers WHERE id = $1 FOR UPDATE',
        [offerId],
      );
      const f = rows[0];
      if (!f) throw new NotFoundException('Proposition introuvable.');
      if (f.driver !== driver) throw new ForbiddenException('Proposition destinée à un autre livreur.');

      if (decision === 'accept') {
        if (f.status === 'ACCEPTEE') return { offer: { id: f.id, ref: f.ref, status: 'ACCEPTEE' }, relancer: false };
        if (f.status !== 'PROPOSEE') {
          throw new ConflictException(f.status === 'EXPIREE'
            ? 'Proposition expirée : la course a été proposée à un autre livreur.'
            : 'Proposition plus disponible.');
        }
        if (f.echue) throw new ConflictException('Proposition expirée : la course a été proposée à un autre livreur.');
        const { rows: maj } = await client.query(
          `UPDATE orders SET driver = $2, status = 'ASSIGNEE', assigned_at = now(),
                  dispatch_exception = NULL, dispatch_exception_at = NULL
            WHERE ref = $1 AND driver IS NULL AND status = 'NOUVELLE'
            RETURNING ref`,
          [f.ref, driver],
        );
        if (!maj.length) {
          await client.query(`UPDATE order_offers SET status = 'ANNULEE', responded_at = now() WHERE id = $1`, [f.id]);
          await journaliser(client, f.ref, 'OFFRE_ANNULEE', null, `Proposition à ${driver} retirée : commande déjà traitée`);
          // Pas d'exception levée ici : l'annulation doit être validée. Le livreur est
          // prévenu par le statut rendu.
          return { offer: { id: f.id, ref: f.ref, status: 'ANNULEE' }, relancer: false };
        }
        await client.query(`UPDATE order_offers SET status = 'ACCEPTEE', responded_at = now() WHERE id = $1`, [f.id]);
        await journaliser(client, f.ref, 'ASSIGNEE', driver, `Proposition acceptée — affectée à ${driver}`);
        return { offer: { id: f.id, ref: f.ref, status: 'ACCEPTEE' }, relancer: false };
      }

      // Refus
      if (f.status === 'REFUSEE') return { offer: { id: f.id, ref: f.ref, status: 'REFUSEE' }, relancer: false };
      if (f.status !== 'PROPOSEE') {
        // Refuser ce qui n'est plus proposé est sans effet : l'intention est déjà satisfaite.
        return { offer: { id: f.id, ref: f.ref, status: f.status as string }, relancer: false };
      }
      await client.query(`UPDATE order_offers SET status = 'REFUSEE', responded_at = now() WHERE id = $1`, [f.id]);
      await journaliser(client, f.ref, 'OFFRE_REFUSEE', driver, `Refusée par ${driver}`);
      return { offer: { id: f.id, ref: f.ref, status: 'REFUSEE' }, relancer: true };
    }));

    if (res.offer.status === 'ANNULEE' && decision === 'accept') {
      throw new ConflictException('Commande déjà prise en charge.');
    }
    // Un refus passe immédiatement la main au suivant, sans attendre la prochaine passe.
    if (res.relancer) await this.onOrderReady(schema, res.offer.ref);
    return res.offer;
  }

  /* ============================ Côté exploitation ============================ */

  /** Commandes que l'automate n'a pas pu placer, avec leur motif. */
  exceptions(schema: string) {
    return withTenantDb(schema, async (_db, client) => {
      const { rows } = await client.query(
        `SELECT ref, code, status, merchant, from_city, to_city, cod, size, created_at,
                dispatch_exception, dispatch_exception_at, dispatch_round,
                (SELECT count(*)::int FROM order_offers f WHERE f.ref = o.ref AND f.round = o.dispatch_round
                   AND f.status IN ('REFUSEE', 'EXPIREE')) AS declined
           FROM orders o
          WHERE dispatch_exception IS NOT NULL AND driver IS NULL AND status = 'NOUVELLE'
          ORDER BY dispatch_exception_at DESC NULLS LAST`,
      );
      return rows.map((r) => ({
        ref: r.ref, code: r.code, status: r.status, merchant: r.merchant,
        fromCity: r.from_city, toCity: r.to_city, cod: r.cod, size: r.size,
        createdAt: iso(r.created_at),
        reason: r.dispatch_exception as DispatchException,
        since: r.dispatch_exception_at ? iso(r.dispatch_exception_at) : null,
        round: r.dispatch_round, declined: r.declined,
      }));
    });
  }

  /** Propositions en cours (en attente de réponse d'un livreur). */
  pendingOffers(schema: string) {
    return withTenantDb(schema, async (_db, client) => {
      const { rows } = await client.query(
        `SELECT id, ref, driver, reason, offered_at, expires_at, now() AS server_now
           FROM order_offers WHERE status = 'PROPOSEE' ORDER BY expires_at`,
      );
      return rows.map((r) => ({
        id: r.id, ref: r.ref, driver: r.driver, reason: r.reason,
        offeredAt: iso(r.offered_at), expiresAt: iso(r.expires_at), serverNow: iso(r.server_now),
      }));
    });
  }

  /** Historique des propositions d'une commande (tous tours). */
  offersOf(schema: string, ref: string) {
    return withTenantDb(schema, async (_db, client) => {
      const { rows } = await client.query(
        `SELECT id, driver, round, status, reason, offered_at, expires_at, responded_at
           FROM order_offers WHERE ref = $1 ORDER BY offered_at`, [ref],
      );
      return rows.map((r) => ({
        id: r.id, driver: r.driver, round: r.round, status: r.status, reason: r.reason,
        offeredAt: iso(r.offered_at), expiresAt: iso(r.expires_at),
        respondedAt: r.responded_at ? iso(r.responded_at) : null,
      }));
    });
  }

  /**
   * Relance de l'affectation automatique par un humain : ouvre un NOUVEAU TOUR (les refus
   * précédents ne comptent plus), efface l'exception et place la commande, même si
   * l'interrupteur d'entreprise est coupé — c'est une décision explicite du dispatcher.
   */
  async retry(schema: string, ref: string, actor?: string): Promise<DispatchOutcome> {
    await withTenantDb(schema, async (_db, client) => enTransaction(client, async () => {
      const { rows } = await client.query('SELECT status, driver FROM orders WHERE ref = $1 FOR UPDATE', [ref]);
      const o = rows[0];
      if (!o) throw new NotFoundException(`Commande introuvable : ${ref}`);
      if (o.status !== 'NOUVELLE' || o.driver) {
        throw new BadRequestException('Seule une commande nouvelle et non affectée peut être relancée.');
      }
      const { rows: f } = await client.query(`SELECT 1 FROM order_offers WHERE ref = $1 AND status = 'PROPOSEE'`, [ref]);
      if (f.length) throw new ConflictException('Une proposition est déjà en cours pour cette commande.');
      await client.query(
        `UPDATE orders SET dispatch_round = dispatch_round + 1, dispatch_exception = NULL,
                dispatch_exception_at = NULL WHERE ref = $1`, [ref],
      );
      await journaliser(client, ref, 'RELANCE_DISPATCH', actor ?? null, 'Nouveau tour : les refus précédents ne comptent plus');
    }));
    return this.dispatch(schema, ref, { force: true });
  }

  /**
   * Une commande quitte la file de l'automate (affectation manuelle, tournée, annulation) :
   * sa proposition en cours est retirée et son exception effacée. Appelée DANS la
   * transaction/connexion de l'appelant.
   */
  static async retirerDeLaFile(client: pg.PoolClient, ref: string, motif: string) {
    const { rows } = await client.query<{ driver: string }>(
      `UPDATE order_offers SET status = 'ANNULEE', responded_at = now()
        WHERE ref = $1 AND status = 'PROPOSEE' RETURNING driver`, [ref],
    );
    for (const r of rows) await journaliser(client, ref, 'OFFRE_ANNULEE', null, `Proposition à ${r.driver} retirée : ${motif}`);
    await client.query('UPDATE orders SET dispatch_exception = NULL, dispatch_exception_at = NULL WHERE ref = $1', [ref]);
  }
}
