// Mes documents — liste statique, aucun endpoint (cf. plan §5 : « Toujours
// statique »). Le téléversement/téléchargement n'appelle aucun serveur : on
// le dit explicitement (Alert) plutôt que de simuler un succès réseau
// (contrôle A5.2 de la grille de revue).
import * as React from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { router, Stack } from 'expo-router';
import { space } from '@transpo/design-tokens';
import { ScreenHead } from '../components/shell';
import { useTheme, resolveColor } from '../lib/theme';
import { useLanguage, type Lang } from '../lib/i18n';

type DocColor = 'green' | 'amber' | 'gray';
type Doc = { name: { fr: string; ar: string }; meta: { fr: string; ar: string }; badge: { fr: string; ar: string }; color: DocColor };

const DOCS: Doc[] = [
  { name: { fr: 'Permis de conduire', ar: 'رخصة القيادة' }, meta: { fr: 'A, B · exp. 09/2028', ar: 'A, B · صالحة حتى 09/2028' }, badge: { fr: 'Valide', ar: 'سارية' }, color: 'green' },
  { name: { fr: 'Contrat', ar: 'العقد' }, meta: { fr: 'Signé le 02/01/2026', ar: 'موقَّع في 02/01/2026' }, badge: { fr: 'PDF', ar: 'PDF' }, color: 'gray' },
  { name: { fr: 'Carte grise — Moto 7890-B-12', ar: 'البطاقة الرمادية — دراجة 7890-B-12' }, meta: { fr: 'À jour', ar: 'محدَّثة' }, badge: { fr: 'PDF', ar: 'PDF' }, color: 'gray' },
  { name: { fr: "Attestation d'assurance", ar: 'شهادة التأمين' }, meta: { fr: 'Échéance 11/2026', ar: 'تنتهي 11/2026' }, badge: { fr: 'Valide', ar: 'سارية' }, color: 'green' },
  { name: { fr: 'Contrôle technique', ar: 'الفحص التقني' }, meta: { fr: 'Échéance dans 5 j', ar: 'تنتهي خلال 5 أيام' }, badge: { fr: 'Bientôt', ar: 'قريبًا' }, color: 'amber' },
  { name: { fr: 'Attestation de travail', ar: 'شهادة العمل' }, meta: { fr: 'Généré le 01/07/2026', ar: 'أُصدرت في 01/07/2026' }, badge: { fr: 'PDF', ar: 'PDF' }, color: 'gray' },
];

const STR = {
  fr: {
    title: 'Mes documents',
    count: (n: number) => `${n} documents`,
    demo: 'Démo — liste statique, aucun téléversement ni téléchargement réel pour le moment.',
    upload: 'Téléverser un document',
    uploadTitle: 'Fonctionnalité à venir',
    uploadBody: 'Le téléversement de documents n’est pas encore branché à un serveur. Contactez votre dispatch pour transmettre ce document.',
    downloadTitle: 'Fonctionnalité à venir',
    downloadBody: (name: string) => `Le téléchargement de « ${name} » n’est pas encore disponible.`,
    ok: 'Compris',
  },
  ar: {
    title: 'مستنداتي',
    count: (n: number) => `${n} مستندات`,
    demo: 'تجريبي — قائمة ثابتة، لا يوجد حاليًا تحميل أو تنزيل حقيقي.',
    upload: 'تحميل مستند',
    uploadTitle: 'ميزة قادمة',
    uploadBody: 'تحميل المستندات غير مرتبط بعد بخادم. تواصل مع فريق التوزيع لإرسال هذا المستند.',
    downloadTitle: 'ميزة قادمة',
    downloadBody: (name: string) => `تنزيل «${name}» غير متاح بعد.`,
    ok: 'حسنًا',
  },
} as const;

export default function DocsScreen() {
  const { colors, mode } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = STR[lang as Lang] ?? STR.fr;
  const align: 'right' | 'left' = rtl ? 'right' : 'left';
  const row: 'row' | 'row-reverse' = rtl ? 'row-reverse' : 'row';

  return (
    <View style={[s.wrap, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHead title={t.title} sub={t.count(DOCS.length)} onBack={() => router.back()} rtl={rtl} />
      <ScrollView contentContainerStyle={s.content}>
        <View
          style={[s.callout, { backgroundColor: resolveColor('amber', 3, mode), borderColor: resolveColor('amber', 9, mode) }]}
        >
          <Text style={[s.calloutTxt, { color: resolveColor('amber', 11, mode), textAlign: align }]}>{t.demo}</Text>
        </View>

        {DOCS.map((d) => {
          const name = lang === 'ar' ? d.name.ar : d.name.fr;
          return (
            <Pressable
              key={name}
              style={[s.card, { backgroundColor: colors.panel, borderColor: colors.border, flexDirection: row }]}
              onPress={() => Alert.alert(t.downloadTitle, t.downloadBody(name), [{ text: t.ok }])}
              accessibilityRole="button"
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.docName, { color: colors.text, textAlign: align }]} numberOfLines={1}>{name}</Text>
                <Text style={[s.docMeta, { color: colors.muted, textAlign: align }]} numberOfLines={1}>
                  {lang === 'ar' ? d.meta.ar : d.meta.fr}
                </Text>
              </View>
              <View style={[s.badge, { backgroundColor: resolveColor(d.color, 3, mode) }]}>
                <Text style={[s.badgeTxt, { color: resolveColor(d.color, 11, mode) }]}>
                  {lang === 'ar' ? d.badge.ar : d.badge.fr}
                </Text>
              </View>
            </Pressable>
          );
        })}

        <Pressable
          style={[s.uploadBtn, { borderColor: colors.border, backgroundColor: colors.panel }]}
          onPress={() => Alert.alert(t.uploadTitle, t.uploadBody, [{ text: t.ok }])}
          accessibilityRole="button"
        >
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>{t.upload}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  content: { padding: space[4], gap: space[3], paddingBottom: 40 },
  callout: { borderWidth: 1, borderRadius: 12, padding: space[3] },
  calloutTxt: { fontSize: 12, lineHeight: 17 },
  card: { borderWidth: 1, borderRadius: 14, padding: space[3], alignItems: 'center', gap: 10, minHeight: 44 },
  docName: { fontSize: 14, fontWeight: '600' },
  docMeta: { fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeTxt: { fontSize: 11, fontWeight: '700' },
  uploadBtn: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
