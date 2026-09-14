import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { withTenantDb, notifConsents, notifications, orders as ordersTable } from '@transpo/db';
import { eq, or } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { JwtUser } from '../auth/jwt.js';

/**
 * Droits des personnes (RGPD / loi 09-08) : portabilité (export) et effacement.
 * Portée : données rattachées à un destinataire (téléphone/e-mail) dans le tenant.
 */
@Injectable()
export class PrivacyService {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  /**
   * Export des données d'une personne (portabilité).
   *
   * Les COURSES sont rendues : c'est là que vivent les données de la personne — contact,
   * téléphone, adresse, instructions d'accès. Un export qui n'aurait montré que ses
   * consentements et ses SMS aurait laissé croire que le transporteur n'en détient pas
   * davantage.
   */
  async export(schema: string, subject: string) {
    if (!subject) throw new BadRequestException('subject requis.');
    return withTenantDb(schema, async (db) => {
      const consents = await db.select().from(notifConsents).where(eq(notifConsents.subject, subject));
      const notifs = await db.select().from(notifications).where(eq(notifications.recipient, subject));
      const courses = await db.select().from(ordersTable)
        .where(or(eq(ordersTable.dropPhone, subject), eq(ordersTable.pickupPhone, subject)));
      return {
        subject, consents, notifications: notifs,
        orders: courses.map((o) => ({
          ref: o.ref, code: o.code, status: o.status, createdAt: o.createdAt,
          fromCity: o.fromCity, toCity: o.toCity, cod: o.cod,
          pickupContact: o.pickupContact, pickupPhone: o.pickupPhone,
          pickupAddress: o.pickupAddress, pickupNotes: o.pickupNotes,
          dropContact: o.dropContact, dropPhone: o.dropPhone,
          dropAddress: o.dropAddress, dropNotes: o.dropNotes,
        })),
        exportedAt: new Date().toISOString(),
      };
    });
  }

  /** Effacement / anonymisation des données d'une personne. Tracé. */
  async erase(schema: string, tenant: string, actor: JwtUser, subject: string) {
    if (!subject) throw new BadRequestException('subject requis.');
    const result = await withTenantDb(schema, async (db) => {
      const delC = await db.delete(notifConsents).where(eq(notifConsents.subject, subject)).returning();
      const anon = await db.update(notifications)
        .set({ recipient: 'anonymise', body: '[effacé]' })
        .where(eq(notifications.recipient, subject)).returning();

      // Les COURSES portent l'essentiel des données de la personne : les laisser intactes
      // faisait de cet effacement une formalité sans effet — le téléphone, l'adresse et
      // les instructions d'accès restaient lisibles sur chaque fiche, et le suivi client
      // continuait de les servir. On ANONYMISE sans supprimer : la commande reste due,
      // facturée et comptée ; c'est la personne qui disparaît, pas l'écriture comptable.
      const anonCourse = { dropContact: 'Personne anonymisée', dropPhone: null, dropAddress: null, dropNotes: null };
      const livraisons = await db.update(ordersTable).set(anonCourse)
        .where(eq(ordersTable.dropPhone, subject)).returning();
      const retraits = await db.update(ordersTable)
        .set({ pickupContact: 'Personne anonymisée', pickupPhone: null, pickupAddress: null, pickupNotes: null })
        .where(eq(ordersTable.pickupPhone, subject)).returning();

      return {
        consentsDeleted: delC.length,
        notificationsAnonymised: anon.length,
        ordersAnonymised: livraisons.length + retraits.length,
      };
    });
    await this.audit.record(actor, 'privacy.erase', { tenant, target: subject, detail: result });
    return { subject, ...result };
  }
}
