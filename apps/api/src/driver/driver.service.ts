import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Inject } from '@nestjs/common';
import { ReturnsService } from '../returns/returns.service.js';
import { withTenantDb, orders as ordersTable, idempotencyKeys, deliveryProofs } from '@transpo/db';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { LIFECYCLE, missingProof, type Order, type OrderStatus, type ProofLevel } from '@transpo/domain';

const ACTIVE: OrderStatus[] = ['ASSIGNEE', 'RETRAIT', 'RECUPEREE', 'LIVRAISON'];
// ~700 Ko de data URI ≈ 500 Ko binaire : large pour une photo compressée par l'app,
// assez bas pour ne pas saturer la base ni la file d'attente hors ligne du mobile.
const MAX_ARTIFACT_CHARS = 700_000;

export interface ProofInput { codCollected?: number; photo?: string | null; signature?: string | null }

function rowToOrder(r: any): Order {
  return { ...r, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt } as Order;
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
  constructor(@Inject(ReturnsService) private readonly returns: ReturnsService) {}

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
        const [r] = await db.update(ordersTable).set({ status: next }).where(eq(ordersTable.ref, ref)).returning();
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
      return this.returns.fail(schema, ref, reason.trim());
    });
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
      return withTenantDb(schema, async (db) => {
        if (photo || signature) {
          await db.insert(deliveryProofs)
            .values({ ref, photo: photo ?? null, signature: signature ?? null, capturedBy: d })
            .onConflictDoUpdate({
              target: deliveryProofs.ref,
              set: { photo: photo ?? null, signature: signature ?? null, capturedBy: d, capturedAt: new Date() },
            });
        }
        const [r] = await db.update(ordersTable)
          .set({ status: 'LIVREE', codPaid })
          .where(eq(ordersTable.ref, ref)).returning();
        return rowToOrder(r);
      });
    });
  }
}
