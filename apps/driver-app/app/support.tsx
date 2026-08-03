import * as React from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, TextInput, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { SupportMessage } from '@transpo/api-client';
import { authedClient } from '../lib/api';
import { C } from '../lib/theme';

export default function SupportScreen() {
  const [messages, setMessages] = React.useState<SupportMessage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [draft, setDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const scroller = React.useRef<ScrollView>(null);

  const load = React.useCallback(async () => {
    try { setMessages(await authedClient().getSupportThread()); } catch { /* réseau */ } finally { setLoading(false); }
  }, []);
  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    try {
      await authedClient().sendSupportMessage(body);
      setDraft('');
      await load();
      scroller.current?.scrollToEnd({ animated: true });
    } catch (e: any) {
      // Envoi direct : un message rejoué automatiquement serait posté en double.
      Alert.alert('Envoi impossible', e?.message ?? 'Vérifiez votre connexion et réessayez.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.wrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        ref={scroller} style={s.thread} contentContainerStyle={s.threadContent}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
      >
        {loading && <ActivityIndicator color={C.indigo} />}
        {!loading && messages.length === 0 && (
          <Text style={s.empty}>Aucun message. Écrivez à l’exploitation en cas de besoin.</Text>
        )}
        {messages.map((m) => {
          const mine = m.sender === 'driver';
          return (
            <View key={m.id} style={[s.bubble, mine ? s.mine : s.theirs]}>
              <Text style={[s.body, mine && s.bodyMine]}>{m.body}</Text>
              <Text style={[s.time, mine && s.timeMine]}>
                {mine ? 'Vous' : 'Exploitation'} · {new Date(m.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={s.composer}>
        <TextInput
          style={s.input} value={draft} onChangeText={setDraft}
          placeholder="Votre message…" multiline
        />
        <Pressable style={[s.send, (!draft.trim() || busy) && s.sendOff]} onPress={send} disabled={!draft.trim() || busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.sendTxt}>Envoyer</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  thread: { flex: 1 },
  threadContent: { padding: 16, gap: 10 },
  empty: { color: C.muted, textAlign: 'center', marginTop: 40 },
  bubble: { maxWidth: '82%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  mine: { alignSelf: 'flex-end', backgroundColor: C.indigo },
  theirs: { alignSelf: 'flex-start', backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  body: { fontSize: 15, color: C.text },
  bodyMine: { color: '#fff' },
  time: { fontSize: 10, color: C.muted, marginTop: 5 },
  timeMine: { color: '#ffffffb0' },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12,
    borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.card,
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: C.text, maxHeight: 110, backgroundColor: C.bg,
  },
  send: { backgroundColor: C.indigo, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 11 },
  sendOff: { opacity: 0.5 },
  sendTxt: { color: '#fff', fontWeight: '700' },
});
