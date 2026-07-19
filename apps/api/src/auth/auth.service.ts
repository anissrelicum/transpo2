import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException, HttpException } from '@nestjs/common';
import { pool, withTenantDb, verifyPassword } from '@transpo/db';
import type { Role } from '@transpo/domain';
import { signToken } from './jwt.js';

// Anti-bruteforce : compteur d'échecs par (tenant,email) sur une fenêtre glissante.
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; firstAt: number }>();

@Injectable()
export class AuthService {
  private throttleGuard(key: string): void {
    const e = attempts.get(key);
    if (!e) return;
    if (Date.now() - e.firstAt > WINDOW_MS) { attempts.delete(key); return; }
    if (e.count >= MAX_FAILS) {
      throw new HttpException('Trop de tentatives. Réessayez plus tard.', 429);
    }
  }
  private recordFail(key: string): void {
    const now = Date.now();
    const e = attempts.get(key);
    if (!e || now - e.firstAt > WINDOW_MS) attempts.set(key, { count: 1, firstAt: now });
    else e.count += 1;
  }

  /** Login d'un utilisateur de tenant → JWT { sub, role, tenant }. */
  async loginTenant(slug: string | undefined, email: string, password: string): Promise<{ token: string; role: Role; name: string }> {
    if (!slug) throw new BadRequestException('Tenant manquant.');
    const throttleKey = `${slug}:${email}`;
    this.throttleGuard(throttleKey);
    const { rows } = await pool.query('SELECT slug, status FROM platform.tenants WHERE slug = $1', [slug]);
    if (!rows.length) throw new BadRequestException(`Tenant inconnu : ${slug}`);
    if (rows[0].status === 'SUSPENDU') throw new ForbiddenException('Espace suspendu — contactez la plateforme.');

    const user = await withTenantDb(`tenant_${slug}`, async (_db, client) => {
      const r = await client.query(
        'SELECT email, password_hash, name, role, active, merchant, driver FROM users WHERE email = $1',
        [email],
      );
      return r.rows[0];
    });
    if (!user || !user.active) { this.recordFail(throttleKey); throw new UnauthorizedException('Identifiants invalides.'); }
    if (!(await verifyPassword(user.password_hash, password))) {
      this.recordFail(throttleKey);
      throw new UnauthorizedException('Identifiants invalides.');
    }
    attempts.delete(throttleKey); // succès : réinitialise
    return {
      token: signToken({
        sub: user.email, role: user.role as Role, tenant: slug,
        ...(user.merchant ? { merchant: user.merchant } : {}),
        ...(user.driver ? { driver: user.driver } : {}),
      }),
      role: user.role as Role,
      name: user.name,
    };
  }

  /** Login super-admin plateforme (realm séparé) → JWT { sub, role: SUPER_ADMIN, platform }. */
  async loginSuperAdmin(email: string, password: string): Promise<{ token: string; name: string }> {
    const { rows } = await pool.query(
      'SELECT email, password_hash, name FROM platform.super_admins WHERE email = $1',
      [email],
    );
    const sa = rows[0];
    if (!sa || !(await verifyPassword(sa.password_hash, password))) {
      throw new UnauthorizedException('Identifiants invalides.');
    }
    return {
      token: signToken({ sub: sa.email, role: 'SUPER_ADMIN', platform: true }),
      name: sa.name,
    };
  }
}
