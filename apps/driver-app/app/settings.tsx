// Paramètres — notifications/langue persistées localement (`lib/storage.ts`).
// Le thème suit le système : PAS de bascule clair/sombre ici (le socle n'expose
// aucun setter, seulement `useTheme()` en lecture — un bouton sans effet serait
// pire que son absence). Le partage de position est piloté par `shift.tsx`
// (lot C) : ici, un badge lecture seule uniquement (cf. consigne du tech lead).
import * as React from 'react';
import { View, Text, ScrollView, Pressable, Switch, Alert, StyleSheet } from 'react-native';
import { router, useFocusEffect, Stack } from 'expo-router';
import Constants from 'expo-constants';
import { space } from '@transpo/design-tokens';
import { ScreenHead } from '../components/shell';
import { useTheme, resolveColor } from '../lib/theme';
import { useLanguage, type Lang } from '../lib/i18n';
import { readJson, writeJson } from '../lib/storage';

const TRACK_KEY = 'transpo.tracking.enabled'; // écrite par missions.tsx/shift.tsx (lot A/C) — lue ici seulement
const PREFS_KEY = 'transpo.settings.notifications.v1';

type Prefs = { push: boolean; sound: boolean; vibrate: boolean };
const DEFAULT_PREFS: Prefs = { push: true, sound: true, vibrate: true };

const STR = {
  fr: {
    title: 'Paramètres',
    notifications: 'Notifications',
    push: 'Notifications push', pushHint: 'Missions, annulations, alertes',
    sound: 'Son', vibrate: 'Vibration',
    display: 'Affichage',
    language: 'Langue',
    theme: 'Thème', themeLight: 'Clair', themeDark: 'Sombre',
    restartTitle: 'Redémarrage requis',
    restartBody: "La mise en page de l'app ne s'inversera complètement qu'après un redémarrage. Fermez et rouvrez Transpo Livreur pour appliquer le changement.",
    ok: 'Compris',
    missions: 'Missions',
    autoAccept: 'Acceptation automatique', autoAcceptHint: 'Bientôt disponible',
    tracking: 'Partage de position', trackingHint: 'Piloté par le shift en cours',
    trackingOn: 'Actif', trackingOff: 'Inactif',
    about: 'À propos',
    version: 'Version',
    privacy: 'Confidentialité (Loi 09-08)',
    privacyTitle: 'Confidentialité',
    privacyBody: "Vos données (position pendant le shift, preuves de livraison, historique de courses) sont traitées conformément à la loi marocaine 09-08 sur la protection des données à caractère personnel. Contactez votre transporteur pour exercer vos droits d'accès ou de rectification.",
  },
  ar: {
    title: 'الإعدادات',
    notifications: 'الإشعارات',
    push: 'إشعارات فورية', pushHint: 'المهام، الإلغاءات، التنبيهات',
    sound: 'الصوت', vibrate: 'الاهتزاز',
    display: 'العرض',
    language: 'اللغة',
    theme: 'المظهر', themeLight: 'فاتح', themeDark: 'داكن',
    restartTitle: 'إعادة التشغيل مطلوبة',
    restartBody: 'لن ينعكس تخطيط التطبيق بالكامل إلا بعد إعادة التشغيل. أغلق تطبيق Transpo Livreur وأعد فتحه لتطبيق التغيير.',
    ok: 'حسنًا',
    missions: 'المهام',
    autoAccept: 'القبول التلقائي', autoAcceptHint: 'قريبًا',
    tracking: 'مشاركة الموقع', trackingHint: 'يتحكم فيه الدوام الجاري',
    trackingOn: 'مفعّل', trackingOff: 'غير مفعّل',
    about: 'حول',
    version: 'الإصدار',
    privacy: 'الخصوصية (القانون 09-08)',
    privacyTitle: 'الخصوصية',
    privacyBody: 'تُعالَج بياناتك (الموقع أثناء الدوام، إثباتات التسليم، سجل التوصيلات) وفقًا للقانون المغربي 09-08 المتعلق بحماية المعطيات ذات الطابع الشخصي. تواصل مع الناقل الخاص بك لممارسة حقوقك في الاطلاع أو التصحيح.',
  },
} as const;

function SectionLabel({ children, color }: { children: string; color: string }) {
  return <Text style={[st.sectionLabel, { color }]}>{children}</Text>;
}

function Row({
  label, hint, control, onPress, rtl, colors,
}: {
  label: string; hint?: string; control: React.ReactNode; onPress?: () => void;
  rtl: boolean; colors: { text: string; muted: string; border: string };
}) {
  const row: 'row' | 'row-reverse' = rtl ? 'row-reverse' : 'row';
  const align: 'right' | 'left' = rtl ? 'right' : 'left';
  const content = (
    <>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[st.rowLabel, { color: colors.text, textAlign: align }]}>{label}</Text>
        {hint ? <Text style={[st.rowHint, { color: colors.muted, textAlign: align }]}>{hint}</Text> : null}
      </View>
      {control}
    </>
  );
  if (onPress) {
    return (
      <Pressable
        style={[st.row, { flexDirection: row, borderBottomColor: colors.border }]}
        onPress={onPress}
        accessibilityRole="button"
      >
        {content}
      </Pressable>
    );
  }
  return <View style={[st.row, { flexDirection: row, borderBottomColor: colors.border }]}>{content}</View>;
}

export default function SettingsScreen() {
  const { colors, mode } = useTheme();
  const { lang, rtl, setLanguage } = useLanguage();
  const t = STR[lang as Lang] ?? STR.fr;
  const row: 'row' | 'row-reverse' = rtl ? 'row-reverse' : 'row';

  const [prefs, setPrefs] = React.useState<Prefs>(DEFAULT_PREFS);
  const [tracking, setTracking] = React.useState(false);

  React.useEffect(() => {
    readJson<Prefs>(PREFS_KEY, DEFAULT_PREFS).then(setPrefs);
  }, []);
  // Le partage de position est piloté ailleurs (shift.tsx) : on relit à chaque
  // focus pour refléter un changement fait sur cet autre écran.
  useFocusEffect(
    React.useCallback(() => {
      readJson<boolean>(TRACK_KEY, false).then(setTracking);
    }, []),
  );

  async function updatePrefs(next: Prefs) {
    setPrefs(next);
    await writeJson(PREFS_KEY, next);
  }

  async function changeLanguage(next: Lang) {
    if (next === lang) return;
    const { restartRequired } = await setLanguage(next);
    if (restartRequired) {
      Alert.alert(t.restartTitle, t.restartBody, [{ text: t.ok }]);
    }
  }

  const version = (Constants.expoConfig as { version?: string } | null)?.version ?? '—';

  return (
    <View style={[s.wrap, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHead title={t.title} onBack={() => router.back()} rtl={rtl} />
      <ScrollView contentContainerStyle={s.content}>
        <View>
          <SectionLabel color={colors.muted}>{t.notifications}</SectionLabel>
          <View style={[s.card, { backgroundColor: colors.panel, borderColor: colors.border }]}>
            <Row
              rtl={rtl} colors={colors} label={t.push} hint={t.pushHint}
              control={<Switch value={prefs.push} onValueChange={(v) => updatePrefs({ ...prefs, push: v })} trackColor={{ true: colors.indigo9 }} />}
            />
            <Row
              rtl={rtl} colors={colors} label={t.sound}
              control={<Switch value={prefs.sound} onValueChange={(v) => updatePrefs({ ...prefs, sound: v })} trackColor={{ true: colors.indigo9 }} />}
            />
            <Row
              rtl={rtl} colors={{ ...colors, border: 'transparent' }} label={t.vibrate}
              control={<Switch value={prefs.vibrate} onValueChange={(v) => updatePrefs({ ...prefs, vibrate: v })} trackColor={{ true: colors.indigo9 }} />}
            />
          </View>
        </View>

        <View>
          <SectionLabel color={colors.muted}>{t.display}</SectionLabel>
          <View style={[s.card, { backgroundColor: colors.panel, borderColor: colors.border }]}>
            <Row
              rtl={rtl} colors={colors} label={t.language}
              control={
                <View style={[s.segment, { flexDirection: row, borderColor: colors.border }]}>
                  {(['fr', 'ar'] as Lang[]).map((l) => (
                    <Pressable
                      key={l}
                      onPress={() => changeLanguage(l)}
                      style={[s.segmentBtn, { backgroundColor: lang === l ? colors.indigo9 : 'transparent' }]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: lang === l }}
                    >
                      {/* Texte clair sur indigo9 plein : slate-1 (blanc cassé des
                          tokens), identique clair/sombre — cf. support.tsx. */}
                      <Text style={{ color: lang === l ? resolveColor('slate', 1, 'light') : colors.text, fontWeight: '700', fontSize: 12 }}>
                        {l.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              }
            />
            <Row
              rtl={rtl} colors={{ ...colors, border: 'transparent' }} label={t.theme}
              control={<Text style={{ color: colors.muted, fontSize: 13 }}>{mode === 'dark' ? t.themeDark : t.themeLight}</Text>}
            />
          </View>
        </View>

        <View>
          <SectionLabel color={colors.muted}>{t.missions}</SectionLabel>
          <View style={[s.card, { backgroundColor: colors.panel, borderColor: colors.border }]}>
            <Row
              rtl={rtl} colors={colors} label={t.autoAccept} hint={t.autoAcceptHint}
              control={<Switch value={false} disabled trackColor={{ true: colors.indigo9 }} />}
            />
            <Row
              rtl={rtl} colors={{ ...colors, border: 'transparent' }} label={t.tracking} hint={t.trackingHint}
              control={
                <View style={[s.badge, { backgroundColor: resolveColor(tracking ? 'green' : 'slate', 3, mode) }]}>
                  <Text style={[s.badgeTxt, { color: resolveColor(tracking ? 'green' : 'slate', 11, mode) }]}>
                    {tracking ? t.trackingOn : t.trackingOff}
                  </Text>
                </View>
              }
            />
          </View>
        </View>

        <View>
          <SectionLabel color={colors.muted}>{t.about}</SectionLabel>
          <View style={[s.card, { backgroundColor: colors.panel, borderColor: colors.border }]}>
            <Row rtl={rtl} colors={colors} label={t.version} control={<Text style={{ color: colors.muted, fontSize: 13 }}>{version}</Text>} />
            <Row
              rtl={rtl} colors={{ ...colors, border: 'transparent' }} label={t.privacy}
              onPress={() => Alert.alert(t.privacyTitle, t.privacyBody, [{ text: t.ok }])}
              control={<Text style={{ color: colors.muted, fontSize: 16 }}>{rtl ? '‹' : '›'}</Text>}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  content: { padding: space[4], gap: space[4], paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 14, overflow: 'hidden', marginTop: 6 },
  segment: { borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  segmentBtn: { paddingHorizontal: 14, paddingVertical: 6, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeTxt: { fontSize: 11, fontWeight: '700' },
});

const st = StyleSheet.create({
  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  row: { alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, minHeight: 44 },
  rowLabel: { fontSize: 14, fontWeight: '600' },
  rowHint: { fontSize: 11, marginTop: 2 },
});
