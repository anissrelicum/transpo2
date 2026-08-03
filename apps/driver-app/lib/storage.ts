import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * Persistance locale. Le jeton passe par SecureStore (keychain / keystore) ;
 * le reste par AsyncStorage, qui n'a pas de limite de taille pratique et
 * convient à la file d'attente hors ligne.
 */

const TOKEN_KEY = 'transpo.token';

export async function readToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null; // keychain indisponible (émulateur mal configuré) : on repart d'une session vide
  }
}

export async function writeToken(token: string): Promise<void> {
  try { await SecureStore.setItemAsync(TOKEN_KEY, token); } catch { /* non bloquant */ }
}

export async function deleteToken(): Promise<void> {
  try { await SecureStore.deleteItemAsync(TOKEN_KEY); } catch { /* non bloquant */ }
}

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback; // stockage corrompu : on ne bloque pas le livreur
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch { /* non bloquant */ }
}

export async function removeKey(key: string): Promise<void> {
  try { await AsyncStorage.removeItem(key); } catch { /* non bloquant */ }
}
