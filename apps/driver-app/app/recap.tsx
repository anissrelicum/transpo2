// Récap du jour — partiellement réel : « Courses livrées », « Échecs » et
// « COD collecté » sont dérivés du cache de missions + de la file d'attente
// hors ligne (mêmes sources que `app/(tabs)/missions.tsx`, lot A — clé de
// cache et `applyPending` réutilisés en lecture seule, aucune modification de
// `lib/outbox.ts`). « Gains estimés » applique le tarif réel
// (`getDriverHistory().feePerDelivery`) au nombre de livraisons ainsi compté :
// une estimation, pas un montant confirmé serveur. Distance et temps de
// conduite ne sont suivis nulle part dans l'app : données de démonstration,
// signalées comme telles (cf. design/PLAN-REFONTE-MOBILE.md §5).
import * as React from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TextInput, Alert } from 'react-native';
import { router, useFocusEffect, Stack } from 'expo-router';
import type { Order } from '@transpo/domain';
import type { DriverCash } from '@transpo/api-client';
import { money } from '@transpo/domain';
import { space } from '@transpo/design-tokens';
import { ScreenHead, PrimaryBtn, BottomAction } from '../components/shell';
import { useTheme, resolveColor } from '../lib/theme';
import { useLanguage, type Lang } from '../lib/i18n';
import { authedClient } from '../lib/api';
import { readJson } from '../lib/storage';
import { applyPending, load as loadOutbox } from '../lib/outbox';

// Même clé que `app/(tabs)/missions.tsx` (lot A) : on relit son dernier
// instantané plutôt que d'en tenir un second, incohérent.
const MISSIONS_CACHE_KEY = 'transpo.missions.v1';

const STR = {
  fr: {
    title: 'Récap du jour',
    delivered: 'Courses livrées', failed: 'Échecs', distance: 'Distance', driveTime: 'Temps de conduite',
    demo: 'démo',
    codTitle: 'Encaissement COD', codCollected: 'Collecté (session)',
    cashTitle: 'Ma caisse du jour', cashTheorique: 'Attendu (encaissements enregistrés)',
    cashDeclared: 'Ce que j’ai en main', cashDeclare: 'Déclarer ma caisse',
    cashNone: 'Aucun encaissement enregistré aujourd’hui.',
    cashSent: 'Caisse déclarée', cashGap: (m: string) => `Écart de ${m} — l’exploitation va vous contacter.`,
    cashMatch: 'Compte juste : à déposer en agence.',
    cashFail: 'Déclaration impossible — vérifiez votre connexion.',
    estimated: 'Gains estimés', estimatedNote: (n: number, fee: string) => `estimation : ${n} × ${fee}`,
    estimatedUnavailable: 'Indisponible hors ligne',
    source: "Calculé à partir des missions synchronisées sur cet appareil. Distance et temps de conduite : fonctionnalité à venir, aucune donnée n'est collectée.",
    close: 'Terminer le récap',
    closedTitle: 'Récap consulté',
    closedBody: "Ces chiffres restent locaux à l'appareil : aucune donnée n'est transmise à un serveur pour l'instant.",
    back: 'Retour au profil',
  },
  ar: {
    title: 'ملخص اليوم',
    delivered: 'توصيلات منجزة', failed: 'حالات فشل', distance: 'المسافة', driveTime: 'مدة القيادة',
    demo: 'تجريبي',
    cashTitle: 'صندوقي اليوم', cashTheorique: 'المتوقَّع (تحصيلات مسجَّلة)',
    cashDeclared: 'ما بحوزتي فعلاً', cashDeclare: 'التصريح بالصندوق',
    cashNone: 'لا يوجد تحصيل مسجَّل اليوم.',
    cashSent: 'تم التصريح بالصندوق', cashGap: (m: string) => `فارق ${m} — ستتصل بك العمليات.`,
    cashMatch: 'المبلغ مطابق: يُودع في الوكالة.',
    cashFail: 'تعذّر التصريح — تحقق من اتصالك.',
    codTitle: 'تحصيل الدفع عند الاستلام', codCollected: 'محصَّل (الجلسة)',
    estimated: 'أرباح مقدَّرة', estimatedNote: (n: number, fee: string) => `تقدير: ${n} × ${fee}`,
    estimatedUnavailable: 'غير متاح دون اتصال',
    source: 'محسوب من المهام المُزامنة على هذا الجهاز. المسافة ومدة القيادة: ميزة قادمة، لا يتم جمع أي بيانات حاليًا.',
    close: 'إنهاء الملخص',
    closedTitle: 'تم الاطلاع على الملخص',
    closedBody: 'تبقى هذه الأرقام محلية على الجهاز: لا يتم إرسال أي بيانات إلى الخادم حاليًا.',
    back: 'العودة إلى الملف الشخصي',
  },
} as const;

export default function RecapScreen() {
  const { colors, mode } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = STR[lang as Lang] ?? STR.fr;
  const align: 'right' | 'left' = rtl ? 'right' : 'left';
  const row: 'row' | 'row-reverse' = rtl ? 'row-reverse' : 'row';

  const [loading, setLoading] = React.useState(true);
  const [delivered, setDelivered] = React.useState<Order[]>([]);
  const [failedCount, setFailedCount] = React.useState(0);
  const [codToday, setCodToday] = React.useState(0);
  const [feePerDelivery, setFeePerDelivery] = React.useState<number | null>(null);
  const [closed, setClosed] = React.useState(false);

  const [caisse, setCaisse] = React.useState<DriverCash | null>(null);
  const [declare, setDeclare] = React.useState('');
  const [envoi, setEnvoi] = React.useState(false);

  /**
   * Déclare le cash réellement détenu. Le THÉORIQUE vient du serveur (somme des
   * encaissements enregistrés) ; le DÉCLARÉ est le seul chiffre que le livreur apporte —
   * c'est leur écart qui déclenche le rapprochement côté comptabilité.
   */
  async function declarerLaCaisse() {
    const montant = Number(declare);
    if (!Number.isFinite(montant) || montant < 0) return;
    setEnvoi(true);
    authedClient().getMyCash()
      .then((c) => { setCaisse(c); if (c?.declared != null) setDeclare(String(c.declared)); })
      .catch(() => setCaisse(null));
    try {
      const r = await authedClient().declareMyCash(montant);
      setCaisse((c) => (c ? { ...c, declared: r.declared, status: r.status, ecart: r.ecart } : c));
      Alert.alert(t.cashSent, r.ecart ? t.cashGap(money(Math.abs(r.ecart))) : t.cashMatch);
    } catch {
      Alert.alert(t.cashTitle, t.cashFail);
    } finally {
      setEnvoi(false);
    }
  }

  const load = React.useCallback(async () => {
    setLoading(true);
    const [cached, pending] = await Promise.all([readJson<Order[]>(MISSIONS_CACHE_KEY, []), loadOutbox()]);
    const view = applyPending(cached, pending);
    const done = view.filter((o) => o.status === 'LIVREE');
    setDelivered(done);
    setFailedCount(view.filter((o) => o.status === 'ECHOUEE').length);
    setCodToday(done.reduce((a, o) => a + (o.codPaid ? o.cod : 0), 0));
    try {
      const hist = await authedClient().getDriverHistory();
      setFeePerDelivery(hist.feePerDelivery);
    } catch {
      setFeePerDelivery(null); // hors ligne : pas d'estimation plutôt qu'un chiffre inventé
    }
    setLoading(false);
  }, []);

  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  const today = new Date().toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long',
  });
  const estimate = feePerDelivery != null ? delivered.length * feePerDelivery : null;

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.indigo9} size="large" />
      </View>
    );
  }

  if (closed) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg, padding: 24 }]}>
        <View style={[s.doneCircle, { backgroundColor: resolveColor('green', 3, mode) }]}>
          <Text style={{ fontSize: 32, color: resolveColor('green', 11, mode) }}>✓</Text>
        </View>
        <Text style={[s.doneTitle, { color: colors.text, textAlign: 'center' }]}>{t.closedTitle}</Text>
        <Text style={[s.doneBody, { color: colors.muted, textAlign: 'center' }]}>{t.closedBody}</Text>
        <View style={{ width: '100%', marginTop: 16 }}>
          <PrimaryBtn onPress={() => router.back()}>{t.back}</PrimaryBtn>
        </View>
      </View>
    );
  }

  const stats: { label: string; value: string; demo?: boolean }[] = [
    { label: t.delivered, value: String(delivered.length) },
    { label: t.failed, value: String(failedCount) },
    { label: t.distance, value: '—', demo: true },
    { label: t.driveTime, value: '—', demo: true },
  ];

  return (
    <View style={[s.wrap, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHead title={t.title} sub={today} onBack={() => router.back()} rtl={rtl} />
      <ScrollView contentContainerStyle={s.content}>
        <View style={[s.grid, { flexDirection: row }]}>
          {stats.map((st) => (
            <View key={st.label} style={[s.statCard, { backgroundColor: colors.panel, borderColor: colors.border }]}>
              <View style={[s.statHead, { flexDirection: row }]}>
                <Text style={[s.statLabel, { color: colors.muted }]}>{st.label}</Text>
                {st.demo ? (
                  <View style={[s.demoBadge, { backgroundColor: colors.bg }]}>
                    <Text style={[s.demoBadgeTxt, { color: colors.muted }]}>{t.demo}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[s.statValue, { color: colors.text }]}>{st.value}</Text>
            </View>
          ))}
        </View>

        <View style={[s.card, { backgroundColor: colors.panel, borderColor: colors.border }]}>
          <Text style={[s.cardTitle, { color: colors.text, textAlign: align }]}>{t.codTitle}</Text>
          <View style={[s.cardRow, { flexDirection: row }]}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>{t.codCollected}</Text>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{money(codToday)}</Text>
          </View>
        </View>

        {/* La caisse du jour : le seul endroit où le livreur peut dire ce qu'il a
            réellement en main. Sans cette déclaration, la comptabilité ne rapproche que
            des chiffres qu'elle a elle-même calculés. */}
        <View style={[s.card, { backgroundColor: colors.panel, borderColor: colors.border }]}>
          <Text style={[s.cardTitle, { color: colors.text, textAlign: align }]}>{t.cashTitle}</Text>
          {caisse ? (
            <>
              <View style={[s.cardRow, { flexDirection: row }]}>
                <Text style={{ color: colors.muted, fontSize: 13 }}>{t.cashTheorique}</Text>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{money(caisse.theorique)}</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8, textAlign: align }}>{t.cashDeclared}</Text>
              <TextInput
                value={declare}
                onChangeText={(v) => setDeclare(v.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                style={[s.cashInput, { borderColor: colors.border, color: colors.text, textAlign: align }]}
                testID="caisse-montant-declare"
                accessibilityLabel={t.cashDeclared}
              />
              {caisse.declared != null && (
                <Text style={{ color: caisse.ecart ? resolveColor('red', 11, mode) : resolveColor('green', 11, mode), fontSize: 12, marginTop: 6, textAlign: align }}>
                  {caisse.ecart ? t.cashGap(money(Math.abs(caisse.ecart))) : t.cashMatch}
                </Text>
              )}
              <View style={{ marginTop: 10 }}>
                <PrimaryBtn onPress={declarerLaCaisse} disabled={envoi || declare === ''} testID="caisse-declarer">
                  {t.cashDeclare}
                </PrimaryBtn>
              </View>
            </>
          ) : (
            <Text style={{ color: colors.muted, fontSize: 13, textAlign: align }}>{t.cashNone}</Text>
          )}
        </View>

        <View style={[s.earnedCard, { backgroundColor: resolveColor('green', 3, mode) }]}>
          <View style={[s.cardRow, { flexDirection: row }]}>
            <Text style={{ color: resolveColor('green', 11, mode), fontSize: 13 }}>{t.estimated}</Text>
            <Text style={{ color: resolveColor('green', 11, mode), fontWeight: '800', fontSize: 20 }}>
              {estimate != null ? money(estimate) : '—'}
            </Text>
          </View>
          <Text style={{ color: resolveColor('green', 11, mode), fontSize: 11, textAlign: align }}>
            {estimate != null && feePerDelivery != null
              ? t.estimatedNote(delivered.length, money(feePerDelivery))
              : t.estimatedUnavailable}
          </Text>
        </View>

        <View
          style={[s.callout, { backgroundColor: resolveColor('amber', 3, mode), borderColor: resolveColor('amber', 9, mode) }]}
        >
          <Text style={[s.calloutTxt, { color: resolveColor('amber', 11, mode), textAlign: align }]}>{t.source}</Text>
        </View>
      </ScrollView>
      <BottomAction>
        <PrimaryBtn onPress={() => setClosed(true)}>{t.close}</PrimaryBtn>
      </BottomAction>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  content: { padding: space[4], gap: space[3], paddingBottom: 100 },
  grid: { flexWrap: 'wrap', gap: space[3] },
  cashInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 48, fontSize: 18, fontWeight: '700', marginTop: 4 },
  statCard: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: 14, padding: space[3], gap: 4 },
  statHead: { alignItems: 'center', justifyContent: 'space-between' },
  statLabel: { fontSize: 12 },
  statValue: { fontSize: 22, fontWeight: '800' },
  demoBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  demoBadgeTxt: { fontSize: 10, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 14, padding: space[3], gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  cardRow: { alignItems: 'center', justifyContent: 'space-between' },
  earnedCard: { borderRadius: 14, padding: space[3], gap: 4 },
  callout: { borderWidth: 1, borderRadius: 12, padding: space[3] },
  calloutTxt: { fontSize: 12, lineHeight: 17 },
  doneCircle: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  doneTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  doneBody: { fontSize: 13 },
});
