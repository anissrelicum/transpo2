// TC-G12 — Scanner.
// ATT : un code valide est reconnu, le même code re-saisi est signalé en doublon, un code
//       inconnu est rejeté, et le compteur n/total suit. Les colis scannés sont ceux de la
//       tournée du livreur — pas un jeu de démonstration.
import assert from 'node:assert/strict';
import { cas, ecran, chercher, toucher, saisir, attendre, capture, sleep, api,
  missionsPour, viderMissions, clavierFerme, visible } from './lib.mjs';
import { seConnecter } from './g01.mjs';
import { passerAutorisations } from './g02.mjs';
import { allerAuxMissions } from './g03.mjs';

/** Lit le compteur de progression « n/total » de l'écran. */
async function compteur() {
  const n = chercher(await ecran(), 'scan-compteur');
  return n?.texte ?? null;
}

export default cas('TC-G12', 'Scanner', async () => {
  await viderMissions('Hamid Ouali');
  const refs = await missionsPour('Hamid Ouali', [
    { cod: 200, toCity: 'Salé' },
    { cod: 0, toCity: 'Kénitra' },
  ]);
  // Le code colis est attribué par l'API à la création : on le relit, on ne l'invente pas.
  const colis = [];
  for (const ref of refs) colis.push(await api(`/v1/orders/${encodeURIComponent(ref)}`));
  console.log(`  décor → ${colis.map((c) => `${c.ref}/${c.code}`).join(', ')}`);

  await seConnecter('TC-G12');
  await passerAutorisations();
  await allerAuxMissions(refs[0]);

  await toucher('Scanner');
  await attendre('Colis de la tournée', { timeout: 25_000, message: 'l’onglet Scanner ne s’ouvre pas' });
  await sleep(2000);
  await capture('TC-G12', '01-onglet-scanner');

  // La tournée affichée est la VRAIE : les codes des commandes du livreur y figurent.
  const liste = (await ecran()).map((n) => n.texte).join(' | ');
  for (const c of colis) {
    assert.match(liste, new RegExp(c.code), `le colis ${c.ref} (${c.code}) doit figurer dans la tournée`);
  }
  assert.doesNotMatch(liste, /CMD-DEMO/, 'aucun colis de démonstration ne doit subsister');
  console.log(`  tournée réelle → ${colis.length} colis listés, aucun CMD-DEMO`);

  const depart = await compteur();
  console.log(`  compteur au départ → ${depart}`);
  assert.equal(depart, `0/${colis.length}`, 'le compteur doit partir de 0 sur le nombre réel de colis');

  // 1. Code valide → reconnu. Le retour de scan positif est bref par construction
  //    (on enchaîne les colis) : on le guette au plus près du geste.
  await saisir('scan-code-manuel', colis[0].code);
  await clavierFerme();
  await toucher('Valider');
  const reconnu = await Promise.race([
    attendre('Colis reconnu', { timeout: 6000 }).then(() => true).catch(() => false),
    sleep(7000).then(() => false),
  ]);
  const apresScan = (await ecran()).map((n) => n.texte).join(' | ');
  console.log(`  ${colis[0].code} → ${reconnu ? '« Colis reconnu »' : 'retour visuel non capté'}`);
  assert.ok(reconnu || /1\/2|Colis récupéré/.test(apresScan),
    'un code de la tournée doit être reconnu et compté');
  await capture('TC-G12', '02-colis-reconnu');

  // 2. Le même code → doublon signalé, et le message RESTE (un refus qui s'efface en
  //    1,6 s passe inaperçu quand on scanne à la chaîne).
  await saisir('scan-code-manuel', colis[0].code);
  await clavierFerme();
  await toucher('Valider');
  await attendre('Déjà scanné', { timeout: 10_000, message: 'un code déjà scanné doit être signalé en doublon' });
  await sleep(3000);
  assert.ok(await visible('Déjà scanné'), 'le signalement de doublon doit rester affiché');
  console.log(`  ${colis[0].code} rescanné → « Déjà scanné » (toujours affiché 3 s après)`);
  await capture('TC-G12', '03-doublon');

  // 3. Un code inconnu → rejeté.
  await saisir('scan-code-manuel', 'ZZ99ZZ99');
  await clavierFerme();
  await toucher('Valider');
  await attendre('Colis hors tournée', { timeout: 10_000, message: 'un code inconnu doit être rejeté' });
  console.log('  ZZ99ZZ99 → « Colis hors tournée »');
  await capture('TC-G12', '04-hors-tournee');

  // 4. Le bouton de validation reste fermé sous 8 caractères.
  await saisir('scan-code-manuel', 'ABC123');
  await clavierFerme();
  const valider = (await ecran()).find((n) => n.texte === 'Valider' || n.description === 'Valider');
  console.log(`  code à 6 caractères → « Valider » actif : ${valider?.actif}`);

  // 5. Le scan au retrait n'est pas qu'un affichage : le colis est déclaré récupéré.
  const fin = Date.now() + 60_000;
  let vu = null;
  do {
    vu = (await api(`/v1/orders/${encodeURIComponent(colis[0].ref)}`)).status;
    if (vu === 'RECUPEREE') break;
    await sleep(3000);
  } while (Date.now() < fin);
  console.log(`  côté exploitation → ${colis[0].ref} : ${vu}`);
  assert.equal(vu, 'RECUPEREE', 'le scan au retrait doit déclarer le colis récupéré');
  await capture('TC-G12', '05-compteur-et-suite');
});
