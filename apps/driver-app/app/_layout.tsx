import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';

export default function RootLayout() {
  const { mode, colors } = useTheme();

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
