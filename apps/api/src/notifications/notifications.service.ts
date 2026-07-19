import { Injectable, BadRequestException } from '@nestjs/common';
import { withTenantDb, notifConsents, notifications } from '@transpo/db';
import { and, desc, eq } from 'drizzle-orm';
import { NOTIF_CHANNELS, NOTIF_TEMPLATES, renderNotif, requiresConsent, type NotifChannel } from '@transpo/domain';

export interface SendInput {
  event: string; recipient: string; channel: NotifChannel;
  lang?: 'fr' | 'ar'; vars?: Record<string, string>;
}

@Injectable()
export class NotificationsService {
  private assertChannel(c: string): NotifChannel {
    if (!NOTIF_CHANNELS.includes(c as NotifChannel)) throw new BadRequestException(`Canal inconnu : ${c}`);
    return c as NotifChannel;
  }

  /** Consentement (loi 09-08) : opt-in/opt-out par destinataire et canal. */
  async setConsent(schema: string, subject: string, channel: string, optedIn: boolean) {
    if (!subject) throw new BadRequestException('Destinataire requis.');
    const ch = this.assertChannel(channel);
    return withTenantDb(schema, async (db) => {
      const [r] = await db.insert(notifConsents)
        .values({ subject, channel: ch, optedIn })
        .onConflictDoUpdate({
          target: [notifConsents.subject, notifConsents.channel],
          set: { optedIn, updatedAt: new Date() },
        })
        .returning();
      return r;
    });
  }

  consents(schema: string, subject: string) {
    return withTenantDb(schema, async (db) =>
      db.select().from(notifConsents).where(eq(notifConsents.subject, subject)));
  }

  private async hasConsent(schema: string, subject: string, channel: NotifChannel): Promise<boolean> {
    const rows = await withTenantDb(schema, async (db) =>
      db.select().from(notifConsents)
        .where(and(eq(notifConsents.subject, subject), eq(notifConsents.channel, channel))));
    return rows[0]?.optedIn === true;
  }

  /**
   * Envoi (simulé). Un événement marketing exige un consentement pour le canal ;
   * un transactionnel en est exempté (09-08). Trace la notification (centre admin).
   */
  async send(schema: string, input: SendInput) {
    if (!NOTIF_TEMPLATES[input.event]) throw new BadRequestException(`Événement inconnu : ${input.event}`);
    const channel = this.assertChannel(input.channel);
    if (!input.recipient) throw new BadRequestException('Destinataire requis.');
    const lang = input.lang === 'ar' ? 'ar' : 'fr';
    const body = renderNotif(input.event, lang, input.vars);

    let status = 'SENT';
    let reason: string | null = null;
    if (requiresConsent(input.event) && !(await this.hasConsent(schema, input.recipient, channel))) {
      status = 'BLOCKED';
      reason = 'Consentement marketing absent (loi 09-08).';
    }
    return withTenantDb(schema, async (db) => {
      const [r] = await db.insert(notifications)
        .values({ event: input.event, channel, recipient: input.recipient, lang, body, status, reason })
        .returning();
      return r;
    });
  }

  /** Centre de notifications (admin) — filtres statut/canal. */
  list(schema: string, filters: { status?: string; channel?: string } = {}) {
    return withTenantDb(schema, async (db) => {
      const rows = await db.select().from(notifications).orderBy(desc(notifications.createdAt));
      return rows.filter((n) =>
        (!filters.status || n.status === filters.status) &&
        (!filters.channel || n.channel === filters.channel));
    });
  }
}
