// TC-G15 — Support dispatch.
// ATT : le message du livreur est enregistré, et la réponse de l'exploitation apparaît
//       dans le même fil — un support à sens unique ne serait pas un support.
import assert from 'node:assert/strict';
import { cas, ecran, toucher, saisir, attendre, capture, sleep, api, clavierFerme } from './lib.mjs';
import { seConnecter } from './g01.mjs';
import { passerAutorisations } from './g02.mjs';

const MESSAGE = 'Le client du colis de Sale ne repond pas, que faire ?';
const REPONSE = 'Laissez un avis de passage et poursuivez votre tournee.';

export default cas('TC-G15', 'Support dispatch', async () => {
  await seConnecter('TC-G15');
  await passerAutorisations();

  await toucher('Profil');
  await attendre('Support dispatch', { timeout: 25_000 });
  await toucher('Support dispatch');
  await sleep(2500);
  await capture('TC-G15', '01-fil-de-support');

  await saisir('support-message', MESSAGE);
  await clavierFerme();
  const envoyer = (await ecran()).find((n) => n.classe.includes('Button') && n.centre && n.actif
    && !/Retour/.test(n.description || ''));
  await toucher(envoyer?.description || 'Envoyer');
  await sleep(3000);
  await capture('TC-G15', '02-message-envoye');

  // Le message est dans le fil, et il est arrivé côté exploitation.
  const fil = (await ecran()).map((n) => n.texte).join(' | ');
  assert.match(fil, new RegExp(MESSAGE.slice(0, 25)), 'le message doit apparaître dans le fil du livreur');
  const cote = await api('/v1/field/support/Hamid%20Ouali');
  console.log(`  fil côté exploitation → ${cote.length} message(s)`);
  assert.ok(cote.some((m) => m.body === MESSAGE && m.sender === 'driver'),
    'le message doit être reçu par l’exploitation, attribué au livreur');

  // L'exploitation répond : la réponse doit revenir au livreur, dans le même fil.
  await api('/v1/field/support/Hamid%20Ouali/reply', { method: 'POST', body: { body: REPONSE } });
  console.log('  l’exploitation répond depuis la console');

  // Le fil se rafraîchit en rouvrant l'écran — c'est le geste du livreur qui attend.
  await toucher('Retour');
  await sleep(1500);
  await attendre('Support dispatch', { timeout: 20_000 });
  await toucher('Support dispatch');
  await sleep(3000);
  const apres = (await ecran()).map((n) => n.texte).join(' | ');
  console.log(`  réponse visible côté livreur : ${new RegExp(REPONSE.slice(0, 20)).test(apres)}`);
  await capture('TC-G15', '03-reponse-du-dispatch');
  assert.match(apres, new RegExp(REPONSE.slice(0, 20)), 'la réponse de l’exploitation doit apparaître dans le fil');
});
