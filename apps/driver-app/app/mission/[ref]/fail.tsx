// Échec de livraison — cf. maquette `Fail`. Endpoint réel déployé :
// `driverFail(ref, reason, idemKey)` → POST /v1/driver/orders/:ref/fail, motif
// obligatoire (400 sinon côté API), déclarable uniquement en statut LIVRAISON,
// délègue à `ReturnsService.fail` → commande `ECHOUEE` + retour `A_TRAITER`.
// Passe par la file hors ligne comme les deux autres actions (`kind: 'fail'`,
// déjà porté par le tech lead dans `lib/outbox.ts` — non modifié ici).
import * as React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import type { Order } from '@transpo/domain';
import { radius, space, touch } from '@transpo/design-tokens';
import { authedClient, idemKey } from '../../../lib/api';
import { readJson, writeJson } from '../../../lib/storage';
import { enqueue, applyPending } from '../../../lib/outbox';
import { useOutbox } from '../../../lib/useOutbox';
import { useTheme } from '../../../lib/theme';
import { useLanguage } from '../../../lib/i18n';
import { ScreenHead, BottomAction, PrimaryBtn } from '../../../components/shell';

const CACHE_KEY = 'transpo.missions.v1';

// Motifs normalisés — cf. maquette `REASONS`. Aucun enum équivalent côté
// `@transpo/domain` (le motif est un texte libre côté API, cf. driver.service.ts) :
// ce n'est donc pas une redéfinition de source domaine, juste une liste d'aide
// à la saisie propre à cet écran.
const REASONS: ReadonlyArray<{ fr: string; ar: string }> = [
  { fr: 'Destinataire absent', ar: 'المستلم غائب' },
  { fr: 'Adresse introuvable', ar: 'العنوان غير موجود' },
  { fr: 'Refus du colis', ar: 'رفض الطرد' },
  { fr: 'Téléphone injoignable', ar: 'الهاتف لا يُجاب' },
  { fr: 'Colis endommagé', ar: 'الطرد تالف' },
  { fr: 'Autre motif', ar: 'سبب آخر' },
];

const T = {
  fr: {
    title: 'Échec de livraison',
    intro: 'Indiquez un motif normalisé. La commande passera en retour.',
    reasonLabel: 'Motif', notesLabel: 'Notes complémentaires (optionnel)',
    notesPlaceholder: 'Précisez le contexte (ex. : 2 appels sans réponse à 13h05 et 13h20)',
    submit: 'Passer en retour',
    confirmTitle: 'Confirmer l’échec ?',
    confirmBody: (reason: string) => `Motif : « ${reason} ». La commande sera renvoyée vers le marchand.`,
    cancel: 'Annuler', confirm: 'Confirmer le retour',
    notFoundTitle: 'Commande introuvable', notFoundBody: 'Elle a peut-être déjà été traitée.',
    backToMissions: 'Retour aux missions',
    wrongStatus: 'L’échec ne peut être déclaré qu’en cours de livraison.',
  },
  ar: {
    title: 'فشل التسليم',
    intro: 'حدد سبباً معتمداً. ستتحول الشحنة إلى إرجاع.',
    reasonLabel: 'السبب', notesLabel: 'ملاحظات إضافية (اختياري)',
    notesPlaceholder: 'وضّح السياق (مثال: مكالمتان دون رد الساعة 13:05 و13:20)',
    submit: 'تحويل إلى إرجاع',
    confirmTitle: 'تأكيد الفشل؟',
    confirmBody: (reason: string) => `السبب: « ${reason} ». ستُعاد الشحنة إلى التاجر.`,
    cancel: 'إلغاء', confirm: 'تأكيد الإرجاع',
    notFoundTitle: 'الشحنة غير موجودة', notFoundBody: 'ربما تمت معالجتها بالفعل.',
    backToMissions: 'العودة إلى المهام',
    wrongStatus: 'لا يمكن الإبلاغ عن الفشل إلا أثناء التسليم.',
  },
} as const;

export default function Fail() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const refStr = String(ref);
  const { colors } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = T[lang === 'ar' ? 'ar' : 'fr'];

  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [reasonIdx, setReasonIdx] = React.useState(0);
  const [notes, setNotes] = React.useState('');
  const { pending, sync } = useOutbox();

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

  async function submit() {
    if (!order) return;
    setBusy(true);
    try {
      // Le motif transmis reste en français (langue de référence de l'API/back-office),
      // avec les notes complémentaires ajoutées si saisies.
      const reason = notes.trim() ? `${REASONS[reasonIdx]!.fr} — ${notes.trim()}` : REASONS[reasonIdx]!.fr;
      await enqueue({ kind: 'fail', ref: order.ref, reason, idemKey: idemKey(order.ref, 'fail') });
      await sync();
      router.replace('/(tabs)/missions');
    } finally {
      setBusy(false);
    }
  }

  function confirmFail() {
    if (!order) return;
    if (order.status !== 'LIVRAISON') {
      Alert.alert(t.title, t.wrongStatus);
      return;
    }
    const label = REASONS[reasonIdx]![lang === 'ar' ? 'ar' : 'fr'];
    Alert.alert(t.confirmTitle, t.confirmBody(label), [
      { text: t.cancel, style: 'cancel' },
      { text: t.confirm, onPress: submit },
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

  return (
    <View style={[s.wrap, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHead title={t.title} sub={order.ref} onBack={() => router.back()} rtl={rtl} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={[s.callout, { backgroundColor: colors.border }]}>
          <Text style={[s.calloutTxt, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>{t.intro}</Text>
        </View>

        <Text style={[s.label, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>{t.reasonLabel}</Text>
        <View style={s.reasons}>
          {REASONS.map((r, i) => {
            const selected = i === reasonIdx;
            return (
              <Pressable
                key={r.fr}
                onPress={() => setReasonIdx(i)}
                style={[
                  s.reasonRow,
                  { borderColor: selected ? colors.indigo9 : colors.border, flexDirection: rtl ? 'row-reverse' : 'row' },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View style={[s.radio, { borderColor: selected ? colors.indigo9 : colors.muted, backgroundColor: selected ? colors.indigo9 : 'transparent' }]} />
                <Text style={[s.reasonTxt, { color: colors.text }]}>{lang === 'ar' ? r.ar : r.fr}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[s.label, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>{t.notesLabel}</Text>
        <TextInput
          style={[s.notes, { borderColor: colors.border, color: colors.text, textAlign: rtl ? 'right' : 'left' }]}
          placeholder={t.notesPlaceholder}
          placeholderTextColor={colors.muted}
          value={notes}
          onChangeText={setNotes}
          multiline
          textAlignVertical="top"
          testID="echec-notes" accessibilityLabel={t.notesLabel}
        />
      </ScrollView>
      <BottomAction>
        <PrimaryBtn loading={busy} onPress={confirmFail}>{t.submit}</PrimaryBtn>
      </BottomAction>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  notFoundTitle: { fontSize: 18, fontWeight: '700' },
  notFoundBody: { fontSize: 14, marginBottom: 8, textAlign: 'center' },
  content: { padding: space[4], paddingBottom: 120, gap: space[3] },
  callout: { borderRadius: radius[3], padding: space[3] },
  calloutTxt: { fontSize: 13, lineHeight: 19 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 6 },
  reasons: { gap: 8 },
  reasonRow: { alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: radius[3], paddingHorizontal: 12, minHeight: touch.min },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  reasonTxt: { fontSize: 14, flexShrink: 1 },
  notes: { minHeight: 90, borderWidth: 1, borderRadius: radius[3], padding: 12, fontSize: 14 },
});
