import { CanActivate, ExecutionContext, Injectable, ForbiddenException, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@transpo/domain';
import { ROLES_KEY } from './roles.decorator.js';

/** Autorise si req.user.role est dans les rôles requis (@Roles). À utiliser après JwtAuthGuard. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const req = context.switchToHttp().getRequest();
    const role: Role | undefined = req.user?.role;
    if (!role || !required.includes(role)) {
      throw new ForbiddenException('Rôle insuffisant pour cette action.');
    }
    return true;
  }
}
