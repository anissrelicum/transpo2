// @transpo/design-tokens — source UNIQUE de l'échelle visuelle (web Radix + RN Tamagui).
// Garantit la cohérence web↔mobile fidèle à la maquette. Cf. skill transpo-design-system.
import { STATUS_META, type OrderStatus } from '@transpo/domain';

// Config Radix Themes (consoles Next.js). Les apps RN reproduisent la même échelle via Tamagui.
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
