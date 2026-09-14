// TC-G04 — Détail de mission.
// ATT : adresses, contact, chips COD et niveau de preuve ; « Naviguer » ouvre l'écran
//       Progression avec les étapes du cycle.
import assert from 'node:assert/strict';
import { cas, ecran, chercher, toucher, attendre, capture, sleep, missionsPour, viderMissions } from './lib.mjs';
import { seConnecter } from './g01.mjs';
import { passerAutorisations } from './g02.mjs';
import { allerAuxMissions } from './g03.mjs';

export default cas('TC-G04', 'Détail de mission', async () => {
  await viderMissions('Hamid Ouali');
  const [ref] = await missionsPour('Hamid Ouali', [{
    cod: 450, toCity: 'Casablanca', proofLevel: 'photo_signature',
    dropContact: 'Yasmine Cherkaoui', dropAddress: '45 bd Anfa, 3e étage',
  }]);

  await seConnecter('TC-G04');
  await passerAutorisations();
  await allerAuxMissions(ref);
  await toucher(ref);
  await attendre('Retrait', { timeout: 20_000, message: 'la fiche de mission ne s’ouvre pas' });
  await sleep(1200);
  await capture('TC-G04', '01-detail-de-mission');

  const noeuds = await ecran();
  const textes = noeuds.map((n) => `${n.texte} ${n.description}`).join(' | ');

  // Les deux points de la course, avec le contact et l'adresse réellement saisis.
  assert.ok(chercher(noeuds, 'Retrait'), 'le point de retrait doit être affiché');
  assert.ok(chercher(noeuds, 'Livraison'), 'le point de livraison doit être affiché');
  assert.match(textes, /Yasmine Cherkaoui/, 'le contact du destinataire doit apparaître');
  assert.match(textes, /45 bd Anfa/, 'l’adresse de livraison doit apparaître');
  console.log('  coordonnées du destinataire restituées sur la fiche');

  // Chips : montant à encaisser et niveau de preuve exigé.
  assert.match(textes, /COD à encaisser/, 'le COD à encaisser doit être signalé');
  assert.match(textes, /450/, 'le montant du COD doit être affiché');
  assert.match(textes, /photo_signature|Preuve/, 'le niveau de preuve exigé doit être signalé');
  console.log('  chips COD et niveau de preuve présents');
  await capture('TC-G04', '02-chips-cod-et-preuve');

  // « Naviguer » mène à la Progression, avec les étapes du cycle.
  await toucher('Naviguer');
  await attendre('Progression', { timeout: 20_000, message: '« Naviguer » ne mène pas à la Progression' });
  await sleep(1000);
  const etapes = await ecran();
  const libelles = etapes.map((n) => n.texte);
  // L'écran liste les ÉTATS du cycle (en cours, à venir) et propose l'action du moment.
  for (const attendu of ['En route (retrait)', 'Récupérée', 'En route (livraison)', 'Livrée']) {
    assert.ok(libelles.some((l) => l.includes(attendu)), `l’état « ${attendu} » doit figurer au cycle`);
  }
  assert.ok(libelles.some((l) => l.includes('Démarrer vers le retrait')),
    'l’action du moment doit être proposée');
  assert.ok(libelles.some((l) => l.includes('Étape en cours')) && libelles.some((l) => l.includes('À venir')),
    'le cycle doit distinguer l’étape en cours des étapes à venir');
  console.log(`  écran Progression → ${libelles.filter((l) => l).length} repères, action « Démarrer vers le retrait »`);
  await capture('TC-G04', '03-ecran-progression');
});
