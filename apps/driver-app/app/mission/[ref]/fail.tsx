// Échec de livraison en deux touchers (maquette validée, acte 5) : de gros motifs au lieu
// d'un champ texte, puis une confirmation. Endpoint : `driverFail(ref, reason, idemKey)`,
// déclarable uniquement en statut LIVRAISON, via la file hors ligne (`kind: 'fail'`) ;
// le serveur passe la commande en ECHOUEE et ouvre un retour que l'agence traite.
import * as React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Order } from '@transpo/domain';
import { authedClient, idemKey } from '../../../lib/api';
import { readJson, writeJson } from '../../../lib/storage';
import { enqueue, applyPending } from '../../../lib/outbox';
import { useOutbox } from '../../../lib/useOutbox';
import { CACHE_MISSIONS } from '../../../lib/useJournee';
import { useTheme } from '../../../lib/theme';
import { useLanguage } from '../../../lib/i18n';
import { Bouton, Carte, Bandeau, Pastille, useTon } from '../../../components/ui';
import { IcRetour, IcCheck } from '../../../components/icones';

// Le motif part en français (langue de référence du back-office), quelle que soit la langue de l'app.
const MOTIFS: ReadonlyArray<{ ic: string; fr: string; ar: string; aideFr?: string; aideAr?: string }> = [
  { ic: '📵', fr: 'Client injoignable', ar: 'الزبون لا يجيب', aideFr: 'Appels sans réponse', aideAr: 'مكالمات بدون رد' },
  { ic: '🏠', fr: 'Destinataire absent', ar: 'المستلم غائب' },
  { ic: '🧭', fr: 'Adresse introuvable', ar: 'العنوان غير موجود' },
  { ic: '✋', fr: 'Refus du colis', ar: 'رفض الطرد' },
  { ic: '💵', fr: 'Le client n’a pas l’argent', ar: 'الزبون لا يملك المبلغ' },
  { ic: '📦', fr: 'Colis endommagé', ar: 'الطرد تالف' },
  { ic: '✏️', fr: 'Autre motif', ar: 'سبب آخر' },
];

const T = {
  fr: {
    titre: 'Un problème ?', confirmer: 'Confirmer l’échec', choisir: 'Choisissez un motif',
    precision: 'Précision (facultatif)', placeholder: 'Ex. : 2 appels sans réponse à 13h05 et 13h20',
    suite: 'Le colis passe en retour : l’agence décide de la suite (nouvelle tentative ou retour au marchand).',
    confTitre: 'Confirmer l’échec ?', confCorps: (m: string) => `Motif : « ${m} ».`, annuler: 'Annuler', ok: 'Confirmer',
    introuvable: 'Commande introuvable', retour: 'Retour à ma journée',
    mauvaisStatut: 'L’échec ne peut être déclaré qu’en cours de livraison.',
  },
  ar: {
    titre: 'هل هناك مشكلة؟', confirmer: 'تأكيد الفشل', choisir: 'اختر سبباً',
    precision: 'توضيح (اختياري)', placeholder: 'مثال: مكالمتان دون رد الساعة 13:05 و13:20',
    suite: 'يتحول الطرد إلى إرجاع: الوكالة تقرر الخطوة التالية (محاولة جديدة أو إرجاع للتاجر).',
    confTitre: 'تأكيد الفشل؟', confCorps: (m: string) => `السبب: « ${m} ».`, annuler: 'إلغاء', ok: 'تأكيد',
    introuvable: 'الشحنة غير موجودة', retour: 'العودة إلى يومي',
    mauvaisStatut: 'لا يمكن الإبلاغ عن الفشل إلا أثناء التسليم.',
  },
};

export default function Echec() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const refStr = String(ref);
  const { colors } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = T[lang];
  const insets = useSafeAreaInsets();
  const indigo = useTon('indigo');
  const row = { flexDirection: rtl ? 'row-reverse' as const : 'row' as const };
  const align = { textAlign: rtl ? 'right' as const : 'left' as const };

  const [missions, setMissions] = React.useState<Order[]>([]);
  const [chargement, setChargement] = React.useState(true);
  const [occupe, setOccupe] = React.useState(false);
  const [motif, setMotif] = React.useState<number | null>(null);
  const [notes, setNotes] = React.useState('');
  const { pending, sync } = useOutbox();

  React.useEffect(() => {
    (async () => {
      try {
        const frais = await authedClient().getMissions();
        setMissions(frais);
        await writeJson(CACHE_MISSIONS, frais);
      } catch {
        setMissions(await readJson<Order[]>(CACHE_MISSIONS, []));
      } finally {
        setChargement(false);
      }
    })();
  }, []);

  const o = applyPending(missions, pending).find((x) => x.ref === refStr) ?? null;

  async function envoyer() {
    if (!o || motif === null) return;
    setOccupe(true);
    try {
      const m = MOTIFS[motif]!.fr;
      const reason = notes.trim() ? `${m} — ${notes.trim()}` : m;
      await enqueue({ kind: 'fail', ref: o.ref, reason, idemKey: idemKey(o.ref, 'fail') });
      await sync();
      router.replace('/(tabs)/journee');
    } finally {
      setOccupe(false);
    }
  }

  function confirmer() {
    if (!o || motif === null) return;
    if (o.status !== 'LIVRAISON') { Alert.alert(t.titre, t.mauvaisStatut); return; }
    Alert.alert(t.confTitre, t.confCorps(MOTIFS[motif]![lang]), [
      { text: t.annuler, style: 'cancel' },
      { text: t.ok, style: 'destructive', onPress: () => void envoyer() },
    ]);
  }

  if (chargement) {
    return <View style={[s.centre, { backgroundColor: colors.bg }]}><ActivityIndicator color={colors.indigo9} size="large" /></View>;
  }
  if (!o) {
    return (
      <View style={[s.centre, { backgroundColor: colors.bg, padding: 24, gap: 12 }]}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{t.introuvable}</Text>
        <Bouton onPress={() => router.replace('/(tabs)/journee')} style={{ alignSelf: 'stretch' }}>{t.retour}</Bouton>
      </View>
    );
  }

  return (
    <View style={[s.plein, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[row, s.entete, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} style={s.retour} accessibilityRole="button" accessibilityLabel="Retour">
          <View style={{ transform: [{ scaleX: rtl ? -1 : 1 }] }}><IcRetour size={24} color={colors.text} /></View>
        </Pressable>
        <Text style={[s.titre, { color: colors.text, flex: 1 }, align]}>{t.titre}</Text>
        <Pastille ton="gris">{o.dropContact ?? o.ref}</Pastille>
      </View>
      <ScrollView contentContainerStyle={s.contenu} keyboardShouldPersistTaps="handled">
        {MOTIFS.map((m, i) => {
          const on = motif === i;
          return (
            <Carte key={m.fr} testID={`motif-${i}`} onPress={() => setMotif(i)}
              style={[s.motif, row, on && { borderColor: colors.indigo9, borderWidth: 2, backgroundColor: indigo.doux }]}>
              <Text style={s.emoji}>{m.ic}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[{ color: colors.text, fontSize: 17, fontWeight: '700' }, align]}>{m[lang]}</Text>
                {(lang === 'ar' ? m.aideAr : m.aideFr) ? <Text style={[{ color: colors.muted, fontSize: 13 }, align]}>{lang === 'ar' ? m.aideAr : m.aideFr}</Text> : null}
              </View>
              {on ? <IcCheck size={22} color={colors.indigo9} /> : null}
            </Carte>
          );
        })}
        {motif !== null ? (
          <TextInput
            value={notes} onChangeText={setNotes} placeholder={t.placeholder} placeholderTextColor={colors.muted} multiline
            accessibilityLabel={t.precision}
            style={[s.notes, { borderColor: colors.border, backgroundColor: colors.panel, color: colors.text }, align]}
          />
        ) : null}
        <Bandeau ton="ambre" rtl={rtl}>{t.suite}</Bandeau>
      </ScrollView>
      <View style={[s.bas, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Bouton testID="confirmer-echec" loading={occupe} disabled={motif === null} onPress={confirmer}>
          {motif === null ? t.choisir : t.confirmer}
        </Bouton>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  plein: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  entete: { alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingBottom: 8 },
  retour: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  titre: { fontSize: 22, fontWeight: '800' },
  contenu: { padding: 16, gap: 10, paddingBottom: 24 },
  motif: { alignItems: 'center', gap: 12, paddingVertical: 14 },
  emoji: { fontSize: 24 },
  notes: { minHeight: 70, borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 15 },
  bas: { paddingHorizontal: 16, paddingTop: 8 },
});
