import * as React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import type { Order, OrderStatus } from '@transpo/domain';
import { LIFECYCLE, STATUS_META } from '@transpo/domain';
import { authedClient, idemKey } from '../../lib/api';
import { C, STATUS_COLOR } from '../../lib/theme';

export default function MissionDetail() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const refStr = String(ref);
  const [order, setOrder] = React.useState<Order | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [cod, setCod] = React.useState('');
  const [done, setDone] = React.useState(false);

  const reload = React.useCallback(async () => {
    try {
      const missions = await authedClient().getMissions();
      const found = missions.find((o) => o.ref === refStr) ?? null;
      setOrder(found);
      if (found?.cod) setCod(String(found.cod));
    } finally { setLoading(false); }
  }, [refStr]);

  React.useEffect(() => { reload(); }, [reload]);

  async function advance() {
    if (!order) return;
    setBusy(true);
    try {
      const updated = await authedClient().driverAdvance(order.ref, idemKey(order.ref, 'advance-' + order.status));
      setOrder(updated);
    } catch (e: any) {
      Alert.alert('Action impossible', e?.message ?? 'Réessayez.');
    } finally { setBusy(false); }
  }

  async function proof() {
    if (!order) return;
    setBusy(true);
    try {
      await authedClient().driverProof(order.ref, { codCollected: Number(cod) || 0 }, idemKey(order.ref, 'proof'));
      setDone(true);
    } catch (e: any) {
      Alert.alert('Preuve impossible', e?.message ?? 'Réessayez.');
    } finally { setBusy(false); }
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={C.indigo} size="large" /></View>;

  if (done || !order) {
    return (
      <View style={s.center}>
        <Text style={s.bigOk}>✓</Text>
        <Text style={s.doneTitle}>{done ? 'Livraison confirmée' : 'Mission terminée'}</Text>
        <Pressable style={s.btn} onPress={() => router.replace('/missions')}>
          <Text style={s.btnTxt}>Retour aux missions</Text>
        </Pressable>
      </View>
    );
  }

  const idx = LIFECYCLE.indexOf(order.status as OrderStatus);
  const atDelivery = order.status === 'LIVRAISON';

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Text style={s.ref}>{order.ref}</Text>
        <View style={[s.badge, { backgroundColor: (STATUS_COLOR[order.status] || C.muted) + '22' }]}>
          <Text style={[s.badgeTxt, { color: STATUS_COLOR[order.status] || C.muted }]}>
            {STATUS_META[order.status]?.fr ?? order.status}
          </Text>
        </View>
      </View>
      <Text style={s.route}>{order.fromCity} → {order.toCity}</Text>
      <Text style={s.merchant}>Marchand : {order.merchant ?? '—'}</Text>

      <View style={s.steps}>
        {LIFECYCLE.map((st, i) => (
          <View key={st} style={s.step}>
            <View style={[s.dot, { backgroundColor: i <= idx ? (STATUS_COLOR[st] || C.indigo) : C.border }]} />
            <Text style={[s.stepTxt, i === idx && s.stepCur, i > idx && s.stepFuture]}>{STATUS_META[st].fr}</Text>
          </View>
        ))}
      </View>

      {atDelivery ? (
        <View style={s.actionBox}>
          {order.cod > 0 && (
            <>
              <Text style={s.label}>Montant COD encaissé (DH)</Text>
              <TextInput style={s.input} value={cod} onChangeText={setCod} keyboardType="numeric" />
            </>
          )}
          <Pressable style={[s.btn, busy && s.btnDisabled]} onPress={proof} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Confirmer la livraison</Text>}
          </Pressable>
        </View>
      ) : (
        <Pressable style={[s.btn, busy && s.btnDisabled]} onPress={advance} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Étape suivante</Text>}
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, padding: 24 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ref: { fontSize: 18, fontWeight: '800', color: C.text },
  route: { fontSize: 15, color: C.muted, marginTop: 8 },
  merchant: { fontSize: 14, color: C.text, marginTop: 4 },
  steps: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, marginTop: 16 },
  step: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  dot: { width: 14, height: 14, borderRadius: 7, marginRight: 10 },
  stepTxt: { fontSize: 14, color: C.text, fontWeight: '600' },
  stepCur: { color: C.indigo, fontWeight: '800' },
  stepFuture: { color: C.muted, fontWeight: '400' },
  actionBox: { marginTop: 20 },
  label: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: C.text, marginBottom: 12 },
  btn: { backgroundColor: C.indigo, borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  btnDisabled: { opacity: 0.6 },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeTxt: { fontSize: 12, fontWeight: '700' },
  bigOk: { fontSize: 64, color: C.green, fontWeight: '800' },
  doneTitle: { fontSize: 20, fontWeight: '800', color: C.text, marginTop: 8, marginBottom: 24 },
});
