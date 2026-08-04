// Thème de l'app livreur — dérivé de @transpo/design-tokens (échelle Radix
// indigo/slate), pour rester visuellement aligné avec la console web. Cf.
// skill transpo-design-system.
import { useColorScheme } from 'react-native';
import type { OrderStatus } from '@transpo/domain';
import { palette, resolveColor, statusColorHex, type Appearance } from '@transpo/design-tokens';

export type Mode = Appearance; // 'light' | 'dark'

/**
 * Couleurs alignées sur la console web (Radix indigo/slate), pour la cohérence
 * visuelle. Conservé tel quel (mêmes clés) pour ne rien casser dans les écrans
 * existants (`index.tsx`, `missions.tsx`, `mission/[ref].tsx`, `incidents.tsx`,
 * `gains.tsx`, `support.tsx`, `_layout.tsx`, `SignaturePad.tsx`) qui importent
 * `C` de façon statique, y compris hors composant (ex. `screenOptions` de
 * `_layout.tsx`) — impossible à rendre réactif au thème système sans les
 * toucher, ce qui est hors périmètre ici. Nouveaux écrans : utiliser `useTheme()`
 * ci-dessous, qui suit le mode clair/sombre.
 */
export const C = {
  indigo: palette.light.indigo[9],
  indigoDark: palette.light.indigo[10],
  bg: palette.light.slate[1],
  card: '#FFFFFF',
  border: palette.light.slate[5],
  text: palette.light.slate[12],
  muted: palette.light.slate[11],
  green: palette.light.green[9],
  amber: palette.light.amber[9],
  red: palette.light.red[9],
};

/**
 * Couleur par statut (miroir de STATUS_META côté domaine), en hex plein (cran 9).
 * Recalculée depuis les vraies valeurs Radix (auparavant approximées à l'œil :
 * ex. RECUPEREE était #8E4EC6 au lieu du violet9 réel #6E56CF). Le rendu visuel
 * de quelques statuts (NOUVELLE, RECUPEREE, LIVRAISON) change donc légèrement
 * pour matcher exactement la maquette et la console web.
 */
export const STATUS_COLOR: Record<string, string> = {
  PROGRAMMEE: statusColorHex('PROGRAMMEE'),
  NOUVELLE: statusColorHex('NOUVELLE'),
  ASSIGNEE: statusColorHex('ASSIGNEE'),
  RETRAIT: statusColorHex('RETRAIT'),
  RECUPEREE: statusColorHex('RECUPEREE'),
  LIVRAISON: statusColorHex('LIVRAISON'),
  LIVREE: statusColorHex('LIVREE'),
  ECHOUEE: statusColorHex('ECHOUEE'),
  RETOUR: statusColorHex('RETOUR'),
  ANNULEE: statusColorHex('ANNULEE'),
};

/* ============================================================================
 * Thème clair/sombre pour les nouveaux écrans et les primitives partagées
 * (`components/shell/*`). `C`/`STATUS_COLOR` ci-dessus restent la référence
 * "statique, clair" pour le code existant ; tout ce qui suit est le socle pour
 * le reste de l'app livreur (support RTL et sombre demandés par la maquette).
 * ============================================================================ */

export interface ThemeColors {
  bg: string;
  panel: string; // équivalent RN de `--color-panel-solid` (fond des cartes/barres)
  border: string;
  text: string;
  muted: string;
  indigo9: string; // accent plein (boutons primaires, actif)
  indigo11: string; // accent texte/icône haute lisibilité (onglet actif — cf. maquette)
  gray9: string; // gris "inactif" de la barre d'onglets (cf. maquette : inactif = gray-9)
}

function buildTheme(mode: Mode): ThemeColors {
  const p = palette[mode];
  return {
    bg: p.slate[1],
    panel: mode === 'light' ? '#FFFFFF' : p.slate[2],
    border: p.slate[mode === 'light' ? 5 : 6],
    text: p.slate[12],
    muted: p.slate[11],
    indigo9: p.indigo[9],
    indigo11: p.indigo[11],
    gray9: p.slate[9],
  };
}

export const THEME: Record<Mode, ThemeColors> = {
  light: buildTheme('light'),
  dark: buildTheme('dark'),
};

/** Mode clair/sombre courant, suivant le réglage système du téléphone. */
export function useColorMode(): Mode {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

/** Thème courant (couleurs résolues) — à consommer par les primitives `components/shell/*`. */
export function useTheme(): { mode: Mode; colors: ThemeColors } {
  const mode = useColorMode();
  return { mode, colors: THEME[mode] };
}

/** Couleur d'un statut de commande dans le mode courant (cran 9 par défaut). */
export function useStatusColor(status: OrderStatus, step: 3 | 9 | 11 = 9): string {
  const { mode } = useTheme();
  return statusColorHex(status, step, mode);
}

// Ré-exports pratiques pour les écrans qui veulent une teinte Radix arbitraire
// (ex. une icône de notification colorée par type, comme dans la maquette).
export { resolveColor, statusColorHex };
