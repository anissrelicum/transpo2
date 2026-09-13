// Ma tournée — onglet « Tournée ». Cf. maquette `lot3-app-livreur.jsx`
// (fonctions RouteScreen, SummaryCell) et design/PLAN-REFONTE-MOBILE.md §2 Lot C.
//
// Alimenté par un vrai endpoint (`getMissions()`), MAIS : `Order` n'expose
// aucune coordonnée GPS (cf. plan §1, ligne 11 : « pas de lat/lng dans Order »
// → pas de vraie carte). L'ordre des arrêts, la distance et le temps estimé
// sont donc calculés sur des positions FICTIVES déterministes (`pseudoLatLng`),
// uniquement pour que l'algorithme plus-proche-voisin de la maquette ait
// quelque chose à trier. C'est signalé explicitement à l'écran (bandeau) —
// jamais présenté comme une vraie carte ou une vraie optimisation.
import * as React from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { Order, OrderStatus } from '@transpo/domain';
import { STATUS_META, money } from '@transpo/domain';
import { space, touch, radius } from '@transpo/design-tokens';
import { authedClient } from '../../lib/api';
import { readJson, writeJson } from '../../lib/storage';
import { useTheme, resolveColor } from '../../lib/theme';
import { useLanguage } from '../../lib/i18n';
import { ScreenHead } from '../../components/shell';

const CACHE_KEY = 'transpo.route.cache.v1';

// Statuts qui ne représentent plus un arrêt à visiter.
const TERMINAL: OrderStatus[] = ['LIVREE', 'ANNULEE', 'ECHOUEE', 'RETOUR'];

// Point de départ fictif (centre de Casablanca, cf. maquette `DEPOT`) — sert
// uniquement de référence pour le calcul de démonstration ci-dessous.
const DEPOT: LatLng = [33.573, -7.589];

export type LatLng = readonly [number, number];

/** Distance à vol d'oiseau en km (formule de Haversine). Port pur de la maquette. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** Distance totale d'un dépôt à travers une liste ordonnée d'arrêts. */
export function routeDistanceKm(depot: LatLng, stops: readonly LatLng[]): number {
  let d = 0;
  let prev = depot;
  for (const s of stops) {
    d += haversineKm(prev, s);
    prev = s;
  }
  return d;
}

/** Tri glouton plus-proche-voisin. Port pur de la maquette (`nearestNeighbor`). */
export function nearestNeighborOrder<T extends { latlng: LatLng }>(depot: LatLng, items: readonly T[]): T[] {
  const rest = items.slice();
  const out: T[] = [];
  let cur = depot;
  while (rest.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    rest.forEach((s, i) => {
      const d = haversineKm(cur, s.latlng);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });
    const [next] = rest.splice(bestIdx, 1);
    cur = next.latlng;
    out.push(next);
  }
  return out;
}

/**
 * Coordonnée déterministe (même commande ⇒ toujours le même point) dérivée
 * de sa référence — ne représente AUCUNE position réelle, uniquement de quoi
 * illustrer le tri. `Order` n'a pas de champ lat/lng côté API.
 */
function pseudoLatLng(ref: string): LatLng {
  let h = 0;
  for (let i = 0; i < ref.length; i++) h = (h * 31 + ref.charCodeAt(i)) >>> 0;
  const dLat = ((h % 1000) / 1000 - 0.5) * 0.08;
  const dLon = (((h >> 10) % 1000) / 1000 - 0.5) * 0.08;
  return [DEPOT[0] + dLat, DEPOT[1] + dLon];
}

const STR = {
  fr: {
    title: 'Ma tournée',
    stops: (n: number) => `${n} arrêt(s)`,
    demoNotice:
      'Ordre à titre indicatif : positions et distances simulées, aucune coordonnée GPS n’est encore associée aux commandes.',
    optimize: 'Optimiser',
    optimized: 'Optimisée ✓',
    reset: 'Réinitialiser',
    remaining: 'Restants',
    distance: 'Distance',
    eta: 'Temps est.',
    empty: 'Aucune commande active pour le moment.',
    open: 'Ouvrir',
    next: 'suivant',
    delivered: (n: number) => `${n} livrée(s) aujourd’hui`,
    up: 'Monter',
    down: 'Descendre',
  },
  ar: {
    title: 'الجولة',
    stops: (n: number) => `${n} توقف`,
    demoNotice: 'الترتيب إرشادي فقط: المواقع والمسافات محاكاة، لا توجد بعد إحداثيات GPS مرتبطة بالطلبات.',
    optimize: 'تحسين الترتيب',
    optimized: 'تم التحسين ✓',
    reset: 'إعادة التعيين',
    remaining: 'المتبقي',
    distance: 'المسافة',
    eta: 'الوقت المقدر',
    empty: 'لا توجد طلبات نشطة حالياً.',
    open: 'فتح',
    next: 'التالي',
    delivered: (n: number) => `${n} تم تسليمها اليوم`,
    up: 'أعلى',
    down: 'أسفل',
  },
} as const;

export default function RouteScreen() {
  const { colors, mode } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = STR[lang === 'ar' ? 'ar' : 'fr'];

  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refsOrder, setRefsOrder] = React.useState<string[]>([]);
  const [optimized, setOptimized] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const fresh = await authedClient().getMissions();
      setOrders(fresh);
      await writeJson(CACHE_KEY, fresh);
    } catch {
      const cached = await readJson<Order[]>(CACHE_KEY, []);
      setOrders(cached);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  const pending = React.useMemo(() => orders.filter((o) => !TERMINAL.includes(o.status)), [orders]);
  const deliveredToday = orders.length - pending.length;

  // Recale l'ordre affiché quand la liste change (nouvelle commande assignée,
  // commande livrée…) tout en préservant le tri manuel/optimisé en cours pour
  // les arrêts qui restent — cf. maquette (le tri survit à `move`, se remet à
  // plat seulement si la composition des arrêts change).
  React.useEffect(() => {
    setRefsOrder((prev) => {
      const kept = prev.filter((ref) => pending.some((o) => o.ref === ref));
      const added = pending.map((o) => o.ref).filter((ref) => !kept.includes(ref));
      const next = [...kept, ...added];
      const same = next.length === prev.length && next.every((r, i) => r === prev[i]);
      return same ? prev : next;
    });
  }, [pending]);

  const stops = React.useMemo(
    () => refsOrder.map((ref) => pending.find((o) => o.ref === ref)).filter((o): o is Order => Boolean(o)),
    [refsOrder, pending],
  );
  const stopsLatLng = React.useMemo(() => stops.map((o) => ({ order: o, latlng: pseudoLatLng(o.ref) })), [stops]);

  const totalDistance = routeDistanceKm(DEPOT, stopsLatLng.map((s) => s.latlng));
  const etaMin = stops.length ? Math.round((totalDistance / 22) * 60 + stops.length * 4) : 0;

  function optimize() {
    const ordered = nearestNeighborOrder(DEPOT, stopsLatLng);
    setRefsOrder(ordered.map((s) => s.order.ref));
    setOptimized(true);
  }
  function reset() {
    setRefsOrder(pending.map((o) => o.ref));
    setOptimized(false);
  }
  function move(ref: string, dir: -1 | 1) {
    setRefsOrder((arr) => {
      const i = arr.indexOf(ref);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return arr;
      const copy = arr.slice();
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
    setOptimized(false);
  }

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.indigo9} size="large" />
      </View>
    );
  }

  return (
    <View style={[s.wrap, { backgroundColor: colors.bg }]}>
      <ScreenHead title={t.title} sub={t.stops(stops.length) + ' · ' + totalDistance.toFixed(1) + ' km'} rtl={rtl} />
      <FlatList
        data={stops}
        keyExtractor={(o) => o.ref}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <View>
            <View style={[s.notice, { borderColor: colors.border, backgroundColor: colors.panel }]}>
              <Text style={[s.noticeTxt, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>
                {t.demoNotice}
              </Text>
            </View>

            <View
              style={[
                s.optimizeCard,
                { flexDirection: rtl ? 'row-reverse' : 'row', borderColor: colors.border },
                { backgroundColor: optimized ? resolveColor('green', 3, mode) : colors.panel },
              ]}
            >
              <Text style={[s.optimizeTitle, { color: colors.text, flex: 1 }]}>{optimized ? t.optimized : t.optimize}</Text>
              <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: space[2] }}>
                {optimized && (
                  <Pressable onPress={reset} style={[s.smallBtn, { borderColor: colors.border }]}>
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600' }}>{t.reset}</Text>
                  </Pressable>
                )}
                <Pressable
                  disabled={stops.length < 2}
                  onPress={optimize}
                  style={[
                    s.smallBtn,
                    { borderColor: 'transparent', backgroundColor: stops.length < 2 ? colors.border : colors.indigo9 },
                  ]}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{t.optimize}</Text>
                </Pressable>
              </View>
            </View>

            <View style={[s.summaryRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <SummaryCell label={t.remaining} value={String(stops.length)} colors={colors} />
              <SummaryCell label={t.distance} value={totalDistance.toFixed(1) + ' km'} colors={colors} />
              <SummaryCell label={t.eta} value={etaMin + ' min'} colors={colors} />
            </View>

            {deliveredToday > 0 && (
              <Text style={[s.deliveredTxt, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>
                {t.delivered(deliveredToday)}
              </Text>
            )}

            {stops.length === 0 && (
              <View style={[s.empty, { borderColor: colors.border }]}>
                <Text style={{ color: colors.muted, textAlign: 'center' }}>{t.empty}</Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item, index }) => {
          const isCurrent = index === 0;
          const meta = STATUS_META[item.status];
          const statusColor = resolveColor(meta.color, 9, mode);
          return (
            <View
              style={[
                s.stopCard,
                {
                  borderColor: isCurrent ? resolveColor('amber', 9, mode) : colors.border,
                  backgroundColor: isCurrent ? resolveColor('amber', 3, mode) : colors.panel,
                },
              ]}
            >
              <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: space[3] }}>
                <View
                  style={[
                    s.badgeCircle,
                    { backgroundColor: isCurrent ? resolveColor('amber', 9, mode) : colors.border },
                  ]}
                >
                  <Text style={{ color: isCurrent ? '#fff' : colors.muted, fontWeight: '700' }}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: space[2] }}>
                    <Text style={[s.stopTitle, { color: colors.text }]} numberOfLines={1}>
                      {item.merchant ?? item.ref}
                    </Text>
                    {isCurrent && (
                      <View style={[s.pill, { backgroundColor: resolveColor('amber', 3, mode) }]}>
                        <Text style={{ color: resolveColor('amber', 11, mode), fontSize: 11, fontWeight: '700' }}>
                          {t.next}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={[s.stopMeta, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}
                    numberOfLines={1}
                  >
                    {item.ref} · {item.fromCity} → {item.toCity}
                    {item.cod > 0 ? ' · COD ' + money(item.cod) : ''}
                  </Text>
                  <Text style={{ color: statusColor, fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                    {lang === 'ar' ? meta.ar : meta.fr}
                  </Text>
                </View>
                <View style={{ gap: space[1] }}>
                  <Pressable
                    disabled={index === 0}
                    onPress={() => move(item.ref, -1)}
                    accessibilityLabel={t.up}
                    style={[s.moveBtn, { borderColor: colors.border, opacity: index === 0 ? 0.3 : 1 }]}
                  >
                    <Text style={{ color: colors.text, fontSize: 16 }}>↑</Text>
                  </Pressable>
                  <Pressable
                    disabled={index === stops.length - 1}
                    onPress={() => move(item.ref, 1)}
                    accessibilityLabel={t.down}
                    style={[
                      s.moveBtn,
                      { borderColor: colors.border, opacity: index === stops.length - 1 ? 0.3 : 1 },
                    ]}
                  >
                    <Text style={{ color: colors.text, fontSize: 16 }}>↓</Text>
                  </Pressable>
                </View>
              </View>
              <Pressable
                onPress={() => router.push(`/mission/${encodeURIComponent(item.ref)}`)}
                style={[s.openBtn, { borderColor: colors.indigo9 }]}
              >
                <Text style={{ color: colors.indigo9, fontWeight: '700' }}>{t.open}</Text>
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}

function SummaryCell({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={[s.summaryCell, { borderColor: colors.border, backgroundColor: colors.panel }]}>
      <Text style={[s.summaryValue, { color: colors.text }]}>{value}</Text>
      <Text style={[s.summaryLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: space[4], paddingTop: space[3], paddingBottom: space[8], gap: space[2] },
  notice: { borderWidth: 1, borderRadius: radius[3], padding: space[3], marginBottom: space[3] },
  noticeTxt: { fontSize: 12, lineHeight: 17 },
  optimizeCard: { borderWidth: 1, borderRadius: radius[3], padding: space[3], alignItems: 'center', marginBottom: space[3] },
  optimizeTitle: { fontSize: 14, fontWeight: '700' },
  smallBtn: { borderWidth: 1, borderRadius: radius[3], paddingHorizontal: space[3], height: touch.min, justifyContent: 'center' },
  summaryRow: { gap: space[2], marginBottom: space[3] },
  summaryCell: { flex: 1, borderWidth: 1, borderRadius: radius[3], alignItems: 'center', paddingVertical: space[2] },
  summaryValue: { fontSize: 16, fontWeight: '700' },
  summaryLabel: { fontSize: 11, marginTop: 2 },
  deliveredTxt: { fontSize: 12, marginBottom: space[2] },
  empty: { borderWidth: 1, borderRadius: radius[3], padding: space[5], alignItems: 'center' },
  stopCard: { borderWidth: 1, borderRadius: radius[4], padding: space[3], gap: space[2] },
  badgeCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stopTitle: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  stopMeta: { fontSize: 12, marginTop: 2 },
  pill: { borderRadius: radius.full, paddingHorizontal: space[2], paddingVertical: 2 },
  moveBtn: { width: touch.min, height: touch.min, borderWidth: 1, borderRadius: radius[2], alignItems: 'center', justifyContent: 'center' },
  openBtn: { borderWidth: 1, borderRadius: radius[3], height: touch.min, alignItems: 'center', justifyContent: 'center' },
});
