// Course proposée par l'affectation automatique (ADR 0004) : le livreur l'accepte ou la
// refuse avant l'échéance. Sans réponse, le serveur la propose au suivant — le compte à
// rebours est recalé sur l'heure du SERVEUR (`serverNow`), pas sur celle du téléphone.
import * as React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { DriverOffer } from '@transpo/api-client';
import { money } from '@transpo/domain';
import { useTheme, statusColorHex } from '../lib/theme';
import { touch, radius, space } from '@transpo/design-tokens';

const L = {
  fr: {
    title: 'Course proposée', accept: 'Accepter', refuse: 'Refuser',
    left: (t: string) => `Répondre sous ${t}`, expired: 'Délai écoulé',
    prepaid: 'Prépayé', cod: (m: string) => `COD ${m}`, fragile: 'Fragile', km: (k: string) => `${k} km`,
    queued: 'Réponse en attente d’envoi',
  },
  ar: {
    title: 'رحلة مقترحة', accept: 'قبول', refuse: 'رفض',
    left: (t: string) => `أجب خلال ${t}`, expired: 'انتهت المهلة',
    prepaid: 'مدفوع مسبقاً', cod: (m: string) => `الدفع عند التسليم ${m}`, fragile: 'قابل للكسر', km: (k: string) => `${k} كم`,
    queued: 'الرد في انتظار الإرسال',
  },
};

function mmss(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function OfferCard({ offer, offsetMs, lang, rtl, queued, onRespond, onExpired }: {
  offer: DriverOffer;
  /** heure serveur − heure du téléphone, au moment du chargement. */
  offsetMs: number;
  lang: 'fr' | 'ar'; rtl: boolean;
  /** Une réponse est déjà en file (hors ligne) : boutons désactivés. */
  queued: boolean;
  onRespond: (decision: 'accept' | 'refuse') => void;
  onExpired: () => void;
}) {
  const { mode, colors } = useTheme();
  const t = L[lang];
  const deadline = new Date(offer.expiresAt).getTime();
  const [left, setLeft] = React.useState(() => deadline - (Date.now() + offsetMs));
  const signale = React.useRef(false);

  React.useEffect(() => {
    const id = setInterval(() => {
      const l = deadline - (Date.now() + offsetMs);
      setLeft(l);
      if (l <= 0 && !signale.current) { signale.current = true; onExpired(); }
    }, 1000);
    return () => clearInterval(id);
  }, [deadline, offsetMs, onExpired]);

  const expired = left <= 0;
  const urgent = left < 30000;
  const row = { flexDirection: rtl ? 'row-reverse' as const : 'row' as const };
  const align = { textAlign: rtl ? 'right' as const : 'left' as const };
  const o = offer.order;

  return (
    <View
      testID={`offer-${offer.ref}`}
      style={[s.card, { backgroundColor: colors.panel, borderColor: colors.indigo9 }]}
      accessibilityLabel={`${t.title} ${offer.ref}`}
    >
      <View style={[s.between, row]}>
        <Text style={[s.title, { color: colors.indigo9 }]}>{t.title}</Text>
        <View style={[s.timer, { backgroundColor: statusColorHex(urgent ? 'ECHOUEE' : 'LIVRAISON', 3, mode) }]}>
          <Text style={[s.timerTxt, { color: statusColorHex(urgent ? 'ECHOUEE' : 'LIVRAISON', 11, mode) }]}>
            {expired ? t.expired : t.left(mmss(left))}
          </Text>
        </View>
      </View>

      <Text style={[s.ref, { color: colors.text }, align]}>{o.ref}</Text>
      <Text style={[s.line, { color: colors.muted }, align]}>
        {o.fromCity}{o.pickupAddress ? ` · ${o.pickupAddress}` : ''}
      </Text>
      <Text style={[s.line, { color: colors.text }, align]}>
        → {o.toCity}{o.dropAddress ? ` · ${o.dropAddress}` : ''}
      </Text>
      <Text style={[s.meta, { color: colors.muted }, align]}>
        {[o.size, o.cod > 0 ? t.cod(money(o.cod)) : t.prepaid, o.fragile ? t.fragile : null,
          o.distanceKm != null ? t.km(String(o.distanceKm).replace('.', ',')) : null].filter(Boolean).join(' · ')}
      </Text>

      {queued ? (
        <Text style={[s.queued, { color: statusColorHex('LIVRAISON', 11, mode) }, align]}>{t.queued}</Text>
      ) : (
        <View style={[s.actions, row]}>
          <Pressable
            testID={`offer-refuse-${offer.ref}`}
            accessibilityRole="button" accessibilityLabel={t.refuse}
            disabled={expired}
            onPress={() => onRespond('refuse')}
            style={({ pressed }) => [s.btn, { borderColor: colors.border, backgroundColor: colors.bg, opacity: expired ? 0.5 : pressed ? 0.8 : 1 }]}
          >
            <Text style={[s.btnTxt, { color: colors.text }]}>{t.refuse}</Text>
          </Pressable>
          <Pressable
            testID={`offer-accept-${offer.ref}`}
            accessibilityRole="button" accessibilityLabel={t.accept}
            disabled={expired}
            onPress={() => onRespond('accept')}
            style={({ pressed }) => [s.btn, s.btnMain, { backgroundColor: colors.indigo9, opacity: expired ? 0.5 : pressed ? 0.85 : 1 }]}
          >
            <Text style={[s.btnTxt, { color: '#fff' }]}>{t.accept}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: radius[4], borderWidth: 2, padding: space[3], marginTop: space[3], gap: 4 },
  between: { justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  timer: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  timerTxt: { fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  ref: { fontSize: 15, fontWeight: '700', marginTop: 4 },
  line: { fontSize: 13 },
  meta: { fontSize: 12, marginTop: 2 },
  actions: { gap: space[2], marginTop: space[2] },
  btn: { flex: 1, minHeight: touch.primary, borderRadius: radius[3], borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnMain: { borderWidth: 0 },
  btnTxt: { fontSize: 16, fontWeight: '700' },
  queued: { fontSize: 12, fontWeight: '600', marginTop: space[2] },
});
