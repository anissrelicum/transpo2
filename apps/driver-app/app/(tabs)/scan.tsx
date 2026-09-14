// Scanner de colis — onglet « Scanner ».
//
// Le VISEUR reste simulé : lire un code-barres demande une lib native (ML Kit / ZXing),
// hors périmètre v1 — c'est la réserve documentée au PRD §9.2, et le bandeau le dit.
// Les DONNÉES, elles, sont réelles : la liste est « les colis de la tournée » du livreur
// (PRD Lot 3 §5.12), pas un jeu figé. Elle l'a été : `SCAN_ITEMS` alignait cinq colis
// `CMD-DEMO-0x` inventés, si bien qu'un livreur ne pouvait scanner aucun de SES colis et
// que tous ses vrais codes passaient pour « hors tournée » — un écran qui répond faux sur
// les seules données qui comptent.
import * as React from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { router } from 'expo-router';
import type { Order } from '@transpo/domain';
import { space, touch, radius } from '@transpo/design-tokens';
import { useTheme, resolveColor } from '../../lib/theme';
import { useLanguage } from '../../lib/i18n';
import { ScreenHead, PrimaryBtn, BottomAction } from '../../components/shell';
import { authedClient, idemKey } from '../../lib/api';
import { readJson, writeJson } from '../../lib/storage';
import { enqueue, applyPending } from '../../lib/outbox';
import { useOutbox } from '../../lib/useOutbox';

const CACHE_KEY = 'transpo.missions.v1';

// Ce que chaque phase donne à scanner : au retrait, les colis pas encore en main ;
// à la livraison, ceux qui sont dans le véhicule.
const PHASE_STATUTS = {
  retrait: ['ASSIGNEE', 'RETRAIT'],
  livraison: ['RECUPEREE', 'LIVRAISON'],
} as const;

type Phase = 'retrait' | 'livraison';
type Colis = { code: string; ref: string; name: string; status: string };
type FlashKind = 'ok' | 'dup' | 'unknown' | 'done';

const STR = {
  fr: {
    title: 'Scanner',
    sub: (n: number, total: number) => `${n}/${total} colis scannés`,
    demo: 'Viseur caméra simulé : utilisez la saisie manuelle du code à 8 caractères. Les colis listés sont vos missions du jour.',
    retrait: 'Retrait',
    livraison: 'Livraison',
    viewfinder: 'Aperçu caméra (simulation)',
    manualPlaceholder: 'Saisie manuelle (8 car.)',
    validate: 'Valider',
    progress: (phase: string) => `Progression du ${phase}`,
    listTitle: 'Colis de la tournée',
    scanned: 'scanné',
    scanBtn: 'Scanner',
    done: 'Terminé',
    testUnknown: 'Simuler un colis hors tournée',
    okTitle: 'Colis reconnu',
    dupTitle: 'Déjà scanné',
    unknownTitle: 'Colis hors tournée',
    doneTitle: 'Tous les colis scannés',
    empty: 'Aucun colis à scanner pour cette étape.',
    pickedUp: 'Colis récupéré — la mission avance.',
    offlineNote: 'Enregistré sur l’appareil, transmis au retour du réseau.',
  },
  ar: {
    title: 'مسح',
    sub: (n: number, total: number) => `${n}/${total} طرد تم مسحه`,
    demo: 'معاينة الكاميرا محاكاة: استعمل الإدخال اليدوي للرمز المكوّن من 8 خانات. الطرود المعروضة هي مهامك اليوم.',
    retrait: 'الاستلام',
    livraison: 'التسليم',
    viewfinder: 'معاينة الكاميرا (محاكاة)',
    manualPlaceholder: 'إدخال يدوي (8 أحرف)',
    validate: 'تأكيد',
    progress: (phase: string) => `تقدم ${phase}`,
    listTitle: 'طرود الجولة',
    scanned: 'تم المسح',
    scanBtn: 'مسح',
    done: 'انتهى',
    testUnknown: 'محاكاة طرد خارج الجولة',
    okTitle: 'تم التعرف على الطرد',
    dupTitle: 'تم مسحه من قبل',
    unknownTitle: 'طرد خارج الجولة',
    doneTitle: 'تم مسح جميع الطرود',
    empty: 'لا يوجد طرد للمسح في هذه المرحلة.',
    pickedUp: 'تم استلام الطرد — تتقدم المهمة.',
    offlineNote: 'محفوظ على الجهاز، سيُرسل عند عودة الشبكة.',
  },
} as const;

export default function ScannerScreen() {
  const { colors, mode } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = STR[lang === 'ar' ? 'ar' : 'fr'];

  const [phase, setPhase] = React.useState<Phase>('retrait');
  const [scanned, setScanned] = React.useState<string[]>([]);
  const [flash, setFlash] = React.useState<{ kind: FlashKind; item?: Colis; code?: string } | null>(null);
  const [manual, setManual] = React.useState('');
  const [orders, setOrders] = React.useState<Order[]>([]);
  const { pending, online, sync } = useOutbox();

  // Mêmes missions que l'onglet Missions, même cache : hors ligne, le livreur scanne
  // toujours la tournée de son dernier chargement plutôt qu'un écran vide.
  const recharger = React.useCallback(async () => {
    try {
      const fresh = await authedClient().getMissions();
      setOrders(fresh);
      await writeJson(CACHE_KEY, fresh);
    } catch {
      setOrders(await readJson<Order[]>(CACHE_KEY, []));
    }
  }, []);
  React.useEffect(() => { recharger(); }, [recharger]);

  const vue = applyPending(orders, pending);
  const items: Colis[] = vue
    .filter((o) => (PHASE_STATUTS[phase] as readonly string[]).includes(o.status))
    .map((o) => ({ code: o.code, ref: o.ref, name: o.dropContact || o.merchant || o.ref, status: o.status }));
  const total = items.length;
  // Un colis passé à l'étape suivante par un scan sort de la liste : il compte comme fait.
  const faits = scanned.filter((c) => !items.some((i) => i.code === c)).length;
  const done = items.filter((i) => scanned.includes(i.code)).length + faits;
  const allDone = total > 0 && done >= total + faits;

  // Un succès s'efface tout seul — on enchaîne les colis. Un REFUS reste à l'écran
  // jusqu'au scan suivant : à 1,6 s, un livreur qui scanne à la chaîne rate le seul
  // message qui lui demandait de s'arrêter.
  React.useEffect(() => {
    if (!flash || flash.kind === 'dup' || flash.kind === 'unknown') return;
    const id = setTimeout(() => setFlash(null), 1600);
    return () => clearTimeout(id);
  }, [flash]);

  /**
   * Scanner un colis au RETRAIT, c'est l'avoir en main : la mission passe « Récupérée ».
   * L'action part par la file d'attente, comme celles de l'écran de progression — donc
   * elle survit à une coupure réseau et son rejeu est dédoublonné (clé par statut).
   */
  async function enregistrerRetrait(colis: Colis) {
    const ordre = vue.find((o) => o.ref === colis.ref);
    if (!ordre) return;
    const chemin: string[] = ordre.status === 'ASSIGNEE' ? ['ASSIGNEE', 'RETRAIT'] : ['RETRAIT'];
    for (const depuis of chemin) {
      await enqueue({
        kind: 'advance', ref: ordre.ref, from: depuis as Order['status'],
        idemKey: idemKey(ordre.ref, `advance-${depuis}`),
      });
    }
    await sync();
    await recharger();
  }

  function handle(code: string) {
    const item = items.find((i) => i.code === code);
    if (item && !scanned.includes(code)) {
      setScanned((s) => [code, ...s]);
      setFlash({ kind: 'ok', item, code });
      if (phase === 'retrait') enregistrerRetrait(item);
      return;
    }
    // Le colis a pu QUITTER la liste de l'étape parce qu'il vient d'y être scanné :
    // le chercher dans toute la tournée évite de traiter un colis bien à soi en
    // « hors tournée », ce qui enverrait le livreur chercher une erreur inexistante.
    const ailleurs = vue.find((o) => o.code === code);
    if (item || ailleurs) {
      const connu = item ?? { code, ref: ailleurs!.ref, name: ailleurs!.dropContact || ailleurs!.merchant || ailleurs!.ref, status: ailleurs!.status };
      setFlash({ kind: 'dup', item: connu, code });
      return;
    }
    setFlash({ kind: 'unknown', code });
  }

  function scanNext() {
    const next = items.find((i) => !scanned.includes(i.code));
    if (next) handle(next.code);
    else setFlash({ kind: 'done' });
  }

  function submitManual() {
    if (manual.length !== 8) return;
    handle(manual.toUpperCase());
    setManual('');
  }

  const flashColor = flash
    ? flash.kind === 'ok' || flash.kind === 'done'
      ? resolveColor('green', 9, mode)
      : flash.kind === 'dup'
        ? resolveColor('amber', 9, mode)
        : resolveColor('red', 9, mode)
    : colors.border;

  return (
    <View style={[s.wrap, { backgroundColor: colors.bg }]}>
      <ScreenHead title={t.title} sub={t.sub(done, total + faits)} rtl={rtl} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={[s.notice, { borderColor: colors.border, backgroundColor: colors.panel }]}>
          <Text style={[s.noticeTxt, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>{t.demo}</Text>
        </View>

        <View style={[s.segment, { borderColor: colors.border, flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          {(['retrait', 'livraison'] as const).map((p) => {
            const on = phase === p;
            return (
              <Pressable
                key={p}
                onPress={() => setPhase(p)}
                style={[s.segmentItem, on && { backgroundColor: colors.indigo9 }]}
              >
                <Text style={[s.segmentTxt, { color: on ? '#fff' : colors.text }]}>{p === 'retrait' ? t.retrait : t.livraison}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[s.viewfinder, { backgroundColor: colors.text, borderColor: flashColor }]}>
          {!flash && <Text style={[s.viewfinderTxt, { color: colors.bg }]}>{t.viewfinder}</Text>}
          {flash && flash.kind !== 'done' && (
            <View style={s.flashBox}>
              <View style={[s.flashDot, { backgroundColor: flashColor }]}>
                <Text style={s.flashGlyph}>{flash.kind === 'ok' ? '✓' : flash.kind === 'dup' ? '!' : '×'}</Text>
              </View>
              <Text style={[s.flashTitle, { color: colors.bg }]}>
                {flash.kind === 'ok' ? t.okTitle : flash.kind === 'dup' ? t.dupTitle : t.unknownTitle}
              </Text>
              {flash.item && (
                <Text style={[s.flashMeta, { color: colors.border }]}>
                  {flash.item.ref} · {flash.item.name}
                </Text>
              )}
            </View>
          )}
          {flash && flash.kind === 'done' && (
            <View style={s.flashBox}>
              <View style={[s.flashDot, { backgroundColor: resolveColor('green', 9, mode) }]}>
                <Text style={s.flashGlyph}>✓</Text>
              </View>
              <Text style={[s.flashTitle, { color: colors.bg }]}>{t.doneTitle}</Text>
            </View>
          )}
        </View>

        <View style={s.progressRow}>
          <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }}>{t.progress(phase === 'retrait' ? t.retrait : t.livraison)}</Text>
          <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }} testID="scan-compteur">{done}/{total + faits}</Text>
        </View>
        <View style={[s.progressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              s.progressFill,
              { width: `${total + faits > 0 ? (done / (total + faits)) * 100 : 0}%`, backgroundColor: allDone ? resolveColor('green', 9, mode) : colors.indigo9 },
            ]}
          />
        </View>

        <View style={[s.manualRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <TextInput
            style={[s.manualInput, { borderColor: colors.border, color: colors.text, textAlign: rtl ? 'right' : 'left' }]}
            placeholder={t.manualPlaceholder}
            placeholderTextColor={colors.muted}
            value={manual}
            onChangeText={(v) => setManual(v.toUpperCase().slice(0, 8))}
            autoCapitalize="characters"
            maxLength={8}
            testID="scan-code-manuel" accessibilityLabel={t.manualPlaceholder}
          />
          <Pressable
            disabled={manual.length !== 8}
            onPress={submitManual}
            style={[s.validateBtn, { borderColor: colors.border, opacity: manual.length === 8 ? 1 : 0.5 }]}
          >
            <Text style={{ color: colors.text, fontWeight: '600' }}>{t.validate}</Text>
          </Pressable>
        </View>

        <Text style={[s.listTitle, { color: colors.muted }]}>{t.listTitle}</Text>
        {items.length === 0 && (
          <Text style={{ color: colors.muted, fontSize: 13 }} testID="scan-liste-vide">{t.empty}</Text>
        )}
        {items.map((it) => {
          const ok = scanned.includes(it.code);
          return (
            <Pressable
              key={it.code}
              onPress={() => router.push(`/mission/${it.ref}`)}
              style={[
                s.itemRow,
                { flexDirection: rtl ? 'row-reverse' : 'row', borderColor: colors.border },
                ok && { backgroundColor: resolveColor('green', 3, mode) },
              ]}
            >
              <View style={[s.itemDot, { backgroundColor: ok ? resolveColor('green', 9, mode) : colors.border }]}>
                <Text style={{ color: ok ? '#fff' : colors.muted, fontWeight: '700' }}>{ok ? '✓' : '·'}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{it.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>{it.ref} · {it.code}</Text>
              </View>
              {ok && (
                <View style={[s.pill, { backgroundColor: resolveColor('green', 3, mode) }]}>
                  <Text style={{ color: resolveColor('green', 11, mode), fontSize: 11, fontWeight: '700' }}>{t.scanned}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
        {scanned.length > 0 && phase === 'retrait' && (
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {online ? t.pickedUp : t.offlineNote}
          </Text>
        )}
      </ScrollView>

      <BottomAction>
        <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: space[2] }}>
          <Pressable onPress={() => handle('ZZ99ZZ99')} style={[s.testBtn, { borderColor: colors.border }]} accessibilityLabel={t.testUnknown}>
            <Text style={{ color: colors.muted, fontSize: 18 }}>?</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <PrimaryBtn onPress={scanNext} disabled={items.length === 0}>{allDone ? t.done : t.scanBtn}</PrimaryBtn>
          </View>
        </View>
      </BottomAction>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  content: { padding: space[4], paddingBottom: space[9] + touch.primary, gap: space[3] },
  notice: { borderWidth: 1, borderRadius: radius[3], padding: space[3] },
  noticeTxt: { fontSize: 12, lineHeight: 17 },
  segment: { borderWidth: 1, borderRadius: radius[3], overflow: 'hidden' },
  segmentItem: { flex: 1, height: touch.min, alignItems: 'center', justifyContent: 'center' },
  segmentTxt: { fontSize: 13, fontWeight: '600' },
  viewfinder: { aspectRatio: 4 / 3, borderRadius: radius[4], borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  viewfinderTxt: { fontSize: 13, opacity: 0.6 },
  flashBox: { alignItems: 'center', gap: 4 },
  flashDot: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  flashGlyph: { color: '#fff', fontSize: 24, fontWeight: '800' },
  flashTitle: { fontSize: 14, fontWeight: '700' },
  flashMeta: { fontSize: 12 },
  progressRow: { flexDirection: 'row' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%' },
  manualRow: { gap: space[2] },
  manualInput: { flex: 1, borderWidth: 1, borderRadius: radius[3], paddingHorizontal: space[3], height: touch.min, fontSize: 15 },
  validateBtn: { borderWidth: 1, borderRadius: radius[3], paddingHorizontal: space[3], height: touch.min, alignItems: 'center', justifyContent: 'center' },
  listTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  itemRow: { alignItems: 'center', gap: space[3], borderWidth: 1, borderRadius: radius[3], padding: space[2] },
  itemDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  pill: { borderRadius: radius.full, paddingHorizontal: space[2], paddingVertical: 2 },
  testBtn: { width: touch.primary, height: touch.primary, borderWidth: 1, borderRadius: radius[3], alignItems: 'center', justifyContent: 'center' },
});
