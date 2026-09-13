// Profil — hub de navigation du livreur (onglet racine « Profil »).
// Nom/tenant = session réelle (`getSession()`) ; le reste (véhicule, permis,
// zone, horaire, disponibilité) n'a pas d'endpoint dédié côté serveur : données
// de démonstration, signalées par le callout ci-dessous (cf. design/PLAN-REFONTE-MOBILE.md §5).
import * as React from 'react';
import { View, Text, ScrollView, Pressable, Switch, Alert, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { space } from '@transpo/design-tokens';
import { ScreenHead } from '../../components/shell';
import { useTheme, resolveColor } from '../../lib/theme';
import { useLanguage, type Lang } from '../../lib/i18n';
import { getSession, clearSession } from '../../lib/api';
import { clear as clearOutbox } from '../../lib/outbox';
import { useOutbox } from '../../lib/useOutbox';

const STR = {
  fr: {
    title: 'Mon profil',
    sub: 'Livreur · Transpo',
    available: 'Disponible',
    availableOn: 'Vous recevez des missions',
    availableOff: 'Hors ligne — aucune mission',
    demoTitle: 'Informations de démonstration',
    demoBody:
      "La disponibilité, le véhicule, le permis, la zone et l'horaire sont des exemples locaux : aucun endpoint de profil livreur n'existe encore côté serveur.",
    vehicle: 'Véhicule',
    vehicleVal: 'Moto · 7890-B-12',
    license: 'Permis',
    licenseVal: 'A, B · exp. 09/2028',
    licenseBadge: 'Valide',
    zone: 'Zone assignée',
    zoneVal: 'Casablanca — Maârif',
    schedule: 'Horaire du jour',
    scheduleVal: '08:00 – 17:00',
    earnings: 'Historique & gains',
    objectives: 'Objectifs & primes',
    recap: 'Récap du jour',
    support: 'Support dispatch',
    docs: 'Mes documents',
    settings: 'Paramètres',
    help: 'Aide / FAQ',
    incident: 'Signaler un incident',
    logout: 'Se déconnecter',
    logoutGuardTitle: 'Actions non synchronisées',
    logoutGuardBody: (n: number) =>
      `${n} action(s) n’ont pas encore été transmises. Se déconnecter les supprimera définitivement.`,
    cancel: 'Annuler',
  },
  ar: {
    title: 'ملفي الشخصي',
    sub: 'سائق · Transpo',
    available: 'متاح',
    availableOn: 'تستقبل المهام',
    availableOff: 'غير متصل — لا مهام',
    demoTitle: 'معلومات توضيحية',
    demoBody:
      'التوفر والمركبة ورخصة القيادة والمنطقة وتوقيت اليوم أمثلة محلية فقط: لا توجد بعد نقطة وصول خاصة بملف السائق على الخادم.',
    vehicle: 'المركبة',
    vehicleVal: 'دراجة نارية · 7890-B-12',
    license: 'رخصة القيادة',
    licenseVal: 'A, B · صالحة حتى 09/2028',
    licenseBadge: 'سارية',
    zone: 'المنطقة المسندة',
    zoneVal: 'الدار البيضاء — المعاريف',
    schedule: 'توقيت اليوم',
    scheduleVal: '08:00 – 17:00',
    earnings: 'السجل والأرباح',
    objectives: 'الأهداف والمكافآت',
    recap: 'ملخص اليوم',
    support: 'دعم التوزيع',
    docs: 'مستنداتي',
    settings: 'الإعدادات',
    help: 'مساعدة / أسئلة شائعة',
    incident: 'الإبلاغ عن حادثة',
    logout: 'تسجيل الخروج',
    logoutGuardTitle: 'إجراءات غير مُزامنة',
    logoutGuardBody: (n: number) => `لم يُرسَل بعد ${n} إجراء(ات). سيؤدي تسجيل الخروج إلى حذفها نهائيًا.`,
    cancel: 'إلغاء',
  },
} as const;

export default function ProfilScreen() {
  const { colors, mode } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = STR[lang as Lang] ?? STR.fr;
  const session = getSession();
  const [available, setAvailable] = React.useState(true);
  // Garde de déconnexion : reprise à l'identique de l'ancien `missions.tsx`
  // (même hook, même seuil sur la file en attente).
  const { pending } = useOutbox();

  async function doLogout() {
    await clearOutbox();
    await clearSession();
    router.replace('/');
  }

  function logout() {
    if (pending.length > 0) {
      Alert.alert(t.logoutGuardTitle, t.logoutGuardBody(pending.length), [
        { text: t.cancel, style: 'cancel' },
        { text: t.logout, style: 'destructive', onPress: doLogout },
      ]);
      return;
    }
    doLogout();
  }

  const initials = (session?.name ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

  const rows: { label: string; value: string; badge?: string }[] = [
    { label: t.vehicle, value: t.vehicleVal },
    { label: t.license, value: t.licenseVal, badge: t.licenseBadge },
    { label: t.zone, value: t.zoneVal },
    { label: t.schedule, value: t.scheduleVal },
  ];

  const nav: { label: string; href: string }[] = [
    { label: t.earnings, href: '/gains' },
    { label: t.objectives, href: '/objectives' },
    { label: t.recap, href: '/recap' },
    { label: t.support, href: '/support' },
    { label: t.docs, href: '/docs' },
    { label: t.settings, href: '/settings' },
    { label: t.help, href: '/help' },
  ];

  const row: 'row' | 'row-reverse' = rtl ? 'row-reverse' : 'row';
  const align: 'right' | 'left' = rtl ? 'right' : 'left';

  return (
    <ScrollView style={[s.wrap, { backgroundColor: colors.bg }]} contentContainerStyle={s.content}>
      <ScreenHead title={t.title} sub={t.sub} rtl={rtl} />
      <View style={s.body}>
        <View style={[s.identity, { flexDirection: row }]}>
          <View style={[s.avatar, { backgroundColor: colors.indigo9 }]}>
            <Text style={s.avatarTxt}>{initials || '?'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.name, { color: colors.text, textAlign: align }]} numberOfLines={1}>
              {session?.name || '—'}
            </Text>
            <Text style={[s.tenant, { color: colors.muted, textAlign: align }]} numberOfLines={1}>
              {session?.tenant || '—'}
            </Text>
          </View>
        </View>

        <View style={[s.card, { backgroundColor: colors.panel, borderColor: colors.border, flexDirection: row }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.cardLabel, { color: colors.text, textAlign: align }]}>{t.available}</Text>
            <Text style={[s.cardHint, { color: colors.muted, textAlign: align }]}>
              {available ? t.availableOn : t.availableOff}
            </Text>
          </View>
          <Switch value={available} onValueChange={setAvailable} trackColor={{ true: colors.indigo9 }} />
        </View>

        <View
          style={[
            s.callout,
            { backgroundColor: resolveColor('amber', 3, mode), borderColor: resolveColor('amber', 9, mode) },
          ]}
        >
          <Text style={[s.calloutTitle, { color: resolveColor('amber', 11, mode), textAlign: align }]}>
            {t.demoTitle}
          </Text>
          <Text style={[s.calloutBody, { color: resolveColor('amber', 11, mode), textAlign: align }]}>
            {t.demoBody}
          </Text>
        </View>

        <View style={[s.card, { backgroundColor: colors.panel, borderColor: colors.border }]}>
          {rows.map((r, i) => (
            <View
              key={r.label}
              style={[
                s.row,
                { flexDirection: row, borderBottomColor: colors.border, borderBottomWidth: i < rows.length - 1 ? 1 : 0 },
              ]}
            >
              <Text style={[s.rowLabel, { color: colors.muted }]}>{r.label}</Text>
              <View style={{ flexDirection: row, alignItems: 'center', gap: 8 }}>
                <Text style={[s.rowValue, { color: colors.text }]}>{r.value}</Text>
                {r.badge ? (
                  <View style={[s.badge, { backgroundColor: resolveColor('green', 3, mode) }]}>
                    <Text style={[s.badgeTxt, { color: resolveColor('green', 11, mode) }]}>{r.badge}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </View>

        <View style={[s.navGrid, { flexDirection: row }]}>
          {nav.map((n) => (
            <Pressable
              key={n.href}
              style={[s.navBtn, { backgroundColor: resolveColor('indigo', 3, mode) }]}
              onPress={() => router.push(n.href as never)}
              accessibilityRole="button"
              accessibilityLabel={n.label}
            >
              <Text style={[s.navTxt, { color: resolveColor('indigo', 11, mode), textAlign: align }]}>{n.label}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[s.navBtn, s.fullBtn, { backgroundColor: resolveColor('orange', 3, mode) }]}
          onPress={() => router.push('/incidents' as never)}
          accessibilityRole="button"
          accessibilityLabel={t.incident}
        >
          <Text style={[s.navTxt, { color: resolveColor('orange', 11, mode), textAlign: 'center' }]}>{t.incident}</Text>
        </Pressable>

        <Pressable
          style={[s.navBtn, s.fullBtn, { backgroundColor: resolveColor('red', 3, mode) }]}
          onPress={logout}
          accessibilityRole="button"
          accessibilityLabel={t.logout}
        >
          <Text style={[s.navTxt, { color: resolveColor('red', 11, mode), textAlign: 'center' }]}>{t.logout}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  content: { paddingBottom: 40 },
  body: { padding: space[4], gap: space[3] },
  identity: { alignItems: 'center', gap: space[3] },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  // Texte clair sur fond indigo9 plein : slate-1 (blanc cassé des tokens),
  // identique clair/sombre — même convention que support.tsx.
  avatarTxt: { color: resolveColor('slate', 1, 'light'), fontSize: 20, fontWeight: '700' },
  name: { fontSize: 18, fontWeight: '800' },
  tenant: { fontSize: 13, marginTop: 2 },
  card: { borderWidth: 1, borderRadius: 14, padding: space[3], alignItems: 'center' },
  cardLabel: { fontSize: 14, fontWeight: '700' },
  cardHint: { fontSize: 12, marginTop: 2 },
  callout: { borderWidth: 1, borderRadius: 12, padding: space[3], gap: 4 },
  calloutTitle: { fontSize: 13, fontWeight: '700' },
  calloutBody: { fontSize: 12, lineHeight: 17 },
  row: { alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 4 },
  rowLabel: { fontSize: 13 },
  rowValue: { fontSize: 13, fontWeight: '600' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeTxt: { fontSize: 11, fontWeight: '700' },
  navGrid: { flexWrap: 'wrap', gap: space[3] },
  navBtn: { minHeight: 48, minWidth: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, flexBasis: '47%', flexGrow: 1 },
  fullBtn: { flexBasis: '100%' },
  navTxt: { fontSize: 14, fontWeight: '700' },
});
