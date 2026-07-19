import { hash, verify } from '@node-rs/argon2';

// argon2id (cf. skill transpo-auth-security). Helper partagé seed (db) + login (api).
export function hashPassword(plain: string): Promise<string> {
  return hash(plain); // argon2id par défaut
}

export function verifyPassword(hashStr: string, plain: string): Promise<boolean> {
  return verify(hashStr, plain);
}
