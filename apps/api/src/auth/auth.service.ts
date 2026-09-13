import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException, HttpException } from '@nestjs/common';
import { pool, withTenantDb, verifyPassword } from '@transpo/db';
import type { Role } from '@transpo/domain';
import { signToken } from './jwt.js';

// Anti-bruteforce : compteurs d'échecs sur une fenêtre glissante, tenus en base
// (`platform.login_attempts`) et non en mémoire du processus — un compteur mémoire
// repartait de zéro à chaque déploiement et ignorait les autres répliques (OBS-02).
//
// Deux clés indépendantes, parce que deux attaques différentes :
//   · par compte  — s'acharner sur une adresse connue ;
//   · par IP      — essayer un mot de passe courant sur des centaines d'adresses
//                   (« password spraying »), que le compteur par compte ne voyait pas.
// Le seuil par IP est plus haut : un bureau entier peut partager une sortie NAT.
const MAX_FAILS = 5;
const MAX_FAILS_IP = 30;
const WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  /** Refuse la tentative si l'une des clés a dépassé son seuil dans la fenêtre courante. */
  private async throttleGuard(cles: { key: string; max: number }[]): Promise<void> {
    const vivantes = cles.map((c) => c.key);
    if (!vivantes.length) return;
    const { rows } = await pool.query<{ key: string; count: number; first_at: Date }>(
      'SELECT key, count, first_at FROM platform.login_attempts WHERE key = ANY($1)',
      [vivantes],
    );
    const maintenant = Date.now();
    for (const r of rows) {
      const cle = cles.find((c) => c.key === r.key)!;
      // Fenêtre écoulée : la ligne sera réinitialisée au prochain échec, pas besoin de bloquer.
      if (maintenant - new Date(r.first_at).getTime() > WINDOW_MS) continue;
      if (r.count >= cle.max) {
        throw new HttpException('Trop de tentatives. Réessayez plus tard.', 429);
      }
    }
  }

  /** Incrémente chaque compteur, en repartant de 1 si la fenêtre précédente est écoulée. */
  private async recordFail(cles: { key: string }[]): Promise<void> {
    for (const { key } of cles) {
      await pool.query(
        `INSERT INTO platform.login_attempts (key, count, first_at, last_at)
              VALUES ($1, 1, now(), now())
         ON CONFLICT (key) DO UPDATE
            SET count    = CASE WHEN now() - platform.login_attempts.first_at > $2::interval
                                THEN 1 ELSE platform.login_attempts.count + 1 END,
                first_at = CASE WHEN now() - platform.login_attempts.first_at > $2::interval
                                THEN now() ELSE platform.login_attempts.first_at END,
                last_at  = now()`,
        [key, `${Math.round(WINDOW_MS / 1000)} seconds`],
      );
    }
  }

  /** Une connexion réussie efface le compteur du compte (pas celui de l'IP). */
  private async clearFails(key: string): Promise<void> {
    await pool.query('DELETE FROM platform.login_attempts WHERE key = $1', [key]);
  }

  /**
   * Login d'un utilisateur de tenant → JWT { sub, role, tenant }.
   *
   * Une organisation inconnue renvoie exactement la même réponse qu'un mot de passe faux :
   * l'ancien « Tenant inconnu : <slug> » permettait d'énumérer les clients de la plateforme
   * en comparant les messages (constat OBS-01). Le détail reste côté serveur.
   */
  async loginTenant(slug: string | undefined, email: string, password: string, ip?: string): Promise<{ token: string; role: Role; name: string }> {
    if (!slug) throw new BadRequestException('Tenant manquant.');
    const cleCompte = `u:${slug}:${email}`;
    const cles = [
      { key: cleCompte, max: MAX_FAILS },
      ...(ip ? [{ key: `ip:${ip}`, max: MAX_FAILS_IP }] : []),
    ];
    await this.throttleGuard(cles);
    const { rows } = await pool.query('SELECT slug, status FROM platform.tenants WHERE slug = $1', [slug]);
    if (!rows.length) {
      // eslint-disable-next-line no-console
      console.warn(`login refusé — organisation inconnue : ${slug}`);
      await this.recordFail(cles);
      throw new UnauthorizedException('Identifiants invalides.');
    }
    if (rows[0].status === 'SUSPENDU') throw new ForbiddenException('Espace suspendu — contactez la plateforme.');

    const user = await withTenantDb(`tenant_${slug}`, async (_db, client) => {
      const r = await client.query(
        'SELECT email, password_hash, name, role, active, merchant, driver FROM users WHERE email = $1',
        [email],
      );
      return r.rows[0];
    });
    if (!user || !user.active) { await this.recordFail(cles); throw new UnauthorizedException('Identifiants invalides.'); }
    if (!(await verifyPassword(user.password_hash, password))) {
      await this.recordFail(cles);
      throw new UnauthorizedException('Identifiants invalides.');
    }
    await this.clearFails(cleCompte); // succès : le compte repart à zéro
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

  /**
   * Login super-admin plateforme (realm séparé) → JWT { sub, role: SUPER_ADMIN, platform }.
   * Le realm le plus privilégié n'était soumis à AUCUN comptage d'échecs : il suit
   * désormais les mêmes compteurs que les tenants.
   */
  async loginSuperAdmin(email: string, password: string, ip?: string): Promise<{ token: string; name: string }> {
    const cleCompte = `u:platform:${email}`;
    const cles = [
      { key: cleCompte, max: MAX_FAILS },
      ...(ip ? [{ key: `ip:${ip}`, max: MAX_FAILS_IP }] : []),
    ];
    await this.throttleGuard(cles);
    const { rows } = await pool.query(
      'SELECT email, password_hash, name FROM platform.super_admins WHERE email = $1',
      [email],
    );
    const sa = rows[0];
    if (!sa || !(await verifyPassword(sa.password_hash, password))) {
      await this.recordFail(cles);
      throw new UnauthorizedException('Identifiants invalides.');
    }
    await this.clearFails(cleCompte);
    return {
      token: signToken({ sub: sa.email, role: 'SUPER_ADMIN', platform: true }),
      name: sa.name,
    };
  }
}
