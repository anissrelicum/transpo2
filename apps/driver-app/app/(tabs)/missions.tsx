// Missions du jour — cf. maquette (fonction `Missions`, écran 9). Onglet par
// défaut de la barre du bas. Redesign visuel de l'ancien `app/missions.tsx`
// (déplacé ici) : la logique offline/cache/idempotence est conservée à
// l'identique (cf. design/PLAN-REFONTE-MOBILE.md, Lot A).
//
// Écarts assumés vs. la maquette (données non disponibles dans `Order`,
// cf. §1 du plan — on n'invente pas de champ) :
//  - pas de distance par mission (`dist` de la maquette est une donnée de
//    démo) : remplacée par le marchand, déjà affiché dans l'ancien écran ;
//  - pas de compteur « Livrées » (getMissions() ne renvoie que les missions
//    actives, aucune notion de « aujourd'hui » côté API) : la 2e carte
//    résume plutôt le COD à encaisser, entièrement dérivable des commandes
//    en cours.
import * as React from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { router, useFocusEffect } from 'expo-router';
import type { Order, OrderStatus } from '@transpo/domain';
import { STATUS_META, money } from '@transpo/domain';
import type { DriverOffer } from '@transpo/api-client';
import { authedClient, getSession, idemKey } from '../../lib/api';
import { readJson, writeJson } from '../../lib/storage';
import { applyPending, enqueue } from '../../lib/outbox';
import { ecouterPropositions } from '../../lib/offer-signal';
import { OfferCard } from '../../components/OfferCard';
import { useOutbox } from '../../lib/useOutbox';
import { useTheme, statusColorHex } from '../../lib/theme';
import { useLanguage } from '../../lib/i18n';
import { touch, radius, space } from '@transpo/design-tokens';

const CACHE_KEY = 'transpo.missions.v1';
// Compteur de non-lus des notifications (écran statique, cf. notifications.tsx) —
// partagé via le stockage local plutôt que recalculé ici, pour ne pas dupliquer
// la liste de démo NOTIFS dans deux fichiers.
const NOTIF_UNREAD_KEY = 'transpo.notifs.unreadCount';
// Relecture des propositions tant que l'écran est affiché : sans push (Expo Go, appareil
// non enregistré), c'est elle qui fait apparaître une course proposée.
const OFFERS_POLL_MS = 15000;

// -----------------------------------------------------------------------------
// Icônes propres à cet écran (cf. app/index.tsx pour la justification : le
// module protégé `components/shell/icons.tsx` ne couvre pas ces glyphes).
// -----------------------------------------------------------------------------
function iconProps(size: number, color: string) {
  return {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  };
}
function BellIcon({ size = 18, color }: { size?: number; color: string }) {
  return (
    <Svg {...iconProps(size, color)}>
      <Path d="M7 10a5 5 0 0 1 10 0c0 4 1.5 5.5 1.5 5.5h-13S7 14 7 10Z" />
      <Path d="M10.3 18.5a1.9 1.9 0 0 0 3.4 0" />
    </Svg>
  );
}
function CrossIcon({ size = 14, color }: { size?: number; color: string }) {
  return (
    <Svg {...iconProps(size, color)}>
      <Path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}
function HomeIcon({ size = 15, color }: { size?: number; color: string }) {
  return (
    <Svg {...iconProps(size, color)}>
      <Path d="M4 11.5L12 4l8 7.5" />
      <Path d="M6 10v9h12v-9" />
    </Svg>
  );
}
function PinIcon({ size = 15, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.6a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2Z" />
    </Svg>
  );
}
function CubeIcon({ size = 13, color }: { size?: number; color: string }) {
  return (
    <Svg {...iconProps(size, color)}>
      <Path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <Path d="M4.5 7.5L12 12l7.5-4.5" />
      <Path d="M12 12v9" />
    </Svg>
  );
}

function statusPill(status: OrderStatus, mode: 'light' | 'dark', lang: 'fr' | 'ar') {
  const meta = STATUS_META[status];
  return {
    label: lang === 'ar' ? meta.ar : meta.fr,
    bg: statusColorHex(status, 3, mode),
    fg: statusColorHex(status, 11, mode),
  };
}

/** Puce COD — cf. design/lib-design-system.md §CodChip (mêmes libellés que la console web). */
function codLabel(order: Order, lang: 'fr' | 'ar'): { text: string; color: 'green' | 'amber' } | null {
  if (!order.cod) return null;
  if (lang === 'ar') return { text: (order.codPaid ? 'حُصّل: ' : 'للتحصيل: ') + money(order.cod), color: order.codPaid ? 'green' : 'amber' };
  return { text: (order.codPaid ? 'COD encaissé · ' : 'COD à encaisser · ') + money(order.cod), color: order.codPaid ? 'green' : 'amber' };
}

const L = {
  fr: { title: 'Mes missions', active: (n: number) => `${n} active${n > 1 ? 's' : ''}`, toDeliver: 'À livrer', codLeft: 'COD à encaisser', prepaid: 'Prépayé', empty: 'Aucune mission active. Tirez pour rafraîchir.', queued: 'En attente d’envoi', pushTitle: 'Nouvelle mission assignée', pushBody: 'Consultez vos notifications', offline: 'Hors ligne', offlineStale: ' — missions du dernier chargement', offlineHint: '. Vos actions sont enregistrées et partiront au retour du réseau. Touchez pour voir le détail.', pending: (n: number) => `${n} action(s) en attente`, pendingHint: ' — voir le détail', syncing: ' — envoi en cours…', retry: 'Réessayer' },
  ar: { title: 'مهامي', active: (n: number) => `${n} نشطة`, toDeliver: 'للتسليم', codLeft: 'للتحصيل', prepaid: 'مدفوع مسبقاً', empty: 'لا توجد مهام نشطة. اسحب للتحديث.', queued: 'في انتظار الإرسال', pushTitle: 'مهمة جديدة مُسندة', pushBody: 'راجع إشعاراتك', offline: 'غير متصل', offlineStale: ' — مهام آخر تحميل', offlineHint: '. تُسجَّل إجراءاتك وتُرسَل عند عودة الشبكة. اضغط لرؤية التفاصيل.', pending: (n: number) => `${n} إجراء (إجراءات) في الانتظار`, pendingHint: ' — عرض التفاصيل', syncing: ' — جارٍ الإرسال…', retry: 'إعادة المحاولة' },
};

export default function MissionsScreen() {
  const { mode, colors } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = L[lang];

  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [stale, setStale] = React.useState(false);
  // Refus du serveur (403, 500…) — distinct d'une coupure réseau, et affiché comme tel.
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [unread, setUnread] = React.useState(0);
  const [showPush, setShowPush] = React.useState(false);
  // Courses proposées par l'affectation automatique. Jamais servies depuis le cache : une
  // proposition vit quelques minutes, une copie hors ligne serait presque toujours échue.
  const [offers, setOffers] = React.useState<DriverOffer[]>([]);
  const [offsetMs, setOffsetMs] = React.useState(0);
  const name = getSession()?.name ?? '';

  const { pending, online, syncing, sync } = useOutbox((r) => {
    if (r.rejected.length > 0) {
      Alert.alert(
        lang === 'ar' ? 'إجراء مرفوض' : 'Action refusée',
        r.rejected.map((x) => `${x.ref} — ${x.reason}`).join('\n'),
      );
    }
    loadData();
  });

  const loadOffers = React.useCallback(async () => {
    try {
      const fresh = await authedClient().getMyOffers();
      setOffers(fresh);
      if (fresh[0]) setOffsetMs(new Date(fresh[0].serverNow).getTime() - Date.now());
    } catch {
      setOffers([]);
    }
  }, []);

  const loadData = React.useCallback(async () => {
    void loadOffers();
    try {
      const fresh = await authedClient().getMissions();
      setOrders(fresh);
      setStale(false);
      setServerError(null);
      await writeJson(CACHE_KEY, fresh); // dernier état connu, relu hors ligne
    } catch (e) {
      // Hors ligne : on retombe sur le cache plutôt que d'afficher une page vide.
      //
      // Un REFUS DU SERVEUR n'est pas une coupure réseau : le confondre avec l'absence de
      // réseau a masqué pendant tout un lot une API qui répondait 403 sur chaque appel. Le
      // livreur lisait « Aucune mission active » et en concluait qu'il n'avait pas de
      // travail. Une erreur applicative doit se voir.
      const cached = await readJson<Order[]>(CACHE_KEY, []);
      setOrders(cached);
      setStale(true);
      const statut = (e as { status?: number })?.status;
      setServerError(statut ? `Le serveur a refusé la demande (${statut}).` : null);
    } finally {
      setLoading(false);
    }
  }, [loadOffers]);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
      sync();
      readJson<number>(NOTIF_UNREAD_KEY, 0).then((n) => { setUnread(n); setShowPush(n > 0); });
      const id = setInterval(() => { void loadOffers(); }, OFFERS_POLL_MS);
      const off = ecouterPropositions(() => { void loadOffers(); });
      return () => { clearInterval(id); off(); };
    }, [loadData, loadOffers, sync]),
  );

  /**
   * Réponse à une proposition : écrite dans la file d'abord (hors ligne compris), puis
   * envoyée. La clé d'idempotence est stable par (proposition, décision) : un rejeu après
   * coupure ne produit qu'un effet. Un refus du serveur (échéance dépassée, course déjà
   * prise) remonte par l'alerte « Action refusée » de la file.
   */
  const respond = React.useCallback(async (f: DriverOffer, decision: 'accept' | 'refuse') => {
    await enqueue({ kind: 'offer', ref: f.ref, offerId: f.id, decision, idemKey: idemKey(f.id, `offer-${decision}`) });
    await sync();
    await loadData();
  }, [sync, loadData]);
  const onOfferExpired = React.useCallback(() => {
    // Laisser le serveur réattribuer, puis relire : la carte disparaît d'elle-même.
    setTimeout(() => { void loadOffers(); }, 3000);
  }, [loadOffers]);

  // Les missions affichées intègrent les actions encore en file.
  const view = applyPending(orders, pending);
  const codToCollect = view.reduce((sum, o) => sum + (o.codPaid ? 0 : o.cod), 0);

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.indigo9} size="large" />
      </View>
    );
  }

  return (
    <View style={[s.wrap, { backgroundColor: colors.bg }]}>
      <View style={[s.headRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.hello, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>{t.title}</Text>
          <Text style={[s.sub, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>
            {name ? `${name} · ` : ''}{t.active(view.length)}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/notifications')}
          hitSlop={8}
          style={[s.bell, { backgroundColor: colors.panel, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel={lang === 'ar' ? 'الإشعارات' : 'Notifications'}
        >
          <BellIcon size={18} color={colors.text} />
          {unread > 0 && (
            <View style={[s.unreadDot, { backgroundColor: statusColorHex('ECHOUEE', 9, mode) }]}>
              <Text style={s.unreadTxt}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <View style={[s.statsRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        <View style={[s.statCard, { backgroundColor: colors.panel, borderColor: colors.border }]}>
          <Text style={[s.statLabel, { color: colors.muted }]}>{t.toDeliver}</Text>
          <Text style={[s.statValue, { color: colors.text }]}>{view.length}</Text>
        </View>
        <View style={[s.statCard, { backgroundColor: colors.panel, borderColor: colors.border }]}>
          <Text style={[s.statLabel, { color: colors.muted }]}>{t.codLeft}</Text>
          <Text style={[s.statValue, { color: statusColorHex('LIVRAISON', 11, mode) }]}>{money(codToCollect)}</Text>
        </View>
      </View>

      {!online && (
        <Pressable
          onPress={() => router.push('/sync-queue')}
          style={[s.banner, { backgroundColor: statusColorHex('LIVRAISON', 3, mode), flexDirection: rtl ? 'row-reverse' : 'row' }]}
        >
          <Text style={[s.bannerTxt, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
            {t.offline}{stale ? t.offlineStale : ''}{t.offlineHint}
          </Text>
        </Pressable>
      )}

      {showPush && (
        <View style={[s.push, { backgroundColor: colors.indigo9 + '18', borderColor: colors.indigo9 + '33', flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <View style={[s.pushIcon, { backgroundColor: colors.indigo9 }]}><BellIcon size={16} color="white" /></View>
          <Pressable style={{ flex: 1 }} onPress={() => { setShowPush(false); router.push('/notifications'); }}>
            <Text style={[s.pushTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>{t.pushTitle}</Text>
            <Text style={[s.pushBody, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>{t.pushBody}</Text>
          </Pressable>
          <Pressable onPress={() => setShowPush(false)} hitSlop={8} style={s.pushClose}>
            <CrossIcon size={14} color={colors.muted} />
          </Pressable>
        </View>
      )}

      {pending.length > 0 && (
        // Le compteur MÈNE à la file : tant qu'il n'était qu'un texte, l'écran de
        // synchronisation n'était atteignable que par le bandeau « Hors ligne » — donc
        // plus du tout dès que le réseau revenait avec des actions encore bloquées,
        // exactement le moment où le livreur a besoin de voir ce qui coince.
        <View style={[s.banner, { backgroundColor: colors.indigo9 + '18', flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <Pressable style={{ flex: 1 }} onPress={() => router.push('/sync-queue')} accessibilityRole="button">
            <Text style={[s.bannerTxt, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
              {t.pending(pending.length)}{syncing ? t.syncing : ''}{t.pendingHint}
            </Text>
          </Pressable>
          {online && !syncing && (
            <Pressable onPress={sync} hitSlop={16}><Text style={[s.bannerAction, { color: colors.indigo9 }]}>{t.retry}</Text></Pressable>
          )}
        </View>
      )}

      {serverError && (

        <View style={{ paddingHorizontal: space[4], paddingBottom: space[2] }}>

          <Text style={{ color: statusColorHex('ECHOUEE'), fontSize: 13 }} testID="missions-erreur-serveur">

            {serverError}

          </Text>

        </View>

      )}

      {offers.map((f) => (
        <OfferCard
          key={f.id}
          offer={f}
          offsetMs={offsetMs}
          lang={lang}
          rtl={rtl}
          queued={pending.some((p) => p.kind === 'offer' && p.offerId === f.id)}
          onRespond={(d) => { void respond(f, d); }}
          onExpired={onOfferExpired}
        />
      ))}

      <FlatList
        data={view}
        keyExtractor={(o) => o.ref}
        contentContainerStyle={{ paddingBottom: space[6] }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => { loadData(); sync(); }} tintColor={colors.indigo9} />}
        ListEmptyComponent={<Text style={[s.empty, { color: colors.muted }]}>{t.empty}</Text>}
        renderItem={({ item, index }) => {
          const queued = pending.some((p) => p.ref === item.ref);
          const pill = statusPill(item.status, mode, lang);
          const cod = codLabel(item, lang);
          return (
            <Pressable
              style={[s.card, { backgroundColor: colors.panel, borderColor: colors.border }]}
              onPress={() => router.push(`/mission/${encodeURIComponent(item.ref)}`)}
            >
              <View style={[s.rowBetween, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                <View style={[s.rowStart, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                  <View style={[s.indexBadge, { backgroundColor: colors.indigo9 }]}><Text style={s.indexTxt}>{index + 1}</Text></View>
                  <Text style={[s.ref, { color: colors.text }]}>{item.ref}</Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: pill.bg }]}>
                  <Text style={[s.statusTxt, { color: pill.fg }]}>{pill.label}</Text>
                </View>
              </View>

              <View style={{ marginVertical: space[2], gap: 6 }}>
                <View style={[s.addrRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                  <HomeIcon size={14} color={colors.muted} />
                  <Text style={[s.addrTxt, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>{item.fromCity}</Text>
                </View>
                <View style={[s.addrRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                  <PinIcon size={14} color={colors.indigo9} />
                  <Text style={[s.addrTxt, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>{item.toCity}</Text>
                </View>
              </View>

              <View style={[s.divider, { backgroundColor: colors.border }]} />

              <View style={[s.rowBetween, { flexDirection: rtl ? 'row-reverse' : 'row', marginTop: space[2] }]}>
                <View style={[s.rowStart, { flexDirection: rtl ? 'row-reverse' : 'row', flex: 1, minWidth: 0 }]}>
                  <CubeIcon size={13} color={colors.muted} />
                  <Text style={[s.merchant, { color: colors.muted }]} numberOfLines={1}>{item.merchant ?? item.size}</Text>
                </View>
                {cod ? (
                  <View style={[s.codPill, { backgroundColor: statusColorHex(cod.color === 'green' ? 'LIVREE' : 'LIVRAISON', 3, mode) }]}>
                    <Text style={[s.codTxt, { color: statusColorHex(cod.color === 'green' ? 'LIVREE' : 'LIVRAISON', 11, mode) }]}>{cod.text}</Text>
                  </View>
                ) : (
                  <View style={[s.codPill, { backgroundColor: colors.border }]}>
                    <Text style={[s.codTxt, { color: colors.muted }]}>{t.prepaid}</Text>
                  </View>
                )}
              </View>

              {queued && <Text style={[s.queued, { color: statusColorHex('LIVRAISON', 11, mode) }]}>{t.queued}</Text>}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: space[4] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headRow: { alignItems: 'flex-start', gap: space[2] },
  hello: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 13, marginTop: 2 },
  bell: { width: touch.min, height: touch.min, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  unreadDot: { position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  unreadTxt: { color: 'white', fontSize: 10, fontWeight: '700' },
  statsRow: { gap: space[2], marginTop: space[3] },
  statCard: { flex: 1, borderRadius: radius[3], borderWidth: 1, padding: space[2] },
  statLabel: { fontSize: 11 },
  statValue: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  banner: { borderRadius: radius[3], padding: space[2], marginTop: space[3], alignItems: 'center' },
  bannerTxt: { fontSize: 12 },
  bannerAction: { fontSize: 12, fontWeight: '700' },
  push: { borderRadius: radius[3], borderWidth: 1, padding: space[2], marginTop: space[3], alignItems: 'center', gap: space[2] },
  pushIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  pushTitle: { fontSize: 13, fontWeight: '600' },
  pushBody: { fontSize: 11, marginTop: 1 },
  pushClose: { width: touch.min, height: touch.min, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', marginTop: 40 },
  card: { borderRadius: radius[4], borderWidth: 1, padding: space[3], marginTop: space[3] },
  rowBetween: { justifyContent: 'space-between', alignItems: 'center' },
  rowStart: { alignItems: 'center', gap: space[2] },
  indexBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  indexTxt: { color: 'white', fontSize: 11, fontWeight: '700' },
  ref: { fontSize: 14, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  statusTxt: { fontSize: 11, fontWeight: '700' },
  addrRow: { alignItems: 'flex-start', gap: 8 },
  addrTxt: { fontSize: 13, flex: 1 },
  divider: { height: 1 },
  merchant: { fontSize: 12, flex: 1 },
  codPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  codTxt: { fontSize: 11, fontWeight: '700' },
  queued: { fontSize: 12, marginTop: space[2], fontWeight: '600' },
});
