// Objectifs & primes — barème statique partagé avec le back-office
// (cf. design/lib-design-system.md §Objectifs). Aucun endpoint : `GOALS` est
// une donnée de démonstration, signalée par le callout ci-dessous
// (cf. design/PLAN-REFONTE-MOBILE.md §5).
import * as React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { router, Stack } from 'expo-router';
import { money } from '@transpo/domain';
import { space } from '@transpo/design-tokens';
import { ScreenHead } from '../components/shell';
import { useTheme, resolveColor } from '../lib/theme';
import { useLanguage, type Lang } from '../lib/i18n';

type Goal = {
  id: string;
  metric: { fr: string; ar: string };
  period: { fr: string; ar: string };
  current: number;
  target: number;
  unit: '' | '%' | '★';
  bonus: number;
};

// Barème repris de design/lib-design-system.md. `current` est une valeur
// d'exemple (pas de suivi réel des objectifs côté serveur).
const GOALS: Goal[] = [
  { id: 'deliveries', metric: { fr: 'Courses livrées', ar: 'التوصيلات المُنجزة' }, period: { fr: 'semaine', ar: 'أسبوع' }, current: 22, target: 30, unit: '', bonus: 300 },
  { id: 'rating', metric: { fr: 'Note moyenne', ar: 'متوسط التقييم' }, period: { fr: 'mois', ar: 'شهر' }, current: 4.6, target: 4.5, unit: '★', bonus: 150 },
  { id: 'successRate', metric: { fr: 'Taux de réussite', ar: 'معدل النجاح' }, period: { fr: 'mois', ar: 'شهر' }, current: 97, target: 95, unit: '%', bonus: 400 },
  { id: 'punctuality', metric: { fr: 'Ponctualité', ar: 'الالتزام بالمواعيد' }, period: { fr: 'semaine', ar: 'أسبوع' }, current: 82, target: 90, unit: '%', bonus: 120 },
];

const STR = {
  fr: {
    title: 'Objectifs & primes',
    met: (m: number, n: number) => `${m}/${n} objectifs atteints`,
    demo: "Démo — objectifs et suivi fournis à titre d'exemple, en attente d'un endpoint dédié.",
    earned: 'Prime acquise cette période',
    of: (max: string) => `sur ${max} possibles`,
    footer: 'Les objectifs et primes sont définis par votre transporteur.',
  },
  ar: {
    title: 'الأهداف والمكافآت',
    met: (m: number, n: number) => `${m}/${n} أهداف مُحقّقة`,
    demo: 'تجريبي — الأهداف والتتبع مقدَّمة كمثال، في انتظار نقطة وصول مخصصة.',
    earned: 'المكافأة المكتسبة لهذه الفترة',
    of: (max: string) => `من أصل ${max} ممكنة`,
    footer: 'يحدد الناقل الأهداف والمكافآت الخاصة بك.',
  },
} as const;

function fmtVal(v: number, unit: Goal['unit']): string {
  const n = Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',');
  return unit === '★' ? `${n} ★` : unit === '%' ? `${n} %` : n;
}

export default function ObjectivesScreen() {
  const { colors, mode } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = STR[lang as Lang] ?? STR.fr;
  const align: 'right' | 'left' = rtl ? 'right' : 'left';
  const row: 'row' | 'row-reverse' = rtl ? 'row-reverse' : 'row';

  const met = GOALS.filter((g) => g.current >= g.target);
  const totalBonus = met.reduce((a, g) => a + g.bonus, 0);
  const maxBonus = GOALS.reduce((a, g) => a + g.bonus, 0);

  return (
    <View style={[s.wrap, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHead title={t.title} sub={t.met(met.length, GOALS.length)} onBack={() => router.back()} rtl={rtl} />
      <ScrollView contentContainerStyle={s.content}>
        <View
          style={[
            s.callout,
            { backgroundColor: resolveColor('amber', 3, mode), borderColor: resolveColor('amber', 9, mode) },
          ]}
        >
          <Text style={[s.calloutTxt, { color: resolveColor('amber', 11, mode), textAlign: align }]}>{t.demo}</Text>
        </View>

        <View style={[s.earnedCard, { backgroundColor: resolveColor('green', 3, mode) }]}>
          <Text style={[s.earnedLabel, { color: resolveColor('green', 11, mode) }]}>{t.earned}</Text>
          <Text style={[s.earnedValue, { color: resolveColor('green', 11, mode) }]}>{money(totalBonus)}</Text>
          <Text style={[s.earnedSub, { color: resolveColor('green', 11, mode) }]}>{t.of(money(maxBonus))}</Text>
        </View>

        {GOALS.map((g) => {
          const pct = Math.min(100, Math.round((g.current / (g.target || 1)) * 100));
          const done = g.current >= g.target;
          const barColor = done
            ? resolveColor('green', 9, mode)
            : pct > 60
              ? resolveColor('amber', 9, mode)
              : colors.indigo9;
          return (
            <View
              key={g.id}
              style={[
                s.goalCard,
                {
                  backgroundColor: colors.panel,
                  borderColor: done ? resolveColor('green', 9, mode) : colors.border,
                },
              ]}
            >
              <View style={[s.goalHead, { flexDirection: row }]}>
                <Text style={[s.goalMetric, { color: colors.text, textAlign: align }]}>
                  {lang === 'ar' ? g.metric.ar : g.metric.fr}
                </Text>
                <View style={[s.badge, { backgroundColor: done ? resolveColor('green', 3, mode) : colors.bg }]}>
                  <Text style={[s.badgeTxt, { color: done ? resolveColor('green', 11, mode) : colors.muted }]}>
                    +{money(g.bonus)}
                  </Text>
                </View>
              </View>
              <Text style={[s.goalPeriod, { color: colors.muted, textAlign: align }]}>
                {lang === 'ar' ? g.period.ar : g.period.fr}
              </Text>
              <View style={[s.track, { backgroundColor: colors.border, flexDirection: row }]}>
                <View style={[s.fill, { width: `${pct}%`, backgroundColor: barColor }]} />
              </View>
              <View style={[s.goalFoot, { flexDirection: row }]}>
                <Text style={[s.goalFootTxt, { color: colors.muted }]}>{fmtVal(g.current, g.unit)}</Text>
                <Text style={[s.goalFootTxt, { color: colors.muted }]}>{fmtVal(g.target, g.unit)}</Text>
              </View>
            </View>
          );
        })}

        <Text style={[s.footer, { color: colors.muted, textAlign: align }]}>{t.footer}</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  content: { padding: space[4], gap: space[3], paddingBottom: 40 },
  callout: { borderWidth: 1, borderRadius: 12, padding: space[3] },
  calloutTxt: { fontSize: 12, lineHeight: 17 },
  earnedCard: { borderRadius: 14, padding: space[4], alignItems: 'center', gap: 2 },
  earnedLabel: { fontSize: 13 },
  earnedValue: { fontSize: 28, fontWeight: '800' },
  earnedSub: { fontSize: 12 },
  goalCard: { borderWidth: 1, borderRadius: 14, padding: space[3], gap: 8 },
  goalHead: { alignItems: 'center', justifyContent: 'space-between' },
  goalMetric: { fontSize: 14, fontWeight: '700', flex: 1 },
  goalPeriod: { fontSize: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeTxt: { fontSize: 11, fontWeight: '700' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  goalFoot: { justifyContent: 'space-between' },
  goalFootTxt: { fontSize: 11 },
  footer: { fontSize: 12, marginTop: 4 },
});
