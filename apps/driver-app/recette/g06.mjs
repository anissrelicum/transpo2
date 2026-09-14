// TC-G06 — Preuve de livraison.
// ATT : le bouton de validation reste DÉSACTIVÉ tant que la preuve exigée est incomplète.
import assert from 'node:assert/strict';
import { cas, ecran, chercher, toucher, toucherPoint, attendre, capture, sleep, glisser,
  missionsPour, viderMissions, visible } from './lib.mjs';
import { seConnecter } from './g01.mjs';
import { passerAutorisations } from './g02.mjs';
import { allerAuxMissions } from './g03.mjs';
import { avancer } from './g05.mjs';

/**
 * Action de validation de la preuve. Son libellé dit ce qui manque encore
 * (« Photo requise » → « Signature requise » → « Valider la preuve »), ce qui la distingue
 * du bouton « Prendre la photo » présent sur le même écran.
 */
export async function actionPrincipale({ timeout = 15_000 } = {}) {
  const fin = Date.now() + timeout;
  do {
    const n = (await ecran()).find((x) => x.classe.includes('Button') && x.centre
      && /requise|Valider la preuve/.test(x.description || x.texte));
    if (n) return n;
    await sleep(700);
  } while (Date.now() < fin);
  throw new Error('bouton de validation de la preuve introuvable');
}

/** Amène une mission jusqu'à « En route (livraison) », prête pour la preuve. */
export async function jusquAuSeuilDeLivraison(tc, ref) {
  await allerAuxMissions(ref);
  await toucher(ref);
  await attendre('Naviguer', { timeout: 20_000 });
  await toucher('Naviguer');
  await attendre('Progression', { timeout: 20_000 });
  for (const action of ['Démarrer vers le retrait', 'Colis récupéré', 'Démarrer la livraison']) {
    await toucher(action);
    await sleep(700);
    await toucher('Confirmer');
    await sleep(2500);
  }
}

/**
 * Prend une photo via l'appareil photo du téléphone (app système).
 *
 * L'app caméra met plusieurs secondes à s'ouvrir, et l'arbre d'accessibilité revient VIDE
 * pendant ce temps (« null root node »). Attendre un délai fixe faisait rater le
 * déclencheur et laissait le cas coincé dans la caméra, avec un message qui accusait
 * l'écran de preuve — un faux KO. On ATTEND donc chaque élément, jamais on ne suppose.
 */
export async function prendreLaPhoto() {
  await toucher('Prendre la photo');

  /**
   * Attend un nœud hors de l'app (la caméra système).
   *
   * La comparaison porte sur la DESCRIPTION et sur le dernier segment de l'identifiant,
   * séparément : un motif large appliqué à l'identifiant complet visait
   * `sticky_bottom_capture_layout` — le conteneur qui couvre tout l'écran — avant le vrai
   * déclencheur. Le harnais appuyait donc au milieu de la visée et concluait que
   * l'appareil photo ne déclenchait pas.
   */
  const attendreHorsApp = async (motif, timeout) => {
    const fin = Date.now() + timeout;
    do {
      const n = (await ecran()).find((x) => x.centre && x.paquet !== 'host.exp.exponent'
        && (motif.test(x.description) || motif.test(x.id.split('/').pop() ?? '')));
      if (n) return n;
      await sleep(800);
    } while (Date.now() < fin);
    return null;
  };

  // Le déclencheur apparaît AVANT que l'appareil ne soit prêt à déclencher : le premier
  // appui tombe alors dans le vide et l'écran reste sur la visée. On réappuie tant que
  // l'écran de validation du cliché n'apparaît pas.
  let valider = null;
  for (let essai = 1; essai <= 4 && !valider; essai++) {
    const declencheur = await attendreHorsApp(/^(Shutter|Take photo|shutter_button)$/i, 30_000);
    if (!declencheur) throw new Error('déclencheur de l’appareil photo introuvable');
    await toucherPoint(declencheur.centre);
    valider = await attendreHorsApp(/^(Done|OK|Accept|Confirmer|done_button)$/i, 9_000);
    if (!valider) console.log(`  appareil photo : cliché non pris (essai ${essai}/4), on réappuie`);
  }
  // Certains appareils rendent la photo sans écran de validation : l'absence n'est pas
  // fatale, c'est le retour à l'app qui tranche.
  if (valider) await toucherPoint(valider.centre);

  // Le retour à l'app n'est pas instantané : la photo est redimensionnée avant affichage.
  const fin = Date.now() + 30_000;
  do {
    if ((await ecran()).some((x) => x.paquet === 'host.exp.exponent' && x.centre)) return;
    await sleep(900);
  } while (Date.now() < fin);
  throw new Error('l’app livreur ne revient pas après la prise de photo');
}

export default cas('TC-G06', 'Preuve de livraison', async () => {
  await viderMissions('Hamid Ouali');
  // Niveau photo_signature : les DEUX artefacts sont exigés, c'est ce qui rend le cas
  // parlant — on vérifie que la validation reste fermée tant qu'il en manque un.
  const [ref] = await missionsPour('Hamid Ouali', [{ cod: 0, proofLevel: 'photo_signature' }]);

  await seConnecter('TC-G06');
  await passerAutorisations();
  await jusquAuSeuilDeLivraison('TC-G06', ref);

  await toucher('Confirmer la livraison');
  await attendre('Photo du colis livré', { timeout: 25_000, message: 'l’écran de preuve ne s’ouvre pas' });
  await sleep(1200);
  await capture('TC-G06', '01-preuve-vide');

  // L'action principale porte le libellé de CE QUI MANQUE, et reste fermée tant que la
  // preuve est incomplète. C'est le cœur du cas : le livreur doit savoir quoi faire.
  let action = await actionPrincipale();
  assert.equal(action.actif, false, 'sans photo ni signature, la validation doit être fermée');
  assert.match(action.description, /Photo requise/, 'le bouton doit nommer l’artefact manquant');
  console.log(`  0 artefact sur 2 → « ${action.description} » (fermée)`);

  // Photo seule : toujours incomplet pour le niveau photo_signature.
  await prendreLaPhoto();
  await capture('TC-G06', '02-photo-capturee');
  action = await actionPrincipale();
  assert.equal(action.actif, false, 'la photo seule ne suffit pas quand la signature est exigée');
  assert.match(action.description, /Signature requise/, 'le bouton doit désormais réclamer la signature');
  console.log(`  1 artefact sur 2 (photo) → « ${action.description} » (fermée)`);

  // Signature : un trait sur la zone dédiée.
  const zone = chercher(await ecran(), 'Faites signer ici')
    ?? (await ecran()).find((n) => n.classe.includes('SvgView') && n.centre);
  assert.ok(zone, 'la zone de signature doit être présente');
  await glisser([zone.centre[0] - 200, zone.centre[1]], [zone.centre[0] + 200, zone.centre[1] + 60], 700);
  await glisser([zone.centre[0] - 120, zone.centre[1] + 40], [zone.centre[0] + 160, zone.centre[1] - 30], 700);
  await sleep(1200);
  await capture('TC-G06', '03-signature-tracee');

  action = await actionPrincipale();
  assert.equal(action.actif, true, 'photo + signature réunies, la validation doit s’ouvrir');
  assert.match(action.description, /Valider la preuve/, 'le bouton doit repasser à la validation');
  console.log(`  2 artefacts sur 2 → « ${action.description} » (ouverte)`);
});
