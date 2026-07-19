import { SetMetadata } from '@nestjs/common';
import type { Role } from '@transpo/domain';

export const ROLES_KEY = 'roles';
/** Restreint une route à certains rôles (vérifié par RolesGuard, côté serveur). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
