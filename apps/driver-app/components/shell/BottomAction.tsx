// Barre d'action collée en bas, sur un dégradé vers le fond — cf. maquette
// (fonction BottomAction). React Native n'a pas de `linear-gradient` CSS ; on
// approxime avec des bandes de `backgroundColor` à opacité croissante plutôt
// que d'ajouter une dépendance native (`expo-linear-gradient`) pour ce seul
// usage. À reconsidérer si un dégradé plus riche est nécessaire ailleurs.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme';
import { space } from '@transpo/design-tokens';

// Opacités croissantes du haut (transparent) vers le bas (fond plein) — approxime
// la courbe `linear-gradient(to top, var(--color-background) 72%, transparent)`.
const BANDS = [0, 0.2, 0.4, 0.62, 0.82, 1] as const;

export interface BottomActionProps {
  children: React.ReactNode;
}

export function BottomAction({ children }: BottomActionProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {BANDS.map((opacity, i) => (
          <View key={i} style={[styles.band, { backgroundColor: colors.bg, opacity }]} />
        ))}
      </View>
      <View style={{ padding: space[3] }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  band: { flex: 1 },
});
