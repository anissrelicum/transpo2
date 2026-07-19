import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { withTenantDb, fraudCases as fraudTable } from '@transpo/db';
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
