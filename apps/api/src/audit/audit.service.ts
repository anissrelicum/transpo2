import { Injectable } from '@nestjs/common';
import { pool } from '@transpo/db';
import type { JwtUser } from '../auth/jwt.js';

/** Journal d'audit des actions sensibles (platform.audit_log). Cf. skill transpo-auth-security. */
@Injectable()
export class AuditService {
  async record(
    actor: JwtUser,
    action: string,
    opts: { tenant?: string; target?: string; detail?: unknown } = {},
  ): Promise<void> {
    await pool.query(
      `INSERT INTO platform.audit_log (actor, actor_role, tenant, action, target, detail)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        actor.sub,
        actor.role,
        opts.tenant ?? null,
        action,
        opts.target ?? null,
        opts.detail ? JSON.stringify(opts.detail) : null,
      ],
    );
  }

  /** Lecture du journal (observabilité sécurité) — filtres optionnels. */
  async recent(filters: { tenant?: string; action?: string; limit?: number } = {}) {
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
    const conds: string[] = [];
    const params: unknown[] = [];
    if (filters.tenant) { params.push(filters.tenant); conds.push(`tenant = $${params.length}`); }
    if (filters.action) { params.push(filters.action); conds.push(`action = $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    params.push(limit);
    const { rows } = await pool.query(
      `SELECT id, at, actor, actor_role AS "actorRole", tenant, action, target, detail
         FROM platform.audit_log ${where} ORDER BY at DESC LIMIT $${params.length}`,
      params,
    );
    return rows;
  }
}
