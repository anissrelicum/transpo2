import * as React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { publicClient, setSession } from '../lib/api';
import { C } from '../lib/theme';

export default function LoginScreen() {
  const [tenant, setTenant] = React.useState('casaexpress');
  const [email, setEmail] = React.useState('livreur@casaexpress.ma');
  const [password, setPassword] = React.useState('transpo');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function submit() {
    setLoading(true); setError(null);
    try {
      const res = await publicClient(tenant).login(email, password);
      setSession({ token: res.token, name: res.name, tenant });
      router.replace('/missions');
    } catch (e: any) {
      setError('Identifiants invalides ou serveur injoignable.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.wrap}>
      <View style={s.brand}>
        <View style={s.logo}><Text style={s.logoTxt}>T</Text></View>
        <Text style={s.title}>Transpo Livreur</Text>
        <Text style={s.sub}>Application de livraison</Text>
      </View>

      <View style={s.card}>
        {error && <Text style={s.error}>{error}</Text>}
        <Text style={s.label}>Organisation</Text>
        <TextInput style={s.input} value={tenant} onChangeText={setTenant} autoCapitalize="none" />
        <Text style={s.label}>E-mail</Text>
        <TextInput style={s.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Text style={s.label}>Mot de passe</Text>
        <TextInput style={s.input} value={password} onChangeText={setPassword} secureTextEntry />
        <Pressable style={[s.btn, loading && s.btnDisabled]} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Se connecter</Text>}
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
  sub: { fontSize: 13, color: C.muted, marginTop: 2 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.border },
  label: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.text },
  btn: { backgroundColor: C.indigo, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  btnDisabled: { opacity: 0.6 },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  error: { color: C.red, fontSize: 13, marginBottom: 4 },
});
