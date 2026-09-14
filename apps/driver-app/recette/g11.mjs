// TC-G11 — Mode hors ligne.
// ATT : coupé du réseau, l'app reste consultable (dernier chargement), les actions sont
//       mises en file localement, annoncées, et rejouées AU RETOUR du réseau — sans
//       doublon côté exploitation (idempotence).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cas, ecran, chercher, toucher, attendre, capture, sleep, api, reseau,
  missionsPour, viderMissions, visible, glisser } from './lib.mjs';
import { seConnecter } from './g01.mjs';
import { passerAutorisations } from './g02.mjs';
import { allerAuxMissions } from './g03.mjs';

/** Compte les passages à un statut donné dans l'historique de la commande. */
async function transitions(ref, statut) {
  const events = await api(`/v1/orders/${encodeURIComponent(ref)}/events`);
  return events.filter((e) => e.to === statut || e.status === statut).length;
}

export default cas('TC-G11', 'Mode hors ligne', async () => {
  await viderMissions('Hamid Ouali');
  const [ref] = await missionsPour('Hamid Ouali', [{ cod: 250, toCity: 'Salé' }]);

  await seConnecter('TC-G11');
  await passerAutorisations();
  await allerAuxMissions(ref);
  await capture('TC-G11', '01-en-ligne');

  try {
    // --- Coupure ---------------------------------------------------------------
    reseau(false);
    await sleep(6000);
    await capture('TC-G11', '02-reseau-coupe');

    // La liste reste consultable : c'est la promesse du mode hors ligne.
    assert.ok(await visible(ref), 'la mission du dernier chargement doit rester consultable');
    const bandeau = (await ecran()).map((n) => n.texte).join(' | ');
    assert.match(bandeau, /Hors ligne/, 'le bandeau « Hors ligne » doit s’afficher');
    console.log('  réseau coupé → liste conservée, bandeau « Hors ligne »');

    // --- Une action hors ligne -------------------------------------------------
    await toucher(ref);
    await attendre('Naviguer', { timeout: 20_000 });
    await toucher('Naviguer');
    await attendre('Progression', { timeout: 20_000 });
    await toucher('Démarrer vers le retrait');
    await sleep(800);
    await toucher('Confirmer');
    await sleep(3000);
    await capture('TC-G11', '03-action-hors-ligne');

    // Là où le livreur se tient — l'écran de progression — l'app annonce que l'action est
    // gardée sur l'appareil. Un écran muet ferait recommencer le geste.
    const surPlace = (await ecran()).map((n) => n.texte).join(' | ');
    assert.match(surPlace, /Enregistré sur l’appareil/,
      'la progression doit annoncer l’action gardée sur l’appareil');
    console.log('  progression → « Enregistré sur l’appareil. Sera transmis au retour du réseau. »');

    // Rien n'est parti au serveur : le statut d'exploitation n'a pas bougé.
    const pendantCoupure = await api(`/v1/orders/${encodeURIComponent(ref)}`);
    assert.equal(pendantCoupure.status, 'ASSIGNEE', 'aucune action ne doit atteindre le serveur hors ligne');
    console.log(`  côté exploitation → ${pendantCoupure.status} (inchangé)`);

    // Retour à la liste : le compteur d'actions en attente y est annoncé.
    await toucher('Retour');
    await sleep(1500);
    if (!(await visible('Mes missions'))) { await toucher('Retour'); await sleep(1500); }
    await attendre('Mes missions', { timeout: 20_000 });
    await attendre('action(s) en attente', { timeout: 20_000, message: 'la file d’attente n’est pas annoncée sur la liste' });
    const enFile = (await ecran()).map((n) => n.texte).find((t) => /action\(s\) en attente/.test(t));
    console.log(`  liste → « ${enFile} »`);
    await capture('TC-G11', '04-file-annoncee');

    // --- L'écran de synchronisation -------------------------------------------
    // Le compteur d'actions en attente mène à la file. Il ne le faisait pas : l'écran
    // n'était joignable que par le bandeau « Hors ligne », donc plus du tout dès le
    // retour du réseau — au moment précis où une action bloquée doit pouvoir être vue.
    await toucher('action(s) en attente');
    await attendre('Synchronisation', { timeout: 20_000, message: 'l’écran de synchronisation ne s’ouvre pas' });
    await sleep(1500);
    await capture('TC-G11', '05-file-de-synchronisation');
    const file = (await ecran()).map((n) => n.texte).join(' | ');
    assert.match(file, /Statut|Livraison \+ preuve|Échec de livraison/,
      'la nature de l’action en attente doit être lisible');
    assert.match(file, new RegExp(ref), 'la file doit nommer la commande concernée');
    assert.match(file, /En file/, 'chaque action doit porter son état');

    // Forcer la synchronisation hors réseau ne doit ni vider la file ni mentir.
    await toucher('Forcer la synchronisation');
    await sleep(4000);
    await capture('TC-G11', '06-forcage-hors-ligne');
    assert.ok(await visible('action(s) en attente'), 'un forçage sans réseau doit laisser l’action en file');
    const toujours = await api(`/v1/orders/${encodeURIComponent(ref)}`);
    assert.equal(toujours.status, 'ASSIGNEE', 'le forçage sans réseau ne doit rien envoyer');
    console.log('  forçage sans réseau → file intacte, serveur intact');
  } finally {
    reseau(true);
  }

  // --- Retour du réseau --------------------------------------------------------
  await sleep(12_000);
  const fin = Date.now() + 90_000;
  let statut = null;
  do {
    statut = (await api(`/v1/orders/${encodeURIComponent(ref)}`)).status;
    if (statut === 'RETRAIT') break;
    await sleep(4000);
  } while (Date.now() < fin);
  console.log(`  réseau rétabli → côté exploitation : ${statut}`);
  assert.equal(statut, 'RETRAIT', 'l’action en file doit être rejouée au retour du réseau');
  await capture('TC-G11', '07-rejoue-au-retour-du-reseau');

  // Sans doublon : une seule transition vers RETRAIT dans l'historique.
  const fois = await transitions(ref, 'RETRAIT');
  console.log(`  historique → ${fois} transition(s) vers RETRAIT`);
  assert.equal(fois, 1, 'le rejeu ne doit pas dupliquer la transition (idempotence)');

  // Et la file se vide d'elle-même, sans geste du livreur : l'écran de synchronisation,
  // resté ouvert pendant la coupure, doit l'annoncer sans qu'on y retouche.
  await attendre('Aucune action en attente', { timeout: 45_000, message: 'la file ne se vide pas après le rejeu' });
  console.log('  file vidée automatiquement — « Aucune action en attente. »');

  await toucher('Retour');
  await attendre('Mes missions', { timeout: 25_000 });
  await sleep(2000);
  assert.equal(await visible('action(s) en attente'), false, 'plus aucun compteur d’attente sur la liste');
  await capture('TC-G11', '08-file-videe');
});
