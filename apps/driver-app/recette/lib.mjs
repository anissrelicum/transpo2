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
export const RUN = process.env.RUN_ID || '2026-09-12-homelab';
export const QA = path.resolve(import.meta.dirname, '../../../qa/recette', RUN);
export const PROJET = 'exp://127.0.0.1:8081';

const adb = (...args) => execFileSync(ADB, args, { encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024 });
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ écran */

/** Arbre d'accessibilité courant, aplati en liste de nœuds exploitables. */
export async function ecran() {
  adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml');
  const xml = adb('shell', 'cat', '/sdcard/ui.xml');
  const noeuds = [];
  for (const balise of xml.split('<node ').slice(1)) {
    const attr = (n) => (new RegExp(`${n}="([^"]*)"`).exec(balise) ?? [])[1] ?? '';
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
 * Vide un champ puis y saisit `valeur`.
 *
 * Le focus est ATTENDU avant de taper : l'ouverture du clavier prend un instant, et une
 * saisie lancée trop tôt part dans le vide — c'est précisément ce qui faisait échouer le
 * pilotage par Maestro sur le premier champ du formulaire.
 */
export async function saisir(cible, valeur) {
  await toucher(cible);
  const fin = Date.now() + 6000;
  while (Date.now() < fin) {
    const n = chercher(await ecran(), cible);
    if (n?.focus) break;
    adb('shell', 'input', 'tap', String(n?.centre?.[0] ?? 540), String(n?.centre?.[1] ?? 1055));
    await sleep(700);
  }
  adb('shell', 'input', 'keyevent', 'KEYCODE_MOVE_END');
  for (let i = 0; i < 60; i++) adb('shell', 'input', 'keyevent', 'KEYCODE_DEL');
  await sleep(300);
  // `input text` n'accepte ni espace ni caractère spécial tel quel.
  adb('shell', 'input', 'text', valeur.replace(/ /g, '%s').replace(/([()<>|;&*\\~"'`$])/g, '\\$1'));
  await sleep(600);
}

/** Balayage d'un point à un autre — « tirer pour rafraîchir », défilement. */
export async function glisser([x1, y1], [x2, y2], duree = 400) {
  adb('shell', 'input', 'swipe', String(x1), String(y1), String(x2), String(y2), String(duree));
  await sleep(800);
}

export async function clavierFerme() {
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  await sleep(500);
}

/* ------------------------------------------------------------- application */

/** Relance l'app à froid sur le projet Metro (formulaires vierges à chaque cas). */
export async function ouvrirApp() {
  adb('shell', 'am', 'force-stop', 'host.exp.exponent');
  await sleep(1500);
  adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', PROJET, 'host.exp.exponent');
  // L'app reprend la session précédente : elle peut s'ouvrir sur les missions plutôt que
  // sur le login. On attend l'un OU l'autre, puis on redescend au login si besoin.
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
}

/**
 * Écarte les boîtes système parasites de l'émulateur (« Bluetooth keeps stopping »…).
 * Elles recouvrent l'app et feraient échouer n'importe quel cas sur un faux motif.
 */
export async function fermerBruitsSysteme() {
  for (let i = 0; i < 3; i++) {
    const noeuds = await ecran();
    const n = noeuds.find((x) => x.centre && x.paquet !== 'host.exp.exponent'
      && ['close app', 'ok', 'dismiss', 'fermer l’application', 'wait'].includes((x.texte || '').trim().toLowerCase()));
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
  if (!(await visible('Profil'))) return false;
  await toucher('Profil');
  await sleep(1200);
  // L'écran de profil défile : l'action de déconnexion est en bas.
  for (let i = 0; i < 6 && !(await visible('Se déconnecter')); i++) {
    adb('shell', 'input', 'swipe', '540', '1800', '540', '900', '300');
    await sleep(600);
  }
  await toucher('Se déconnecter');
  await sleep(1200);
  // Une confirmation apparaît si des actions restent en file.
  for (const libelle of ['Se déconnecter', 'Confirmer', 'OK']) {
    if (await visible(libelle)) { await toucher(libelle); break; }
  }
  await attendre('login-organisation', { timeout: 30_000, message: 'la déconnexion n’a pas ramené au login' });
  return true;
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

const API = process.env.API_URL || 'http://transpo-api.wedowonders.com';
const TENANT = 'rabatexpress';
let jeton = null;

/** Appel API authentifié en administrateur du tenant — pour poser un décor, pas pour tester. */
export async function api(chemin, { method = 'GET', body } = {}) {
  if (!jeton) {
    const r = await fetch(`${API}/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-slug': TENANT },
      body: JSON.stringify({ email: 'admin@rabatexpress.ma', password: 'Test1234' }),
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
