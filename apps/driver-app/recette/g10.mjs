// TC-G10 — Échec de livraison.
// ATT : motif obligatoire et normalisé, confirmation ; la commande passe Échouée côté
//       console et ouvre un retour à traiter, avec le motif et 1 tentative.
import assert from 'node:assert/strict';
import { cas, ecran, chercher, toucher, saisir, attendre, capture, sleep, api,
  missionsPour, viderMissions, clavierFerme, visible } from './lib.mjs';
import { seConnecter } from './g01.mjs';
import { passerAutorisations } from './g02.mjs';
import { jusquAuSeuilDeLivraison } from './g06.mjs';

const NOTES = 'Deux appels sans suite, 13h05 et 13h20';
const MOTIF = 'Destinataire absent';

export default cas('TC-G10', 'Échec de livraison', async () => {
  await viderMissions('Hamid Ouali');
  const [ref] = await missionsPour('Hamid Ouali', [{ cod: 300, proofLevel: 'photo' }]);

  await seConnecter('TC-G10');
  await passerAutorisations();
  await jusquAuSeuilDeLivraison('TC-G10', ref);

  // L'échec se déclare depuis la progression, à côté de la livraison — pas à sa place.
  await toucher('Signaler un échec');
  await attendre('Échec de livraison', { timeout: 20_000, message: 'l’écran d’échec ne s’ouvre pas' });
  await sleep(1200);
  await capture('TC-G10', '01-motifs-proposes');

  // Les motifs sont normalisés : le livreur choisit dans une liste, il n'invente pas.
  const noeuds = await ecran();
  const proposes = ['Destinataire absent', 'Adresse introuvable', 'Refus du colis',
    'Téléphone injoignable', 'Colis endommagé', 'Autre motif'];
  for (const motif of proposes) {
    assert.ok(chercher(noeuds, motif), `le motif « ${motif} » doit être proposé`);
  }
  console.log(`  ${proposes.length} motifs normalisés proposés`);

  await toucher(MOTIF);
  await saisir('echec-notes', NOTES);
  await clavierFerme();
  await capture('TC-G10', '02-motif-et-notes');

  // La bascule en retour est irréversible côté livreur : elle demande confirmation.
  await toucher('Passer en retour');
  await sleep(1200);
  const dialogue = await ecran();
  const textes = dialogue.map((n) => n.texte).join(' | ');
  assert.match(textes, /Confirmer l’échec/, 'l’échec doit demander confirmation');
  assert.match(textes, new RegExp(MOTIF), 'la confirmation doit rappeler le motif choisi');
  await capture('TC-G10', '03-confirmation');
  await toucher('Confirmer le retour');
  await sleep(3000);

  // Retour aux missions : la commande échouée sort de la liste active.
  await attendre('Mes missions', { timeout: 25_000, message: 'l’app ne revient pas aux missions' });
  await sleep(2500);
  assert.equal(await visible(ref), false, 'la mission échouée ne doit plus figurer parmi les missions actives');
  await capture('TC-G10', '04-mission-sortie-de-la-liste');

  // Côté exploitation : statut Échouée, motif et notes conservés, retour ouvert à 1/3.
  const commande = await api(`/v1/orders/${encodeURIComponent(ref)}`);
  console.log(`  console → ${commande.status}`);
  assert.equal(commande.status, 'ECHOUEE', 'la commande doit passer Échouée');

  const retours = await api('/v1/returns');
  const retour = retours.find((r) => r.ref === ref);
  console.log(`  /returns → ${retour?.status}, tentative ${retour?.attempts}, motif « ${retour?.reason} »`);
  assert.ok(retour, 'la commande échouée doit ouvrir un retour');
  assert.equal(retour.status, 'A_TRAITER', 'le retour doit naître « À traiter »');
  assert.equal(retour.attempts, 1, 'le retour doit compter 1 tentative');
  assert.match(retour.reason ?? '', new RegExp(MOTIF), 'le motif choisi doit être conservé');
  assert.match(retour.reason ?? '', new RegExp(NOTES), 'les notes complémentaires doivent être conservées');
});
