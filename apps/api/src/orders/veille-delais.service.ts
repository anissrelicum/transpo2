import { Injectable, Inject, Logger, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { pool, withTenantDb } from '@transpo/db';
import { deadlineState, haversineMeters } from '@transpo/domain';
import { NotificationsService } from '../notifications/notifications.service.js';
import { fuseauEntreprise } from './delais.js';

/** Vitesse moyenne retenue en ville (km/h) et détour des rues par rapport au vol d'oiseau. */
const VITESSE_KMH = 25;
const DETOUR = 1.3;
/** Temps forfaitaire d'un arrêt (se garer, sonner, remettre) et d'une affectation encore à faire. */
const ARRET_MIN = 3;
const AFFECTATION_MIN = 10;

/**
 * Veille des délais de livraison (ADR 0006).
 *
 * Chaque minute, pour chaque commande en cours qui a une échéance : arrivée estimée depuis
 * la dernière position du livreur (retrait puis livraison si le colis n'est pas en main).
 *  - « à risque » (l'arrivée estimée dépasse l'échéance) : on prévient AVANT le retard —
 *    le dispatcher (console), le client (SMS), le marchand ;
 *  - « en retard » (échéance passée) : nouvelle alerte au dispatcher, et client/marchand
 *    s'ils n'avaient pas déjà été prévenus.
 * Chaque alerte part UNE fois : l'horodatage est posé par un UPDATE conditionnel, qui ne
 * réussit qu'une fois même avec plusieurs répliques de l'API.
 */
@Injectable()
export class VeilleDelaisService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('VeilleDelais');
  private minuterie: NodeJS.Timeout | null = null;
  private enCours = false;

  constructor(@Inject(NotificationsService) private readonly notifs: NotificationsService) {}

  onModuleInit() {
    const ms = Number(process.env.DELAY_WATCH_INTERVAL_MS ?? 60_000);
    if (!Number.isFinite(ms) || ms <= 0) return;
    this.minuterie = setInterval(() => { void this.tick(); }, ms);
    this.minuterie.unref?.();
  }

  onModuleDestroy() {
    if (this.minuterie) clearInterval(this.minuterie);
  }

  async tick(): Promise<void> {
    if (this.enCours) return;
    this.enCours = true;
    try {
      const { rows } = await pool.query<{ slug: string }>(`SELECT slug FROM platform.tenants WHERE status <> 'SUSPENDU' ORDER BY slug`);
      for (const r of rows) {
        try { await this.processTenant(`tenant_${r.slug}`); } catch (e) { this.log.warn(`${r.slug} : ${(e as Error).message}`); }
      }
    } finally {
      this.enCours = false;
    }
  }

  /** Une passe sur un tenant. Rend les alertes émises (pour les tests et le journal). */
  async processTenant(schema: string, now = new Date()): Promise<{ ref: string; etat: 'a_risque' | 'en_retard' }[]> {
    const { commandes, tz } = await withTenantDb(schema, async (_db, client) => {
      const tz = await fuseauEntreprise(client);
      const { rows } = await client.query(
        `SELECT o.ref, o.code, o.status, o.driver, o.merchant, o.drop_contact, o.drop_phone,
                o.pickup_lat, o.pickup_lng, o.drop_lat, o.drop_lng, o.due_at, o.pickup_due_at,
                o.risk_alerted_at, o.late_alerted_at, p.lat AS pos_lat, p.lng AS pos_lng,
                m.email AS m_email, m.phone AS m_phone
           FROM orders o
           LEFT JOIN LATERAL (SELECT lat, lng FROM driver_positions dp WHERE dp.driver = o.driver ORDER BY dp.at DESC LIMIT 1) p ON true
           LEFT JOIN merchants m ON m.name = o.merchant
          WHERE o.status IN ('NOUVELLE','ASSIGNEE','RETRAIT','RECUPEREE','LIVRAISON')
            AND (o.due_at IS NOT NULL OR (o.pickup_due_at IS NOT NULL AND o.picked_at IS NULL))
            AND o.late_alerted_at IS NULL`,
      );
      return { commandes: rows, tz };
    });

    const emises: { ref: string; etat: 'a_risque' | 'en_retard' }[] = [];
    const heure = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: tz });
    for (const o of commandes) {
      const enMain = o.status === 'RECUPEREE' || o.status === 'LIVRAISON';
      const etaMin = estimerArrivee(o, enMain);
      const etat = deadlineState({ dueAt: o.due_at, pickupDueAt: o.pickup_due_at, pickedUp: enMain, now, etaMin });
      if (etat !== 'a_risque' && etat !== 'en_retard') continue;
      if (etat === 'a_risque' && o.risk_alerted_at) continue;

      // Pose atomique de l'horodatage : une seule réplique (et une seule passe) gagne.
      const colonne = etat === 'a_risque' ? 'risk_alerted_at' : 'late_alerted_at';
      const gagne = await withTenantDb(schema, async (_db, client) => {
        const { rowCount } = await client.query(
          `UPDATE orders SET ${colonne} = now() WHERE ref = $1 AND ${colonne} IS NULL`, [o.ref],
        );
        if (rowCount) {
          await client.query(`INSERT INTO order_events (ref, status, actor, note) VALUES ($1, $2, NULL, $3)`, [
            o.ref, etat === 'a_risque' ? 'ECHEANCE_A_RISQUE' : 'ECHEANCE_DEPASSEE',
            etat === 'a_risque' ? `Arrivée estimée dans ${etaMin} min` : 'Échéance dépassée',
          ]);
        }
        return !!rowCount;
      });
      if (!gagne) continue;
      emises.push({ ref: o.ref, etat });

      const echeanceMs = Math.min(...[o.due_at, enMain ? null : o.pickup_due_at].filter(Boolean).map((d: Date) => new Date(d).getTime()));
      const echeance = heure(new Date(echeanceMs));
      const retard = Math.max(1, Math.round((now.getTime() + etaMin * 60_000 - echeanceMs) / 60_000));
      const livreur = o.driver ?? 'non affectée';
      await this.notifs.notifierConsole(schema, etat === 'a_risque' ? 'delay.risk' : 'delay.late', {
        ref: o.ref, eta: heure(new Date(now.getTime() + etaMin * 60_000)), echeance, livreur,
      });
      // Client et marchand : prévenus une seule fois, à la première alerte.
      if (etat === 'a_risque' || !o.risk_alerted_at) {
        await this.notifs.notifierEvenement(schema, 'order.delayed', { recipient: o.drop_phone, vars: { code: o.code, retard: String(retard) } });
        const contact = o.m_email ?? o.m_phone;
        if (contact) {
          await this.notifs.send(schema, {
            event: 'merchant.delay', channel: o.m_email ? 'EMAIL' : 'SMS', recipient: contact, lang: 'fr',
            vars: { ref: o.ref, client: o.drop_contact ?? '—', retard: String(retard), echeance },
          } as never).catch(() => null);
        }
      }
    }
    return emises;
  }
}

/** Minutes avant la livraison, depuis la dernière position du livreur (ou sans livreur). */
function estimerArrivee(o: any, enMain: boolean): number {
  const km = (a: [number, number] | null, b: [number, number] | null) =>
    a && b ? (haversineMeters(a[0], a[1], b[0], b[1]) / 1000) * DETOUR : 0;
  const pos: [number, number] | null = o.pos_lat != null ? [o.pos_lat, o.pos_lng] : null;
  const retrait: [number, number] | null = o.pickup_lat != null ? [o.pickup_lat, o.pickup_lng] : null;
  const livraison: [number, number] | null = o.drop_lat != null ? [o.drop_lat, o.drop_lng] : null;
  const trajet = enMain ? km(pos, livraison) : km(pos ?? retrait, retrait) + km(retrait, livraison);
  const attente = o.driver ? 0 : AFFECTATION_MIN;
  return Math.round(attente + (trajet / VITESSE_KMH) * 60 + (enMain ? ARRET_MIN : 2 * ARRET_MIN));
}
