// Notifications — cf. maquette (fonction `Notifications`, écran 3). Écran de
// flux (pas d'onglet), atteint depuis la cloche de `(tabs)/missions.tsx`.
// AUCUN backend (cf. design/PLAN-REFONTE-MOBILE.md §5) : liste figée, signalée
// comme telle par le callout ci-dessous — pas de simulation d'appel serveur.
import * as React from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { router, Stack } from 'expo-router';
import { useTheme, statusColorHex } from '../lib/theme';
import { useLanguage } from '../lib/i18n';
import { ScreenHead, ArchiveIcon, LapTimerIcon } from '../components/shell';
import { writeJson } from '../lib/storage';
import { space, radius, touch } from '@transpo/design-tokens';

const NOTIF_UNREAD_KEY = 'transpo.notifs.unreadCount';

function iconProps(size: number, color: string) {
  return {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  };
}
function PinIcon({ size = 16, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.6a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2Z" />
    </Svg>
  );
}
function CrossIcon({ size = 16, color }: { size?: number; color: string }) {
  return <Svg {...iconProps(size, color)}><Path d="M6 6l12 12M18 6L6 18" /></Svg>;
}
function CubeIcon({ size = 16, color }: { size?: number; color: string }) {
  return (
    <Svg {...iconProps(size, color)}>
      <Path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <Path d="M4.5 7.5L12 12l7.5-4.5" />
      <Path d="M12 12v9" />
    </Svg>
  );
}
function InfoIcon({ size = 16, color }: { size?: number; color: string }) {
  return (
    <Svg {...iconProps(size, color)}>
      <Path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
      <Path d="M12 11v5.5" />
    </Svg>
  );
}

type NotifType = 'mission' | 'address' | 'cancel' | 'cod' | 'shift';
type Notif = { id: string; type: NotifType; titleFr: string; titleAr: string; bodyFr: string; bodyAr: string; time: string; unread: boolean };

// Données de démonstration reprises de la maquette (aucune source serveur, cf.
// écran « sans backend » du plan). Les délais relatifs ('il y a 2 min'…) sont
// figés comme dans la maquette plutôt que recalculés depuis une horloge fictive.
const NOTIFS: Notif[] = [
  { id: 'n1', type: 'mission', titleFr: 'Nouvelle mission assignée', titleAr: 'مهمة جديدة مُسندة', bodyFr: 'CMD-…018 — retrait Boutique Zellige, Maârif', bodyAr: 'CMD-…018 — الاستلام من Boutique Zellige، معاريف', time: 'il y a 2 min', unread: true },
  { id: 'n2', type: 'address', titleFr: 'Changement d’adresse', titleAr: 'تغيير العنوان', bodyFr: 'CMD-…014 — nouvelle adresse : 8 av. Hassan II, Agdal', bodyAr: 'CMD-…014 — عنوان جديد: 8 شارع الحسن الثاني، أكدال', time: 'il y a 8 min', unread: true },
  { id: 'n3', type: 'cancel', titleFr: 'Mission annulée', titleAr: 'إلغاء المهمة', bodyFr: 'CMD-…012 a été annulée par le marchand', bodyAr: 'تم إلغاء CMD-…012 من طرف التاجر', time: 'il y a 21 min', unread: true },
  { id: 'n4', type: 'cod', titleFr: 'Rappel COD', titleAr: 'تذكير بالتحصيل', bodyFr: 'CMD-…009 — encaisser 3 200 DH à la livraison', bodyAr: 'CMD-…009 — تحصيل 3200 درهم عند التسليم', time: 'il y a 40 min', unread: false },
  { id: 'n5', type: 'shift', titleFr: 'Pause obligatoire bientôt', titleAr: 'استراحة إلزامية قريبًا', bodyFr: 'EU 561 — 45 min de pause requises dans 30 min', bodyAr: 'EU 561 — استراحة 45 دقيقة مطلوبة خلال 30 دقيقة', time: 'il y a 1 h', unread: false },
];

const L = {
  fr: { title: 'Notifications', unread: (n: number) => `${n} non lue(s)`, allRead: 'Tout lire', demo: 'Données de démonstration — aucune notification serveur pour l’instant.' },
  ar: { title: 'الإشعارات', unread: (n: number) => `${n} غير مقروءة`, allRead: 'قراءة الكل', demo: 'بيانات تجريبية — لا يوجد إشعار حقيقي من الخادم حاليًا.' },
};

export default function NotificationsScreen() {
  const { mode, colors } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = L[lang];
  const [items, setItems] = React.useState<Notif[]>(NOTIFS);

  const unread = items.filter((n) => n.unread).length;

  // Le badge de la cloche (missions.tsx) reflète ce compteur — persisté plutôt
  // que dupliqué, cf. commentaire en tête de (tabs)/missions.tsx.
  React.useEffect(() => { writeJson(NOTIF_UNREAD_KEY, unread); }, [unread]);

  function read(id: string) {
    setItems((a) => a.map((n) => (n.id === id ? { ...n, unread: false } : n)));
  }
  function allRead() {
    setItems((a) => a.map((n) => ({ ...n, unread: false })));
  }

  const TYPE_META: Record<NotifType, { Icon: React.ComponentType<{ size?: number; color: string }>; status: 'ASSIGNEE' | 'LIVRAISON' | 'ECHOUEE' | 'LIVREE' | 'RETRAIT' }> = {
    mission: { Icon: ArchiveIcon, status: 'ASSIGNEE' },
    address: { Icon: PinIcon, status: 'LIVRAISON' },
    cancel: { Icon: CrossIcon, status: 'ECHOUEE' },
    cod: { Icon: CubeIcon, status: 'LIVREE' },
    shift: { Icon: LapTimerIcon, status: 'RETRAIT' },
  };

  return (
    <View style={[s.flex, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHead
        title={t.title}
        sub={t.unread(unread)}
        onBack={() => router.back()}
        rtl={rtl}
        right={
          <Pressable disabled={unread === 0} onPress={allRead} hitSlop={8} style={s.allRead}>
            <Text style={[s.allReadTxt, { color: unread === 0 ? colors.muted : colors.indigo9 }]}>{t.allRead}</Text>
          </Pressable>
        }
      />
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: space[4], gap: space[2] }}
        ListHeaderComponent={
          <View style={[s.callout, { backgroundColor: colors.panel, borderColor: colors.border, flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <InfoIcon size={15} color={colors.muted} />
            <Text style={[s.calloutTxt, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>{t.demo}</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: space[2] }} />}
        renderItem={({ item }) => {
          const meta = TYPE_META[item.type];
          const bg = statusColorHex(meta.status, 3, mode);
          const fg = statusColorHex(meta.status, 11, mode);
          return (
            <Pressable
              onPress={() => read(item.id)}
              style={[
                s.card,
                { backgroundColor: item.unread ? bg : colors.panel, borderColor: item.unread ? fg + '55' : colors.border, flexDirection: rtl ? 'row-reverse' : 'row' },
              ]}
            >
              <View style={[s.icon, { backgroundColor: fg + '22' }]}>
                <meta.Icon size={18} color={fg} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={[s.rowBetween, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                  <Text style={[s.title, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]} numberOfLines={1}>
                    {lang === 'ar' ? item.titleAr : item.titleFr}
                  </Text>
                  {item.unread && <View style={[s.dot, { backgroundColor: fg }]} />}
                </View>
                <Text style={[s.body, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>{lang === 'ar' ? item.bodyAr : item.bodyFr}</Text>
                <Text style={[s.time, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>{item.time}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  allRead: { minHeight: touch.min, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  allReadTxt: { fontSize: 13, fontWeight: '600' },
  callout: { borderRadius: radius[3], borderWidth: 1, padding: space[3], gap: space[2], marginBottom: space[2] },
  calloutTxt: { flex: 1, fontSize: 12 },
  card: { borderRadius: radius[4], borderWidth: 1, padding: space[3], gap: space[3], alignItems: 'flex-start' },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rowBetween: { justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { fontSize: 14, fontWeight: '600', flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  body: { fontSize: 12, marginTop: 2 },
  time: { fontSize: 11, marginTop: 4 },
});
