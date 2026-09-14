// Détail de mission — cf. maquette `MissionDetail`/`StepCard`/`ContactSheet`/`ContactBtn`.
// Pas de lat/lng dans `Order` (cf. plan §1 ligne 4) : carte remplacée par un
// placeholder explicite, jamais de coordonnées inventées. Idem pour le nom et
// le téléphone du destinataire, absents de l'API : la fiche contact est signalée
// comme non alimentée (cf. plan §1 ligne 5).
import * as React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import type { Order } from '@transpo/domain';
import { STATUS_META, money } from '@transpo/domain';
import { radius, space, touch } from '@transpo/design-tokens';
import { authedClient } from '../../../lib/api';
import { readJson, writeJson } from '../../../lib/storage';
import { applyPending } from '../../../lib/outbox';
import { useOutbox } from '../../../lib/useOutbox';
import { useTheme, useStatusColor, resolveColor } from '../../../lib/theme';
import { useLanguage } from '../../../lib/i18n';
import { ScreenHead, BottomAction, PrimaryBtn } from '../../../components/shell';

const CACHE_KEY = 'transpo.missions.v1';

const T = {
  fr: {
    stepRetrait: 'Retrait', stepLivraison: 'Livraison',
    merchantFallback: '—', recipient: 'Destinataire',
    parcel: 'Colis', codToCollect: 'COD à encaisser', codPaid: 'COD encaissé', codNone: 'Prépayé',
    proof: 'Preuve', proofNone: 'Aucune preuve exigée',
    mapTitle: 'Carte indisponible', mapSub: 'Aucune coordonnée GPS pour cette commande dans l’API.',
    contactDemoTitle: 'Contact non alimenté',
    contactDemoBody: 'L’API ne fournit pas de numéro client : cette fiche est une démonstration visuelle, sans appel ni SMS réel.',
    contact: 'Contacter', close: 'Fermer', navigate: 'Naviguer',
    notFoundTitle: 'Commande introuvable', notFoundBody: 'Elle a peut-être déjà été traitée.',
    backToMissions: 'Retour aux missions',
    demo: 'Démo',
  },
  ar: {
    stepRetrait: 'الاستلام', stepLivraison: 'التسليم',
    merchantFallback: '—', recipient: 'المستلم',
    parcel: 'الطرد', codToCollect: 'للتحصيل', codPaid: 'محصَّل', codNone: 'مدفوع مسبقاً',
    proof: 'الإثبات', proofNone: 'لا يُطلب إثبات',
    mapTitle: 'الخريطة غير متوفرة', mapSub: 'لا توجد إحداثيات GPS لهذه الشحنة في الواجهة البرمجية.',
    contactDemoTitle: 'الاتصال غير مفعّل',
    contactDemoBody: 'لا توفر الواجهة البرمجية رقم هاتف العميل: هذه الشاشة عرض توضيحي بدون اتصال أو رسالة حقيقية.',
    contact: 'الاتصال', close: 'إغلاق', navigate: 'التنقل',
    notFoundTitle: 'الشحنة غير موجودة', notFoundBody: 'ربما تمت معالجتها بالفعل.',
    backToMissions: 'العودة إلى المهام',
    demo: 'عرض',
  },
} as const;

const PROOF_LABEL = { photo: { fr: 'photo', ar: 'صورة' }, signature: { fr: 'signature', ar: 'توقيع' } };

export default function MissionDetail() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const refStr = String(ref);
  const { colors, mode } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = T[lang === 'ar' ? 'ar' : 'fr'];

  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [contactOpen, setContactOpen] = React.useState<null | 'retrait' | 'livraison'>(null);
  const { pending } = useOutbox();

  const reload = React.useCallback(async () => {
    try {
      const fresh = await authedClient().getMissions();
      setOrders(fresh);
      await writeJson(CACHE_KEY, fresh);
    } catch {
      setOrders(await readJson<Order[]>(CACHE_KEY, [])); // hors ligne : dernier état connu
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { reload(); }, [reload]);

  const order = applyPending(orders, pending).find((o) => o.ref === refStr) ?? null;
  const statusFg = useStatusColor(order?.status ?? 'ASSIGNEE', 11);
  const statusBg = useStatusColor(order?.status ?? 'ASSIGNEE', 3);

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.indigo9} size="large" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <Text style={[s.notFoundTitle, { color: colors.text }]}>{t.notFoundTitle}</Text>
        <Text style={[s.notFoundBody, { color: colors.muted }]}>{t.notFoundBody}</Text>
        <PrimaryBtn onPress={() => router.replace('/(tabs)/missions')}>{t.backToMissions}</PrimaryBtn>
      </View>
    );
  }

  const codLabel = order.cod <= 0 ? t.codNone : order.codPaid ? t.codPaid : t.codToCollect;
  const codColor = order.cod <= 0 ? 'gray' : order.codPaid ? 'green' : 'amber';
  const proofLabels = proofRequirementsLabels(order.proofLevel, lang);

  return (
    <View style={[s.wrap, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHead
        title={order.ref}
        sub={lang === 'ar' ? STATUS_META[order.status].ar : STATUS_META[order.status].fr}
        onBack={() => router.replace('/(tabs)/missions')}
        rtl={rtl}
        right={
          <View style={[s.badge, { backgroundColor: statusBg }]}>
            <Text style={[s.badgeTxt, { color: statusFg }]}>
              {lang === 'ar' ? STATUS_META[order.status].ar : STATUS_META[order.status].fr}
            </Text>
          </View>
        }
      />

      {/* Pas de lat/lng réel dans `Order` (cf. plan) : placeholder explicite plutôt qu'une carte inventée. */}
      <View style={[s.mapPlaceholder, { backgroundColor: colors.panel, borderColor: colors.border }]}>
        <Text style={[s.mapTitle, { color: colors.muted }]}>{t.mapTitle}</Text>
        <Text style={[s.mapSub, { color: colors.muted }]}>{t.mapSub}</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
        {/* Contact et adresse RÉELS de la course. Ils étaient jusqu'ici remplacés par la
            ville et un libellé de démonstration : le livreur, seul à en avoir besoin sur le
            terrain, lisait « Destinataire · Casablanca » et un badge « Démo ». */}
        <StepCard
          tone={resolveColor('slate', 9, mode)}
          toneSoft={resolveColor('slate', 3, mode)}
          title={t.stepRetrait}
          name={order.pickupContact || order.merchant || t.merchantFallback}
          addr={[order.pickupAddress, order.fromCity].filter(Boolean).join(' · ')}
          note={order.pickupNotes ?? undefined}
          rtl={rtl}
          colors={colors}
          onContact={() => setContactOpen('retrait')}
          contactLabel={t.contact}
          demoBadge={order.pickupContact ? undefined : t.demo}
        />
        <StepCard
          tone={colors.indigo9}
          toneSoft={resolveColor('indigo', 3, mode)}
          title={t.stepLivraison}
          name={order.dropContact || t.recipient}
          addr={[order.dropAddress, order.toCity].filter(Boolean).join(' · ')}
          note={order.dropNotes ?? undefined}
          rtl={rtl}
          colors={colors}
          onContact={() => setContactOpen('livraison')}
          contactLabel={t.contact}
          demoBadge={order.dropContact ? undefined : t.demo}
        />

        <View style={[s.card, { backgroundColor: colors.panel, borderColor: colors.border }]}>
          <Text style={[s.cardTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>{t.parcel}</Text>
          <Text style={[s.cardBody, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>{order.size}</Text>
          <View style={[s.chipsRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <Chip label={`${codLabel}${order.cod > 0 ? ' · ' + money(order.cod) : ''}`} color={codColor} mode={mode} />
            <Chip label={proofLabels.length ? `${t.proof} : ${proofLabels.join(' + ')}` : t.proofNone} color="gray" mode={mode} />
          </View>
        </View>
      </ScrollView>

      <BottomAction>
        <View style={[s.actions, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <Pressable
            onPress={() => setContactOpen('livraison')}
            style={[s.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.panel }]}
            accessibilityRole="button"
            accessibilityLabel={t.contact}
          >
            <Text style={[s.secondaryTxt, { color: colors.text }]}>{t.contact}</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <PrimaryBtn onPress={() => router.push(`/mission/${order.ref}/status`)}>{t.navigate}</PrimaryBtn>
          </View>
        </View>
      </BottomAction>

      <ContactSheet
        visible={contactOpen !== null}
        onClose={() => setContactOpen(null)}
        name={contactOpen === 'retrait' ? (order.merchant ?? t.merchantFallback) : t.recipient}
        colors={colors}
        rtl={rtl}
        t={t}
      />
    </View>
  );
}

function proofRequirementsLabels(level: Order['proofLevel'], lang: 'fr' | 'ar'): string[] {
  const required: ('photo' | 'signature')[] =
    level === 'photo' ? ['photo'] : level === 'signature' ? ['signature'] : level === 'photo_signature' ? ['photo', 'signature'] : [];
  return required.map((r) => PROOF_LABEL[r][lang]);
}

/** Bloc retrait/livraison — cf. maquette `StepCard`, réduit aux données réellement disponibles dans `Order`. */
function StepCard({
  tone, toneSoft, title, name, addr, note, rtl, colors, onContact, contactLabel, demoBadge,
}: {
  tone: string; toneSoft: string; title: string; name: string; addr: string; rtl: boolean;
  colors: ReturnType<typeof useTheme>['colors']; onContact: () => void; contactLabel: string;
  demoBadge?: string; note?: string;
}) {
  return (
    <View style={[s.card, { backgroundColor: colors.panel, borderColor: colors.border }]}>
      <View style={[s.stepHead, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        <View style={[s.stepDot, { backgroundColor: toneSoft }]}>
          <View style={[s.stepDotCore, { backgroundColor: tone }]} />
        </View>
        <Text style={[s.cardTitle, { color: colors.text }]}>{title}</Text>
        {demoBadge ? (
          <View style={[s.demoBadge, { backgroundColor: colors.border }]}>
            <Text style={[s.demoBadgeTxt, { color: colors.muted }]}>{demoBadge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[s.stepName, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>{name}</Text>
      <Text style={[s.stepAddr, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>{addr}</Text>
      {/* Les notes d'accès (étage, code, instructions) ne servent qu'ici : c'est le livreur
          qui sonne à la porte. */}
      {note ? (
        <Text style={[s.stepAddr, { color: colors.muted, textAlign: rtl ? 'right' : 'left', fontStyle: 'italic' }]}>{note}</Text>
      ) : null}
      <Pressable
        onPress={onContact}
        style={[s.contactBtn, { borderColor: colors.border }]}
        accessibilityRole="button"
        accessibilityLabel={contactLabel}
      >
        <Text style={[s.contactTxt, { color: colors.indigo9 }]}>{contactLabel}</Text>
      </Pressable>
    </View>
  );
}

function Chip({ label, color, mode }: { label: string; color: 'gray' | 'amber' | 'green'; mode: 'light' | 'dark' }) {
  const bg = resolveColor(color === 'gray' ? 'slate' : color, 3, mode);
  const fg = resolveColor(color === 'gray' ? 'slate' : color, 11, mode);
  return (
    <View style={[s.chip, { backgroundColor: bg }]}>
      <Text style={[s.chipTxt, { color: fg }]}>{label}</Text>
    </View>
  );
}

/** Feuille de contact — cf. maquette `ContactSheet`/`ContactBtn`. Aucun numéro réel : pas de backend (plan §5). */
function ContactSheet({
  visible, onClose, name, colors, rtl, t,
}: {
  visible: boolean; onClose: () => void; name: string;
  colors: ReturnType<typeof useTheme>['colors']; rtl: boolean; t: (typeof T)['fr'] | (typeof T)['ar'];
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* Voile sombre fixe (indépendant du thème), composé depuis les tokens — pas de littéral hex/rgba. */}
      <Pressable style={[s.sheetBackdrop, { backgroundColor: resolveColor('slate', 12, 'light') + '99' }]} onPress={onClose} />
      <View style={[s.sheet, { backgroundColor: colors.panel, borderColor: colors.border }]}>
        <Text style={[s.sheetName, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>{name}</Text>
        <View style={[s.demoCallout, { backgroundColor: colors.border }]}>
          <Text style={[s.demoCalloutTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>{t.contactDemoTitle}</Text>
          <Text style={[s.demoCalloutBody, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>{t.contactDemoBody}</Text>
        </View>
        <PrimaryBtn onPress={onClose}>{t.close}</PrimaryBtn>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  notFoundTitle: { fontSize: 18, fontWeight: '700' },
  notFoundBody: { fontSize: 14, marginBottom: 8, textAlign: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  badgeTxt: { fontSize: 12, fontWeight: '700' },
  mapPlaceholder: { height: 120, flex: 0, borderBottomWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 24 },
  mapTitle: { fontSize: 13, fontWeight: '600' },
  mapSub: { fontSize: 12, textAlign: 'center' },
  content: { padding: space[4], paddingBottom: 100, gap: space[3] },
  card: { borderRadius: radius[5], borderWidth: 1, padding: space[4], gap: 6 },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  cardBody: { fontSize: 14 },
  stepHead: { alignItems: 'center', gap: 8 },
  stepDot: { width: 30, height: 30, borderRadius: radius[3], alignItems: 'center', justifyContent: 'center' },
  stepDotCore: { width: 10, height: 10, borderRadius: 5 },
  stepName: { fontSize: 15, fontWeight: '600', marginTop: 4 },
  stepAddr: { fontSize: 13 },
  demoBadge: { marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  demoBadgeTxt: { fontSize: 10, fontWeight: '700' },
  contactBtn: { minHeight: touch.min, borderWidth: 1, borderRadius: radius[3], alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  contactTxt: { fontSize: 14, fontWeight: '600' },
  chipsRow: { gap: 8, marginTop: 4, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  chipTxt: { fontSize: 12, fontWeight: '600' },
  actions: { gap: 8, alignItems: 'stretch' },
  secondaryBtn: { minWidth: touch.primary, height: touch.primary, borderWidth: 1, borderRadius: radius[3], alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  secondaryTxt: { fontSize: 14, fontWeight: '600' },
  sheetBackdrop: { flex: 1 },
  sheet: { borderTopLeftRadius: radius[5], borderTopRightRadius: radius[5], borderWidth: 1, padding: space[4], gap: space[3] },
  sheetName: { fontSize: 17, fontWeight: '700' },
  demoCallout: { borderRadius: radius[3], padding: space[3], gap: 4 },
  demoCalloutTitle: { fontSize: 13, fontWeight: '700' },
  demoCalloutBody: { fontSize: 12, lineHeight: 17 },
});
