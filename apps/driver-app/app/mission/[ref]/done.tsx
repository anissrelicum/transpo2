// Livraison réussie (maquette validée, acte 4) : un écran plein, lisible d'un coup d'œil,
// qui montre déjà l'arrêt suivant. Un toucher et la navigation repart.
//
// La commande sort de la liste des missions actives dès que le serveur l'a traitée : le
// montant vient donc des paramètres passés par l'écran de preuve, pas d'une relecture.
import * as React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { money } from '@transpo/domain';
import { useLanguage } from '../../../lib/i18n';
import { useJournee } from '../../../lib/useJournee';
import { distanceKm, minutesEstimees } from '../../../lib/journee';
import { ouvrirItineraire, partirEnRoute } from '../../../lib/etapes';
import { Bouton } from '../../../components/ui';
import { IcCheck } from '../../../components/icones';

const VERT = '#17A06B';

const T = {
  fr: {
    titre: 'Livraison réussie', encaisse: (m: string) => `${m} encaissés · preuve enregistrée`, preuve: 'Preuve enregistrée',
    ensuite: 'Ensuite', retrait: 'Retrait', livraison: 'Livraison', minutes: (n: number) => `~${n} min`,
    suivant: 'Arrêt suivant →', fini: 'Plus d’arrêt pour le moment', journee: 'Retour à ma journée',
    navKo: 'Aucune application de carte n’a pu ouvrir cet itinéraire.',
  },
  ar: {
    titre: 'تم التسليم بنجاح', encaisse: (m: string) => `تم تحصيل ${m} · الإثبات مسجَّل`, preuve: 'الإثبات مسجَّل',
    ensuite: 'التالي', retrait: 'استلام', livraison: 'تسليم', minutes: (n: number) => `~${n} د`,
    suivant: '← المحطة التالية', fini: 'لا توجد محطات حالياً', journee: 'العودة إلى يومي',
    navKo: 'لم يتمكن أي تطبيق خرائط من فتح هذا المسار.',
  },
};

export default function Reussi() {
  const { ref, cod } = useLocalSearchParams<{ ref: string; cod?: string }>();
  const { lang, rtl } = useLanguage();
  const t = T[lang];
  const insets = useSafeAreaInsets();
  const j = useJournee();
  const suivant = j.arrets.find((a) => !a.commandes.some((c) => c.ref === ref));
  const montant = Number(cod) || 0;
  const moi = j.moi ? { lat: j.moi.lat, lng: j.moi.lng } : null;
  const min = suivant?.pos && moi ? minutesEstimees(distanceKm(moi, suivant.pos)) : null;

  async function continuer() {
    if (!suivant) { router.replace('/(tabs)/journee'); return; }
    router.replace('/(tabs)/journee');
    let parti = false;
    for (const c of suivant.commandes) parti = (await partirEnRoute(c)) || parti;
    if (parti) void j.sync();
    const ok = await ouvrirItineraire(suivant.pos?.lat ?? null, suivant.pos?.lng ?? null, suivant.lienCarte, suivant.adresse);
    if (!ok) Alert.alert(t.suivant, t.navKo);
  }

  return (
    <View style={[s.plein, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.centre}>
        <View style={s.rond}><IcCheck size={52} color="#fff" /></View>
        <Text style={s.titre}>{t.titre}</Text>
        <Text style={s.sous}>{montant > 0 ? t.encaisse(money(montant)) : t.preuve}</Text>
        {suivant ? (
          <View style={s.ensuite}>
            <Text style={[s.ensuiteLib, { textAlign: rtl ? 'right' : 'left' }]}>{t.ensuite.toUpperCase()}</Text>
            <Text style={[s.ensuiteNom, { textAlign: rtl ? 'right' : 'left' }]} numberOfLines={1}>
              {suivant.type === 'retrait' ? t.retrait : t.livraison} · {suivant.contact ?? suivant.order.ref}
            </Text>
            <Text style={[s.ensuiteAdr, { textAlign: rtl ? 'right' : 'left' }]} numberOfLines={1}>
              {suivant.adresse}{min ? ` · ${t.minutes(min)}` : ''}
            </Text>
          </View>
        ) : (
          <View style={s.ensuite}><Text style={[s.ensuiteNom, { textAlign: 'center' }]}>{t.fini}</Text></View>
        )}
      </View>
      <View style={{ paddingHorizontal: 16 }}>
        <Bouton testID="arret-suivant" variante="blanc" onPress={continuer}>{suivant ? t.suivant : t.journee}</Bouton>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  plein: { flex: 1, backgroundColor: VERT },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  rond: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  titre: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 18 },
  sous: { color: '#fff', opacity: 0.9, marginTop: 6, fontSize: 15, textAlign: 'center' },
  ensuite: { marginTop: 26, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 16, padding: 16, alignSelf: 'stretch' },
  ensuiteLib: { color: '#fff', opacity: 0.85, fontSize: 13, fontWeight: '700', letterSpacing: 0.7 },
  ensuiteNom: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 4 },
  ensuiteAdr: { color: '#fff', opacity: 0.9, marginTop: 2 },
});
