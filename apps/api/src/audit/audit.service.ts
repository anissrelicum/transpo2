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
}
