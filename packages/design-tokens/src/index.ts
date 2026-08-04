// @transpo/design-tokens — source UNIQUE de l'échelle visuelle (web Radix + RN maison).
// Garantit la cohérence web↔mobile fidèle à la maquette. Cf. skill transpo-design-system.
import { STATUS_META, type OrderStatus } from '@transpo/domain';

// Config Radix Themes (consoles Next.js). Les apps RN reproduisent la même échelle en hex directs.
export const RADIX_THEME = {
  accentColor: 'indigo',
  grayColor: 'slate',
  radius: 'medium',
  scaling: '100%',
  panelBackground: 'solid',
} as const;

// Rayons (px) — alignés sur "radius: medium" de Radix.
export const radius = { 1: 3, 2: 4, 3: 6, 4: 8, 5: 12, full: 9999 } as const;

// Espacement (px) — échelle Radix (space 1..9).
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 40, 8: 48, 9: 64 } as const;

// Cibles tactiles (skill design-system).
export const touch = { min: 44, primary: 52 } as const;

// Accents de marque (référence hex indigo/slate 9 de Radix, pour Tamagui/usages hors-CSS).
export const brand = {
  indigo9: '#3e63dd',
  indigo11: '#3a5bc7',
  slate1: '#fbfcfd',
  slate12: '#11181c',
} as const;

// Couleur sémantique d'un statut de commande (nom de teinte Radix). Web: var(--<c>-9), RN: mapper.
export function statusColor(status: OrderStatus): string {
  return STATUS_META[status].color;
}

export type RadixColor = string;

/* ============================================================================
 * Échelles Radix — clair ET sombre, valeurs EXACTES de @radix-ui/colors (déjà
 * une dépendance du monorepo via @radix-ui/themes — cf. node_modules/@radix-ui/colors).
 * React Native n'a pas de `var(--indigo-9)` : c'est ici, et nulle part ailleurs,
 * qu'on résout un nom de teinte Radix en hex pour du natif. Radix a deux jeux de
 * valeurs distincts clair/sombre (ce n'est PAS un simple négatif de l'un vers
 * l'autre — ex. indigo9 et amber9 sont identiques dans les deux modes, mais
 * indigo11/amber11 changent radicalement pour rester lisibles sur fond sombre).
 *
 * - indigo/slate : échelle complète (1..12) — ce sont les neutres + l'accent,
 *   utilisés partout (fonds, bordures, textes, actif/inactif).
 * - teintes sémantiques de statut (green/amber/red/blue/cyan/violet/orange) :
 *   crans 3 (fond doux de badge `variant: soft`), 9 (plein/point/icône) et 11
 *   (texte sur fond doux) — les seuls exploités par la maquette pour les
 *   badges de statut et puces COD. Étendre si un futur écran en a besoin.
 * ============================================================================ */

export type ColorStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type StatusStep = 3 | 9 | 11;
export type ColorScale = Record<ColorStep, string>;
export type StatusScale = Record<StatusStep, string>;
export type Appearance = 'light' | 'dark';

const indigoLight: ColorScale = {
  1: '#fdfdfe', 2: '#f7f9ff', 3: '#edf2fe', 4: '#e1e9ff', 5: '#d2deff', 6: '#c1d0ff',
  7: '#abbdf9', 8: '#8da4ef', 9: '#3e63dd', 10: '#3358d4', 11: '#3a5bc7', 12: '#1f2d5c',
};
const indigoDark: ColorScale = {
  1: '#11131f', 2: '#141726', 3: '#182449', 4: '#1d2e62', 5: '#253974', 6: '#304384',
  7: '#3a4f97', 8: '#435db1', 9: '#3e63dd', 10: '#5472e4', 11: '#9eb1ff', 12: '#d6e1ff',
};
// "grayColor: slate" dans RADIX_THEME : c'est l'échelle neutre réellement utilisée
// à l'écran quand la maquette/le domaine disent juste "gray" (cf. GRAY_ALIAS plus bas).
const slateLight: ColorScale = {
  1: '#fcfcfd', 2: '#f9f9fb', 3: '#f0f0f3', 4: '#e8e8ec', 5: '#e0e1e6', 6: '#d9d9e0',
  7: '#cdced6', 8: '#b9bbc6', 9: '#8b8d98', 10: '#80838d', 11: '#60646c', 12: '#1c2024',
};
const slateDark: ColorScale = {
  1: '#111113', 2: '#18191b', 3: '#212225', 4: '#272a2d', 5: '#2e3135', 6: '#363a3f',
  7: '#43484e', 8: '#5a6169', 9: '#696e77', 10: '#777b84', 11: '#b0b4ba', 12: '#edeef0',
};

const greenLight: StatusScale = { 3: '#e6f6eb', 9: '#30a46c', 11: '#218358' };
const greenDark: StatusScale = { 3: '#132d21', 9: '#30a46c', 11: '#3dd68c' };
const amberLight: StatusScale = { 3: '#fff7c2', 9: '#ffc53d', 11: '#ab6400' };
const amberDark: StatusScale = { 3: '#302008', 9: '#ffc53d', 11: '#ffca16' };
const redLight: StatusScale = { 3: '#feebec', 9: '#e5484d', 11: '#ce2c31' };
const redDark: StatusScale = { 3: '#3b1219', 9: '#e5484d', 11: '#ff9592' };
const blueLight: StatusScale = { 3: '#e6f4fe', 9: '#0090ff', 11: '#0d74ce' };
const blueDark: StatusScale = { 3: '#0d2847', 9: '#0090ff', 11: '#70b8ff' };
const cyanLight: StatusScale = { 3: '#def7f9', 9: '#00a2c7', 11: '#107d98' };
const cyanDark: StatusScale = { 3: '#082c36', 9: '#00a2c7', 11: '#4ccce6' };
const violetLight: StatusScale = { 3: '#f4f0fe', 9: '#6e56cf', 11: '#6550b9' };
const violetDark: StatusScale = { 3: '#291f43', 9: '#6e56cf', 11: '#baa7ff' };
const orangeLight: StatusScale = { 3: '#ffefd6', 9: '#f76b15', 11: '#cc4e00' };
const orangeDark: StatusScale = { 3: '#331e0b', 9: '#f76b15', 11: '#ffa057' };

export const palette = {
  light: {
    indigo: indigoLight, slate: slateLight, green: greenLight, amber: amberLight, red: redLight,
    blue: blueLight, cyan: cyanLight, violet: violetLight, orange: orangeLight,
  },
  dark: {
    indigo: indigoDark, slate: slateDark, green: greenDark, amber: amberDark, red: redDark,
    blue: blueDark, cyan: cyanDark, violet: violetDark, orange: orangeDark,
  },
} as const;

export type PaletteColorName = keyof typeof palette.light;

// STATUS_META (domaine) dit parfois juste "gray" : dans ce projet le gris EST
// slate (RADIX_THEME.grayColor = 'slate'), jamais un gris neutre pur.
const GRAY_ALIAS: Record<string, PaletteColorName> = { gray: 'slate' };

function scaleFor(name: string, appearance: Appearance): Partial<ColorScale> {
  const key = (GRAY_ALIAS[name] ?? name) as PaletteColorName;
  return palette[appearance][key] ?? palette[appearance].slate;
}

/** Hex d'une teinte Radix nommée (ex. resolveColor('amber', 9, 'dark')). Pas d'approximation à l'œil. */
export function resolveColor(name: string, step: ColorStep | StatusStep, appearance: Appearance = 'light'): string {
  const scale = scaleFor(name, appearance);
  return scale[step] ?? scale[9] ?? '#000000';
}

/**
 * Hex d'un statut de commande pour React Native (pas de `var(--x-9)` en natif).
 * `step` 9 = plein (icône/point), 3 = fond doux de badge, 11 = texte sur fond doux —
 * les trois crans réellement utilisés par `StatusBadge`/`CodChip` dans la maquette.
 */
export function statusColorHex(status: OrderStatus, step: StatusStep = 9, appearance: Appearance = 'light'): string {
  return resolveColor(STATUS_META[status].color, step, appearance);
}
