import * as React from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { DriverHistory } from '@transpo/api-client';
import { authedClient } from '../lib/api';
import { readJson, writeJson } from '../lib/storage';
import { C } from '../lib/theme';

const CACHE_KEY = 'transpo.history.v1';

export default function GainsScreen() {
  const [data, setData] = React.useState<DriverHistory | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [stale, setStale] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const fresh = await authedClient().getDriverHistory();
      setData(fresh); setStale(false);
      await writeJson(CACHE_KEY, fresh);
    } catch {
      const cached = await readJson<DriverHistory | null>(CACHE_KEY, null);
      if (cached) { setData(cached); setStale(true); }
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  if (loading) return <View style={s.center}><ActivityIndicator color={C.indigo} size="large" /></View>;
  if (!data) return <View style={s.center}><Text style={s.empty}>Historique indisponible hors ligne.</Text></View>;

  return (
    <ScrollView
      style={s.wrap} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
    >
      {stale && <Text style={s.stale}>Hors ligne — données du dernier chargement.</Text>}

      <View style={s.kpis}>
        <View style={s.kpi}>
          <Text style={s.kpiLabel}>Livraisons</Text>
          <Text style={s.kpiValue}>{data.deliveries}</Text>
        </View>
        <View style={[s.kpi, s.kpiMain]}>
          <Text style={s.kpiLabel}>Gains</Text>
          <Text style={[s.kpiValue, { color: C.green }]}>{data.gains} DH</Text>
          <Text style={s.kpiHint}>{data.feePerDelivery} DH par livraison</Text>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.cardLabel}>Contre-remboursement encaissé</Text>
        <Text style={s.cardValue}>{data.codCollected} DH</Text>
        <Text style={s.cardHint}>
          Somme collectée pour le compte des marchands — elle ne fait pas partie de vos gains.
        </Text>
      </View>

      <Text style={s.title}>Livraisons</Text>
      {data.orders.length === 0 && <Text style={s.empty}>Aucune livraison terminée.</Text>}
      {data.orders.map((o) => (
        <View key={o.ref} style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowRef}>{o.ref}</Text>
            <Text style={s.rowCity}>{o.toCity}</Text>
          </View>
          {o.cod > 0 && (
            <Text style={[s.rowCod, { color: o.codPaid ? C.green : C.amber }]}>
              {o.cod} DH{o.codPaid ? ' ✓' : ''}
            </Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, padding: 24 },
  stale: { fontSize: 12, color: C.amber, marginBottom: 10 },
  kpis: { flexDirection: 'row', gap: 10 },
  kpi: { flex: 1, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14 },
  kpiMain: { flex: 1.3 },
  kpiLabel: { fontSize: 12, color: C.muted, fontWeight: '600' },
  kpiValue: { fontSize: 26, fontWeight: '800', color: C.text, marginTop: 4 },
  kpiHint: { fontSize: 11, color: C.muted, marginTop: 2 },
  card: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, marginTop: 12 },
  cardLabel: { fontSize: 12, color: C.muted, fontWeight: '600' },
  cardValue: { fontSize: 20, fontWeight: '800', color: C.text, marginTop: 4 },
  cardHint: { fontSize: 11, color: C.muted, marginTop: 6 },
  title: { fontSize: 16, fontWeight: '800', color: C.text, marginTop: 24, marginBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  rowRef: { fontSize: 14, fontWeight: '600', color: C.text },
  rowCity: { fontSize: 12, color: C.muted, marginTop: 2 },
  rowCod: { fontSize: 13, fontWeight: '700' },
  empty: { color: C.muted },
});
