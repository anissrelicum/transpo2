import { SetMetadata } from '@nestjs/common';
import type { Role } from '@transpo/domain';

export const ROLES_KEY = 'roles';
/** Restreint une route à certains rôles (vérifié par RolesGuard, côté serveur). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Rôles de la console transport. À poser au niveau **classe** sur tout contrôleur
 * d'exploitation : sans restriction, un MERCHANT ou un DRIVER authentifié du tenant
 * lit les données de toute l'organisation. Le marchand passe par `/v1/merchant/*`
 * (scopé à son claim) et le livreur par `/v1/driver/*`.
 * Un `@Roles` de méthode reste prioritaire — utile pour durcir ou rouvrir une route.
 */
export const CONSOLE_ROLES: Role[] = ['ADMIN', 'DISPATCHER', 'COMPTABLE'];
