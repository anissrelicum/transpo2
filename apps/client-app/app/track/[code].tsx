import * as React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, TextInput, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { TrackResult } from '@transpo/api-client';
import { publicApi, DEFAULT_TENANT, C, STATUS_COLOR } from '../../lib/api';

export default function TrackScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const codeStr = String(code);
  const [data, setData] = React.useState<TrackResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [score, setScore] = React.useState(0);
  const [comment, setComment] = React.useState('');
  const [rated, setRated] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setData(await publicApi().publicTrack(DEFAULT_TENANT, codeStr));
    } catch {
      setError('Colis introuvable. Vérifiez le code.');
    } finally { setLoading(false); }
  }, [codeStr]);

  React.useEffect(() => { load(); }, [load]);

  async function submitRating() {
    if (!score) return;
    try {
      await publicApi().publicRate(DEFAULT_TENANT, codeStr, score, comment || undefined);
      setRated(true);
    } catch {
      setError('Notation impossible (déjà notée ?).');
    }
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={C.indigo} size="large" /></View>;
  if (error && !data) return <View style={s.center}><Text style={s.err}>{error}</Text></View>;
  if (!data) return null;

  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <View style={s.head}>
        <Text style={s.code}>{data.code}</Text>
        <View style={[s.badge, { backgroundColor: (STATUS_COLOR[data.status] || C.muted) + '22' }]}>
          <Text style={[s.badgeTxt, { color: STATUS_COLOR[data.status] || C.muted }]}>{data.statusLabel}</Text>
        </View>
      </View>
      <Text style={s.route}>{data.from} → {data.to}</Text>

      <View style={s.steps}>
        {data.steps.map((st, i) => (
          <View key={st.status} style={s.step}>
            <View style={[s.dot, { backgroundColor: st.done ? C.green : C.border }]}>
              {st.done && <Text style={s.check}>✓</Text>}
            </View>
            <Text style={[s.stepTxt, !st.done && s.stepFuture]}>{st.label}</Text>
          </View>
        ))}
      </View>

      {data.delivered && (data.canRate || rated) && (
        <View style={s.rateBox}>
          <Text style={s.rateTitle}>{rated ? 'Merci pour votre note !' : 'Notez votre livraison'}</Text>
          {!rated ? (
            <>
              <View style={s.stars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable key={n} onPress={() => setScore(n)}>
                    <Text style={[s.star, { color: n <= score ? C.amber : C.border }]}>★</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput style={s.input} value={comment} onChangeText={setComment} placeholder="Commentaire (optionnel)" />
              <Pressable style={[s.btn, !score && s.btnDisabled]} onPress={submitRating} disabled={!score}>
                <Text style={s.btnTxt}>Envoyer</Text>
              </Pressable>
            </>
          ) : (
            <View style={s.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Text key={n} style={[s.star, { color: n <= score ? C.amber : C.border }]}>★</Text>
              ))}
            </View>
          )}
        </View>
      )}
      {data.rating != null && (
        <Text style={s.already}>Vous avez noté cette livraison : {data.rating}/5</Text>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: C.bg },
  err: { color: C.red, fontSize: 15, textAlign: 'center' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontSize: 18, fontWeight: '800', color: C.text },
  route: { fontSize: 15, color: C.muted, marginTop: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeTxt: { fontSize: 12, fontWeight: '700' },
  steps: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, marginTop: 16 },
  step: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  dot: { width: 20, height: 20, borderRadius: 10, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  check: { color: '#fff', fontSize: 12, fontWeight: '800' },
  stepTxt: { fontSize: 14, color: C.text, fontWeight: '600' },
  stepFuture: { color: C.muted, fontWeight: '400' },
  rateBox: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, marginTop: 16, alignItems: 'center' },
  rateTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 8 },
  stars: { flexDirection: 'row', gap: 6, marginVertical: 6 },
  star: { fontSize: 34 },
  input: { alignSelf: 'stretch', borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10, color: C.text },
  btn: { backgroundColor: C.indigo, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 12, alignSelf: 'stretch' },
  btnDisabled: { opacity: 0.5 },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  already: { color: C.muted, textAlign: 'center', marginTop: 16 },
});
