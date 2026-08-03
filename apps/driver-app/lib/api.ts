import Constants from 'expo-constants';
import { createClient, TranspoClient } from '@transpo/api-client';
import { readToken, writeToken, deleteToken, readJson, writeJson, removeKey } from './storage';

// URL de l'API : configurable via EXPO_PUBLIC_API_URL, sinon app.json > extra.apiUrl.
const envUrl = (globalThis as any)?.process?.env?.EXPO_PUBLIC_API_URL as string | undefined;
export const API_URL =
  envUrl ||
  (Constants.expoConfig?.extra as any)?.apiUrl ||
  'http://localhost:3000';

const PROFILE_KEY = 'transpo.profile';

export type Session = { token: string; name: string; tenant: string };

// Copie en mémoire pour un accès synchrone depuis les écrans ; la source de
// vérité est le stockage persistant, rechargé au démarrage par `restoreSession`.
let session: Session | null = null;

export function getSession(): Session | null { return session; }

/** Ouvre une session et la persiste (survit à la fermeture de l'app). */
export async function setSession(s: Session): Promise<void> {
  session = s;
  await writeToken(s.token);
  await writeJson(PROFILE_KEY, { name: s.name, tenant: s.tenant });
}

/** Restaure la session au démarrage. `null` si le livreur doit se reconnecter. */
export async function restoreSession(): Promise<Session | null> {
  const token = await readToken();
  if (!token) return null;
  const profile = await readJson<{ name?: string; tenant?: string }>(PROFILE_KEY, {});
  if (!profile.tenant) return null;
  session = { token, name: profile.name ?? '', tenant: profile.tenant };
  return session;
}

/** Ferme la session. La file d'attente est purgée par l'appelant (écran). */
export async function clearSession(): Promise<void> {
  session = null;
  await deleteToken();
  await removeKey(PROFILE_KEY);
}

/** Client public (login) pour un tenant donné. */
export function publicClient(tenant: string): TranspoClient {
  return createClient({ baseUrl: API_URL, tenant });
}

/** Client authentifié à partir de la session courante. */
export function authedClient(): TranspoClient {
  if (!session) throw new Error('Non authentifié');
  return createClient({ baseUrl: API_URL, token: session.token });
}

/**
 * Clé d'idempotence, stable par (ref, action) pour un livreur donné : un rejeu
 * après coupure réseau ou redémarrage réutilise la même clé, et l'API n'applique
 * l'effet qu'une fois.
 */
export function idemKey(ref: string, action: string): string {
  return `${ref}:${action}:${session?.name ?? 'anon'}`;
}
