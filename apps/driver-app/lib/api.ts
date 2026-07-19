import Constants from 'expo-constants';
import { createClient, TranspoClient } from '@transpo/api-client';

// URL de l'API : configurable via EXPO_PUBLIC_API_URL, sinon app.json > extra.apiUrl.
const envUrl = (globalThis as any)?.process?.env?.EXPO_PUBLIC_API_URL as string | undefined;
export const API_URL =
  envUrl ||
  (Constants.expoConfig?.extra as any)?.apiUrl ||
  'http://localhost:3000';

// Session en mémoire (token + identité du livreur). Simple ; suffisant pour la démo.
type Session = { token: string; name: string; tenant: string } | null;
let session: Session = null;

export function setSession(s: Session) { session = s; }
export function getSession(): Session { return session; }

/** Client public (login) pour un tenant donné. */
export function publicClient(tenant: string): TranspoClient {
  return createClient({ baseUrl: API_URL, tenant });
}

/** Client authentifié à partir de la session courante. */
export function authedClient(): TranspoClient {
  if (!session) throw new Error('Non authentifié');
  return createClient({ baseUrl: API_URL, token: session.token });
}

/** Clé d'idempotence (offline-safe) : stable par (ref, action). */
export function idemKey(ref: string, action: string): string {
  return `${ref}:${action}:${session?.name ?? 'anon'}`;
}
