import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { withTenantDb, hashPassword, users as usersTable } from '@transpo/db';
import { and, eq, ne } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service.js';
import type { JwtUser } from '../auth/jwt.js';

const CONSOLE_ROLES = ['ADMIN', 'DISPATCHER', 'COMPTABLE'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function genTempPassword(): string {
  return randomBytes(9).toString('base64url');
}

function safe<T extends { passwordHash?: unknown }>(row: T): Omit<T, 'passwordHash'> {
  const { passwordHash, ...rest } = row;
  return rest;
}

@Injectable()
export class UsersService {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  list(schema: string) {
    return withTenantDb(schema, async (db) => {
      const rows = await db.select().from(usersTable).orderBy(usersTable.name);
      return rows.filter((u) => CONSOLE_ROLES.includes(u.role)).map(safe);
    });
  }

  /** Invite un utilisateur console (ADMIN/DISPATCHER/COMPTABLE) — mot de passe temporaire retourné une seule fois. */
  async invite(schema: string, tenant: string, actor: JwtUser, input: { email?: string; name?: string; role?: string }) {
    const email = input.email?.trim().toLowerCase();
    const name = input.name?.trim();
    if (!email || !EMAIL_RE.test(email)) throw new BadRequestException('Email invalide.');
    if (!name) throw new BadRequestException('Nom requis.');
    if (!input.role || !CONSOLE_ROLES.includes(input.role)) throw new BadRequestException('Rôle invalide.');

    const tempPassword = genTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    const row = await withTenantDb(schema, async (db) => {
      const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
      if (existing.length) throw new BadRequestException('Cet email est déjà utilisé.');
      const [u] = await db.insert(usersTable).values({ email, name, role: input.role!, passwordHash }).returning();
      return u;
    });

    await this.audit.record(actor, 'user.invite', { tenant, target: row.id, detail: { email, role: input.role } });
    return { ...safe(row), tempPassword };
  }

  async setRole(schema: string, tenant: string, actor: JwtUser, id: string, role: string) {
    if (!CONSOLE_ROLES.includes(role)) throw new BadRequestException('Rôle invalide.');
    const updated = await withTenantDb(schema, async (db) => {
      const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
      if (!target) throw new NotFoundException('Utilisateur introuvable.');
      if (target.role === 'ADMIN' && target.active && role !== 'ADMIN') {
        await this.assertNotLastAdmin(db, id);
      }
      const [u] = await db.update(usersTable).set({ role }).where(eq(usersTable.id, id)).returning();
      return { u, from: target.role };
    });
    await this.audit.record(actor, 'user.role_change', { tenant, target: id, detail: { from: updated.from, to: role } });
    return safe(updated.u);
  }

  async setActive(schema: string, tenant: string, actor: JwtUser, id: string, active: boolean) {
    const updated = await withTenantDb(schema, async (db) => {
      const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
      if (!target) throw new NotFoundException('Utilisateur introuvable.');
      if (target.role === 'ADMIN' && target.active && !active) {
        await this.assertNotLastAdmin(db, id);
      }
      const [u] = await db.update(usersTable).set({ active }).where(eq(usersTable.id, id)).returning();
      return u;
    });
    await this.audit.record(actor, active ? 'user.reactivate' : 'user.deactivate', { tenant, target: id });
    return safe(updated);
  }

  async resetPassword(schema: string, tenant: string, actor: JwtUser, id: string) {
    const tempPassword = genTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    const updated = await withTenantDb(schema, async (db) => {
      const [u] = await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, id)).returning();
      if (!u) throw new NotFoundException('Utilisateur introuvable.');
      return u;
    });
    await this.audit.record(actor, 'user.password_reset', { tenant, target: id });
    return { id: updated.id, tempPassword };
  }

  /** Garde-fou : le dernier administrateur actif d'un tenant ne peut pas être désactivé/rétrogradé. */
  private async assertNotLastAdmin(db: NodePgDatabase, excludeId: string) {
    const others = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.role, 'ADMIN'), eq(usersTable.active, true), ne(usersTable.id, excludeId)));
    if (others.length === 0) {
      throw new BadRequestException('Impossible : dernier administrateur du tenant.');
    }
  }
}
