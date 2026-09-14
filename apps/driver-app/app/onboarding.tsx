// Onboarding / recrutement — cf. maquette (fonction `Onboarding`, écran 24).
// Assistant local en 4 étapes, atteint depuis « Devenir livreur » sur l'écran
// de connexion. AUCUN backend (cf. design/PLAN-REFONTE-MOBILE.md §5) : les
// données saisies ne sont jamais envoyées, un callout le rappelle à chaque étape.
import * as React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { router, Stack } from 'expo-router';
import { useTheme, resolveColor } from '../lib/theme';
import { useLanguage } from '../lib/i18n';
import { ScreenHead, PrimaryBtn, BottomAction, CameraIcon } from '../components/shell';
import { space, radius, touch } from '@transpo/design-tokens';

function iconProps(size: number, color: string) {
  return {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  };
}
function MobileIcon({ size = 16, color }: { size?: number; color: string }) {
  return <Svg {...iconProps(size, color)}><Path d="M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><Path d="M11 19h2" /></Svg>;
}
function CheckCircleIcon({ size = 18, color }: { size?: number; color: string }) {
  return <Svg {...iconProps(size, color)}><Path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" /><Path d="M8 12.5l2.5 2.5L16 9.5" /></Svg>;
}
function ClockIcon({ size = 18, color }: { size?: number; color: string }) {
  return <Svg {...iconProps(size, color)}><Path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" /><Path d="M12 7.5V12l3 2" /></Svg>;
}
function PlusIcon({ size = 16, color }: { size?: number; color: string }) {
  return <Svg {...iconProps(size, color)}><Path d="M12 5v14M5 12h14" /></Svg>;
}
function CrossIcon({ size = 16, color }: { size?: number; color: string }) {
  return <Svg {...iconProps(size, color)}><Path d="M6 6l12 12M18 6L6 18" /></Svg>;
}
function CheckIcon({ size = 16, color }: { size?: number; color: string }) {
  return <Svg {...iconProps(size, color)}><Path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
}
function ArrowRightIcon({ size = 18, color }: { size?: number; color: string }) {
  return <Svg {...iconProps(size, color)}><Path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
}
function InfoIcon({ size = 15, color }: { size?: number; color: string }) {
  return <Svg {...iconProps(size, color)}><Path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" /><Path d="M12 11v5.5" /></Svg>;
}

type ContractId = 'salarie' | 'freelance';
type VehicleId = 'moto' | 'voiture' | 'fourgon';
type DocStatus = 'todo' | 'review' | 'valid' | 'refused';
type Doc = { id: string; nameFr: string; nameAr: string; status: DocStatus };

// Couleur par nom de teinte Radix (résolue en hex via `resolveColor`, cf. plus
// bas) plutôt qu'en hex figé, pour rester correct en thème sombre.
const DOC_STATUS_META: Record<DocStatus, { colorName: string; Icon: React.ComponentType<{ size?: number; color: string }> }> = {
  todo: { colorName: 'gray', Icon: PlusIcon },
  review: { colorName: 'amber', Icon: ClockIcon },
  valid: { colorName: 'green', Icon: CheckIcon },
  refused: { colorName: 'red', Icon: CrossIcon },
};

const INITIAL_DOCS: Doc[] = [
  { id: 'permis_r', nameFr: 'Permis de conduire (recto)', nameAr: 'رخصة القيادة (الوجه)', status: 'valid' },
  { id: 'permis_v', nameFr: 'Permis de conduire (verso)', nameAr: 'رخصة القيادة (الظهر)', status: 'review' },
  { id: 'grise', nameFr: 'Carte grise', nameAr: 'البطاقة الرمادية', status: 'todo' },
  { id: 'assur', nameFr: 'Attestation d’assurance', nameAr: 'شهادة التأمين', status: 'refused' },
];

const CITIES = ['Casablanca', 'Rabat', 'Marrakech', 'Tanger', 'Fès'];

const L = {
  fr: {
    title: 'Devenir livreur', sub: 'Inscription', step: (n: number, total: number) => `Étape ${n} / ${total}`,
    demo: 'Formulaire de démonstration — aucune donnée n’est transmise à un serveur.',
    s1: { h: 'Vos informations', name: 'Nom complet', phone: 'Téléphone', city: 'Ville de rattachement' },
    s2: {
      h: 'Contrat & véhicule', contractLabel: 'Type de contrat',
      salarie: 'Salarié', salarieDesc: 'Rémunération fixe', freelance: 'Freelance', freelanceDesc: 'Payé à la course',
      vehicleLabel: 'Véhicule', moto: 'Moto', voiture: 'Voiture', fourgon: 'Fourgon',
      callout: 'En freelance, vos gains sont calculés par course livrée et suivis dans « Historique & gains ».',
    },
    s3: { h: 'Vos documents', sub: 'Téléversez vos pièces justificatives. Elles seront vérifiées sous 48 h.', add: 'Ajouter', retry: 'Reprendre', refused: 'Document illisible — merci de reprendre la photo.' },
    s4: { h: 'Inscription terminée (démo)', body: 'Ceci est une démonstration : aucune donnée n’a été transmise à un serveur et aucune revue n’aura lieu. Dans la version réelle, notre équipe vérifierait votre dossier avant votre premier shift.', contract: 'Contrat', vehicle: 'Véhicule', docs: 'Documents', docsStatus: '3/4 en vérification (démo)' },
    continueBtn: 'Continuer', home: 'Revenir à l’accueil',
    docStatus: { todo: 'À fournir', review: 'En vérification', valid: 'Validé', refused: 'Refusé' } as Record<DocStatus, string>,
  },
  ar: {
    title: 'كن سائقًا', sub: 'التسجيل', step: (n: number, total: number) => `الخطوة ${n} / ${total}`,
    demo: 'استمارة تجريبية — لا تُرسل أي بيانات إلى خادم.',
    s1: { h: 'معلوماتك', name: 'الاسم الكامل', phone: 'الهاتف', city: 'مدينة الانتساب' },
    s2: {
      h: 'العقد والمركبة', contractLabel: 'نوع العقد',
      salarie: 'موظف', salarieDesc: 'أجر ثابت', freelance: 'مستقل', freelanceDesc: 'أجر حسب الرحلة',
      vehicleLabel: 'المركبة', moto: 'دراجة نارية', voiture: 'سيارة', fourgon: 'شاحنة صغيرة',
      callout: 'كمستقل، تُحسب أرباحك حسب كل رحلة مُسلَّمة وتُتابَع في «السجل والأرباح».',
    },
    s3: { h: 'وثائقك', sub: 'قم برفع وثائقك الثبوتية. سيتم التحقق منها خلال 48 ساعة.', add: 'إضافة', retry: 'إعادة المحاولة', refused: 'وثيقة غير واضحة — يُرجى إعادة التصوير.' },
    s4: { h: 'اكتمل التسجيل (تجريبي)', body: 'هذه شاشة تجريبية: لم تُرسَل أي بيانات إلى خادم ولن تتم أي مراجعة. في النسخة الفعلية، سيراجع فريقنا ملفك قبل بدء أول وردية.', contract: 'العقد', vehicle: 'المركبة', docs: 'الوثائق', docsStatus: '3/4 قيد التحقق (تجريبي)' },
    continueBtn: 'متابعة', home: 'العودة إلى الرئيسية',
    docStatus: { todo: 'مطلوبة', review: 'قيد التحقق', valid: 'موافَق عليها', refused: 'مرفوضة' } as Record<DocStatus, string>,
  },
};

export default function OnboardingScreen() {
  const { mode, colors } = useTheme();
  const { lang, rtl } = useLanguage();
  const t = L[lang];
  const total = 4;

  const [step, setStep] = React.useState(1);
  const [name, setName] = React.useState('Mehdi Alaoui');
  const [phone, setPhone] = React.useState('+212 6 ');
  const [city, setCity] = React.useState('Casablanca');
  const [contract, setContract] = React.useState<ContractId>('freelance');
  const [vehicle, setVehicle] = React.useState<VehicleId>('moto');
  const [docs, setDocs] = React.useState<Doc[]>(INITIAL_DOCS);

  function upload(id: string) {
    setDocs((d) => d.map((x) => (x.id === id ? { ...x, status: 'review' } : x)));
  }

  const VEHICLES: { id: VehicleId; label: string }[] = [
    { id: 'moto', label: t.s2.moto }, { id: 'voiture', label: t.s2.voiture }, { id: 'fourgon', label: t.s2.fourgon },
  ];

  return (
    <View style={[s.flex, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHead
        title={t.title}
        sub={t.sub}
        rtl={rtl}
        onBack={step > 1 ? () => setStep(step - 1) : () => router.back()}
      />

      {step < 4 && (
        <View style={s.stepHead}>
          <View style={[s.stepBar, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            {[1, 2, 3, 4].map((n) => (
              <View key={n} style={[s.stepSeg, { backgroundColor: n <= step ? colors.indigo9 : colors.border }]} />
            ))}
          </View>
          <Text style={[s.stepTxt, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>{t.step(step, total)}</Text>
        </View>
      )}

      <ScrollView style={s.flex} contentContainerStyle={{ padding: space[4], gap: space[4], paddingBottom: touch.primary + space[5] }}>
        <View style={[s.callout, { backgroundColor: colors.panel, borderColor: colors.border, flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <InfoIcon size={14} color={colors.muted} />
          <Text style={[s.calloutTxt, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>{t.demo}</Text>
        </View>

        {step === 1 && (
          <>
            <Text style={[s.h, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>{t.s1.h}</Text>
            <View>
              <Text style={[s.label, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>{t.s1.name}</Text>
              <TextInput
                style={[s.input, { borderColor: colors.border, color: colors.text, textAlign: rtl ? 'right' : 'left' }]}
                value={name} onChangeText={setName}
                testID="inscription-nom" accessibilityLabel={t.s1.name}
              />
            </View>
            <View>
              <Text style={[s.label, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>{t.s1.phone}</Text>
              <View style={[s.inputRow, { borderColor: colors.border, flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                <MobileIcon size={16} color={colors.muted} />
                <TextInput
                  style={[s.inputFlex, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}
                  value={phone} onChangeText={setPhone} keyboardType="phone-pad"
                  testID="inscription-telephone" accessibilityLabel={t.s1.phone}
                />
              </View>
            </View>
            <View>
              <Text style={[s.label, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>{t.s1.city}</Text>
              <View style={[s.chipsRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                {CITIES.map((c) => {
                  const on = city === c;
                  return (
                    <Pressable
                      key={c} onPress={() => setCity(c)}
                      style={[s.chip, { borderColor: on ? colors.indigo9 : colors.border, backgroundColor: on ? colors.indigo9 + '18' : colors.panel }]}
                    >
                      <Text style={[s.chipTxt, { color: on ? colors.indigo9 : colors.text }]}>{c}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={[s.h, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>{t.s2.h}</Text>
            <View>
              <Text style={[s.label, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>{t.s2.contractLabel}</Text>
              <View style={[s.grid2, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                {([
                  { id: 'salarie' as ContractId, title: t.s2.salarie, desc: t.s2.salarieDesc },
                  { id: 'freelance' as ContractId, title: t.s2.freelance, desc: t.s2.freelanceDesc },
                ]).map((c) => {
                  const on = contract === c.id;
                  return (
                    <Pressable
                      key={c.id} onPress={() => setContract(c.id)}
                      style={[s.contractCard, { borderColor: on ? colors.indigo9 : colors.border, backgroundColor: on ? colors.indigo9 + '10' : colors.panel }]}
                    >
                      <View style={[s.rowBetween, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                        <Text style={[s.contractTitle, { color: colors.text }]}>{c.title}</Text>
                        {on && <CheckCircleIcon size={16} color={colors.indigo9} />}
                      </View>
                      <Text style={[s.contractDesc, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>{c.desc}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View>
              <Text style={[s.label, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>{t.s2.vehicleLabel}</Text>
              <View style={[s.segmented, { borderColor: colors.border, flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                {VEHICLES.map((v) => {
                  const on = vehicle === v.id;
                  return (
                    <Pressable
                      key={v.id} onPress={() => setVehicle(v.id)}
                      style={[s.segItem, { backgroundColor: on ? colors.indigo9 : 'transparent' }]}
                    >
                      <Text style={[s.segTxt, { color: on ? 'white' : colors.text }]}>{v.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            {contract === 'freelance' && (
              <View style={[s.callout, { backgroundColor: colors.indigo9 + '10', borderColor: colors.indigo9 + '33', flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                <InfoIcon size={14} color={colors.indigo9} />
                <Text style={[s.calloutTxt, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>{t.s2.callout}</Text>
              </View>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <Text style={[s.h, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>{t.s3.h}</Text>
            <Text style={[s.subtle, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>{t.s3.sub}</Text>
            <View style={{ gap: space[2] }}>
              {docs.map((d) => {
                const meta = DOC_STATUS_META[d.status];
                const fg = resolveColor(meta.colorName, 9, mode);
                const canUpload = d.status === 'todo' || d.status === 'refused';
                return (
                  <View key={d.id} style={[s.docCard, { backgroundColor: colors.panel, borderColor: colors.border }]}>
                    <View style={[s.rowBetween, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                      <View style={[s.rowStart, { flexDirection: rtl ? 'row-reverse' : 'row', flex: 1, minWidth: 0 }]}>
                        <View style={[s.docIcon, { backgroundColor: fg + '22' }]}>
                          <meta.Icon size={16} color={fg} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[s.docName, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]} numberOfLines={1}>
                            {lang === 'ar' ? d.nameAr : d.nameFr}
                          </Text>
                          <View style={[s.docBadge, { backgroundColor: fg + '22', alignSelf: rtl ? 'flex-end' : 'flex-start' }]}>
                            <Text style={[s.docBadgeTxt, { color: fg }]}>{t.docStatus[d.status]}</Text>
                          </View>
                        </View>
                      </View>
                      {canUpload && (
                        <Pressable onPress={() => upload(d.id)} style={[s.uploadBtn, { borderColor: colors.indigo9 }]}>
                          <CameraIcon size={14} color={colors.indigo9} />
                          <Text style={[s.uploadTxt, { color: colors.indigo9 }]}>{d.status === 'refused' ? t.s3.retry : t.s3.add}</Text>
                        </Pressable>
                      )}
                    </View>
                    {d.status === 'refused' && (
                      <Text style={[s.refusedTxt, { color: resolveColor('red', 9, mode) }]}>{t.s3.refused}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}

        {step === 4 && (
          <View style={s.confirmWrap}>
            <View style={[s.confirmIcon, { backgroundColor: resolveColor('amber', 9, mode) + '22' }]}>
              <ClockIcon size={36} color={resolveColor('amber', 11, mode)} />
            </View>
            <Text style={[s.h, { color: colors.text, textAlign: 'center' }]}>{t.s4.h}</Text>
            <Text style={[s.subtle, { color: colors.muted, textAlign: 'center' }]}>{t.s4.body}</Text>
            <View style={[s.summaryCard, { backgroundColor: colors.panel, borderColor: colors.border }]}>
              <View style={[s.rowBetween, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                <Text style={[s.summaryLabel, { color: colors.muted }]}>{t.s4.contract}</Text>
                <Text style={[s.summaryValue, { color: colors.text }]}>{contract === 'salarie' ? t.s2.salarie : t.s2.freelance}</Text>
              </View>
              <View style={[s.rowBetween, { flexDirection: rtl ? 'row-reverse' : 'row', marginTop: space[2] }]}>
                <Text style={[s.summaryLabel, { color: colors.muted }]}>{t.s4.vehicle}</Text>
                <Text style={[s.summaryValue, { color: colors.text }]}>{VEHICLES.find((v) => v.id === vehicle)?.label}</Text>
              </View>
              <View style={[s.rowBetween, { flexDirection: rtl ? 'row-reverse' : 'row', marginTop: space[2] }]}>
                <Text style={[s.summaryLabel, { color: colors.muted }]}>{t.s4.docs}</Text>
                <View style={[s.docBadge, { backgroundColor: resolveColor('amber', 9, mode) + '22' }]}>
                  <Text style={[s.docBadgeTxt, { color: resolveColor('amber', 11, mode) }]}>{t.s4.docsStatus}</Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <BottomAction>
        {step < 4 ? (
          <PrimaryBtn onPress={() => setStep(step + 1)}>{t.continueBtn}</PrimaryBtn>
        ) : (
          <PrimaryBtn onPress={() => router.replace('/')}>{t.home}</PrimaryBtn>
        )}
      </BottomAction>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  stepHead: { paddingHorizontal: space[4], paddingTop: space[3] },
  stepBar: { gap: 4, marginBottom: space[2] },
  stepSeg: { flex: 1, height: 4, borderRadius: 2 },
  stepTxt: { fontSize: 12 },
  callout: { borderRadius: radius[3], borderWidth: 1, padding: space[3], gap: space[2], alignItems: 'flex-start' },
  calloutTxt: { flex: 1, fontSize: 12 },
  h: { fontSize: 17, fontWeight: '700' },
  subtle: { fontSize: 13 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: radius[3], paddingHorizontal: 12, height: 48, fontSize: 15 },
  inputRow: { borderWidth: 1, borderRadius: radius[3], paddingHorizontal: 12, height: 48, alignItems: 'center', gap: 8 },
  inputFlex: { flex: 1, fontSize: 15, height: '100%' },
  chipsRow: { flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 14, minHeight: touch.min, alignItems: 'center', justifyContent: 'center' },
  chipTxt: { fontSize: 13, fontWeight: '600' },
  grid2: { gap: space[2] },
  contractCard: { flex: 1, borderWidth: 1, borderRadius: radius[3], padding: space[3], gap: 4 },
  contractTitle: { fontSize: 14, fontWeight: '600' },
  contractDesc: { fontSize: 12 },
  segmented: { flexDirection: 'row', borderWidth: 1, borderRadius: radius[3], overflow: 'hidden' },
  segItem: { flex: 1, minHeight: touch.min, alignItems: 'center', justifyContent: 'center' },
  segTxt: { fontSize: 13, fontWeight: '600' },
  docCard: { borderWidth: 1, borderRadius: radius[3], padding: space[3] },
  rowBetween: { justifyContent: 'space-between', alignItems: 'center' },
  rowStart: { alignItems: 'center', gap: space[3] },
  docIcon: { width: 36, height: 36, borderRadius: radius[3], alignItems: 'center', justifyContent: 'center' },
  docName: { fontSize: 13, fontWeight: '600' },
  docBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, marginTop: 4 },
  docBadgeTxt: { fontSize: 11, fontWeight: '700' },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: radius[3], paddingHorizontal: 10, minHeight: touch.min, justifyContent: 'center' },
  uploadTxt: { fontSize: 12, fontWeight: '700' },
  refusedTxt: { fontSize: 12, marginTop: space[2] },
  confirmWrap: { alignItems: 'center', gap: space[3], paddingVertical: space[4] },
  confirmIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  summaryCard: { width: '100%', borderWidth: 1, borderRadius: radius[3], padding: space[3], marginTop: space[3] },
  summaryLabel: { fontSize: 13 },
  summaryValue: { fontSize: 13, fontWeight: '600' },
});
