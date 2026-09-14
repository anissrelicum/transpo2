import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { withTenantDb, fraudCases as fraudTable } from '@transpo/db';
import { fraudScore, FRAUD_SIGNALS, type FraudSignal } from '@transpo/domain';
import { desc, eq } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { JwtUser } from '../auth/jwt.js';

const TRANSITIONS: Record<string, string> = { investigate: 'ENQUETE', clear: 'BLANCHI', confirm: 'CONFIRME' };

@Injectable()
export class FraudService {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  list(schema: string) {
    return withTenantDb(schema, async (db) => db.select().from(fraudTable).orderBy(desc(fraudTable.score)));
  }

  /** Leaderboard des livreurs à risque (score cumulé sur les cas ouverts/enquête). */
  async leaderboard(schema: string) {
    const rows = await this.list(schema);
    const byDriver = new Map<string, { driver: string; cases: number; risk: number }>();
    for (const c of rows) {
      const e = byDriver.get(c.driver) ?? { driver: c.driver, cases: 0, risk: 0 };
      e.cases += 1; e.risk = Math.max(e.risk, c.score);
      byDriver.set(c.driver, e);
    }
    return [...byDriver.values()].sort((a, b) => b.risk - a.risk);
  }

  /**
   * Consigne un signal de risque sur un livreur, et met à jour son cas ouvert.
   *
   * Rien ne créait de cas : `fraud_cases` n'était alimentée que par le jeu de
   * démonstration, si bien que l'écran `/fraud` d'un tenant réel restait vide quoi qu'il
   * se passe sur le terrain. Le barème, lui, existait depuis le début
   * (`FRAUD_SIGNALS` dans @transpo/domain) — il n'était branché sur rien.
   *
   * Un seul cas OUVERT ou EN ENQUÊTE par livreur : les signaux s'y accumulent, le score
   * suit le barème. Un cas arbitré (blanchi, confirmé) n'est jamais rouvert en silence —
   * un nouveau signal ouvre un nouveau cas, visible comme tel.
   */
  async signaler(schema: string, driver: string, signal: FraudSignal, detail: { amount?: number; summary?: string } = {}) {
    if (!driver || !FRAUD_SIGNALS[signal]) return null;
    return withTenantDb(schema, async (db) => {
      const cas = await db.select().from(fraudTable).where(eq(fraudTable.driver, driver));
      const ouvert = cas.find((c) => c.status === 'OUVERT' || c.status === 'ENQUETE');
      const resume = detail.summary ?? FRAUD_SIGNALS[signal].label;
      if (!ouvert) {
        const [r] = await db.insert(fraudTable).values({
          driver, amount: detail.amount ?? 0, signals: [signal],
          score: fraudScore([signal]), status: 'OUVERT', summary: resume,
        }).returning();
        return r;
      }
      const signaux = ouvert.signals.includes(signal)
        ? (ouvert.signals as FraudSignal[])
        : ([...ouvert.signals, signal] as FraudSignal[]);
      const [r] = await db.update(fraudTable).set({
        signals: signaux,
        score: fraudScore(signaux),
        amount: ouvert.amount + (detail.amount ?? 0),
        summary: ouvert.summary && ouvert.summary !== resume ? `${ouvert.summary} · ${resume}` : resume,
      }).where(eq(fraudTable.id, ouvert.id)).returning();
      return r;
    });
  }

  /** Action de revue humaine (enquête / blanchir / confirmer) — tracée en audit. */
  async act(schema: string, tenant: string, actor: JwtUser, id: string, action: string) {
    const status = TRANSITIONS[action];
    if (!status) throw new BadRequestException('Action invalide.');
    const updated = await withTenantDb(schema, async (db) => {
      const [c] = await db.select().from(fraudTable).where(eq(fraudTable.id, id));
      if (!c) throw new NotFoundException('Cas introuvable.');
      const [r] = await db.update(fraudTable).set({ status }).where(eq(fraudTable.id, id)).returning();
      return r;
    });
    await this.audit.record(actor, `fraud.${action}`, { tenant, target: id, detail: { status } });
    return updated;
  }
}
