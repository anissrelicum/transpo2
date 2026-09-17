import * as React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';
import { initialiserLePush } from '../lib/push';

export default function RootLayout() {
  const { mode, colors } = useTheme();

  // OneSignal s'initialise une fois, au démarrage. Dans Expo Go il ne se passe rien :
  // le module natif n'y existe pas, et `lib/push` le sait (cf. le commentaire là-bas).
  React.useEffect(() => initialiserLePush(), []);

  return (
    <SafeAreaProvider>
      {/* Suit le thème système : icônes claires sur fond sombre, et inversement. */}
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          // Chaque écran rend son propre ScreenHead : pas de header natif par
          // défaut (les écrans qui le redemandent le font via <Stack.Screen>).
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Transpo Livreur' }} />
        <Stack.Screen name="incidents" options={{ title: 'Incidents' }} />
        <Stack.Screen name="support" options={{ title: 'Support' }} />
        <Stack.Screen name="gains" options={{ title: 'Historique & gains' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
