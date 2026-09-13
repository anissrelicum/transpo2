// Signalement d'incident — redesign visuel uniquement (cf. maquette, fonction
// Incident). Logique métier inchangée : `reportIncident()`, `getMyIncidents()`,
// `INCIDENT_TYPES` réel (5 valeurs, sans gravité/SOS — cf.
// design/PLAN-REFONTE-MOBILE.md §1 : la maquette en montre 6 + gravité, elle a
// divergé du domaine, qui fait foi).
import * as React from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { INCIDENT_TYPES, type IncidentType } from '@transpo/domain';
import type { Incident } from '@transpo/api-client';
import { space, touch, radius } from '@transpo/design-tokens';
import { authedClient } from '../lib/api';
import { useTheme, resolveColor } from '../lib/theme';
import { useLanguage } from '../lib/i18n';
import { ScreenHead, PrimaryBtn, BottomAction } from '../components/shell';

const LABEL: Record<IncidentType, { fr: string; ar: string }> = {
  ADRESSE: { fr: 'Adresse introuvable', ar: 'العنوان غير موجود' },
  CLIENT_INJOIGNABLE: { fr: 'Client injoignable', ar: 'يتعذر الاتصال بالعميل' },
  COLIS_ENDOMMAGE: { fr: 'Colis endommagé', ar: 'الطرد تالف' },
  VEHICULE: { fr: 'Problème de véhicule', ar: 'عطل بالمركبة' },
  AUTRE: { fr: 'Autre', ar: 'أخرى' },
};
const STATUS_LABEL: Record<string, { fr: string; ar: string; color: string }> = {
  OUVERT: { fr: 'Ouvert', ar: 'مفتوح', color: 'amber' },
  TRAITE: { fr: 'Traité', ar: 'تمت المعالجة', color: 'green' },
};

const STR = {
  fr: {
    title: 'Signaler un incident',
    sub: 'Transmis au dispatch',
    typeLabel: 'Type d’incident',
    refLabel: 'Commande concernée (facultatif)',
    refPlaceholder: 'CMD-…',
    noteLabel: 'Précisions (facultatif)',
    notePlaceholder: 'Décrivez ce que vous avez constaté…',
    submit: 'Envoyer le signalement',
    sentTitle: 'Signalement envoyé',
    sentRef: (id: string) => `Référence ${id}`,
    historyTitle: 'Mes signalements',
    empty: 'Aucun signalement.',
    failTitle: 'Envoi impossible',
    failMsg: 'Vérifiez votre connexion et réessayez.',
  },
  ar: {
    title: 'الإبلاغ عن حادث',
    sub: 'يُرسل إلى قسم التوزيع',
    typeLabel: 'نوع الحادث',
    refLabel: 'الطلب المعني (اختياري)',
    refPlaceholder: 'CMD-…',
    noteLabel: 'تفاصيل (اختياري)',
    notePlaceholder: 'صف ما لاحظته…',
    submit: 'إرسال البلاغ',
    sentTitle: 'تم إرسال البلاغ',
    sentRef: (id: string) => `المرجع ${id}`,
    historyTitle: 'بلاغاتي',
    empty: 'لا يوجد أي بلاغ.',
    failTitle: 'تعذر الإرسال',
    failMsg: 'تحقق من الاتصال وأعد المحاولة.',
  },
} as const;

export default function IncidentsScreen() {
  const { colors, mode } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = STR[lang === 'ar' ? 'ar' : 'fr'];

  const [items, setItems] = React.useState<Incident[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [type, setType] = React.useState<IncidentType>('CLIENT_INJOIGNABLE');
  const [ref, setRef] = React.useState('');
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [lastSent, setLastSent] = React.useState<Incident | null>(null);

  const load = React.useCallback(async () => {
    try { setItems(await authedClient().getMyIncidents()); } catch { /* réseau */ } finally { setLoading(false); }
  }, []);
  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  async function submit() {
    setBusy(true);
    try {
      const created = await authedClient().reportIncident({ type, ref: ref.trim() || undefined, note: note.trim() || undefined });
      setRef(''); setNote(''); setLastSent(created);
      await load();
    } catch (e: any) {
      // Pas de file d'attente ici : l'API ne déduplique pas les incidents, un
      // rejeu automatique en créerait plusieurs. Le livreur retente lui-même.
      Alert.alert(t.failTitle, e?.message ?? t.failMsg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[s.wrap, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHead title={t.title} sub={t.sub} onBack={() => router.back()} rtl={rtl} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {lastSent && (
          <View style={[s.sentBanner, { backgroundColor: resolveColor('green', 3, mode) }]}>
            <Text style={{ color: resolveColor('green', 11, mode), fontWeight: '700' }}>{t.sentTitle}</Text>
            <Text style={{ color: resolveColor('green', 11, mode), fontSize: 12 }}>{t.sentRef(lastSent.id)}</Text>
          </View>
        )}

        <Text style={[s.label, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>{t.typeLabel}</Text>
        <View style={[s.grid, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          {INCIDENT_TYPES.map((id) => {
            const on = type === id;
            return (
              <Pressable
                key={id}
                onPress={() => setType(id)}
                style={[
                  s.typeCard,
                  { borderColor: on ? colors.indigo9 : colors.border, backgroundColor: on ? resolveColor('indigo', 3, mode) : colors.panel },
                ]}
              >
                <Text style={{ color: on ? colors.indigo11 : colors.text, fontSize: 13, fontWeight: on ? '700' : '500', textAlign: rtl ? 'right' : 'left' }}>
                  {LABEL[id][lang === 'ar' ? 'ar' : 'fr']}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[s.label, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>{t.refLabel}</Text>
        <TextInput
          style={[s.input, { borderColor: colors.border, color: colors.text, textAlign: rtl ? 'right' : 'left' }]}
          value={ref}
          onChangeText={setRef}
          placeholder={t.refPlaceholder}
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
        />

        <Text style={[s.label, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>{t.noteLabel}</Text>
        <TextInput
          style={[s.input, s.multiline, { borderColor: colors.border, color: colors.text, textAlign: rtl ? 'right' : 'left' }]}
          value={note}
          onChangeText={setNote}
          placeholder={t.notePlaceholder}
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={3}
        />

        <Text style={[s.historyTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>{t.historyTitle}</Text>
        {loading && <ActivityIndicator color={colors.indigo9} style={{ marginTop: space[3] }} />}
        {!loading && items.length === 0 && <Text style={{ color: colors.muted, marginTop: space[2] }}>{t.empty}</Text>}
        {items.map((i) => {
          const st = STATUS_LABEL[i.status];
          return (
            <View key={i.id} style={[s.card, { borderColor: colors.border, backgroundColor: colors.panel }]}>
              <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center' }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', flex: 1 }}>
                  {LABEL[i.type as IncidentType]?.[lang === 'ar' ? 'ar' : 'fr'] ?? i.type}
                </Text>
                {st && (
                  <View style={[s.pill, { backgroundColor: resolveColor(st.color, 3, mode) }]}>
                    <Text style={{ color: resolveColor(st.color, 11, mode), fontSize: 11, fontWeight: '700' }}>{st[lang === 'ar' ? 'ar' : 'fr']}</Text>
                  </View>
                )}
              </View>
              {i.ref && <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{i.ref}</Text>}
              {i.note && <Text style={{ color: colors.text, fontSize: 13, marginTop: 6 }}>{i.note}</Text>}
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 8 }}>
                {new Date(i.createdAt).toLocaleString(lang === 'ar' ? 'ar-MA' : 'fr-FR')}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      <BottomAction>
        <PrimaryBtn onPress={submit} disabled={busy} loading={busy}>{t.submit}</PrimaryBtn>
      </BottomAction>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  content: { padding: space[4], paddingBottom: space[9] + touch.primary, gap: space[1] },
  sentBanner: { borderRadius: radius[3], padding: space[3], marginBottom: space[3] },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: space[3], marginBottom: space[2] },
  grid: { flexWrap: 'wrap', gap: space[2] },
  typeCard: { flexBasis: '48%', flexGrow: 1, borderWidth: 1, borderRadius: radius[3], padding: space[3], minHeight: touch.min, justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: radius[3], paddingHorizontal: space[3], paddingVertical: 10, fontSize: 15, minHeight: touch.min },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  historyTitle: { fontSize: 16, fontWeight: '700', marginTop: space[5] },
  card: { borderWidth: 1, borderRadius: radius[4], padding: space[3], marginTop: space[2] },
  pill: { borderRadius: radius.full, paddingHorizontal: space[2], paddingVertical: 3 },
});
