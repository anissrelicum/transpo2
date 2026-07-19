import Constants from 'expo-constants';
import { createClient } from '@transpo/api-client';

const extra = (Constants.expoConfig?.extra as any) ?? {};
const envUrl = (globalThis as any)?.process?.env?.EXPO_PUBLIC_API_URL as string | undefined;

export const API_URL = envUrl || extra.apiUrl || 'http://localhost:3000';
export const DEFAULT_TENANT = extra.defaultTenant || 'casaexpress';

// Client public (aucune authentification ; le tenant est dans l'URL).
export const publicApi = () => createClient({ baseUrl: API_URL });

export const C = {
  indigo: '#3E63DD', bg: '#FBFCFD', card: '#FFFFFF', border: '#E1E3E6',
  text: '#11181C', muted: '#697177', green: '#30A46C', amber: '#FFB224', red: '#E5484D',
};
export const STATUS_COLOR: Record<string, string> = {
  PROGRAMMEE: '#8B8D98', NOUVELLE: '#3E63DD', ASSIGNEE: '#3E63DD', RETRAIT: '#0091FF',
  RECUPEREE: '#8E4EC6', LIVRAISON: '#FFB224', LIVREE: '#30A46C',
  ECHOUEE: '#E5484D', RETOUR: '#F76B15', ANNULEE: '#8B8D98',
};
