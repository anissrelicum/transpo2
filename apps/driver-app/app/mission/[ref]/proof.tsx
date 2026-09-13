// Preuve de livraison + encaissement COD — cf. maquette `Proof`/`Cod`.
// RÈGLE NON NÉGOCIABLE (cf. plan §2 Lot B) : un seul appel `driverProof()` qui
// bundle `codCollected` + `photo` + `signature` sous une seule clé d'idempotence.
// La maquette montre deux écrans : on en reprend l'apparence en deux étapes
// internes (`step`), mais l'envoi reste unique, à l'identique de la branche
// `atDelivery` de l'ancien `mission/[ref].tsx`. Ne jamais scinder en deux routes.
import * as React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, TextInput, Alert, Image } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import type { Order } from '@transpo/domain';
import { proofRequirements, missingProof, money } from '@transpo/domain';
import { radius, space, touch } from '@transpo/design-tokens';
import { authedClient, idemKey } from '../../../lib/api';
import { readJson, writeJson } from '../../../lib/storage';
import { enqueue, applyPending } from '../../../lib/outbox';
import { useOutbox } from '../../../lib/useOutbox';
import { capturePhoto, signatureToDataUri, isSignatureMeaningful, type Point } from '../../../lib/proof';
import { SignaturePad } from '../../../components/SignaturePad';
import { useTheme } from '../../../lib/theme';
import { useLanguage } from '../../../lib/i18n';
import { ScreenHead, BottomAction, PrimaryBtn } from '../../../components/shell';

const CACHE_KEY = 'transpo.missions.v1';
const SIGN_W = 320;
const SIGN_H = 180;

const T = {
  fr: {
    proofTitle: 'Preuve de livraison', codTitle: 'Encaissement', codSub: 'Paiement à la livraison',
    photoLabel: 'Photo du colis livré', retake: 'Reprendre la photo', takePhoto: 'Prendre la photo', opening: 'Ouverture…',
    validate: 'Valider la preuve', photoRequired: 'Photo requise', signatureRequired: 'Signature requise',
    toCollect: 'Montant à encaisser', received: 'Montant reçu', change: 'Monnaie à rendre',
    codNote: 'Le montant sera reversé au marchand, déduction faite de la commission.',
    confirmCod: 'Confirmer l’encaissement',
    photoIncompleteTitle: 'Preuve incomplète',
    lowAmountTitle: 'Montant incomplet',
    lowAmountBody: (cod: number, amount: number) =>
      `Le contre-remboursement attendu est de ${money(cod)}. Avec ${money(amount)}, la commande sera livrée mais marquée non encaissée.`,
    fix: 'Corriger', confirm: 'Confirmer',
    confirmCodTitle: 'Encaissement confirmé ?',
    confirmCodBody: (amount: number) => `Vous confirmez avoir reçu ${money(amount)}. La livraison sera clôturée.`,
    yesCollected: 'Oui, encaissé',
    noProofNeeded: 'Aucune preuve n’est requise pour cette commande. Confirmez simplement la remise.',
    notFoundTitle: 'Commande introuvable', notFoundBody: 'Elle a peut-être déjà été traitée.',
    backToMissions: 'Retour aux missions',
    cash: 'Espèces',
  },
  ar: {
    proofTitle: 'إثبات التسليم', codTitle: 'التحصيل', codSub: 'الدفع عند التسليم',
    photoLabel: 'صورة الطرد المسلَّم', retake: 'إعادة التقاط الصورة', takePhoto: 'التقاط الصورة', opening: 'جارٍ الفتح…',
    validate: 'تأكيد الإثبات', photoRequired: 'الصورة مطلوبة', signatureRequired: 'التوقيع مطلوب',
    toCollect: 'المبلغ المطلوب تحصيله', received: 'المبلغ المستلم', change: 'الباقي',
    codNote: 'سيُحوَّل المبلغ إلى التاجر بعد خصم العمولة.',
    confirmCod: 'تأكيد التحصيل',
    photoIncompleteTitle: 'إثبات غير مكتمل',
    lowAmountTitle: 'مبلغ غير مكتمل',
    lowAmountBody: (cod: number, amount: number) =>
      `المبلغ المطلوب عند التسليم هو ${money(cod)}. بمبلغ ${money(amount)}، سيتم تسليم الشحنة لكنها ستُعتبر غير محصَّلة.`,
    fix: 'تصحيح', confirm: 'تأكيد',
    confirmCodTitle: 'تأكيد التحصيل؟',
    confirmCodBody: (amount: number) => `تؤكد استلام ${money(amount)}. سيتم إغلاق التسليم.`,
    yesCollected: 'نعم، تم التحصيل',
    noProofNeeded: 'لا يُطلب أي إثبات لهذه الشحنة. أكّد التسليم فقط.',
    notFoundTitle: 'الشحنة غير موجودة', notFoundBody: 'ربما تمت معالجتها بالفعل.',
    backToMissions: 'العودة إلى المهام',
    cash: 'نقداً',
  },
} as const;

export default function Proof() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const refStr = String(ref);
  const { colors, mode } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = T[lang === 'ar' ? 'ar' : 'fr'];

  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [step, setStep] = React.useState<'proof' | 'cod'>('proof');
  const [cod, setCod] = React.useState('');
  const [touchedCod, setTouchedCod] = React.useState(false);
  const [photo, setPhoto] = React.useState<string | null>(null);
  const [strokes, setStrokes] = React.useState<Point[][]>([]);
  const [shooting, setShooting] = React.useState(false);

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

  React.useEffect(() => {
    if (order && !touchedCod) setCod(order.cod ? String(order.cod) : '');
  }, [order?.ref, order?.cod, touchedCod]);

  const required = order ? proofRequirements(order.proofLevel) : [];
  const signature = isSignatureMeaningful(strokes) ? signatureToDataUri(strokes, SIGN_W, SIGN_H) : null;
  const needPhoto = required.includes('photo');
  const needSig = required.includes('signature');
  const proofComplete = (!needPhoto || !!photo) && (!needSig || !!signature);

  /** Met l'action en file (donc sur disque) puis tente de l'envoyer tout de suite — un seul appel, cf. plan. */
  async function submit() {
    if (!order) return;
    setBusy(true);
    try {
      await enqueue({
        kind: 'proof', ref: order.ref, codCollected: Number(cod) || 0,
        idemKey: idemKey(order.ref, 'proof'),
        photo: photo ?? undefined,
        signature: signature ?? undefined,
      });
      await sync();
      router.replace(
        `/mission/${order.ref}/done?cod=${encodeURIComponent(cod || '0')}&photo=${photo ? '1' : '0'}&signature=${signature ? '1' : '0'}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function shoot() {
    setShooting(true);
    try {
      const res = await capturePhoto();
      if ('uri' in res) setPhoto(res.uri);
      else if (res.error) Alert.alert(t.photoIncompleteTitle, res.error);
    } finally {
      setShooting(false);
    }
  }

  function goToCod() {
    if (!order) return;
    // Même règle que l'API, appliquée avant l'envoi : inutile de mettre en file
    // une preuve qui sera refusée, surtout hors ligne où le refus arriverait tard.
    const gap = missingProof(order.proofLevel, { photo, signature });
    if (gap) { Alert.alert(t.photoIncompleteTitle, gap); return; }
    if (order.cod > 0) setStep('cod');
    else submit();
  }

  function confirmCod() {
    if (!order) return;
    const amount = Number(cod) || 0;
    if (order.cod > 0 && amount < order.cod) {
      // L'API ne marque `codPaid` qu'au montant plein : autant le dire ici.
      Alert.alert(t.lowAmountTitle, t.lowAmountBody(order.cod, amount), [
        { text: t.fix, style: 'cancel' },
        { text: t.confirm, onPress: submit },
      ]);
      return;
    }
    Alert.alert(t.confirmCodTitle, t.confirmCodBody(amount), [
      { text: t.fix, style: 'cancel' },
      { text: t.yesCollected, onPress: submit },
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

  if (step === 'cod') {
    const amount = order.cod;
    const receivedNum = Number(cod) || 0;
    const change = Math.max(0, receivedNum - amount);
    const quick = Array.from(new Set([amount, amount + 20, amount + 50, amount + 100])).filter((v) => v > 0);
    return (
      <View style={[s.wrap, { backgroundColor: colors.bg }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHead title={t.codTitle} sub={t.codSub} onBack={() => setStep('proof')} rtl={rtl} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
          <View style={[s.amountCard, { backgroundColor: colors.border }]}>
            <Text style={[s.amountLabel, { color: colors.text }]}>{t.toCollect}</Text>
            <Text style={[s.amountValue, { color: colors.text }]}>{money(amount)}</Text>
            <View style={[s.badge, { backgroundColor: colors.panel }]}>
              <Text style={[s.badgeTxt, { color: colors.muted }]}>{t.cash}</Text>
            </View>
          </View>

          <Text style={[s.label, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>{t.received}</Text>
          <TextInput
            style={[s.amountInput, { borderColor: colors.border, color: colors.text, textAlign: rtl ? 'right' : 'left' }]}
            value={cod}
            keyboardType="numeric"
            onChangeText={(v) => { setTouchedCod(true); setCod(v.replace(/[^0-9]/g, '')); }}
          />
          <View style={[s.quickRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            {quick.map((v) => (
              <Pressable
                key={v}
                onPress={() => { setTouchedCod(true); setCod(String(v)); }}
                style={[s.quickBtn, { borderColor: colors.border }]}
                accessibilityRole="button"
              >
                <Text style={[s.quickTxt, { color: colors.text }]}>{v}</Text>
              </Pressable>
            ))}
          </View>

          {change > 0 && (
            <View style={[s.changeRow, { backgroundColor: colors.border, flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <Text style={[s.changeLabel, { color: colors.muted }]}>{t.change}</Text>
              <Text style={[s.changeValue, { color: colors.text }]}>{money(change)}</Text>
            </View>
          )}

          <Text style={[s.note, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>{t.codNote}</Text>
        </ScrollView>
        <BottomAction>
          <PrimaryBtn loading={busy} disabled={receivedNum <= 0} onPress={confirmCod}>
            {t.confirmCod}
          </PrimaryBtn>
        </BottomAction>
      </View>
    );
  }

  return (
    <View style={[s.wrap, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHead title={t.proofTitle} sub={order.ref} onBack={() => router.back()} rtl={rtl} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {!needPhoto && !needSig && (
          <View style={[s.callout, { backgroundColor: colors.border }]}>
            <Text style={[s.calloutTxt, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>{t.noProofNeeded}</Text>
          </View>
        )}

        {needPhoto && (
          <View style={s.block}>
            <Text style={[s.label, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>{t.photoLabel}</Text>
            {photo ? (
              <View>
                <Image source={{ uri: photo }} style={[s.preview, { backgroundColor: colors.panel, borderColor: colors.border }]} resizeMode="cover" />
                <Pressable onPress={shoot} disabled={shooting} hitSlop={8} style={[s.retakeBtn, { alignSelf: rtl ? 'flex-end' : 'flex-start' }]}>
                  <Text style={[s.retake, { color: colors.indigo9 }]}>{shooting ? t.opening : t.retake}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={[s.secondary, { borderColor: colors.indigo9, backgroundColor: colors.panel }, shooting && s.disabled]}
                onPress={shoot}
                disabled={shooting}
                accessibilityRole="button"
              >
                {shooting ? <ActivityIndicator color={colors.indigo9} /> : <Text style={[s.secondaryTxt, { color: colors.indigo9 }]}>{t.takePhoto}</Text>}
              </Pressable>
            )}
          </View>
        )}

        {needSig && (
          <View style={s.block}>
            <SignaturePad strokes={strokes} onChange={setStrokes} height={SIGN_H} />
          </View>
        )}
      </ScrollView>
      <BottomAction>
        <PrimaryBtn disabled={!proofComplete} onPress={goToCod}>
          {needPhoto && !photo ? t.photoRequired : needSig && !signature ? t.signatureRequired : t.validate}
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
  content: { padding: space[4], paddingBottom: 120, gap: space[4] },
  block: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600' },
  preview: { width: '100%', height: 200, borderRadius: radius[4], borderWidth: 1 },
  retakeBtn: { marginTop: 8, minHeight: touch.min, justifyContent: 'center' },
  retake: { fontSize: 13, fontWeight: '600' },
  secondary: { minHeight: 64, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius[4], alignItems: 'center', justifyContent: 'center' },
  secondaryTxt: { fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  callout: { borderRadius: radius[3], padding: space[3] },
  calloutTxt: { fontSize: 13, lineHeight: 19 },
  amountCard: { borderRadius: radius[5], padding: space[4], alignItems: 'center', gap: 4 },
  amountLabel: { fontSize: 13 },
  amountValue: { fontSize: 32, fontWeight: '800' },
  badge: { marginTop: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  badgeTxt: { fontSize: 12, fontWeight: '700' },
  amountInput: { height: 54, borderWidth: 1, borderRadius: radius[3], paddingHorizontal: 14, fontSize: 22, fontWeight: '700' },
  quickRow: { gap: 8, marginTop: 8 },
  quickBtn: { flex: 1, minHeight: touch.min, borderWidth: 1, borderRadius: radius[3], alignItems: 'center', justifyContent: 'center' },
  quickTxt: { fontSize: 14, fontWeight: '600' },
  changeRow: { justifyContent: 'space-between', alignItems: 'center', borderRadius: radius[3], padding: space[3] },
  changeLabel: { fontSize: 13 },
  changeValue: { fontSize: 17, fontWeight: '700' },
  note: { fontSize: 12, lineHeight: 17 },
});
