// Chapitre 3 — Le marchand dépose : Leila Berrada (Maison Argane) se connecte à son espace
// marchand, lit son tableau de bord, crée une livraison avec l'assistant en trois étapes,
// la retrouve dans « Mes commandes », puis jette un œil à son portefeuille.
//
// La commande créée est consignée dans sortie/commande-marchand.json : le chapitre 4
// l'affecte à Youssef Amrani depuis le dispatch.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Tournage, SORTIE, compte, jeu, saisirConnexion } from '../moteur.mjs';

const TENANT = jeu().tenant;
const LEILA = compte((c) => c.merchant === 'Maison Argane');

// La course du jour : de la boutique (Maârif) à une cliente du même quartier.
const RETRAIT = {
  contact: 'Leila Berrada', tel: '0522 25 18 47',
  adresse: '14, rue Ahmed El Mokri, Maârif',
  notes: 'Boutique au rez-de-chaussée, demander Leila.',
};
const LIVRAISON = {
  contact: 'Nadia Tahiri', tel: '0661 47 25 93',
  adresse: 'Résidence Les Iris, 112 bd Al Massira Al Khadra, Maârif',
  notes: 'Troisième étage, appeler en arrivant.',
};
const COLIS = { description: 'Coffret huile d’argan bio et savon noir', cod: '420' };

/** Sélection Radix : ouvre le déclencheur puis choisit l'option, curseur visible. */
async function choisir(t, declencheur, option) {
  await t.cliquer(declencheur);
  const opt = t.page.getByRole('option', { name: option, exact: true });
  await opt.waitFor();
  await t.page.waitForTimeout(1400);
  await t.cliquer(opt);
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

const t = new Tournage('03-marchand', { chapitre: '3 · Le marchand dépose' });
const p = await t.ouvrir();

await t.carton('Chapitre 3', 'Le marchand dépose', 'Une livraison créée en une minute, suivie jusqu’à l’encaissement.');
await t.dire('Chapitre trois : le marchand dépose. Maison Argane, une marque de cosmétiques à l’argan installée à Casablanca, confie ses livraisons à Atlas Express.');

await aller(t, `/login?org=${TENANT}`);
await t.dire('Sa gérante, Leila Berrada, se connecte à son espace marchand, avec le compte que le transporteur lui a ouvert.', async () => {
  await saisirConnexion(t, LEILA.email, LEILA.password);
  await p.getByRole('heading', { name: 'Tableau de bord' }).waitFor({ timeout: 60_000 });
});

/* ---------------- Tableau de bord ---------------- */
await t.dire('Son tableau de bord lui donne l’essentiel : ses commandes, celles déjà livrées, celles en route, et le contre-remboursement qui reste à encaisser auprès de ses clients.', async () => {
  for (const k of ['Commandes', 'Livrées', 'En cours', 'COD à encaisser']) {
    await t.survoler(p.getByText(k, { exact: true }).first());
    await p.waitForTimeout(1300);
  }
});
await t.dire('À droite, son taux de réussite, calculé sur les commandes clôturées. C’est l’indicateur qui lui dit si son transporteur tient ses promesses.', async () => {
  await t.survoler(p.getByRole('heading', { name: 'Taux de réussite' }));
  await p.waitForTimeout(1500);
  await t.survoler(p.getByRole('progressbar').first());
});
await t.dire('Et au centre, ses dernières commandes, avec leur statut à jour.', async () => {
  await t.survoler(p.getByRole('heading', { name: 'Dernières commandes' }));
  await p.waitForTimeout(800);
  await t.survoler(p.getByText(/^CMD-/).nth(1));
});

/* ---------------- Assistant de création ---------------- */
await t.dire('Une cliente vient de commander un coffret sur la boutique en ligne. Leila crée la livraison, en trois étapes.', async () => {
  await t.cliquer(p.getByRole('link', { name: 'Nouvelle commande' }));
  await p.getByText('Créer une livraison en trois étapes').waitFor({ timeout: 60_000 });
  await p.waitForTimeout(600);
});

await t.dire('D’abord, le point de retrait : la boutique, rue Ahmed El Mokri, dans le Maârif.', async () => {
  await t.taper(p.getByPlaceholder('Nom du contact'), RETRAIT.contact, 35);
  await t.taper(p.getByPlaceholder('+212 6 00 00 00 00'), RETRAIT.tel, 30);
  await t.taper(p.getByPlaceholder('N°, rue, quartier'), RETRAIT.adresse, 25);
});
await t.dire('Elle ajoute une consigne pour le livreur, puis continue.', async () => {
  await t.taper(p.getByPlaceholder('Instructions d’accès, étage, code…'), RETRAIT.notes, 22);
  await t.cliquer(p.getByRole('button', { name: 'Continuer' }));
  await p.getByRole('heading', { name: 'Point de livraison' }).waitFor();
});

await t.dire('Ensuite, le point de livraison : la cliente, Nadia Tahiri, boulevard Al Massira, toujours dans le Maârif.', async () => {
  await t.taper(p.getByPlaceholder('Nom du contact'), LIVRAISON.contact, 35);
  await t.taper(p.getByPlaceholder('+212 6 00 00 00 00'), LIVRAISON.tel, 30);
  await t.taper(p.getByPlaceholder('N°, rue, quartier'), LIVRAISON.adresse, 22);
});

// L'estimation n'apparaît que si l'API accepte le devis pour un compte marchand.
const estimation = p.getByText('Total TTC');
await t.dire('La ville se choisit dans le référentiel des villes, qui sert aussi au calcul de la distance.', async () => {
  await choisir(t, p.getByRole('combobox').first(), 'Casablanca');
  await p.waitForTimeout(900);
  await t.survoler(p.getByText(/Casablanca → Casablanca/));
});
await t.dire('Une dernière consigne pour l’accès, et l’on passe au colis.', async () => {
  await t.taper(p.getByPlaceholder('Instructions d’accès, étage, code…'), LIVRAISON.notes, 22);
  await t.cliquer(p.getByRole('button', { name: 'Continuer' }));
  await p.getByRole('heading', { name: 'Colis & options' }).waitFor();
});

await t.dire('Un petit format, avec la description du contenu.', async () => {
  await t.cliquer(p.getByText('Petit', { exact: true }).first());
  await t.taper(p.getByPlaceholder('Ex. : coffret de 6 tasses en céramique'), COLIS.description, 25);
});
await t.dire('Le niveau de preuve exigé se règle ici : photo, signature, ou les deux. C’est ce que l’application imposera au livreur au moment de remettre le colis.', async () => {
  await choisir(t, p.getByRole('combobox').nth(1), 'signature');
});
await t.dire('La cliente paiera à la réception : quatre cent vingt dirhams, que le livreur devra encaisser.', async () => {
  await t.taper(p.getByPlaceholder('0', { exact: true }), COLIS.cod, 160);
  await p.waitForTimeout(500);
  // Rappel du COD dans l'encadré de prix — seulement si l'estimation est affichée.
  const rappel = p.getByText('COD à encaisser à la livraison');
  if (await rappel.isVisible()) await t.survoler(rappel);
});

if (await estimation.isVisible()) {
  await t.dire('À droite, le prix de la course est calculé en direct. Le moteur applique une cascade : un prix négocié pour ce marchand d’abord, sinon une remise contractuelle, sinon la grille du transporteur.', async () => {
    await t.survoler(p.getByText('Tarification', { exact: true }));
    await p.waitForTimeout(1800);
    await t.survoler(estimation);
  });
} else {
  console.warn('  ⚠ estimation de prix absente (devis refusé au rôle MERCHANT ?) — phrase sur le prix sautée');
}

let cree;
await t.dire('Un clic sur Créer la commande, et la demande part chez Atlas Express.', async () => {
  const reponse = p.waitForResponse((r) => r.url().endsWith('/api/orders') && r.request().method() === 'POST', { timeout: 60_000 });
  await t.cliquer(p.getByRole('button', { name: 'Créer la commande' }));
  const r = await reponse;
  if (!r.ok()) throw new Error(`création refusée : HTTP ${r.status()} ${await r.text()}`);
  cree = await r.json();
  await p.getByRole('heading', { name: 'Mes commandes' }).waitFor({ timeout: 60_000 });
  await p.waitForTimeout(500);
});

fs.mkdirSync(SORTIE, { recursive: true });
fs.writeFileSync(path.join(SORTIE, 'commande-marchand.json'), `${JSON.stringify({
  tenant: TENANT, ref: cree.ref, code: cree.code, merchant: 'Maison Argane',
  fromCity: cree.fromCity, toCity: cree.toCity, cod: cree.cod, creeLe: new Date().toISOString(),
}, null, 2)}\n`);
console.log(`  commande ${cree.ref} (code ${cree.code}) consignée dans sortie/commande-marchand.json`);

/* ---------------- Mes commandes ---------------- */
const ligne = p.getByRole('row', { name: new RegExp(cree.ref) });
await t.dire('La voici dans Mes commandes, au statut Nouvelle, avec sa référence et son montant à encaisser.', async () => {
  await t.survoler(ligne.getByText(cree.ref));
  await p.waitForTimeout(1500);
  await t.survoler(ligne.getByText('Nouvelle', { exact: true }));
});
await t.dire('Juste en dessous, son code de suivi : c’est lui que la cliente utilisera pour suivre son colis, sans créer de compte.', async () => {
  await t.survoler(ligne.getByText(/code de suivi/));
});

/* ---------------- Portefeuille ---------------- */
await t.dire('Dernier écran, le portefeuille.', async () => {
  await t.cliquer(p.getByRole('link', { name: 'Portefeuille' }));
  await p.getByRole('heading', { name: 'Portefeuille' }).waitFor({ timeout: 60_000 });
});
await t.dire('Leila y voit le contre-remboursement déjà encaissé pour elle, la commission retenue par le transporteur, et le net qui lui revient.', async () => {
  for (const k of [/^COD encaissé$/, /^Commission \(/, /^Net à reverser$/]) {
    await t.survoler(p.getByText(k).first());
    await p.waitForTimeout(1500);
  }
});
await t.dire('Chaque dirham est rattaché à une commande précise. Nous verrons au chapitre six comment la comptabilité rapproche ces montants, puis reverse le marchand.', async () => {
  await t.survoler(p.getByRole('columnheader', { name: 'Encaissée le' }));
  await p.waitForTimeout(1200);
  await t.survoler(p.getByRole('row').nth(1));
  await p.waitForTimeout(1200);
  await t.survoler(p.getByRole('row').last());
});

await t.dire('La commande de Leila attend maintenant un livreur. Direction le dispatch, au chapitre suivant.');

await t.fermer();
