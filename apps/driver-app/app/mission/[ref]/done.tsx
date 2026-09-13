// Confirmation de livraison — cf. maquette `Done`. Reprend la logique
// « commande introuvable dans `getMissions()` = déjà livrée » de la fin de
// l'ancien `mission/[ref].tsx` : après le seul appel `driverProof()` (cf.
// `proof.tsx`), la commande sort de la liste des missions actives dès que le
// serveur l'a traitée ; ce récap s'appuie donc sur les paramètres transmis par
// `proof.tsx` plutôt que de re-consulter une liste qui peut déjà l'avoir perdue.
import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import type { Order } from '@transpo/domain';
import { money } from '@transpo/domain';
import { radius, space } from '@transpo/design-tokens';
import { readJson } from '../../../lib/storage';
import { useTheme } from '../../../lib/theme';
import { useLanguage } from '../../../lib/i18n';
import { PrimaryBtn } from '../../../components/shell';

const CACHE_KEY = 'transpo.missions.v1';

const T = {
  fr: {
    title: 'Livraison réussie',
    collected: (m: string) => `${m} encaissés`,
    proof: 'Preuve', photoAndSig: 'Photo + signature', photoOnly: 'Photo', sigOnly: 'Signature', noProof: 'Aucune',
    nextMission: 'Prochaine mission', none: 'Aucune autre mission en attente',
    next: 'Mission suivante',
  },
  ar: {
    title: 'تم التسليم بنجاح',
    collected: (m: string) => `تم تحصيل ${m}`,
    proof: 'الإثبات', photoAndSig: 'صورة + توقيع', photoOnly: 'صورة', sigOnly: 'توقيع', noProof: 'لا شيء',
    nextMission: 'المهمة التالية', none: 'لا توجد مهمة أخرى بالانتظار',
    next: 'المهمة التالية',
  },
} as const;

export default function Done() {
  const { ref, cod, photo, signature } = useLocalSearchParams<{ ref: string; cod?: string; photo?: string; signature?: string }>();
  const { colors } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = T[lang === 'ar' ? 'ar' : 'fr'];

  const [nextRef, setNextRef] = React.useState<string | null>(null);

  React.useEffect(() => {
    readJson<Order[]>(CACHE_KEY, []).then((orders) => {
      const next = orders.find((o) => o.ref !== ref && o.status !== 'LIVREE' && o.status !== 'ANNULEE' && o.status !== 'ECHOUEE');
      setNextRef(next ? next.ref : null);
    });
  }, [ref]);

  const amount = Number(cod) || 0;
  const hasPhoto = photo === '1';
  const hasSignature = signature === '1';
  const proofLabel = hasPhoto && hasSignature ? t.photoAndSig : hasPhoto ? t.photoOnly : hasSignature ? t.sigOnly : t.noProof;

  return (
    <View style={[s.wrap, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.center}>
        <View style={[s.check, { backgroundColor: colors.indigo9 + '33' }]}>
          <Text style={[s.checkTxt, { color: colors.indigo9 }]}>✓</Text>
        </View>
        <Text style={[s.title, { color: colors.text }]}>{t.title}</Text>
        <Text style={[s.sub, { color: colors.muted }]}>
          {ref}{amount > 0 ? ` · ${t.collected(money(amount))}` : ''}
        </Text>

        <View style={[s.card, { backgroundColor: colors.panel, borderColor: colors.border }]}>
          <View style={[s.cardRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <Text style={[s.cardLabel, { color: colors.muted }]}>{t.proof}</Text>
            <Text style={[s.cardValue, { color: colors.text }]}>{proofLabel}</Text>
          </View>
          <View style={[s.sep, { backgroundColor: colors.border }]} />
          <View style={[s.cardRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <Text style={[s.cardLabel, { color: colors.muted }]}>{t.nextMission}</Text>
            <Text style={[s.cardValue, { color: colors.text }]}>{nextRef ?? t.none}</Text>
          </View>
        </View>
      </View>
      <View style={s.footer}>
        <PrimaryBtn onPress={() => router.replace('/(tabs)/missions')}>{t.next}</PrimaryBtn>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: space[5] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[3] },
  check: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  checkTxt: { fontSize: 44, fontWeight: '800' },
  title: { fontSize: 24, fontWeight: '800' },
  sub: { fontSize: 14 },
  card: { width: '100%', borderRadius: radius[5], borderWidth: 1, padding: space[4], marginTop: space[3] },
  cardRow: { justifyContent: 'space-between', alignItems: 'center' },
  cardLabel: { fontSize: 13 },
  cardValue: { fontSize: 14, fontWeight: '600' },
  sep: { height: 1, marginVertical: 10 },
  footer: { paddingBottom: space[3] },
});
