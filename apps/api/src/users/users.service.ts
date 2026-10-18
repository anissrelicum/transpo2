import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { withTenantDb, hashPassword, users as usersTable, drivers as driversTable } from '@transpo/db';
import { and, eq, ne } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service.js';
import { ensureMerchant } from '../billing/billing.service.js';
import type { JwtUser } from '../auth/jwt.js';

const CONSOLE_ROLES = ['ADMIN', 'DISPATCHER', 'COMPTABLE'];
/**
 * Rôles créables depuis l'écran Utilisateurs.
 *
 * MERCHANT et DRIVER ne sont pas des rôles de console — l'un ouvre le portail marchand,
 * l'autre l'application livreur — mais il n'existait AUCUN moyen de créer de tels comptes :
 * les deux applications étaient livrées sans porte d'entrée, et le jeu de données de
 * recette exigeait un accès shell à la production. Chacun porte en plus le nom auquel il
 * est rattaché : le marchand pour l'un, le chauffeur de la fiche flotte pour l'autre.
 */
const ROLES_CREABLES = [...CONSOLE_ROLES, 'MERCHANT', 'DRIVER'];
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
      return rows.filter((u) => ROLES_CREABLES.includes(u.role)).map(safe);
    });
  }

  /**
   * Invite un utilisateur — mot de passe temporaire retourné une seule fois.
   * Rôles console (ADMIN/DISPATCHER/COMPTABLE) et MERCHANT, ce dernier rattaché au nom
   * d'un marchand : sans quoi le portail marchand reste sans accès possible.
   */
  async invite(schema: string, tenant: string, actor: JwtUser, input: { email?: string; name?: string; role?: string; merchant?: string; driver?: string }) {
    const email = input.email?.trim().toLowerCase();
    const name = input.name?.trim();
    if (!email || !EMAIL_RE.test(email)) throw new BadRequestException('Email invalide.');
    if (!name) throw new BadRequestException('Nom requis.');
    if (!input.role || !ROLES_CREABLES.includes(input.role)) throw new BadRequestException('Rôle invalide.');
    const merchant = input.merchant?.trim() || null;
    const driver = input.driver?.trim() || null;
    if (input.role === 'MERCHANT' && !merchant) {
      throw new BadRequestException('Nom du marchand requis pour un compte marchand.');
    }
    if (input.role === 'DRIVER' && !driver) {
      throw new BadRequestException('Chauffeur requis pour un compte livreur.');
    }

    const tempPassword = genTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    const row = await withTenantDb(schema, async (db) => {
      const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
      if (existing.length) throw new BadRequestException('Cet email est déjà utilisé.');
      // Le compte livreur doit pointer un chauffeur RÉEL de la flotte : les missions, la
      // caisse et les preuves sont rattachées au chauffeur par son nom.
      if (input.role === 'DRIVER') {
        const fiche = await db.select().from(driversTable).where(eq(driversTable.name, driver!));
        if (!fiche.length) throw new BadRequestException(`Chauffeur inconnu : ${driver}.`);
      }
      // Un compte portail désigne son marchand par son nom : la fiche doit exister pour que
      // ses conditions tarifaires puissent être négociées (créée à la grille sinon).
      if (input.role === 'MERCHANT') await ensureMerchant(db, merchant!);
      const [u] = await db.insert(usersTable).values({
        email, name, role: input.role!, passwordHash,
        ...(input.role === 'MERCHANT' ? { merchant } : {}),
        ...(input.role === 'DRIVER' ? { driver } : {}),
      }).returning();
      return u;
    });

    await this.audit.record(actor, 'user.invite', {
      tenant, target: row.id, detail: { email, role: input.role, merchant, driver },
    });
    return { ...safe(row), tempPassword };
  }

  async setRole(schema: string, tenant: string, actor: JwtUser, id: string, role: string) {
    // Un compte marchand n'est pas un compte d'exploitation : on ne le promeut pas, et on
    // ne rétrograde pas un opérateur en marchand — les deux mondes n'ont pas le même accès.
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
