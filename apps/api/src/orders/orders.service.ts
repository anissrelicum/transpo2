import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import type { Order, OrderStatus, ParcelSize, ProofLevel } from '@transpo/domain';
import { LIFECYCLE, canTransition } from '@transpo/domain';
import { withTenantDb, orders as ordersTable, drivers as driversTable } from '@transpo/db';
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

  create(schema: string, input: CreateOrderInput): Promise<Order> {
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
      };
      const [r] = await db.insert(ordersTable).values(row).returning();
      return rowToOrder(r);
    });
  }

  /** Fait progresser au statut suivant du cycle nominal (validé via domain). */
  advance(schema: string, ref: string): Promise<Order> {
    return withTenantDb(schema, async (db) => {
      const [cur] = await db.select().from(ordersTable).where(eq(ordersTable.ref, ref));
      if (!cur) throw new NotFoundException(`Commande introuvable : ${ref}`);
      const i = LIFECYCLE.indexOf(cur.status as OrderStatus);
      if (i < 0 || i >= LIFECYCLE.length - 1) throw new BadRequestException('Aucune progression possible.');
      const next = LIFECYCLE[i + 1];
      const [r] = await db.update(ordersTable).set({ status: next }).where(eq(ordersTable.ref, ref)).returning();
      return rowToOrder(r);
    });
  }

  assign(schema: string, ref: string, driverName: string): Promise<Order> {
    return withTenantDb(schema, async (db) => {
      const [cur] = await db.select().from(ordersTable).where(eq(ordersTable.ref, ref));
      if (!cur) throw new NotFoundException(`Commande introuvable : ${ref}`);
      const status = (cur.status === 'NOUVELLE' || cur.status === 'PROGRAMMEE') ? 'ASSIGNEE' : cur.status;
      const [r] = await db.update(ordersTable).set({ driver: driverName, status }).where(eq(ordersTable.ref, ref)).returning();
      return rowToOrder(r);
    });
  }

  cancel(schema: string, ref: string): Promise<Order> {
    return withTenantDb(schema, async (db) => {
      const [cur] = await db.select().from(ordersTable).where(eq(ordersTable.ref, ref));
      if (!cur) throw new NotFoundException(`Commande introuvable : ${ref}`);
      if (!canTransition(cur.status as OrderStatus, 'ANNULEE')) throw new BadRequestException('Annulation impossible.');
      const [r] = await db.update(ordersTable).set({ status: 'ANNULEE' }).where(eq(ordersTable.ref, ref)).returning();
      return rowToOrder(r);
    });
  }

  listDrivers(schema: string) {
    return withTenantDb(schema, async (db) => db.select().from(driversTable).orderBy(driversTable.name));
  }
}
