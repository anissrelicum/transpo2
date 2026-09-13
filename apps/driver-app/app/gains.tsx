// Historique & gains — redesign visuel uniquement. `getDriverHistory()` et le
// cache `CACHE_KEY` sont inchangés (cf. design/PLAN-REFONTE-MOBILE.md §3).
// Le contre-remboursement (COD) reste affiché séparément des gains, avec le
// même avertissement qu'avant : il est encaissé pour le compte des marchands,
// pas une rémunération du livreur (confusion à éviter : ex. 96 DH de gains à
// côté de 1 840 DH de COD).
//
// La maquette propose un filtre « cette semaine / ce mois » (`Earnings`,
// design/lot3-app-livreur.jsx) : impossible à reproduire fidèlement, `Order`
// (`@transpo/domain`) n'expose pas de date par commande dans
// `DriverHistory.orders` — on ne filtre donc pas par période (donnée
// inexistante, pas une simplification arbitraire). Pas de badge
// Freelance/Salarié non plus : `DriverHistory` n'a pas de champ de contrat.
import * as React from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { router, useFocusEffect, Stack } from 'expo-router';
import type { DriverHistory } from '@transpo/api-client';
import { money } from '@transpo/domain';
import { space } from '@transpo/design-tokens';
import { ScreenHead } from '../components/shell';
import { authedClient } from '../lib/api';
import { readJson, writeJson } from '../lib/storage';
import { useTheme, resolveColor } from '../lib/theme';
import { useLanguage, type Lang } from '../lib/i18n';

const CACHE_KEY = 'transpo.history.v1';

const STR = {
  fr: {
    title: 'Historique & gains',
    perDelivery: (fee: string) => `${fee} par livraison`,
    offline: 'Hors ligne — données du dernier chargement.',
    deliveries: 'Livraisons',
    gains: 'Gains',
    codTitle: 'Contre-remboursement encaissé',
    codHint: 'Somme collectée pour le compte des marchands — elle ne fait pas partie de vos gains.',
    section: 'Livraisons',
    empty: 'Aucune livraison terminée.',
    unavailable: 'Historique indisponible hors ligne.',
  },
  ar: {
    title: 'السجل والأرباح',
    perDelivery: (fee: string) => `${fee} لكل توصيلة`,
    offline: 'غير متصل — بيانات آخر تحميل.',
    deliveries: 'التوصيلات',
    gains: 'الأرباح',
    codTitle: 'الدفع عند الاستلام المُحصَّل',
    codHint: 'مبلغ مُحصَّل لحساب التجار — لا يُعد جزءًا من أرباحك.',
    section: 'التوصيلات',
    empty: 'لا توجد توصيلات منجزة.',
    unavailable: 'السجل غير متاح دون اتصال.',
  },
} as const;

export default function GainsScreen() {
  const { colors, mode } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = STR[lang as Lang] ?? STR.fr;
  const align: 'right' | 'left' = rtl ? 'right' : 'left';
  const row: 'row' | 'row-reverse' = rtl ? 'row-reverse' : 'row';

  const [data, setData] = React.useState<DriverHistory | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [stale, setStale] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const fresh = await authedClient().getDriverHistory();
      setData(fresh);
      setStale(false);
      await writeJson(CACHE_KEY, fresh);
    } catch {
      const cached = await readJson<DriverHistory | null>(CACHE_KEY, null);
      if (cached) {
        setData(cached);
        setStale(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  return (
    <View style={[s.wrap, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHead
        title={t.title}
        sub={data ? t.perDelivery(money(data.feePerDelivery)) : undefined}
        onBack={() => router.back()}
        rtl={rtl}
      />
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.indigo9} size="large" />
        </View>
      ) : !data ? (
        <View style={[s.center, { padding: 24 }]}>
          <Text style={{ color: colors.muted, textAlign: 'center' }}>{t.unavailable}</Text>
        </View>
      ) : (
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        {stale && (
          <View style={[s.staleBanner, { backgroundColor: resolveColor('amber', 3, mode) }]}>
            <Text style={{ color: resolveColor('amber', 11, mode), fontSize: 12, textAlign: align }}>{t.offline}</Text>
          </View>
        )}

        <View style={[s.kpis, { flexDirection: row }]}>
          <View style={[s.kpi, { backgroundColor: colors.panel, borderColor: colors.border }]}>
            <Text style={[s.kpiLabel, { color: colors.muted }]}>{t.deliveries}</Text>
            <Text style={[s.kpiValue, { color: colors.text }]}>{data.deliveries}</Text>
          </View>
          <View style={[s.kpi, s.kpiMain, { backgroundColor: resolveColor('green', 3, mode) }]}>
            <Text style={[s.kpiLabel, { color: resolveColor('green', 11, mode) }]}>{t.gains}</Text>
            <Text style={[s.kpiValue, { color: resolveColor('green', 11, mode) }]}>{money(data.gains)}</Text>
          </View>
        </View>

        <View style={[s.card, { backgroundColor: colors.panel, borderColor: colors.border }]}>
          <Text style={[s.cardLabel, { color: colors.muted, textAlign: align }]}>{t.codTitle}</Text>
          <Text style={[s.cardValue, { color: colors.text, textAlign: align }]}>{money(data.codCollected)}</Text>
          <Text style={[s.cardHint, { color: colors.muted, textAlign: align }]}>{t.codHint}</Text>
        </View>

        <Text style={[s.section, { color: colors.text, textAlign: align }]}>{t.section}</Text>
        {data.orders.length === 0 && <Text style={{ color: colors.muted }}>{t.empty}</Text>}
        {data.orders.map((o) => (
          <View key={o.ref} style={[s.row, { flexDirection: row, borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.rowRef, { color: colors.text, textAlign: align }]}>{o.ref}</Text>
              <Text style={[s.rowCity, { color: colors.muted, textAlign: align }]}>{o.toCity}</Text>
            </View>
            {o.cod > 0 && (
              <Text
                style={[
                  s.rowCod,
                  { color: o.codPaid ? resolveColor('green', 11, mode) : resolveColor('amber', 11, mode) },
                ]}
              >
                {money(o.cod)}{o.codPaid ? ' ✓' : ''}
              </Text>
            )}
          </View>
        ))}
      </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  content: { padding: space[4], paddingBottom: 40, gap: space[3] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  staleBanner: { borderRadius: 10, padding: 10 },
  kpis: { gap: 10 },
  kpi: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 14 },
  kpiMain: { flex: 1.3, borderWidth: 0 },
  kpiLabel: { fontSize: 12, fontWeight: '600' },
  kpiValue: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14 },
  cardLabel: { fontSize: 12, fontWeight: '600' },
  cardValue: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  cardHint: { fontSize: 11, marginTop: 6 },
  section: { fontSize: 16, fontWeight: '800', marginTop: 8 },
  row: { alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1 },
  rowRef: { fontSize: 14, fontWeight: '600' },
  rowCity: { fontSize: 12, marginTop: 2 },
  rowCod: { fontSize: 13, fontWeight: '700' },
});
