// Mon shift — onglet « Shift ». Cf. maquette (fonctions Shift, StatMini) et
// design/PLAN-REFONTE-MOBILE.md §2 Lot C.
//
// TOUJOURS LOCAL (cf. plan §5) : aucun endpoint shift/EU561 côté serveur.
// Le chronomètre de conduite est un minuteur 100 % local, persisté via
// `lib/storage.ts` (clé `transpo.shift.v1`) pour survivre à un redémarrage.
// En revanche, ce bouton est la SOURCE DE VÉRITÉ du partage de position
// (`useTracking`, réel) — décision produit décrite dans le plan (§2 Lot A /
// Lot C) : démarrer le shift active le suivi, le terminer le coupe.
import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { space, radius } from '@transpo/design-tokens';
import { money, eu561Status, EU561_MAX_DRIVE_HOURS } from '@transpo/domain';
import { readJson, writeJson } from '../../lib/storage';
import { useTracking } from '../../lib/tracking';
import { useTheme, resolveColor } from '../../lib/theme';
import { useLanguage } from '../../lib/i18n';
import { PrimaryBtn } from '../../components/shell';

const SHIFT_KEY = 'transpo.shift.v1';
// Même clé que l'ancien Switch de `missions.tsx` (cf. plan) : `settings.tsx`
// (lot D) la relit en lecture seule, ce shift en est désormais la seule source.
const TRACK_KEY = 'transpo.tracking.enabled';

// Les seuils EU 561 vivent dans @transpo/domain (`eu561Status`), avec leurs tests :
// l'écran les affiche, il ne les redéfinit plus.
const MAX_DRIVE_MS = EU561_MAX_DRIVE_HOURS * 3_600_000;

interface ShiftState {
  active: boolean;
  date: string; // jour courant (YYYY-MM-DD) — les compteurs repartent à zéro chaque jour
  startedAt: string | null; // ISO — premier démarrage du jour
  drivenMs: number; // conduite cumulée, dernier point de sauvegarde
  resumedAt: string | null; // ISO — dernière reprise ; null si à l'arrêt
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
function freshState(): ShiftState {
  return { active: false, date: todayKey(), startedAt: null, drivenMs: 0, resumedAt: null };
}
function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}` : `${m} min`;
}

const STR = {
  fr: {
    heading: 'Mon shift',
    active: 'Shift en cours',
    inactive: 'Hors service',
    startedAt: (h: string) => `Démarré à ${h}`,
    noShift: 'Aucun shift actif aujourd’hui',
    driveTitle: 'Temps de conduite',
    driveToday: 'Conduite du jour',
    remaining: 'Restant',
    rest: 'Repos estimé',
    amplitude: 'Amplitude',
    pauseCallout: 'Pause obligatoire de 45 min avant d’atteindre la limite de conduite.',
    limitCallout: 'Limite journalière de conduite atteinte (9h) — arrêtez le shift.',
    warnCallout: 'Moins de 30 min avant la limite de conduite journalière.',
    demoStats: 'Journée (démonstration)',
    demoStatsNote: 'Aucun endpoint ne fournit ces chiffres aujourd’hui — valeurs d’exemple.',
    missions: 'Missions livrées',
    distance: 'Distance parcourue',
    cod: 'COD encaissé',
    trackTitle: 'Partage de position',
    trackOff: 'Désactivé',
    trackStarting: 'Activation…',
    trackOn: (h: string) => `Position transmise · dernier envoi ${h}`,
    trackDenied: 'Autorisation refusée — à activer dans les réglages du téléphone',
    trackError: 'Localisation indisponible',
    start: 'Démarrer le shift',
    stop: 'Terminer le shift',
    localOnly: 'Suivi 100 % local — aucune remontée serveur EU 561. Le partage de position, lui, est réel.',
  },
  ar: {
    heading: 'ورديتي',
    active: 'الوردية جارية',
    inactive: 'خارج الخدمة',
    startedAt: (h: string) => `بدأت الساعة ${h}`,
    noShift: 'لا توجد وردية نشطة اليوم',
    driveTitle: 'وقت القيادة',
    driveToday: 'قيادة اليوم',
    remaining: 'المتبقي',
    rest: 'راحة مقدرة',
    amplitude: 'المدة الإجمالية',
    pauseCallout: 'استراحة إلزامية لمدة 45 دقيقة قبل بلوغ حد القيادة.',
    limitCallout: 'تم بلوغ الحد اليومي للقيادة (9 س) — أوقف الوردية.',
    warnCallout: 'أقل من 30 دقيقة قبل الحد اليومي للقيادة.',
    demoStats: 'اليوم (تجريبي)',
    demoStatsNote: 'لا يوجد واجهة برمجية توفر هذه الأرقام حالياً — قيم توضيحية.',
    missions: 'المهام المسلَّمة',
    distance: 'المسافة المقطوعة',
    cod: 'المبلغ المحصَّل',
    trackTitle: 'مشاركة الموقع',
    trackOff: 'معطّل',
    trackStarting: 'جارٍ التفعيل…',
    trackOn: (h: string) => `الموقع يُرسل · آخر إرسال ${h}`,
    trackDenied: 'الإذن مرفوض — فعّله من إعدادات الهاتف',
    trackError: 'تحديد الموقع غير متاح',
    start: 'ابدأ الوردية',
    stop: 'أنهِ الوردية',
    localOnly: 'تتبع محلي بالكامل — لا إرسال إلى الخادم (EU 561). مشاركة الموقع حقيقية بدورها.',
  },
} as const;

export default function ShiftScreen() {
  const { colors, mode } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = STR[lang === 'ar' ? 'ar' : 'fr'];

  const [state, setState] = React.useState<ShiftState>(freshState);
  const [loaded, setLoaded] = React.useState(false);
  const [, forceTick] = React.useReducer((n: number) => n + 1, 0);

  React.useEffect(() => {
    (async () => {
      const saved = await readJson<ShiftState>(SHIFT_KEY, freshState());
      setState(saved.date === todayKey() ? saved : freshState());
      setLoaded(true);
    })();
  }, []);

  React.useEffect(() => {
    if (!loaded) return;
    writeJson(SHIFT_KEY, state);
  }, [state, loaded]);

  // Rafraîchit l'affichage du chrono chaque minute pendant que le shift tourne.
  React.useEffect(() => {
    if (!state.active) return;
    const id = setInterval(() => forceTick(), 60_000);
    return () => clearInterval(id);
  }, [state.active]);

  const drivenMs =
    state.drivenMs + (state.active && state.resumedAt ? Date.now() - new Date(state.resumedAt).getTime() : 0);
  const amplitudeMs = state.startedAt ? Date.now() - new Date(state.startedAt).getTime() : 0;
  const { remainingMs, restMs, level } = eu561Status({ drivenMs, amplitudeMs });
  const atLimit = level === 'limite';
  const nearLimit = level === 'warn';
  const pauseRequired = level === 'pause';

  // Le shift pilote le partage de position (cf. plan) : démarrer = activer `useTracking`.
  const tracking = loaded && state.active;
  React.useEffect(() => {
    if (loaded) writeJson(TRACK_KEY, tracking);
  }, [tracking, loaded]);
  const track = useTracking(tracking);

  function toggle() {
    setState((prev) => {
      const now = Date.now();
      if (prev.active) {
        const delta = prev.resumedAt ? now - new Date(prev.resumedAt).getTime() : 0;
        return { ...prev, active: false, drivenMs: prev.drivenMs + delta, resumedAt: null };
      }
      const nowIso = new Date(now).toISOString();
      return { ...prev, active: true, startedAt: prev.startedAt ?? nowIso, resumedAt: nowIso };
    });
  }

  const trackLabel =
    track.state === 'off'
      ? t.trackOff
      : track.state === 'starting'
        ? t.trackStarting
        : track.state === 'on'
          ? t.trackOn(track.lastAt ? new Date(track.lastAt).toLocaleTimeString(lang === 'ar' ? 'ar-MA' : 'fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—')
          : track.state === 'denied'
            ? t.trackDenied
            : t.trackError;

  const startedAtLabel = state.startedAt
    ? new Date(state.startedAt).toLocaleTimeString(lang === 'ar' ? 'ar-MA' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null;

  const driveBarColor = atLimit || nearLimit ? resolveColor('red', 9, mode) : pauseRequired ? resolveColor('amber', 9, mode) : resolveColor('green', 9, mode);

  return (
    <View style={[s.wrap, { backgroundColor: colors.bg }]}>
      <View style={s.header}>
        <Text style={[s.heading, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>{t.heading}</Text>
      </View>
      <View style={s.content}>
        <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.panel }]}>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: space[2] }}>
            <View style={[s.dot, { backgroundColor: state.active ? resolveColor('green', 9, mode) : colors.border }]} />
            <Text style={[s.cardTitle, { color: colors.text }]}>{state.active ? t.active : t.inactive}</Text>
          </View>
          <Text style={[s.cardSub, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>
            {state.active && startedAtLabel ? t.startedAt(startedAtLabel) : t.noShift}
          </Text>
        </View>

        <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.panel }]}>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: space[2] }}>
            <Text style={[s.cardTitle, { color: colors.text, flex: 1 }]}>{t.driveTitle}</Text>
            <View style={[s.pill, { backgroundColor: colors.border }]}>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: '700' }}>EU 561/2006</Text>
            </View>
          </View>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', marginTop: space[2] }}>
            <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }}>{t.driveToday}</Text>
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>
              {formatDuration(drivenMs)} / {formatDuration(MAX_DRIVE_MS)}
            </Text>
          </View>
          <View style={[s.progressTrack, { backgroundColor: colors.border }]}>
            <View style={[s.progressFill, { width: `${Math.min(100, (drivenMs / MAX_DRIVE_MS) * 100)}%`, backgroundColor: driveBarColor }]} />
          </View>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', marginTop: space[3] }}>
            <StatMini label={t.remaining} value={formatDuration(remainingMs)} color={atLimit || nearLimit ? 'red' : undefined} mode={mode} />
            <StatMini label={t.rest} value={formatDuration(restMs)} mode={mode} />
            <StatMini label={t.amplitude} value={formatDuration(amplitudeMs)} mode={mode} />
          </View>
          {atLimit && <Callout text={t.limitCallout} color="red" mode={mode} rtl={rtl} />}
          {!atLimit && nearLimit && <Callout text={t.warnCallout} color="red" mode={mode} rtl={rtl} />}
          {!atLimit && !nearLimit && pauseRequired && <Callout text={t.pauseCallout} color="amber" mode={mode} rtl={rtl} />}
        </View>

        <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.panel }]}>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: space[2] }}>
            <Text style={{ color: colors.text }}>{t.trackTitle}</Text>
          </View>
          <Text style={[s.cardSub, { color: track.state === 'denied' ? resolveColor('red', 11, mode) : colors.muted, textAlign: rtl ? 'right' : 'left' }]}>
            {trackLabel}
          </Text>
        </View>

        <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.panel }]}>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: space[2] }}>
            <Text style={[s.cardTitle, { color: colors.text, flex: 1 }]}>{t.demoStats}</Text>
            <View style={[s.pill, { backgroundColor: resolveColor('amber', 3, mode) }]}>
              <Text style={{ color: resolveColor('amber', 11, mode), fontSize: 10, fontWeight: '700' }}>DEMO</Text>
            </View>
          </View>
          <Text style={[s.demoNote, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>{t.demoStatsNote}</Text>
          <StatRow label={t.missions} value="7" colors={colors} rtl={rtl} />
          <StatRow label={t.distance} value="84,2 km" colors={colors} rtl={rtl} />
          <StatRow label={t.cod} value={money(5140)} colors={colors} rtl={rtl} valueColor={resolveColor('green', 11, mode)} />
        </View>

        <Text style={[s.localOnly, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>{t.localOnly}</Text>
      </View>

      <View style={{ padding: space[3] }}>
        <PrimaryBtn onPress={toggle}>{state.active ? t.stop : t.start}</PrimaryBtn>
      </View>
    </View>
  );
}

function StatMini({ label, value, color, mode }: { label: string; value: string; color?: 'red'; mode: 'light' | 'dark' }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: color ? resolveColor(color, 11, mode) : undefined, fontSize: 15, fontWeight: '700' }}>{value}</Text>
      <Text style={{ fontSize: 11, opacity: 0.6 }}>{label}</Text>
    </View>
  );
}

function StatRow({
  label,
  value,
  colors,
  rtl,
  valueColor,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>['colors'];
  rtl: boolean;
  valueColor?: string;
}) {
  return (
    <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', marginTop: space[2] }}>
      <Text style={{ color: colors.muted, fontSize: 13, flex: 1 }}>{label}</Text>
      <Text style={{ color: valueColor ?? colors.text, fontSize: 13, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}

function Callout({ text, color, mode, rtl }: { text: string; color: 'amber' | 'red'; mode: 'light' | 'dark'; rtl: boolean }) {
  return (
    <View style={[s.callout, { backgroundColor: resolveColor(color, 3, mode) }]}>
      <Text style={{ color: resolveColor(color, 11, mode), fontSize: 12, textAlign: rtl ? 'right' : 'left' }}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  header: { paddingHorizontal: space[4], paddingTop: space[3], paddingBottom: space[2] },
  heading: { fontSize: 20, fontWeight: '700' },
  content: { flex: 1, paddingHorizontal: space[4], gap: space[3] },
  card: { borderWidth: 1, borderRadius: radius[4], padding: space[3] },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardSub: { fontSize: 12, marginTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  pill: { borderRadius: radius.full, paddingHorizontal: space[2], paddingVertical: 2 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: space[2] },
  progressFill: { height: '100%' },
  demoNote: { fontSize: 11, marginTop: 2, marginBottom: space[1] },
  callout: { borderRadius: radius[3], padding: space[2], marginTop: space[3] },
  localOnly: { fontSize: 11 },
});
