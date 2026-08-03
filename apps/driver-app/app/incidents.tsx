import * as React from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, TextInput, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { INCIDENT_TYPES, type IncidentType } from '@transpo/domain';
import type { Incident } from '@transpo/api-client';
import { authedClient } from '../lib/api';
import { C } from '../lib/theme';

const LABEL: Record<IncidentType, string> = {
  ADRESSE: 'Adresse introuvable',
  CLIENT_INJOIGNABLE: 'Client injoignable',
  COLIS_ENDOMMAGE: 'Colis endommagé',
  VEHICULE: 'Problème de véhicule',
  AUTRE: 'Autre',
};
const STATUS_COLOR: Record<string, string> = { OUVERT: C.amber, TRAITE: C.green };

export default function IncidentsScreen() {
  const [items, setItems] = React.useState<Incident[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [type, setType] = React.useState<IncidentType>('CLIENT_INJOIGNABLE');
  const [ref, setRef] = React.useState('');
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try { setItems(await authedClient().getMyIncidents()); } catch { /* réseau */ } finally { setLoading(false); }
  }, []);
  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  async function submit() {
    setBusy(true);
    try {
      await authedClient().reportIncident({ type, ref: ref.trim() || undefined, note: note.trim() || undefined });
      setRef(''); setNote('');
      await load();
    } catch (e: any) {
      // Pas de file d'attente ici : l'API ne déduplique pas les incidents, un
      // rejeu automatique en créerait plusieurs. Le livreur retente lui-même.
      Alert.alert('Envoi impossible', e?.message ?? 'Vérifiez votre connexion et réessayez.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={s.wrap} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
    >
      <Text style={s.title}>Signaler un incident</Text>

      <Text style={s.label}>Type</Text>
      <View style={s.chips}>
        {INCIDENT_TYPES.map((t) => (
          <Pressable key={t} onPress={() => setType(t)} style={[s.chip, type === t && s.chipOn]}>
            <Text style={[s.chipTxt, type === t && s.chipTxtOn]}>{LABEL[t]}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.label}>Commande concernée (facultatif)</Text>
      <TextInput style={s.input} value={ref} onChangeText={setRef} placeholder="CMD-…" autoCapitalize="characters" />

      <Text style={s.label}>Précisions (facultatif)</Text>
      <TextInput
        style={[s.input, s.multiline]} value={note} onChangeText={setNote}
        placeholder="Ce que vous avez constaté" multiline numberOfLines={3}
      />

      <Pressable style={[s.btn, busy && s.btnDisabled]} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Envoyer le signalement</Text>}
      </Pressable>

      <Text style={[s.title, { marginTop: 28 }]}>Mes signalements</Text>
      {loading && <ActivityIndicator color={C.indigo} style={{ marginTop: 16 }} />}
      {!loading && items.length === 0 && <Text style={s.empty}>Aucun signalement.</Text>}
      {items.map((i) => (
        <View key={i.id} style={s.card}>
          <View style={s.rowBetween}>
            <Text style={s.cardTitle}>{LABEL[i.type as IncidentType] ?? i.type}</Text>
            <View style={[s.badge, { backgroundColor: (STATUS_COLOR[i.status] || C.muted) + '22' }]}>
              <Text style={[s.badgeTxt, { color: STATUS_COLOR[i.status] || C.muted }]}>{i.status}</Text>
            </View>
          </View>
          {i.ref && <Text style={s.cardMeta}>{i.ref}</Text>}
          {i.note && <Text style={s.cardNote}>{i.note}</Text>}
          <Text style={s.cardDate}>{new Date(i.createdAt).toLocaleString('fr-FR')}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 6, marginTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: C.card },
  chipOn: { borderColor: C.indigo, backgroundColor: C.indigo + '18' },
  chipTxt: { fontSize: 13, color: C.text },
  chipTxtOn: { color: C.indigo, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.text, backgroundColor: C.card },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  btn: { backgroundColor: C.indigo, borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  btnDisabled: { opacity: 0.6 },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  empty: { color: C.muted, marginTop: 8 },
  card: { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 12, marginTop: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: C.text, flex: 1 },
  cardMeta: { fontSize: 12, color: C.muted, marginTop: 4 },
  cardNote: { fontSize: 13, color: C.text, marginTop: 6 },
  cardDate: { fontSize: 11, color: C.muted, marginTop: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeTxt: { fontSize: 11, fontWeight: '700' },
});
