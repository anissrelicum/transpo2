// Chapitre 2 — Installer l'exploitation : Karim, administrateur d'Atlas Express, se connecte
// et prépare tout ce qu'il faut avant la première course — société, équipe, flotte, zones,
// tarifs.
//
// Rejouable sur le même tenant : l'utilisateur invité, le chauffeur et le véhicule créés en
// direct sont pris dans de petites listes, en sautant ceux qui existent déjà.
import { Tournage, jeu, compte, saisirConnexion } from '../moteur.mjs';

const { tenant } = jeu();
const ADMIN = compte((c) => c.role === 'ADMIN');
const AN = new Date().getFullYear();

const INVITES = ['Omar Lahlou', 'Sara Bensouda', 'Anas Filali', 'Rim Tahiri', 'Hamid Sefrioui', 'Kenza Alami', 'Adil Naciri', 'Loubna Fassi'];
const CHAUFFEURS = ['Nabil Ouazzani', 'Hicham Bennis', 'Othmane Kabbaj', 'Rachid Saidi', 'Ayoub Lamrani', 'Zakaria Mernissi', 'Soufiane Hajji', 'Driss Amrani'];
const PLAQUES = ['31472-B-6', '52918-A-6', '74305-D-6', '18649-H-6', '66071-B-6', '23584-A-6', '90736-D-6', '45210-H-6'];

const email = (nom) => `${nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '.')}@${tenant}.ma`;
/** Premier candidat absent de la page (texte visible) : rend le chapitre rejouable. */
async function libre(p, candidats, cle = (x) => x) {
  const texte = await p.locator('body').innerText();
  const c = candidats.find((x) => !texte.includes(cle(x)));
  if (!c) throw new Error(`plus de candidat libre parmi ${candidats.join(', ')}`);
  return c;
}
/** Champ date : clic visible, puis saisie de la valeur ISO. */
async function dater(t, loc, iso) {
  await t.cliquer(loc);
  await loc.fill(iso);
  await t.page.waitForTimeout(250);
}
/** Liste déroulante Radix : ouvre, survole, choisit. */
async function choisir(t, declencheur, option) {
  await t.cliquer(declencheur);
  const o = t.page.getByRole('option', { name: option, exact: true });
  await t.survoler(o);
  await t.page.waitForTimeout(250);
  await o.click();
}

function horlogeVisible(t) {
  if (!process.env.DEMO_HORLOGE) return;
  return t.contexte.addInitScript(`setInterval(() => { let d = document.getElementById('__hz'); if (!d) { d = document.createElement('div'); d.id = '__hz'; d.style.cssText = 'position:fixed;top:0;left:0;z-index:2147483647;font:bold 22px monospace;background:#ff0;color:#000;padding:2px 6px'; document.documentElement.appendChild(d); } d.textContent = ((Date.now() - ${t.t0}) / 1000).toFixed(1); }, 50);`);
}

const t = new Tournage('02-installer', { chapitre: '2 · Installer l’exploitation' });
const p = await t.ouvrir();
await horlogeVisible(t);

await t.carton('Chapitre 2', 'Installer l’exploitation', 'Société, équipe, flotte, zones et tarifs : tout ce qu’il faut avant la première course.');
await t.dire('Deuxième chapitre : installer l’exploitation. Atlas Express a son espace ; Karim, son administrateur, va le préparer avant la première course.');

// — Connexion —
await t.aller(`/login?org=${tenant}`);
await t.dire('Karim se connecte à l’adresse de son organisation. Ses identifiants ne valent que pour Atlas Express : les données des autres transporteurs lui restent invisibles.', async () => {
  await t.survoler('[data-testid="detected-org"]');
  await p.waitForTimeout(600);
  await saisirConnexion(t, ADMIN.email, ADMIN.password);
  await p.getByRole('heading', { name: 'Tableau de bord' }).waitFor({ timeout: 60_000 });
  await p.waitForLoadState('networkidle').catch(() => {});
});
await t.dire('Il arrive sur le tableau de bord, qui résume la journée en un coup d’œil. Nous y reviendrons à la fin ; place à l’installation.', async () => {
  await t.survoler(p.getByText('En cours', { exact: true }).first());
  await p.waitForTimeout(1200);
  await t.survoler(p.getByText('COD encaissé', { exact: true }).first());
});

// — Paramètres —
await t.aller('/settings');
await t.dire('D’abord, les paramètres. L’identité légale de la société, avec son ICE et son registre du commerce, figure ensuite sur chaque facture émise aux marchands.', async () => {
  await t.survoler(p.getByText('Identité légale'));
  await p.waitForTimeout(700);
  await t.survoler(p.getByPlaceholder('001234567000012'));
  await p.waitForTimeout(700);
  await t.survoler(p.getByPlaceholder('123 Bd Zerktouni, Casablanca'));
});
await t.dire('Côté régional, tout est déjà réglé pour le Maroc : le dirham, le fuseau de Casablanca, et le français comme langue par défaut, l’arabe restant disponible.', async () => {
  const regional = p.locator('.rt-Card', { has: p.getByRole('heading', { name: 'Régional' }) });
  for (const cb of await regional.getByRole('combobox').all()) {
    await t.survoler(cb);
    await p.waitForTimeout(900);
  }
});
await t.dire('Enfin, la commission et la TVA. Ces deux taux pilotent toute la chaîne : la facture du marchand, le reversement de son argent, et les devis.', async () => {
  const carte = p.locator('.rt-Card', { has: p.getByRole('heading', { name: 'Commission & TVA' }) });
  await t.survoler(carte.locator('input').nth(0));
  await p.waitForTimeout(1000);
  await t.survoler(carte.locator('input').nth(1));
});

// — Utilisateurs & rôles —
await t.aller('/users');
const invite = await libre(p, INVITES, email);
await t.dire('Ensuite, l’équipe. Chaque personne a un rôle, et chaque rôle ouvre des écrans précis : l’administrateur voit tout, le dispatcher gère les commandes, la comptable la facturation.', async () => {
  await t.survoler(p.getByRole('heading', { name: 'Permissions par rôle' }));
  await p.waitForTimeout(800);
  const panneau = p.locator('.rt-Card', { has: p.getByRole('heading', { name: 'Permissions par rôle' }) });
  for (const r of ['Administrateur', 'Dispatcher', 'Comptable']) {
    await t.survoler(panneau.getByText(r, { exact: true }));
    await p.waitForTimeout(900);
  }
});
await t.dire('Ces droits sont vérifiés par le serveur, pas seulement masqués à l’écran. Marchands et livreurs ont leur propre compte, limité à leur portail ou à leur application.', async () => {
  await t.survoler(p.getByRole('row', { name: /Marchand/ }).first());
  await p.waitForTimeout(1200);
  await t.survoler(p.getByRole('row', { name: /Livreur/ }).first());
});
const dlgInvite = p.getByRole('dialog');
await t.dire(`Atlas Express grandit : Karim invite un second dispatcher, ${invite}.`, async () => {
  await t.cliquer(p.getByRole('button', { name: 'Inviter' }));
  await dlgInvite.waitFor();
  await t.taper(dlgInvite.getByPlaceholder('Nom complet'), invite, 45);
  await t.taper(dlgInvite.getByPlaceholder('prenom.nom@tenant.ma'), email(invite), 30);
  await choisir(t, dlgInvite.getByRole('combobox'), 'Dispatcher');
});
await t.dire('Un mot de passe temporaire est généré. Il n’est affiché qu’une seule fois, et sera changé par l’utilisateur : personne d’autre ne le connaîtra.', async () => {
  await t.cliquer(dlgInvite.getByRole('button', { name: 'Inviter' }));
  await p.getByRole('dialog').getByText('Mot de passe temporaire').waitFor({ timeout: 30_000 });
  await p.waitForTimeout(600);
  await t.survoler(p.getByRole('dialog').locator('[style*="code-font"]').first());
});
// Fermeture du dialogue hors montage : la ligne du nouveau dispatcher est déjà visible derrière.
await p.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click();
await p.getByRole('row', { name: new RegExp(invite) }).waitFor({ timeout: 15_000 });

// — Chauffeurs —
await t.aller('/drivers');
const chauffeur = await libre(p, CHAUFFEURS);
const dlgChauffeur = p.getByRole('dialog');
await t.dire(`Place à la flotte. Karim ajoute un nouveau chauffeur, ${chauffeur}, livreur à moto à Casablanca.`, async () => {
  await t.cliquer(p.getByRole('button', { name: 'Ajouter un chauffeur' }));
  await dlgChauffeur.waitFor();
  await t.taper(dlgChauffeur.getByPlaceholder('Youssef Benali'), chauffeur, 45);
  await t.taper(dlgChauffeur.getByPlaceholder('+212600000000'), '+212667' + String(Math.floor(100000 + Math.random() * 899999)), 35);
  await t.taper(dlgChauffeur.getByPlaceholder('AB123456'), 'BK' + String(Math.floor(100000 + Math.random() * 899999)), 45);
});
await t.dire('Il saisit les échéances du permis et de la visite médicale. Ce sont elles qui décident si le chauffeur peut recevoir des courses.', async () => {
  const dates = dlgChauffeur.locator('input[type="date"]');
  await dater(t, dates.nth(0), `${AN + 5}-05-31`);
  await dater(t, dates.nth(1), `${AN + 1}-09-30`);
  await t.cliquer(dlgChauffeur.getByRole('button', { name: 'Ajouter', exact: true }));
  await p.getByRole('row', { name: new RegExp(chauffeur) }).waitFor({ timeout: 15_000 });
});
await t.dire('Si un permis ou une visite médicale expire, le chauffeur est signalé ici, et automatiquement écarté des suggestions du dispatch jusqu’à régularisation.', async () => {
  const ligne = p.getByRole('row', { name: new RegExp(chauffeur) });
  await t.survoler(ligne.getByRole('cell').nth(1));
  await p.waitForTimeout(900);
  await t.survoler(ligne.getByRole('cell').nth(2));
  await p.waitForTimeout(900);
  await t.survoler(p.getByText('Conformité', { exact: true }));
});

// — Véhicules —
await t.aller('/vehicles');
const plaque = await libre(p, PLAQUES);
const dlgVehicule = p.getByRole('dialog');
await t.dire('Même logique pour les véhicules. Karim enregistre une moto, avec son immatriculation marocaine.', async () => {
  await t.cliquer(p.getByRole('button', { name: 'Ajouter un véhicule' }));
  await dlgVehicule.waitFor();
  await t.taper(dlgVehicule.getByPlaceholder('1234-A-56'), plaque, 90);
  await choisir(t, dlgVehicule.getByRole('combobox').first(), 'Moto');
  await t.taper(dlgVehicule.getByPlaceholder('ex. 1,2 t'), '30 kg · top-case', 40);
});
await t.dire('Puis les échéances de l’assurance et du contrôle technique. À l’approche du terme, l’alerte passe à l’orange, puis au rouge, jusqu’au tableau de bord.', async () => {
  const dates = dlgVehicule.locator('input[type="date"]');
  await dater(t, dates.nth(0), `${AN + 1}-01-31`);
  await dater(t, dates.nth(1), `${AN + 1}-04-30`);
  await t.cliquer(dlgVehicule.getByRole('button', { name: 'Ajouter', exact: true }));
  const ligne = p.getByRole('row', { name: new RegExp(plaque) });
  await ligne.waitFor({ timeout: 15_000 });
  await t.survoler(ligne.getByRole('cell').nth(4));
  await p.waitForTimeout(700);
  await t.survoler(ligne.getByRole('cell').nth(5));
});

// — Zones —
await t.aller('/zones');
await t.dire('Viennent ensuite les zones, qui guident l’affectation. Atlas Express couvre Casablanca, Rabat et Marrakech.', async () => {
  await t.survoler(p.locator('.leaflet-container'));
  await p.waitForTimeout(800);
  await t.cliquer(p.getByText('Casablanca Ouest', { exact: true }));
  await p.waitForTimeout(800);
});
await t.dire('Chaque zone porte un nom en français et en arabe, et s’appuie sur le découpage officiel : région, province, commune.', async () => {
  await t.survoler(p.getByLabel('Nom (français)'));
  await p.waitForTimeout(900);
  await t.survoler(p.getByLabel('Nom (arabe)'));
  await p.waitForTimeout(900);
  await t.survoler(p.getByLabel('Commune'));
});
await t.dire(`On y affecte les livreurs qui la connaissent. Karim y ajoute ${chauffeur}, qu’il vient de recruter.`, async () => {
  await t.cliquer(p.getByRole('button', { name: 'Ajouter', exact: true }));
  const choix = p.getByRole('dialog').getByText(chauffeur, { exact: true });
  await choix.waitFor();
  await t.cliquer(choix);
  await p.waitForTimeout(1200);
  await p.keyboard.press('Escape');
  await t.survoler(p.getByText(`Livreurs affectés`, { exact: false }));
});

// — Tarification —
await t.aller('/pricing');
await t.dire('Dernière étape : les tarifs. La grille fixe un prix par palier de distance, avec des suppléments pour un colis fragile ou une livraison programmée.', async () => {
  await t.survoler(p.getByRole('heading', { name: 'Grille par distance' }));
  await p.waitForTimeout(700);
  await t.survoler(p.getByRole('row').nth(2));
  await p.waitForTimeout(900);
  await t.survoler(p.getByLabel('Supplément fragile'));
});
await t.dire('Le simulateur calcule un devis en direct. Pour une course de quinze kilomètres, il indique le prix hors taxe, la TVA, et le total.', async () => {
  const curseur = p.getByRole('slider');
  await t.cliquer(curseur);
  for (let i = 0; i < 6; i++) { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(220); }
  await p.waitForTimeout(400);
  await t.survoler(p.getByText('Total TTC'));
});
await t.dire('Le prix suit une cascade stricte. D’abord, le prix fixe négocié avec le marchand, s’il existe. Sinon, la grille remisée. Et à défaut, la grille standard. Chaque marchand paie le prix convenu, sans tableur.', async () => {
  const sim = p.locator('.rt-Card', { has: p.getByRole('heading', { name: 'Simulateur de devis' }) });
  await t.cliquer(sim.getByRole('switch').first());
  await p.waitForTimeout(900);
  await t.survoler(sim.getByText('① Prix fixe marchand'));
  await p.waitForTimeout(900);
  await t.survoler(sim.getByText('② Grille remisée'));
  await p.waitForTimeout(900);
  await t.survoler(sim.getByText('③ Grille standard'));
  await p.waitForTimeout(500);
  await t.cliquer(sim.getByRole('switch').first());
});
await t.dire('L’exploitation est prête. Au chapitre suivant, un marchand dépose sa première commande depuis son portail.');

await t.fermer();
