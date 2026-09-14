// TC-I05 — Vue livreur de la tournée.
// ATT : l'onglet « Ma tournée » affiche les arrêts de la tournée du jour DANS L'ORDRE
//       défini par l'exploitation — celui qu'elle a optimisé et réordonné en section I.
import assert from 'node:assert/strict';
import { cas, ecran, toucher, attendre, capture, sleep, api, apiLivreur,
  missionsPour, viderMissions } from './lib.mjs';
import { seConnecter } from './g01.mjs';
import { passerAutorisations } from './g02.mjs';

const CHAUFFEUR = 'Hamid Ouali';

export default cas('TC-I05', 'Vue livreur de la tournée', async () => {
  // Décor : trois courses, montées en tournée par l'exploitation dans un ordre précis,
  // puis RÉORDONNÉES — c'est le second ordre qui doit apparaître au livreur.
  await viderMissions(CHAUFFEUR);
  const refs = await missionsPour(CHAUFFEUR, [
    { cod: 100, toCity: 'Casablanca' },
    { cod: 200, toCity: 'Salé' },
    { cod: 300, toCity: 'Kénitra' },
  ]);
  const jour = new Date().toISOString().slice(0, 10);
  const tournee = await api('/v1/tournees', {
    method: 'POST', body: { driver: CHAUFFEUR, day: jour, stops: refs },
  });
  const ordreVoulu = [refs[2], refs[0], refs[1]];
  await api(`/v1/tournees/${tournee.id}/reorder`, { method: 'POST', body: { stops: ordreVoulu } });
  console.log(`  tournée ${tournee.id} → ordre imposé ${ordreVoulu.join(' → ')}`);

  // Ce que le serveur rend au livreur doit déjà être dans cet ordre.
  const vue = await apiLivreur('/v1/driver/tour');
  assert.ok(vue, 'le livreur doit recevoir la tournée du jour');
  assert.deepEqual(vue.stops.map((o) => o.ref), ordreVoulu,
    'l’API livreur doit rendre les arrêts dans l’ordre de l’exploitation');
  console.log('  API livreur → arrêts dans l’ordre du dispatch');

  await seConnecter('TC-I05');
  await passerAutorisations();
  await toucher('Tournée');
  await attendre('Ma tournée', { timeout: 30_000, message: 'l’onglet Ma tournée ne s’ouvre pas' });
  await sleep(3000);
  await capture('TC-I05', '01-ma-tournee');

  const noeuds = await ecran();
  const textes = noeuds.map((n) => n.texte).join(' | ');

  // L'écran annonce que l'ordre vient du dispatch : sans ce repère, le livreur croit
  // pouvoir le réorganiser à sa guise.
  assert.match(textes, /Ordre défini par le dispatch/,
    'l’écran doit annoncer que l’ordre vient de l’exploitation');

  // Et les arrêts se suivent dans cet ordre à l'écran.
  const positions = ordreVoulu.map((ref) => textes.indexOf(ref));
  console.log(`  positions à l’écran → ${positions.join(', ')}`);
  for (const [i, p] of positions.entries()) {
    assert.ok(p >= 0, `l’arrêt ${ordreVoulu[i]} doit être affiché`);
    if (i > 0) assert.ok(p > positions[i - 1], 'les arrêts doivent suivre l’ordre du dispatch');
  }
  await capture('TC-I05', '02-ordre-du-dispatch');
});
