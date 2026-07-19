import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { C } from '../lib/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.indigo },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: C.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Transpo Livreur' }} />
        <Stack.Screen name="missions" options={{ title: 'Mes missions' }} />
        <Stack.Screen name="mission/[ref]" options={{ title: 'Mission' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
