import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { withTenantDb, orders as ordersTable } from '@transpo/db';
import { and, eq, isNotNull } from 'drizzle-orm';
import type { Order } from '@transpo/domain';

const PHASES = ['arrive', 'trier', 'quai'] as const;
type Phase = (typeof PHASES)[number];

function rowToOrder(r: any): Order {
  return { ...r, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt } as Order;
}

@Injectable()
export class HubService {
  /** Colis présents dans le hub (hub_phase renseignée). */
  list(schema: string): Promise<Order[]> {
    return withTenantDb(schema, async (db) => {
      const rows = await db.select().from(ordersTable).where(isNotNull(ordersTable.hubPhase));
      return rows.map(rowToOrder);
    });
  }

  /**
   * Scan d'entrée : le colis est déclaré ARRIVÉ au hub, en attente du scan de tri.
   *
   * L'entrée posait directement la phase `trier`, en sautant la première colonne du
   * tableau de tri : « Arrivés — à scanner » et son indicateur « À scanner » ne pouvaient
   * donc JAMAIS se remplir sur un tenant réel (seul le jeu de démonstration en posait).
   * Le hub affichait trois colonnes dont une morte, et l'agent n'avait aucun moyen de
   * distinguer ce qui vient d'entrer de ce qui est déjà scanné et prêt à trier.
   */
  async scan(schema: string, code: string): Promise<Order> {
    if (!code || code.length !== 8) throw new BadRequestException('Code colis invalide (8 caractères).');
    return withTenantDb(schema, async (db) => {
      const [o] = await db.select().from(ordersTable).where(eq(ordersTable.code, code.toUpperCase()));
      if (!o) throw new NotFoundException('Code inconnu sur ce hub.');
      // Une course close ou annulée n'entre pas dans un hub : l'accepter fabriquerait un
      // colis fantôme sur le quai, avec son COD compté au manifeste de transfert.
      if (['LIVREE', 'ANNULEE', 'RETOUR'].includes(o.status)) {
        throw new BadRequestException(`Colis non transportable (commande ${o.status.toLowerCase()}).`);
      }
      const [r] = await db.update(ordersTable).set({ hubPhase: 'arrive' })
        .where(eq(ordersTable.code, code.toUpperCase())).returning();
      return rowToOrder(r);
    });
  }

  /** Déplace un colis vers une phase (arrive → trier → quai). */
  async setPhase(schema: string, ref: string, phase: string): Promise<Order> {
    if (!PHASES.includes(phase as Phase)) throw new BadRequestException(`Phase invalide : ${phase}`);
    return withTenantDb(schema, async (db) => {
      const [o] = await db.select().from(ordersTable).where(eq(ordersTable.ref, ref));
      if (!o) throw new NotFoundException(`Commande introuvable : ${ref}`);
      const [r] = await db.update(ordersTable).set({ hubPhase: phase }).where(eq(ordersTable.ref, ref)).returning();
      return rowToOrder(r);
    });
  }
}
