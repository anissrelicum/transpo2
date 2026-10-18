// Barre d'onglets basse — maquette validée (design/app-livreur/maquette.html) :
// Journée, Tournée, Scanner, Caisse, Profil. Masquée sur les écrans de flux (détail,
// preuve, encaissement, échec), qui ont leur propre retour.
import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import { IcCarte, IcListe, IcScan, IcCaisse, IcProfil } from '../icones';

export type TabId = 'journee' | 'route' | 'scan' | 'caisse' | 'profil';

const TABS: ReadonlyArray<{ id: TabId; Icon: typeof IcCarte; fr: string; ar: string }> = [
  { id: 'journee', Icon: IcCarte, fr: 'Journée', ar: 'يومي' },
  { id: 'route', Icon: IcListe, fr: 'Tournée', ar: 'الجولة' },
  { id: 'scan', Icon: IcScan, fr: 'Scanner', ar: 'مسح' },
  { id: 'caisse', Icon: IcCaisse, fr: 'Caisse', ar: 'الصندوق' },
  { id: 'profil', Icon: IcProfil, fr: 'Profil', ar: 'الملف' },
];

export interface TabBarProps {
  active: TabId;
  onChange: (id: TabId) => void;
  lang?: 'fr' | 'ar';
  /** RTL explicite : `I18nManager.forceRTL` n'agit qu'après relance (cf. lib/i18n.ts). */
  rtl?: boolean;
}

export function TabBar({ active, onChange, lang = 'fr', rtl = lang === 'ar' }: TabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bar,
        { flexDirection: rtl ? 'row-reverse' : 'row', borderTopColor: colors.border, backgroundColor: colors.panel, paddingBottom: Math.max(insets.bottom, 8) },
      ]}
    >
      {TABS.map((tab) => {
        const on = tab.id === active;
        const tint = on ? colors.indigo9 : colors.gray9;
        const label = lang === 'ar' ? tab.ar : tab.fr;
        return (
          <Pressable
            key={tab.id}
            testID={`onglet-${tab.id}`}
            onPress={() => onChange(tab.id)}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label}
          >
            <tab.Icon size={24} color={tint} />
            <Text style={[styles.label, { color: tint }]} numberOfLines={1}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: 1, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 52 },
  label: { fontSize: 11, fontWeight: '600' },
});
