// Preuve de livraison puis encaissement (maquette validée, acte 4).
//
// RÈGLE NON NÉGOCIABLE : un seul appel `driverProof()` qui regroupe `codCollected`,
// `photo` et `signature` sous une seule clé d'idempotence. Les deux écrans de la maquette
// sont deux ÉTAPES internes de cette route ; l'envoi reste unique. Ne jamais scinder.
//
// Encaissement : le montant attendu en grand, des montants proposés (exact, billets
// supérieurs) pour éviter la saisie, la monnaie à rendre calculée, et un bouton qui
// RÉPÈTE la somme reçue — impossible de valider le mauvais montant par réflexe.
import * as React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, Image } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Order } from '@transpo/domain';
import { proofRequirements, missingProof, money } from '@transpo/domain';
import { authedClient, idemKey } from '../../../lib/api';
import { readJson, writeJson } from '../../../lib/storage';
import { enqueue, applyPending } from '../../../lib/outbox';
import { useOutbox } from '../../../lib/useOutbox';
import { signatureToDataUri, isSignatureMeaningful, type Point } from '../../../lib/proof';
import { PrisePhoto } from '../../../components/PrisePhoto';
import { CACHE_MISSIONS } from '../../../lib/useJournee';
import { SignaturePad } from '../../../components/SignaturePad';
import { useTheme } from '../../../lib/theme';
import { useLanguage } from '../../../lib/i18n';
import { Bouton, Carte, Libelle, Pastille, useTon } from '../../../components/ui';
import { IcRetour, IcPhoto } from '../../../components/icones';

const SIGN_H = 180;

const T = {
  fr: {
    preuve: 'Preuve de livraison', encaissement: 'Encaissement',
    photo: 'Photo du colis remis', prise: '✓ Prise', prendre: 'Prendre la photo', reprendre: 'Reprendre', ouverture: 'Ouverture…',
    signature: 'Signature du destinataire', effacer: 'Effacer',
    valider: 'Valider la preuve', manquePhoto: 'Photo requise', manqueSig: 'Signature requise',
    aucune: 'Aucune preuve n’est exigée pour cette commande. Confirmez simplement la remise.',
    confirmerRemise: 'Confirmer la remise',
    aEncaisser: 'À encaisser', recu: 'Montant reçu', rendre: 'Monnaie à rendre', autre: 'Autre',
    confirmer: (m: string) => `Confirmer ${m} reçus`, saisir: 'Saisissez le montant reçu',
    incomplet: 'Preuve incomplète',
    bas: 'Montant inférieur',
    basCorps: (cod: string, recu: string) => `Le montant attendu est de ${cod}. Avec ${recu}, la commande sera livrée mais marquée non encaissée.`,
    corriger: 'Corriger', confirmerQuandMeme: 'Confirmer',
    introuvable: 'Commande introuvable', retour: 'Retour à ma journée',
    etape: (i: number, n: number) => `${i} / ${n}`,
  },
  ar: {
    preuve: 'إثبات التسليم', encaissement: 'التحصيل',
    photo: 'صورة الطرد المسلَّم', prise: '✓ تم', prendre: 'التقاط الصورة', reprendre: 'إعادة', ouverture: 'جارٍ الفتح…',
    signature: 'توقيع المستلم', effacer: 'مسح',
    valider: 'تأكيد الإثبات', manquePhoto: 'الصورة مطلوبة', manqueSig: 'التوقيع مطلوب',
    aucune: 'لا يُطلب أي إثبات لهذه الشحنة. أكّد التسليم فقط.',
    confirmerRemise: 'تأكيد التسليم',
    aEncaisser: 'المبلغ المطلوب', recu: 'المبلغ المستلم', rendre: 'الباقي', autre: 'آخر',
    confirmer: (m: string) => `تأكيد استلام ${m}`, saisir: 'أدخل المبلغ المستلم',
    incomplet: 'إثبات غير مكتمل',
    bas: 'مبلغ أقل',
    basCorps: (cod: string, recu: string) => `المبلغ المطلوب هو ${cod}. بمبلغ ${recu}، ستُسلَّم الشحنة لكنها ستُعتبر غير محصَّلة.`,
    corriger: 'تصحيح', confirmerQuandMeme: 'تأكيد',
    introuvable: 'الشحنة غير موجودة', retour: 'العودة إلى يومي',
    etape: (i: number, n: number) => `${i} / ${n}`,
  },
};

/** Montants proposés : l'exact, puis les billets ronds juste au-dessus. */
export function montantsProposes(du: number): number[] {
  const arr = (pas: number) => Math.ceil(du / pas) * pas;
  return Array.from(new Set([du, arr(50), arr(100), arr(200)])).filter((v) => v >= du).slice(0, 3);
}

export default function Preuve() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const refStr = String(ref);
  const { colors } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = T[lang];
  const insets = useSafeAreaInsets();
  const vert = useTon('vert');
  const ambre = useTon('ambre');
  const indigo = useTon('indigo');
  const row = { flexDirection: rtl ? 'row-reverse' as const : 'row' as const };
  const align = { textAlign: rtl ? 'right' as const : 'left' as const };

  const [missions, setMissions] = React.useState<Order[]>([]);
  const [chargement, setChargement] = React.useState(true);
  const [occupe, setOccupe] = React.useState(false);
  const [etape, setEtape] = React.useState<'preuve' | 'cod'>('preuve');
  const [recu, setRecu] = React.useState('');
  const [libre, setLibre] = React.useState(false);
  const [photo, setPhoto] = React.useState<string | null>(null);
  const [traits, setTraits] = React.useState<Point[][]>([]);
  const [prise, setPrise] = React.useState(false);
  const { pending, sync } = useOutbox();

  React.useEffect(() => {
    (async () => {
      try {
        const frais = await authedClient().getMissions();
        setMissions(frais);
        await writeJson(CACHE_MISSIONS, frais);
      } catch {
        setMissions(await readJson<Order[]>(CACHE_MISSIONS, []));
      } finally {
        setChargement(false);
      }
    })();
  }, []);

  const o = applyPending(missions, pending).find((x) => x.ref === refStr) ?? null;
  React.useEffect(() => { if (o && !recu) setRecu(o.cod > 0 ? String(o.cod) : ''); }, [o?.ref]); // eslint-disable-line react-hooks/exhaustive-deps

  const exigees = o ? proofRequirements(o.proofLevel) : [];
  const signature = isSignatureMeaningful(traits) ? signatureToDataUri(traits, 320, SIGN_H) : null;
  const besoinPhoto = exigees.includes('photo');
  const besoinSig = exigees.includes('signature');
  const complete = (!besoinPhoto || !!photo) && (!besoinSig || !!signature);
  const nbEtapes = o && o.cod > 0 && !o.codPaid ? 2 : 1;

  async function envoyer() {
    if (!o) return;
    setOccupe(true);
    try {
      await enqueue({
        // Ce qui reste en caisse : le dû, pas le billet tendu (la monnaie est rendue).
        kind: 'proof', ref: o.ref, codCollected: Math.min(Number(recu) || 0, o.cod), idemKey: idemKey(o.ref, 'proof'),
        photo: photo ?? undefined, signature: signature ?? undefined,
      });
      await sync();
      router.replace(`/mission/${encodeURIComponent(o.ref)}/done?cod=${o.cod > 0 ? Math.min(Number(recu) || 0, o.cod) : 0}`);
    } finally {
      setOccupe(false);
    }
  }

  function photographier() {
    setPrise(true);
  }

  function validerPreuve() {
    if (!o) return;
    // Même règle que l'API, appliquée avant l'envoi : hors ligne, le refus arriverait tard.
    const manque = missingProof(o.proofLevel, { photo, signature });
    if (manque) { Alert.alert(t.incomplet, manque); return; }
    if (o.cod > 0 && !o.codPaid) setEtape('cod');
    else void envoyer();
  }

  function confirmerEncaissement() {
    if (!o) return;
    const montant = Number(recu) || 0;
    if (montant < o.cod) {
      Alert.alert(t.bas, t.basCorps(money(o.cod), money(montant)), [
        { text: t.corriger, style: 'cancel' },
        { text: t.confirmerQuandMeme, onPress: () => void envoyer() },
      ]);
      return;
    }
    void envoyer();
  }

  function touche(k: string) {
    setLibre(true);
    setRecu((v) => {
      if (k === '⌫') return v.slice(0, -1);
      if (k === ',') return v; // espèces : dirhams entiers
      const n = (v === '0' ? '' : v) + k;
      return n.length > 6 ? v : n;
    });
  }

  if (chargement) {
    return <View style={[s.centre, { backgroundColor: colors.bg }]}><ActivityIndicator color={colors.indigo9} size="large" /></View>;
  }
  if (!o) {
    return (
      <View style={[s.centre, { backgroundColor: colors.bg, padding: 24, gap: 12 }]}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{t.introuvable}</Text>
        <Bouton onPress={() => router.replace('/(tabs)/journee')} style={{ alignSelf: 'stretch' }}>{t.retour}</Bouton>
      </View>
    );
  }

  const entete = (titre: string, i: number, retour: () => void) => (
    <View style={[row, s.entete, { paddingTop: insets.top + 6 }]}>
      <Pressable onPress={retour} style={s.retour} accessibilityRole="button" accessibilityLabel="Retour">
        <View style={{ transform: [{ scaleX: rtl ? -1 : 1 }] }}><IcRetour size={24} color={colors.text} /></View>
      </Pressable>
      <Text style={[s.titre, { color: colors.text, flex: 1 }, align]}>{titre}</Text>
      <Pastille ton="gris">{t.etape(i, nbEtapes)}</Pastille>
    </View>
  );

  // ------------------------------------------------------------ encaissement
  if (etape === 'cod') {
    const montant = Number(recu) || 0;
    const rendu = Math.max(0, montant - o.cod);
    const proposes = montantsProposes(o.cod);
    return (
      <View style={[s.plein, { backgroundColor: colors.bg }]}>
        <Stack.Screen options={{ headerShown: false }} />
        {entete(t.encaissement, 2, () => setEtape('preuve'))}
        <ScrollView contentContainerStyle={s.contenu}>
          <View style={[s.aEncaisser, { backgroundColor: ambre.doux }]}>
            <Libelle style={{ color: ambre.texte, textAlign: 'center' }}>{t.aEncaisser}</Libelle>
            <Text style={[s.gros, { color: ambre.texte }]}>{money(o.cod)}</Text>
          </View>
          <Carte>
            <Libelle rtl={rtl}>{t.recu}</Libelle>
            <Text testID="cod-montant-recu" style={[s.recu, { color: montant ? colors.text : colors.muted }, align]}>
              {montant ? money(montant) : t.saisir}
            </Text>
            <View style={[s.sep, { backgroundColor: colors.border }]} />
            <View style={[row, s.entre]}>
              <Text style={{ color: colors.text, fontSize: 17 }}>{t.rendre}</Text>
              <Text style={{ color: vert.texte, fontSize: 17, fontWeight: '800' }}>{money(rendu)}</Text>
            </View>
          </Carte>
          <View style={[row, s.puces]}>
            {proposes.map((v) => {
              const on = !libre && montant === v;
              return (
                <Pressable key={v} onPress={() => { setLibre(false); setRecu(String(v)); }} accessibilityRole="button"
                  style={[s.puce, { borderColor: on ? colors.indigo9 : colors.border, backgroundColor: on ? indigo.doux : colors.panel }]}>
                  <Text style={{ color: on ? indigo.texte : colors.text, fontWeight: '700', fontSize: 16 }}>{v}</Text>
                </Pressable>
              );
            })}
            <Pressable onPress={() => { setLibre(true); setRecu(''); }} accessibilityRole="button"
              style={[s.puce, { borderColor: libre ? colors.indigo9 : colors.border, backgroundColor: libre ? indigo.doux : colors.panel }]}>
              <Text style={{ color: libre ? indigo.texte : colors.text, fontWeight: '700', fontSize: 16 }}>{t.autre}</Text>
            </Pressable>
          </View>
          {libre ? (
            <View style={s.clavier}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) => (
                k ? (
                  <Pressable key={i} onPress={() => touche(k)} accessibilityRole="button" accessibilityLabel={k === '⌫' ? 'Effacer' : k}
                    style={({ pressed }) => [s.touche, { backgroundColor: colors.panel, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
                    <Text style={{ color: colors.text, fontSize: 22, fontWeight: '600' }}>{k}</Text>
                  </Pressable>
                ) : <View key={i} style={s.touche} />
              ))}
            </View>
          ) : null}
        </ScrollView>
        <View style={[s.bas, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Bouton testID="confirmer-encaissement" variante="succes" loading={occupe} disabled={montant <= 0} onPress={confirmerEncaissement}>
            {montant > 0 ? t.confirmer(money(montant)) : t.saisir}
          </Bouton>
        </View>
      </View>
    );
  }

  // ------------------------------------------------------------ preuve
  return (
    <View style={[s.plein, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {entete(t.preuve, 1, () => router.back())}
      <ScrollView contentContainerStyle={s.contenu} scrollEnabled={traits.length === 0 || !besoinSig}>
        {!besoinPhoto && !besoinSig ? <Carte><Text style={[{ color: colors.text, fontSize: 15 }, align]}>{t.aucune}</Text></Carte> : null}
        {besoinPhoto ? (
          <Carte>
            <View style={[row, s.entre]}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{t.photo}</Text>
              {photo ? <Pastille ton="vert">{t.prise}</Pastille> : null}
            </View>
            {photo ? (
              <Pressable onPress={photographier} disabled={prise} accessibilityRole="button" accessibilityLabel={t.reprendre}>
                <Image source={{ uri: photo }} style={s.apercu} resizeMode="cover" />
                <Text style={[{ color: colors.indigo9, fontWeight: '700', marginTop: 8 }, align]}>{prise ? t.ouverture : t.reprendre}</Text>
              </Pressable>
            ) : (
              <Pressable onPress={photographier} disabled={prise} accessibilityRole="button" testID="prendre-photo"
                style={[s.zonePhoto, { borderColor: colors.indigo9 }]}>
                {prise ? <ActivityIndicator color={colors.indigo9} /> : (
                  <><IcPhoto size={30} color={colors.indigo9} /><Text style={{ color: colors.indigo9, fontWeight: '700', fontSize: 16 }}>{t.prendre}</Text></>
                )}
              </Pressable>
            )}
          </Carte>
        ) : null}
        {besoinSig ? (
          <Carte>
            <View style={[row, s.entre, { marginBottom: 10 }]}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{t.signature}</Text>
              {traits.length ? <Pressable onPress={() => setTraits([])} hitSlop={12}><Text style={{ color: colors.muted }}>{t.effacer}</Text></Pressable> : null}
            </View>
            <SignaturePad strokes={traits} onChange={setTraits} height={SIGN_H} />
            {o.dropContact ? <Text style={[{ color: colors.muted, fontSize: 12, marginTop: 6 }, align]}>{o.dropContact}</Text> : null}
          </Carte>
        ) : null}
      </ScrollView>
      <PrisePhoto visible={prise} lang={lang} onFermer={() => setPrise(false)}
        onPhoto={(uri) => { setPhoto(uri); setPrise(false); }}
        onErreur={(m) => { setPrise(false); Alert.alert(t.incomplet, m); }} />
      <View style={[s.bas, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Bouton testID="valider-preuve" loading={occupe} disabled={!complete} onPress={validerPreuve}>
          {besoinPhoto && !photo ? t.manquePhoto : besoinSig && !signature ? t.manqueSig : !besoinPhoto && !besoinSig ? t.confirmerRemise : t.valider}
        </Bouton>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  plein: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  entete: { alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingBottom: 8 },
  retour: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  titre: { fontSize: 22, fontWeight: '800' },
  contenu: { padding: 16, gap: 12, paddingBottom: 24 },
  entre: { justifyContent: 'space-between', alignItems: 'center' },
  apercu: { width: '100%', height: 170, borderRadius: 12, marginTop: 10 },
  zonePhoto: { marginTop: 10, height: 150, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 8 },
  aEncaisser: { borderRadius: 18, padding: 16, alignItems: 'center' },
  gros: { fontSize: 36, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 2 },
  recu: { fontSize: 30, fontWeight: '800', marginTop: 4, fontVariant: ['tabular-nums'] },
  sep: { height: 1, marginVertical: 12 },
  puces: { gap: 8, flexWrap: 'wrap' },
  puce: { minHeight: 48, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  clavier: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  touche: { width: '31.5%', height: 54, borderRadius: 14, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  bas: { paddingHorizontal: 16, paddingTop: 8 },
});
