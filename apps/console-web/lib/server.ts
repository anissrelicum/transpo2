import { cookies } from 'next/headers';
import { createClient, TranspoClient } from '@transpo/api-client';

// URL de l'API vue depuis le serveur Next (réseau Docker : http://api:3000).
export const API_URL = process.env.API_URL || 'http://localhost:3000';

/** Client API authentifié à partir du cookie de session (token), pour le rendu serveur. */
export function serverClient(): TranspoClient {
  const token = cookies().get('token')?.value;
  return createClient({ baseUrl: API_URL, token });
}
