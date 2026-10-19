// Préférences du livreur, gardées sur le téléphone : thème et vibration des propositions.
// Le thème s'applique à toute l'app via `Appearance.setColorScheme` — `useColorScheme()`
// (lu par `useTheme`) suit alors le choix au lieu du réglage système.
import { Appearance } from 'react-native';
import { readJson, writeJson } from './storage';

export type Theme = 'systeme' | 'clair' | 'sombre';
export interface Preferences { theme: Theme; vibration: boolean }

const CLE = 'portrail.preferences.v1';
const DEFAUT: Preferences = { theme: 'systeme', vibration: true };

let courantes: Preferences = DEFAUT;

export async function lirePreferences(): Promise<Preferences> {
  courantes = { ...DEFAUT, ...(await readJson<Partial<Preferences>>(CLE, {})) };
  return courantes;
}

export async function ecrirePreferences(p: Preferences): Promise<void> {
  courantes = p;
  appliquerTheme(p.theme);
  await writeJson(CLE, p);
}

export function appliquerTheme(theme: Theme): void {
  Appearance.setColorScheme(theme === 'clair' ? 'light' : theme === 'sombre' ? 'dark' : null);
}

/** Au démarrage de l'app : relit les préférences et applique le thème choisi. */
export async function initialiserPreferences(): Promise<void> {
  appliquerTheme((await lirePreferences()).theme);
}

/** Dernières préférences connues (lecture synchrone, après `initialiserPreferences`). */
export function preferences(): Preferences {
  return courantes;
}
