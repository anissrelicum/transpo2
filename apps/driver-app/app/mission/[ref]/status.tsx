// Mise à jour de statut — cf. maquette `StatusUpdate`/`FailButton`/`ConfirmContent`.
// Machine à états séquentielle sur le chemin nominal du cycle de vie. Chaque
// étape appelle `enqueue({kind:'advance', ...})` puis `sync()`, à l'identique de
// l'ancien `mission/[ref].tsx` (branche `!atDelivery`) — même clé d'idempotence.
// `ConfirmContent` (AlertDialog Radix) n'a pas d'équivalent RN direct : remplacé
// par `Alert.alert` natif (Annuler/Confirmer), qui rend le même service.
import * as React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import type { Order, OrderStatus } from '@transpo/domain';
import { STATUS_META } from '@transpo/domain';
import { radius, space, touch } from '@transpo/design-tokens';
import { authedClient, idemKey } from '../../../lib/api';
import { readJson, writeJson } from '../../../lib/storage';
import { enqueue, applyPending } from '../../../lib/outbox';
import { useOutbox } from '../../../lib/useOutbox';
import { useTheme, resolveColor } from '../../../lib/theme';
import { useLanguage } from '../../../lib/i18n';
import { ScreenHead, BottomAction, PrimaryBtn } from '../../../components/shell';

const CACHE_KEY = 'transpo.missions.v1';

// Chemin nominal, cf. maquette `FLOW` — mais gardé au plus proche du domaine :
// `s`/`next` sont directement des `OrderStatus` réels (`@transpo/domain`), pas
// une copie de `STATUS_META`/`LIFECYCLE` (cf. plan §4, ne pas redéfinir la source).
const FLOW: ReadonlyArray<{ s: OrderStatus; next: OrderStatus; fr: string; ar: string }> = [
  { s: 'ASSIGNEE', next: 'RETRAIT', fr: 'Démarrer vers le retrait', ar: 'بدء التوجه للاستلام' },
  { s: 'RETRAIT', next: 'RECUPEREE', fr: 'Colis récupéré', ar: 'تم استلام الطرد' },
  { s: 'RECUPEREE', next: 'LIVRAISON', fr: 'Démarrer la livraison', ar: 'بدء التسليم' },
  { s: 'LIVRAISON', next: 'LIVREE', fr: 'Confirmer la livraison', ar: 'تأكيد التسليم' },
];

const T = {
  fr: {
    title: 'Progression', done: 'Terminé', current: 'Étape en cours', upcoming: 'À venir',
    failBtn: 'Signaler un échec',
    confirmTitle: (label: string) => `${label} ?`,
    confirmDesc: (next: string) => `Le statut passera à « ${next} » et le client sera notifié.`,
    cancel: 'Annuler', confirm: 'Confirmer',
    notFoundTitle: 'Commande introuvable', notFoundBody: 'Elle a peut-être déjà été traitée.',
    backToMissions: 'Retour aux missions',
    offline: 'Enregistré sur l’appareil. Sera transmis au retour du réseau.', syncing: 'Envoi en cours…',
  },
  ar: {
    title: 'التقدم', done: 'مكتمل', current: 'المرحلة الحالية', upcoming: 'قادم',
    failBtn: 'الإبلاغ عن فشل',
    confirmTitle: (label: string) => `${label}؟`,
    confirmDesc: (next: string) => `ستتغير الحالة إلى « ${next} » وسيتم إشعار العميل.`,
    cancel: 'إلغاء', confirm: 'تأكيد',
    notFoundTitle: 'الشحنة غير موجودة', notFoundBody: 'ربما تمت معالجتها بالفعل.',
    backToMissions: 'العودة إلى المهام',
    offline: 'تم الحفظ على الجهاز. سيُرسل عند عودة الشبكة.', syncing: 'جارٍ الإرسال…',
  },
} as const;

export default function StatusUpdate() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const refStr = String(ref);
  const { colors, mode } = useTheme();
  // Blanc du texte sur pastille pleine indigo, tiré des tokens (slate1, cf.
  // `brand` design-tokens) plutôt qu'un littéral hex — évite le blanc en dur.
  const onSolid = resolveColor('slate', 1, 'light');
  const redFg = resolveColor('red', 9, mode);
  const { lang, rtl } = useLanguage();
  const t = T[lang === 'ar' ? 'ar' : 'fr'];

  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const { pending, online, sync } = useOutbox();

  const reload = React.useCallback(async () => {
    try {
      const fresh = await authedClient().getMissions();
      setOrders(fresh);
      await writeJson(CACHE_KEY, fresh);
    } catch {
      setOrders(await readJson<Order[]>(CACHE_KEY, []));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { reload(); }, [reload]);

  const order = applyPending(orders, pending).find((o) => o.ref === refStr) ?? null;
  const queued = pending.some((p) => p.ref === refStr);

  /** Met l'avancée en file (donc sur disque) puis tente de l'envoyer tout de suite — identique à l'existant. */
  async function advance() {
    if (!order) return;
    setBusy(true);
    try {
      await enqueue({
        kind: 'advance', ref: order.ref, from: order.status,
        idemKey: idemKey(order.ref, `advance-${order.status}`),
      });
      await sync();
    } finally {
      setBusy(false);
    }
  }

  function confirmAdvance(label: string, nextLabel: string) {
    Alert.alert(t.confirmTitle(label), t.confirmDesc(nextLabel), [
      { text: t.cancel, style: 'cancel' },
      { text: t.confirm, onPress: advance },
    ]);
  }

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.indigo9} size="large" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <Text style={[s.notFoundTitle, { color: colors.text }]}>{t.notFoundTitle}</Text>
        <Text style={[s.notFoundBody, { color: colors.muted }]}>{t.notFoundBody}</Text>
        <PrimaryBtn onPress={() => router.replace('/(tabs)/missions')}>{t.backToMissions}</PrimaryBtn>
      </View>
    );
  }

  const idx = Math.max(0, FLOW.findIndex((f) => f.s === order.status));
  const cur = FLOW[idx]!;
  const atLastStep = idx === FLOW.length - 1; // LIVRAISON : l'action suivante est la preuve, pas un `advance`

  return (
    <View style={[s.wrap, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHead title={t.title} sub={order.ref} onBack={() => router.back()} rtl={rtl} />

      {queued && (
        <View style={[s.pendingBox, { backgroundColor: colors.border }]}>
          <Text style={[s.pendingTxt, { color: colors.text }]}>{online ? t.syncing : t.offline}</Text>
        </View>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
        {FLOW.map((f, i) => {
          const done = i < idx;
          const active = i === idx;
          const label = lang === 'ar' ? f.ar : f.fr;
          const nextLabel = lang === 'ar' ? STATUS_META[f.next].ar : STATUS_META[f.next].fr;
          return (
            <View key={f.s} style={[s.row, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <View style={s.railCol}>
                <View
                  style={[
                    s.dot,
                    { backgroundColor: done ? colors.indigo9 : active ? colors.indigo9 : colors.border },
                  ]}
                >
                  <Text style={[s.dotTxt, { color: done || active ? onSolid : colors.muted }]}>
                    {done ? '✓' : String(i + 1)}
                  </Text>
                </View>
                {i < FLOW.length - 1 && (
                  <View style={[s.rail, { backgroundColor: done ? colors.indigo9 : colors.border }]} />
                )}
              </View>
              <View style={s.stepBody}>
                <Text
                  style={[
                    s.stepLabel,
                    { color: done || active ? colors.text : colors.muted, textAlign: rtl ? 'right' : 'left' },
                    active && s.stepLabelActive,
                  ]}
                >
                  {nextLabel}
                </Text>
                <Text style={[s.stepSub, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>
                  {done ? t.done : active ? t.current : t.upcoming}
                </Text>
                {active && f.s === 'LIVRAISON' && (
                  <Pressable
                    onPress={() => router.push(`/mission/${order.ref}/fail`)}
                    style={[s.failBtn, { borderColor: colors.border, alignSelf: rtl ? 'flex-end' : 'flex-start' }]}
                    accessibilityRole="button"
                    accessibilityLabel={t.failBtn}
                  >
                    <Text style={[s.failTxt, { color: redFg }]}>{t.failBtn}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <BottomAction>
        <PrimaryBtn
          loading={busy}
          onPress={() =>
            atLastStep ? router.push(`/mission/${order.ref}/proof`) : confirmAdvance(lang === 'ar' ? cur.ar : cur.fr, lang === 'ar' ? STATUS_META[cur.next].ar : STATUS_META[cur.next].fr)
          }
        >
          {lang === 'ar' ? cur.ar : cur.fr}
        </PrimaryBtn>
      </BottomAction>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  notFoundTitle: { fontSize: 18, fontWeight: '700' },
  notFoundBody: { fontSize: 14, marginBottom: 8, textAlign: 'center' },
  pendingBox: { margin: space[4], marginBottom: 0, borderRadius: radius[3], padding: space[3] },
  pendingTxt: { fontSize: 12 },
  content: { padding: space[4], paddingBottom: 120 },
  row: { gap: 12 },
  railCol: { alignItems: 'center' },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dotTxt: { fontSize: 13, fontWeight: '700' },
  rail: { width: 2, flex: 1, minHeight: 40 },
  stepBody: { flex: 1, paddingBottom: space[4] },
  stepLabel: { fontSize: 15, fontWeight: '500' },
  stepLabelActive: { fontWeight: '700' },
  stepSub: { fontSize: 12, marginTop: 2 },
  failBtn: { marginTop: 10, minHeight: touch.min, borderWidth: 1, borderRadius: radius[3], paddingHorizontal: 14, justifyContent: 'center' },
  failTxt: { fontSize: 13, fontWeight: '700' },
});
