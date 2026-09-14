// TC-G09 — Preuve « aucune ».
// ATT : la clôture est possible sans photo ni signature — et l'app le dit, plutôt que de
//       laisser le livreur chercher quoi faire.
import assert from 'node:assert/strict';
import { cas, ecran, toucher, attendre, capture, sleep, api, missionsPour, viderMissions } from './lib.mjs';
import { seConnecter } from './g01.mjs';
import { passerAutorisations } from './g02.mjs';
import { jusquAuSeuilDeLivraison } from './g06.mjs';

export default cas('TC-G09', 'Preuve « aucune »', async () => {
  await viderMissions('Hamid Ouali');
  const [ref] = await missionsPour('Hamid Ouali', [{ cod: 0, proofLevel: 'aucune' }]);

  await seConnecter('TC-G09');
  await passerAutorisations();
  await jusquAuSeuilDeLivraison('TC-G09', ref);

  await toucher('Confirmer la livraison');
  await attendre('Preuve de livraison', { timeout: 25_000, message: 'l’écran de preuve ne s’ouvre pas' });
  await sleep(1200);
  await capture('TC-G09', '01-preuve-non-exigee');

  // Rien n'est exigé : l'écran l'annonce et la validation est ouverte d'emblée.
  const noeuds = await ecran();
  const textes = noeuds.map((n) => `${n.texte} ${n.description}`).join(' | ');
  assert.match(textes, /Aucune preuve n’est requise/, 'l’app doit dire qu’aucune preuve n’est exigée');
  const valider = noeuds.find((n) => n.classe.includes('Button') && n.centre
    && /Valider la preuve/.test(n.description || n.texte));
  assert.ok(valider, 'la validation doit être proposée');
  assert.equal(valider.actif, true, 'la validation doit être ouverte sans photo ni signature');
  console.log(`  aucune preuve exigée → « ${valider.description} » (ouverte d’emblée)`);

  await toucher(valider.description || valider.texte);
  await attendre('Livraison réussie', { timeout: 30_000, message: 'la clôture sans preuve n’aboutit pas' });
  await capture('TC-G09', '02-livraison-reussie');

  const commande = await api(`/v1/orders/${encodeURIComponent(ref)}`);
  console.log(`  console → ${commande.status}`);
  assert.equal(commande.status, 'LIVREE', 'la commande doit passer Livrée sans preuve');
});
