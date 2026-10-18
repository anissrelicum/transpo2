import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Inject } from '@nestjs/common';
import { ReturnsService } from '../returns/returns.service.js';
import { FraudService } from '../fraud/fraud.service.js';
import { TrackingService } from '../tracking/tracking.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { withTenantDb, orders as ordersTable, orderEvents as orderEventsTable, idempotencyKeys,
  deliveryProofs, cashSessions, cashMovements } from '@transpo/db';
import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { LIFECYCLE, missingProof, type Order, type OrderStatus, type ProofLevel } from '@transpo/domain';
import { surTransition, surLivraison } from '../orders/delais.js';
import { termsOf } from '../billing/billing.service.js';
import { merchants as merchantsTable } from '@transpo/db';

const ACTIVE: OrderStatus[] = ['ASSIGNEE', 'RETRAIT', 'RECUPEREE', 'LIVRAISON'];
// ~700 Ko de data URI ≈ 500 Ko binaire : large pour une photo compressée par l'app,
// assez bas pour ne pas saturer la base ni la file d'attente hors ligne du mobile.
const MAX_ARTIFACT_CHARS = 700_000;

export interface ProofInput { codCollected?: number; photo?: string | null; signature?: string | null }

function rowToOrder(r: any): Order {
  // Le numéro du destinataire ne descend PAS sur le téléphone du livreur.
  //
  // La ligne partait tout entière (`{ ...r }`), `drop_phone` compris, alors que l'écran
  // de mission annonce au livreur « l'API ne fournit pas de numéro client ». C'était faux :
  // le numéro voyageait en clair jusqu'à l'appareil, seule l'interface choisissait de ne
  // pas l'afficher. Le PRD prévoit un relais d'appel qui masque ce numéro ; tant qu'il
  // n'existe pas, la donnée ne sort pas. Le téléphone du point de RETRAIT reste, lui :
  // c'est le contact professionnel du marchand, pas celui d'un particulier.
  const { dropPhone: _client, ...reste } = r;
  return { ...reste, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt } as Order;
}

/** Valide un artefact de preuve : data URI d'un type attendu, de taille bornée. */
function assertArtifact(value: string | null | undefined, name: string, mimes: string[]): string | undefined {
  if (!value) return undefined;
  const v = value.trim();
  if (!mimes.some((m) => v.startsWith(`data:${m};base64,`))) {
    throw new BadRequestException(`${name} : data URI attendu (${mimes.join(' ou ')}).`);
  }
  if (v.length > MAX_ARTIFACT_CHARS) {
    throw new BadRequestException(`${name} : trop volumineux (max ${Math.round(MAX_ARTIFACT_CHARS / 1000)} Ko encodés).`);
  }
  return v;
}

@Injectable()
export class DriverService {
  // @Inject explicite : requis sous tsx/esbuild (pas de métadonnée de type émise).
  constructor(
    @Inject(ReturnsService) private readonly returns: ReturnsService,
    @Inject(FraudService) private readonly fraud: FraudService,
    @Inject(TrackingService) private readonly tracking: TrackingService,
    @Inject(NotificationsService) private readonly notifs: NotificationsService,
  ) {}

  private ensure(driver?: string): string {
    if (!driver) throw new ForbiddenException('Compte non rattaché à un livreur.');
    return driver;
  }

  /**
   * Enveloppe idempotente : si une clé (Idempotency-Key) a déjà été traitée,
   * renvoie la réponse mémorisée sans ré-appliquer l'effet. Cf. transpo-offline-sync.
   */
  private async idempotent<T>(schema: string, key: string | undefined, fn: () => Promise<T>): Promise<T> {
    if (!key) return fn();
    const cached = await withTenantDb(schema, async (db) => {
      const [r] = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, key));
      return r?.response as T | undefined;
    });
    if (cached !== undefined) return cached;
    const result = await fn();
    await withTenantDb(schema, async (db) => {
      await db.insert(idempotencyKeys).values({ key, response: result as unknown as object })
        .onConflictDoNothing();
    });
    return result;
  }

  /** Missions du livreur : ses commandes actives, plus anciennes d'abord. */
  missions(schema: string, driver?: string): Promise<Order[]> {
    const d = this.ensure(driver);
    return withTenantDb(schema, async (db) => {
      const rows = await db.select().from(ordersTable)
        .where(and(eq(ordersTable.driver, d), inArray(ordersTable.status, ACTIVE)))
        .orderBy(desc(ordersTable.createdAt));
      return rows.map(rowToOrder);
    });
  }

  private async ownedOrder(schema: string, driver: string, ref: string) {
    return withTenantDb(schema, async (db) => {
      const [o] = await db.select().from(ordersTable).where(eq(ordersTable.ref, ref));
      if (!o) throw new NotFoundException('Commande introuvable.');
      if (o.driver !== driver) throw new ForbiddenException('Commande non assignée à ce livreur.');
      return o;
    });
  }

  /** Avance au statut suivant du cycle (borne LIVRAISON : la livraison se fait via /proof). */
  async advance(schema: string, driver: string | undefined, ref: string, key?: string) {
    const d = this.ensure(driver);
    return this.idempotent(schema, key, async () => {
      const cur = await this.ownedOrder(schema, d, ref);
      const i = LIFECYCLE.indexOf(cur.status as OrderStatus);
      if (i < 0 || LIFECYCLE[i + 1] === 'LIVREE' || i >= LIFECYCLE.length - 1) {
        throw new BadRequestException('Progression impossible (livraison via preuve).');
      }
      const next = LIFECYCLE[i + 1];
      return withTenantDb(schema, async (db) => {
        const [r] = await db.update(ordersTable).set({ status: next, ...surTransition(cur as any, next) }).where(eq(ordersTable.ref, ref)).returning();
        // Le terrain écrit au même journal que l'exploitation : un litige se tranche sur
        // une seule suite de faits, pas sur deux versions.
        await db.insert(orderEventsTable).values({ ref, status: next, actor: d });
        return rowToOrder(r);
      });
    });
  }

  /**
   * Échec de livraison constaté sur le terrain → ECHOUEE + entrée de retour.
   * Le livreur est celui qui constate l'échec ; jusqu'ici seule l'exploitation
   * pouvait l'enregistrer (`/v1/returns/fail`, réservé ADMIN/DISPATCHER), ce qui
   * laissait le terrain sans moyen de déclencher le flux de retours.
   * Délègue à `ReturnsService` pour que les deux chemins produisent le même effet.
   */
  async fail(schema: string, driver: string | undefined, ref: string, reason: string, key?: string) {
    const d = this.ensure(driver);
    if (!reason?.trim()) throw new BadRequestException('Motif requis.');
    return this.idempotent(schema, key, async () => {
      const cur = await this.ownedOrder(schema, d, ref);
      // Même borne que la preuve : on ne déclare un échec qu'en cours de livraison.
      if (cur.status !== 'LIVRAISON') {
        throw new BadRequestException('Échec déclarable en cours de livraison uniquement.');
      }
      const retour = await this.returns.fail(schema, ref, reason.trim());
      await this.notifs.notifierEvenement(schema, 'order.failed', {
        recipient: cur.dropPhone, vars: { code: cur.code },
      });
      return retour;
    });
  }

  /** Consigne un signal si la preuve est déposée hors de la géofence du livreur. */
  private async signalerSiHorsZone(schema: string, driver: string, ref: string) {
    try {
      const live = await this.tracking.live(schema);
      const sien = live.find((p) => p.driver === driver);
      if (!sien?.outOfZone) return;
      const km = Math.round((sien.distanceM ?? 0) / 100) / 10;
      await this.fraud.signaler(schema, driver, 'hors_geo', {
        summary: `Livraison ${ref} validée à ${km} km hors de la zone ${sien.zone ?? ''}`.trim(),
      });
    } catch {
      // Le contrôle de zone ne doit jamais empêcher une livraison d'aboutir : le livreur
      // est devant le client, et l'absence de position n'est pas une faute.
    }
  }

  /**
   * Porte un encaissement dans la caisse du jour du livreur.
   *
   * Une session par (livreur, jour) : ouverte au premier encaissement, alimentée ensuite.
   * Le mouvement garde la trace course par course — c'est lui qui permet de dire d'où
   * vient l'argent quand le déclaré ne tombe pas juste.
   */
  private async porterEnCaisse(db: any, driver: string, ref: string, recipient: string, amount: number) {
    const jour = new Date().toISOString().slice(0, 10);
    // Une session déposée est close : l'encaissement suivant rouvre une caisse. Elle porte
    // la MÊME date — il peut donc y avoir plusieurs sessions par livreur et par jour, et
    // toute lecture qui se contente de (livreur, date) en prend une au hasard. On vise
    // explicitement l'ouverte, la plus récente.
    const [ouverte] = await db.select().from(cashSessions)
      .where(and(
        eq(cashSessions.driver, driver),
        eq(cashSessions.sessionDate, jour),
        ne(cashSessions.status, 'DEPOSE'),
      ))
      .orderBy(desc(cashSessions.createdAt));
    let session = ouverte ?? null;
    if (!session) {
      const initiales = driver.split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0]!.toUpperCase()).join('');
      [session] = await db.insert(cashSessions).values({
        driver, ini: initiales || driver.slice(0, 2).toUpperCase(), sessionDate: jour,
        theorique: 0, deliveries: 0, status: 'EN_COURS',
      }).returning();
    }
    // Une même course ne doit compter qu'une fois, même si la preuve est rejouée.
    const dejaPorte = await db.select().from(cashMovements)
      .where(and(eq(cashMovements.sessionId, session.id), eq(cashMovements.ref, ref)));
    if (dejaPorte.length) return;
    await db.insert(cashMovements).values({ sessionId: session.id, ref, recipient, amount, matched: true });
    await db.update(cashSessions).set({
      theorique: session.theorique + amount,
      deliveries: session.deliveries + 1,
    }).where(eq(cashSessions.id, session.id));
  }

  /**
   * Preuve de livraison + encaissement COD → LIVREE. Idempotent.
   * Le `proofLevel` de la commande est **appliqué** : sans les artefacts exigés,
   * la livraison est refusée. Photo et signature sont des data URI déjà compressés
   * par l'app ; leur taille est bornée pour ne pas gonfler la base ni la file hors ligne.
   */
  async proof(schema: string, driver: string | undefined, ref: string, body: ProofInput, key?: string) {
    const d = this.ensure(driver);
    return this.idempotent(schema, key, async () => {
      const cur = await this.ownedOrder(schema, d, ref);
      if (cur.status !== 'LIVRAISON') throw new BadRequestException('Preuve possible en cours de livraison uniquement.');

      const photo = assertArtifact(body?.photo, 'photo', ['image/jpeg', 'image/png']);
      const signature = assertArtifact(body?.signature, 'signature', ['image/png', 'image/svg+xml']);
      const missing = missingProof(cur.proofLevel as ProofLevel, { photo, signature });
      if (missing) throw new BadRequestException(missing);

      const codPaid = cur.cod > 0 ? (body?.codCollected ?? 0) >= cur.cod : false;
      // Une livraison validée alors que le livreur est hors de sa géofence est un signal
      // de risque documenté au barème (`hors_geo`, 28 pts) : il n'était consigné nulle
      // part, faute de quoi que ce soit qui crée un cas de fraude.
      await this.signalerSiHorsZone(schema, d, ref);
      return withTenantDb(schema, async (db) => {
        if (photo || signature) {
          await db.insert(deliveryProofs)
            .values({ ref, photo: photo ?? null, signature: signature ?? null, capturedBy: d })
            .onConflictDoUpdate({
              target: deliveryProofs.ref,
              set: { photo: photo ?? null, signature: signature ?? null, capturedBy: d, capturedAt: new Date() },
            });
        }
        // Ponctualité : minutes de retard et pénalité négociée avec le marchand, figées ici.
        const [fiche] = cur.merchant ? await db.select().from(merchantsTable).where(eq(merchantsTable.name, cur.merchant)) : [];
        const ponctualite = surLivraison(cur as any, termsOf(fiche?.deliveryTerms).penaliteRetard);
        const [r] = await db.update(ordersTable)
          .set({ status: 'LIVREE', codPaid, ...ponctualite })
          .where(eq(ordersTable.ref, ref)).returning();
        await db.insert(orderEventsTable).values({
          ref, status: 'LIVREE', actor: d,
          note: codPaid ? 'Livrée avec preuve · COD encaissé' : 'Livrée avec preuve',
        });
        // L'argent encaissé sur le terrain ouvre (ou alimente) la caisse du jour du
        // livreur. Sans cela, `cash_sessions` ne se remplissait QUE par le jeu de
        // démonstration : sur un tenant réel, la comptabilité voyait « Aucune session de
        // caisse aujourd'hui » alors que des milliers de dirhams circulaient en tournée,
        // et ni le dépôt ni l'écart n'avaient de support.
        // Plafonné au contre-remboursement : un client qui paie 420 DH avec un billet de
        // 500 reçoit 80 DH de monnaie. Compter 500 en caisse accusait ensuite le livreur
        // d'un écart de 80 DH à la déclaration (constaté en recette de l'app « Ma journée »).
        const encaisse = Math.min(Math.max(0, body?.codCollected ?? 0), Math.max(0, cur.cod));
        if (encaisse > 0) await this.porterEnCaisse(db, d, ref, cur.dropContact ?? cur.merchant ?? ref, encaisse);
        return rowToOrder(r);
      }).then(async (livree) => {
        // Le client est prévenu de la livraison de son colis — l'événement le plus attendu
        // de toute la course.
        await this.notifs.notifierEvenement(schema, 'order.delivered', {
          recipient: cur.dropPhone, vars: { code: cur.code },
        });
        return livree;
      });
    });
  }
}
