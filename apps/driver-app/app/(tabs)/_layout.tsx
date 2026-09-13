// Layout du groupe (tabs) — porte la barre d'onglets basse (5 onglets) au-dessus
// des écrans Missions / Tournée / Scanner / Shift / Profil. Équivalent réel du
// `PhoneShell` de la maquette (cf. design/PLAN-REFONTE-MOBILE.md §0) : ici pas
// de cadre de téléphone à dessiner, juste le montage de la `TabBar` du socle
// au-dessus du contenu de l'onglet actif.
//
// Pourquoi `Tabs` d'expo-router plutôt qu'un `Slot` fait main : on récupère
// gratuitement la gestion de la pile de navigation par onglet (retour Android,
// état préservé en changeant d'onglet) tout en remplaçant entièrement le rendu
// visuel de la barre par `TabBar` du socle via la prop `tabBar`.
import * as React from 'react';
import { Stack, Tabs } from 'expo-router';
import { TabBar, type TabId } from '../../components/shell';
import { useLanguage } from '../../lib/i18n';

export default function TabsLayout() {
  const { lang, rtl } = useLanguage();

  return (
    <>
      {/*
        Masque le header natif que le Stack racine (app/_layout.tsx, hors de
        notre périmètre) appliquerait sinon au groupe "(tabs)" tout entier —
        la maquette n'a pas de barre système au-dessus des écrans à onglets.
        Ce composant configure, depuis l'intérieur de l'écran, les options de
        SA propre entrée dans le Stack parent (mécanisme standard expo-router,
        n'écrit rien dans app/_layout.tsx).
      */}
      <Stack.Screen options={{ headerShown: false }} />
      <Tabs
        // Chaque écran d'onglet gère son propre en-tête (ScreenHead ou entête
        // maison) : pas de double header Tabs + écran.
        screenOptions={{ headerShown: false }}
        tabBar={(props) => {
          const active = (props.state.routes[props.state.index]?.name ?? 'missions') as TabId;
          return (
            <TabBar
              active={active}
              onChange={(id) => props.navigation.navigate(id as never)}
              lang={lang}
              rtl={rtl}
            />
          );
        }}
      >
        <Tabs.Screen name="missions" />
        <Tabs.Screen name="route" />
        <Tabs.Screen name="scan" />
        <Tabs.Screen name="shift" />
        <Tabs.Screen name="profil" />
      </Tabs>
    </>
  );
}
