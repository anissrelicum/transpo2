// Primitives visuelles de la refonte « Ma journée » (maquette design/app-livreur/maquette.html).
// Une action principale par écran, en bas, 56 px ; pastilles et cartes communes ; couleurs
// de la marque Portrail (marine, ambre) à côté de l'indigo d'action. Toutes suivent le
// thème clair/sombre et le sens de lecture (RTL en arabe).
import * as React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, type ViewStyle, type StyleProp, type TextStyle } from 'react-native';
import { useTheme, resolveColor } from '../lib/theme';

export const MARQUE = { navy: '#0B1537', navy2: '#16224F', navyTexte: '#C9D1F2', amber: '#F5A524' } as const;

export type Ton = 'indigo' | 'vert' | 'ambre' | 'rouge' | 'gris';
const RADIX: Record<Ton, string> = { indigo: 'indigo', vert: 'green', ambre: 'amber', rouge: 'red', gris: 'slate' };

/** Couleurs d'un ton : fond doux, texte lisible, plein. */
export function useTon(ton: Ton) {
  const { mode } = useTheme();
  const n = RADIX[ton];
  return { doux: resolveColor(n, 3, mode), texte: resolveColor(n, 11, mode), plein: resolveColor(n, 9, mode) };
}

export function useSens() {
  // Le sens est passé explicitement (cf. lib/i18n : forceRTL n'agit qu'après relance).
  return (rtl: boolean) => ({
    row: { flexDirection: rtl ? 'row-reverse' : 'row' } as ViewStyle,
    align: { textAlign: rtl ? 'right' : 'left' } as TextStyle,
  });
}

export type VarianteBouton = 'principal' | 'succes' | 'marque' | 'secondaire' | 'danger' | 'blanc';

export function Bouton({
  children, onPress, variante = 'principal', disabled, loading, petit, icone, testID, style,
}: {
  children: React.ReactNode; onPress?: () => void; variante?: VarianteBouton; disabled?: boolean;
  loading?: boolean; petit?: boolean; icone?: React.ReactNode; testID?: string; style?: StyleProp<ViewStyle>;
}) {
  const { colors, mode } = useTheme();
  const v = {
    principal: { bg: colors.indigo9, fg: '#FFFFFF', bord: 'transparent' },
    succes: { bg: resolveColor('green', 9, mode), fg: '#FFFFFF', bord: 'transparent' },
    marque: { bg: MARQUE.amber, fg: MARQUE.navy, bord: 'transparent' },
    secondaire: { bg: colors.panel, fg: colors.text, bord: colors.border },
    danger: { bg: colors.panel, fg: resolveColor('red', 11, mode), bord: resolveColor('red', 6, mode) },
    blanc: { bg: '#FFFFFF', fg: resolveColor('green', 11, 'light'), bord: 'transparent' },
  }[variante];
  const off = Boolean(disabled || loading);
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={typeof children === 'string' ? children : undefined}
      accessibilityState={{ disabled: off, busy: loading }}
      style={({ pressed }) => [
        s.bouton,
        petit && s.boutonPetit,
        { backgroundColor: v.bg, borderColor: v.bord, opacity: off ? 0.45 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : (
        <>
          {icone}
          {typeof children === 'string'
            ? <Text style={[s.boutonTxt, petit && s.boutonTxtPetit, { color: v.fg }]} numberOfLines={1}>{children}</Text>
            : children}
        </>
      )}
    </Pressable>
  );
}

export function Pastille({ ton, children, point, style }: { ton: Ton; children: React.ReactNode; point?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = useTon(ton);
  return (
    <View style={[s.pastille, { backgroundColor: c.doux }, style]}>
      {point ? <View style={[s.point, { backgroundColor: c.texte }]} /> : null}
      <Text style={[s.pastilleTxt, { color: c.texte }]} numberOfLines={1}>{children}</Text>
    </View>
  );
}

export function Carte({ children, style, onPress, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string }) {
  const { colors } = useTheme();
  const base = [s.carte, { backgroundColor: colors.panel, borderColor: colors.border }, style];
  if (!onPress) return <View style={base} testID={testID}>{children}</View>;
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [...base, { opacity: pressed ? 0.85 : 1 }]}>
      {children}
    </Pressable>
  );
}

export function Libelle({ children, style, rtl }: { children: React.ReactNode; style?: StyleProp<TextStyle>; rtl?: boolean }) {
  const { colors } = useTheme();
  return <Text style={[s.libelle, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }, style]}>{children}</Text>;
}

export function Bandeau({ ton, children, onPress, rtl }: { ton: Ton; children: React.ReactNode; onPress?: () => void; rtl?: boolean }) {
  const c = useTon(ton);
  const contenu = (
    <Text style={[s.bandeauTxt, { color: c.texte, textAlign: rtl ? 'right' : 'left' }]}>{children}</Text>
  );
  if (!onPress) return <View style={[s.bandeau, { backgroundColor: c.doux }]}>{contenu}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[s.bandeau, { backgroundColor: c.doux }]}>{contenu}</Pressable>
  );
}

export const s = StyleSheet.create({
  bouton: {
    minHeight: 56, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 10, paddingHorizontal: 16,
  },
  boutonPetit: { minHeight: 48, borderRadius: 14 },
  boutonTxt: { fontSize: 17, fontWeight: '700' },
  boutonTxtPetit: { fontSize: 15 },
  pastille: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, alignSelf: 'flex-start' },
  pastilleTxt: { fontSize: 13, fontWeight: '700' },
  point: { width: 8, height: 8, borderRadius: 4 },
  carte: { borderRadius: 18, borderWidth: 1, padding: 16 },
  libelle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase' },
  bandeau: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  bandeauTxt: { fontSize: 14, fontWeight: '600' },
});
