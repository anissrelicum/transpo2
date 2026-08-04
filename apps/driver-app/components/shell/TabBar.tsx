// Barre d'onglets basse de l'app livreur — cf. maquette `lot3-app-livreur.jsx`
// (fonction PhoneShell) et design/lib-design-system.md. Masquée par les écrans
// appelants sur les écrans de flux (connexion, détail, statut, preuve, COD,
// échec), qui affichent un retour `←` via `ScreenHead` à la place.
import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme';
import { ArchiveIcon, StackIcon, CameraIcon, LapTimerIcon, PersonIcon, type IconProps } from './icons';

export type TabId = 'missions' | 'route' | 'scan' | 'shift' | 'profil';

const TABS: ReadonlyArray<{ id: TabId; Icon: React.ComponentType<IconProps>; fr: string; ar: string }> = [
  { id: 'missions', Icon: ArchiveIcon, fr: 'Missions', ar: 'المهام' },
  { id: 'route', Icon: StackIcon, fr: 'Tournée', ar: 'الجولة' },
  { id: 'scan', Icon: CameraIcon, fr: 'Scanner', ar: 'مسح' },
  { id: 'shift', Icon: LapTimerIcon, fr: 'Shift', ar: 'الوردية' },
  { id: 'profil', Icon: PersonIcon, fr: 'Profil', ar: 'الملف' },
];

export interface TabBarProps {
  /** Onglet actif (couleur indigo-11, cf. maquette). */
  active: TabId;
  onChange: (id: TabId) => void;
  /** Langue des libellés (les AR sont ceux de la maquette, pas retraduits). */
  lang?: 'fr' | 'ar';
  /**
   * Mise en page RTL. Par défaut déduite de `lang`, mais surchargeable : la
   * bascule `I18nManager.forceRTL` de RN n'a d'effet complet qu'après relance
   * de l'app (cf. lib/i18n.ts) — un prop explicite évite de dépendre de cet
   * état global pas toujours à jour.
   */
  rtl?: boolean;
}

/** Barre d'onglets basse, 64px, 5 onglets. Contrat partagé des écrans de l'app livreur. */
export function TabBar({ active, onChange, lang = 'fr', rtl = lang === 'ar' }: TabBarProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.bar,
        { flexDirection: rtl ? 'row-reverse' : 'row', borderTopColor: colors.border, backgroundColor: colors.panel },
      ]}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        const tint = isActive ? colors.indigo11 : colors.gray9;
        const label = lang === 'ar' ? tab.ar : tab.fr;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={styles.tab}
            hitSlop={8}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={label}
          >
            <tab.Icon size={20} color={tint} />
            <Text style={[styles.label, { color: tint, fontWeight: isActive ? '600' : '400' }]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Hauteur 64px fixe (constante structurante, cf. design/README.md).
  bar: { height: 64, borderTopWidth: 1 },
  // paddingBottom 6 reprend exactement le décalage de la maquette (icône+label
  // centrés, légèrement remontés par rapport au bas de la barre).
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingBottom: 6 },
  label: { fontSize: 12 }, // Radix Text size="1"
});
