// TC-G05 — Avancement avec confirmation.
// ATT : chaque étape demande confirmation ; le statut remonte DANS LA CONSOLE après
//       rafraîchissement.
import assert from 'node:assert/strict';
import { cas, ecran, chercher, toucher, attendre, capture, sleep, api, missionsPour, viderMissions, visible } from './lib.mjs';
import { seConnecter } from './g01.mjs';
import { passerAutorisations } from './g02.mjs';
import { allerAuxMissions } from './g03.mjs';

/** Statut de la commande vu par l'exploitation (ce que la console afficherait). */
async function statutCoteConsole(ref) {
  const o = await api(`/v1/orders/${encodeURIComponent(ref)}`);
  return o.status;
}

/** Joue une étape : action, confirmation, puis lecture du statut côté exploitation. */
export async function avancer(tc, action, statutAttendu, index) {
  await toucher(action);
  await sleep(800);
  // Chaque étape passe par une boîte de confirmation : c'est le point du cas.
  const dialogue = await ecran();
  const confirmer = dialogue.find((n) => n.centre && n.texte.trim().toLowerCase() === 'confirmer');
  assert.ok(confirmer, `l’étape « ${action} » doit demander confirmation`);
  await capture(tc, `0${index}-confirmation-${action.toLowerCase().replace(/[^a-z]+/g, '-').slice(0, 28)}`);
  await toucher('Confirmer');
  await sleep(2500);
  return statutAttendu;
}

export default cas('TC-G05', 'Avancement avec confirmation', async () => {
  await viderMissions('Hamid Ouali');
  const [ref] = await missionsPour('Hamid Ouali', [{ cod: 450, toCity: 'Casablanca', proofLevel: 'photo' }]);

  await seConnecter('TC-G05');
  await passerAutorisations();
  await allerAuxMissions(ref);
  await toucher(ref);
  await attendre('Naviguer', { timeout: 20_000 });
  await toucher('Naviguer');
  await attendre('Progression', { timeout: 20_000 });
  await capture('TC-G05', '01-progression-depart');
  assert.equal(await statutCoteConsole(ref), 'ASSIGNEE', 'la mission part du statut Assignée');

  const etapes = [
    ['Démarrer vers le retrait', 'RETRAIT'],
    ['Colis récupéré', 'RECUPEREE'],
    ['Démarrer la livraison', 'LIVRAISON'],
  ];
  let i = 2;
  for (const [action, attendu] of etapes) {
    await avancer('TC-G05', action, attendu, i++);
    const vu = await statutCoteConsole(ref);
    console.log(`  ${action} → console : ${vu}`);
    assert.equal(vu, attendu, `la console doit voir ${attendu} après « ${action} »`);
  }
  await capture('TC-G05', '05-en-route-livraison');

  // Arrivé en livraison, l'app propose la PREUVE et non un pas de plus : la clôture ne
  // se fait pas par simple avancement (cf. TC-F06 côté console).
  assert.ok(await visible('Confirmer la livraison') || await visible('Preuve'),
    'la dernière étape doit mener à la preuve, pas à un avancement de plus');
  console.log('  dernière étape → la clôture passe par la preuve');
});
