// Support / chat dispatch — redesign visuel uniquement (cf. maquette, fonction
// Support). Logique métier inchangée : `getSupportThread()`,
// `sendSupportMessage()`, comportement clavier (`KeyboardAvoidingView`) et
// scroll-to-end.
import * as React from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import type { SupportMessage } from '@transpo/api-client';
import { space, touch, radius } from '@transpo/design-tokens';
import { authedClient } from '../lib/api';
import { useTheme, resolveColor } from '../lib/theme';
import { useLanguage } from '../lib/i18n';
import { ScreenHead } from '../components/shell';

// Texte/icône sur fond accent (indigo-9, identique en clair et sombre) : blanc
// fixe résolu via les tokens (cran 1 clair de l'échelle neutre ≈ blanc Radix) —
// jamais d'hex en dur (cf. plan §6).
const ON_ACCENT = resolveColor('slate', 1, 'light');

const STR = {
  fr: {
    title: 'Support dispatch',
    sub: 'Exploitation',
    empty: 'Aucun message. Écrivez à l’exploitation en cas de besoin.',
    mine: 'Vous',
    theirs: 'Exploitation',
    placeholder: 'Votre message…',
    send: 'Envoyer',
    quick: ['J’arrive', 'Retard 15 min', 'Adresse introuvable'],
    failTitle: 'Envoi impossible',
    failMsg: 'Vérifiez votre connexion et réessayez.',
  },
  ar: {
    title: 'دعم التوزيع',
    sub: 'الاستغلال',
    empty: 'لا توجد رسائل. راسل قسم الاستغلال عند الحاجة.',
    mine: 'أنت',
    theirs: 'الاستغلال',
    placeholder: 'رسالتك…',
    send: 'إرسال',
    quick: ['أنا قادم', 'تأخير 15 دقيقة', 'العنوان غير موجود'],
    failTitle: 'تعذر الإرسال',
    failMsg: 'تحقق من الاتصال وأعد المحاولة.',
  },
} as const;

export default function SupportScreen() {
  const { colors, mode } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = STR[lang === 'ar' ? 'ar' : 'fr'];

  const [messages, setMessages] = React.useState<SupportMessage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [draft, setDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const scroller = React.useRef<ScrollView>(null);

  const load = React.useCallback(async () => {
    try { setMessages(await authedClient().getSupportThread()); } catch { /* réseau */ } finally { setLoading(false); }
  }, []);
  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  async function send(body: string) {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    try {
      await authedClient().sendSupportMessage(text);
      setDraft('');
      await load();
      scroller.current?.scrollToEnd({ animated: true });
    } catch (e: any) {
      // Envoi direct : un message rejoué automatiquement serait posté en double.
      Alert.alert(t.failTitle, e?.message ?? t.failMsg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[s.wrap, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHead
        title={t.title}
        sub={t.sub}
        onBack={() => router.back()}
        rtl={rtl}
        right={<View style={[s.onlineDot, { backgroundColor: resolveColor('green', 9, mode) }]} />}
      />
      <ScrollView
        ref={scroller}
        style={{ flex: 1 }}
        contentContainerStyle={s.thread}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
      >
        {loading && <ActivityIndicator color={colors.indigo9} />}
        {!loading && messages.length === 0 && (
          <Text style={[s.empty, { color: colors.muted }]}>{t.empty}</Text>
        )}
        {messages.map((m) => {
          const mine = m.sender === 'driver';
          return (
            <View key={m.id} style={[s.bubbleRow, { alignItems: mine ? 'flex-end' : 'flex-start' }]}>
              <View style={[s.bubble, { backgroundColor: mine ? colors.indigo9 : colors.panel, borderColor: mine ? 'transparent' : colors.border, borderWidth: mine ? 0 : 1 }]}>
                <Text style={{ color: mine ? ON_ACCENT : colors.text, fontSize: 15 }}>{m.body}</Text>
                <Text style={{ color: mine ? ON_ACCENT : colors.muted, opacity: mine ? 0.7 : 1, fontSize: 10, marginTop: 5, textAlign: 'right' }}>
                  {mine ? t.mine : t.theirs} · {new Date(m.createdAt).toLocaleTimeString(lang === 'ar' ? 'ar-MA' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={[s.quickRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        {t.quick.map((q) => (
          <Pressable key={q} onPress={() => send(q)} disabled={busy} style={[s.quickChip, { borderColor: colors.border, backgroundColor: colors.panel }]}>
            <Text style={{ color: colors.text, fontSize: 12 }}>{q}</Text>
          </Pressable>
        ))}
      </View>

      <View style={[s.composer, { flexDirection: rtl ? 'row-reverse' : 'row', borderTopColor: colors.border, backgroundColor: colors.panel }]}>
        <TextInput
          style={[s.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg, textAlign: rtl ? 'right' : 'left' }]}
          value={draft}
          onChangeText={setDraft}
          placeholder={t.placeholder}
          placeholderTextColor={colors.muted}
          multiline
        />
        <Pressable
          style={[s.sendBtn, { backgroundColor: colors.indigo9, opacity: !draft.trim() || busy ? 0.5 : 1 }]}
          onPress={() => send(draft)}
          disabled={!draft.trim() || busy}
        >
          {busy ? <ActivityIndicator color={ON_ACCENT} /> : <Text style={s.sendTxt}>{t.send}</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  thread: { padding: space[4], gap: space[2] },
  empty: { textAlign: 'center', marginTop: 40 },
  bubbleRow: { width: '100%' },
  bubble: { maxWidth: '82%', borderRadius: radius[4], paddingHorizontal: space[3], paddingVertical: 9 },
  quickRow: { flexWrap: 'wrap', gap: space[2], paddingHorizontal: space[3], paddingBottom: space[2] },
  quickChip: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: space[3], paddingVertical: 7, minHeight: touch.min, justifyContent: 'center' },
  composer: { alignItems: 'flex-end', gap: space[2], padding: space[3], borderTopWidth: 1 },
  input: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, maxHeight: 110 },
  sendBtn: { borderRadius: 20, paddingHorizontal: 18, height: touch.min, alignItems: 'center', justifyContent: 'center' },
  sendTxt: { color: ON_ACCENT, fontWeight: '700' },
});
