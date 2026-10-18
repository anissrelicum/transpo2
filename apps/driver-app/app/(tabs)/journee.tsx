// Ma journée — l'écran principal (maquette validée, design/app-livreur/maquette.html, acte 2).
//
// Avant le démarrage : ce qui attend le livreur et un seul bouton, « Démarrer ma journée »
// (disponible pour l'affectation automatique + partage de position + compteur de conduite).
// Ensuite : la carte de la tournée, et en bas le PROCHAIN ARRÊT avec une seule action
// principale. Les missions proposées arrivent par-dessus la carte.
import * as React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { money, STATUS_META } from '@transpo/domain';
import { useTheme } from '../../lib/theme';
import { useLanguage } from '../../lib/i18n';
import { getSession } from '../../lib/api';
import { useJournee } from '../../lib/useJournee';
import { useService, demarrerJournee } from '../../lib/service';
import { distanceKm, distanceTournee, estArrive, formatDistance, minutesEstimees, type Arret } from '../../lib/journee';
import { ouvrirItineraire, partirEnRoute, appeler } from '../../lib/etapes';
import { CarteJournee, type CarteJourneeRef, type PointCarte } from '../../components/CarteJournee';
import { PropositionMission } from '../../components/PropositionMission';
import { Bouton, Carte, Libelle, Pastille, Bandeau } from '../../components/ui';
import { IcNaviguer, IcTel, IcPin, IcHorsReseau, IcCentrer, IcCheck } from '../../components/icones';

const T = {
  fr: {
    bonjour: (n: string) => (n ? `Bonjour ${n.split(' ')[0]}` : 'Bonjour'),
    horsService: 'Hors service', enService: 'En service',
    aujourdhui: 'Aujourd’hui', missions: 'missions prévues', aRetirer: 'colis à retirer', estimes: 'estimés',
    caisse: 'Caisse', caisseVide: 'démarre vide',
    premier: (a: string, d: string) => `Premier arrêt : ${a}${d ? `, à ${d}` : ''}`,
    aucune: 'Aucune mission pour l’instant. Démarrez : les missions proposées arriveront ici.',
    demarrer: 'Démarrer ma journée',
    restants: 'Restants', enCaisse: 'En caisse',
    prochain: (i: number, n: number) => `Prochain arrêt · ${i} sur ${n}`,
    retrait: 'Retrait', livraison: 'Livraison',
    naviguer: 'Naviguer', ouvrir: 'Ouvrir l’arrêt', arrive: 'Vous êtes arrivé',
    signature: 'Signature exigée', photo: 'Photo exigée', photoSig: 'Photo + signature',
    rien: 'Plus d’arrêt pour le moment', rienSub: 'Restez en service : les missions proposées s’afficheront ici.',
    horsReseau: (n: number) => `Hors réseau${n ? ` · ${n} action(s) en attente` : ''} — tout reste utilisable`,
    enAttente: (n: number) => `${n} action(s) en attente d’envoi`,
    refus: (c: number) => `Le serveur a refusé la demande (${c}).`,
    navKo: 'Aucune application de carte n’a pu ouvrir cet itinéraire.',
    sansPos: 'Adresse sans position GPS',
    appeler: 'Appeler', colisN: (n: number) => `${n} colis`,
  },
  ar: {
    bonjour: (n: string) => (n ? `مرحباً ${n.split(' ')[0]}` : 'مرحباً'),
    horsService: 'خارج الخدمة', enService: 'في الخدمة',
    aujourdhui: 'اليوم', missions: 'مهام مبرمجة', aRetirer: 'طرود للاستلام', estimes: 'تقديرياً',
    caisse: 'الصندوق', caisseVide: 'يبدأ فارغاً',
    premier: (a: string, d: string) => `المحطة الأولى: ${a}${d ? `، على بعد ${d}` : ''}`,
    aucune: 'لا توجد مهام حالياً. ابدأ يومك: ستصلك المهام المقترحة هنا.',
    demarrer: 'ابدأ يومي',
    restants: 'المتبقي', enCaisse: 'في الصندوق',
    prochain: (i: number, n: number) => `المحطة التالية · ${i} من ${n}`,
    retrait: 'استلام', livraison: 'تسليم',
    naviguer: 'الملاحة', ouvrir: 'فتح المحطة', arrive: 'لقد وصلت',
    signature: 'التوقيع مطلوب', photo: 'الصورة مطلوبة', photoSig: 'صورة + توقيع',
    rien: 'لا توجد محطات حالياً', rienSub: 'ابقَ في الخدمة: ستظهر المهام المقترحة هنا.',
    horsReseau: (n: number) => `بدون شبكة${n ? ` · ${n} إجراء في الانتظار` : ''} — كل شيء يبقى قابلاً للاستعمال`,
    enAttente: (n: number) => `${n} إجراء في انتظار الإرسال`,
    refus: (c: number) => `رفض الخادم الطلب (${c}).`,
    navKo: 'لم يتمكن أي تطبيق خرائط من فتح هذا المسار.',
    sansPos: 'عنوان بدون موقع GPS',
    appeler: 'اتصال', colisN: (n: number) => `${n} طرود`,
  },
};

export function libellePreuve(level: string, t: (typeof T)['fr'] | (typeof T)['ar']): string | null {
  if (level === 'signature') return t.signature;
  if (level === 'photo') return t.photo;
  if (level === 'photo_signature') return t.photoSig;
  return null;
}

const HAUTEUR_FEUILLE = 250;

export default function Journee() {
  const { colors, mode } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = T[lang];
  const insets = useSafeAreaInsets();
  const j = useJournee({ offres: true });
  const { etat, pret } = useService();
  const carte = React.useRef<CarteJourneeRef>(null);
  const [demarrage, setDemarrage] = React.useState(false);
  const row = { flexDirection: rtl ? 'row-reverse' as const : 'row' as const };
  const align = { textAlign: rtl ? 'right' as const : 'left' as const };

  const prochain: Arret | undefined = j.arrets[0];
  const moi = j.moi ? { lat: j.moi.lat, lng: j.moi.lng } : null;

  const points: PointCarte[] = React.useMemo(
    () => j.arrets.flatMap((a, i) => (a.pos ? [{ ref: a.order.ref, lat: a.pos.lat, lng: a.pos.lng, n: i + 1, etat: i === 0 ? 'prochain' as const : 'avenir' as const }] : [])),
    [j.arrets],
  );

  const offre = j.offres[0];
  const lireOffres = j.lireOffres;
  const onExpiree = React.useCallback(() => { setTimeout(() => { void lireOffres(); }, 3000); }, [lireOffres]);

  async function naviguer(a: Arret) {
    // Toucher « Naviguer » met la mission en route : le client est prévenu au bon moment.
    let parti = false;
    for (const c of a.commandes) parti = (await partirEnRoute(c)) || parti;
    if (parti) void j.sync();
    const ok = await ouvrirItineraire(a.pos?.lat ?? null, a.pos?.lng ?? null, a.lienCarte, a.adresse);
    if (!ok) Alert.alert(t.naviguer, t.navKo);
  }

  if (j.chargement || !pret) {
    return <View style={[s.centre, { backgroundColor: colors.bg }]}><ActivityIndicator color={colors.indigo9} size="large" /></View>;
  }

  // ------------------------------------------------------------ avant le démarrage
  if (!etat.active) {
    const aRetirer = j.arrets.filter((a) => a.type === 'retrait').reduce((n, a) => n + a.commandes.length, 0);
    const km = distanceTournee(moi, j.arrets);
    const d0 = prochain?.pos && moi ? formatDistance(distanceKm(moi, prochain.pos), lang) : '';
    return (
      <View style={[s.plein, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={s.contenu}>
          <View style={[row, s.haut]}>
            <Text style={[s.titre, { color: colors.text }]}>{t.bonjour(getSession()?.name ?? '')}</Text>
            <Pastille ton="gris" point>{t.horsService}</Pastille>
          </View>
          <Carte>
            <Libelle rtl={rtl}>{t.aujourdhui}</Libelle>
            <View style={[row, { marginTop: 10, gap: 10 }]}>
              <Chiffre valeur={String(j.missions.filter((o) => !['LIVREE', 'ANNULEE', 'ECHOUEE', 'RETOUR'].includes(o.status)).length)} legende={t.missions} rtl={rtl} />
              <Chiffre valeur={String(aRetirer)} legende={t.aRetirer} rtl={rtl} />
              <Chiffre valeur={km > 0 ? `~${Math.round(km)} ${lang === 'ar' ? 'كم' : 'km'}` : '—'} legende={t.estimes} rtl={rtl} />
            </View>
          </Carte>
          <Carte>
            <View style={[row, s.entre]}>
              <View>
                <Libelle rtl={rtl}>{t.caisse}</Libelle>
                <Text style={[s.valeur, { color: colors.text }, align]}>{money(j.caisse?.theorique ?? 0)}</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{j.caisse?.theorique ? '' : t.caisseVide}</Text>
            </View>
          </Carte>
          {prochain ? (
            <Bandeau ton="indigo" rtl={rtl}>{t.premier(prochain.contact ?? prochain.adresse, d0)}</Bandeau>
          ) : (
            <Bandeau ton="gris" rtl={rtl}>{t.aucune}</Bandeau>
          )}
          {j.perime && <Bandeau ton="ambre" rtl={rtl}>{t.horsReseau(j.pending.length)}</Bandeau>}
        </ScrollView>
        <View style={s.bas}>
          <Bouton testID="demarrer-journee" variante="succes" loading={demarrage}
            onPress={async () => { setDemarrage(true); try { await demarrerJournee(); } finally { setDemarrage(false); } }}>
            {t.demarrer}
          </Bouton>
        </View>
        {offre && <PropositionMission key={offre.id} offre={offre} decalage={j.decalage} lang={lang} rtl={rtl}
          enAttente={j.pending.some((p) => p.kind === 'offer' && p.offerId === offre.id)}
          onRepondre={(d) => { void j.repondre(offre, d); }} onExpiree={onExpiree} />}
      </View>
    );
  }

  // ------------------------------------------------------------ en service
  const arrive = prochain ? estArrive(moi, prochain) : false;
  const dist = prochain?.pos && moi ? distanceKm(moi, prochain.pos) : null;
  const preuve = prochain ? libellePreuve(prochain.order.proofLevel, t) : null;
  const encaisse = j.caisse?.theorique ?? 0;

  return (
    <View style={[s.plein, { backgroundColor: colors.bg }]}>
      <CarteJournee ref={carte} points={points} moi={moi} sombre={mode === 'dark'} bas={HAUTEUR_FEUILLE}
        onArret={(ref) => router.push(`/mission/${encodeURIComponent(ref)}`)} />

      <View style={[s.flottant, row, { top: insets.top + 8 }]} pointerEvents="box-none">
        <Carte style={s.mini}><Libelle rtl={rtl}>{t.restants}</Libelle><Text style={[s.miniVal, { color: colors.text }, align]}>{j.arrets.length}</Text></Carte>
        <Carte style={s.mini}><Libelle rtl={rtl}>{t.enCaisse}</Libelle><Text style={[s.miniVal, { color: colors.text }, align]} numberOfLines={1}>{money(encaisse)}</Text></Carte>
        <Carte style={[s.mini, { flex: 0, justifyContent: 'center' }]}><Pastille ton="vert" point>{t.enService}</Pastille></Carte>
      </View>

      <View style={[s.bandeaux, { top: insets.top + 84 }]}>
        {!j.online || j.perime ? (
          <Pressable onPress={() => router.push('/sync-queue')} style={[s.horsReseau, row]} accessibilityRole="button">
            <IcHorsReseau size={18} color="#fff" />
            <Text style={[s.horsReseauTxt, align]}>{t.horsReseau(j.pending.length)}</Text>
          </Pressable>
        ) : j.pending.length > 0 ? (
          <Bandeau ton="indigo" rtl={rtl} onPress={() => router.push('/sync-queue')}>{t.enAttente(j.pending.length)}</Bandeau>
        ) : null}
        {j.erreurServeur ? <Bandeau ton="rouge" rtl={rtl}>{t.refus(j.erreurServeur)}</Bandeau> : null}
      </View>

      <Pressable onPress={() => carte.current?.recadrer()} accessibilityLabel="Recentrer"
        style={[s.recentrer, { backgroundColor: colors.panel, borderColor: colors.border, bottom: HAUTEUR_FEUILLE + 12, [rtl ? 'left' : 'right']: 16 }]}>
        <IcCentrer size={22} color={colors.text} />
      </Pressable>

      <View style={[s.feuille, { backgroundColor: colors.panel }]}>
        <View style={[s.poignee, { backgroundColor: colors.border }]} />
        {prochain ? (
          <>
            <Pressable onPress={() => router.push(`/mission/${encodeURIComponent(prochain.order.ref)}`)} testID="prochain-arret">
              <View style={[row, s.entre]}>
                <Libelle rtl={rtl}>{t.prochain(1, j.arrets.length)}</Libelle>
                {prochain.type === 'livraison' && prochain.order.cod > 0 && !prochain.order.codPaid
                  ? <Pastille ton="ambre">{`COD ${money(prochain.order.cod)}`}</Pastille> : null}
              </View>
              <Text style={[s.nom, { color: colors.text }, align]} numberOfLines={1}>
                {(prochain.contact ?? prochain.order.ref)} · {prochain.type === 'retrait' ? t.retrait : t.livraison}
              </Text>
              <Text style={[s.adresse, { color: colors.muted }, align]} numberOfLines={1}>{prochain.adresse}</Text>
              <View style={[row, s.puces]}>
                {arrive ? <Pastille ton="vert" point>{t.arrive}</Pastille>
                  : dist != null ? <Pastille ton="indigo">{`~${minutesEstimees(dist)} min · ${formatDistance(dist, lang)}`}</Pastille>
                  : !prochain.pos ? <Pastille ton="gris">{t.sansPos}</Pastille> : null}
                {prochain.commandes.length > 1 ? <Pastille ton="indigo">{t.colisN(prochain.commandes.length)}</Pastille> : null}
                {prochain.type === 'livraison' && preuve ? <Pastille ton="gris">{preuve}</Pastille> : null}
                <Pastille ton="gris">{lang === 'ar' ? STATUS_META[prochain.order.status].ar : STATUS_META[prochain.order.status].fr}</Pastille>
              </View>
            </Pressable>
            <View style={[row, s.actions]}>
              {arrive ? (
                <Bouton testID="ouvrir-arret" variante="succes" style={{ flex: 1 }} icone={<IcCheck size={22} color="#fff" />}
                  onPress={() => router.push(`/mission/${encodeURIComponent(prochain.order.ref)}`)}>{t.ouvrir}</Bouton>
              ) : (
                <Bouton testID="naviguer" style={{ flex: 1 }} icone={<IcNaviguer size={20} color="#fff" />} onPress={() => naviguer(prochain)}>
                  {t.naviguer}
                </Bouton>
              )}
              {prochain.telephone ? (
                <Bouton variante="secondaire" style={s.carre} onPress={() => appeler(prochain.telephone!)}>
                  <IcTel size={22} color={colors.text} />
                </Bouton>
              ) : null}
            </View>
          </>
        ) : (
          <View style={{ paddingVertical: 8, gap: 6 }}>
            <View style={[row, { gap: 8, alignItems: 'center' }]}><IcPin size={20} color={colors.muted} /><Text style={[s.nom, { color: colors.text, marginTop: 0 }]}>{t.rien}</Text></View>
            <Text style={[s.adresse, { color: colors.muted }, align]}>{t.rienSub}</Text>
          </View>
        )}
      </View>

      {offre && <PropositionMission key={offre.id} offre={offre} decalage={j.decalage} lang={lang} rtl={rtl}
        enAttente={j.pending.some((p) => p.kind === 'offer' && p.offerId === offre.id)}
        onRepondre={(d) => { void j.repondre(offre, d); }} onExpiree={onExpiree} />}
    </View>
  );
}

function Chiffre({ valeur, legende, rtl }: { valeur: string; legende: string; rtl: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text, textAlign: rtl ? 'right' : 'left' }}>{valeur}</Text>
      <Text style={{ fontSize: 13, color: colors.muted, textAlign: rtl ? 'right' : 'left' }}>{legende}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  plein: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  contenu: { padding: 16, gap: 12 },
  haut: { alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  titre: { fontSize: 24, fontWeight: '800' },
  entre: { justifyContent: 'space-between', alignItems: 'center' },
  valeur: { fontSize: 17, fontWeight: '700', marginTop: 4 },
  bas: { padding: 16, paddingBottom: 20 },
  flottant: { position: 'absolute', left: 12, right: 12, gap: 8 },
  mini: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14 },
  miniVal: { fontSize: 17, fontWeight: '800', marginTop: 2 },
  bandeaux: { position: 'absolute', left: 12, right: 12, gap: 8 },
  horsReseau: { backgroundColor: '#0B1537', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, gap: 8, alignItems: 'center' },
  horsReseauTxt: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },
  recentrer: { position: 'absolute', width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  feuille: {
    position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: HAUTEUR_FEUILLE, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16,
    shadowColor: '#0B1537', shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: -6 }, elevation: 12,
  },
  poignee: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 10 },
  nom: { fontSize: 21, fontWeight: '800', marginTop: 6 },
  adresse: { fontSize: 15, marginTop: 2 },
  puces: { gap: 8, marginTop: 10, flexWrap: 'wrap' },
  actions: { gap: 10, marginTop: 14 },
  carre: { width: 64, paddingHorizontal: 0 },
});
