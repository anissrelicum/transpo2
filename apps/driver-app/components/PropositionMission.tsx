// Mission proposée par l'affectation automatique (ADR 0004), par-dessus la carte.
// Le livreur voit ce qu'il faut pour décider : où retirer, où livrer, combien encaisser.
// Compte à rebours recalé sur l'heure du SERVEUR (`serverNow`), pas celle du téléphone :
// sans réponse avant l'échéance, le serveur propose la course au livreur suivant.
import * as React from 'react';
import { View, Text, StyleSheet, Modal, Vibration } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { DriverOffer } from '@transpo/api-client';
import { money } from '@transpo/domain';
import { useTheme } from '../lib/theme';
import { Bouton, Libelle, Pastille, MARQUE, useTon } from './ui';
import { IcCheck } from './icones';

const L = {
  fr: {
    titre: 'Nouvelle mission proposée', retrait: 'Retrait', livraison: 'Livraison', accepter: 'Accepter', refuser: 'Refuser',
    course: (k: string) => `course de ${k} km`, cod: (m: string) => `COD ${m}`, prepaye: 'Prépayée', fragile: 'Fragile',
    sinon: 'Sans réponse, la mission passe à un autre livreur.', expire: 'Délai écoulé', attente: 'Réponse en attente d’envoi',
  },
  ar: {
    titre: 'مهمة جديدة مقترحة', retrait: 'الاستلام', livraison: 'التسليم', accepter: 'قبول', refuser: 'رفض',
    course: (k: string) => `مسافة ${k} كم`, cod: (m: string) => `الدفع عند الاستلام ${m}`, prepaye: 'مدفوعة مسبقاً', fragile: 'قابل للكسر',
    sinon: 'بدون رد، تنتقل المهمة إلى سائق آخر.', expire: 'انتهت المهلة', attente: 'الرد في انتظار الإرسال',
  },
};

function mmss(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function PropositionMission({ offre, decalage, lang, rtl, enAttente, onRepondre, onExpiree }: {
  offre: DriverOffer; decalage: number; lang: 'fr' | 'ar'; rtl: boolean; enAttente: boolean;
  onRepondre: (d: 'accept' | 'refuse') => void; onExpiree: () => void;
}) {
  const { colors } = useTheme();
  const t = L[lang];
  const ambre = useTon('ambre');
  const echeance = new Date(offre.expiresAt).getTime();
  const duree = Math.max(1, echeance - new Date(offre.offeredAt).getTime());
  const [reste, setReste] = React.useState(() => echeance - (Date.now() + decalage));
  const signale = React.useRef(false);

  // Une vibration à l'arrivée : le livreur a souvent le téléphone dans un support.
  React.useEffect(() => { Vibration.vibrate([0, 250, 150, 250]); }, [offre.id]);

  React.useEffect(() => {
    const id = setInterval(() => {
      const r = echeance - (Date.now() + decalage);
      setReste(r);
      if (r <= 0 && !signale.current) { signale.current = true; onExpiree(); }
    }, 1000);
    return () => clearInterval(id);
  }, [echeance, decalage, onExpiree]);

  const expiree = reste <= 0;
  const o = offre.order;
  const row = { flexDirection: rtl ? 'row-reverse' as const : 'row' as const };
  const align = { textAlign: rtl ? 'right' as const : 'left' as const };
  const C = 97.4;
  const part = Math.max(0, Math.min(1, reste / duree));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => undefined} testID={`offer-${offre.ref}`}>
      <View style={s.voile}>
        <View style={[s.modale, { backgroundColor: colors.panel }]}>
          <View style={[row, s.entete]}>
            <View style={{ flex: 1 }}>
              <Libelle rtl={rtl}>{t.titre}</Libelle>
              <Text style={[s.marchand, { color: colors.text }, align]} numberOfLines={1}>{o.merchant ?? o.ref}</Text>
            </View>
            <View style={s.compte}>
              <Svg width={64} height={64} viewBox="0 0 36 36" style={{ transform: [{ rotate: '-90deg' }] }}>
                <Circle cx={18} cy={18} r={15.5} fill="none" stroke={colors.border} strokeWidth={4} />
                <Circle cx={18} cy={18} r={15.5} fill="none" stroke={MARQUE.amber} strokeWidth={4}
                  strokeDasharray={`${C}`} strokeDashoffset={C * (1 - part)} strokeLinecap="round" />
              </Svg>
              <Text style={[s.chrono, { color: colors.text }]}>{expiree ? '0:00' : mmss(reste)}</Text>
            </View>
          </View>

          <View style={[s.trajet, { borderColor: colors.border }]}>
            <Point lettre="A" ton="indigo" titre={t.retrait} adresse={[o.pickupAddress, o.fromCity].filter(Boolean).join(', ')} rtl={rtl} />
            <View style={[s.liaison, { backgroundColor: colors.border, alignSelf: rtl ? 'flex-end' : 'flex-start' }]} />
            <Point lettre="B" ton="ambre" titre={t.livraison} adresse={[o.dropAddress, o.toCity].filter(Boolean).join(', ')} rtl={rtl}
              note={o.distanceKm != null ? t.course(String(o.distanceKm).replace('.', ',')) : undefined} />
          </View>

          <View style={[row, s.puces]}>
            <Pastille ton={o.cod > 0 ? 'ambre' : 'gris'}>{o.cod > 0 ? t.cod(money(o.cod)) : t.prepaye}</Pastille>
            <Pastille ton="gris">{o.size}</Pastille>
            {o.fragile ? <Pastille ton="rouge">{t.fragile}</Pastille> : null}
          </View>

          {enAttente ? (
            <Text style={[s.note, { color: ambre.texte }]}>{t.attente}</Text>
          ) : (
            <View style={[row, s.actions]}>
              <Bouton testID={`offer-refuse-${offre.ref}`} variante="danger" disabled={expiree} onPress={() => onRepondre('refuse')} style={{ flex: 1 }}>
                {t.refuser}
              </Bouton>
              <Bouton testID={`offer-accept-${offre.ref}`} variante="succes" disabled={expiree} onPress={() => onRepondre('accept')}
                icone={<IcCheck size={22} color="#fff" />} style={{ flex: 1.6 }}>
                {t.accepter}
              </Bouton>
            </View>
          )}
          <Text style={[s.note, { color: colors.muted }]}>{expiree ? t.expire : t.sinon}</Text>
        </View>
      </View>
    </Modal>
  );
}

function Point({ lettre, ton, titre, adresse, note, rtl }: { lettre: string; ton: 'indigo' | 'ambre'; titre: string; adresse: string; note?: string; rtl: boolean }) {
  const { colors } = useTheme();
  const c = useTon(ton);
  return (
    <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-start' }}>
      <View style={[s.lettre, { backgroundColor: c.doux }]}><Text style={{ color: c.texte, fontWeight: '800' }}>{lettre}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 15, textAlign: rtl ? 'right' : 'left' }}>
          <Text style={{ fontWeight: '700' }}>{titre}</Text>{adresse ? ` · ${adresse}` : ''}
        </Text>
        {note ? <Text style={{ color: colors.muted, fontSize: 12, textAlign: rtl ? 'right' : 'left' }}>{note}</Text> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  voile: { flex: 1, backgroundColor: 'rgba(11,21,55,0.55)', justifyContent: 'flex-end', padding: 12, paddingBottom: 28 },
  modale: { borderRadius: 26, padding: 18 },
  entete: { alignItems: 'center', gap: 12 },
  marchand: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  compte: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  chrono: { position: 'absolute', fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  trajet: { marginTop: 14, borderWidth: 1, borderRadius: 16, padding: 14 },
  liaison: { width: 2, height: 14, marginVertical: 4, marginHorizontal: 13 },
  lettre: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  puces: { gap: 8, marginTop: 12, flexWrap: 'wrap' },
  actions: { gap: 10, marginTop: 16 },
  note: { fontSize: 13, textAlign: 'center', marginTop: 10 },
});
