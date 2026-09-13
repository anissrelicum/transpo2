// TC-G02 — Autorisations.
// PAS : Autoriser Localisation, Caméra, Notifications l'une après l'autre.
// ATT : « Commencer ma journée » reste indisponible tant que les 3 ne sont pas accordées.
import assert from 'node:assert/strict';
import { cas, ecran, chercher, toucher, toucherPoint, attendre, capture, sleep, visible } from './lib.mjs';
import { seConnecter } from './g01.mjs';

/**
 * Accepte la boîte de dialogue système d'Android, si elle s'affiche.
 * Les libellés varient selon l'autorisation et la version d'Android — « While using the
 * app » pour la localisation, « ALLOW » en capitales pour la caméra : la comparaison est
 * donc insensible à la casse, et on tape par coordonnées plutôt que par cible nommée.
 */
async function accepterDialogueSysteme() {
  const attendus = ['while using the app', 'only this time', 'allow', 'autoriser', 'pendant l’utilisation'];
  const repondus = [];
  // Android empile parfois plusieurs boîtes (précision de la position, puis accès) :
  // on répond tant qu'il en reste une.
  for (let i = 0; i < 4; i++) {
    const fin = Date.now() + 6000;
    let trouve = null;
    while (Date.now() < fin && !trouve) {
      const noeuds = await ecran();
      // Le filtre sur le PAQUET est indispensable : l'app porte elle aussi un bouton
      // « Autoriser » sur chaque carte, et le confondre avec la boîte système accorderait
      // les trois autorisations d'un coup — le cas ne testerait plus rien.
      trouve = noeuds.find((x) => x.centre
        && x.paquet !== 'host.exp.exponent'
        && attendus.includes((x.texte || x.description).trim().toLowerCase())) ?? null;
      if (!trouve) await sleep(700);
    }
    if (!trouve) break;
    repondus.push((trouve.texte || trouve.description).trim());
    await toucherPoint(trouve.centre);
    await sleep(1500);
  }
  return repondus.length ? repondus.join(' + ') : null;
}

/**
 * État du bouton d'action principale : son libellé porte le décompte des accords
 * (« 0/3 autorisations » → « Commencer ma journée »). Attendu, car l'écran se re-rend
 * après chaque autorisation et le nœud disparaît un instant.
 */
async function actionPrincipale({ timeout = 15_000 } = {}) {
  const fin = Date.now() + timeout;
  do {
    const noeuds = await ecran();
    const n = noeuds.find((x) => x.classe.includes('Button') && x.description && x.centre);
    if (n) return n;
    await sleep(700);
  } while (Date.now() < fin);
  throw new Error('bouton d’action principale introuvable');
}

/**
 * Accorde les trois autorisations et entre dans l'app. Réutilisé par les cas suivants :
 * l'écran s'intercale après chaque connexion, il n'est le SUJET que de TC-G02.
 */
export async function passerAutorisations() {
  if (!(await visible('Autorisations'))) return false;
  for (let i = 0; i < 3; i++) {
    if (!(await visible('Autoriser'))) break;
    await toucher('Autoriser');
    await accepterDialogueSysteme();
    await sleep(1000);
  }
  const action = await actionPrincipale();
  await toucher(action.description);
  await attendre('Mes missions', { timeout: 30_000 });
  return true;
}

export default cas('TC-G02', 'Autorisations', async () => {
  await seConnecter('TC-G02');
  await attendre('Autorisations', { timeout: 45_000 });
  await capture('TC-G02', '01-trois-autorisations-a-accorder');

  // Au départ : aucune accordée, l'action principale est indisponible.
  let action = await actionPrincipale();
  assert.ok(action, 'le bouton d’action principale doit être présent');
  assert.equal(action.actif, false, 'l’action doit être indisponible sans autorisation');
  console.log(`  au départ → « ${action.description} » (indisponible)`);

  // Les trois autorisations, une par une. Localisation et caméra passent par une boîte
  // système ; les notifications sont accordées dans l'app (pas de dépendance dédiée).
  for (const [i, titre] of ['Localisation', 'Caméra', 'Notifications'].entries()) {
    const noeuds = await ecran();
    const carte = chercher(noeuds, titre);
    assert.ok(carte, `la carte « ${titre} » doit être présente`);
    const autoriser = noeuds.filter((n) => n.description === 'Autoriser' || n.texte === 'Autoriser');
    assert.ok(autoriser.length > 0, `« Autoriser » doit rester proposé pour ${titre}`);
    await toucher('Autoriser');
    const repondu = await accepterDialogueSysteme();
    if (repondu) console.log(`  ${titre} → boîte système acceptée (« ${repondu} »)`);
    await sleep(1200);
    await capture('TC-G02', `0${i + 2}-${titre.toLowerCase().replace('é', 'e')}-accordee`);

    action = await actionPrincipale();
    const reste = 2 - i;
    if (reste > 0) {
      assert.equal(action.actif, false, `l’action doit rester indisponible : ${reste} autorisation(s) manquante(s)`);
      console.log(`  après ${titre} → « ${action.description} » (toujours indisponible)`);
    }
  }

  // Les trois accordées : l'action devient disponible et mène aux missions.
  action = await actionPrincipale();
  assert.equal(action.actif, true, 'l’action doit devenir disponible une fois les 3 accordées');
  console.log(`  les trois accordées → « ${action.description} » (disponible)`);
  await capture('TC-G02', '05-action-disponible');

  await toucher(action.description);
  await attendre('Missions', { timeout: 30_000, message: 'l’onglet Missions ne s’ouvre pas' });
  await capture('TC-G02', '06-onglet-missions');
});
