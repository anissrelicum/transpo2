// Profil — hub de navigation du livreur (onglet racine « Profil »).
//
// Véhicule, permis, zone et disponibilité viennent de la FICHE tenue par l'exploitation
// (`GET /v1/driver/me`). Ils étaient auparavant écrits en dur (« Moto · 7890-B-12 ») :
// le livreur lisait le véhicule de quelqu'un d'autre sur l'écran censé porter le sien, et
// son interrupteur de disponibilité ne quittait jamais le téléphone — le dispatch
// continuait de lui affecter des courses. L'horaire du jour reste indicatif : aucune
// notion d'horaire n'existe encore côté serveur, et c'est dit à l'écran.
import * as React from 'react';
import { View, Text, ScrollView, Pressable, Switch, Alert, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { space } from '@transpo/design-tokens';
import { ScreenHead } from '../../components/shell';
import { useTheme, resolveColor } from '../../lib/theme';
import { useLanguage, type Lang } from '../../lib/i18n';
import type { DriverProfile } from '@transpo/api-client';
import { getSession, clearSession, authedClient } from '../../lib/api';
import { clear as clearOutbox } from '../../lib/outbox';
import { useOutbox } from '../../lib/useOutbox';

const STR = {
  fr: {
    title: 'Mon profil',
    sub: 'Livreur · Transpo',
    available: 'Disponible',
    availableOn: 'Vous recevez des missions',
    availableOff: 'Hors ligne — aucune mission',
    demoTitle: 'Horaire indicatif',
    demoBody:
      "L'horaire affiché est un exemple : aucune notion d'horaire de travail n'existe encore côté serveur. Le véhicule, le permis, la zone et la disponibilité viennent, eux, de votre fiche.",
    vehicle: 'Véhicule',
    license: 'Permis',
    licenseValid: 'Valide',
    licenseExpired: 'Expiré',
    zone: 'Zone assignée',
    schedule: 'Horaire du jour',
    scheduleVal: '08:00 – 17:00',
    unknown: 'Non renseigné',
    noZone: 'Aucune zone',
    availabilityFailed: 'Disponibilité non enregistrée — vérifiez votre connexion.',
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
    demoTitle: 'توقيت إرشادي',
    demoBody:
      'التوقيت المعروض مثال فقط: لا توجد بعد فكرة توقيت العمل على الخادم. أما المركبة ورخصة القيادة والمنطقة والتوفر فمن ملفك.',
    vehicle: 'المركبة',
    license: 'رخصة القيادة',
    licenseValid: 'سارية',
    licenseExpired: 'منتهية',
    zone: 'المنطقة المسندة',
    schedule: 'توقيت اليوم',
    scheduleVal: '08:00 – 17:00',
    unknown: 'غير محدد',
    noZone: 'لا توجد منطقة',
    availabilityFailed: 'لم يُسجَّل التوفر — تحقق من اتصالك.',
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
  const [fiche, setFiche] = React.useState<DriverProfile | null>(null);
  const [available, setAvailable] = React.useState(true);

  React.useEffect(() => {
    authedClient().getDriverProfile()
      .then((p) => { setFiche(p); setAvailable(p.available); })
      .catch(() => { /* hors ligne : on garde ce qui est affiché */ });
  }, []);

  /**
   * Bascule la disponibilité. L'affichage suit tout de suite, mais si le serveur refuse
   * ou ne répond pas, on REVIENT en arrière : un interrupteur qui reste sur « indisponible »
   * alors que le dispatch voit toujours le livreur disponible est pire que pas d'interrupteur.
   */
  async function basculerDisponibilite(valeur: boolean) {
    const avant = available;
    setAvailable(valeur);
    try {
      const r = await authedClient().setMyAvailability(valeur);
      setAvailable(r.available);
    } catch {
      setAvailable(avant);
      Alert.alert(t.available, t.availabilityFailed);
    }
  }
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

  const permisValide = fiche?.licenseDue ? fiche.licenseDue >= new Date().toISOString().slice(0, 10) : null;
  const vehiculeLibelle = [fiche?.vehicle, fiche?.plate].filter(Boolean).join(' · ') || t.unknown;
  const permisLibelle = fiche?.licenseNo
    ? `${fiche.licenseNo}${fiche.licenseDue ? ` · exp. ${fiche.licenseDue}` : ''}`
    : t.unknown;

  const rows: { label: string; value: string; badge?: string }[] = [
    { label: t.vehicle, value: vehiculeLibelle },
    {
      label: t.license, value: permisLibelle,
      ...(permisValide === null ? {} : { badge: permisValide ? t.licenseValid : t.licenseExpired }),
    },
    { label: t.zone, value: fiche?.zone ?? (fiche ? t.noZone : t.unknown) },
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
          <Switch
            value={available}
            onValueChange={basculerDisponibilite}
            trackColor={{ true: colors.indigo9 }}
            testID="profil-disponibilite"
            accessibilityLabel={t.available}
          />
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
