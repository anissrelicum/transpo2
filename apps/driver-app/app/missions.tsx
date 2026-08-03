import * as React from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { Order } from '@transpo/domain';
import { STATUS_META } from '@transpo/domain';
import { authedClient, getSession, clearSession } from '../lib/api';
import { readJson, writeJson } from '../lib/storage';
import { applyPending, clear as clearOutbox } from '../lib/outbox';
import { useOutbox } from '../lib/useOutbox';
import { C, STATUS_COLOR } from '../lib/theme';

const CACHE_KEY = 'transpo.missions.v1';

export default function MissionsScreen() {
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [stale, setStale] = React.useState(false);
  const name = getSession()?.name ?? '';

  const { pending, online, syncing, sync } = useOutbox((r) => {
    if (r.rejected.length > 0) {
      Alert.alert(
        'Action refusée',
        r.rejected.map((x) => `${x.ref} — ${x.reason}`).join('\n'),
      );
    }
    loadData();
  });

  const loadData = React.useCallback(async () => {
    try {
      const fresh = await authedClient().getMissions();
      setOrders(fresh);
      setStale(false);
      await writeJson(CACHE_KEY, fresh); // dernier état connu, relu hors ligne
    } catch {
      // Hors ligne : on retombe sur le cache plutôt que d'afficher une page vide.
      const cached = await readJson<Order[]>(CACHE_KEY, []);
      setOrders(cached);
      setStale(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(React.useCallback(() => { loadData(); sync(); }, [loadData, sync]));

  async function logout() {
    if (pending.length > 0) {
      Alert.alert(
        'Actions non synchronisées',
        `${pending.length} action(s) n’ont pas encore été transmises. Se déconnecter les supprimera définitivement.`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Se déconnecter', style: 'destructive', onPress: doLogout },
        ],
      );
      return;
    }
    doLogout();
  }

  async function doLogout() {
    await clearOutbox();
    await clearSession();
    router.replace('/');
  }

  // Les missions affichées intègrent les actions encore en file.
  const view = applyPending(orders, pending);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.indigo} size="large" /></View>;

  return (
    <View style={s.wrap}>
      <View style={s.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={s.hello}>Bonjour {name}</Text>
          <Text style={s.count}>{view.length} mission(s) active(s)</Text>
        </View>
        <Pressable onPress={logout} hitSlop={10}><Text style={s.logout}>Déconnexion</Text></Pressable>
      </View>

      {!online && (
        <View style={[s.banner, s.bannerWarn]}>
          <Text style={s.bannerTxt}>
            Hors ligne{stale ? ' — missions du dernier chargement' : ''}. Vos actions sont enregistrées et partiront au retour du réseau.
          </Text>
        </View>
      )}
      {pending.length > 0 && (
        <View style={[s.banner, s.bannerInfo]}>
          <Text style={s.bannerTxt}>
            {pending.length} action(s) en attente{syncing ? ' — envoi en cours…' : ''}
          </Text>
          {online && !syncing && (
            <Pressable onPress={sync}><Text style={s.bannerAction}>Réessayer</Text></Pressable>
          )}
        </View>
      )}

      <FlatList
        data={view}
        keyExtractor={(o) => o.ref}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => { loadData(); sync(); }} />}
        ListEmptyComponent={<Text style={s.empty}>Aucune mission active. Tirez pour rafraîchir.</Text>}
        renderItem={({ item }) => {
          const queued = pending.some((p) => p.ref === item.ref);
          return (
            <Pressable style={s.card} onPress={() => router.push(`/mission/${encodeURIComponent(item.ref)}`)}>
              <View style={s.rowBetween}>
                <Text style={s.ref}>{item.ref}</Text>
                <View style={[s.badge, { backgroundColor: (STATUS_COLOR[item.status] || C.muted) + '22' }]}>
                  <Text style={[s.badgeTxt, { color: STATUS_COLOR[item.status] || C.muted }]}>
                    {STATUS_META[item.status]?.fr ?? item.status}
                  </Text>
                </View>
              </View>
              <Text style={s.route}>{item.fromCity} → {item.toCity}</Text>
              <View style={s.rowBetween}>
                <Text style={s.merchant}>{item.merchant ?? '—'}</Text>
                {item.cod > 0 && (
                  <Text style={[s.cod, { color: item.codPaid ? C.green : C.amber }]}>
                    COD {item.cod} DH{item.codPaid ? ' ✓' : ''}
                  </Text>
                )}
              </View>
              {queued && <Text style={s.queued}>⏳ en attente d’envoi</Text>}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  hello: { fontSize: 20, fontWeight: '800', color: C.text },
  count: { fontSize: 13, color: C.muted, marginBottom: 12 },
  logout: { fontSize: 13, color: C.muted, fontWeight: '600' },
  banner: { borderRadius: 10, padding: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bannerWarn: { backgroundColor: C.amber + '22' },
  bannerInfo: { backgroundColor: C.indigo + '18' },
  bannerTxt: { fontSize: 12, color: C.text, flex: 1, paddingRight: 8 },
  bannerAction: { fontSize: 12, fontWeight: '700', color: C.indigo },
  empty: { color: C.muted, textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, marginBottom: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ref: { fontSize: 15, fontWeight: '700', color: C.text },
  route: { fontSize: 14, color: C.muted, marginVertical: 6 },
  merchant: { fontSize: 13, color: C.text },
  cod: { fontSize: 13, fontWeight: '700' },
  queued: { fontSize: 12, color: C.amber, marginTop: 8, fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeTxt: { fontSize: 12, fontWeight: '700' },
});
