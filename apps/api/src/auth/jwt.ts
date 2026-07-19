import jwt from 'jsonwebtoken';
import type { Role } from '@transpo/domain';

export interface JwtUser {
  sub: string;        // email/id
  role: Role;
  tenant?: string;    // slug du tenant (absent pour SUPER_ADMIN plateforme)
  platform?: boolean; // true pour le realm super-admin
}

const secret = (): string => process.env.JWT_SECRET || 'change-me-in-prod';

export function signToken(u: JwtUser): string {
  return jwt.sign(u, secret(), { expiresIn: '12h' });
}

export function verifyToken(token: string): JwtUser {
  return jwt.verify(token, secret()) as JwtUser;
}
