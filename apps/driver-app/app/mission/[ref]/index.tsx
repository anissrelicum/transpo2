// Un arrêt (maquette validée, acte 4 « Arrivé chez le client »).
//
// Une seule action principale, en bas, qui dépend de l'étape :
//   ASSIGNEE  → « Partir vers le retrait »  (en route + navigation)
//   RETRAIT   → « J'ai récupéré le colis »
//   RECUPEREE → « Partir livrer »           (en route + navigation)
//   LIVRAISON → « Remettre le colis »       (preuve, puis encaissement)
// L'arrivée est détectée par la position (rayon de 120 m) : la consigne du client et
// l'action s'affichent au bon moment, sans bouton « je suis arrivé » à chercher.
// L'ancien écran « Progression » (status.tsx), qui ne faisait qu'avancer le statut, est
// fondu ici.
import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { money, STATUS_META } from '@transpo/domain';
import { useTheme } from '../../../lib/theme';
import { useLanguage } from '../../../lib/i18n';
import { useJournee } from '../../../lib/useJournee';
import { distanceKm, estArrive, formatDistance, minutesEstimees } from '../../../lib/journee';
import { avancer, ouvrirItineraire, partirEnRoute, appeler } from '../../../lib/etapes';
import { CarteJournee } from '../../../components/CarteJournee';
import { Bouton, Carte, Libelle, Pastille, Bandeau } from '../../../components/ui';
import { IcNaviguer, IcTel, IcPin, IcRetour, IcAlerte } from '../../../components/icones';

const T = {
  fr: {
    arret: (i: number, n: number) => `Arrêt ${i} sur ${n}`,
    retrait: 'Retrait', livraison: 'Livraison',
    arrive: (m: number) => `Vous êtes arrivé · ${m} m de l’adresse`,
    loin: (min: number, d: string) => `~${min} min · ${d}`,
    sansPos: 'Adresse saisie sans position GPS : la navigation cherchera l’adresse.',
    consigneClient: 'Consigne du client', consigneRetrait: 'Consigne de retrait',
    colis: 'Colis', fragile: 'Fragile', prepaye: 'Prépayée', cod: (m: string) => `COD ${m}`,
    preuve: { photo: 'Photo exigée', signature: 'Signature exigée', photo_signature: 'Photo + signature' } as Record<string, string>,
    naviguer: 'Naviguer', appeler: 'Appeler', probleme: 'Problème',
    partirRetrait: 'Partir vers le retrait', recupere: 'J’ai récupéré le colis', recupereN: (n: number) => `J’ai récupéré les ${n} colis`,
    colisN: (n: number) => `${n} colis à retirer`,
    partirLivrer: 'Partir livrer', remettre: 'Remettre le colis',
    introuvable: 'Arrêt introuvable', introuvableSub: 'La mission a peut-être déjà été traitée.', retour: 'Retour à ma journée',
    navKo: 'Aucune application de carte n’a pu ouvrir cet itinéraire.',
    enFile: 'Enregistré sur le téléphone — sera envoyé au retour du réseau.',
    numeroMasque: 'Le numéro du client n’est pas transmis à l’app.',
  },
  ar: {
    arret: (i: number, n: number) => `المحطة ${i} من ${n}`,
    retrait: 'استلام', livraison: 'تسليم',
    arrive: (m: number) => `لقد وصلت · ${m} م من العنوان`,
    loin: (min: number, d: string) => `~${min} د · ${d}`,
    sansPos: 'عنوان بدون موقع GPS: ستبحث الملاحة عن العنوان.',
    consigneClient: 'تعليمات الزبون', consigneRetrait: 'تعليمات الاستلام',
    colis: 'الطرد', fragile: 'قابل للكسر', prepaye: 'مدفوعة مسبقاً', cod: (m: string) => `الدفع عند الاستلام ${m}`,
    preuve: { photo: 'الصورة مطلوبة', signature: 'التوقيع مطلوب', photo_signature: 'صورة + توقيع' } as Record<string, string>,
    naviguer: 'الملاحة', appeler: 'اتصال', probleme: 'مشكلة',
    partirRetrait: 'التوجه للاستلام', recupere: 'استلمت الطرد', recupereN: (n: number) => `استلمت الطرود ${n}`,
    colisN: (n: number) => `${n} طرود للاستلام`,
    partirLivrer: 'التوجه للتسليم', remettre: 'تسليم الطرد',
    introuvable: 'المحطة غير موجودة', introuvableSub: 'ربما تمت معالجة المهمة.', retour: 'العودة إلى يومي',
    navKo: 'لم يتمكن أي تطبيق خرائط من فتح هذا المسار.',
    enFile: 'تم الحفظ على الهاتف — سيُرسل عند عودة الشبكة.',
    numeroMasque: 'رقم الزبون لا يُرسل إلى التطبيق.',
  },
};

export default function ArretScreen() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const refStr = String(ref);
  const { colors, mode } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = T[lang];
  const insets = useSafeAreaInsets();
  const j = useJournee();
  const [occupe, setOccupe] = React.useState(false);
  const row = { flexDirection: rtl ? 'row-reverse' as const : 'row' as const };
  const align = { textAlign: rtl ? 'right' as const : 'left' as const };

  const index = j.arrets.findIndex((a) => a.commandes.some((c) => c.ref === refStr));
  const a = index >= 0 ? j.arrets[index]! : null;

  if (j.chargement) {
    return <View style={[s.centre, { backgroundColor: colors.bg }]}><ActivityIndicator color={colors.indigo9} size="large" /></View>;
  }
  if (!a) {
    return (
      <View style={[s.centre, { backgroundColor: colors.bg, padding: 24, gap: 12 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{t.introuvable}</Text>
        <Text style={{ color: colors.muted, textAlign: 'center' }}>{t.introuvableSub}</Text>
        <Bouton onPress={() => router.replace('/(tabs)/journee')} style={{ alignSelf: 'stretch' }}>{t.retour}</Bouton>
      </View>
    );
  }

  const o = a.order;
  const moi = j.moi ? { lat: j.moi.lat, lng: j.moi.lng } : null;
  const arrive = estArrive(moi, a);
  const dist = a.pos && moi ? distanceKm(moi, a.pos) : null;
  const enFile = j.pending.some((p) => a.commandes.some((c) => c.ref === p.ref));
  const nb = a.commandes.length;
  const preuve = t.preuve[o.proofLevel];

  async function naviguer() {
    const ok = await ouvrirItineraire(a!.pos?.lat ?? null, a!.pos?.lng ?? null, a!.lienCarte, a!.adresse);
    if (!ok) Alert.alert(t.naviguer, t.navKo);
  }

  async function action() {
    if (o.status === 'LIVRAISON') { router.push(`/mission/${encodeURIComponent(o.ref)}/proof`); return; }
    setOccupe(true);
    try {
      // Un arrêt groupé (plusieurs colis au même retrait) avance d'un seul geste.
      if (o.status === 'ASSIGNEE' || o.status === 'RECUPEREE') {
        for (const c of a!.commandes) await partirEnRoute(c);
        void j.sync().then(j.recharger);
        await naviguer();
      } else {
        for (const c of a!.commandes) if (c.status === o.status) await avancer(c);
        await j.sync();
        // Colis en main : l'ordre de la tournée change (on part livrer). « Ma journée »
        // montre le vrai prochain arrêt — pas la livraison de la 1re commande du groupe.
        router.replace('/(tabs)/journee');
      }
    } finally {
      setOccupe(false);
    }
  }

  const libelleAction =
    o.status === 'ASSIGNEE' ? t.partirRetrait
      : o.status === 'RETRAIT' ? (nb > 1 ? t.recupereN(nb) : t.recupere)
      : o.status === 'RECUPEREE' ? t.partirLivrer
      : o.status === 'LIVRAISON' ? t.remettre
      : lang === 'ar' ? STATUS_META[o.status].ar : STATUS_META[o.status].fr;
  const actionPossible = ['ASSIGNEE', 'RETRAIT', 'RECUPEREE', 'LIVRAISON'].includes(o.status);

  return (
    <View style={[s.plein, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.carte}>
        {a.pos ? (
          <CarteJournee points={[{ ref: o.ref, lat: a.pos.lat, lng: a.pos.lng, n: index + 1, etat: 'prochain' }]} moi={moi}
            sombre={mode === 'dark'} bas={70} />
        ) : (
          <View style={[s.sansCarte, { backgroundColor: colors.panel }]}>
            <IcPin size={28} color={colors.muted} />
            <Text style={{ color: colors.muted, textAlign: 'center', paddingHorizontal: 32 }}>{t.sansPos}</Text>
          </View>
        )}
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour"
          style={[s.retour, { top: insets.top + 8, [rtl ? 'right' : 'left']: 12, backgroundColor: colors.panel }]}>
          <View style={{ transform: [{ scaleX: rtl ? -1 : 1 }] }}><IcRetour size={24} color={colors.text} /></View>
        </Pressable>
        <View style={s.etatArrivee}>
          {arrive ? (
            <Bandeau ton="vert" rtl={rtl}>{t.arrive(Math.round((dist ?? 0) * 1000))}</Bandeau>
          ) : dist != null ? (
            <Bandeau ton="indigo" rtl={rtl}>{t.loin(minutesEstimees(dist), formatDistance(dist, lang))}</Bandeau>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={s.contenu}>
        <View style={[row, s.entre]}>
          <Libelle rtl={rtl}>{`${t.arret(index + 1, j.arrets.length)} · ${a.type === 'retrait' ? t.retrait : t.livraison}`}</Libelle>
          {a.type === 'livraison' && o.cod > 0 && !o.codPaid ? <Pastille ton="ambre">{t.cod(money(o.cod))}</Pastille> : null}
        </View>
        <Text style={[s.nom, { color: colors.text }, align]}>{a.contact ?? o.ref}</Text>
        <Text style={[s.adresse, { color: colors.muted }, align]}>{a.adresse}</Text>

        {a.consigne ? (
          <Carte style={{ paddingVertical: 12 }}>
            <Text style={[{ color: colors.text, fontWeight: '700' }, align]}>{a.type === 'retrait' ? t.consigneRetrait : t.consigneClient}</Text>
            <Text style={[{ color: colors.muted, marginTop: 2, fontSize: 15 }, align]}>« {a.consigne} »</Text>
          </Carte>
        ) : null}

        {nb > 1 ? (
          <Carte style={{ paddingVertical: 10 }}>
            <Text style={[{ color: colors.text, fontWeight: '700', marginBottom: 4 }, align]}>{t.colisN(nb)}</Text>
            {a.commandes.map((c) => (
              <Text key={c.ref} style={[{ color: colors.muted, fontSize: 14, paddingVertical: 2 }, align]}>
                • {c.dropContact ?? c.ref} · {c.size}{c.fragile ? ` · ${t.fragile}` : ''}
              </Text>
            ))}
          </Carte>
        ) : null}

        <View style={[row, s.puces]}>
          {nb === 1 ? <Pastille ton="gris">{`${t.colis} · ${o.size}`}</Pastille> : null}
          {nb === 1 && o.fragile ? <Pastille ton="rouge">{t.fragile}</Pastille> : null}
          {a.type === 'livraison' && preuve ? <Pastille ton="gris">{preuve}</Pastille> : null}
          {a.type === 'livraison' && o.cod <= 0 ? <Pastille ton="gris">{t.prepaye}</Pastille> : null}
          <Pastille ton="indigo">{lang === 'ar' ? STATUS_META[o.status].ar : STATUS_META[o.status].fr}</Pastille>
        </View>

        <View style={[row, s.secondaires]}>
          <Bouton petit variante="secondaire" style={{ flex: 1 }} onPress={naviguer} icone={<IcNaviguer size={18} color={colors.text} />}>
            {t.naviguer}
          </Bouton>
          {a.telephone ? (
            <Bouton petit variante="secondaire" style={{ flex: 1 }} onPress={() => appeler(a.telephone!)} icone={<IcTel size={18} color={colors.text} />}>
              {t.appeler}
            </Bouton>
          ) : null}
          {o.status === 'LIVRAISON' ? (
            <Bouton testID="signaler-probleme" petit variante="danger" style={{ flex: 1 }}
              onPress={() => router.push(`/mission/${encodeURIComponent(o.ref)}/fail`)}
              icone={<IcAlerte size={18} color={colors.text} />}>
              {t.probleme}
            </Bouton>
          ) : null}
        </View>
        {a.type === 'livraison' ? <Text style={[s.note, { color: colors.muted }, align]}>{t.numeroMasque}</Text> : null}
        {enFile ? <Bandeau ton="ambre" rtl={rtl}>{t.enFile}</Bandeau> : null}
      </ScrollView>

      {actionPossible ? (
        <View style={[s.bas, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Bouton testID="action-arret" variante={o.status === 'LIVRAISON' || o.status === 'RETRAIT' ? 'succes' : 'principal'} loading={occupe}
            icone={o.status === 'ASSIGNEE' || o.status === 'RECUPEREE' ? <IcNaviguer size={20} color="#fff" /> : undefined}
            onPress={action}>
            {libelleAction}
          </Bouton>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  plein: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  carte: { height: 300 },
  sansCarte: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  retour: { position: 'absolute', width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6 },
  etatArrivee: { position: 'absolute', left: 16, right: 16, bottom: 14 },
  contenu: { padding: 16, gap: 10, paddingBottom: 24 },
  entre: { justifyContent: 'space-between', alignItems: 'center' },
  nom: { fontSize: 24, fontWeight: '800' },
  adresse: { fontSize: 16 },
  puces: { gap: 8, flexWrap: 'wrap' },
  secondaires: { gap: 10, marginTop: 4 },
  note: { fontSize: 12 },
  bas: { paddingHorizontal: 16, paddingTop: 8 },
});
