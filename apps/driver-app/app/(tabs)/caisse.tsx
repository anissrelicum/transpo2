// Ma caisse (maquette validée, acte 6) : l'argent encaissé aujourd'hui, course par course,
// puis la déclaration de fin de journée.
//
// Le THÉORIQUE vient du serveur (somme des encaissements enregistrés) ; le DÉCLARÉ est le
// seul chiffre que le livreur apporte. Leur écart est signalé tout de suite, au lieu
// d'être découvert le lendemain par la comptabilité.
import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { DriverCash } from '@transpo/api-client';
import { money } from '@transpo/domain';
import { authedClient } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { useLanguage } from '../../lib/i18n';
import { Bouton, Carte, Libelle, Pastille, Bandeau, MARQUE } from '../../components/ui';

const T = {
  fr: {
    titre: 'Ma caisse', aDeposer: 'À déposer', declaree: 'Déclarée', encaisse: 'Encaissé aujourd’hui',
    livraisons: (n: number) => `${n} livraison(s) payée(s) à la porte`, aucune: 'Aucun encaissement enregistré aujourd’hui.',
    enMain: 'Ce que j’ai en main', juste: '✓ Compte juste', ecart: (m: string) => `Écart de ${m} — l’agence va vous contacter.`,
    declarer: 'Déclarer et déposer à l’agence', redeclarer: 'Corriger ma déclaration',
    envoye: 'Caisse déclarée', ko: 'Déclaration impossible — vérifiez votre connexion.',
    horsLigne: 'Hors réseau : la caisse du jour s’affichera au retour du réseau.', autres: (n: number) => `+ ${n} autre(s)`,
  },
  ar: {
    titre: 'صندوقي', aDeposer: 'للإيداع', declaree: 'مُصرَّح به', encaisse: 'المحصَّل اليوم',
    livraisons: (n: number) => `${n} توصيل مدفوع عند الباب`, aucune: 'لا يوجد تحصيل مسجَّل اليوم.',
    enMain: 'ما بحوزتي', juste: '✓ المبلغ مطابق', ecart: (m: string) => `فارق ${m} — ستتصل بك الوكالة.`,
    declarer: 'التصريح والإيداع في الوكالة', redeclarer: 'تصحيح التصريح',
    envoye: 'تم التصريح بالصندوق', ko: 'تعذّر التصريح — تحقق من اتصالك.',
    horsLigne: 'بدون شبكة: سيظهر صندوق اليوم عند عودة الشبكة.', autres: (n: number) => `+ ${n} أخرى`,
  },
};

const VISIBLES = 6;

export default function Caisse() {
  const { colors } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = T[lang];
  const insets = useSafeAreaInsets();
  const row = { flexDirection: rtl ? 'row-reverse' as const : 'row' as const };
  const align = { textAlign: rtl ? 'right' as const : 'left' as const };

  const [caisse, setCaisse] = React.useState<DriverCash | null>(null);
  const [chargement, setChargement] = React.useState(true);
  const [horsLigne, setHorsLigne] = React.useState(false);
  const [enMain, setEnMain] = React.useState('');
  const [envoi, setEnvoi] = React.useState(false);

  const charger = React.useCallback(async () => {
    try {
      const c = await authedClient().getMyCash();
      setCaisse(c);
      setHorsLigne(false);
      setEnMain((v) => v || String(c?.declared ?? c?.theorique ?? ''));
    } catch {
      setHorsLigne(true);
    } finally {
      setChargement(false);
    }
  }, []);

  useFocusEffect(React.useCallback(() => { void charger(); }, [charger]));

  async function declarer() {
    const montant = Number(enMain.replace(',', '.'));
    if (!Number.isFinite(montant) || montant < 0) return;
    setEnvoi(true);
    try {
      const r = await authedClient().declareMyCash(montant);
      setCaisse((c) => (c ? { ...c, declared: r.declared, status: r.status, ecart: r.ecart } : r));
      Alert.alert(t.envoye, r.ecart ? t.ecart(money(Math.abs(r.ecart))) : t.juste);
    } catch {
      Alert.alert(t.titre, t.ko);
    } finally {
      setEnvoi(false);
    }
  }

  if (chargement) {
    return <View style={[s.centre, { backgroundColor: colors.bg }]}><ActivityIndicator color={colors.indigo9} size="large" /></View>;
  }

  const theorique = caisse?.theorique ?? 0;
  const mouvements = caisse?.moves ?? [];
  const saisi = Number(enMain.replace(',', '.'));
  const ecartSaisi = Number.isFinite(saisi) && enMain !== '' ? saisi - theorique : null;
  const dejaDeclaree = caisse?.declared != null;

  return (
    <View style={[s.plein, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={[row, s.haut]}>
        <Text style={[s.titre, { color: colors.text }]}>{t.titre}</Text>
        {theorique > 0 ? <Pastille ton={dejaDeclaree ? 'vert' : 'ambre'}>{dejaDeclaree ? t.declaree : t.aDeposer}</Pastille> : null}
      </View>
      <ScrollView contentContainerStyle={s.contenu} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={charger} tintColor={colors.indigo9} />}>
        {horsLigne ? <Bandeau ton="ambre" rtl={rtl}>{t.horsLigne}</Bandeau> : null}
        <View style={[s.total, { backgroundColor: MARQUE.navy }]}>
          <Libelle style={{ color: '#9FB0E8' }} rtl={rtl}>{t.encaisse}</Libelle>
          <Text testID="caisse-theorique" style={[s.gros, align]}>{money(theorique)}</Text>
          <Text style={[{ color: '#fff', opacity: 0.8, fontSize: 14 }, align]}>
            {theorique > 0 ? t.livraisons(caisse?.deliveries ?? mouvements.length) : t.aucune}
          </Text>
        </View>
        {mouvements.length ? (
          <Carte style={{ paddingVertical: 6 }}>
            {mouvements.slice(0, VISIBLES).map((m, i) => (
              <View key={`${m.ref}-${i}`} style={[row, s.mvt, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <Text style={{ color: colors.text, fontSize: 15, flex: 1, textAlign: rtl ? 'right' : 'left' }} numberOfLines={1}>{m.recipient || m.ref}</Text>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{money(m.amount)}</Text>
              </View>
            ))}
            {mouvements.length > VISIBLES ? (
              <View style={[row, s.mvt, { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <Text style={{ color: colors.muted, flex: 1, textAlign: rtl ? 'right' : 'left' }}>{t.autres(mouvements.length - VISIBLES)}</Text>
                <Text style={{ color: colors.muted, fontWeight: '700' }}>
                  {money(mouvements.slice(VISIBLES).reduce((x, m) => x + m.amount, 0))}
                </Text>
              </View>
            ) : null}
          </Carte>
        ) : null}
        {theorique > 0 || dejaDeclaree ? (
          <Carte>
            <Libelle rtl={rtl}>{t.enMain}</Libelle>
            <TextInput
              testID="caisse-en-main" value={enMain} onChangeText={(v) => setEnMain(v.replace(/[^0-9.,]/g, ''))}
              keyboardType="decimal-pad" accessibilityLabel={t.enMain}
              style={[s.saisie, { color: colors.text, borderColor: colors.border }, align]}
            />
            {ecartSaisi !== null ? (
              Math.abs(ecartSaisi) < 0.01
                ? <Bandeau ton="vert" rtl={rtl}>{t.juste}</Bandeau>
                : <Bandeau ton="rouge" rtl={rtl}>{t.ecart(money(Math.abs(ecartSaisi)))}</Bandeau>
            ) : null}
          </Carte>
        ) : null}
      </ScrollView>
      {theorique > 0 || dejaDeclaree ? (
        <View style={s.bas}>
          <Bouton testID="declarer-caisse" variante="marque" loading={envoi} disabled={enMain === ''} onPress={declarer}>
            {dejaDeclaree ? t.redeclarer : t.declarer}
          </Bouton>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  plein: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  haut: { alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  titre: { fontSize: 24, fontWeight: '800' },
  contenu: { padding: 16, paddingTop: 4, gap: 12 },
  total: { borderRadius: 18, padding: 18 },
  gros: { color: '#fff', fontSize: 36, fontWeight: '800', marginTop: 4, fontVariant: ['tabular-nums'] },
  mvt: { justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, gap: 10 },
  saisie: { fontSize: 28, fontWeight: '800', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginTop: 8, marginBottom: 10 },
  bas: { padding: 16 },
});
