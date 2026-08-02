import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { withTenantDb, notifConsents, notifications, notifTemplates } from '@transpo/db';
import { and, desc, eq } from 'drizzle-orm';
import { NOTIF_CHANNELS, NOTIF_TEMPLATES, renderTemplate, type NotifChannel } from '@transpo/domain';

export interface SendInput {
  event: string; recipient: string; channel: NotifChannel;
  lang?: 'fr' | 'ar'; vars?: Record<string, string>;
}

interface ResolvedTemplate { event: string; fr: string; ar: string; transactional: boolean; active: boolean }

const EVENT_RE = /^[a-z][a-z0-9]*(\.[a-z0-9]+)*$/;

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
   * Catalogue de modèles du tenant. Les événements du catalogue `@transpo/domain`
   * non encore persistés sont retournés à leur valeur d'origine (tenant pas encore semé).
   */
  async listTemplates(schema: string): Promise<(ResolvedTemplate & { customized: boolean; updatedAt: string | null })[]> {
    const rows = await withTenantDb(schema, async (db) =>
      db.select().from(notifTemplates).orderBy(notifTemplates.event));
    const byEvent = new Map(rows.map((r) => [r.event, r]));
    const events = [...new Set([...Object.keys(NOTIF_TEMPLATES), ...byEvent.keys()])].sort();
    return events.map((event) => {
      const row = byEvent.get(event);
      const def = NOTIF_TEMPLATES[event];
      if (!row) {
        return { event, fr: def!.fr, ar: def!.ar, transactional: def!.transactional, active: true, customized: false, updatedAt: null };
      }
      return {
        event: row.event, fr: row.fr, ar: row.ar, transactional: row.transactional, active: row.active,
        // « Personnalisé » : diverge du catalogue d'origine, ou n'y figure pas du tout.
        customized: !def || def.fr !== row.fr || def.ar !== row.ar,
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }

  /** Résout le modèle applicable : version persistée d'abord, catalogue d'origine en repli. */
  private async resolveTemplate(schema: string, event: string): Promise<ResolvedTemplate> {
    const rows = await withTenantDb(schema, async (db) =>
      db.select().from(notifTemplates).where(eq(notifTemplates.event, event)));
    const row = rows[0];
    if (row) return { event, fr: row.fr, ar: row.ar, transactional: row.transactional, active: row.active };
    const def = NOTIF_TEMPLATES[event];
    if (!def) throw new BadRequestException(`Événement inconnu : ${event}`);
    return { event, fr: def.fr, ar: def.ar, transactional: def.transactional, active: true };
  }

  async saveTemplate(schema: string, event: string, input: { fr?: string; ar?: string; transactional?: boolean; active?: boolean }) {
    if (!event || !EVENT_RE.test(event)) throw new BadRequestException('Identifiant d’événement invalide (ex. order.created).');
    const current = await this.resolveTemplate(schema, event).catch(() => null);
    const fr = (input.fr ?? current?.fr ?? '').trim();
    const ar = (input.ar ?? current?.ar ?? '').trim();
    if (!fr) throw new BadRequestException('Le texte français est requis.');
    if (!ar) throw new BadRequestException('Le texte arabe est requis.');
    const transactional = input.transactional ?? current?.transactional ?? true;
    const active = input.active ?? current?.active ?? true;
    return withTenantDb(schema, async (db) => {
      const [r] = await db.insert(notifTemplates)
        .values({ event, fr, ar, transactional, active })
        .onConflictDoUpdate({
          target: notifTemplates.event,
          set: { fr, ar, transactional, active, updatedAt: new Date() },
        })
        .returning();
      return r;
    });
  }

  /** Restaure un modèle à sa valeur d'origine ; un événement hors catalogue est supprimé. */
  async resetTemplate(schema: string, event: string) {
    const def = NOTIF_TEMPLATES[event];
    return withTenantDb(schema, async (db) => {
      if (!def) {
        const [r] = await db.delete(notifTemplates).where(eq(notifTemplates.event, event)).returning();
        if (!r) throw new NotFoundException('Modèle introuvable.');
        return { ok: true, event, removed: true };
      }
      const [r] = await db.insert(notifTemplates)
        .values({ event, fr: def.fr, ar: def.ar, transactional: def.transactional, active: true })
        .onConflictDoUpdate({
          target: notifTemplates.event,
          set: { fr: def.fr, ar: def.ar, transactional: def.transactional, active: true, updatedAt: new Date() },
        })
        .returning();
      return r;
    });
  }

  /**
   * Envoi (simulé). Un événement marketing exige un consentement pour le canal ;
   * un transactionnel en est exempté (09-08). Trace la notification (centre admin).
   */
  async send(schema: string, input: SendInput) {
    const tpl = await this.resolveTemplate(schema, input.event);
    const channel = this.assertChannel(input.channel);
    if (!input.recipient) throw new BadRequestException('Destinataire requis.');
    const lang = input.lang === 'ar' ? 'ar' : 'fr';
    const body = renderTemplate(lang === 'ar' ? tpl.ar : tpl.fr, input.vars);
    return this.deliver(schema, { event: input.event, channel, recipient: input.recipient, lang, body }, tpl);
  }

  /**
   * Rejoue une notification bloquée ou en file. Le corps déjà rendu est conservé tel quel
   * (les variables d'origine ne sont pas stockées) ; seules les règles d'envoi sont réévaluées.
   */
  async retry(schema: string, id: string) {
    const rows = await withTenantDb(schema, async (db) =>
      db.select().from(notifications).where(eq(notifications.id, id)));
    const n = rows[0];
    if (!n) throw new NotFoundException('Notification introuvable.');
    if (n.status === 'SENT') throw new BadRequestException('Notification déjà envoyée.');
    const tpl = await this.resolveTemplate(schema, n.event);
    const channel = this.assertChannel(n.channel);
    return this.deliver(schema, {
      event: n.event, channel, recipient: n.recipient, lang: n.lang as 'fr' | 'ar', body: n.body,
    }, tpl);
  }

  /** Applique les règles d'envoi (modèle actif, consentement 09-08) et trace le résultat. */
  private async deliver(
    schema: string,
    msg: { event: string; channel: NotifChannel; recipient: string; lang: 'fr' | 'ar'; body: string },
    tpl: ResolvedTemplate,
  ) {
    let status = 'SENT';
    let reason: string | null = null;
    if (!tpl.active) {
      status = 'BLOCKED';
      reason = 'Modèle désactivé pour ce tenant.';
    } else if (!tpl.transactional && !(await this.hasConsent(schema, msg.recipient, msg.channel))) {
      status = 'BLOCKED';
      reason = 'Consentement marketing absent (loi 09-08).';
    }
    return withTenantDb(schema, async (db) => {
      const [r] = await db.insert(notifications).values({ ...msg, status, reason }).returning();
      return r;
    });
  }

  /** Centre de notifications (admin) — filtres statut/canal/événement. */
  list(schema: string, filters: { status?: string; channel?: string; event?: string } = {}) {
    return withTenantDb(schema, async (db) => {
      const rows = await db.select().from(notifications).orderBy(desc(notifications.createdAt));
      return rows.filter((n) =>
        (!filters.status || n.status === filters.status) &&
        (!filters.channel || n.channel === filters.channel) &&
        (!filters.event || n.event === filters.event));
    });
  }
}
