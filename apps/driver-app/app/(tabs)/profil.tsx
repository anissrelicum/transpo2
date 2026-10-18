// Profil (maquette validée, acte 6) : la disponibilité en un interrupteur (c'est elle que
// lit l'affectation automatique), le temps de conduite avec une alerte avant la limite,
// les documents, et la fin de journée. Les écrans « démo » (objectifs, horaire indicatif,
// chiffres d'exemple) sont retirés tant qu'ils ne reposent pas sur de vraies données.
import * as React from 'react';
import { View, Text, ScrollView, Pressable, Switch, Alert, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { DriverProfile } from '@transpo/api-client';
import { eu561Status, EU561_MAX_DRIVE_HOURS } from '@transpo/domain';
import { useTheme, resolveColor } from '../../lib/theme';
import { useLanguage } from '../../lib/i18n';
import { getSession, clearSession, authedClient } from '../../lib/api';
import { clear as clearOutbox } from '../../lib/outbox';
import { useOutbox } from '../../lib/useOutbox';
import { useService, terminerJournee, conduiteMs, amplitudeMs, formatDuree } from '../../lib/service';
import { Bouton, Carte, Libelle, Pastille, Bandeau, useTon } from '../../components/ui';

const MAX_MS = EU561_MAX_DRIVE_HOURS * 3_600_000;

const T = {
  fr: {
    titre: 'Profil', dispo: 'Disponible pour des missions',
    dispoAide: 'Désactivez pour une pause : plus aucune mission proposée.', dispoKo: 'Disponibilité non enregistrée — vérifiez votre connexion.',
    horsJournee: 'Démarrez votre journée pour recevoir des missions.',
    conduite: 'Temps de conduite', sur: (a: string, b: string) => `${a} sur ${b}`,
    pause: 'Pause de 45 min obligatoire avant de reprendre la route.', bientot: 'Moins de 30 min avant la limite de conduite du jour.',
    limite: 'Limite de conduite du jour atteinte : terminez votre journée.',
    historique: 'Historique et gains', documents: 'Mes documents (permis, visite)', aJour: 'À jour', expire: 'Expiré',
    reglages: 'Langue · Thème', aide: 'Aide', support: 'Écrire à l’agence', incident: 'Signaler un incident',
    terminer: 'Terminer ma journée', terminerTitre: 'Terminer la journée ?',
    terminerCorps: 'Vous ne recevrez plus de missions et le partage de position s’arrête. Pensez à déclarer votre caisse.',
    annuler: 'Annuler', deconnexion: 'Se déconnecter',
    garde: 'Actions non envoyées', gardeCorps: (n: number) => `${n} action(s) n’ont pas encore été transmises. Se déconnecter les supprimera.`,
    vehicule: 'Véhicule non renseigné',
  },
  ar: {
    titre: 'الملف', dispo: 'متاح لاستقبال المهام',
    dispoAide: 'عطّله للاستراحة: لن تُقترح عليك أي مهمة.', dispoKo: 'لم يُسجَّل التوفر — تحقق من اتصالك.',
    horsJournee: 'ابدأ يومك لاستقبال المهام.',
    conduite: 'وقت القيادة', sur: (a: string, b: string) => `${a} من ${b}`,
    pause: 'استراحة 45 دقيقة إلزامية قبل مواصلة الطريق.', bientot: 'أقل من 30 دقيقة قبل حد القيادة اليومي.',
    limite: 'تم بلوغ حد القيادة اليومي: أنهِ يومك.',
    historique: 'السجل والأرباح', documents: 'مستنداتي (الرخصة، الفحص)', aJour: 'سارية', expire: 'منتهية',
    reglages: 'اللغة · المظهر', aide: 'مساعدة', support: 'مراسلة الوكالة', incident: 'الإبلاغ عن حادث',
    terminer: 'إنهاء يومي', terminerTitre: 'إنهاء اليوم؟',
    terminerCorps: 'لن تستقبل مهاماً بعد الآن وستتوقف مشاركة الموقع. لا تنسَ التصريح بصندوقك.',
    annuler: 'إلغاء', deconnexion: 'تسجيل الخروج',
    garde: 'إجراءات غير مُرسلة', gardeCorps: (n: number) => `لم يُرسَل بعد ${n} إجراء. سيؤدي تسجيل الخروج إلى حذفها.`,
    vehicule: 'المركبة غير محددة',
  },
};

export default function Profil() {
  const { colors, mode } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = T[lang];
  const insets = useSafeAreaInsets();
  const indigo = useTon('indigo');
  const { etat } = useService();
  const { pending } = useOutbox();
  const session = getSession();
  const [fiche, setFiche] = React.useState<DriverProfile | null>(null);
  const [dispo, setDispo] = React.useState(true);
  const row = { flexDirection: rtl ? 'row-reverse' as const : 'row' as const };
  const align = { textAlign: rtl ? 'right' as const : 'left' as const };

  React.useEffect(() => {
    authedClient().getDriverProfile().then((p) => { setFiche(p); setDispo(p.available); }).catch(() => undefined);
  }, [etat.active]);

  /** Si le serveur refuse ou ne répond pas, l'interrupteur REVIENT : il ne doit jamais mentir au dispatch. */
  async function basculer(v: boolean) {
    const avant = dispo;
    setDispo(v);
    try {
      const r = await authedClient().setMyAvailability(v);
      setDispo(r.available);
    } catch {
      setDispo(avant);
      Alert.alert(t.dispo, t.dispoKo);
    }
  }

  function terminer() {
    Alert.alert(t.terminerTitre, t.terminerCorps, [
      { text: t.annuler, style: 'cancel' },
      { text: t.terminer, style: 'destructive', onPress: () => { void terminerJournee().then(() => setDispo(false)); } },
    ]);
  }

  async function seDeconnecter() {
    if (etat.active) await terminerJournee();
    await clearOutbox();
    await clearSession();
    router.replace('/');
  }

  function deconnexion() {
    if (pending.length > 0) {
      Alert.alert(t.garde, t.gardeCorps(pending.length), [
        { text: t.annuler, style: 'cancel' },
        { text: t.deconnexion, style: 'destructive', onPress: () => void seDeconnecter() },
      ]);
      return;
    }
    void seDeconnecter();
  }

  const conduite = conduiteMs(etat);
  const { level } = eu561Status({ drivenMs: conduite, amplitudeMs: amplitudeMs(etat) });
  const couleurBarre = level === 'limite' || level === 'warn' ? resolveColor('red', 9, mode) : level === 'pause' ? resolveColor('amber', 9, mode) : colors.indigo9;
  const initiales = (session?.name ?? '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
  const docsOk = fiche
    ? [fiche.licenseDue, fiche.medicalDue].every((d) => !d || d >= new Date().toISOString().slice(0, 10))
    : null;

  const liens: { label: string; href: string; droite?: React.ReactNode }[] = [
    { label: t.historique, href: '/gains' },
    { label: t.documents, href: '/docs', droite: docsOk === null ? null : <Pastille ton={docsOk ? 'vert' : 'rouge'}>{docsOk ? t.aJour : t.expire}</Pastille> },
    { label: t.reglages, href: '/settings' },
    { label: t.support, href: '/support' },
    { label: t.incident, href: '/incidents' },
    { label: t.aide, href: '/help' },
  ];

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={[s.contenu, { paddingTop: insets.top + 8 }]}>
      <Text style={[s.titre, { color: colors.text }, align]}>{t.titre}</Text>

      <Carte style={[row, { alignItems: 'center', gap: 14 }]}>
        <View style={[s.avatar, { backgroundColor: indigo.doux }]}><Text style={{ color: indigo.texte, fontWeight: '800', fontSize: 17 }}>{initiales}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={[{ color: colors.text, fontSize: 18, fontWeight: '700' }, align]}>{session?.name ?? ''}</Text>
          <Text style={[{ color: colors.muted, fontSize: 13 }, align]}>
            {[session?.tenant, [fiche?.vehicle, fiche?.plate].filter(Boolean).join(' ') || (fiche ? t.vehicule : null)].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </Carte>

      <Carte>
        <View style={[row, s.entre]}>
          <Text style={[{ color: colors.text, fontWeight: '700', fontSize: 16, flex: 1 }, align]}>{t.dispo}</Text>
          <Switch testID="disponibilite" value={etat.active && dispo} disabled={!etat.active} onValueChange={(v) => { void basculer(v); }}
            trackColor={{ true: resolveColor('green', 9, mode), false: colors.border }} />
        </View>
        <Text style={[{ color: colors.muted, fontSize: 13, marginTop: 6 }, align]}>{etat.active ? t.dispoAide : t.horsJournee}</Text>
      </Carte>

      <Carte>
        <Libelle rtl={rtl}>{t.conduite}</Libelle>
        <View style={[s.barre, { backgroundColor: colors.border }]}>
          <View style={{ width: `${Math.min(100, (conduite / MAX_MS) * 100)}%`, height: '100%', backgroundColor: couleurBarre }} />
        </View>
        <Text style={[{ color: colors.text, fontSize: 15 }, align]}>{t.sur(formatDuree(conduite, lang), formatDuree(MAX_MS, lang))}</Text>
        {level === 'limite' ? <View style={{ marginTop: 8 }}><Bandeau ton="rouge" rtl={rtl}>{t.limite}</Bandeau></View>
          : level === 'warn' ? <View style={{ marginTop: 8 }}><Bandeau ton="rouge" rtl={rtl}>{t.bientot}</Bandeau></View>
          : level === 'pause' ? <View style={{ marginTop: 8 }}><Bandeau ton="ambre" rtl={rtl}>{t.pause}</Bandeau></View> : null}
      </Carte>

      <Carte style={{ paddingVertical: 4 }}>
        {liens.map((l, i) => (
          <Pressable key={l.href} onPress={() => router.push(l.href as never)} accessibilityRole="button"
            style={[row, s.lien, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <Text style={[{ color: colors.text, fontSize: 16, flex: 1 }, align]}>{l.label}</Text>
            {l.droite ?? <Text style={{ color: colors.muted, fontSize: 18 }}>{rtl ? '‹' : '›'}</Text>}
          </Pressable>
        ))}
      </Carte>

      {etat.active ? <Bouton testID="terminer-journee" variante="danger" petit onPress={terminer}>{t.terminer}</Bouton> : null}
      <Pressable onPress={deconnexion} accessibilityRole="button" style={s.deconnexion}>
        <Text style={{ color: colors.muted, fontWeight: '600' }}>{t.deconnexion}</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  contenu: { padding: 16, gap: 12, paddingBottom: 32 },
  titre: { fontSize: 24, fontWeight: '800' },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  entre: { alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  barre: { height: 12, borderRadius: 7, overflow: 'hidden', marginTop: 10, marginBottom: 8 },
  lien: { alignItems: 'center', minHeight: 52, gap: 10 },
  deconnexion: { alignItems: 'center', justifyContent: 'center', minHeight: 48 },
});
