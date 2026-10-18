// Groupe (tabs) : la barre d'onglets de la maquette validée, et le partage de position.
//
// Le suivi de position est monté ICI, au-dessus des onglets, et non dans un écran : il
// doit tourner tant que la journée est démarrée, quel que soit l'onglet affiché.
import * as React from 'react';
import { Stack, Tabs } from 'expo-router';
import { TabBar, type TabId } from '../../components/shell';
import { useLanguage } from '../../lib/i18n';
import { useService } from '../../lib/service';
import { useTracking } from '../../lib/tracking';

export default function TabsLayout() {
  const { lang, rtl } = useLanguage();
  const { etat, pret } = useService();
  useTracking(pret && etat.active);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => {
          const active = (props.state.routes[props.state.index]?.name ?? 'journee') as TabId;
          return (
            <TabBar active={active} onChange={(id) => props.navigation.navigate(id as never)} lang={lang} rtl={rtl} />
          );
        }}
      >
        <Tabs.Screen name="journee" />
        <Tabs.Screen name="route" />
        <Tabs.Screen name="scan" />
        <Tabs.Screen name="caisse" />
        <Tabs.Screen name="profil" />
      </Tabs>
    </>
  );
}
