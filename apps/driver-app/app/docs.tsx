// Mes documents — les vraies informations de la fiche chauffeur (`getDriverProfile`) :
// permis (numéro, échéance), visite médicale (échéance), véhicule. C'est l'agence qui les
// tient à jour depuis la console ; le livreur les consulte et signale une erreur à l'agence.
import * as React from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { router, Stack } from 'expo-router';
import { space } from '@transpo/design-tokens';
import type { DriverProfile } from '@transpo/api-client';
import { ScreenHead } from '../components/shell';
import { Bouton } from '../components/ui';
import { useTheme, resolveColor } from '../lib/theme';
import { useLanguage, type Lang } from '../lib/i18n';
import { authedClient } from '../lib/api';

type Etat = 'valide' | 'bientot' | 'expire' | 'inconnu';
const BIENTOT_JOURS = 30;

const STR = {
  fr: {
    title: 'Mes documents', sub: 'Tenus à jour par votre agence',
    permis: 'Permis de conduire', visite: 'Visite médicale', vehicule: 'Véhicule',
    numero: (n: string) => `N° ${n}`, echeance: (d: string) => `Échéance ${d}`, nonRenseigne: 'Non renseigné',
    etats: { valide: 'Valide', bientot: 'Bientôt', expire: 'Expiré', inconnu: 'À compléter' } as Record<Etat, string>,
    aide: 'Une information fausse ou un document renouvelé ? Prévenez l’agence : elle met à jour votre fiche.',
    ecrire: 'Écrire à l’agence', erreur: 'Impossible de charger votre fiche. Vérifiez votre connexion.',
  },
  ar: {
    title: 'مستنداتي', sub: 'تُحدّثها وكالتك',
    permis: 'رخصة القيادة', visite: 'الفحص الطبي', vehicule: 'المركبة',
    numero: (n: string) => `رقم ${n}`, echeance: (d: string) => `تنتهي في ${d}`, nonRenseigne: 'غير محدد',
    etats: { valide: 'سارية', bientot: 'قريبًا', expire: 'منتهية', inconnu: 'للإكمال' } as Record<Etat, string>,
    aide: 'معلومة خاطئة أو وثيقة جُدّدت؟ أخبر الوكالة لتحديث ملفك.',
    ecrire: 'مراسلة الوكالة', erreur: 'تعذّر تحميل ملفك. تحقق من اتصالك.',
  },
} as const;

function etatDe(echeance: string | null): Etat {
  if (!echeance) return 'inconnu';
  const jours = (Date.parse(`${echeance}T00:00:00`) - Date.now()) / 86_400_000;
  return jours < 0 ? 'expire' : jours <= BIENTOT_JOURS ? 'bientot' : 'valide';
}
const TON: Record<Etat, 'green' | 'amber' | 'red' | 'slate'> = { valide: 'green', bientot: 'amber', expire: 'red', inconnu: 'slate' };

function dateLisible(iso: string, lang: Lang): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function DocsScreen() {
  const { colors, mode } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = STR[lang as Lang] ?? STR.fr;
  const align: 'right' | 'left' = rtl ? 'right' : 'left';
  const row: 'row' | 'row-reverse' = rtl ? 'row-reverse' : 'row';
  const [fiche, setFiche] = React.useState<DriverProfile | null>(null);
  const [erreur, setErreur] = React.useState(false);

  React.useEffect(() => {
    authedClient().getDriverProfile().then(setFiche).catch(() => setErreur(true));
  }, []);

  const lignes: { nom: string; detail: string; etat: Etat | null }[] = fiche ? [
    { nom: t.permis, detail: [fiche.licenseNo ? t.numero(fiche.licenseNo) : null, fiche.licenseDue ? t.echeance(dateLisible(fiche.licenseDue, lang as Lang)) : null].filter(Boolean).join(' · ') || t.nonRenseigne, etat: etatDe(fiche.licenseDue) },
    { nom: t.visite, detail: fiche.medicalDue ? t.echeance(dateLisible(fiche.medicalDue, lang as Lang)) : t.nonRenseigne, etat: etatDe(fiche.medicalDue) },
    { nom: t.vehicule, detail: [fiche.vehicle, fiche.plate].filter(Boolean).join(' · ') || t.nonRenseigne, etat: null },
  ] : [];

  return (
    <View style={[s.wrap, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHead title={t.title} sub={t.sub} onBack={() => router.back()} rtl={rtl} />
      <ScrollView contentContainerStyle={s.content}>
        {!fiche && !erreur ? <ActivityIndicator color={colors.indigo9} style={{ marginTop: 32 }} /> : null}
        {erreur ? <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 32 }}>{t.erreur}</Text> : null}

        {lignes.map((l) => (
          <View key={l.nom} style={[s.card, { backgroundColor: colors.panel, borderColor: colors.border, flexDirection: row }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.docName, { color: colors.text, textAlign: align }]}>{l.nom}</Text>
              <Text style={[s.docMeta, { color: colors.muted, textAlign: align }]}>{l.detail}</Text>
            </View>
            {l.etat ? (
              <View style={[s.badge, { backgroundColor: resolveColor(TON[l.etat], 3, mode) }]}>
                <Text style={[s.badgeTxt, { color: resolveColor(TON[l.etat], 11, mode) }]}>{t.etats[l.etat]}</Text>
              </View>
            ) : null}
          </View>
        ))}

        {fiche ? (
          <>
            <Text style={[{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 8 }, { textAlign: align }]}>{t.aide}</Text>
            <Bouton variante="secondaire" onPress={() => router.push('/support')}>{t.ecrire}</Bouton>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  content: { padding: space[4], gap: space[3], paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 14, padding: space[4], alignItems: 'center', gap: 10, minHeight: 64 },
  docName: { fontSize: 16, fontWeight: '700' },
  docMeta: { fontSize: 13, marginTop: 3 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeTxt: { fontSize: 12, fontWeight: '700' },
});
