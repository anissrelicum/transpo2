// Paramètres — uniquement des réglages qui agissent vraiment :
//  - langue (FR / AR, mise en page inversée en arabe) ;
//  - thème (système / clair / sombre), appliqué à toute l'app (`lib/preferences`) ;
//  - notifications : l'état réel de la permission du téléphone, avec le moyen de l'activer ;
//  - vibration à l'arrivée d'une mission proposée (lue par `PropositionMission`) ;
//  - partage de position : lecture seule, il suit Démarrer / Terminer ma journée.
import * as React from 'react';
import { View, Text, ScrollView, Pressable, Switch, Alert, Linking, StyleSheet } from 'react-native';
import { router, useFocusEffect, Stack } from 'expo-router';
import Constants from 'expo-constants';
import { space } from '@transpo/design-tokens';
import { ScreenHead } from '../components/shell';
import { useTheme, resolveColor } from '../lib/theme';
import { useLanguage, type Lang } from '../lib/i18n';
import { readJson } from '../lib/storage';
import { lirePreferences, ecrirePreferences, type Preferences, type Theme } from '../lib/preferences';
import { permissionDejaAccordee, demanderLaPermission } from '../lib/push';

const TRACK_KEY = 'transpo.tracking.enabled'; // écrite par lib/service (journée démarrée / terminée)

const STR = {
  fr: {
    title: 'Paramètres',
    affichage: 'Affichage', language: 'Langue', theme: 'Thème',
    themes: { systeme: 'Auto', clair: 'Clair', sombre: 'Sombre' } as Record<Theme, string>,
    themeHint: 'Auto suit le réglage du téléphone.',
    restartTitle: 'Redémarrage requis',
    restartBody: "La mise en page ne s'inversera complètement qu'après un redémarrage. Fermez et rouvrez Portrail Livreur.",
    ok: 'Compris',
    notifications: 'Notifications',
    notif: 'Notifications du téléphone', notifHint: 'Nouvelles missions, annulations, messages de l’agence',
    notifOn: 'Activées', notifOff: 'Désactivées',
    notifBloqueesTitre: 'Notifications désactivées',
    notifBloqueesCorps: 'Activez-les dans les réglages du téléphone pour être prévenu des nouvelles missions.',
    ouvrirReglages: 'Ouvrir les réglages', annuler: 'Annuler',
    vibration: 'Vibrer à chaque mission proposée',
    position: 'Position',
    tracking: 'Partage de position', trackingHint: 'Actif seulement pendant votre journée (Démarrer / Terminer ma journée)',
    trackingOn: 'Actif', trackingOff: 'Inactif',
    about: 'À propos', version: 'Version',
    privacy: 'Confidentialité (loi 09-08)', privacyTitle: 'Confidentialité',
    privacyBody: "Vos données (position pendant la journée, preuves de livraison, historique de courses) sont traitées conformément à la loi 09-08 sur la protection des données à caractère personnel. Contactez votre agence pour exercer vos droits d'accès ou de rectification.",
  },
  ar: {
    title: 'الإعدادات',
    affichage: 'العرض', language: 'اللغة', theme: 'المظهر',
    themes: { systeme: 'تلقائي', clair: 'فاتح', sombre: 'داكن' } as Record<Theme, string>,
    themeHint: 'التلقائي يتبع إعداد الهاتف.',
    restartTitle: 'إعادة التشغيل مطلوبة',
    restartBody: 'لن ينعكس التخطيط بالكامل إلا بعد إعادة التشغيل. أغلق تطبيق Portrail Livreur وأعد فتحه.',
    ok: 'حسنًا',
    notifications: 'الإشعارات',
    notif: 'إشعارات الهاتف', notifHint: 'المهام الجديدة، الإلغاءات، رسائل الوكالة',
    notifOn: 'مفعّلة', notifOff: 'معطّلة',
    notifBloqueesTitre: 'الإشعارات معطّلة',
    notifBloqueesCorps: 'فعّلها من إعدادات الهاتف لتصلك المهام الجديدة.',
    ouvrirReglages: 'فتح الإعدادات', annuler: 'إلغاء',
    vibration: 'الاهتزاز عند كل مهمة مقترحة',
    position: 'الموقع',
    tracking: 'مشاركة الموقع', trackingHint: 'مفعّلة فقط خلال يومك (ابدأ / أنهِ يومي)',
    trackingOn: 'مفعّل', trackingOff: 'غير مفعّل',
    about: 'حول', version: 'الإصدار',
    privacy: 'الخصوصية (القانون 09-08)', privacyTitle: 'الخصوصية',
    privacyBody: 'تُعالَج بياناتك (الموقع خلال اليوم، إثباتات التسليم، سجل التوصيلات) وفقًا للقانون 09-08 المتعلق بحماية المعطيات ذات الطابع الشخصي. تواصل مع وكالتك لممارسة حقوقك في الاطلاع أو التصحيح.',
  },
} as const;

type Couleurs = { text: string; muted: string; border: string };

function SectionLabel({ children, color, rtl }: { children: string; color: string; rtl: boolean }) {
  return <Text style={[st.sectionLabel, { color, textAlign: rtl ? 'right' : 'left' }]}>{children}</Text>;
}

function Row({ label, hint, control, onPress, rtl, colors, dernier }: {
  label: string; hint?: string; control: React.ReactNode; onPress?: () => void; rtl: boolean; colors: Couleurs; dernier?: boolean;
}) {
  const align: 'right' | 'left' = rtl ? 'right' : 'left';
  const style = [st.row, { flexDirection: rtl ? 'row-reverse' as const : 'row' as const, borderBottomColor: dernier ? 'transparent' : colors.border }];
  const contenu = (
    <>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[st.rowLabel, { color: colors.text, textAlign: align }]}>{label}</Text>
        {hint ? <Text style={[st.rowHint, { color: colors.muted, textAlign: align }]}>{hint}</Text> : null}
      </View>
      {control}
    </>
  );
  return onPress
    ? <Pressable style={style} onPress={onPress} accessibilityRole="button">{contenu}</Pressable>
    : <View style={style}>{contenu}</View>;
}

/** Choix exclusif en pastilles (langue, thème). */
function Segments<T extends string>({ options, valeur, onChoisir, libelle, rtl, colors }: {
  options: T[]; valeur: T; onChoisir: (v: T) => void; libelle: (v: T) => string; rtl: boolean; colors: { border: string; text: string; indigo9: string };
}) {
  return (
    <View style={[s.segment, { flexDirection: rtl ? 'row-reverse' : 'row', borderColor: colors.border }]}>
      {options.map((o) => (
        <Pressable key={o} onPress={() => onChoisir(o)} accessibilityRole="button" accessibilityState={{ selected: valeur === o }}
          style={[s.segmentBtn, { backgroundColor: valeur === o ? colors.indigo9 : 'transparent' }]}>
          <Text style={{ color: valeur === o ? resolveColor('slate', 1, 'light') : colors.text, fontWeight: '700', fontSize: 13 }}>{libelle(o)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function SettingsScreen() {
  const { colors, mode } = useTheme();
  const { lang, rtl, setLanguage } = useLanguage();
  const t = STR[lang as Lang] ?? STR.fr;

  const [prefs, setPrefs] = React.useState<Preferences>({ theme: 'systeme', vibration: true });
  const [notif, setNotif] = React.useState<boolean | null>(null);
  const [tracking, setTracking] = React.useState(false);

  React.useEffect(() => { void lirePreferences().then(setPrefs); }, []);
  // Relus à chaque retour sur l'écran : l'utilisateur a pu changer la permission dans les réglages du téléphone.
  useFocusEffect(React.useCallback(() => {
    void readJson<boolean>(TRACK_KEY, false).then(setTracking);
    void permissionDejaAccordee().then(setNotif);
  }, []));

  async function majPrefs(p: Preferences) { setPrefs(p); await ecrirePreferences(p); }

  async function changerLangue(next: Lang) {
    if (next === lang) return;
    const { restartRequired } = await setLanguage(next);
    if (restartRequired) Alert.alert(t.restartTitle, t.restartBody, [{ text: t.ok }]);
  }

  async function activerNotifications() {
    if (notif) { void Linking.openSettings(); return; }
    const ok = await demanderLaPermission();
    setNotif(ok);
    if (!ok) {
      Alert.alert(t.notifBloqueesTitre, t.notifBloqueesCorps, [
        { text: t.annuler, style: 'cancel' },
        { text: t.ouvrirReglages, onPress: () => void Linking.openSettings() },
      ]);
    }
  }

  const version = (Constants.expoConfig as { version?: string } | null)?.version ?? '—';
  const carte = [s.card, { backgroundColor: colors.panel, borderColor: colors.border }];
  const badge = (on: boolean, oui: string, non: string) => (
    <View style={[s.badge, { backgroundColor: resolveColor(on ? 'green' : 'slate', 3, mode) }]}>
      <Text style={[s.badgeTxt, { color: resolveColor(on ? 'green' : 'slate', 11, mode) }]}>{on ? oui : non}</Text>
    </View>
  );

  return (
    <View style={[s.wrap, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHead title={t.title} onBack={() => router.back()} rtl={rtl} />
      <ScrollView contentContainerStyle={s.content}>
        <View>
          <SectionLabel color={colors.muted} rtl={rtl}>{t.affichage}</SectionLabel>
          <View style={carte}>
            <Row rtl={rtl} colors={colors} label={t.language}
              control={<Segments options={['fr', 'ar'] as Lang[]} valeur={lang as Lang} onChoisir={(l) => void changerLangue(l)}
                libelle={(l) => (l === 'fr' ? 'Français' : 'العربية')} rtl={rtl} colors={colors} />} />
            <Row rtl={rtl} colors={colors} label={t.theme} hint={t.themeHint} dernier
              control={<Segments options={['systeme', 'clair', 'sombre'] as Theme[]} valeur={prefs.theme}
                onChoisir={(th) => void majPrefs({ ...prefs, theme: th })} libelle={(th) => t.themes[th]} rtl={rtl} colors={colors} />} />
          </View>
        </View>

        <View>
          <SectionLabel color={colors.muted} rtl={rtl}>{t.notifications}</SectionLabel>
          <View style={carte}>
            <Row rtl={rtl} colors={colors} label={t.notif} hint={t.notifHint} onPress={() => void activerNotifications()}
              control={notif === null ? null : badge(notif, t.notifOn, t.notifOff)} />
            <Row rtl={rtl} colors={colors} label={t.vibration} dernier
              control={<Switch testID="pref-vibration" value={prefs.vibration} onValueChange={(v) => void majPrefs({ ...prefs, vibration: v })}
                trackColor={{ true: colors.indigo9 }} />} />
          </View>
        </View>

        <View>
          <SectionLabel color={colors.muted} rtl={rtl}>{t.position}</SectionLabel>
          <View style={carte}>
            <Row rtl={rtl} colors={colors} label={t.tracking} hint={t.trackingHint} dernier control={badge(tracking, t.trackingOn, t.trackingOff)} />
          </View>
        </View>

        <View>
          <SectionLabel color={colors.muted} rtl={rtl}>{t.about}</SectionLabel>
          <View style={carte}>
            <Row rtl={rtl} colors={colors} label={t.version} control={<Text style={{ color: colors.muted, fontSize: 13 }}>{version}</Text>} />
            <Row rtl={rtl} colors={colors} label={t.privacy} dernier onPress={() => Alert.alert(t.privacyTitle, t.privacyBody, [{ text: t.ok }])}
              control={<Text style={{ color: colors.muted, fontSize: 16 }}>{rtl ? '‹' : '›'}</Text>} />
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
  segment: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  segmentBtn: { paddingHorizontal: 12, minWidth: 48, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeTxt: { fontSize: 12, fontWeight: '700' },
});

const st = StyleSheet.create({
  sectionLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  row: { alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, minHeight: 56 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowHint: { fontSize: 12, marginTop: 2 },
});
