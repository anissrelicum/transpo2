// Notifications push — OneSignal, derrière un garde-fou.
//
// Pourquoi ce fichier existe au lieu d'un `import` direct dans l'écran racine : le module
// natif de OneSignal N'EXISTE PAS dans Expo Go. Or c'est Expo Go qui fait tourner l'app
// pendant la recette — les vingt-et-un cas de la section G passent par lui. Un import
// direct casserait donc l'app au démarrage, et la recette avec elle, dès ce commit.
//
// Ici, le module est chargé PARESSEUSEMENT et l'absence du natif n'est pas une erreur :
//   · dans Expo Go            → l'app démarre, sans push, et le dit une fois au journal ;
//   · dans une build de dev   → OneSignal s'initialise normalement.
//
// L'identifiant externe est `<tenant>:<chauffeur>`. C'est la clé que le produit utilise
// déjà partout pour désigner un livreur (les commandes portent le NOM du chauffeur, et les
// homonymes sont refusés — cf. TC-D14) : le serveur peut donc recalculer exactement la
// même clé pour viser un appareil, sans table de correspondance à tenir.
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { signalerProposition } from './offer-signal';

// L'identifiant d'application OneSignal n'est PAS un secret : il est embarqué dans chaque
// copie de l'app. Le secret, c'est la clé REST — elle vit côté serveur et n'entre jamais
// ici. Même lecture d'environnement que pour l'URL de l'API (cf. `lib/api.ts`).
const envAppId = (globalThis as any)?.process?.env?.EXPO_PUBLIC_ONESIGNAL_APP_ID as string | undefined;
const APP_ID = envAppId || 'e5247c1a-99fb-4557-a226-5ae3ce81160f';

type ModuleOneSignal = {
  Debug: { setLogLevel: (n: number) => void };
  initialize: (appId: string) => void;
  login: (externalId: string) => void;
  logout: () => void;
  Notifications: {
    requestPermission: (fallbackToSettings: boolean) => Promise<boolean>;
    addEventListener: (nom: string, cb: (e: unknown) => void) => void;
  };
  User: { pushSubscription: { getIdAsync?: () => Promise<string | null> } };
};

let charge: ModuleOneSignal | null | undefined;   // undefined = pas encore tenté
let initialise = false;

/** Vrai dans Expo Go, où aucun module natif ajouté après coup n'est disponible. */
function dansExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

/**
 * Charge le module natif s'il existe. Rend `null` dans Expo Go ou si la build ne l'embarque
 * pas — ce n'est pas un incident, c'est l'environnement.
 */
function moduleNatif(): ModuleOneSignal | null {
  if (charge !== undefined) return charge;
  if (dansExpoGo()) {
    // eslint-disable-next-line no-console
    console.log('[push] Expo Go : OneSignal indisponible (module natif absent). L’app tourne sans push.');
    charge = null;
    return charge;
  }
  try {
    // require paresseux : un import statique serait évalué au démarrage, dans Expo Go aussi.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const mod = require('react-native-onesignal');
    charge = (mod.OneSignal ?? mod.default ?? null) as ModuleOneSignal | null;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('[push] OneSignal non chargé :', (e as Error).message);
    charge = null;
  }
  return charge;
}

/**
 * Initialise OneSignal. Appelée une fois, au montage de l'écran racine.
 *
 * La permission n'est PAS demandée ici : sur Android 13+ comme sur iOS, une demande qui
 * tombe au premier lancement, avant que le livreur ait compris à quoi elle sert, se solde
 * par un refus définitif. L'app a déjà un écran d'autorisations qui explique chaque accès
 * avant de le demander — c'est lui qui appellera `demanderLaPermission()`.
 */
export function initialiserLePush(): () => void {
  const os = moduleNatif();
  if (!os || initialise) return () => {};
  initialise = true;

  os.Debug.setLogLevel(__DEV__ ? 6 : 0);   // 6 = Verbose, 0 = None
  os.initialize(APP_ID);

  // Une course proposée (affectation automatique) porte `{ type: 'offer', ref, offerId }` :
  // la toucher ouvre l'app sur l'écran Missions, où la carte d'acceptation l'attend ; la
  // recevoir app ouverte recharge les propositions sans attendre la relecture périodique.
  const surClic = (e: unknown) => {
    // eslint-disable-next-line no-console
    console.log('[push] notification ouverte', e);
    if (estUneProposition(e)) {
      signalerProposition();
      try { router.push('/(tabs)/missions'); } catch { /* navigation pas encore montée */ }
    }
  };
  const surPremierPlan = (e: unknown) => {
    // eslint-disable-next-line no-console
    console.log('[push] notification reçue app ouverte', e);
    if (estUneProposition(e)) signalerProposition();
  };
  os.Notifications.addEventListener('click', surClic);
  os.Notifications.addEventListener('foregroundWillDisplay', surPremierPlan);

  return () => {
    const m = moduleNatif() as (ModuleOneSignal & {
      Notifications: { removeEventListener?: (n: string, cb: (e: unknown) => void) => void };
    }) | null;
    m?.Notifications.removeEventListener?.('click', surClic);
    m?.Notifications.removeEventListener?.('foregroundWillDisplay', surPremierPlan);
  };
}

/** La notification porte-t-elle une proposition de course ? (données jointes par l'API) */
function estUneProposition(e: unknown): boolean {
  const n = (e as { notification?: { additionalData?: unknown } } | null)?.notification;
  const data = n?.additionalData as { type?: unknown } | undefined;
  return data?.type === 'offer';
}

/** Demande la permission système. Rend `false` si le push n'est pas disponible ici. */
export async function demanderLaPermission(): Promise<boolean> {
  const os = moduleNatif();
  if (!os) return false;
  try {
    return await os.Notifications.requestPermission(true);
  } catch {
    return false;
  }
}

/** Rattache l'appareil au livreur connecté. Sans quoi le serveur ne sait pas qui viser. */
export function identifierLeLivreur(tenant: string, chauffeur: string): void {
  const os = moduleNatif();
  if (!os || !tenant || !chauffeur) return;
  try {
    os.login(`${tenant}:${chauffeur}`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('[push] identification impossible :', (e as Error).message);
  }
}

/**
 * Détache l'appareil à la déconnexion.
 *
 * Ce n'est pas du confort : deux livreurs se relaient parfois sur le même téléphone. Sans
 * cet appel, le second recevrait les missions du premier.
 */
export function oublierLeLivreur(): void {
  const os = moduleNatif();
  if (!os) return;
  try {
    os.logout();
  } catch {
    /* rien à faire : l'appareil se réattachera à la prochaine connexion */
  }
}

/** Le push est-il réellement disponible sur cet appareil ? (écran de diagnostic) */
export function pushDisponible(): boolean {
  return moduleNatif() !== null;
}
