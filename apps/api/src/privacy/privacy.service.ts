import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { withTenantDb, notifConsents, notifications } from '@transpo/db';
import { eq } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { JwtUser } from '../auth/jwt.js';

/**
 * Droits des personnes (RGPD / loi 09-08) : portabilité (export) et effacement.
 * Portée : données rattachées à un destinataire (téléphone/e-mail) dans le tenant.
 */
@Injectable()
export class PrivacyService {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  /** Export des données d'une personne (portabilité). */
  async export(schema: string, subject: string) {
    if (!subject) throw new BadRequestException('subject requis.');
    return withTenantDb(schema, async (db) => {
      const consents = await db.select().from(notifConsents).where(eq(notifConsents.subject, subject));
      const notifs = await db.select().from(notifications).where(eq(notifications.recipient, subject));
      return { subject, consents, notifications: notifs, exportedAt: null as string | null };
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
      return { consentsDeleted: delC.length, notificationsAnonymised: anon.length };
    });
    await this.audit.record(actor, 'privacy.erase', { tenant, target: subject, detail: result });
    return { subject, ...result };
  }
}
