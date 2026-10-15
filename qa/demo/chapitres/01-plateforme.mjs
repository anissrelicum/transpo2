// Chapitre 1 — La plateforme : l'équipe Transpo reçoit la demande d'Atlas Express et ouvre
// son organisation. Le mot de passe temporaire de l'administrateur, affiché une seule fois,
// est consigné dans sortie/admin.json : amorcer-demo.mjs s'en sert ensuite.
//
// ⚠ Provisionne pour de vrai (aucun déprovisionnement) : SLUG neuf à chaque tournage.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Tournage, SORTIE, saisirConnexion } from '../moteur.mjs';

const SLUG = process.env.SLUG || 'atlasexpress';
const ADMIN = { nom: 'Karim Berrada', email: `karim.berrada@${SLUG}.ma` };

const t = new Tournage('01-plateforme', { chapitre: '1 · La plateforme' });
const p = await t.ouvrir();

await t.carton('Chapitre 1', 'La plateforme', 'Recevoir une demande, ouvrir un transporteur, suivre son abonnement.');
await t.dire('Premier chapitre : la plateforme. Nous sommes maintenant dans la console SaaS, réservée à l’équipe qui exploite Transpo.');

await t.aller('/login?realm=saas');
await t.dire('Elle a son propre espace de connexion, séparé de celui des transporteurs : un compte plateforme n’appartient à aucune organisation.', async () => {
  await saisirConnexion(t, 'ops@transpo.ma', 'transpo');
  await p.getByRole('heading', { name: 'Organisations' }).waitFor({ timeout: 60_000 });
});

await t.dire('Toutes les sociétés clientes sont ici, avec leur plan, leur abonnement et le revenu mensuel. La plateforme signale d’elle-même les abonnements impayés et les organisations suspendues.', async () => {
  await t.survoler(p.getByText('Revenu mensuel').first());
  await p.waitForTimeout(1800);
  await t.survoler(p.getByText(/abonnement\(s\) impayé/).first());
});

await t.aller('/saas/demandes');
await t.dire('Dans l’onglet Demandes, on retrouve la demande envoyée depuis le site par Atlas Express : le contact, les villes, la taille de la flotte, et ce qu’ils veulent régler.', async () => {
  await t.survoler(p.getByText('Atlas Express').first());
  await p.waitForTimeout(1500);
  await t.survoler(p.getByText('Suivre le cash encaissé').first());
});
await t.dire('Le commercial note son suivi, puis marque la demande comme contactée.', async () => {
  const carte = p.locator('div', { has: p.getByText('karim.berrada@atlasexpress.ma') }).filter({ has: p.locator('textarea') }).last();
  await t.taper(carte.locator('textarea'), 'Démo faite avec Karim. Essai de 14 jours ouvert sur le plan Transporteur.', 22);
  await t.cliquer(carte.getByRole('button', { name: 'Marquer contactée' }));
  await p.waitForTimeout(1500);
});

await t.aller('/saas');
await t.dire('Ouvrons maintenant l’organisation d’Atlas Express. Le provisionnement crée en une seule opération un espace de données dédié, et le premier compte administrateur.', async () => {
  await t.cliquer(p.getByRole('button', { name: 'Provisionner' }));
  await p.getByRole('dialog').waitFor();
});
const dialogue = p.getByRole('dialog');
await t.dire('On choisit l’identifiant, qui deviendra son adresse d’accès, le nom commercial, la ville et le plan visé.', async () => {
  await t.taper(dialogue.getByPlaceholder('rabatexpress', { exact: true }), SLUG, 60);
  await t.taper(dialogue.getByPlaceholder('Rabat Express'), 'Atlas Express', 45);
  await t.taper(dialogue.locator('input').nth(2), 'Casablanca', 45);
  await t.cliquer(dialogue.getByRole('combobox'));
  await t.cliquer(p.getByRole('option', { name: 'Transporteur' }));
});
await t.dire('Puis le premier administrateur : Karim Berrada.', async () => {
  await t.taper(dialogue.getByPlaceholder('Youssef Tazi'), ADMIN.nom, 45);
  await t.taper(dialogue.getByPlaceholder('admin@rabatexpress.ma'), ADMIN.email, 30);
});

let motDePasse;
await t.dire('Un clic, et l’organisation existe. Le mot de passe temporaire de l’administrateur n’est affiché qu’une seule fois : il faut le lui transmettre maintenant.', async () => {
  await t.cliquer(dialogue.getByRole('button', { name: 'Provisionner' }));
  const revele = p.getByRole('dialog');
  await revele.getByText('Compte administrateur créé').waitFor({ timeout: 30_000 });
  motDePasse = ((await revele.locator('[style*="code-font"]').first().textContent()) ?? '').trim();
  fs.mkdirSync(SORTIE, { recursive: true });
  fs.writeFileSync(path.join(SORTIE, 'admin.json'), JSON.stringify({ tenant: SLUG, email: ADMIN.email, password: motDePasse }, null, 2));
  await p.waitForTimeout(1200);
  await t.survoler(revele.locator('[style*="code-font"]').first());
});
console.log(`  admin ${ADMIN.email} — mot de passe consigné dans sortie/admin.json`);

await t.dire('Atlas Express apparaît dans la liste, en période d’essai de quatorze jours. À son terme, sans souscription, l’organisation passe en impayé puis est suspendue automatiquement.', async () => {
  await t.cliquer(p.getByRole('dialog').getByRole('button', { name: 'Fermer' }));
  await t.taper(p.getByPlaceholder(/Rechercher \(slug/), SLUG, 60);
  await p.waitForTimeout(800);
  await t.survoler(p.getByRole('row', { name: new RegExp(SLUG) }).getByText('Essai'));
});

await t.aller('/saas/billing');
await t.dire('L’onglet Facturation suit, pour chaque organisation, la consommation réelle face au quota de son plan, et le montant mensuel facturé.', async () => {
  await t.survoler(p.getByText('Consommation').first());
  await p.waitForTimeout(1200);
  await t.survoler(p.getByText('Montant mensuel').first());
});

await t.aller('/saas/audit');
await t.dire('Enfin, chaque action sensible est tracée dans le journal d’audit : qui a fait quoi, sur quelle organisation, et quand. Le provisionnement d’Atlas Express y figure déjà.', async () => {
  await t.taper(p.getByPlaceholder(/Rechercher \(acteur/), SLUG, 60);
  await p.waitForTimeout(800);
  await t.survoler(p.getByText('tenant.provision').first());
});
await t.dire('Atlas Express a maintenant son espace. Au chapitre suivant, Karim s’y connecte pour installer son exploitation.');

await t.fermer();
