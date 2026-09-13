import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import type { Order, OrderStatus, ParcelSize, ProofLevel } from '@transpo/domain';
import { LIFECYCLE, canTransition, PARCEL_SIZES, PROOF_LEVELS } from '@transpo/domain';
import { withTenantDb, orders as ordersTable, orderEvents as orderEventsTable, deliveryProofs } from '@transpo/db';
import { desc, eq } from 'drizzle-orm';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function rndCode(): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}
let refCounter = 0;
function nextRef(): string {
  // Unique : date + base36(timestamp) + compteur process (évite les collisions sous charge).
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const uniq = (Date.now().toString(36) + (refCounter++).toString(36)).toUpperCase();
  return `CMD-${day}-${uniq}`;
}

export interface CreateOrderInput {
  merchant?: string; fromCity: string; toCity: string;
  cod?: number; size?: ParcelSize; proofLevel?: ProofLevel; scheduled?: boolean;
  // Coordonnées des deux points de la course. L'assistant les demandait déjà ; elles
  // n'étaient simplement transmises nulle part.
  pickupContact?: string; pickupPhone?: string; pickupAddress?: string; pickupNotes?: string;
  dropContact?: string; dropPhone?: string; dropAddress?: string; dropNotes?: string;
  description?: string; vehicleType?: string;
}

const PHONE_RE = /^\+?[0-9\s-]{9,15}$/;
/** Nettoie une chaîne facultative : vide ou blanche → `null`. */
const texte = (v?: string): string | null => (v?.trim() ? v.trim() : null);

/**
 * Enregistre une transition au journal de la commande.
 * Écrit dans la même unité de travail que le changement de statut : un statut sans trace
 * serait exactement le trou que TC-F11 a mis au jour.
 */
async function journaliser(db: any, ref: string, status: string, actor?: string | null, note?: string | null) {
  await db.insert(orderEventsTable).values({ ref, status, actor: actor ?? null, note: note ?? null });
}

function rowToOrder(r: any): Order {
  return { ...r, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt } as Order;
}

@Injectable()
export class OrdersService {
  /** Liste (filtre statut optionnel). */
  list(schema: string, status?: OrderStatus): Promise<Order[]> {
    return withTenantDb(schema, async (db) => {
      const rows = status
        ? await db.select().from(ordersTable).where(eq(ordersTable.status, status)).orderBy(desc(ordersTable.createdAt))
        : await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));
      return rows.map(rowToOrder);
    });
  }

  get(schema: string, ref: string): Promise<Order> {
    return withTenantDb(schema, async (db) => {
      const [r] = await db.select().from(ordersTable).where(eq(ordersTable.ref, ref));
      if (!r) throw new NotFoundException(`Commande introuvable : ${ref}`);
      return rowToOrder(r);
    });
  }

  create(schema: string, input: CreateOrderInput, actor?: string): Promise<Order> {
    // Validation du corps avant tout accès SQL : un corps vide ou incomplet
    // renvoie 400, pas une erreur de contrainte NOT NULL (500).
    const missing: string[] = [];
    if (!input?.fromCity?.trim()) missing.push('fromCity');
    if (!input?.toCity?.trim()) missing.push('toCity');
    if (missing.length) throw new BadRequestException(`Champs requis manquants : ${missing.join(', ')}.`);
    if (input.size !== undefined && !PARCEL_SIZES.includes(input.size)) {
      throw new BadRequestException(`Taille invalide : ${input.size} (attendu : ${PARCEL_SIZES.join(', ')}).`);
    }
    if (input.proofLevel !== undefined && !PROOF_LEVELS.includes(input.proofLevel)) {
      throw new BadRequestException(`Niveau de preuve invalide : ${input.proofLevel} (attendu : ${PROOF_LEVELS.join(', ')}).`);
    }
    for (const [champ, valeur] of [['pickupPhone', input.pickupPhone], ['dropPhone', input.dropPhone]] as const) {
      if (valeur?.trim() && !PHONE_RE.test(valeur.trim())) {
        throw new BadRequestException(`Téléphone invalide (${champ === 'pickupPhone' ? 'retrait' : 'livraison'}).`);
      }
    }
    return withTenantDb(schema, async (db) => {
      const row = {
        ref: nextRef(), code: rndCode(),
        status: (input.scheduled ? 'PROGRAMMEE' : 'NOUVELLE') as OrderStatus,
        merchant: input.merchant ?? null,
        fromCity: input.fromCity, toCity: input.toCity,
        driver: null as string | null,
        cod: input.cod ?? 0, codPaid: false,
        size: input.size ?? 'Moyen',
        proofLevel: (input.proofLevel ?? 'photo_signature') as ProofLevel,
        pickupContact: texte(input.pickupContact), pickupPhone: texte(input.pickupPhone),
        pickupAddress: texte(input.pickupAddress), pickupNotes: texte(input.pickupNotes),
        dropContact: texte(input.dropContact), dropPhone: texte(input.dropPhone),
        dropAddress: texte(input.dropAddress), dropNotes: texte(input.dropNotes),
        description: texte(input.description), vehicleType: texte(input.vehicleType),
      };
      const [r] = await db.insert(ordersTable).values(row).returning();
      await journaliser(db, r.ref, r.status, actor, 'Commande créée');
      return rowToOrder(r);
    });
  }

  /** Fait progresser au statut suivant du cycle nominal (validé via domain). */
  advance(schema: string, ref: string, actor?: string): Promise<Order> {
    return withTenantDb(schema, async (db) => {
      const [cur] = await db.select().from(ordersTable).where(eq(ordersTable.ref, ref));
      if (!cur) throw new NotFoundException(`Commande introuvable : ${ref}`);
      const i = LIFECYCLE.indexOf(cur.status as OrderStatus);
      if (i < 0 || i >= LIFECYCLE.length - 1) throw new BadRequestException('Aucune progression possible.');
      const next = LIFECYCLE[i + 1];
      // La clôture d'une livraison passe par la preuve, depuis l'app livreur
      // (`/v1/driver/orders/:ref/proof`) : la console la refusait dans son menu mais
      // l'API l'acceptait, ce qui permettait de déclarer « Livrée » sans photo ni
      // signature — et donc sans rien à opposer à une contestation ou à un COD.
      if (next === 'LIVREE') {
        throw new BadRequestException('La livraison se clôture par la preuve, depuis l’app livreur.');
      }
      const [r] = await db.update(ordersTable).set({ status: next }).where(eq(ordersTable.ref, ref)).returning();
      await journaliser(db, ref, next, actor);
      return rowToOrder(r);
    });
  }

  assign(schema: string, ref: string, driverName: string, actor?: string): Promise<Order> {
    return withTenantDb(schema, async (db) => {
      const [cur] = await db.select().from(ordersTable).where(eq(ordersTable.ref, ref));
      if (!cur) throw new NotFoundException(`Commande introuvable : ${ref}`);
      const status = (cur.status === 'NOUVELLE' || cur.status === 'PROGRAMMEE') ? 'ASSIGNEE' : cur.status;
      const [r] = await db.update(ordersTable).set({ driver: driverName, status }).where(eq(ordersTable.ref, ref)).returning();
      await journaliser(db, ref, status, actor, `Affectée à ${driverName}`);
      return rowToOrder(r);
    });
  }

  cancel(schema: string, ref: string, actor?: string): Promise<Order> {
    return withTenantDb(schema, async (db) => {
      const [cur] = await db.select().from(ordersTable).where(eq(ordersTable.ref, ref));
      if (!cur) throw new NotFoundException(`Commande introuvable : ${ref}`);
      if (!canTransition(cur.status as OrderStatus, 'ANNULEE')) throw new BadRequestException('Annulation impossible.');
      const [r] = await db.update(ordersTable).set({ status: 'ANNULEE' }).where(eq(ordersTable.ref, ref)).returning();
      await journaliser(db, ref, 'ANNULEE', actor);
      return rowToOrder(r);
    });
  }

  /** Journal des transitions d'une commande, du plus ancien au plus récent. */
  events(schema: string, ref: string) {
    return withTenantDb(schema, async (db) => {
      const [o] = await db.select().from(ordersTable).where(eq(ordersTable.ref, ref));
      if (!o) throw new NotFoundException(`Commande introuvable : ${ref}`);
      const rows = await db.select().from(orderEventsTable)
        .where(eq(orderEventsTable.ref, ref))
        .orderBy(orderEventsTable.at);
      return rows.map((e: any) => ({
        status: e.status,
        actor: e.actor,
        note: e.note,
        at: e.at instanceof Date ? e.at.toISOString() : e.at,
      }));
    });
  }

  /**
   * Preuve de livraison d'une commande. `captured: false` quand le livreur n'a
   * rien déposé — le cas normal pour une commande de niveau « aucune », ou pour
   * les livraisons antérieures à l'application de la règle.
   */
  proof(schema: string, ref: string) {
    return withTenantDb(schema, async (db) => {
      const [o] = await db.select().from(ordersTable).where(eq(ordersTable.ref, ref));
      if (!o) throw new NotFoundException(`Commande introuvable : ${ref}`);
      const [p] = await db.select().from(deliveryProofs).where(eq(deliveryProofs.ref, ref));
      if (!p) return { ref, proofLevel: o.proofLevel, captured: false, photo: null, signature: null, capturedBy: null, capturedAt: null };
      return {
        ref, proofLevel: o.proofLevel, captured: true,
        photo: p.photo, signature: p.signature,
        capturedBy: p.capturedBy, capturedAt: p.capturedAt.toISOString(),
      };
    });
  }
}
