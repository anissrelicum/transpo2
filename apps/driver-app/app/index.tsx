// Connexion — cf. maquette `lot3-app-livreur.jsx` (fonction `Login`, écran 8).
// Deux étapes internes au même composant (pas deux routes, cf. brief lot A) :
// 1. identifiants  2. autorisations device (GPS, caméra, notifications).
import * as React from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { router, Stack } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { demanderLaPermission, pushDisponible, permissionDejaAccordee } from '../lib/push';
import { publicClient, setSession, restoreSession } from '../lib/api';
import { ApiError, type SocieteAuChoix } from '@transpo/api-client';
import { useTheme, resolveColor } from '../lib/theme';
import { useLanguage } from '../lib/i18n';
import { CameraIcon, PrimaryBtn, BottomAction } from '../components/shell';
import { Bouton, MARQUE } from '../components/ui';
import { Logo } from '../components/Logo';
import { touch, radius, space } from '@transpo/design-tokens';

// -----------------------------------------------------------------------------
// Icônes propres à cet écran. `components/shell/icons.tsx` est protégé (cf.
// design/PLAN-REFONTE-MOBILE.md §4) et ne porte que les glyphes du socle
// (onglets, retour) : pour rester fidèle à la maquette (icônes Radix) sans
// dépendance tierce (react-native-vector-icons/emoji, interdits par la grille
// de revue A2.8), on dessine ici en SVG pur les quelques glyphes qu'il manque.
// -----------------------------------------------------------------------------
function iconProps(size: number, color: string) {
  return {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  };
}
function TargetIcon({ size = 22, color }: { size?: number; color: string }) {
  return (
    <Svg {...iconProps(size, color)}>
      <Circle cx="12" cy="12" r="8" />
      <Circle cx="12" cy="12" r="3.5" />
      <Circle cx="12" cy="12" r="1" fill={color} stroke="none" />
    </Svg>
  );
}
function BellIcon({ size = 22, color }: { size?: number; color: string }) {
  return (
    <Svg {...iconProps(size, color)}>
      <Path d="M7 10a5 5 0 0 1 10 0c0 4 1.5 5.5 1.5 5.5h-13S7 14 7 10Z" />
      <Path d="M10.3 18.5a1.9 1.9 0 0 0 3.4 0" />
    </Svg>
  );
}
function CheckIcon({ size = 14, color }: { size?: number; color: string }) {
  return (
    <Svg {...iconProps(size, color)}>
      <Path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  );
}
function InfoIcon({ size = 16, color }: { size?: number; color: string }) {
  return (
    <Svg {...iconProps(size, color)}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 11v5.5" />
      <Circle cx="12" cy="8" r="0.9" fill={color} stroke="none" />
    </Svg>
  );
}

type PermId = 'gps' | 'cam' | 'notif';
type Step = 'login' | 'perms';

const L = {
  fr: {
    brand: 'Portrail',
    subtitle: 'Bonjour 👋\nPrêt pour la tournée ?',
    choisir: 'Votre compte existe dans plusieurs sociétés. Pour laquelle travaillez-vous aujourd’hui ?', email: 'E-mail', password: 'Mot de passe',
    login: 'Se connecter', forgot: 'Mot de passe oublié ?', becomeDriver: 'Devenir livreur',
    error: 'Identifiants invalides ou serveur injoignable.',
    permsTitle: 'Autorisations', permsSub: 'Trois accès sont nécessaires pour livrer.',
    permsInfo: 'Vous pourrez ajuster ces accès à tout moment dans les réglages du téléphone.',
    granted: 'Accordé', allow: 'Autoriser', start: 'Continuer',
    count: (n: number) => `${n}/3 autorisations`,
    restartTitle: 'Redémarrage nécessaire', restartBody: 'La mise en page en arabe (droite à gauche) sera appliquée au prochain lancement de l’app.',
    ok: 'OK',
    perms: {
      gps: { title: 'Localisation', desc: 'Pour vous guider et vous proposer les missions proches, pendant votre journée.' },
      cam: { title: 'Caméra', desc: 'Pour lire les étiquettes et la preuve de livraison.' },
      notif: { title: 'Notifications', desc: 'Pour ne rater aucune mission proposée.' },
    } as Record<PermId, { title: string; desc: string }>,
  },
  ar: {
    brand: 'Portrail',
    subtitle: 'مرحباً 👋\nمستعد للجولة؟',
    choisir: 'حسابك موجود في أكثر من شركة. لأي شركة تعمل اليوم؟', email: 'البريد الإلكتروني', password: 'كلمة المرور',
    login: 'تسجيل الدخول', forgot: 'نسيت كلمة المرور؟', becomeDriver: 'كن سائقًا',
    error: 'بيانات الدخول غير صحيحة أو الخادم غير متاح.',
    permsTitle: 'الأذونات', permsSub: 'ثلاثة أذونات ضرورية للتوصيل.',
    permsInfo: 'يمكنك تعديل هذه الأذونات في أي وقت من إعدادات الهاتف.',
    granted: 'مُمنوح', allow: 'السماح', start: 'متابعة',
    count: (n: number) => `${n}/3 أذونات`,
    restartTitle: 'إعادة تشغيل ضرورية', restartBody: 'سيُطبَّق التخطيط من اليمين إلى اليسار عند إعادة تشغيل التطبيق.',
    ok: 'حسنًا',
    perms: {
      gps: { title: 'الموقع', desc: 'لإرشادك واقتراح المهام القريبة منك خلال يومك.' },
      cam: { title: 'الكاميرا', desc: 'تصوير إثبات تسليم الطرود.' },
      notif: { title: 'الإشعارات', desc: 'استلام مهامك الجديدة وتنبيهات التوزيع.' },
    } as Record<PermId, { title: string; desc: string }>,
  },
};

export default function LoginScreen() {
  const { mode, colors } = useTheme();
  const errorColor = resolveColor('red', 9, mode);
  const { lang, rtl, toggleLanguage } = useLanguage();
  const t = L[lang];

  const [step, setStep] = React.useState<Step>('login');
  // Pas de champ « société » : le serveur la déduit de l'adresse. Seul un compte présent
  // dans plusieurs sociétés doit choisir — la liste n'arrive qu'après un mot de passe juste.
  const [choix, setChoix] = React.useState<SocieteAuChoix[] | null>(null);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [booting, setBooting] = React.useState(true);
  const [granted, setGranted] = React.useState<Record<PermId, boolean>>({ gps: false, cam: false, notif: false });

  // Reprise de session : le livreur ne se reconnecte pas à chaque ouverture.
  // Les autorisations device ont déjà été accordées lors d'une session
  // précédente (l'OS les mémorise) — pas besoin de repasser par l'étape perms.
  React.useEffect(() => {
    (async () => {
      if (await restoreSession()) { router.replace('/(tabs)/journee'); return; }
      setBooting(false);
    })();
  }, []);

  async function submit(societe?: string) {
    setLoading(true); setError(null);
    try {
      const res = await publicClient(societe ?? '').login(email.trim(), password);
      const slug = res.tenant ?? societe ?? '';
      setChoix(null);
      await setSession({ token: res.token, name: res.name, tenant: slug });
      // Accès déjà accordés (réinstallation, second livreur sur le même téléphone) : rien à
      // redemander, on n'affiche pas un écran « 0/3 » qui ment.
      const deja = {
        gps: (await Location.getForegroundPermissionsAsync()).granted,
        cam: (await ImagePicker.getCameraPermissionsAsync()).granted,
        notif: await permissionDejaAccordee(),
      };
      if (deja.gps && deja.cam && deja.notif) { router.replace('/(tabs)/journee'); return; }
      setGranted(deja);
      setStep('perms');
    } catch (e) {
      const corps = e instanceof ApiError ? (e.body as { societes?: SocieteAuChoix[] } | undefined) : undefined;
      if (e instanceof ApiError && e.status === 409 && corps?.societes?.length) setChoix(corps.societes);
      else setError(t.error);
    } finally {
      setLoading(false);
    }
  }

  async function requestPerm(id: PermId) {
    let ok = true;
    if (id === 'gps') ok = (await Location.requestForegroundPermissionsAsync()).granted;
    else if (id === 'cam') ok = (await ImagePicker.requestCameraPermissionsAsync()).granted;
    else if (id === 'notif') {
      // La demande est RÉELLE quand le push existe sur cette build (OneSignal). Elle ne
      // l'était pas jusqu'ici : la case se cochait sans que rien ne soit demandé.
      //
      // Là où le push n'existe pas — Expo Go, qui n'embarque aucun module natif ajouté
      // après coup — il n'y a rien à demander, et on ne bloque pas le livreur pour autant :
      // il livre très bien sans notification. L'écran le dit plus bas.
      ok = pushDisponible() ? await demanderLaPermission() : true;
    }
    if (ok) setGranted((g) => ({ ...g, [id]: true }));
  }

  async function onToggleLanguage() {
    const { restartRequired } = await toggleLanguage();
    if (restartRequired) Alert.alert(t.restartTitle, t.restartBody, [{ text: t.ok }]);
  }

  if (booting) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.indigo9} size="large" />
      </View>
    );
  }

  if (step === 'perms') {
    const PERM_IDS: PermId[] = ['gps', 'cam', 'notif'];
    const grantedCount = PERM_IDS.filter((id) => granted[id]).length;
    const allGranted = grantedCount === 3;
    const PERM_ICON: Record<PermId, React.ComponentType<{ size?: number; color: string }>> = {
      gps: TargetIcon, cam: CameraIcon, notif: BellIcon,
    };
    return (
      <View style={[s.flex, { backgroundColor: colors.bg }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.permsHead}>
          <Text style={[s.h1, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>{t.permsTitle}</Text>
          <Text style={[s.subtle, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>{t.permsSub}</Text>
        </View>
        <ScrollView
          style={s.flex}
          contentContainerStyle={{ padding: space[4], gap: space[3], paddingBottom: touch.primary + space[5] }}
        >
          {PERM_IDS.map((id) => {
            const Icon = PERM_ICON[id];
            const p = t.perms[id];
            const isGranted = granted[id];
            return (
              <View
                key={id}
                style={[s.permCard, { backgroundColor: colors.panel, borderColor: colors.border, flexDirection: rtl ? 'row-reverse' : 'row' }]}
              >
                <View style={[s.permIcon, { backgroundColor: colors.indigo9 + '22' }]}>
                  <Icon size={22} color={colors.indigo9} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.permTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>{p.title}</Text>
                  <Text style={[s.permDesc, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>{p.desc}</Text>
                </View>
                {isGranted ? (
                  <View style={[s.grantedBadge, { backgroundColor: colors.indigo9 + '22' }]}>
                    <CheckIcon size={12} color={colors.indigo9} />
                    <Text style={[s.grantedTxt, { color: colors.indigo9 }]}>{t.granted}</Text>
                  </View>
                ) : (
                  <Pressable onPress={() => requestPerm(id)} style={[s.allowBtn, { borderColor: colors.indigo9 }]} hitSlop={4}>
                    <Text style={[s.allowTxt, { color: colors.indigo9 }]}>{t.allow}</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
          <View style={[s.callout, { backgroundColor: colors.panel, borderColor: colors.border, flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <InfoIcon size={16} color={colors.muted} />
            <Text style={[s.calloutTxt, { color: colors.muted, textAlign: rtl ? 'right' : 'left' }]}>{t.permsInfo}</Text>
          </View>
        </ScrollView>
        <BottomAction>
          <PrimaryBtn disabled={!allGranted} onPress={() => router.replace('/(tabs)/journee')}>
            {allGranted ? t.start : t.count(grantedCount)}
          </PrimaryBtn>
        </BottomAction>
      </View>
    );
  }

  const valid = !!(email.trim() && password);
  const champ = (label: string, input: React.ReactNode) => (
    <View style={[s.champ, { backgroundColor: MARQUE.navy2 }]}>
      <Text style={[s.champLib, { textAlign: rtl ? 'right' : 'left' }]}>{label}</Text>
      {input}
    </View>
  );

  // Connexion (maquette validée, acte 1) : fond marine de la marque, un seul bouton ambre.
  // La société est mémorisée après la première connexion.
  return (
    <View style={[s.flex, { backgroundColor: MARQUE.navy }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={s.scrollWrap} keyboardShouldPersistTaps="handled">
        <View style={[s.marque, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <Logo taille={56} />
          <Text style={s.nomMarque}>Portrail</Text>
        </View>
        <Text style={[s.accroche, { textAlign: rtl ? 'right' : 'left' }]}>{t.subtitle}</Text>
        {error && <Text style={[s.error, { color: '#FF9B9B', textAlign: rtl ? 'right' : 'left' }]}>{error}</Text>}
        <View style={{ gap: 12, marginTop: 24 }}>
          {champ(t.email, (
            <TextInput style={[s.champInput, { textAlign: rtl ? 'right' : 'left' }]} value={email} onChangeText={(v) => { setEmail(v); setChoix(null); }}
              autoCapitalize="none" keyboardType="email-address" autoComplete="email"
              testID="login-email" accessibilityLabel={t.email} />
          ))}
          {champ(t.password, (
            <TextInput style={[s.champInput, { textAlign: rtl ? 'right' : 'left' }]} value={password} onChangeText={(v) => { setPassword(v); setChoix(null); }}
              secureTextEntry autoComplete="password" testID="login-mot-de-passe" accessibilityLabel={t.password} />
          ))}
        </View>
      </ScrollView>
      <View style={s.basConnexion}>
        {choix ? (
          <View style={{ gap: 10 }}>
            <Text style={[s.lienClair, { textAlign: rtl ? 'right' : 'left' }]}>{t.choisir}</Text>
            {choix.map((c) => (
              <Bouton key={c.slug} testID={`societe-${c.slug}`} variante="marque" loading={loading} onPress={() => submit(c.slug)}>{c.name}</Bouton>
            ))}
          </View>
        ) : (
          <Bouton testID="login-valider" variante="marque" onPress={() => submit()} disabled={!valid} loading={loading}>{t.login}</Bouton>
        )}
        <View style={[s.links, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <Pressable onPress={() => router.push('/onboarding')} hitSlop={8}>
            <Text style={s.lienClair}>{t.becomeDriver}</Text>
          </Pressable>
          <Pressable onPress={onToggleLanguage} hitSlop={8} accessibilityRole="button">
            <Text style={s.lienClair}>{lang === 'ar' ? 'Français' : 'العربية'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollWrap: { flexGrow: 1, padding: 24, paddingTop: 72 },
  marque: { alignItems: 'center', gap: 12 },
  nomMarque: { color: '#fff', fontSize: 26, fontWeight: '800' },
  accroche: { color: '#fff', fontSize: 30, fontWeight: '800', marginTop: 40, lineHeight: 36 },
  champ: { borderRadius: 14, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  champLib: { color: '#9FB0E8', fontSize: 12, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase' },
  champInput: { color: '#fff', fontSize: 17, minHeight: 40 },
  basConnexion: { padding: 24, paddingBottom: 36, gap: 14 },
  lienClair: { color: '#C9D1F2', fontSize: 14, fontWeight: '600' },
  langToggle: { position: 'absolute', top: space[5], right: space[5], minWidth: touch.min, minHeight: touch.min, alignItems: 'center', justifyContent: 'center' },
  langTxt: { fontSize: 13, fontWeight: '700' },
  brand: { alignItems: 'center', marginBottom: space[5] },
  logo: { width: 64, height: 64, borderRadius: radius[5], alignItems: 'center', justifyContent: 'center', marginBottom: space[3] },
  title: { fontSize: 24, fontWeight: '800' },
  sub: { fontSize: 14, marginTop: 4, textAlign: 'center' },
  card: { borderRadius: radius[4], padding: space[4], borderWidth: 1 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: space[3] },
  input: { borderWidth: 1, borderRadius: radius[3], paddingHorizontal: 12, height: 50, fontSize: 15 },
  inputRow: { borderWidth: 1, borderRadius: radius[3], paddingHorizontal: 12, height: 50, alignItems: 'center', gap: 8 },
  inputFlex: { flex: 1, fontSize: 15, height: '100%' },
  links: { justifyContent: 'space-between', marginTop: space[3] },
  link: { fontSize: 13, fontWeight: '700' },
  linkMuted: { fontSize: 13 },
  error: { fontSize: 13, marginBottom: 4 },
  permsHead: { paddingHorizontal: space[5], paddingTop: space[5], paddingBottom: space[2] },
  h1: { fontSize: 20, fontWeight: '800' },
  subtle: { fontSize: 13, marginTop: 4 },
  permCard: { borderRadius: radius[4], borderWidth: 1, padding: space[3], alignItems: 'center', gap: space[3] },
  permIcon: { width: 44, height: 44, borderRadius: radius[3], alignItems: 'center', justifyContent: 'center' },
  permTitle: { fontSize: 15, fontWeight: '600' },
  permDesc: { fontSize: 12, marginTop: 2 },
  grantedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full },
  grantedTxt: { fontSize: 12, fontWeight: '700' },
  allowBtn: { minHeight: touch.min, paddingHorizontal: 14, borderRadius: radius[3], borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  allowTxt: { fontSize: 13, fontWeight: '700' },
  callout: { borderRadius: radius[3], borderWidth: 1, padding: space[3], gap: space[2], alignItems: 'flex-start' },
  calloutTxt: { flex: 1, fontSize: 12 },
});
