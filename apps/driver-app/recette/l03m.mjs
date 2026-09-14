// TC-L03 (volet livreur) — Déclarer sa caisse du jour depuis le récap.
// ATT : le livreur voit le montant ATTENDU (ce que le serveur a enregistré de ses
//       encaissements), déclare ce qu'il a réellement en main, et l'écart part à la
//       comptabilité. C'est le chaînon qui manquait à la chaîne du COD.
import assert from 'node:assert/strict';
import { cas, ecran, toucher, saisir, attendre, capture, sleep, api, apiLivreur,
  clavierFerme, missionsPour, viderMissions, visible } from './lib.mjs';
import { seConnecter } from './g01.mjs';
import { passerAutorisations } from './g02.mjs';
import { jusquAuSeuilDeLivraison, prendreLaPhoto } from './g06.mjs';

const MONTANT = 450;
const MANQUE = 50;

export default cas('TC-L03m', 'Déclaration de caisse du livreur', async () => {
  // Décor : une livraison encaissée aujourd'hui, donc une caisse ouverte.
  await viderMissions('Hamid Ouali');
  const [ref] = await missionsPour('Hamid Ouali', [{ cod: MONTANT, proofLevel: 'photo' }]);

  await seConnecter('TC-L03m');
  await passerAutorisations();
  await jusquAuSeuilDeLivraison('TC-L03m', ref);
  await toucher('Confirmer la livraison');
  await attendre('Photo du colis livré', { timeout: 25_000 });
  await prendreLaPhoto();
  await toucher('Valider la preuve');
  await attendre('cod-montant-recu', { timeout: 25_000 });
  await saisir('cod-montant-recu', String(MONTANT));
  await clavierFerme();
  const valider = (await ecran()).find((n) => n.classe.includes('Button') && n.centre
    && /Confirmer l’encaissement/.test(n.description || n.texte));
  await toucher(valider.description || valider.texte);
  await sleep(1500);
  for (const l of ['Oui, encaissé', 'Confirmer']) if (await visible(l)) { await toucher(l); break; }
  await attendre('Livraison réussie', { timeout: 30_000 });
  await capture('TC-L03m', '01-encaissement');

  // Le récap du jour porte désormais la caisse : l'attendu vient du serveur.
  await toucher('Retour aux missions').catch(() => {});
  await sleep(1500);
  await toucher('Profil');
  await attendre('Récap du jour', { timeout: 25_000 });
  await toucher('Récap du jour');
  await attendre('Ma caisse du jour', { timeout: 25_000, message: 'le récap ne porte pas la caisse du jour' });
  await sleep(1500);
  await capture('TC-L03m', '02-ma-caisse');

  const textes = (await ecran()).map((n) => n.texte).join(' | ');
  assert.match(textes, /Attendu \(encaissements enregistrés\)/, 'le montant attendu doit être annoncé');
  assert.match(textes, new RegExp(String(MONTANT)), 'l’attendu doit valoir ce qui a été encaissé');

  // Le livreur déclare 50 DH de moins : l'écart doit remonter tel quel.
  await saisir('caisse-montant-declare', String(MONTANT - MANQUE));
  await clavierFerme();
  await capture('TC-L03m', '03-declaration');
  await toucher('caisse-declarer');
  await sleep(3000);
  const apres = (await ecran()).map((n) => n.texte).join(' | ');
  console.log(`  retour à l’écran → ${/Écart/.test(apres) ? 'écart annoncé' : 'pas d’écart annoncé'}`);
  for (const l of ['OK', 'Corriger']) if (await visible(l)) { await toucher(l); break; }
  await capture('TC-L03m', '04-ecart-annonce');

  // Côté exploitation : la session porte le déclaré, l'écart et le statut ECART.
  const caisse = await apiLivreur('/v1/driver/cash');
  console.log(`  caisse du jour → théorique ${caisse.theorique}, déclaré ${caisse.declared}, écart ${caisse.ecart}, statut ${caisse.status}`);
  assert.equal(caisse.declared, MONTANT - MANQUE, 'le déclaré du livreur doit être enregistré');
  assert.equal(caisse.ecart, MANQUE, 'l’écart doit valoir la différence');
  assert.equal(caisse.status, 'ECART', 'la session doit passer en écart');

  const sessions = await api('/v1/cash/sessions');
  const vue = sessions.find((s) => s.driver === 'Hamid Ouali');
  console.log(`  vue comptabilité → ${vue?.theorique} attendu, ${vue?.declared} déclaré, écart ${vue?.ecart}`);
  assert.equal(vue?.declared, MONTANT - MANQUE, 'la comptabilité doit voir le montant déclaré par le livreur');
});
