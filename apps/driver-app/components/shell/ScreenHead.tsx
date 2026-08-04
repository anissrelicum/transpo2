// En-tête d'écran — cf. maquette `lot3-app-livreur.jsx` (fonction ScreenHead) :
// retour 44×44, titre + sous-titre optionnel gris, bordure basse.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme';
import { touch } from '@transpo/design-tokens';
import { ArrowLeftIcon } from './icons';

export interface ScreenHeadProps {
  title: string;
  /** Sous-titre optionnel, gris, sous le titre (ex. "Étape : livraison"). */
  sub?: string;
  /** Callback retour ; si absent, aucune flèche n'est rendue (écran racine d'un onglet). */
  onBack?: () => void;
  /** Élément de fin de ligne (ex. StatusBadge, bouton d'action) — cf. `right` de la maquette. */
  right?: React.ReactNode;
  /** RTL : inverse l'ordre retour/titres/right et le sens de la flèche. */
  rtl?: boolean;
}

/** En-tête d'écran (retour + titre/sous-titre + emplacement d'action), bordure basse. */
export function ScreenHead({ title, sub, onBack, right, rtl = false }: ScreenHeadProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { flexDirection: rtl ? 'row-reverse' : 'row', borderBottomColor: colors.border }]}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          style={styles.back}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={rtl ? 'رجوع' : 'Retour'}
        >
          {/* La flèche s'inverse visuellement en RTL : "reculer" pointe vers la droite. */}
          <View style={{ transform: [{ scaleX: rtl ? -1 : 1 }] }}>
            <ArrowLeftIcon size={20} color={colors.text} />
          </View>
        </Pressable>
      ) : null}
      <View style={styles.titles}>
        <Text style={[styles.title, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]} numberOfLines={1}>
          {title}
        </Text>
        {sub ? (
          <Text style={[styles.sub, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  // Cible tactile minimum (44px, cf. skill design-system) — carré, centrée sur l'icône 20px.
  back: { width: touch.min, height: touch.min, alignItems: 'center', justifyContent: 'center' },
  titles: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '600' },
  sub: { fontSize: 12, marginTop: 2 },
});
