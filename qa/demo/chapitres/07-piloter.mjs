// Chapitre 7 — Piloter et protéger : Karim prend de la hauteur. Tableau de bord, SLA,
// fraude COD, avis clients, notifications et consentement, puis la console en arabe (RTL)
// et en thème sombre. Clôture de la démo.
//
// Ne modifie rien côté données : la langue (cookie) et le thème (stockage local) sont
// rétablis en fin de chapitre, et le dialogue d'envoi de notification est annulé.
import { Tournage, jeu, compte } from '../moteur.mjs';

const { tenant } = jeu();
const ADMIN = compte((c) => c.role === 'ADMIN');

/** Nombre lu à l'écran (« 85.7 % », « 4.3/5 ») → texte à dire (« 86 pour cent », « 4,3 »). */
const nombre = (txt) => Number(String(txt).replace(/\s/g, '').replace(',', '.').match(/[\d.]+/)?.[0] ?? NaN);
/** Valeur affichée dans la carte KPI dont le libellé est `libelle`. */
async function kpi(p, libelle) {
  const carte = p.locator('.rt-Card', { has: p.getByText(libelle, { exact: true }) }).first();
  return (await carte.locator('.rt-Heading').first().textContent())?.trim() ?? '';
}

function horlogeVisible(t) {
  if (!process.env.DEMO_HORLOGE) return;
  return t.contexte.addInitScript(`setInterval(() => { let d = document.getElementById('__hz'); if (!d) { d = document.createElement('div'); d.id = '__hz'; d.style.cssText = 'position:fixed;top:0;left:0;z-index:2147483647;font:bold 22px monospace;background:#ff0;color:#000;padding:2px 6px'; document.documentElement.appendChild(d); } d.textContent = ((Date.now() - ${t.t0}) / 1000).toFixed(1); }, 50);`);
}

const t = new Tournage('07-piloter', { chapitre: '7 · Piloter et protéger' });
const p = await t.ouvrir();
await horlogeVisible(t);

await t.carton('Chapitre 7', 'Piloter et protéger', 'Mesurer la qualité, détecter les écarts, respecter le client.');
await t.dire('Dernier chapitre : piloter et protéger. La journée tourne ; Karim prend maintenant de la hauteur.');

// Connexion hors montage : elle a déjà été montrée au chapitre 2.
await t.aller(`/login?org=${tenant}`);
await p.fill('input[name="email"]', ADMIN.email);
await p.fill('input[name="password"]', ADMIN.password);
await p.getByRole('button', { name: 'Se connecter' }).click();
await p.getByRole('heading', { name: 'Tableau de bord' }).waitFor({ timeout: 60_000 });
await p.waitForLoadState('networkidle').catch(() => {});
await p.waitForTimeout(800);

// — Tableau de bord —
await t.dire('Le tableau de bord donne l’état de la journée : commandes en cours, livrées, en échec, et celles qui attendent encore un livreur.', async () => {
  for (const l of ['En cours', 'Livrées', 'Échouées']) {
    await t.survoler(p.getByText(l, { exact: true }).first());
    await p.waitForTimeout(900);
  }
});
await t.dire('À droite, le COD du jour : ce qui a déjà été encaissé par les livreurs, et ce qui reste à encaisser. C’est l’argent des marchands, suivi au dirham près.', async () => {
  await t.survoler(p.getByRole('heading', { name: 'COD du jour' }));
  await p.waitForTimeout(900);
  await t.survoler(p.getByText('Encaissé', { exact: true }));
  await p.waitForTimeout(900);
  await t.survoler(p.getByText('À encaisser', { exact: true }));
});

// — Analytics & SLA —
await t.aller('/analytics');
const reussite = Math.round(nombre(await kpi(p, 'Taux de réussite')));
const phraseReussite = Number.isFinite(reussite)
  ? `Analytics et SLA mesure la qualité de service. Le taux de réussite, livraisons réussies sur courses clôturées, est aujourd’hui de ${reussite} pour cent.`
  : 'Analytics et SLA mesure la qualité de service, à commencer par le taux de réussite : livraisons réussies sur courses clôturées.';
await t.dire(phraseReussite, async () => {
  await t.survoler(p.getByText('Taux de réussite', { exact: true }).first());
  await p.waitForTimeout(1200);
  await t.survoler(p.getByText('Échecs', { exact: true }).first());
});
await t.dire('La répartition par statut montre où en est chaque commande, et les motifs d’échec disent pourquoi une livraison n’a pas abouti.', async () => {
  await t.survoler(p.getByRole('heading', { name: 'Répartition par statut' }));
  await p.waitForTimeout(1500);
  await t.survoler(p.getByRole('heading', { name: 'Motifs d’échec' }));
});
await t.dire('Le respect du SLA se lit par ville, par livreur et par marchand. Sous l’objectif de quatre-vingt-dix pour cent, la ligne passe à l’orange ou au rouge.', async () => {
  const onglets = p.getByRole('tablist');
  await onglets.scrollIntoViewIfNeeded();
  await t.defiler(380, 900);
  await p.waitForTimeout(500);
  await t.cliquer(p.getByRole('tab', { name: 'Par livreur' }));
  await p.waitForTimeout(1600);
  await t.cliquer(p.getByRole('tab', { name: 'Par marchand' }));
  await p.waitForTimeout(1000);
});

// — Fraude COD —
await t.aller('/fraud');
const cas = await p.getByRole('row').filter({ hasNot: p.getByRole('columnheader') }).filter({ hasNotText: 'Aucune alerte' }).count();
await t.dire('Le cash est aussi un risque. La détection de fraude COD croise des signaux objectifs : position au moment de la validation, écart de caisse, absence de preuve.', async () => {
  await t.survoler(p.getByRole('heading', { name: 'Détection de fraude COD' }));
  await p.waitForTimeout(1200);
  await t.survoler(p.getByText('Montant à risque', { exact: true }));
});
if (cas > 0) {
  await t.dire('Chaque cas reçoit un score de risque, détaillé signal par signal.', async () => {
    const ligne = p.getByRole('row').filter({ hasNot: p.getByRole('columnheader') }).first();
    await t.cliquer(ligne);
    await p.waitForTimeout(1200);
    await t.survoler(p.getByText('Score de risque', { exact: true }));
  });
  await t.dire('Mais aucune sanction n’est automatique : l’administrateur ouvre une enquête, blanchit ou confirme, et chaque décision est tracée.', async () => {
    await t.survoler(p.getByRole('button', { name: 'Ouvrir une enquête' }).or(p.getByText('Dossier clôturé', { exact: false })).first());
  });
} else {
  await t.dire('Chaque cas reçoit un score de risque. Mais aucune sanction n’est automatique : un humain examine, blanchit ou confirme, et chaque décision est tracée.', async () => {
    await t.survoler(p.getByText('Aucune sanction n’est automatique'));
    await p.waitForTimeout(1500);
    await t.survoler(p.getByRole('heading', { name: 'Livreurs à risque' }));
  });
  await t.dire('Aujourd’hui, aucune alerte : la caisse d’Atlas Express est propre.');
}

// — Avis clients —
await t.aller('/reviews');
const moyenne = nombre(await kpi(p, 'Note moyenne'));
const phraseAvis = Number.isFinite(moyenne)
  ? `Après chaque livraison, le client peut noter le service depuis son lien de suivi. Atlas Express obtient ${String(moyenne).replace('.', ',')} sur 5.`
  : 'Après chaque livraison, le client peut noter le service depuis son lien de suivi.';
await t.dire(phraseAvis, async () => {
  await t.survoler(p.getByText('Note moyenne', { exact: true }));
  await p.waitForTimeout(1000);
  await t.survoler(p.getByRole('heading', { name: 'Distribution' }));
});
await t.dire('Les livreurs les moins bien notés remontent en premier, et chaque commentaire est relié à sa commande.', async () => {
  await t.survoler(p.getByRole('heading', { name: 'Livreurs à surveiller' }));
  await p.waitForTimeout(1200);
  await t.defiler(320, 900);
  await t.survoler(p.getByRole('row').nth(1).getByRole('cell').nth(1));
});

// — Notifications —
await t.aller('/notifications');
await t.dire('Le centre de notifications trace chaque message envoyé : SMS au client, push au livreur. On sait qui a été prévenu, quand, et avec quel texte.', async () => {
  await t.survoler(p.getByText('Envois tracés', { exact: true }));
  await p.waitForTimeout(1000);
  await t.survoler(p.getByRole('row').nth(1));
  await p.waitForTimeout(800);
  await t.survoler(p.getByRole('row').nth(2));
});
await t.dire('Le consentement de chaque destinataire est enregistré par canal, comme l’exige la loi 09-08 sur les données personnelles.', async () => {
  await t.survoler(p.getByRole('button', { name: 'Consentement' }));
});

await t.aller('/templates');
await t.dire('Les messages partent de modèles, rédigés en français et en arabe, que le transporteur adapte à sa voix.', async () => {
  await t.survoler(p.getByRole('columnheader', { name: 'Français' }));
  await p.waitForTimeout(800);
  await t.survoler(p.getByRole('row', { name: /order\.delivered/ }).getByRole('cell').nth(1));
  await p.waitForTimeout(800);
  await t.survoler(p.getByRole('row', { name: /order\.delivered/ }).getByRole('cell').nth(2));
});
await t.dire('Les messages transactionnels partent toujours. Un message marketing, lui, exige l’accord préalable du client : sans consentement, l’envoi est bloqué.', async () => {
  await t.survoler(p.getByRole('row', { name: /order\.created/ }).getByText('Transactionnel'));
  await p.waitForTimeout(1200);
  await t.survoler(p.getByText('Marketing', { exact: true }).first());
});

// — Arabe, RTL, thème sombre —
await t.aller('/dashboard');
await t.dire('Enfin, la console entière est bilingue. Un clic dans la barre du haut, et Karim passe en arabe.', async () => {
  await t.cliquer(p.getByRole('button', { name: 'Langue' }));
  await t.cliquer(p.getByRole('menuitem', { name: 'العربية' }));
});
await p.waitForLoadState('load');
await p.getByRole('heading', { name: 'لوحة القيادة' }).or(p.locator('html[dir="rtl"] h1')).first().waitFor({ timeout: 30_000 }).catch(() => {});
await p.waitForLoadState('networkidle').catch(() => {});
await p.waitForTimeout(800);
await t.dire('Toute la mise en page bascule de droite à gauche : le menu, les indicateurs, les dates. Une équipe arabophone travaille dans sa langue.', async () => {
  await t.survoler(p.locator('aside, a[href="/orders"]').first());
  await p.waitForTimeout(1000);
  await t.survoler(p.locator('.rt-Card').first());
  await p.waitForTimeout(1000);
  await t.survoler(p.locator('h1').first());
});
await t.dire('Et pour les longues soirées au dispatch, un thème sombre.', async () => {
  await t.cliquer(p.getByRole('button', { name: 'Passer en sombre' }));
  await p.waitForTimeout(1800);
});
await t.dire('On revient en clair et en français.', async () => {
  await t.cliquer(p.getByRole('button', { name: 'Passer en clair' }));
  await p.waitForTimeout(500);
  await t.cliquer(p.getByRole('button', { name: 'اللغة' }));
  await t.cliquer(p.getByRole('menuitem', { name: 'Français' }));
});
await p.waitForLoadState('load');
await p.getByRole('heading', { name: 'Tableau de bord' }).waitFor({ timeout: 30_000 });
await p.waitForTimeout(800);

// — Clôture —
await t.carton('Merci', 'Transpo', 'Une course, quatre mains, un seul dossier.');
await t.dire('Nous avons suivi Atlas Express de sa première visite à sa journée d’exploitation : le marchand dépose, le dispatch affecte, le livreur prouve, la comptabilité rapproche.');
await t.dire('Une course, quatre mains, un seul dossier. Merci d’avoir suivi cette démonstration de Transpo.');

await t.fermer();
