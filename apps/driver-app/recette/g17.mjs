// TC-G17 — Notifications & disponibilité.
// ATT : le compteur de non-lues retombe à zéro après « Tout lire » ; la disponibilité
//       déclarée par le livreur se reflète côté exploitation (`/v1/drivers`) — sans quoi
//       le dispatch continue de lui affecter des courses.
import assert from 'node:assert/strict';
import { cas, ecran, chercher, toucher, attendre, capture, sleep, api, apiLivreur } from './lib.mjs';
import { seConnecter } from './g01.mjs';
import { passerAutorisations } from './g02.mjs';

/** Disponibilité du chauffeur telle que la console la voit. */
async function disponibiliteConsole(nom) {
  const liste = await api('/v1/drivers');
  return liste.find((d) => d.name === nom)?.available;
}

export default cas('TC-G17', 'Notifications & disponibilité', async () => {
  // On part d'un livreur disponible, quel que soit l'état laissé par un cas précédent.
  await apiLivreur('/v1/driver/availability', { method: 'PATCH', body: { available: true } });

  await seConnecter('TC-G17');
  await passerAutorisations();
  await attendre('Mes missions', { timeout: 30_000 });
  await sleep(2000);

  // --- Notifications -----------------------------------------------------------
  const cloche = (await ecran()).find((n) => /Notification|cloche/i.test(n.description) && n.centre);
  assert.ok(cloche, 'la cloche de notifications doit être atteignable depuis les missions');
  const badgeAvant = cloche.description;
  console.log(`  cloche → « ${badgeAvant} »`);
  await toucher(cloche.description);
  await attendre('Notifications', { timeout: 20_000, message: 'l’écran des notifications ne s’ouvre pas' });
  await sleep(1500);
  await capture('TC-G17', '01-notifications');

  const avant = (await ecran()).map((n) => n.texte).join(' | ');
  const nonLues = /(\d+) non lue/.exec(avant);
  console.log(`  avant → ${nonLues ? `${nonLues[1]} non lue(s)` : 'compteur absent'}`);
  assert.ok(nonLues && Number(nonLues[1]) > 0, 'des notifications non lues doivent être annoncées');

  await toucher('Tout lire');
  await sleep(2000);
  const apres = (await ecran()).map((n) => n.texte).join(' | ');
  const restantes = /(\d+) non lue/.exec(apres);
  console.log(`  après « Tout lire » → ${restantes ? `${restantes[1]} non lue(s)` : 'plus de compteur'}`);
  assert.ok(!restantes || Number(restantes[1]) === 0, 'le compteur de non-lues doit retomber à zéro');
  await capture('TC-G17', '02-tout-lu');

  // --- Disponibilité -----------------------------------------------------------
  await toucher('Retour');
  await sleep(1500);
  await toucher('Profil');
  await attendre('profil-disponibilite', { timeout: 25_000, message: 'l’interrupteur de disponibilité est introuvable' });
  await sleep(1500);
  await capture('TC-G17', '03-profil-disponible');

  assert.equal(await disponibiliteConsole('Hamid Ouali'), true, 'le livreur part disponible');
  const interrupteur = chercher(await ecran(), 'profil-disponibilite');
  console.log(`  interrupteur au départ → ${interrupteur.texte || 'ON'}`);

  // Se déclarer indisponible doit ATTEINDRE l'exploitation.
  await toucher('profil-disponibilite');
  await sleep(3000);
  const ecranApres = (await ecran()).map((n) => n.texte).join(' | ');
  assert.match(ecranApres, /Hors ligne — aucune mission/, 'l’écran doit annoncer que plus aucune mission n’arrivera');
  await capture('TC-G17', '04-indisponible');

  const fin = Date.now() + 30_000;
  let vue = null;
  do {
    vue = await disponibiliteConsole('Hamid Ouali');
    if (vue === false) break;
    await sleep(2000);
  } while (Date.now() < fin);
  console.log(`  console /drivers → disponible : ${vue}`);
  assert.equal(vue, false, 'la console doit voir le livreur indisponible');

  // Et le retour à « disponible » repasse aussi.
  await toucher('profil-disponibilite');
  await sleep(3000);
  const retour = await disponibiliteConsole('Hamid Ouali');
  console.log(`  retour à disponible → console : ${retour}`);
  assert.equal(retour, true, 'le retour à disponible doit lui aussi atteindre la console');
  await capture('TC-G17', '05-redevenu-disponible');
});
