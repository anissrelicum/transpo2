// Scanner de colis — onglet « Scanner ». Cf. maquette (fonction ScannerScreen).
//
// TOUJOURS SIMULÉ (cf. design/PLAN-REFONTE-MOBILE.md §1 ligne 12 et §5) : pas
// de caméra native (aucune dépendance ajoutée, cf. PRD §9.2 — hors périmètre
// v1), pas d'endpoint. `SCAN_ITEMS` est une liste de démonstration fixe,
// jamais dérivée d'une commande réelle. Le bandeau « démo » ci-dessous et
// l'absence de tout indicateur réseau signalent cet état au livreur.
import * as React from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { space, touch, radius } from '@transpo/design-tokens';
import { useTheme, resolveColor } from '../../lib/theme';
import { useLanguage } from '../../lib/i18n';
import { ScreenHead, PrimaryBtn, BottomAction } from '../../components/shell';

type Phase = 'retrait' | 'livraison';
type FlashKind = 'ok' | 'dup' | 'unknown' | 'done';

// Données de démonstration — ne représentent aucune commande réelle du livreur.
const SCAN_ITEMS = [
  { code: 'A7K2M9QX', ref: 'CMD-DEMO-01', name: 'Salma Idrissi' },
  { code: 'C9M4X2QK', ref: 'CMD-DEMO-02', name: 'Riad Déco' },
  { code: 'D2K7P5MX', ref: 'CMD-DEMO-03', name: 'Souss Électro' },
  { code: 'E5Q1M8KP', ref: 'CMD-DEMO-04', name: 'Karim Benjelloun' },
  { code: 'F8K3P2MQ', ref: 'CMD-DEMO-05', name: 'Atlas Cosmetics' },
] as const;

const STR = {
  fr: {
    title: 'Scanner',
    sub: (n: number, total: number) => `${n}/${total} colis scannés`,
    demo: 'Écran de démonstration : aucune caméra réelle, aucune donnée envoyée au serveur.',
    retrait: 'Retrait',
    livraison: 'Livraison',
    viewfinder: 'Aperçu caméra (simulation)',
    manualPlaceholder: 'Saisie manuelle (8 car.)',
    validate: 'Valider',
    progress: (phase: string) => `Progression du ${phase}`,
    listTitle: 'Colis de la tournée (démo)',
    scanned: 'scanné',
    scanBtn: 'Scanner',
    done: 'Terminé',
    testUnknown: 'Simuler un colis hors tournée',
    okTitle: 'Colis reconnu',
    dupTitle: 'Déjà scanné',
    unknownTitle: 'Colis hors tournée',
    doneTitle: 'Tous les colis scannés',
  },
  ar: {
    title: 'مسح',
    sub: (n: number, total: number) => `${n}/${total} طرد تم مسحه`,
    demo: 'شاشة تجريبية: لا كاميرا حقيقية، لا بيانات تُرسل إلى الخادم.',
    retrait: 'الاستلام',
    livraison: 'التسليم',
    viewfinder: 'معاينة الكاميرا (محاكاة)',
    manualPlaceholder: 'إدخال يدوي (8 أحرف)',
    validate: 'تأكيد',
    progress: (phase: string) => `تقدم ${phase}`,
    listTitle: 'طرود الجولة (تجريبي)',
    scanned: 'تم المسح',
    scanBtn: 'مسح',
    done: 'انتهى',
    testUnknown: 'محاكاة طرد خارج الجولة',
    okTitle: 'تم التعرف على الطرد',
    dupTitle: 'تم مسحه من قبل',
    unknownTitle: 'طرد خارج الجولة',
    doneTitle: 'تم مسح جميع الطرود',
  },
} as const;

export default function ScannerScreen() {
  const { colors, mode } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = STR[lang === 'ar' ? 'ar' : 'fr'];

  const [phase, setPhase] = React.useState<Phase>('retrait');
  const [scanned, setScanned] = React.useState<string[]>([]);
  const [flash, setFlash] = React.useState<{ kind: FlashKind; item?: (typeof SCAN_ITEMS)[number]; code?: string } | null>(null);
  const [manual, setManual] = React.useState('');
  const total = SCAN_ITEMS.length;
  const allDone = scanned.length === total;

  React.useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 1600);
    return () => clearTimeout(id);
  }, [flash]);

  function handle(code: string) {
    const item = SCAN_ITEMS.find((i) => i.code === code);
    let kind: FlashKind;
    if (!item) kind = 'unknown';
    else if (scanned.includes(code)) kind = 'dup';
    else {
      kind = 'ok';
      setScanned((s) => [code, ...s]);
    }
    setFlash({ kind, item, code });
  }
  function scanNext() {
    const next = SCAN_ITEMS.find((i) => !scanned.includes(i.code));
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
      <ScreenHead title={t.title} sub={t.sub(scanned.length, total)} rtl={rtl} />
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
          <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>{scanned.length}/{total}</Text>
        </View>
        <View style={[s.progressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              s.progressFill,
              { width: `${(scanned.length / total) * 100}%`, backgroundColor: allDone ? resolveColor('green', 9, mode) : colors.indigo9 },
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
        {SCAN_ITEMS.map((it) => {
          const ok = scanned.includes(it.code);
          return (
            <View
              key={it.code}
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
            </View>
          );
        })}
      </ScrollView>

      <BottomAction>
        <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: space[2] }}>
          <Pressable onPress={() => handle('ZZ99ZZ99')} style={[s.testBtn, { borderColor: colors.border }]} accessibilityLabel={t.testUnknown}>
            <Text style={{ color: colors.muted, fontSize: 18 }}>?</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <PrimaryBtn onPress={scanNext} disabled={allDone}>{allDone ? t.done : t.scanBtn}</PrimaryBtn>
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
