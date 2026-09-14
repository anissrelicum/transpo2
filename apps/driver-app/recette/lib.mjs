// Harnais de recette de l'app livreur.
//
// Maestro s'est révélé instable sur cette application : la saisie du champ Organisation ne
// tenait pas, et Expo Go retombait sur le launcher entre deux flows. Le pilotage passe donc
// directement par `adb`, qui écrit dans ce même champ sans difficulté — et qui sert de toute
// façon à injecter la position GPS, seul moyen de tester le suivi et le géofencing.
//
// Un cas = un fichier `gXX.mjs`. Les captures partent dans qa/recette/<run>/TC-GXX/.
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';

const execFileP = promisify(execFile);
const ADB = `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`;
export const RUN = process.env.RUN_ID || '2026-09-13-local';
export const QA = path.resolve(import.meta.dirname, '../../../qa/recette', RUN);
export const PROJET = 'exp://127.0.0.1:8081';
// Largeur de l'écran du téléphone de recette — sert à constater une mise en page miroir.
export const LARGEUR_ECRAN = 1080;

const adb = (...args) => execFileSync(ADB, args, { encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024 });
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ écran */

/** Arbre d'accessibilité courant, aplati en liste de nœuds exploitables. */
export async function ecran() {
  // `uiautomator dump` rend par intermittence « null root node returned by
  // UiTestAutomationBridge » — l'arbre d'accessibilité est momentanément indisponible
  // (animation en cours, clavier qui s'ouvre). Sans réessai, la liste revenait vide et le
  // cas concluait à un écran absent alors qu'il était bien affiché : TC-G01 a échoué là-
  // dessus le 14/09, capture d'écran à l'appui. Le harnais réessaie plutôt que de mentir.
  //
  // Le fichier est EFFACÉ avant chaque tentative : le message d'erreur part sur la sortie
  // d'erreur du shell distant, pas dans ce que l'on relit, et un dump raté laissait en
  // place l'arbre du dump PRÉCÉDENT. On aurait alors lu, sans le savoir, l'écran d'avant.
  let xml = '';
  for (let essai = 1; essai <= 5; essai += 1) {
    adb('shell', 'rm', '-f', '/sdcard/ui.xml');
    adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml');
    // Le dump a pu ne rien écrire : `cat` sort alors en erreur, ce n'est pas un incident.
    try { xml = adb('shell', 'cat', '/sdcard/ui.xml'); } catch { xml = ''; }
    if (xml.includes('<node ')) break;
    xml = '';
    if (essai < 5) await sleep(700);
  }
  if (!xml) throw new Error("l'arbre d'accessibilité reste indisponible après 5 essais (uiautomator)");
  const noeuds = [];
  for (const balise of xml.split('<node ').slice(1)) {
    // Le dump est du XML : « Historique & gains » y arrive en « Historique &amp; gains ».
    // Sans décodage, aucun libellé contenant « & » n'était trouvable — et le cas concluait
    // à un écran manquant.
    const decoder = (v) => v
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
      .replace(/&amp;/g, '&');
    const attr = (n) => decoder((new RegExp(`${n}="([^"]*)"`).exec(balise) ?? [])[1] ?? '');
    const [, x1, y1, x2, y2] = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(balise) ?? [];
    noeuds.push({
      id: attr('resource-id'),
      texte: attr('text'),
      description: attr('content-desc'),
      classe: attr('class'),
      actif: attr('enabled') === 'true',
      focus: attr('focused') === 'true',
      paquet: attr('package'),
      centre: x1 ? [Math.round((+x1 + +x2) / 2), Math.round((+y1 + +y2) / 2)] : null,
      // Bornes brutes : seule façon de constater une mise en page miroir (RTL), qu'aucun
      // attribut d'accessibilité ne déclare.
      bornes: x1 ? [+x1, +y1, +x2, +y2] : null,
    });
  }
  return noeuds;
}

/** Premier nœud correspondant : par testID, texte exact, ou fragment de texte. */
export function chercher(noeuds, cible) {
  const t = String(cible);
  // L'élément TOUCHABLE porte `content-desc` (onglet, bouton) ; le libellé visible n'est
  // qu'un `text` à l'intérieur. Viser le second peut manquer la zone tactile réelle.
  return noeuds.find((n) => n.id === t)
    ?? noeuds.find((n) => n.description === t && n.centre)
    ?? noeuds.find((n) => n.texte === t && n.centre)
    // Android met les boutons de boîte de dialogue en CAPITALES : la comparaison exacte
    // échouerait sur « CONFIRMER » alors que le libellé du produit est « Confirmer ».
    ?? noeuds.find((n) => n.centre
      && [n.texte, n.description].some((v) => v.trim().toLowerCase() === t.toLowerCase()))
    ?? noeuds.find((n) => (n.description.includes(t) || n.texte.includes(t)) && n.centre)
    ?? null;
}

/** Attend qu'une cible apparaisse. Renvoie le nœud, ou lève au bout du délai. */
export async function attendre(cible, { timeout = 30_000, message } = {}) {
  const fin = Date.now() + timeout;
  let vus = 0;
  do {
    const noeuds = await ecran();
    vus = noeuds.length;
    const n = chercher(noeuds, cible);
    if (n) return n;
    await sleep(1000);
  } while (Date.now() < fin);
  throw new Error(message ?? `« ${cible} » introuvable après ${timeout} ms (${vus} nœuds à l'écran)`);
}

export async function visible(cible) {
  return chercher(await ecran(), cible) !== null;
}

/** Touche des coordonnées brutes — utile pour les boîtes système, hors arbre de l'app. */
export async function toucherPoint([x, y]) {
  adb('shell', 'input', 'tap', String(x), String(y));
  await sleep(600);
}

export async function toucher(cible) {
  const n = await attendre(cible);
  if (!n.centre) throw new Error(`« ${cible} » sans position à l'écran`);
  adb('shell', 'input', 'tap', String(n.centre[0]), String(n.centre[1]));
  await sleep(600);
  return n;
}

/**
 * Échappement attendu par `adb shell input text`.
 *
 * `input text` ne sait taper que de l'ASCII : un caractère accentué fait tomber le service
 * d'entrée d'Android (`NullPointerException` dans `InputShellCommand.sendText`) et le cas
 * échoue sur une trace Java incompréhensible. On le dit clairement plutôt que de le subir —
 * les jeux de données de la recette restent donc en ASCII (ce qui n'empêche pas de vérifier
 * l'arabe à l'écran : TC-G18 bascule la langue, il ne la tape pas).
 */
const pourInput = (v) => {
  if (/[^\x20-\x7E]/.test(v)) {
    throw new Error(`« ${v} » n'est pas saisissable par adb (caractères hors ASCII)`);
  }
  // `input text -abc` : la commande Android prend le tiret de tête pour une option et la
  // frappe part en morceaux, sans lever d'erreur. Le harnais doit le dire plutôt que de le
  // subir — TC-G01 est tombé le 14/09 sur un mot de passe « -wPCCz04TsKW ».
  if (v.startsWith('-')) {
    throw new Error(`« ${v} » commence par un tiret : « input text » le prendrait pour une option`);
  }
  // Le texte traverse le shell DU TÉLÉPHONE : tout caractère de motif y est développé.
  // `?` notamment — « que faire ? » arrivait en « que faire d », le point d'interrogation
  // ayant été remplacé par un nom de fichier du répertoire courant.
  return v.replace(/ /g, '%s').replace(/([()<>|;&*\\~"'`$?[\]{}#!])/g, '\\$1');
};

/**
 * Contenu lu d'un champ : son texte, ou le nombre de points s'il est masqué.
 * Un champ de mot de passe ne rend que des « • » — on ne peut en vérifier que la LONGUEUR,
 * ce qui suffit à détecter une frappe incomplète.
 */
function lu(noeud) {
  const t = noeud?.texte ?? '';
  return /^[•*·]+$/.test(t) ? { masque: true, taille: [...t].length } : { masque: false, valeur: t };
}

/**
 * Vide un champ puis y saisit `valeur`, et VÉRIFIE ce qui est arrivé dans le champ.
 *
 * Le focus est ATTENDU avant de taper : l'ouverture du clavier prend un instant, et une
 * saisie lancée trop tôt part dans le vide — c'est précisément ce qui faisait échouer le
 * pilotage par Maestro sur le premier champ du formulaire.
 *
 * La frappe est DÉCOUPÉE et RELUE : `input text` envoie les caractères plus vite que le
 * champ React Native ne se re-rend, et il en tombe — `livreur@rabatexpress.ma` arrivait en
 * `livreur@rabatexpr`, et le cas concluait « identifiants invalides » sur une saisie
 * amputée. Un harnais qui tape sans relire fabrique de faux KO.
 */
export async function saisir(cible, valeur) {
  /** Pose le curseur dans le champ et attend que le clavier soit réellement ouvert. */
  const prendreLeFocus = async () => {
    await toucher(cible);
    const fin = Date.now() + 8000;
    while (Date.now() < fin) {
      const n = chercher(await ecran(), cible);
      const clavier = /mInputShown=true/.test(adb('shell', 'dumpsys', 'input_method'));
      if (n?.focus && clavier) return true;
      adb('shell', 'input', 'tap', String(n?.centre?.[0] ?? 540), String(n?.centre?.[1] ?? 1055));
      await sleep(700);
    }
    return false;
  };

  for (let essai = 1; essai <= 3; essai++) {
    // Le focus est REPRIS à chaque essai : après un rechargement de bundle, le premier
    // appui tombe sur un écran encore en cours de montage et la frappe part dans le vide.
    await prendreLeFocus();
    // Vider dans LES DEUX SENS depuis le curseur. Sur un champ multiligne, `MOVE_END`
    // ne va qu'en fin de ligne courante : effacer seulement en arrière laissait la fin
    // du texte en place, et l'essai suivant empilait le sien par-dessus. (Descendre
    // d'abord au clavier n'est pas une option : sur un champ d'une seule ligne, la
    // flèche bas fait SORTIR du champ — le mot de passe partait alors dans le vide.)
    adb('shell', 'input', 'keyevent', 'KEYCODE_MOVE_END');
    adb('shell', 'input', 'keyevent', ...Array(90).fill('KEYCODE_DEL'));
    adb('shell', 'input', 'keyevent', ...Array(90).fill('KEYCODE_FORWARD_DEL'));
    await sleep(300);
    // Par tranches : le champ a le temps de se re-rendre entre deux morceaux. Le premier
    // essai va vite (8 caractères), les suivants ralentissent — la relecture ci-dessous
    // rattrape une frappe trop rapide, et sur 18 cas la connexion pesait un quart du run.
    const taille = essai === 1 ? 8 : 4;
    const pause = essai === 1 ? 150 : 260;
    for (const morceau of String(valeur).match(new RegExp(`.{1,${taille}}`, 'gs')) ?? []) {
      adb('shell', 'input', 'text', pourInput(morceau));
      await sleep(pause);
    }
    await sleep(450);

    const etat = lu(chercher(await ecran(), cible));
    const conforme = etat.masque ? etat.taille === [...String(valeur)].length : etat.valeur === String(valeur);
    if (conforme) return;
    console.log(`  saisie incomplète dans « ${cible} » (essai ${essai}/3) → `
      + (etat.masque ? `${etat.taille} caractère(s) sur ${[...String(valeur)].length}` : `« ${etat.valeur} »`));
  }
  throw new Error(`saisie impossible dans « ${cible} » après 3 essais`);
}

/** Balayage d'un point à un autre — « tirer pour rafraîchir », défilement. */
export async function glisser([x1, y1], [x2, y2], duree = 400) {
  adb('shell', 'input', 'swipe', String(x1), String(y1), String(x2), String(y2), String(duree));
  await sleep(800);
}

/**
 * Ferme le clavier s'il est ouvert.
 *
 * Le retour arrière ferme le clavier — mais s'il est DÉJÀ fermé, il quitte l'écran. Un cas
 * se retrouvait alors deux écrans en arrière sans rien comprendre. On vérifie donc l'état
 * de la méthode de saisie avant d'appuyer.
 */
export async function clavierFerme() {
  const etat = adb('shell', 'dumpsys', 'input_method');
  if (!/mInputShown=true/.test(etat)) return false;
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  await sleep(600);
  return true;
}

/* ------------------------------------------------------------- application */

/** Relance l'app à froid sur le projet Metro (formulaires vierges à chaque cas). */
export async function ouvrirApp({ langue = 'fr' } = {}) {
  // L'appareil photo système peut être resté au premier plan (prise de vue abandonnée) :
  // il recouvre alors l'app et le cas SUIVANT échoue sur « écran de connexion introuvable »,
  // sans rapport avec ce qu'il testait. Un cas ne doit jamais hériter du naufrage du
  // précédent.
  adb('shell', 'am', 'force-stop', 'com.android.camera2');
  adb('shell', 'am', 'force-stop', 'host.exp.exponent');
  await sleep(1500);
  adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', PROJET, 'host.exp.exponent');
  // L'app reprend la session précédente : elle peut s'ouvrir sur les missions plutôt que
  // sur le login. On attend l'un OU l'autre, puis on redescend au login si besoin.
  const fin = Date.now() + 90_000;
  while (Date.now() < fin) {
    await fermerBruitsSysteme();
    await fermerMenuExpo();
    if (await visible('login-organisation') || await visible('Profil')) break;
    await sleep(1500);
  }
  await sleep(2000); // le bundle peut finir de s'appliquer après le premier rendu
  await deconnecter();
  await attendre('login-organisation', { timeout: 30_000, message: "l'écran de connexion ne s'affiche pas" });
  if (langue === 'fr') await remettreEnFrancais();
}

/**
 * Ramène l'interface au français si un cas précédent l'a laissée en arabe.
 *
 * La langue est PERSISTÉE : un cas bilingue interrompu en plein milieu (TC-G18) laissait
 * toute la suite face à un écran arabe, et les cas suivants échouaient sur des libellés
 * introuvables — un faux KO en cascade, pour une cause sans rapport avec eux.
 */
export async function remettreEnFrancais() {
  if (!(await visible('FR'))) return false;
  await toucher('FR');
  await sleep(1500);
  for (const l of ['OK', 'حسنًا']) if (await visible(l)) { await toucher(l); break; }
  await sleep(800);
  adb('shell', 'am', 'force-stop', 'host.exp.exponent');
  await sleep(1500);
  adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', PROJET, 'host.exp.exponent');
  await attendre('login-organisation', { timeout: 60_000, message: 'le retour au français ne ramène pas au login' });
  await sleep(2500); // la langue s'hydrate après le premier rendu : laisser l'écran se poser
  return true;
}

/**
 * Écarte les boîtes système parasites de l'émulateur (« Bluetooth keeps stopping »…).
 * Elles recouvrent l'app et feraient échouer n'importe quel cas sur un faux motif.
 */
export async function fermerBruitsSysteme() {
  for (let i = 0; i < 3; i++) {
    const noeuds = await ecran();
    const n = noeuds.find((x) => x.centre && x.paquet !== 'host.exp.exponent'
      // « Turn on » : la boîte Google « Location Accuracy » s'intercale au premier
      // démarrage du partage de position (écran Shift). L'accorder est ce que ferait le
      // livreur — la refuser dégraderait le suivi que la section G doit vérifier.
      && ['close app', 'ok', 'dismiss', 'fermer l’application', 'wait', 'turn on']
        .includes((x.texte || '').trim().toLowerCase()));
    if (!n) return i > 0;
    await toucherPoint(n.centre);
    await sleep(900);
  }
  return true;
}

/**
 * Ferme le menu développeur d'Expo Go s'il recouvre l'app.
 * Il affiche le NOM du projet (« Transpo Livreur »), qu'on prendrait sinon pour l'écran de
 * connexion : un cas conclurait alors qu'il est déconnecté alors qu'il ne l'est pas.
 */
export async function fermerMenuExpo() {
  const noeuds = await ecran();
  if (!noeuds.some((n) => n.texte.startsWith('SDK version'))) return false;
  const bouton = chercher(noeuds, 'Continue') ?? chercher(noeuds, 'Continuer');
  if (bouton?.centre) {
    adb('shell', 'input', 'tap', String(bouton.centre[0]), String(bouton.centre[1]));
    await sleep(900);
  }
  return true;
}

/**
 * Ramène l'app à l'écran de connexion.
 *
 * L'app reprend la session au démarrage (`restoreSession`) : sans cela, tout cas jouant la
 * connexion atterrirait directement sur les missions. La déconnexion passe par le chemin
 * PRODUIT — Profil → Se déconnecter — plutôt que par un effacement de données : c'est ce que
 * ferait un livreur, et ça évite d'effacer aussi le cache du projet Expo.
 */
export async function deconnecter() {
  await fermerMenuExpo();
  if (await visible('login-organisation')) return false;
  // L'app peut être en arabe (TC-G18) : chercher les seuls libellés français laissait le
  // harnais croire qu'il n'y avait personne de connecté, et le cas suivant échouait sur
  // un « écran de connexion introuvable » qui n'avait rien à voir.
  const onglet = (await visible('Profil')) ? 'Profil' : (await visible('الملف')) ? 'الملف' : null;
  if (!onglet) return false;
  const seDeconnecter = onglet === 'Profil' ? 'Se déconnecter' : 'تسجيل الخروج';
  await toucher(onglet);
  await sleep(1200);
  // L'écran de profil défile : l'action de déconnexion est en bas.
  for (let i = 0; i < 6 && !(await visible(seDeconnecter)); i++) {
    adb('shell', 'input', 'swipe', '540', '1800', '540', '900', '300');
    await sleep(600);
  }
  await toucher(seDeconnecter);
  await sleep(1200);
  // Une confirmation apparaît si des actions restent en file.
  for (const libelle of [seDeconnecter, 'Confirmer', 'OK', 'تأكيد', 'حسنًا']) {
    if (await visible(libelle)) { await toucher(libelle); break; }
  }
  await attendre('login-organisation', { timeout: 30_000, message: 'la déconnexion n’a pas ramené au login' });
  return true;
}

/** Referme l'appareil photo système, qu'aucun cas ne doit laisser ouvert. */
export function fermerAppareilPhoto() {
  adb('shell', 'am', 'force-stop', 'com.android.camera2');
}

/* --------------------------------------------------------------- réseau */

/**
 * Coupe ou rétablit le réseau du téléphone — c'est le sujet de TC-G11.
 *
 * Le mode avion est préféré à `svc wifi disable` : il coupe TOUTES les radios d'un coup,
 * comme un livreur en sous-sol. Le pilotage `adb` lui-même passe par le transport USB et
 * survit à la coupure, ce qui permet de continuer à conduire le cas hors ligne.
 */
export function reseau(actif) {
  adb('shell', 'cmd', 'connectivity', 'airplane-mode', actif ? 'disable' : 'enable');
  console.log(`  réseau du téléphone → ${actif ? 'rétabli' : 'coupé (mode avion)'}`);
}

/* ------------------------------------------------------------------- GPS */

/**
 * Pose la position du téléphone. `adb emu geo fix` attend la LONGITUDE en premier.
 * L'app ne remonte une position que tous les 30 s ou tous les 50 m (lib/tracking.ts) :
 * un point isolé ne prouve rien, il faut une trajectoire.
 */
export function position(lat, lng) {
  execFileSync(ADB, ['emu', 'geo', 'fix', String(lng), String(lat)], { encoding: 'utf-8' });
}

/** Rejoue un déplacement : une position toutes les `pasMs`, assez espacées pour être émises. */
export async function deplacer(points, { pasMs = 35_000 } = {}) {
  for (const [lat, lng, libelle] of points) {
    position(lat, lng);
    console.log(`  position → ${libelle ?? `${lat}, ${lng}`}`);
    await sleep(pasMs);
  }
}

/* ------------------------------------------------------------------- API */

const API = process.env.API_URL || 'http://localhost:3000';
const TENANT = process.env.TENANT_SLUG || 'rabatexpress';
let jeton = null;

/**
 * Mot de passe d'un compte, relu dans COMPTES.md — jamais écrit en dur dans le harnais.
 * Un run précédent a vu un cas passer pour la mauvaise raison parce qu'un mot de passe
 * périmé traînait dans le code (OBS-05) : la seule source est ce que l'amorçage a émis.
 */
export function motDePasseDe(email) {
  const fichier = `${QA}/COMPTES.md`;
  if (!fs.existsSync(fichier)) {
    throw new Error(`${fichier} absent — lancer d'abord « node recette/amorcer.mjs »`);
  }
  const lignes = fs.readFileSync(fichier, 'utf-8').split('\n').filter((l) => l.includes(email));
  const m = /tempPassword=(\S+)/.exec(lignes.at(-1) ?? '');
  if (!m) throw new Error(`mot de passe introuvable pour ${email} dans COMPTES.md`);
  return m[1];
}

/** Appel API authentifié en administrateur du tenant — pour poser un décor, pas pour tester. */
export async function api(chemin, { method = 'GET', body } = {}) {
  if (!jeton) {
    const email = `admin@${TENANT}.ma`;
    const r = await fetch(`${API}/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-slug': TENANT },
      body: JSON.stringify({ email, password: motDePasseDe(email) }),
    });
    if (!r.ok) throw new Error(`connexion API impossible (${r.status})`);
    jeton = (await r.json()).token;
  }
  const r = await fetch(`${API}${chemin}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-tenant-slug': TENANT,
      authorization: `Bearer ${jeton}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${method} ${chemin} → ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

/**
 * Appel API dans la peau du LIVREUR — pour confronter ce que l'app montre à ce que le
 * serveur lui répond. L'administrateur du tenant ne peut pas servir de doublure : les
 * routes `/v1/driver/*` sont fermées à son rôle (403), et c'est très bien ainsi.
 */
let jetonLivreur = null;
export async function apiLivreur(chemin, { method = 'GET', body } = {}) {
  if (!jetonLivreur) {
    const email = `livreur@${TENANT}.ma`;
    const r = await fetch(`${API}/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-slug': TENANT },
      body: JSON.stringify({ email, password: motDePasseDe(email) }),
    });
    if (!r.ok) throw new Error(`connexion livreur impossible (${r.status})`);
    jetonLivreur = (await r.json()).token;
  }
  const r = await fetch(`${API}${chemin}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-tenant-slug': TENANT,
      authorization: `Bearer ${jetonLivreur}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${method} ${chemin} (livreur) → ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

/**
 * Pose des missions sur le dos d'un chauffeur. Décor pour les cas de la section G :
 * l'app livreur ne montre que les commandes affectées au chauffeur du compte.
 */
export async function missionsPour(chauffeur, fixtures) {
  const refs = [];
  for (const f of fixtures) {
    const o = await api('/v1/orders', {
      method: 'POST',
      body: {
        merchant: f.merchant ?? 'Boutique Test',
        fromCity: f.fromCity ?? 'Rabat',
        toCity: f.toCity ?? 'Casablanca',
        cod: f.cod ?? 0,
        proofLevel: f.proofLevel ?? 'photo',
        dropContact: f.dropContact ?? 'Client Recette',
        dropAddress: f.dropAddress ?? '1 rue de la Recette',
        dropPhone: '+212600000000',
      },
    });
    await api(`/v1/orders/${encodeURIComponent(o.ref)}/assign`, { method: 'POST', body: { driver: chauffeur } });
    refs.push(o.ref);
  }
  return refs;
}

/** Retire les missions en cours d'un chauffeur (décor d'un cas précédent). */
export async function viderMissions(chauffeur) {
  const commandes = await api('/v1/orders');
  for (const o of commandes) {
    if (o.driver === chauffeur && !['LIVREE', 'ANNULEE', 'RETOUR'].includes(o.status)) {
      await api(`/v1/orders/${encodeURIComponent(o.ref)}/cancel`, { method: 'POST', body: {} }).catch(() => {});
    }
  }
}

/* -------------------------------------------------------------- artefacts */

export function dossierCas(tc) {
  const d = path.join(QA, tc);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

export async function capture(tc, nom) {
  const d = dossierCas(tc);
  adb('shell', 'screencap', '-p', '/sdcard/cap.png');
  await execFileP(ADB, ['pull', '/sdcard/cap.png', path.join(d, `${nom}.png`)]);
  return path.join(d, `${nom}.png`);
}

/** Enregistrement vidéo du cas — même rôle que les .webm Playwright des sections A à F. */
export function video(tc) {
  const d = dossierCas(tc);
  const proc = execFile(ADB, ['shell', 'screenrecord', '--time-limit', '180', '/sdcard/rec.mp4']);
  return async function arreter() {
    // `pkill` sort en 1 si l'enregistrement s'est déjà arrêté (limite de 180 s atteinte) :
    // ce n'est pas une erreur du cas, il ne doit pas masquer le vrai verdict.
    try { adb('shell', 'pkill', '-INT', 'screenrecord'); } catch { /* déjà terminé */ }
    await sleep(2500);
    try { await execFileP(ADB, ['pull', '/sdcard/rec.mp4', path.join(d, `${tc}.mp4`)]); } catch { /* rien à tirer */ }
    proc.kill();
  };
}

/* --------------------------------------------------------------- verdict */

export function cas(tc, titre, corps) {
  return async () => {
    console.log(`\n=== ${tc} — ${titre} ===`);
    const arreterVideo = video(tc);
    try {
      await corps();
      console.log(`${tc} : OK`);
    } finally {
      await arreterVideo();
    }
  };
}
