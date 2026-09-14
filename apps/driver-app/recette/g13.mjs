// TC-G13 — Shift & EU 561.
// ATT : démarrer le shift ouvre la journée, les compteurs de conduite évoluent, l'arrêt
//       les fige. Les PALIERS réglementaires (pause à 4h30, alerte à 8h30, limite à 9h)
//       ne sont pas atteignables sur un émulateur — l'horloge d'une image Android de
//       production ne se règle pas — et sont tenus par `packages/domain/src/eu561.test.ts`.
import assert from 'node:assert/strict';
import { cas, ecran, chercher, toucher, attendre, capture, sleep, fermerBruitsSysteme } from './lib.mjs';
import { seConnecter } from './g01.mjs';
import { passerAutorisations } from './g02.mjs';

/**
 * Lit les compteurs du bloc « Temps de conduite ».
 *
 * L'écran rend une rangée de VALEURS puis la rangée de LIBELLÉS correspondante
 * (Restant / Repos estimé / Amplitude) : la valeur d'un libellé est donc trois crans
 * AVANT lui, pas après. Lire « le texte qui suit » donnait le libellé voisin.
 */
function compteurs(noeuds) {
  const textes = noeuds.map((n) => n.texte.trim()).filter(Boolean);
  const i = textes.indexOf('Conduite du jour');
  const j = textes.indexOf('Restant');
  if (i < 0 || j < 0) return {};
  return {
    conduite: textes[i + 1] ?? null,          // « 10 min / 9h »
    restant: textes[j - 3] ?? null,
    repos: textes[j - 2] ?? null,
    amplitude: textes[j - 1] ?? null,
  };
}

export default cas('TC-G13', 'Shift & EU 561', async () => {
  await seConnecter('TC-G13');
  await passerAutorisations();

  await toucher('Shift');
  await attendre('Mon shift', { timeout: 25_000, message: 'l’onglet Shift ne s’ouvre pas' });
  await sleep(1500);
  await capture('TC-G13', '01-shift-hors-service');

  // Au départ : hors service, aucun shift du jour.
  let noeuds = await ecran();
  let textes = noeuds.map((n) => n.texte).join(' | ');
  const dejaActif = /Shift en cours/.test(textes);
  if (dejaActif) {
    // Un run précédent a pu laisser le shift ouvert : on referme pour partir au propre.
    await toucher('Terminer le shift');
    await sleep(2000);
    noeuds = await ecran();
    textes = noeuds.map((n) => n.texte).join(' | ');
  }
  assert.match(textes, /Hors service/, 'le shift doit partir « Hors service »');
  assert.match(textes, /EU 561\/2006/, 'le cadre réglementaire doit être annoncé');
  console.log('  départ → « Hors service », bloc EU 561/2006 présent');

  // Démarrage : le shift s'ouvre, horodaté, et le partage de position suit (décision
  // produit : le shift EST l'interrupteur du suivi).
  await toucher('Démarrer le shift');
  await sleep(4000);
  // Démarrer le shift allume le partage de position : Android peut demander d'activer
  // la précision de localisation par-dessus l'app.
  await fermerBruitsSysteme();
  await sleep(2000);
  noeuds = await ecran();
  textes = noeuds.map((n) => n.texte).join(' | ');
  assert.match(textes, /Shift en cours/, 'le shift doit passer « en cours »');
  assert.match(textes, /Démarré à \d{2}[:h]\d{2}/, 'l’heure de démarrage doit être affichée');
  assert.match(textes, /Partage de position/, 'le partage de position doit être annoncé');
  const depart = compteurs(noeuds);
  console.log(`  démarré → conduite ${depart.conduite}, restant ${depart.restant}, amplitude ${depart.amplitude}`);
  assert.match(depart.conduite ?? '', /\/ 9h$/, 'le plafond réglementaire de 9 h doit être affiché');
  assert.ok(depart.restant, 'le temps de conduite restant doit être affiché');
  await capture('TC-G13', '02-shift-en-cours');

  // Les compteurs VIVENT : l'écran se rafraîchit chaque minute pendant le shift.
  console.log('  attente d’une minute de shift pour voir les compteurs bouger…');
  await sleep(75_000);
  noeuds = await ecran();
  const apres = compteurs(noeuds);
  console.log(`  après ~1 min → conduite ${apres.conduite}, restant ${apres.restant}, amplitude ${apres.amplitude}`);
  assert.notEqual(apres.conduite, depart.conduite, 'le temps de conduite doit avancer');
  assert.notEqual(apres.restant, depart.restant, 'le temps restant doit décroître d’autant');
  await capture('TC-G13', '03-compteurs-en-mouvement');

  // Arrêt : le shift se ferme et le compteur se fige sur ce qui a été conduit.
  await toucher('Terminer le shift');
  await sleep(3000);
  noeuds = await ecran();
  textes = noeuds.map((n) => n.texte).join(' | ');
  assert.match(textes, /Hors service/, 'le shift doit se refermer');
  const fige = compteurs(noeuds);
  console.log(`  arrêté → « Hors service », conduite figée à ${fige.conduite}`);
  // Le compteur a pu gagner une minute entre la lecture et l'arrêt : ce qui compte est
  // qu'il CONSERVE le temps conduit, pas qu'il soit à la minute près.
  const minutes = (v) => {
    const m = /(?:(\d+)h)?\s*(\d+)?\s*min?/.exec(String(v).split('/')[0] ?? '');
    return (Number(m?.[1] ?? 0) * 60) + Number(m?.[2] ?? 0);
  };
  assert.ok(minutes(fige.conduite) >= minutes(apres.conduite),
    `le temps conduit doit être conservé (${apres.conduite} → ${fige.conduite})`);
  assert.ok(minutes(fige.conduite) > 0, 'le temps conduit ne doit pas être remis à zéro à l’arrêt');
  await capture('TC-G13', '04-shift-termine');

  await sleep(65_000);
  const stable = compteurs(await ecran());
  console.log(`  une minute plus tard, à l’arrêt → conduite ${stable.conduite}`);
  assert.equal(stable.conduite, fige.conduite, 'à l’arrêt, le compteur ne doit plus avancer');
});
