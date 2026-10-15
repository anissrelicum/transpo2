// Chapitre 6 — La compta rapproche : Fatima Zahra Bennani (rôle COMPTABLE) rapproche la
// caisse des livreurs, enregistre un dépôt, résout un écart motivé, reverse le COD à Maison
// Argane et génère les factures ; puis Leila Berrada retrouve ces chiffres dans son portail.
//
// Tout ce chapitre est permis au rôle COMPTABLE (API : cash.controller.ts et
// billing.controller.ts, @Roles('ADMIN', 'COMPTABLE')) : Karim n'a pas à intervenir.
//
// État attendu (tenant amorcé + chapitre 5 joué le même jour UTC) :
//   - au moins une caisse « À déposer » (Youssef, déclarée depuis l'app au chapitre 5 ;
//     à défaut Mehdi, déclaré par l'amorçage) ;
//   - facultatif : une caisse en « Écart » (déclaration inférieure au théorique). Sans elle,
//     la séquence de résolution motivée est simplement sautée ;
//   - aucun reversement ni facture pour le mois en cours (actions à un coup par période).
//
// La génération des reversements et des factures porte sur la période courante (fuseau de
// Casablanca) : le tournage vérifie la période réellement envoyée et s'arrête si elle diffère,
// plutôt que de filmer un mois faux.
import * as fs from 'node:fs';
import { Tournage, compte, jeu, saisirConnexion } from '../moteur.mjs';

const TENANT = jeu().tenant;
const COMPTA = compte((c) => c.role === 'COMPTABLE');
const LEILA = compte((c) => c.merchant === 'Maison Argane');
const LIVREURS = jeu().comptes.filter((c) => c.role === 'DRIVER').map((c) => c.driver);
const MARCHAND = 'Maison Argane';

// Mois en cours, au fuseau de l'exploitation (Africa/Casablanca) : « 2026-10 ».
const PERIODE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit' })
  .format(new Date()).slice(0, 7);

/* ------------------------------ Aides ------------------------------ */

const prenom = (nom) => nom.split(' ')[0];

/** « 1 499,00 DH » → 1499 (arrondi au dirham). */
function montant(texte) {
  const m = (texte ?? '').replace(/ | /g, ' ').match(/([\d ]+)(?:,(\d+))?\s*DH/);
  return m ? Math.round(Number(m[1].replace(/ /g, '')) + Number(`0.${m[2] ?? 0}`)) : null;
}

/** Entier en toutes lettres (français de France), pour une synthèse vocale sans ambiguïté. */
function enLettres(n) {
  const U = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze',
    'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const D = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];
  const cent = (x) => {
    if (x < 20) return U[x];
    if (x < 70) { const d = Math.floor(x / 10), u = x % 10; return D[d] + (u === 0 ? '' : u === 1 ? ' et un' : `-${U[u]}`); }
    if (x < 80) return x === 71 ? 'soixante et onze' : `soixante-${U[x - 60]}`;
    return x === 80 ? 'quatre-vingts' : `quatre-vingt-${U[x - 80]}`;
  };
  const mille = (x) => {
    const c = Math.floor(x / 100), r = x % 100;
    const tete = c === 0 ? '' : c === 1 ? 'cent' : `${U[c]} cent${r === 0 ? 's' : ''}`;
    return [tete, r ? cent(r) : ''].filter(Boolean).join(' ') || 'zéro';
  };
  if (n < 1000) return mille(n);
  const k = Math.floor(n / 1000), r = n % 1000;
  const tete = k === 1 ? 'mille' : `${mille(k).replace(/(cent|vingt)s$/, '$1')} mille`;
  return r ? `${tete} ${mille(r)}` : tete;
}

/**
 * Fait voir un téléchargement : la vidéo headless n'a pas de barre de téléchargement.
 * Pose un encart (calque de démo, comme le bandeau de chapitre) avec le nom du fichier
 * RÉELLEMENT reçu et ses premières lignes.
 */
async function montrerFichier(page, telechargement) {
  const nom = telechargement.suggestedFilename();
  const chemin = await telechargement.path();
  const lignes = fs.readFileSync(chemin, 'utf-8').split('\n').slice(0, 5);
  await page.evaluate(({ nom, lignes }) => {
    document.getElementById('__demo_fichier')?.remove();
    const e = document.createElement('div');
    e.id = '__demo_fichier';
    e.style.cssText = 'position:fixed;left:24px;bottom:24px;z-index:2147483640;pointer-events:none;max-width:760px;' +
      'background:#fff;border:1px solid #d0d5dd;border-radius:12px;box-shadow:0 12px 32px rgba(16,24,40,.18);' +
      'padding:14px 16px;font:500 13px/1.45 Inter,system-ui,sans-serif;color:#111;opacity:0;transform:translateY(8px);' +
      'transition:all .3s ease';
    const titre = document.createElement('div');
    titre.textContent = `⬇  ${nom} — téléchargé`;
    titre.style.cssText = 'font-weight:700;margin-bottom:8px';
    const pre = document.createElement('pre');
    pre.textContent = lignes.join('\n');
    pre.style.cssText = 'margin:0;font:12px/1.5 ui-monospace,Menlo,monospace;color:#344054;white-space:pre;overflow:hidden';
    e.append(titre, pre);
    document.documentElement.appendChild(e);
    requestAnimationFrame(() => { e.style.opacity = '1'; e.style.transform = 'none'; });
  }, { nom, lignes });
}
const retirerFichier = (page) => page.evaluate(() => document.getElementById('__demo_fichier')?.remove());

/** Clique un bouton d'export et montre le fichier obtenu. */
async function exporter(t, bouton) {
  const [dl] = await Promise.all([t.page.waitForEvent('download', { timeout: 15_000 }), t.cliquer(bouton)]);
  await montrerFichier(t.page, dl);
}

/* ------------------------------ Tournage ------------------------------ */

const t = new Tournage('06-compta', { chapitre: '6 · La compta rapproche' });
const p = await t.ouvrir();

p.on('request', (r) => {
  if (!/\/v1\/(cash\/reversements|invoices)\/generate$/.test(r.url())) return;
  const periode = JSON.parse(r.postData() || '{}').period;
  if (periode !== PERIODE) {
    console.error(`  ✗ période envoyée par l'interface : ${periode ?? '(aucune)'} — attendue ${PERIODE}`);
    process.exit(1);
  }
});

await t.carton('Chapitre 6', 'La compta rapproche', 'Du cash encaissé sur le terrain jusqu’au reversement des marchands.');
await t.dire('Sixième chapitre : la comptabilité. L’argent encaissé sur le terrain doit maintenant être rapproché, déposé, puis reversé aux marchands.');

/* — Connexion de Fatima Zahra — */
await t.aller(`/login?org=${TENANT}`);
await t.dire('Fatima Zahra Bennani, comptable d’Atlas Express, se connecte avec son propre compte. Son rôle lui ouvre la caisse, les reversements et la facturation.', async () => {
  await saisirConnexion(t, COMPTA.email, COMPTA.password);
  await p.getByRole('heading', { name: 'Tableau de bord' }).waitFor({ timeout: 60_000 });
  await p.waitForTimeout(400);
  await t.survoler(p.getByText('Fatima Zahra Bennani').first());
});

/* — Caisse : réconciliation — */
await t.dire('Elle commence par la caisse.', async () => {
  await t.cliquer(p.getByRole('link', { name: 'Caisse', exact: true }));
  await p.getByRole('heading', { name: 'Réconciliation cash' }).waitFor({ timeout: 60_000 });
  await p.waitForLoadState('networkidle').catch(() => {});
});
await t.dire('Ici, chaque dirham encaissé par un livreur est suivi : le cash encore en circulation, ce qui attend d’être déposé, les écarts, et ce qui est déjà en agence.', async () => {
  for (const k of ['Cash en circulation', 'À déposer', 'Écarts du jour', 'Déposé']) {
    await t.survoler(p.getByText(k, { exact: true }).first());
    await p.waitForTimeout(1500);
  }
});
await t.dire('Pour chaque livreur, la console met côte à côte le COD théorique, calculé depuis ses livraisons, le cash qu’il a déclaré dans l’application, et l’écart.', async () => {
  for (const k of ['Théorique', 'Déclaré', 'Écart']) {
    await t.survoler(p.getByRole('columnheader', { name: k, exact: true }));
    await p.waitForTimeout(1700);
  }
});

/* — Dépôt d'une caisse déclarée sans écart — */
const lignes = p.getByRole('row');
const aDeposer = lignes.filter({ hasText: 'À déposer' });
const nbADeposer = await aDeposer.count();
if (nbADeposer === 0) throw new Error('aucune caisse « À déposer » : le livreur doit déclarer sa caisse (chapitre 5) avant ce chapitre');
let cible = aDeposer.first();
for (let i = 0; i < nbADeposer; i++) {
  if ((await aDeposer.nth(i).textContent())?.includes('Youssef Amrani')) { cible = aDeposer.nth(i); break; }
}
const texteCible = (await cible.textContent()) ?? '';
const livreur = LIVREURS.find((n) => texteCible.includes(n)) ?? 'Le livreur';
const declare = montant(await cible.locator('td').nth(1).textContent());
const detail = p.locator('div.rt-Card').filter({ hasText: 'COD théorique (livré)' }).first();

await t.dire(`${prenom(livreur)} a déclaré sa caisse depuis l’application en fin de tournée${declare ? ` : ${enLettres(declare)} dirhams` : ''}. Le montant correspond au dirham près, l’écart est nul.`, async () => {
  await t.cliquer(cible);
  await detail.waitFor();
  await p.waitForTimeout(600);
  await t.survoler(detail.getByText('Cash déclaré'));
});
await t.dire(`${livreur === 'Le livreur' ? 'Le livreur' : prenom(livreur)} remet les espèces en agence. Fatima enregistre le dépôt : la session est clôturée, et le montant passe dans le déposé.`, async () => {
  await t.cliquer(p.getByRole('button', { name: 'Enregistrer le dépôt en agence' }));
  await detail.getByText('Session clôturée').waitFor({ timeout: 20_000 });
  await p.waitForTimeout(800);
  await t.survoler(p.getByText('Déposé', { exact: true }).first());
});

/* — Écart : résolution motivée (si une caisse est en écart) — */
const enEcart = lignes.filter({ has: p.locator('.rt-Badge', { hasText: /^Écart$/ }) });
if (await enEcart.count()) {
  const ligne = enEcart.first();
  const texteEcart = (await ligne.textContent()) ?? '';
  const qui = LIVREURS.find((n) => texteEcart.includes(n)) ?? 'un livreur';
  await t.dire(`Chez ${qui}, en revanche, le cash déclaré est inférieur au théorique. La console le signale en rouge et bloque la clôture tant que l’écart n’est pas expliqué.`, async () => {
    await t.survoler(p.locator('.rt-CalloutRoot').filter({ hasText: 'Rapprochement requis' }));
    await p.waitForTimeout(1200);
    await t.cliquer(ligne);
    await detail.filter({ hasText: qui }).waitFor();
    await p.waitForTimeout(500);
    await t.survoler(detail.getByText('COD encaissés'));
  });
  await t.dire('Le détail liste chaque contre-remboursement encaissé. Fatima résout l’écart en choisissant un motif, et en ajoutant une note.', async () => {
    await t.cliquer(p.getByRole('button', { name: /Résoudre l’écart/ }));
    const d = p.getByRole('dialog');
    await d.waitFor();
    await p.waitForTimeout(400);
    await t.cliquer(d.locator('label', { hasText: 'Monnaie rendue non enregistrée' }));
    await t.taper(d.locator('textarea'), `Monnaie rendue au client, confirmée avec ${prenom(qui)} au retour de tournée.`, 22);
  });
  await t.dire('La session est clôturée, mais rien n’est effacé : le motif reste tracé, et l’écart alimente aussi le suivi de fraude du livreur.', async () => {
    await t.cliquer(p.getByRole('dialog').getByRole('button', { name: 'Valider la résolution' }));
    await p.getByRole('dialog').waitFor({ state: 'hidden' });
    await detail.getByText('Écart résolu').waitFor({ timeout: 20_000 });
    await p.waitForTimeout(500);
    await t.survoler(detail.getByText('Écart résolu'));
  });
} else {
  console.warn('  (aucune caisse en écart : séquence de résolution sautée)');
}

await t.dire('Et l’export comptable sort tout le rapprochement en un fichier, prêt pour le cabinet. Plus de tableur parallèle.', async () => {
  await exporter(t, p.getByRole('button', { name: 'Export comptable' }));
  await p.waitForTimeout(2500);
});
await retirerFichier(p);

/* — Reversement COD — */
await t.dire('Vient ensuite le reversement. Le COD encaissé appartient aux marchands : Transpo le regroupe pour chacun d’eux.', async () => {
  await t.cliquer(p.getByRole('link', { name: 'Reversement COD', exact: true }));
  await p.getByRole('heading', { name: 'Reversement COD' }).waitFor({ timeout: 60_000 });
  await p.waitForLoadState('networkidle').catch(() => {});
});
const ligneMarchand = p.getByRole('row').filter({ hasText: MARCHAND });
const dejaGenere = await ligneMarchand.count();
await t.dire('Un clic génère les reversements de la période : un par marchand, avec le nombre de commandes et le COD à lui reverser.', async () => {
  if (!dejaGenere) {
    await t.cliquer(p.getByRole('button', { name: 'Générer' }));
    await ligneMarchand.first().waitFor({ timeout: 20_000 });
  } else {
    console.warn(`  (reversements déjà générés : bouton seulement survolé)`);
    await t.survoler(p.getByRole('button', { name: 'Générer' }));
  }
  await p.waitForTimeout(800);
  await t.survoler(p.getByRole('columnheader', { name: 'COD à reverser' }));
});
// Ligne en attente de Maison Argane de préférence (relance d'une répétition : déjà versée).
const enAttente = ligneMarchand.filter({ hasText: 'En attente' });
const ligneRev = (await enAttente.count()) ? enAttente.first() : ligneMarchand.first();
const aPayer = (await enAttente.count()) > 0;
const panneau = p.locator('div.rt-Card').filter({ hasText: 'COD encaissé' }).filter({ hasText: MARCHAND }).first();
const codMarchand = montant(await ligneRev.locator('td').nth(1).textContent());

const ouvrir = async () => {
  await t.cliquer(ligneRev);
  await panneau.waitFor();
  await p.waitForTimeout(500);
  await t.survoler(panneau.getByText(/^Période/));
  await p.waitForTimeout(800);
};
if (aPayer) {
  await t.dire(`Pour ${MARCHAND}, Fatima fait le virement, puis le marque comme versé, avec la méthode et la référence bancaire.`, async () => {
    await ouvrir();
    await t.cliquer(p.getByRole('button', { name: /Marquer comme versé/ }));
    const d = p.getByRole('dialog');
    await d.waitFor();
    await p.waitForTimeout(300);
    await t.cliquer(d.getByRole('combobox'));
    await t.cliquer(p.getByRole('option', { name: 'Virement bancaire' }));
    await t.taper(d.getByPlaceholder(/VIR-/), `VIR-${PERIODE}-0187`, 50);
  });
  await t.dire('Le reversement passe à « Versé ». La référence est conservée, prête pour n’importe quel contrôle.', async () => {
    await t.cliquer(p.getByRole('dialog').getByRole('button', { name: 'Confirmer le reversement' }));
    await p.getByRole('dialog').waitFor({ state: 'hidden' });
    await panneau.getByText('Reversé par').waitFor({ timeout: 20_000 });
    await p.waitForTimeout(400);
    await t.survoler(panneau.getByText('Reversé par'));
  });
} else {
  console.warn('  (reversement déjà versé : paiement non rejoué)');
  await t.dire(`Le reversement de ${MARCHAND} est marqué « Versé », avec sa méthode et sa référence bancaire, prête pour n’importe quel contrôle.`, async () => {
    await ouvrir();
    await t.survoler(panneau.getByText('Reversé par'));
  });
}

/* — Factures — */
const ligneFacture = p.getByRole('row').filter({ hasText: MARCHAND });
await t.dire('Reste la facturation du service : les factures de la période sont générées à partir des livraisons effectuées, une par marchand.', async () => {
  await t.cliquer(p.getByRole('link', { name: 'Factures', exact: true }));
  await p.getByRole('heading', { name: 'Factures', exact: true }).waitFor({ timeout: 60_000 });
  await p.waitForLoadState('networkidle').catch(() => {});
  const factureDeja = await ligneFacture.count();
  if (!factureDeja) {
    await t.cliquer(p.getByRole('button', { name: 'Générer les factures' }));
    await ligneFacture.first().waitFor({ timeout: 20_000 });
  } else {
    console.warn('  (factures déjà générées : bouton seulement survolé)');
    await t.survoler(p.getByRole('button', { name: 'Générer les factures' }));
  }
  await p.waitForTimeout(600);
});
const fiche = p.locator('div.rt-Card').filter({ hasText: 'Total TTC' }).first();
await t.dire('Chaque facture détaille le montant des livraisons, la commission de quinze pour cent, le net hors taxes, puis la TVA à vingt pour cent.', async () => {
  await t.cliquer(ligneFacture.first());
  await fiche.filter({ hasText: MARCHAND }).waitFor();
  for (const k of ['Montant livraisons', 'Commission (15 %)', 'Net HT', 'TVA 20 %', 'Total TTC']) {
    await t.survoler(fiche.getByText(k, { exact: true }));
    await p.waitForTimeout(1100);
  }
});
await t.dire('L’export reprend toutes les factures dans un fichier, directement exploitable par le logiciel comptable.', async () => {
  await exporter(t, p.getByRole('button', { name: 'Export CSV' }));
  await p.waitForTimeout(2500);
});
await retirerFichier(p);

/* — Côté marchand : le portail de Maison Argane — */
await t.aller(`/login?org=${TENANT}`);
await t.dire(`Passons de l’autre côté. ${LEILA.name}, gérante de ${MARCHAND}, se connecte à son portail marchand.`, async () => {
  await saisirConnexion(t, LEILA.email, LEILA.password);
  await p.waitForURL(/\/portail/, { timeout: 60_000 });
  await p.waitForLoadState('networkidle').catch(() => {});
});
let memeMontant = false;
await t.dire('Dans son portefeuille, elle suit le contre-remboursement encaissé pour son compte, commande par commande.', async () => {
  await t.cliquer(p.getByRole('link', { name: 'Portefeuille', exact: true }));
  await p.getByRole('heading', { name: 'Portefeuille' }).waitFor({ timeout: 60_000 });
  await p.waitForLoadState('networkidle').catch(() => {});
  const carte = p.locator('div.rt-Card').filter({ hasText: 'COD encaissé' }).first();
  memeMontant = codMarchand != null && montant(await carte.textContent()) === codMarchand;
  await t.survoler(carte);
  await p.waitForTimeout(1200);
  await t.defiler(380, 1400);
});
await t.dire(memeMontant
  ? 'C’est exactement le montant rapproché par la comptabilité. La commission du transporteur et le solde net sont affichés en clair.'
  : 'La commission du transporteur et le solde net sont affichés en clair.', async () => {
  await t.defiler(-380, 900);
  await t.survoler(p.getByText(/^Commission \(/).first());
  await p.waitForTimeout(1500);
  await t.survoler(p.getByText('Net à reverser').first());
});
if (!memeMontant) console.warn('  ⚠ le COD encaissé du portail ne correspond pas au reversement de la console');
await t.dire('Et sa facture est calculée en continu à partir de ses livraisons : aucun relevé à réclamer, aucun chiffre à refaire de son côté.', async () => {
  await t.cliquer(p.getByRole('link', { name: 'Facture', exact: true }));
  await p.getByRole('heading', { name: 'Facture', exact: true }).waitFor({ timeout: 60_000 });
  await p.waitForLoadState('networkidle').catch(() => {});
  await t.survoler(p.getByText('Total TTC'));
});
await t.dire('Du terrain jusqu’au marchand, chaque dirham est suivi jusqu’au reversement. Au dernier chapitre, Karim pilote l’ensemble de l’activité d’Atlas Express.');

await t.fermer();
