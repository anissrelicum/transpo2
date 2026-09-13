// Aide / FAQ — contenu statique, recherche locale (cf. plan §5 : « Toujours
// statique »). Les réponses reflètent le domaine réel : 5 types d'incident
// (@transpo/domain), pas de « Ma caisse » (écran retiré du périmètre, cf.
// plan §1 ligne 25) — la question COD renvoie vers l'écran de preuve réel.
import * as React from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet } from 'react-native';
import { router, Stack } from 'expo-router';
import { space } from '@transpo/design-tokens';
import { ScreenHead } from '../components/shell';
import { useTheme, resolveColor } from '../lib/theme';
import { useLanguage, type Lang } from '../lib/i18n';

type FaqItem = { q: { fr: string; ar: string }; a: { fr: string; ar: string } };

const FAQ: FaqItem[] = [
  {
    q: { fr: 'Comment accepter une mission ?', ar: 'كيف أقبل مهمة؟' },
    a: {
      fr: "Ouvrez l'onglet Missions, sélectionnez la mission puis suivez les étapes affichées jusqu'à la livraison.",
      ar: 'افتح تبويب المهام، اختر المهمة ثم اتبع الخطوات المعروضة حتى التسليم.',
    },
  },
  {
    q: { fr: 'Que faire si le client est absent ?', ar: 'ماذا أفعل إذا كان العميل غائبًا؟' },
    a: {
      fr: "Appelez le client depuis l'écran de mission. Sans réponse, signalez un échec en choisissant « Destinataire absent » ; la commande repart vers le marchand.",
      ar: 'اتصل بالعميل من شاشة المهمة. إذا لم يُجب، أبلغ عن فشل التسليم باختيار «المستلم غائب»؛ تُعاد الطلبية إلى التاجر.',
    },
  },
  {
    q: { fr: 'Comment encaisser le COD ?', ar: 'كيف أُحصّل الدفع عند الاستلام؟' },
    a: {
      fr: "Sur l'écran de preuve de livraison, saisissez le montant reçu avant de valider : il est enregistré avec la photo et la signature en un seul envoi.",
      ar: 'في شاشة إثبات التسليم، أدخل المبلغ المُستلم قبل التأكيد: يُسجَّل مع الصورة والتوقيع في إرسال واحد.',
    },
  },
  {
    q: { fr: 'Quand suis-je obligé de faire une pause ?', ar: 'متى يجب علي أخذ استراحة؟' },
    a: {
      fr: "Selon la règle EU 561/2006 suivie par l'app, après 4h30 de conduite cumulée, une pause de 45 min est requise. L'app alerte 30 min avant la limite journalière de 9h.",
      ar: 'وفق قاعدة EU 561/2006 المعتمدة في التطبيق، بعد 4 س 30 د من القيادة التراكمية، يلزم أخذ استراحة 45 دقيقة. ينبهك التطبيق قبل 30 دقيقة من الحد اليومي البالغ 9 ساعات.',
    },
  },
  {
    q: { fr: 'Comment sont calculées mes primes ?', ar: 'كيف تُحتسب مكافآتي؟' },
    a: {
      fr: 'Les objectifs et primes sont définis par votre transporteur. Suivez votre progression dans Profil › Objectifs & primes (barème indicatif).',
      ar: 'يحدد الناقل الأهداف والمكافآت. تابع تقدمك في الملف الشخصي › الأهداف والمكافآت (بيانات إرشادية).',
    },
  },
  {
    q: { fr: 'Je n’ai pas de réseau, que se passe-t-il ?', ar: 'لا توجد شبكة، ماذا يحدث؟' },
    a: {
      fr: "L'app fonctionne hors ligne : vos actions sont mises en file et synchronisées automatiquement dès le retour du réseau.",
      ar: 'يعمل التطبيق دون اتصال: تُوضع إجراءاتك في قائمة انتظار وتُزامَن تلقائيًا فور عودة الشبكة.',
    },
  },
  {
    q: { fr: "Quels types d'incident puis-je signaler ?", ar: 'ما أنواع الحوادث التي يمكنني الإبلاغ عنها؟' },
    a: {
      fr: 'Adresse, client injoignable, colis endommagé, véhicule ou autre — depuis Profil › Signaler un incident.',
      ar: 'العنوان، تعذر الوصول للعميل، تلف الطرد، المركبة، أو أخرى — من الملف الشخصي › الإبلاغ عن حادثة.',
    },
  },
];

const STR = {
  fr: {
    title: 'Aide / FAQ',
    demo: "Démo — FAQ statique maintenue dans l'app, aucune recherche côté serveur.",
    search: 'Rechercher une question…',
    empty: (q: string) => `Aucune question ne correspond à « ${q} ».`,
    needHelp: "Besoin d'aide ?",
    contactHint: 'Contactez le dispatch directement',
    contact: 'Contacter',
  },
  ar: {
    title: 'مساعدة / أسئلة شائعة',
    demo: 'تجريبي — أسئلة شائعة ثابتة داخل التطبيق، لا يوجد بحث على الخادم.',
    search: 'ابحث عن سؤال…',
    empty: (q: string) => `لا يوجد سؤال يطابق «${q}».`,
    needHelp: 'تحتاج مساعدة؟',
    contactHint: 'تواصل مباشرة مع فريق التوزيع',
    contact: 'تواصل',
  },
} as const;

export default function HelpScreen() {
  const { colors, mode } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = STR[lang as Lang] ?? STR.fr;
  const align: 'right' | 'left' = rtl ? 'right' : 'left';
  const row: 'row' | 'row-reverse' = rtl ? 'row-reverse' : 'row';

  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(0);
  const query = q.trim().toLowerCase();
  const list = query
    ? FAQ.filter((item) => {
        const hay = `${item.q.fr} ${item.a.fr} ${item.q.ar} ${item.a.ar}`.toLowerCase();
        return hay.includes(query);
      })
    : FAQ;

  return (
    <View style={[s.wrap, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHead title={t.title} onBack={() => router.back()} rtl={rtl} />
      <ScrollView contentContainerStyle={s.content}>
        <View
          style={[s.callout, { backgroundColor: resolveColor('amber', 3, mode), borderColor: resolveColor('amber', 9, mode) }]}
        >
          <Text style={[s.calloutTxt, { color: resolveColor('amber', 11, mode), textAlign: align }]}>{t.demo}</Text>
        </View>

        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={t.search}
          placeholderTextColor={colors.muted}
          style={[
            s.search,
            { backgroundColor: colors.panel, borderColor: colors.border, color: colors.text, textAlign: align },
          ]}
        />

        {list.length === 0 && (
          <Text style={[s.emptyTxt, { color: colors.muted, textAlign: 'center' }]}>{t.empty(q)}</Text>
        )}

        {list.map((item, i) => {
          const isOpen = open === i;
          return (
            <Pressable
              key={item.q.fr}
              style={[s.card, { backgroundColor: colors.panel, borderColor: colors.border }]}
              onPress={() => setOpen(isOpen ? -1 : i)}
              accessibilityRole="button"
            >
              <View style={[s.cardHead, { flexDirection: row }]}>
                <Text style={[s.question, { color: colors.text, textAlign: align }]}>
                  {lang === 'ar' ? item.q.ar : item.q.fr}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 14 }}>{isOpen ? '▾' : rtl ? '‹' : '›'}</Text>
              </View>
              {isOpen && (
                <Text style={[s.answer, { color: colors.muted, textAlign: align }]}>
                  {lang === 'ar' ? item.a.ar : item.a.fr}
                </Text>
              )}
            </Pressable>
          );
        })}

        <View style={[s.contactCard, { backgroundColor: resolveColor('indigo', 3, mode), flexDirection: row }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.contactTitle, { color: colors.text, textAlign: align }]}>{t.needHelp}</Text>
            <Text style={[s.contactHint, { color: colors.muted, textAlign: align }]}>{t.contactHint}</Text>
          </View>
          <Pressable
            style={[s.contactBtn, { backgroundColor: colors.indigo9 }]}
            onPress={() => router.push('/support' as never)}
            accessibilityRole="button"
          >
            {/* Texte clair sur indigo9 plein : slate-1 (blanc cassé des tokens),
                identique clair/sombre — cf. support.tsx. */}
            <Text style={{ color: resolveColor('slate', 1, 'light'), fontWeight: '700', fontSize: 13 }}>{t.contact}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  content: { padding: space[4], gap: space[3], paddingBottom: 40 },
  callout: { borderWidth: 1, borderRadius: 12, padding: space[3] },
  calloutTxt: { fontSize: 12, lineHeight: 17 },
  search: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, minHeight: 44, fontSize: 14 },
  emptyTxt: { fontSize: 13, marginTop: 16 },
  card: { borderWidth: 1, borderRadius: 14, padding: space[3], gap: 8, minHeight: 44 },
  cardHead: { alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  question: { fontSize: 14, fontWeight: '600', flex: 1 },
  answer: { fontSize: 13, lineHeight: 19 },
  contactCard: { borderRadius: 14, padding: space[3], alignItems: 'center', gap: 10 },
  contactTitle: { fontSize: 14, fontWeight: '700' },
  contactHint: { fontSize: 12, marginTop: 2 },
  contactBtn: { paddingHorizontal: 16, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
