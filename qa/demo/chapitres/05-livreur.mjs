// Chapitre 5 — Le livreur exécute : Youssef livre deux de ses missions dans l'app Android
// (preuve photo + signature, encaissement COD), puis déclare sa caisse du jour.
//
// Pré-requis : émulateur démarré, APK release installé (com.anissrelicum.transpodriver,
// API du homelab), décor posé par amorcer-demo.mjs le MÊME jour UTC (la caisse est datée).
import { jeu, compte, API } from '../moteur.mjs';
import { TournageMobile, adb, pause, ecran, chercher, attendre, visible, toucher, saisir, glisser } from '../mobile.mjs';

const PAQUET = 'com.anissrelicum.transpodriver';
const { tenant } = jeu();
const livreur = compte((c) => c.role === 'DRIVER' && c.driver === 'Youssef Amrani');

// Missions de Youssef, lues à l'API : l'ordre et les montants viennent du décor réel.
async function lireApi(chemin) {
  const co = await fetch(`${API}/v1/auth/login`, { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-slug': tenant },
    body: JSON.stringify({ email: livreur.email, password: livreur.password }) }).then((r) => r.json());
  return fetch(`${API}${chemin}`, {
    headers: { authorization: `Bearer ${co.token}`, 'x-tenant-slug': tenant } }).then((r) => r.json());
}
async function missions() {
  const r = await lireApi('/v1/driver/missions');
  return (Array.isArray(r) ? r : r.items ?? []).filter((o) => o.status === 'ASSIGNEE');
}
// Preuve par signature seule : la prise de photo reste bloquée sur l'émulateur (voir rapport).
const aLivrer = (await missions()).filter((o) => o.proofLevel === 'signature').slice(0, 2);
if (aLivrer.length < 2) throw new Error('Youssef doit avoir au moins deux missions assignées');
const enDirhams = (n) => `${n.toLocaleString('fr-FR')} dirhams`;

/** Accorde les boîtes système (localisation, caméra, notifications) quand elles s'ouvrent. */
async function accorderSysteme() {
  for (const libelle of ['While using the app', 'Only this time', 'Allow', 'Autoriser', 'Turn on']) {
    const n = chercher(await ecran(), libelle);
    if (n && libelle !== 'Autoriser') { adb('shell', 'input', 'tap', String(n.centre[0]), String(n.centre[1])); await pause(1200); return true; }
  }
  return false;
}

async function signer() {
  const noeuds = await ecran();
  const zone = chercher(noeuds, 'Faites signer ici');
  const [x, y] = zone?.centre ?? [540, 1500];
  glisser([x - 220, y + 20], [x - 60, y - 50], 350);
  glisser([x - 60, y - 50], [x + 40, y + 40], 300);
  glisser([x + 40, y + 40], [x + 220, y - 30], 350);
  await pause(800);
}

async function avancer(action) {
  // L'appui part parfois pendant que l'écran se re-rend après l'étape précédente : on
  // réappuie tant que la confirmation ne s'ouvre pas.
  for (let essai = 0; essai < 3; essai++) {
    await toucher(action);
    try { await attendre('Confirmer', 8_000); break; } catch { if (essai === 2) throw new Error(`« ${action} » n’ouvre pas de confirmation`); }
  }
  await toucher('Confirmer');
  await pause(1800);
}

const t = new TournageMobile('05-livreur', { chapitre: 'Chapitre 5', titre: 'Le livreur exécute' });

// Départ à froid : session et autorisations remises à zéro, l'app s'ouvre sur la connexion.
adb('shell', 'pm', 'clear', PAQUET);
adb('shell', 'am', 'force-stop', 'com.android.camera2');
adb('shell', 'monkey', '-p', PAQUET, '-c', 'android.intent.category.LAUNCHER', '1');
await attendre('login-organisation', 90_000);
await pause(1500);

await t.carton('Chapitre cinq : le livreur exécute. Nous passons sur le téléphone de Youssef Amrani, livreur d’Atlas Express à Casablanca.',
  'Chapitre 5', 'Le livreur exécute', 'Retrait, preuve, encaissement, caisse : chaque geste est horodaté, même sans réseau.');

t.etapeCourante('Connexion');
await t.dire('L’application livreur est disponible en français et en arabe. Youssef se connecte avec l’identifiant de sa société et ses accès personnels.', async () => {
  await saisir('login-organisation', tenant);
  await saisir('login-email', livreur.email);
  await saisir('login-mot-de-passe', livreur.password);
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  await pause(500);
  await toucher('login-valider');
  await attendre('Autorisations', 40_000);
});

t.etapeCourante('Autorisations');
await t.dire('Au premier lancement, l’application explique pourquoi elle a besoin de la localisation, de l’appareil photo et des notifications.', async () => {
  for (let i = 0; i < 3; i++) {
    const n = (await ecran()).find((x) => x.centre && x.texte === 'Autoriser');
    if (!n) break;
    adb('shell', 'input', 'tap', String(n.centre[0]), String(n.centre[1]));
    await pause(1800);
    await accorderSysteme();
    await pause(1200);
    await accorderSysteme();
  }
});
await t.dire('Une fois les accès accordés, Youssef commence sa journée.', async () => {
  if (await visible('Commencer ma journée')) await toucher('Commencer ma journée');
  await attendre(aLivrer[0].ref, 40_000);
});

t.etapeCourante('Mes missions');
await t.dire('Ses missions du jour sont là, affectées par le dispatch : le marchand, la destination, le montant à encaisser à la porte, et le niveau de preuve exigé par le marchand.', async () => {
  await pause(2500);
  glisser([540, 1700], [540, 1100], 700);
  await pause(1200);
  glisser([540, 1100], [540, 1700], 700);
});

const [m1] = aLivrer;
t.etapeCourante('Mission');
await t.dire(`Youssef ouvre sa première mission : ${enDirhams(m1.cod)} à encaisser, et une signature exigée à la remise.`, async () => {
  await toucher(m1.ref);
  await attendre('Naviguer', 30_000);
});
await t.dire('Il suit sa progression étape par étape. Chaque changement de statut est confirmé, horodaté, et le client est notifié.', async () => {
  await toucher('Naviguer');
  await attendre('Progression', 30_000);
  await avancer('Démarrer vers le retrait');
});
await t.dire('Colis récupéré chez le marchand, puis départ en livraison. Sans réseau, l’action est gardée sur le téléphone et transmise dès le retour de la connexion.', async () => {
  await avancer('Colis récupéré');
  await avancer('Démarrer la livraison');
  // La dernière étape mène à la preuve par « Confirmer la livraison », pas par un avancement.
  await attendre('Confirmer la livraison', 30_000);
  await toucher('Confirmer la livraison');
  await attendre('Signature du destinataire', 30_000);
});

t.etapeCourante('Preuve de livraison');
await t.dire('Chez le client, Youssef fait signer le destinataire directement sur l’écran. Tant que la preuve exigée n’est pas complète, la validation reste fermée.', async () => {
  await signer();
  await pause(1200);
});

t.etapeCourante('Encaissement');
await t.dire(`Il valide la preuve, puis saisit le montant reçu en espèces : ${enDirhams(m1.cod)}. L’application calcule la monnaie à rendre.`, async () => {
  await toucher('Valider la preuve');
  await attendre('cod-montant-recu', 30_000);
  await saisir('cod-montant-recu', String(m1.cod));
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  await pause(800);
});
await t.dire('Il confirme l’encaissement. La livraison est clôturée, et le montant part directement dans sa caisse du jour.', async () => {
  await toucher('Confirmer l’encaissement');
  await toucher('Oui, encaissé');
  await attendre('Livraison réussie', 40_000);
  await pause(1500);
});

t.etapeCourante('Mission suivante');
// La mission suivante est celle que l'app propose (ordre de la tournée) : on la lit à l'écran.
// Selon l'état de la tournée, « Mission suivante » ouvre la mission ou ramène à la liste :
// dans ce cas, on ouvre la première mission encore « Assignée » à livrer contre signature.
await toucher('Mission suivante');
const restantes = await missions();
let m2;
try {
  await attendre('Naviguer', 8_000);
  const ref = (await ecran()).map((n) => n.texte).find((x) => /^CMD-/.test(x));
  m2 = restantes.find((o) => o.ref === ref);
} catch { /* sur la liste */ }
if (!m2) {
  const liste = (await ecran()).map((n) => n.texte).filter((x) => /^CMD-/.test(x));
  m2 = liste.map((r) => restantes.find((o) => o.ref === r && o.proofLevel === 'signature')).find(Boolean)
    ?? restantes.find((o) => o.proofLevel === 'signature');
  await toucher(m2.ref);
  await attendre('Naviguer', 30_000);
}
await t.dire(`Mission suivante : ${enDirhams(m2.cod)} à encaisser. Le geste est le même, sans jamais avoir à deviner ce que l’application attend.`, async () => {
  await toucher('Naviguer');
  await attendre('Progression', 30_000);
  await avancer('Démarrer vers le retrait');
  await avancer('Colis récupéré');
  await avancer('Démarrer la livraison');
});
await t.dire('Signature, encaissement, livraison clôturée.', async () => {
  await attendre('Confirmer la livraison', 30_000);
  await toucher('Confirmer la livraison');
  await attendre('Signature du destinataire', 30_000);
  await signer();
  await toucher('Valider la preuve');
  await attendre('cod-montant-recu', 30_000);
  await saisir('cod-montant-recu', String(m2.cod));
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  await pause(500);
  await toucher('Confirmer l’encaissement');
  await toucher('Oui, encaissé');
  await attendre('Livraison réussie', 40_000);
});

// Ce que la caisse attend : toute la journée de Youssef, livraisons du matin comprises.
const total = Number((await lireApi('/v1/driver/cash'))?.theorique ?? m1.cod + m2.cod);
t.etapeCourante('Ma caisse du jour');
await t.dire('En fin de tournée, Youssef ouvre le récapitulatif de sa journée et sa caisse : le montant attendu reprend tous les encaissements de sa journée.', async () => {
  // L'écran de succès n'a pas d'onglets : on remonte jusqu'à la barre d'onglets.
  for (let i = 0; i < 4 && !(await visible('Profil')); i++) {
    if (await visible('Mission suivante')) await toucher('Mission suivante');
    else { adb('shell', 'input', 'keyevent', 'KEYCODE_BACK'); await pause(1200); }
  }
  await toucher('Profil');
  await toucher('Récap du jour');
  await attendre('Ma caisse du jour', 30_000);
  glisser([540, 1800], [540, 900], 700);
  await pause(800);
});
await t.dire(`Il déclare ce qu’il a réellement en main, ${enDirhams(total)}. Le compte est juste : il ne lui reste qu’à déposer l’argent en agence.`, async () => {
  await saisir('caisse-montant-declare', String(total));
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  await pause(600);
  await toucher('caisse-declarer');
  await pause(2500);
});
await t.dire('Côté bureau, la comptabilité voit cette déclaration immédiatement. C’est le sujet du chapitre suivant.');

t.fermer();
