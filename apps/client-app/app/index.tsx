import * as React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { C } from '../lib/api';

export default function HomeScreen() {
  const [code, setCode] = React.useState('');

  function track() {
    const c = code.trim().toUpperCase();
    if (c) router.push(`/track/${encodeURIComponent(c)}`);
  }

  return (
    <View style={s.wrap}>
      <View style={s.brand}>
        <View style={s.logo}><Text style={s.logoTxt}>T</Text></View>
        <Text style={s.title}>Suivez votre colis</Text>
        <Text style={s.sub}>Entrez le code de suivi reçu par SMS</Text>
      </View>
      <View style={s.card}>
        <Text style={s.label}>Code de suivi</Text>
        <TextInput
          style={s.input}
          value={code}
          onChangeText={setCode}
          placeholder="Ex. TRACK123"
          autoCapitalize="characters"
          autoCorrect={false}
          onSubmitEditing={track}
        />
        <Pressable style={s.btn} onPress={track}>
          <Text style={s.btnTxt}>Suivre</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: C.bg },
  brand: { alignItems: 'center', marginBottom: 28 },
  logo: { width: 56, height: 56, borderRadius: 16, backgroundColor: C.indigo, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  logoTxt: { color: '#fff', fontSize: 28, fontWeight: '800' },
  title: { fontSize: 22, fontWeight: '800', color: C.text },
  sub: { fontSize: 13, color: C.muted, marginTop: 4, textAlign: 'center' },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.border },
  label: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 18, color: C.text, letterSpacing: 2 },
  btn: { backgroundColor: C.indigo, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
