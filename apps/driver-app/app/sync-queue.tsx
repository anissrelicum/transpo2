// File de synchronisation hors-ligne — cf. maquette (fonction `Offline`, écran
// « État hors-ligne »). Vue détaillée de `lib/outbox.ts` (intouché, cf.
// design/PLAN-REFONTE-MOBILE.md §4), atteinte en tapant le bandeau hors-ligne
// de `(tabs)/missions.tsx`. Le contenu de chaque action vient de la vraie file
// (`load()`/`subscribe()`), pas de données de démo.
import * as React from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { router, Stack } from 'expo-router';
import { STATUS_META, money, type OrderStatus } from '@transpo/domain';
import { useTheme, statusColorHex, resolveColor } from '../lib/theme';
import { useLanguage } from '../lib/i18n';
import { ScreenHead, PrimaryBtn, BottomAction, ArchiveIcon } from '../components/shell';
import type { Pending } from '../lib/outbox';
import { useOutbox } from '../lib/useOutbox';
import { space, radius } from '@transpo/design-tokens';

function iconProps(size: number, color: string) {
  return {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  };
}
function WarningIcon({ size = 16, color }: { size?: number; color: string }) {
  return <Svg {...iconProps(size, color)}><Path d="M12 3.5 21 19.5H3L12 3.5Z" /><Path d="M12 10v4" /><Path d="M12 17.2v.1" /></Svg>;
}
function ClockIcon({ size = 12, color }: { size?: number; color: string }) {
  return <Svg {...iconProps(size, color)}><Path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" /><Path d="M12 7.5V12l3 2" /></Svg>;
}
function UpdateIcon({ size = 18, color }: { size?: number; color: string }) {
  return <Svg {...iconProps(size, color)}><Path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><Path d="M21 4v4h-4" /><Path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><Path d="M3 20v-4h4" /></Svg>;
}
function InfoIcon({ size = 15, color }: { size?: number; color: string }) {
  return <Svg {...iconProps(size, color)}><Path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" /><Path d="M12 11v5.5" /></Svg>;
}
function ReloadIcon({ size = 18, color }: { size?: number; color: string }) {
  return <Svg {...iconProps(size, color)}><Path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><Path d="M21 4v4h-4" /><Path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><Path d="M3 20v-4h4" /></Svg>;
}

const KIND_ICON: Record<Pending['kind'], { Icon: React.ComponentType<{ size?: number; color: string }>; status: OrderStatus }> = {
  advance: { Icon: UpdateIcon, status: 'RECUPEREE' },
  proof: { Icon: ArchiveIcon, status: 'LIVREE' },
  fail: { Icon: WarningIcon, status: 'ECHOUEE' },
};

function actionLabel(p: Pending, lang: 'fr' | 'ar'): string {
  if (p.kind === 'advance') {
    return lang === 'ar' ? `تحديث الحالة — ${STATUS_META[p.from]?.ar ?? p.from} ←` : `Statut → suivant l’étape ${STATUS_META[p.from]?.fr ?? p.from}`;
  }
  if (p.kind === 'fail') {
    return lang === 'ar' ? `فشل التسليم — ${p.reason}` : `Échec de livraison — ${p.reason}`;
  }
  const cod = p.codCollected > 0 ? (lang === 'ar' ? `تحصيل ${money(p.codCollected)}` : `+ encaissement ${money(p.codCollected)}`) : '';
  return lang === 'ar' ? `تسليم + إثبات ${cod}` : `Livraison + preuve ${cod}`;
}

const L = {
  fr: { title: 'Synchronisation', sub: 'Couverture réseau faible dans cette zone', offline: 'Hors ligne — actions enregistrées localement', pendingCount: (n: number) => `${n} action(s) en attente`, syncing: 'Synchronisation…', autoSend: 'Seront envoyées automatiquement', sendNow: 'Envoi dès que le réseau revient', queueTitle: 'File d’attente', queued: 'En file', info: 'Vous pouvez continuer à travailler : chaque action est horodatée et conservée jusqu’au retour du réseau.', force: 'Forcer la synchronisation', empty: 'Aucune action en attente.' },
  ar: { title: 'المزامنة', sub: 'تغطية شبكة ضعيفة في هذه المنطقة', offline: 'غير متصل — الإجراءات محفوظة محليًا', pendingCount: (n: number) => `${n} إجراء (إجراءات) في الانتظار`, syncing: 'جارٍ المزامنة…', autoSend: 'سيتم إرسالها تلقائيًا', sendNow: 'سيتم الإرسال فور عودة الشبكة', queueTitle: 'قائمة الانتظار', queued: 'في الانتظار', info: 'يمكنك متابعة العمل: كل إجراء مؤرَّخ ومحفوظ إلى حين عودة الشبكة.', force: 'فرض المزامنة', empty: 'لا توجد إجراءات في الانتظار.' },
};

export default function SyncQueueScreen() {
  const { mode, colors } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = L[lang];

  // `useOutbox` s'abonne déjà à la file en temps réel (cf. lib/useOutbox.ts) :
  // pas besoin d'un état local dupliqué, `pending` est directement la vraie file.
  const { pending: items, online, syncing, sync } = useOutbox();

  return (
    <View style={[s.flex, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {!online && (
        <View style={[s.offlineBanner, { backgroundColor: resolveColor('amber', 3, mode), flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <WarningIcon size={16} color={resolveColor('amber', 11, mode)} />
          <Text style={[s.offlineTxt, { color: resolveColor('amber', 11, mode) }]}>{t.offline}</Text>
        </View>
      )}
      <ScreenHead title={t.title} sub={t.sub} onBack={() => router.back()} rtl={rtl} />

      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: space[4], gap: space[2], paddingBottom: 120 }}
        ListHeaderComponent={
          <View style={[s.summary, { backgroundColor: statusColorHex('LIVRAISON', 3, mode), flexDirection: rtl ? 'row-reverse' : 'row', marginBottom: space[3] }]}>
            <View style={[s.summaryIcon, { backgroundColor: statusColorHex('LIVRAISON', 9, mode) + '33' }]}>
              {syncing ? <ActivityIndicator color={statusColorHex('LIVRAISON', 11, mode)} /> : <Text style={[s.summaryCount, { color: statusColorHex('LIVRAISON', 11, mode) }]}>{items.length}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.summaryTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
                {syncing ? t.syncing : t.pendingCount(items.length)}
              </Text>
              <Text style={[s.summarySub, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>
                {syncing ? t.sendNow : t.autoSend}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={[s.empty, { color: colors.muted }]}>{t.empty}</Text>}
        ListFooterComponent={
          items.length > 0 ? (
            <View style={[s.callout, { backgroundColor: colors.panel, borderColor: colors.border, flexDirection: rtl ? 'row-reverse' : 'row', marginTop: space[2] }]}>
              <InfoIcon size={14} color={colors.muted} />
              <Text style={[s.calloutTxt, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>{t.info}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const meta = KIND_ICON[item.kind];
          const fg = statusColorHex(meta.status, 11, mode);
          return (
            <View style={[s.card, { backgroundColor: colors.panel, borderColor: colors.border, flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <meta.Icon size={18} color={fg} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.actTxt, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]} numberOfLines={2}>{actionLabel(item, lang)}</Text>
                <Text style={[s.refTxt, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>{item.ref}</Text>
              </View>
              {syncing ? (
                <ActivityIndicator color={colors.muted} />
              ) : (
                <View style={[s.queuedBadge, { backgroundColor: colors.border, flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                  <ClockIcon size={11} color={colors.muted} />
                  <Text style={[s.queuedTxt, { color: colors.muted }]}>{t.queued}</Text>
                </View>
              )}
            </View>
          );
        }}
      />

      <BottomAction>
        <PrimaryBtn disabled={syncing || items.length === 0} loading={syncing} onPress={sync}>
          {syncing ? t.syncing : t.force}
        </PrimaryBtn>
      </BottomAction>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  offlineBanner: { alignItems: 'center', gap: space[2], paddingHorizontal: space[4], paddingVertical: space[2] },
  offlineTxt: { fontSize: 13, fontWeight: '600', flex: 1 },
  summary: { borderRadius: radius[4], padding: space[3], alignItems: 'center', gap: space[3] },
  summaryIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  summaryCount: { fontSize: 18, fontWeight: '800' },
  summaryTitle: { fontSize: 14, fontWeight: '600' },
  summarySub: { fontSize: 12, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 40 },
  callout: { borderRadius: radius[3], borderWidth: 1, padding: space[3], gap: space[2], alignItems: 'flex-start' },
  calloutTxt: { flex: 1, fontSize: 12 },
  card: { borderRadius: radius[3], borderWidth: 1, padding: space[3], alignItems: 'center', gap: space[3] },
  actTxt: { fontSize: 13, fontWeight: '600' },
  refTxt: { fontSize: 12, marginTop: 2 },
  queuedBadge: { alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  queuedTxt: { fontSize: 11, fontWeight: '600' },
});
