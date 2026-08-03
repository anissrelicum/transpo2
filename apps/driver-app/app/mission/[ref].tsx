import * as React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import type { Order, OrderStatus } from '@transpo/domain';
import { LIFECYCLE, STATUS_META } from '@transpo/domain';
import { authedClient, idemKey } from '../../lib/api';
import { readJson, writeJson } from '../../lib/storage';
import { enqueue, applyPending } from '../../lib/outbox';
import { useOutbox } from '../../lib/useOutbox';
import { C, STATUS_COLOR } from '../../lib/theme';

const CACHE_KEY = 'transpo.missions.v1';

export default function MissionDetail() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const refStr = String(ref);
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [cod, setCod] = React.useState('');
  const [touchedCod, setTouchedCod] = React.useState(false);

  const { pending, online, sync } = useOutbox();

  const reload = React.useCallback(async () => {
    try {
      const fresh = await authedClient().getMissions();
      setOrders(fresh);
      await writeJson(CACHE_KEY, fresh);
    } catch {
      setOrders(await readJson<Order[]>(CACHE_KEY, [])); // hors ligne : dernier état connu
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { reload(); }, [reload]);

  const order = applyPending(orders, pending).find((o) => o.ref === refStr) ?? null;
  const queued = pending.some((p) => p.ref === refStr);

  // Pré-remplissage du COD attendu, sans écraser une saisie du livreur.
  React.useEffect(() => {
    if (order && !touchedCod) setCod(order.cod ? String(order.cod) : '');
  }, [order?.ref, order?.cod, touchedCod]);

  /** Met l'action en file (donc sur disque) puis tente de l'envoyer tout de suite. */
  async function submit(action: 'advance' | 'proof') {
    if (!order) return;
    setBusy(true);
    try {
      if (action === 'advance') {
        await enqueue({
          kind: 'advance', ref: order.ref, from: order.status as OrderStatus,
          idemKey: idemKey(order.ref, `advance-${order.status}`),
        });
      } else {
        await enqueue({
          kind: 'proof', ref: order.ref, codCollected: Number(cod) || 0,
          idemKey: idemKey(order.ref, 'proof'),
        });
      }
      await sync();
    } finally {
      setBusy(false);
    }
  }

  async function confirmProof() {
    if (!order) return;
    const amount = Number(cod) || 0;
    if (order.cod > 0 && amount < order.cod) {
      // L'API ne marque `codPaid` qu'au montant plein : autant le dire ici.
      Alert.alert(
        'Montant incomplet',
        `Le contre-remboursement attendu est de ${order.cod} DH. Avec ${amount} DH, la commande sera livrée mais marquée non encaissée.`,
        [{ text: 'Corriger', style: 'cancel' }, { text: 'Confirmer', onPress: () => submit('proof') }],
      );
      return;
    }
    submit('proof');
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={C.indigo} size="large" /></View>;

  if (!order) {
    return (
      <View style={s.center}>
        <Text style={s.bigOk}>✓</Text>
        <Text style={s.doneTitle}>Mission terminée</Text>
        <Pressable style={s.btn} onPress={() => router.replace('/missions')}>
          <Text style={s.btnTxt}>Retour aux missions</Text>
        </Pressable>
      </View>
    );
  }

  const idx = LIFECYCLE.indexOf(order.status as OrderStatus);
  const atDelivery = order.status === 'LIVRAISON';
  const delivered = order.status === 'LIVREE';

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

      {queued && (
        <View style={s.pendingBox}>
          <Text style={s.pendingTxt}>
            {online ? 'Envoi en cours…' : 'Enregistré sur l’appareil. Sera transmis au retour du réseau.'}
          </Text>
        </View>
      )}

      <View style={s.steps}>
        {LIFECYCLE.map((st, i) => (
          <View key={st} style={s.step}>
            <View style={[s.dot, { backgroundColor: i <= idx ? (STATUS_COLOR[st] || C.indigo) : C.border }]} />
            <Text style={[s.stepTxt, i === idx && s.stepCur, i > idx && s.stepFuture]}>{STATUS_META[st].fr}</Text>
          </View>
        ))}
      </View>

      {delivered ? (
        <View style={s.actionBox}>
          <Text style={s.doneNote}>
            Livraison confirmée{order.cod > 0 ? (order.codPaid ? ' · COD encaissé' : ' · COD non encaissé') : ''}.
          </Text>
          <Pressable style={s.btn} onPress={() => router.replace('/missions')}>
            <Text style={s.btnTxt}>Retour aux missions</Text>
          </Pressable>
        </View>
      ) : atDelivery ? (
        <View style={s.actionBox}>
          {order.cod > 0 && (
            <>
              <Text style={s.label}>Montant COD encaissé (DH)</Text>
              <TextInput
                style={s.input} value={cod} keyboardType="numeric"
                onChangeText={(v) => { setTouchedCod(true); setCod(v); }}
              />
            </>
          )}
          <Pressable style={[s.btn, busy && s.btnDisabled]} onPress={confirmProof} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Confirmer la livraison</Text>}
          </Pressable>
        </View>
      ) : (
        <Pressable style={[s.btn, busy && s.btnDisabled]} onPress={() => submit('advance')} disabled={busy}>
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
  pendingBox: { backgroundColor: C.amber + '22', borderRadius: 10, padding: 10, marginTop: 12 },
  pendingTxt: { fontSize: 12, color: C.text },
  steps: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, marginTop: 16 },
  step: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  dot: { width: 14, height: 14, borderRadius: 7, marginRight: 10 },
  stepTxt: { fontSize: 14, color: C.text, fontWeight: '600' },
  stepCur: { color: C.indigo, fontWeight: '800' },
  stepFuture: { color: C.muted, fontWeight: '400' },
  actionBox: { marginTop: 20 },
  doneNote: { fontSize: 14, color: C.green, fontWeight: '600' },
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
