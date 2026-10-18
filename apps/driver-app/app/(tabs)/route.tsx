// Ma tournée — la même journée que la carte, en liste (maquette validée, acte 2).
//
// L'ordre est celui de la carte : tournée planifiée par l'agence s'il y en a une (elle
// fait foi, pas de réordonnancement), sinon l'ordre calculé au plus court depuis la
// position du livreur, qu'il peut changer à la main s'il connaît mieux le terrain.
import * as React from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { money } from '@transpo/domain';
import { useTheme } from '../../lib/theme';
import { useLanguage } from '../../lib/i18n';
import { useJournee, definirOrdreManuel } from '../../lib/useJournee';
import { distanceKm, distanceTournee, formatDistance, minutesEstimees } from '../../lib/journee';
import { Carte, Pastille, Bandeau, useTon } from '../../components/ui';
import { Echeance } from '../../components/Echeance';
import { useItineraire } from '../../lib/itineraire';

const T = {
  fr: {
    titre: 'Ma tournée', agence: 'Ordre de l’agence', optimise: 'Ordre optimisé', manuel: 'Ordre manuel',
    resume: (n: number, c: number, km: string, min: number) => `${n} arrêt(s) · ${c} commande(s) · ${km} · ~${min} min`,
    agenceAide: 'Tournée planifiée par l’agence : suivez cet ordre.',
    manuelAide: 'Vous avez changé l’ordre. ', recalculer: 'Recalculer le plus court',
    aide: 'Flèches ↑ ↓ pour changer l’ordre si vous connaissez mieux le terrain.',
    vide: 'Aucun arrêt pour le moment.', retrait: 'Retrait', livraison: 'Livraison',
    plus: (m: number) => `+${m} min`, colis: (n: number) => `${n} colis`, prepaye: 'Prépayée', monter: 'Monter', descendre: 'Descendre',
  },
  ar: {
    titre: 'جولتي', agence: 'ترتيب الوكالة', optimise: 'ترتيب محسَّن', manuel: 'ترتيب يدوي',
    resume: (n: number, c: number, km: string, min: number) => `${n} محطة · ${c} طلبية · ${km} · ~${min} د`,
    agenceAide: 'جولة خطّطتها الوكالة: اتبع هذا الترتيب.',
    manuelAide: 'لقد غيّرت الترتيب. ', recalculer: 'إعادة حساب الأقصر',
    aide: 'استعمل الأسهم ↑ ↓ لتغيير الترتيب إن كنت تعرف الطريق أفضل.',
    vide: 'لا توجد محطات حالياً.', retrait: 'استلام', livraison: 'تسليم',
    plus: (m: number) => `+${m} د`, colis: (n: number) => `${n} طرد`, prepaye: 'مدفوعة مسبقاً', monter: 'أعلى', descendre: 'أسفل',
  },
};

export default function Tournee() {
  const { colors } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = T[lang];
  const insets = useSafeAreaInsets();
  const j = useJournee();
  const ambre = useTon('ambre');
  const row = { flexDirection: rtl ? 'row-reverse' as const : 'row' as const };
  const align = { textAlign: rtl ? 'right' as const : 'left' as const };

  const moi = j.moi ? { lat: j.moi.lat, lng: j.moi.lng } : null;
  // Durées par les rues (ADR 0007) : position → 1er arrêt, puis arrêt après arrêt.
  const localises = j.arrets.filter((a) => a.pos);
  const itineraire = useItineraire(moi && localises.length ? [moi, ...localises.map((a) => a.pos!)] : null);
  const parAgence = !!j.tournee?.length;
  const km = distanceTournee(moi, j.arrets);
  const nbCommandes = j.arrets.reduce((n, a) => n + a.commandes.length, 0);

  function deplacer(i: number, sens: -1 | 1) {
    const refs = j.arrets.map((a) => a.order.ref);
    const k = i + sens;
    if (k < 0 || k >= refs.length) return;
    [refs[i], refs[k]] = [refs[k]!, refs[i]!];
    void definirOrdreManuel(refs);
  }

  if (j.chargement) {
    return <View style={[s.centre, { backgroundColor: colors.bg }]}><ActivityIndicator color={colors.indigo9} size="large" /></View>;
  }

  return (
    <View style={[s.plein, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={[row, s.haut]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.titre, { color: colors.text }, align]}>{t.titre}</Text>
          <Text style={[{ color: colors.muted, fontSize: 13 }, align]}>
            {itineraire
              ? t.resume(j.arrets.length, nbCommandes, formatDistance(itineraire.distanceM / 1000, lang), Math.round(itineraire.durationS / 60) + j.arrets.length * 4)
              : t.resume(j.arrets.length, nbCommandes, formatDistance(km, lang), j.arrets.length ? minutesEstimees(km) + j.arrets.length * 4 : 0)}
          </Text>
        </View>
        <Pastille ton="indigo">{parAgence ? t.agence : j.ordreManuel ? t.manuel : t.optimise}</Pastille>
      </View>
      <FlatList
        data={j.arrets}
        keyExtractor={(a) => a.order.ref}
        contentContainerStyle={s.liste}
        refreshControl={<RefreshControl refreshing={false} onRefresh={j.recharger} tintColor={colors.indigo9} />}
        ListHeaderComponent={
          parAgence ? <Bandeau ton="indigo" rtl={rtl}>{t.agenceAide}</Bandeau>
            : j.ordreManuel ? (
              <Bandeau ton="ambre" rtl={rtl} onPress={() => void definirOrdreManuel(null)}>
                {t.manuelAide}<Text style={{ textDecorationLine: 'underline' }}>{t.recalculer}</Text>
              </Bandeau>
            ) : j.arrets.length > 1 ? <Text style={[{ color: colors.muted, fontSize: 13 }, align]}>{t.aide}</Text> : null
        }
        ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'center', marginTop: 40 }}>{t.vide}</Text>}
        renderItem={({ item: a, index: i }) => {
          const prec = i === 0 ? moi : j.arrets[i - 1]?.pos ?? null;
          const troncon = itineraire && a.pos ? itineraire.legs[localises.indexOf(a)] : undefined;
          const plus = troncon ? Math.max(1, Math.round(troncon.durationS / 60)) : a.pos && prec ? minutesEstimees(distanceKm(prec, a.pos)) : null;
          const prochain = i === 0;
          return (
            <Carte testID={`arret-${a.order.ref}`} onPress={() => router.push(`/mission/${encodeURIComponent(a.order.ref)}`)}
              style={[s.ligne, row, prochain && { borderColor: ambre.plein, borderWidth: 2 }]}>
              <View style={[s.num, { backgroundColor: prochain ? ambre.doux : colors.bg }]}>
                <Text style={{ color: prochain ? ambre.texte : colors.text, fontWeight: '800' }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[{ color: colors.text, fontSize: 16, fontWeight: '700' }, align]} numberOfLines={1}>
                  {a.type === 'retrait' ? `${t.retrait} · ` : ''}{a.contact ?? a.order.ref}
                </Text>
                <Text style={[{ color: colors.muted, fontSize: 13 }, align]} numberOfLines={1}>
                  {a.adresse}{plus ? ` · ${t.plus(plus)}` : ''}
                </Text>
                {a.echeance ? <View style={{ marginTop: 4 }}><Echeance echeance={a.echeance} lang={lang} /></View> : null}
              </View>
              {a.type === 'livraison' ? (
                a.order.cod > 0 && !a.order.codPaid ? <Pastille ton="ambre">{money(a.order.cod)}</Pastille> : <Pastille ton="gris">{t.prepaye}</Pastille>
              ) : <Pastille ton="indigo">{t.colis(a.commandes.length)}</Pastille>}
              {!parAgence && j.arrets.length > 1 ? (
                <View style={{ gap: 4 }}>
                  <Fleche label={t.monter} txt="↑" off={i === 0} onPress={() => deplacer(i, -1)} />
                  <Fleche label={t.descendre} txt="↓" off={i === j.arrets.length - 1} onPress={() => deplacer(i, 1)} />
                </View>
              ) : null}
            </Carte>
          );
        }}
      />
    </View>
  );
}

function Fleche({ txt, label, off, onPress }: { txt: string; label: string; off: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={off} accessibilityRole="button" accessibilityLabel={label} hitSlop={4}
      style={[s.fleche, { borderColor: colors.border, opacity: off ? 0.3 : 1 }]}>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{txt}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  plein: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  haut: { alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  titre: { fontSize: 24, fontWeight: '800' },
  liste: { padding: 16, paddingTop: 4, gap: 10 },
  ligne: { alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  num: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  fleche: { width: 36, height: 30, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
