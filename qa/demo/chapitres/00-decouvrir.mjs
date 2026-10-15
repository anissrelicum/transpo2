// Chapitre 0 — Découvrir Transpo : le site vitrine, jusqu'à la demande de démonstration
// qu'Atlas Express envoie (on la retrouve dans la console SaaS au chapitre 1).
import { Tournage, VITRINE } from '../moteur.mjs';

const t = new Tournage('00-decouvrir', { chapitre: '0 · Découvrir Transpo' });
const p = await t.ouvrir();

await t.carton('Démo produit', 'Transpo', 'Le logiciel d’exploitation des sociétés de transport et de livraison au Maroc.');
await t.dire('Bienvenue dans cette démonstration de Transpo, le logiciel d’exploitation des sociétés de transport et de livraison au Maroc.');
await t.dire('Pour la suivre, nous allons accompagner une société fictive, Atlas Express, basée à Casablanca, depuis sa première visite jusqu’au reversement de l’argent à ses marchands.');

await t.aller(VITRINE);
await t.dire('Tout commence ici, sur le site de Transpo. La promesse est simple : tenir l’exploitation d’un bout à l’autre. Le dispatch affecte, le livreur exécute même sans réseau, la livraison laisse une preuve, et chaque dirham encaissé est suivi jusqu’au reversement.');
await t.dire('L’application fonctionne hors réseau, en français comme en arabe, et les données de chaque société sont strictement cloisonnées.', async () => {
  await t.defiler(420, 1500);
});

await t.dire('Le principe tient en une phrase : une course, quatre mains, un seul dossier.', async () => {
  await p.locator('#etapes').scrollIntoViewIfNeeded();
  await t.survoler('#etapes-titre');
});
await t.dire('Le marchand dépose sa commande. Le dispatch l’affecte au bon livreur. Le livreur l’exécute et prouve la livraison. Et la comptabilité rapproche l’argent encaissé. Ce sont exactement les étapes que nous allons suivre dans cette démo.', async () => {
  for (const h of ['Le marchand dépose', 'Le dispatch affecte', 'Le livreur exécute', 'La compta rapproche']) {
    await t.survoler(p.getByRole('heading', { name: h }));
    await p.waitForTimeout(1600);
  }
});

await t.dire('Côté bureau, la console d’exploitation réunit toute la journée sur un seul écran : affectation assistée, tournées, flotte et rôles séparés.', async () => {
  await p.locator('#console').scrollIntoViewIfNeeded();
  await p.waitForTimeout(400);
  await t.defiler(300, 1500);
});
await t.dire('Côté terrain, l’application livreur est pensée pour une main, en plein soleil, avec un réseau qui tombe.', async () => {
  await p.locator('#terrain').scrollIntoViewIfNeeded();
  await p.waitForTimeout(400);
  await t.defiler(250, 1200);
});

await t.dire('Le site permet aussi d’estimer le prix d’une course. Prenons douze kilomètres, avec un colis fragile.', async () => {
  await p.locator('#tarifs').scrollIntoViewIfNeeded();
  await p.waitForTimeout(300);
  await t.taper('#c-distance', '12', 120);
  await t.cliquer('#c-fragile');
  await t.survoler('#c-total');
});
await t.dire('La grille par défaut s’applique, avec la majoration fragile. Chaque société pourra ensuite la modifier, et négocier des conditions marchand par marchand.');

await t.dire('Atlas Express est convaincue. Elle demande une démonstration en remplissant ce formulaire.', async () => {
  await p.locator('#contact').scrollIntoViewIfNeeded();
  await p.waitForTimeout(300);
  await t.taper('#f-societe', 'Atlas Express', 45);
  await t.taper('#f-nom', 'Karim Berrada', 45);
  await t.taper('#f-email', 'karim.berrada@atlasexpress.ma', 30);
});
await t.dire('Elle précise ses villes, la taille de sa flotte, et ce qu’elle cherche à régler.', async () => {
  // Le téléphone n'existe que dans la version récente du site : facultatif ici.
  if (await p.locator('#f-telephone').count()) await t.taper('#f-telephone', '+212 661 23 45 67', 30);
  await t.taper('#f-villes', 'Casablanca, Rabat, Marrakech', 30);
  await t.taper('#f-livreurs', '25', 80);
  const besoin = p.locator('#f-message');
  await t.taper(besoin, 'Suivre le cash encaissé par nos livreurs et reverser nos marchands sans tableur.', 22);
});
await t.dire('Un clic, et la demande part directement à l’équipe Transpo.', async () => {
  await t.cliquer(p.getByRole('button', { name: 'Envoyer ma demande' }));
  await p.waitForTimeout(2500);
});
await t.dire('Dans le prochain chapitre, nous passons de l’autre côté : la console de la plateforme, où cette demande arrive et où Atlas Express va être ouverte.');

await t.fermer();
