// Scanner en série (maquette validée, acte 3) : la caméra reste ouverte, on enchaîne les
// colis, chaque scan vibre et coche la liste. Le colis manquant se voit avant de partir.
//
// Lecture réelle (expo-camera) d'un QR ou d'un code-barres : le contenu est accepté s'il
// porte le code de suivi à 8 caractères ou la référence de la commande — y compris dans un
// lien de suivi. La saisie manuelle reste là pour une étiquette abîmée.
//
// Les DONNÉES sont les missions du livreur (pas un jeu de démonstration). Au RETRAIT,
// scanner un colis, c'est l'avoir en main : la mission passe « Récupérée », par la file
// hors ligne (rejeu dédoublonné par la clé d'idempotence).
import * as React from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Vibration } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import type { Order } from '@transpo/domain';
import { useTheme } from '../../lib/theme';
import { useLanguage } from '../../lib/i18n';
import { authedClient, idemKey } from '../../lib/api';
import { readJson, writeJson } from '../../lib/storage';
import { enqueue, applyPending } from '../../lib/outbox';
import { useOutbox } from '../../lib/useOutbox';
import { CACHE_MISSIONS } from '../../lib/useJournee';
import { Bouton, Pastille, MARQUE, useTon } from '../../components/ui';
import { IcCheck } from '../../components/icones';

const PHASE_STATUTS = { retrait: ['ASSIGNEE', 'RETRAIT'], livraison: ['RECUPEREE', 'LIVRAISON'] } as const;
type Phase = 'retrait' | 'livraison';
type Colis = { code: string; ref: string; nom: string; taille: string; fragile: boolean };
type Retour = { type: 'ok' | 'deja' | 'inconnu'; colis?: Colis; code: string };

const T = {
  fr: {
    retrait: 'Retrait', livraison: 'Dans le véhicule', viser: 'Visez l’étiquette du colis', lampe: 'Lampe',
    scannes: (n: number, t: number) => `${n} sur ${t} scannés`, aTrouver: 'à trouver', scanne: 'scanné',
    ok: (n: string) => `✓ ${n}`, deja: 'Déjà scanné', inconnu: (c: string) => `Colis hors tournée : ${c}`,
    saisir: 'Saisir un code', code: 'Code à 8 caractères', valider: 'Valider', terminer: (n: number) => `Terminer (${n})`,
    vide: 'Aucun colis à scanner pour cette étape.', manque: (n: number) => `${n} colis manquant(s) — à trouver avant de partir.`,
    permission: 'L’appareil photo sert à lire les étiquettes.', autoriser: 'Autoriser l’appareil photo',
    fragile: 'fragile',
  },
  ar: {
    retrait: 'الاستلام', livraison: 'في المركبة', viser: 'وجّه الكاميرا نحو ملصق الطرد', lampe: 'المصباح',
    scannes: (n: number, t: number) => `${n} من ${t} تم مسحها`, aTrouver: 'للبحث', scanne: 'تم المسح',
    ok: (n: string) => `✓ ${n}`, deja: 'تم مسحه من قبل', inconnu: (c: string) => `طرد خارج الجولة: ${c}`,
    saisir: 'إدخال رمز', code: 'رمز من 8 خانات', valider: 'تأكيد', terminer: (n: number) => `إنهاء (${n})`,
    vide: 'لا يوجد طرد للمسح في هذه المرحلة.', manque: (n: number) => `${n} طرد ناقص — ابحث عنه قبل الانطلاق.`,
    permission: 'تُستعمل الكاميرا لقراءة الملصقات.', autoriser: 'السماح بالكاميرا',
    fragile: 'قابل للكسر',
  },
};

/** Extrait d'un contenu scanné le code de suivi ou la référence d'une commande connue. */
export function reconnaitre(contenu: string, commandes: Pick<Order, 'code' | 'ref'>[]): string | null {
  const brut = contenu.trim().toUpperCase();
  for (const o of commandes) {
    if (brut === o.code.toUpperCase() || brut === o.ref.toUpperCase()) return o.code;
  }
  for (const o of commandes) {
    if (brut.includes(o.ref.toUpperCase()) || new RegExp(`(^|[^A-Z0-9])${o.code.toUpperCase()}([^A-Z0-9]|$)`).test(brut)) return o.code;
  }
  const seul = brut.match(/^[A-Z0-9]{8}$/);
  return seul ? seul[0] : null;
}

export default function Scanner() {
  const { colors } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = T[lang];
  const insets = useSafeAreaInsets();
  const vert = useTon('vert');
  const ambre = useTon('ambre');
  const rouge = useTon('rouge');
  const row = { flexDirection: rtl ? 'row-reverse' as const : 'row' as const };
  const align = { textAlign: rtl ? 'right' as const : 'left' as const };

  const [permission, demander] = useCameraPermissions();
  const [actif, setActif] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>('retrait');
  const [scannes, setScannes] = React.useState<string[]>([]);
  const [retour, setRetour] = React.useState<Retour | null>(null);
  const [lampe, setLampe] = React.useState(false);
  const [manuel, setManuel] = React.useState<string | null>(null);
  const [missions, setMissions] = React.useState<Order[]>([]);
  const dernier = React.useRef<{ code: string; at: number } | null>(null);
  const { pending, sync } = useOutbox();

  const recharger = React.useCallback(async () => {
    try {
      const frais = await authedClient().getMissions();
      setMissions(frais);
      await writeJson(CACHE_MISSIONS, frais);
    } catch {
      setMissions(await readJson<Order[]>(CACHE_MISSIONS, []));
    }
  }, []);

  // La caméra ne tourne que sur cet onglet : ailleurs elle viderait la batterie.
  useFocusEffect(React.useCallback(() => {
    void recharger();
    setActif(true);
    return () => { setActif(false); setLampe(false); };
  }, [recharger]));

  const vue = applyPending(missions, pending);
  const colis: Colis[] = vue
    .filter((o) => (PHASE_STATUTS[phase] as readonly string[]).includes(o.status))
    .map((o) => ({ code: o.code, ref: o.ref, nom: o.dropContact || o.merchant || o.ref, taille: o.size, fragile: !!o.fragile }));
  // Au retrait, un colis scanné change d'étape et quitte la liste : il reste compté comme fait.
  const sortis = scannes.filter((c) => !colis.some((i) => i.code === c));
  const fait = colis.filter((i) => scannes.includes(i.code)).length + sortis.length;
  const total = colis.length + sortis.length;
  const manquants = colis.filter((i) => !scannes.includes(i.code));

  React.useEffect(() => {
    if (!retour || retour.type !== 'ok') return;
    const id = setTimeout(() => setRetour(null), 1800);
    return () => clearTimeout(id);
  }, [retour]);

  async function enregistrerRetrait(c: Colis) {
    const o = vue.find((x) => x.ref === c.ref);
    if (!o) return;
    const chemin = o.status === 'ASSIGNEE' ? ['ASSIGNEE', 'RETRAIT'] : ['RETRAIT'];
    for (const depuis of chemin) {
      await enqueue({ kind: 'advance', ref: o.ref, from: depuis as Order['status'], idemKey: idemKey(o.ref, `advance-${depuis}`) });
    }
    await sync();
    await recharger();
  }

  function traiter(code: string) {
    const c = colis.find((i) => i.code === code);
    if (c && !scannes.includes(code)) {
      Vibration.vibrate(60);
      setScannes((l) => [code, ...l]);
      setRetour({ type: 'ok', colis: c, code });
      if (phase === 'retrait') void enregistrerRetrait(c);
      return;
    }
    Vibration.vibrate([0, 80, 80, 80]);
    const connu = c ?? vue.find((o) => o.code === code);
    setRetour(connu ? { type: 'deja', code } : { type: 'inconnu', code });
  }

  function lu(r: BarcodeScanningResult) {
    const code = reconnaitre(r.data, vue);
    if (!code) return;
    // Le même code reste devant l'objectif plusieurs images de suite : une lecture suffit.
    const now = Date.now();
    if (dernier.current && dernier.current.code === code && now - dernier.current.at < 2500) return;
    dernier.current = { code, at: now };
    traiter(code);
  }

  const couleurRetour = retour?.type === 'ok' ? vert : retour?.type === 'deja' ? ambre : rouge;

  return (
    <View style={[s.plein, { backgroundColor: '#000' }]}>
      <View style={[s.camera, { paddingTop: insets.top }]}>
        {permission?.granted && actif ? (
          <CameraView style={StyleSheet.absoluteFill} facing="back" enableTorch={lampe}
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'datamatrix'] }}
            onBarcodeScanned={lu} />
        ) : (
          <View style={[StyleSheet.absoluteFill, s.sansCamera]}>
            <Text style={{ color: '#fff', textAlign: 'center', marginBottom: 12 }}>{t.permission}</Text>
            {permission && !permission.granted ? <Bouton variante="marque" petit onPress={() => void demander()}>{t.autoriser}</Bouton> : null}
          </View>
        )}
        <View style={[row, s.barreHaut, { top: insets.top + 8 }]}>
          <View style={[row, s.segment]}>
            {(['retrait', 'livraison'] as const).map((p) => (
              <Pressable key={p} onPress={() => { setPhase(p); setScannes([]); setRetour(null); }} accessibilityRole="tab"
                accessibilityState={{ selected: phase === p }} style={[s.segBtn, phase === p && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{p === 'retrait' ? t.retrait : t.livraison}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => setLampe((v) => !v)} accessibilityRole="button" style={[s.segBtn, { backgroundColor: lampe ? MARQUE.amber : 'rgba(255,255,255,0.14)' }]}>
            <Text style={{ color: lampe ? MARQUE.navy : '#fff', fontWeight: '700' }}>⚡ {t.lampe}</Text>
          </Pressable>
        </View>
        <View style={s.cadre} pointerEvents="none" />
        <Text style={s.viser}>{t.viser}</Text>
      </View>

      <View style={[s.panneau, { backgroundColor: colors.bg }]}>
        <View style={[row, s.entre]}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{t.scannes(fait, total)}</Text>
          {retour ? (
            <View style={[s.retour, { backgroundColor: couleurRetour.doux }]}>
              <Text style={{ color: couleurRetour.texte, fontWeight: '700' }} numberOfLines={1}>
                {retour.type === 'ok' ? t.ok(retour.colis?.nom ?? retour.code) : retour.type === 'deja' ? t.deja : t.inconnu(retour.code)}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={[s.progres, { backgroundColor: colors.border }]}>
          <View style={{ width: total ? `${(fait / total) * 100}%` : '0%', height: '100%', backgroundColor: vert.plein }} />
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
          {total === 0 ? <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 12 }}>{t.vide}</Text> : null}
          {colis.map((c) => {
            const ok = scannes.includes(c.code);
            return (
              <Pressable key={c.code} onPress={() => router.push(`/mission/${encodeURIComponent(c.ref)}`)} style={[row, s.entre]}>
                <Text style={[{ color: ok ? colors.text : ambre.texte, fontWeight: ok ? '400' : '700', flex: 1, fontSize: 15 }, align]} numberOfLines={1}>
                  {ok ? '✓' : '○'} {c.nom} · {c.taille}{c.fragile ? ` · ${t.fragile}` : ''}
                </Text>
                <Text style={{ color: ok ? colors.muted : ambre.texte, fontSize: 13 }}>{ok ? t.scanne : t.aTrouver}</Text>
              </Pressable>
            );
          })}
          {sortis.map((code) => (
            <View key={code} style={[row, s.entre]}>
              <Text style={[{ color: colors.text, flex: 1, fontSize: 15 }, align]}>✓ {code}</Text>
              <IcCheck size={16} color={vert.texte} />
            </View>
          ))}
        </ScrollView>
        {manuel !== null ? (
          <View style={[row, { gap: 8, marginTop: 8 }]}>
            <TextInput value={manuel} onChangeText={(v) => setManuel(v.toUpperCase().replace(/[^A-Z0-9-]/g, ''))} autoFocus
              placeholder={t.code} placeholderTextColor={colors.muted} autoCapitalize="characters" maxLength={24}
              style={[s.saisie, { borderColor: colors.border, color: colors.text, backgroundColor: colors.panel }]} testID="scan-saisie" />
            <Bouton petit style={{ width: 110 }} disabled={!manuel} onPress={() => {
              const code = reconnaitre(manuel, vue);
              if (code) traiter(code); else setRetour({ type: 'inconnu', code: manuel });
              setManuel(null);
            }}>{t.valider}</Bouton>
          </View>
        ) : (
          <View style={[row, { gap: 10, marginTop: 10 }]}>
            <Bouton petit variante="secondaire" style={{ flex: 1 }} onPress={() => setManuel('')}>{t.saisir}</Bouton>
            <Bouton petit style={{ flex: 1 }} disabled={fait === 0} onPress={() => router.navigate('/(tabs)/journee')}>{t.terminer(fait)}</Bouton>
          </View>
        )}
        {manquants.length > 0 && fait > 0 ? <View style={{ marginTop: 8 }}><Pastille ton="ambre">{t.manque(manquants.length)}</Pastille></View> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  plein: { flex: 1 },
  camera: { height: '46%', overflow: 'hidden' },
  sansCamera: { alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#14171e' },
  barreHaut: { position: 'absolute', left: 12, right: 12, justifyContent: 'space-between', alignItems: 'center' },
  segment: { backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, padding: 3 },
  segBtn: { paddingHorizontal: 14, minHeight: 40, borderRadius: 999, justifyContent: 'center' },
  cadre: { position: 'absolute', left: '15%', right: '15%', top: '34%', height: '38%', borderWidth: 3, borderColor: MARQUE.amber, borderRadius: 18 },
  viser: { position: 'absolute', bottom: 34, left: 0, right: 0, textAlign: 'center', color: '#fff', fontWeight: '600' },
  panneau: { flex: 1, marginTop: -20, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 },
  entre: { justifyContent: 'space-between', alignItems: 'center', gap: 10, minHeight: 32 },
  retour: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, maxWidth: '55%' },
  progres: { height: 10, borderRadius: 6, overflow: 'hidden', marginVertical: 10 },
  saisie: { flex: 1, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, fontSize: 17, minHeight: 48 },
});
