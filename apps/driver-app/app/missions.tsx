import * as React from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { Order } from '@transpo/domain';
import { STATUS_META } from '@transpo/domain';
import { authedClient, getSession } from '../lib/api';
import { C, STATUS_COLOR } from '../lib/theme';

export default function MissionsScreen() {
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const name = getSession()?.name ?? '';

  const loadData = React.useCallback(async () => {
    setError(null);
    try {
      setOrders(await authedClient().getMissions());
    } catch (e) {
      setError('Impossible de charger les missions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(React.useCallback(() => { loadData(); }, [loadData]));

  if (loading) return <View style={s.center}><ActivityIndicator color={C.indigo} size="large" /></View>;

  return (
    <View style={s.wrap}>
      <Text style={s.hello}>Bonjour {name}</Text>
      <Text style={s.count}>{orders.length} mission(s) active(s)</Text>
      {error && <Text style={s.error}>{error}</Text>}
      <FlatList
        data={orders}
        keyExtractor={(o) => o.ref}
        refreshControl={<RefreshControl refreshing={false} onRefresh={loadData} />}
        ListEmptyComponent={<Text style={s.empty}>Aucune mission active. Tirez pour rafraîchir.</Text>}
        renderItem={({ item }) => (
          <Pressable style={s.card} onPress={() => router.push(`/mission/${encodeURIComponent(item.ref)}`)}>
            <View style={s.rowBetween}>
              <Text style={s.ref}>{item.ref}</Text>
              <View style={[s.badge, { backgroundColor: (STATUS_COLOR[item.status] || C.muted) + '22' }]}>
                <Text style={[s.badgeTxt, { color: STATUS_COLOR[item.status] || C.muted }]}>
                  {STATUS_META[item.status]?.fr ?? item.status}
                </Text>
              </View>
            </View>
            <Text style={s.route}>{item.fromCity} → {item.toCity}</Text>
            <View style={s.rowBetween}>
              <Text style={s.merchant}>{item.merchant ?? '—'}</Text>
              {item.cod > 0 && (
                <Text style={[s.cod, { color: item.codPaid ? C.green : C.amber }]}>
                  COD {item.cod} DH{item.codPaid ? ' ✓' : ''}
                </Text>
              )}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  hello: { fontSize: 20, fontWeight: '800', color: C.text },
  count: { fontSize: 13, color: C.muted, marginBottom: 12 },
  error: { color: C.red, marginBottom: 8 },
  empty: { color: C.muted, textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, marginBottom: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ref: { fontSize: 15, fontWeight: '700', color: C.text },
  route: { fontSize: 14, color: C.muted, marginVertical: 6 },
  merchant: { fontSize: 13, color: C.text },
  cod: { fontSize: 13, fontWeight: '700' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeTxt: { fontSize: 12, fontWeight: '700' },
});
