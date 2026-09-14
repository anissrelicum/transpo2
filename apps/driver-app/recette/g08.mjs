// TC-G08 — Commande prépayée.
// ATT : l'étape d'encaissement est absente, et la fiche annonce « Prépayé » plutôt qu'un
//       montant à réclamer au client.
import assert from 'node:assert/strict';
import { cas, ecran, toucher, attendre, capture, sleep, api, missionsPour, viderMissions, visible } from './lib.mjs';
import { seConnecter } from './g01.mjs';
import { passerAutorisations } from './g02.mjs';
import { allerAuxMissions } from './g03.mjs';
import { jusquAuSeuilDeLivraison, prendreLaPhoto } from './g06.mjs';

export default cas('TC-G08', 'Commande prépayée', async () => {
  await viderMissions('Hamid Ouali');
  const [ref] = await missionsPour('Hamid Ouali', [{ cod: 0, proofLevel: 'photo' }]);

  await seConnecter('TC-G08');
  await passerAutorisations();

  // Avant même de partir : la mission doit s'annoncer prépayée, pas « 0 DH à encaisser ».
  await allerAuxMissions(ref);
  await toucher(ref);
  await attendre('Retrait', { timeout: 20_000 });
  await sleep(1000);
  const fiche = (await ecran()).map((n) => `${n.texte} ${n.description}`).join(' | ');
  assert.match(fiche, /Prépayé/, 'la fiche doit annoncer une commande prépayée');
  assert.doesNotMatch(fiche, /COD à encaisser/, 'aucun encaissement ne doit être réclamé');
  console.log('  fiche → « Prépayé », aucun COD réclamé');
  await capture('TC-G08', '01-fiche-prepayee');

  // Le parcours de livraison, jusqu'à la preuve.
  await toucher('Naviguer');
  await attendre('Progression', { timeout: 20_000 });
  for (const action of ['Démarrer vers le retrait', 'Colis récupéré', 'Démarrer la livraison']) {
    await toucher(action);
    await sleep(700);
    await toucher('Confirmer');
    await sleep(2500);
  }
  await toucher('Confirmer la livraison');
  await attendre('Photo du colis livré', { timeout: 25_000 });
  await prendreLaPhoto();
  await capture('TC-G08', '02-preuve-photo');

  // Le point du cas : la validation de la preuve clôt DIRECTEMENT la livraison.
  await toucher('Valider la preuve');
  await attendre('Livraison réussie', { timeout: 30_000, message: 'la clôture ne va pas au bout sans encaissement' });
  assert.equal(await visible('Montant à encaisser'), false, 'aucun écran d’encaissement ne doit s’intercaler');
  console.log('  preuve validée → clôture directe, sans étape d’encaissement');
  await capture('TC-G08', '03-livraison-reussie');

  const commande = await api(`/v1/orders/${encodeURIComponent(ref)}`);
  console.log(`  console → ${commande.status}, COD ${commande.cod} DH`);
  assert.equal(commande.status, 'LIVREE', 'la commande doit passer Livrée');
  assert.equal(commande.cod, 0, 'la commande reste à 0 DH de COD');
});
