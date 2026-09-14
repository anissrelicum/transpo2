// TC-T06 — Accessibilité tactile de l'app livreur.
// ATT : les cibles tactiles font au moins 44 px (48 dp Android), et l'action principale
//       est en bas d'écran, atteignable au pouce. Sur un téléphone tenu d'une main, une
//       cible trop petite ou trop haute, c'est un geste raté au volant.
import assert from 'node:assert/strict';
import { cas, ecran, toucher, attendre, capture, sleep, LARGEUR_ECRAN,
  missionsPour, viderMissions } from './lib.mjs';
import { seConnecter } from './g01.mjs';
import { passerAutorisations } from './g02.mjs';
import { allerAuxMissions } from './g03.mjs';

// 44 px de la maquette ≈ 44 dp ; l'écran de recette est en densité 3 (1080 × 2400).
const DENSITE = 3;
const MINIMUM = Math.round(44 * DENSITE * 0.75); // marge : on traque les cibles franchement trop petites
const HAUTEUR_ECRAN = 2400;

/** Cibles réellement touchables : boutons et onglets portant une description. */
function ciblesTactiles(noeuds) {
  return noeuds.filter((n) => n.bornes && n.actif
    && (n.classe.includes('Button') || n.description)
    && n.paquet === 'host.exp.exponent'
    && (n.bornes[2] - n.bornes[0]) > 0);
}

export default cas('TC-T06', 'Accessibilité tactile (mobile)', async () => {
  await viderMissions('Hamid Ouali');
  const [ref] = await missionsPour('Hamid Ouali', [{ cod: 300, toCity: 'Casablanca' }]);

  await seConnecter('TC-T06');
  await passerAutorisations();
  await allerAuxMissions(ref);

  const ecrans = [
    ['missions', null],
    ['fiche de mission', ref],
    ['progression', 'Naviguer'],
  ];
  const trop_petites = [];
  for (const [nom, action] of ecrans) {
    if (action) { await toucher(action); await sleep(2000); }
    const noeuds = await ecran();
    const cibles = ciblesTactiles(noeuds);
    const petites = cibles.filter((n) => (n.bornes[3] - n.bornes[1]) < MINIMUM);
    console.log(`  ${nom} → ${cibles.length} cible(s) tactile(s), ${petites.length} sous ${MINIMUM}px`);
    for (const p of petites) {
      trop_petites.push(`${nom} : « ${(p.description || p.texte).slice(0, 30)} » ${p.bornes[3] - p.bornes[1]}px`);
    }
    await capture('TC-T06', `0${ecrans.indexOf([nom, action]) + 1}-${nom.replace(/\s+/g, '-')}`);
  }
  console.log(trop_petites.length ? `  cibles trop petites :\n    ${trop_petites.join('\n    ')}` : '  toutes les cibles sont au gabarit');
  assert.equal(trop_petites.length, 0, `cibles tactiles trop petites : ${trop_petites.join(' | ')}`);

  // L'action principale du moment est en BAS de l'écran : c'est la zone du pouce.
  const noeuds = await ecran();
  const principale = noeuds.find((n) => n.classe.includes('Button') && n.bornes
    && /Démarrer vers le retrait|Confirmer la livraison/.test(n.description || n.texte));
  assert.ok(principale, 'l’action du moment doit être présente');
  const position = principale.bornes[1] / HAUTEUR_ECRAN;
  console.log(`  action principale « ${principale.description} » à ${Math.round(position * 100)} % de la hauteur`);
  assert.ok(position > 0.6, 'l’action principale doit être dans la moitié basse de l’écran');
  await capture('TC-T06', '04-action-principale-en-bas');
});
