// TC-G14 — Signaler un incident.
// ATT : l'incident part du terrain et arrive à l'exploitation (`GET /v1/field/incidents`),
//       avec son type, son texte et le nom du livreur.
import assert from 'node:assert/strict';
import { cas, ecran, chercher, toucher, saisir, attendre, capture, sleep, api,
  clavierFerme, visible } from './lib.mjs';
import { seConnecter } from './g01.mjs';
import { passerAutorisations } from './g02.mjs';

const NOTE = 'Rue barree par des travaux, acces livraison impossible';

export default cas('TC-G14', 'Signaler un incident', async () => {
  const avant = await api('/v1/field/incidents');

  await seConnecter('TC-G14');
  await passerAutorisations();

  await toucher('Profil');
  await attendre('Signaler un incident', { timeout: 25_000 });
  await toucher('Signaler un incident');
  await attendre('Type d’incident', { timeout: 20_000, message: 'l’écran de signalement ne s’ouvre pas' });
  await sleep(1200);
  await capture('TC-G14', '01-formulaire');

  // Les types proposés sont ceux du domaine : le terrain ne saisit pas un type libre.
  const noeuds = await ecran();
  const textes = noeuds.map((n) => `${n.texte} ${n.description}`).join(' | ');
  for (const type of ['Adresse introuvable', 'Client injoignable', 'Colis endommagé',
    'Problème de véhicule', 'Autre']) {
    assert.ok(chercher(noeuds, type), `le type « ${type} » doit être proposé`);
  }
  console.log('  5 types d’incident normalisés proposés');
  await toucher('Problème de véhicule');
  await saisir('incident-note', NOTE);
  await clavierFerme();
  await capture('TC-G14', '02-incident-saisi');

  await toucher('Envoyer le signalement');
  await attendre('Signalement envoyé', { timeout: 25_000, message: 'l’envoi du signalement n’aboutit pas' });
  await sleep(1500);
  await capture('TC-G14', '03-signalement-envoye');

  // L'app rend une référence : le livreur repart avec une trace opposable.
  const apresEnvoi = (await ecran()).map((n) => n.texte).join(' | ');
  assert.match(apresEnvoi, /Référence/, 'une référence de signalement doit être rendue au livreur');
  assert.match(apresEnvoi, new RegExp(NOTE.slice(0, 20)), 'le signalement doit apparaître dans « Mes signalements »');
  console.log('  signalement envoyé, référence rendue et historique alimenté');

  // Côté exploitation : l'incident est arrivé, attribué au bon livreur.
  const apres = await api('/v1/field/incidents');
  console.log(`  /v1/field/incidents → ${avant.length} avant, ${apres.length} après`);
  assert.equal(apres.length, avant.length + 1, 'l’exploitation doit recevoir exactement un incident de plus');
  const incident = apres.find((i) => !avant.some((a) => a.id === i.id));
  console.log(`  incident reçu → ${incident.type} · ${incident.driver} · « ${incident.note} »`);
  assert.equal(incident.driver, 'Hamid Ouali', 'l’incident doit être attribué au livreur connecté');
  assert.equal(incident.type, 'VEHICULE', 'le type choisi doit être transmis');
  assert.equal(incident.note, NOTE, 'le texte saisi doit arriver intact');
});
