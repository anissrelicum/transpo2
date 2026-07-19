import { cookies } from 'next/headers';
import { createClient, TranspoClient } from '@transpo/api-client';

// URL de l'API vue depuis le serveur Next (réseau Docker : http://api:3000).
export const API_URL = process.env.API_URL || 'http://localhost:3000';

// Tenant par défaut quand le host ne porte pas de sous-domaine (localhost, IP, service Docker).
export const DEFAULT_TENANT = process.env.DEFAULT_TENANT || 'casaexpress';

/**
 * Résout le tenant à partir du host : le 1er label du hostname est le sous-domaine
 * (casaexpress.transpo.ma / casaexpress.localhost → "casaexpress"). Renvoie null si
 * aucun sous-domaine exploitable (localhost, 127.0.0.1, service Docker « console-web »…).
 */
export function tenantFromHost(host?: string | null): string | null {
  if (!host) return null;
  const name = host.split(':')[0];
  if (/^\d+\.\d+\.\d+\.\d+$/.test(name)) return null; // IP
  const labels = name.split('.');
  const first = labels[0]?.toLowerCase();
  if (labels.length < 2) return null;                 // pas de sous-domaine (localhost, console-web)
  if (['www', 'localhost', 'app'].includes(first)) return null;
  return first || null;
}

/** Client API authentifié à partir du cookie de session (token), pour le rendu serveur. */
export function serverClient(): TranspoClient {
  const token = cookies().get('token')?.value;
  return createClient({ baseUrl: API_URL, token });
}
