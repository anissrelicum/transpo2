import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { pool, withTenantDb, orders as ordersTable } from '@transpo/db';
import { eq } from 'drizzle-orm';
import { LIFECYCLE, STATUS_META, type OrderStatus } from '@transpo/domain';

/**
 * Suivi public du client final : PAS d'authentification.
 * Le tenant vient du lien de suivi (segment d'URL), validé côté serveur.
 * On n'expose que le strict nécessaire (pas de PII sensible) — cf. PRD-04 / RGPD-09-08.
 */
@Injectable()
export class PublicService {
  private async schemaOf(slug: string): Promise<string> {
    const { rows } = await pool.query('SELECT slug FROM platform.tenants WHERE slug = $1', [slug]);
    if (!rows.length) throw new NotFoundException('Suivi introuvable.');
    return `tenant_${slug}`;
  }

  /** Timeline de suivi par code de commande (sans compte). */
  async track(slug: string, code: string) {
    const schema = await this.schemaOf(slug);
    const o = await withTenantDb(schema, async (db) => {
      const [r] = await db.select().from(ordersTable).where(eq(ordersTable.code, code));
      return r;
    });
    if (!o) throw new NotFoundException('Suivi introuvable.');

    const status = o.status as OrderStatus;
    const idx = LIFECYCLE.indexOf(status);
    const steps = LIFECYCLE.map((s, i) => ({
      status: s, label: STATUS_META[s].fr, done: idx >= 0 && i <= idx,
    }));
    const terminal = ['LIVREE', 'ECHOUEE', 'RETOUR', 'ANNULEE'].includes(status);
    return {
      code: o.code,
      status, statusLabel: STATUS_META[status].fr, color: STATUS_META[status].color,
      from: o.fromCity, to: o.toCity,
      steps,
      delivered: status === 'LIVREE',
      canRate: status === 'LIVREE' && o.rating == null,
      rating: o.rating ?? null,
      terminal,
    };
  }

  /** Notation post-livraison (1..5) laissée par le client. */
  async rate(slug: string, code: string, score: number, comment?: string) {
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      throw new BadRequestException('Note invalide (1 à 5).');
    }
    const schema = await this.schemaOf(slug);
    return withTenantDb(schema, async (db) => {
      const [o] = await db.select().from(ordersTable).where(eq(ordersTable.code, code));
      if (!o) throw new NotFoundException('Suivi introuvable.');
      if (o.status !== 'LIVREE') throw new BadRequestException('Notation possible après livraison uniquement.');
      if (o.rating != null) throw new BadRequestException('Commande déjà notée.');
      const [r] = await db.update(ordersTable)
        .set({ rating: score, ratingComment: comment ?? null })
        .where(eq(ordersTable.code, code)).returning();
      return { code: r.code, rating: r.rating, ratingComment: r.ratingComment };
    });
  }
}
