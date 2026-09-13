// TC-G03 — Liste des missions.
// ATT : seules les commandes ASSIGNÉES au chauffeur du compte apparaissent (jamais celles
//       d'un autre) ; compteurs « À livrer » et « COD à encaisser » justes ; tirer pour
//       rafraîchir fonctionne.
import assert from 'node:assert/strict';
import {
  cas, ecran, chercher, attendre, capture, sleep, api, missionsPour, viderMissions, glisser, visible,
} from './lib.mjs';
import { seConnecter } from './g01.mjs';
import { passerAutorisations } from './g02.mjs';

const CHAUFFEUR = 'Hamid Ouali';
const AUTRE = 'Sara Bennis';

/** Lit un compteur de l'en-tête (« À livrer », « COD à encaisser »). */
function compteur(noeuds, libelle) {
  const i = noeuds.findIndex((n) => n.texte === libelle);
  if (i < 0) return null;
  // La valeur est le nœud de texte qui précède ou suit immédiatement le libellé.
  for (const j of [i - 1, i + 1, i - 2, i + 2]) {
    const t = noeuds[j]?.texte?.replace(/[⁦⁩  ]/g, '').trim();
    if (t && /^[\d.,\s]+(DH)?$/.test(t)) return t;
  }
  return null;
}

export default cas('TC-G03', 'Liste des missions', async () => {
  // Décor : trois missions pour le chauffeur du compte, une pour un autre chauffeur.
  await viderMissions(CHAUFFEUR);
  await viderMissions(AUTRE);
  const miennes = await missionsPour(CHAUFFEUR, [
    { cod: 450, toCity: 'Casablanca' },
    { cod: 300, toCity: 'Salé' },
    { cod: 0, toCity: 'Kénitra', proofLevel: 'aucune' },
  ]);
  const autres = await missionsPour(AUTRE, [{ cod: 999, toCity: 'Tanger' }]);
  console.log(`  décor → ${miennes.length} pour ${CHAUFFEUR}, ${autres.length} pour ${AUTRE}`);

  await seConnecter('TC-G03');
  await passerAutorisations();
  await attendre('Mes missions', { timeout: 45_000 });
  await sleep(2500);
  await capture('TC-G03', '01-arrivee-sur-les-missions');

  // L'app affiche d'abord les missions du dernier chargement : on tire pour rafraîchir,
  // ce que l'état vide invite d'ailleurs explicitement à faire.
  if (!(await visible(miennes[0]))) {
    console.log('  liste initiale vide → tirer pour rafraîchir');
    await glisser([540, 900], [540, 1700]);
    await sleep(3500);
  }
  await capture('TC-G03', '02-liste-des-missions');

  const noeuds = await ecran();
  const titre = noeuds.find((n) => n.texte.includes(`${CHAUFFEUR} ·`));
  assert.ok(titre, 'l’en-tête doit nommer le chauffeur du compte');
  console.log(`  en-tête → ${titre.texte}`);
  assert.match(titre.texte, /3 actives?/, 'trois missions actives attendues');

  // Cloisonnement : la mission d'un autre chauffeur ne doit JAMAIS apparaître.
  for (const ref of autres) {
    assert.equal(chercher(noeuds, ref), null, `la mission ${ref} de ${AUTRE} ne doit pas être visible`);
  }
  for (const ref of miennes) {
    assert.ok(chercher(noeuds, ref), `la mission ${ref} du chauffeur doit être listée`);
  }
  console.log(`  cloisonnement → les ${autres.length} mission(s) de ${AUTRE} sont absentes`);
  await capture('TC-G03', '03-cloisonnement-par-chauffeur');

  // Compteurs : « À livrer » = nombre de missions, « COD à encaisser » = somme des COD.
  const aLivrer = compteur(noeuds, 'À livrer');
  const cod = compteur(noeuds, 'COD à encaisser');
  console.log(`  compteurs → À livrer ${aLivrer} · COD ${cod}`);
  assert.equal(Number(aLivrer), 3, 'le compteur « À livrer » doit valoir le nombre de missions');
  assert.match(cod ?? '', /750/, 'le COD à encaisser doit sommer 450 + 300 (la 3e est prépayée)');

  // Tirer pour rafraîchir : une mission ajoutée hors app apparaît après le geste.
  const ajout = await missionsPour(CHAUFFEUR, [{ cod: 120, toCity: 'Fès' }]);
  await glisser([540, 900], [540, 1700]);
  await sleep(3000);
  const apres = await attendre(ajout[0], { timeout: 20_000, message: 'le rafraîchissement n’a pas ramené la nouvelle mission' });
  assert.ok(apres, 'la mission ajoutée doit apparaître après le rafraîchissement');
  console.log(`  tirer pour rafraîchir → ${ajout[0]} apparue`);
  await capture('TC-G03', '04-apres-rafraichissement');
});
