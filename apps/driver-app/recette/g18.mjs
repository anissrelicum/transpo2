// TC-G18 — Bilingue & RTL (mobile).
// ATT : bascule FR → AR sur l'écran de connexion ; textes en arabe, mise en page inversée
//       (droite à gauche) après le redémarrage annoncé, et montants lisibles — jamais de
//       chiffres réordonnés par l'algorithme bidirectionnel.
import assert from 'node:assert/strict';
import { cas, ecran, chercher, toucher, attendre, capture, sleep, ouvrirApp, visible,
  missionsPour, viderMissions, LARGEUR_ECRAN } from './lib.mjs';
import { seConnecter } from './g01.mjs';
import { passerAutorisations } from './g02.mjs';
import { allerAuxMissions } from './g03.mjs';

/** Côté de l'écran où se trouve un nœud : 'gauche' ou 'droite'. */
function cote(noeud) {
  const [x1, , x2] = noeud.bornes;
  return (x1 + x2) / 2 < LARGEUR_ECRAN / 2 ? 'gauche' : 'droite';
}

export default cas('TC-G18', 'Bilingue & RTL (mobile)', async () => {
  await viderMissions('Hamid Ouali');
  const [ref] = await missionsPour('Hamid Ouali', [{ cod: 450, toCity: 'Casablanca' }]);

  await ouvrirApp();
  await capture('TC-G18', '01-connexion-fr');

  await attendre('AR', { timeout: 20_000, message: 'la bascule de langue doit être proposée dès l’écran de connexion' });

  // --- Bascule vers l'arabe ------------------------------------------------------
  await toucher('AR');
  await sleep(1500);
  // L'app annonce qu'un redémarrage est nécessaire pour retourner la mise en page :
  // c'est une limite de React Native, et la dire vaut mieux que de la taire.
  const alerte = (await ecran()).map((n) => n.texte).join(' | ');
  assert.match(alerte, /إعادة تشغيل ضرورية|Redémarrage/, 'le redémarrage nécessaire doit être annoncé');
  console.log('  bascule AR → redémarrage annoncé');
  for (const l of ['حسنًا', 'OK']) if (await visible(l)) { await toucher(l); break; }
  await sleep(1000);

  // Les textes, eux, passent en arabe immédiatement.
  const enArabe = (await ecran()).map((n) => n.texte).join(' | ');
  assert.match(enArabe, /سجّل الدخول لبدء يومك|ترانسبو للسائقين/, 'l’écran de connexion doit passer en arabe');
  await capture('TC-G18', '02-connexion-ar');

  // --- Après redémarrage : la bascule propose le retour au français ---------------
  await ouvrirApp({ langue: 'ar' });
  await sleep(2000);
  await attendre('FR', { timeout: 20_000, message: 'la bascule doit désormais proposer le retour au français' });
  await capture('TC-G18', '03-connexion-ar-apres-redemarrage');

  // --- Parcours en arabe ----------------------------------------------------------
  await seConnecter('TC-G18', { langue: 'ar' });
  await passerAutorisations();
  await attendre('مهامي', { timeout: 45_000, message: 'la liste des missions ne s’affiche pas en arabe' });
  await sleep(2500);
  await capture('TC-G18', '04-missions-ar');

  const enMissions = await ecran();
  const missions = enMissions.map((n) => n.texte).join(' | ');
  assert.match(missions, /مهامي/, 'le titre des missions doit être en arabe');
  assert.match(missions, /للتحصيل/, 'le libellé du COD à encaisser doit être en arabe');

  // La mise en page est INVERSÉE : la barre d'onglets se lit de droite à gauche, le
  // premier onglet passant du bord gauche au bord droit.
  const ongletAr = enMissions.find((n) => n.description === 'المهام' && n.bornes);
  const dernierAr = enMissions.find((n) => n.description === 'الملف' && n.bornes);
  assert.ok(ongletAr && dernierAr, 'les onglets doivent être annoncés en arabe');
  console.log(`  onglets → « المهام » à ${cote(ongletAr)}, « الملف » à ${cote(dernierAr)}`);
  assert.equal(cote(ongletAr), 'droite', 'le premier onglet doit passer à droite en RTL');
  assert.equal(cote(dernierAr), 'gauche', 'le dernier onglet doit passer à gauche en RTL');

  // Les montants : lus dans l'ordre, et protégés par un isolat directionnel — sans lui,
  // l'algorithme bidi affiche « 450,00 DH » à l'envers en contexte arabe.
  const montant = (await ecran()).map((n) => n.texte).find((t) => /450/.test(t) && /DH/.test(t));
  console.log(`  montant en contexte arabe → « ${montant} »`);
  assert.ok(montant, 'le montant du COD doit rester affiché en arabe');
  assert.match(montant, /450,00\s*DH/, 'le montant doit rester lisible dans l’ordre');
  assert.ok(montant.includes('⁦') && montant.includes('⁩'),
    'le montant doit être isolé du sens de lecture arabe (U+2066…U+2069)');

  // Fiche de mission puis preuve et échec, en arabe.
  await toucher(ref);
  await attendre('الاستلام', { timeout: 25_000, message: 'la fiche de mission n’est pas en arabe' });
  await capture('TC-G18', '05-mission-ar');
  const fiche = (await ecran()).map((n) => n.texte).join(' | ');
  assert.match(fiche, /التسليم/, 'le point de livraison doit être en arabe');

  await toucher('التنقل');
  await attendre('التقدم', { timeout: 25_000, message: 'l’écran de progression n’est pas en arabe' });
  await capture('TC-G18', '06-progression-ar');

  // --- Retour au français : `ouvrirApp` le rétablit, et c'est lui qu'on vérifie ------
  await ouvrirApp();
  await attendre('Connectez-vous pour démarrer votre journée',
    { timeout: 25_000, message: 'le retour au français doit être effectif' });
  await attendre('AR', { timeout: 20_000, message: 'la bascule doit reproposer l’arabe' });
  console.log('  retour au français effectif');
  await capture('TC-G18', '07-retour-fr');
});
