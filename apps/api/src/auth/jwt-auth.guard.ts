import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { verifyToken } from './jwt.js';

/** Exige un Bearer JWT valide ; pose req.user. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const header = req.headers['authorization'] as string | undefined;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Jeton manquant.');
    }
    try {
      req.user = verifyToken(header.slice(7));
      return true;
    } catch {
      throw new UnauthorizedException('Jeton invalide ou expiré.');
    }
  }
}
