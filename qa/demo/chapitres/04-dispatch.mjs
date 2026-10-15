// Chapitre 4 — Le dispatch affecte : Salma Idrissi (DISPATCHER) parcourt les commandes,
// ouvre le dossier d'une livraison terminée, affecte la commande déposée par Maison Argane
// au chapitre 3 à Youssef Amrani (elle apparaîtra sur son téléphone au chapitre 5),
// optimise et valide sa tournée, suit la flotte, puis tranche un retour en attente.
//
// Tous ces écrans sont ouverts au rôle DISPATCHER côté API (orders, dispatch, tournees,
// tracking, returns) : aucun passage par le compte administrateur n'est nécessaire.
//
// Commande à affecter : sortie/commande-marchand.json (écrit par 03-marchand.mjs), à défaut
// la première commande Nouvelle Casablanca → Casablanca de Maison Argane.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Tournage, SORTIE, compte, jeu, saisirConnexion } from '../moteur.mjs';

const TENANT = jeu().tenant;
const SALMA = compte((c) => c.role === 'DISPATCHER');
const YOUSSEF = 'Youssef Amrani';

function commandeDuMarchand() {
  const f = path.join(SORTIE, 'commande-marchand.json');
  if (!fs.existsSync(f)) return null;
  const c = JSON.parse(fs.readFileSync(f, 'utf-8'));
  return c.tenant === TENANT ? c : null;
}
// Carte Radix « feuille » : la colonne du dispatch est elle-même posée dans une carte.
const CARTE = '.rt-Card:not(:has(.rt-Card))';

/** Sélection Radix : ouvre le déclencheur puis choisit l'option, curseur visible. */
async function choisir(t, declencheur, option) {
  await t.cliquer(declencheur);
  const opt = t.page.getByRole('option', { name: option, exact: true });
  await opt.waitFor();
  await t.page.waitForTimeout(900);
  await t.cliquer(opt);
  await t.page.waitForTimeout(500);
}

/** Zoome à la molette (crans < 0 : dézoom) puis glisse la carte Leaflet, mouvements visibles. */
async function glisserCarte(t, carte, dx, dy, crans = 0) {
  const bb = await carte.boundingBox();
  const x = bb.x + bb.width / 2, y = bb.y + bb.height / 2;
  await t.page.mouse.move(x, y, { steps: 15 });
  for (let i = 0; i < Math.abs(crans); i++) {
    await t.page.mouse.wheel(0, crans < 0 ? 120 : -120);
    await t.page.waitForTimeout(500);
  }
  if (dx || dy) {
    await t.page.mouse.down();
    await t.page.mouse.move(x + dx, y + dy, { steps: 35 });
    await t.page.mouse.up();
    await t.page.waitForTimeout(400);
  }
}

/**
 * Navigation hors montage, puis un temps mort (coupé lui aussi) : sous charge — cartes
 * Leaflet notamment — la capture vidéo de Playwright prend jusqu'à ~2 s de retard, et le
 * début du plan suivant montrait encore la page précédente en cours de chargement.
 */
async function aller(t, url, attendre) {
  await t.aller(url, attendre);
  await t.page.waitForTimeout(2500);
}

const t = new Tournage('04-dispatch', { chapitre: '4 · Le dispatch affecte' });
const p = await t.ouvrir();

await t.carton('Chapitre 4', 'Le dispatch affecte', 'Choisir le bon livreur, organiser la tournée, traiter les imprévus.');
await t.dire('Chapitre quatre : le dispatch. Salma Idrissi organise chaque jour le travail des livreurs d’Atlas Express.');

await aller(t, `/login?org=${TENANT}`);
await t.dire('Elle se connecte avec son propre compte. Ses droits suivent son rôle : elle pilote l’exploitation, la facturation reste à la comptabilité.', async () => {
  await saisirConnexion(t, SALMA.email, SALMA.password);
  await p.waitForURL(/\/dashboard/, { timeout: 60_000 });
  await p.waitForLoadState('networkidle').catch(() => {});
});

/* ---------------- Commandes ---------------- */
await aller(t, '/orders', () => p.getByTestId('order-row').first().waitFor({ timeout: 60_000 }));
await t.dire('Première vue, les commandes de toute la société : marchand, trajet, statut, livreur affecté et montant à encaisser.', async () => {
  for (const col of ['Marchand', 'Trajet', 'Statut', 'Livreur', 'COD']) {
    await t.survoler(p.getByRole('columnheader', { name: col, exact: true }));
    await p.waitForTimeout(900);
  }
});
await t.dire('Les filtres ciblent en deux clics : par statut, par ville, par marchand ou par livreur. Cherchons les livraisons terminées de Maison Argane.', async () => {
  await choisir(t, p.getByRole('combobox').filter({ hasText: 'Statut' }), 'Livrée');
  await choisir(t, p.getByRole('combobox').filter({ hasText: 'Marchand' }), 'Maison Argane');
});

// Une livraison avec contre-remboursement : l'onglet Facturation a quelque chose à dire.
const livree = p.getByTestId('order-row').filter({ hasText: 'COD encaissé' }).first();
await t.dire('Ouvrons l’une d’elles.', async () => {
  await t.cliquer(livree.getByRole('link'));
  await p.getByRole('heading', { name: 'Cycle de vie' }).waitFor({ timeout: 60_000 });
  await p.waitForTimeout(600);
});
await t.dire('La fiche réunit tout le dossier : le cycle de vie franchi étape par étape, le retrait chez le marchand, la livraison au client, le colis, et l’encaissement.', async () => {
  await t.survoler(p.getByRole('heading', { name: 'Cycle de vie' }));
  await p.waitForTimeout(1500);
  for (const b of ['Retrait', 'Livraison', 'Colis', 'Encaissement (COD)']) {
    await t.survoler(p.getByText(b, { exact: true }).first());
    await p.waitForTimeout(900);
  }
});
await t.dire('L’onglet Preuve montre ce que le livreur a déposé sur place : la photo du colis remis, et la signature du destinataire, horodatées.', async () => {
  await t.cliquer(p.getByRole('tab', { name: 'Preuve de livraison' }));
  await p.waitForTimeout(800);
  const photo = p.getByAltText('Photo de livraison');
  if (await photo.count()) await t.survoler(photo);
  await p.waitForTimeout(1200);
  const sig = p.getByAltText('Signature du destinataire');
  if (await sig.count()) await t.survoler(sig);
});
await t.dire('L’historique est le journal des faits : chaque changement de statut, avec son auteur et son heure. En cas de litige, c’est la référence.', async () => {
  await t.cliquer(p.getByRole('tab', { name: 'Historique' }));
  await p.waitForTimeout(800);
  await t.survoler(p.getByTestId('order-event').first());
  await p.waitForTimeout(1000);
  await t.survoler(p.getByTestId('order-event').last());
});
await t.dire('Et la facturation détaille le contre-remboursement : le montant encaissé, la commission du transporteur, et le net à reverser au marchand.', async () => {
  await t.cliquer(p.getByRole('tab', { name: 'Facturation' }));
  await p.waitForTimeout(800);
  await t.survoler(p.getByText('COD encaissé', { exact: true }));
  await p.waitForTimeout(1000);
  await t.survoler(p.getByText('Net à reverser HT'));
});

/* ---------------- Dispatch ---------------- */
await aller(t, '/dispatch', () => p.getByText('Non affectées').waitFor({ timeout: 60_000 }));
await p.locator('.leaflet-container').first().waitFor();
const carte = p.locator('.leaflet-container').first();

const memo = commandeDuMarchand();
let carteCommande = memo ? p.locator(CARTE).filter({ hasText: memo.ref }).filter({ has: p.getByRole('button', { name: 'Affecter' }) }) : null;
if (!carteCommande || !(await carteCommande.count())) {
  if (memo) console.warn(`  ⚠ ${memo.ref} n'est plus à affecter — repli sur une commande Nouvelle Casablanca → Casablanca`);
  carteCommande = p.locator(CARTE)
    .filter({ has: p.getByRole('button', { name: 'Affecter' }) })
    .filter({ hasText: 'Nouvelle' })
    .filter({ hasText: 'Casablanca → Casablanca' });
}
carteCommande = carteCommande.first();
if (!(await carteCommande.count())) throw new Error('aucune commande Nouvelle Casablanca → Casablanca à affecter');
const ref = ((await carteCommande.getByText(/^CMD-/).first().textContent()) ?? '').trim();
console.log(`  commande affectée : ${ref}`);

await t.dire('Passons au dispatch. La carte montre en temps réel les livreurs en ligne et les commandes à affecter.', async () => {
  // La carte s'ouvre au barycentre des zones : on la ramène sur Casablanca.
  await glisserCarte(t, carte, 60, 320, -2);
  await p.waitForTimeout(500);
  await t.survoler(p.getByText('Livreur en ligne'));
});
await t.dire('À droite, tout ce qui attend un livreur. On y retrouve la commande que Leila vient de déposer pour Maison Argane.', async () => {
  await t.survoler(p.getByText('Non affectées'));
  await p.waitForTimeout(1000);
  await t.survoler(carteCommande.getByText(ref));
  await p.waitForTimeout(800);
  await t.survoler(carteCommande.getByText(/→/));
});

let suggestions = [];
await t.dire('Salma clique sur Affecter. Transpo classe les livreurs disponibles sur cent points : la zone, la disponibilité, et la charge déjà en cours.', async () => {
  const reponse = p.waitForResponse((r) => r.url().includes('/dispatch/suggest/'), { timeout: 60_000 });
  await t.cliquer(carteCommande.getByRole('button', { name: 'Affecter' }));
  suggestions = ((await (await reponse).json()).suggestions) ?? [];
  const dialogue = p.getByRole('dialog');
  await dialogue.getByText('Choisir').first().waitFor();
  await p.waitForTimeout(700);
  await t.survoler(dialogue.getByText(/zone \(40\)/));
});
const dialogue = p.getByRole('dialog');
const tete = suggestions[0]?.driver;
if (!suggestions.some((s) => s.driver === YOUSSEF)) throw new Error(`${YOUSSEF} absent des suggestions (indisponible ?)`);

await t.dire(`En tête, ${tete}, avec le meilleur score. Chaque barre détaille ce qui pèse dans la note.`, async () => {
  const premiere = dialogue.locator('.rt-Card').first();
  await t.survoler(premiere.getByText(tete, { exact: true }));
  await p.waitForTimeout(1200);
  await t.survoler(premiere.getByText(/^Charge/));
});
await t.dire('Un livreur indisponible, ou dont le permis ou la visite médicale a expiré, n’est même pas proposé : impossible de l’affecter par erreur.');

const carteYoussef = dialogue.locator('.rt-Card').filter({ hasText: YOUSSEF });
const phraseChoix = tete === YOUSSEF
  ? 'Salma suit la recommandation et choisit Youssef Amrani. La commande part aussitôt sur son téléphone.'
  : 'La recommandation reste un conseil. Youssef Amrani tourne déjà dans ce secteur : Salma le choisit, et la commande part aussitôt sur son téléphone.';
await t.dire(phraseChoix, async () => {
  await t.survoler(carteYoussef.getByText(YOUSSEF, { exact: true }));
  await p.waitForTimeout(1600);
  const reponse = p.waitForResponse((r) => r.url().includes('/assign') && r.request().method() === 'POST', { timeout: 60_000 });
  await t.cliquer(carteYoussef.getByRole('button', { name: 'Choisir' }));
  const r = await reponse;
  if (!r.ok()) throw new Error(`affectation refusée : HTTP ${r.status()} ${await r.text()}`);
  await dialogue.waitFor({ state: 'hidden' });
});
await t.dire('Elle quitte la liste des commandes à affecter. Youssef la découvrira au chapitre suivant, dans son application.', async () => {
  await p.locator(CARTE).filter({ hasText: ref }).filter({ has: p.getByRole('button', { name: 'Affecter' }) })
    .waitFor({ state: 'detached', timeout: 30_000 }).catch(() => {});
  await t.survoler(p.getByText('Non affectées'));
});

/* ---------------- Tournées ---------------- */
await aller(t, '/tournees', () => p.getByText('Ordre des arrêts').waitFor({ timeout: 60_000 }));
await t.dire('Dans le planificateur, voici la tournée de Youssef pour aujourd’hui : ses arrêts dans l’ordre, et le contre-remboursement total qu’il doit collecter.', async () => {
  // Plusieurs tournées : on choisit la plus récente de Youssef.
  const selecteur = p.getByRole('combobox').first();
  if (await selecteur.count() && !((await selecteur.textContent()) ?? '').includes(YOUSSEF)) {
    await t.cliquer(selecteur);
    await t.cliquer(p.getByRole('option', { name: new RegExp(YOUSSEF) }).last());
    await p.getByText('Ordre des arrêts').waitFor();
  }
  await t.survoler(p.getByText('Ordre des arrêts'));
  await p.waitForTimeout(1000);
  await t.survoler(p.getByText('Livraison', { exact: true }).first());
  await p.waitForTimeout(1200);
  await t.survoler(p.getByText('COD total à collecter'));
});
const optimiser = p.getByRole('button', { name: /Optimiser l’ordre/ });
if (await optimiser.isVisible() && await optimiser.isEnabled()) {
  await t.dire('Un clic sur Optimiser l’ordre recalcule l’enchaînement des arrêts au départ du hub. Salma peut encore ajuster à la main, arrêt par arrêt.', async () => {
    await t.cliquer(optimiser);
    await p.waitForTimeout(1200);
    await t.survoler(p.getByText(/Optimisée/).first());
    await p.waitForTimeout(800);
    await t.survoler(p.getByText('Livraison', { exact: true }).nth(1));
  });
}
const valider = p.getByRole('button', { name: 'Valider la tournée' });
if (await valider.isVisible()) {
  await t.dire('Elle valide la tournée, qui passe en cours.', async () => {
    await t.cliquer(valider);
    await p.getByRole('button', { name: 'Clôturer' }).waitFor({ timeout: 30_000 });
    await p.waitForTimeout(400);
    await t.survoler(p.getByText('EN_COURS'));
  });
}

/* ---------------- PC flotte ---------------- */
await aller(t, '/fleet', () => p.getByText('Livreurs en direct').first().waitFor({ timeout: 60_000 }));
await t.dire('Le PC flotte suit les livreurs en temps réel : combien sont en ligne, l’heure de leur dernière position, et le véhicule de chacun.', async () => {
  await t.survoler(p.getByText('Livreurs suivis', { exact: true }));
  await p.waitForTimeout(900);
  await t.survoler(p.getByText('Livreurs en direct').first());
  await p.waitForTimeout(600);
  // La carte s'ouvre au barycentre des zones : on la recentre tout de suite sur Youssef.
  await t.cliquer(p.getByText(YOUSSEF, { exact: true }).first());
  await p.waitForTimeout(300);
  await t.cliquer(p.getByRole('button', { name: 'Suivre' }));
  await p.waitForTimeout(800);
  await t.survoler(p.getByText('Dernière MAJ', { exact: true }));
});
await t.dire('Salma a sélectionné Youssef : la carte le suit dans les rues de Casablanca.', async () => {
  const carteFlotte = p.locator('.leaflet-container').first();
  const bb = await carteFlotte.boundingBox();
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 20 });
  await p.waitForTimeout(1500);
});
await t.dire('Les géofences dessinent les zones d’Atlas Express. Un livreur rattaché à une zone qui en sort passe en rouge, et une alerte remonte ici.', async () => {
  await t.survoler(p.getByText('Géofences', { exact: true }));
  await p.waitForTimeout(1500);
  await t.survoler(p.getByText('Événements géofence'));
});

/* ---------------- Retours ---------------- */
await aller(t, '/returns', () => p.getByRole('heading', { name: 'Gestion des retours' }).waitFor({ timeout: 60_000 }));
const aTraiter = p.getByRole('row').filter({ hasText: 'À traiter' }).first();
if (await aTraiter.count()) {
  await t.dire('Reste un imprévu. Une livraison a échoué, et le colis attend une décision.', async () => {
    await t.survoler(p.getByText('À traiter', { exact: true }).first());
    await p.waitForTimeout(1000);
    await t.cliquer(aTraiter);
    await p.getByText('Motif de l’échec').waitFor();
  });
  await t.dire('La fiche montre le motif déclaré par le livreur, le nombre de tentatives, et le contre-remboursement bloqué tant que le colis n’est pas remis.', async () => {
    await t.survoler(p.getByText('Motif de l’échec'));
    await p.waitForTimeout(1200);
    await t.survoler(p.getByText(/tentatives$/).first());
    await p.waitForTimeout(1000);
    await t.survoler(p.getByText(/^COD bloqué ·/).first());
  });
  await t.dire('Salma reprogramme une tentative : la commande repart en livraison. Au bout de trois échecs, seul le retour au marchand reste possible.', async () => {
    await t.cliquer(p.getByRole('button', { name: /Reprogrammer une tentative/ }));
    await p.getByText('Reprogrammée', { exact: true }).first().waitFor({ timeout: 30_000 });
    await p.waitForTimeout(800);
    await t.survoler(p.getByText('Reprogrammée', { exact: true }).first());
  });
} else {
  console.warn('  ⚠ aucun retour « À traiter » — séquence de décision sautée');
  await t.dire('Enfin, les retours : chaque livraison échouée attend une décision, reprogrammer une tentative ou rendre le colis au marchand, avec trois tentatives au plus.', async () => {
    await t.survoler(p.getByText('Reprogrammées', { exact: true }));
    await p.waitForTimeout(1200);
    await t.survoler(p.getByText('COD bloqué', { exact: true }));
  });
}

await t.dire('Les commandes sont affectées, la tournée est lancée. Place au terrain : au chapitre cinq, Youssef prend la route.');

await t.fermer();
