// TC-G01 — Connexion livreur.
// PRÉ : compte livreur@rabatexpress.ma rattaché au chauffeur Hamid Ouali, créé depuis la
//       console (action « Inviter », rôle Livreur).
// ATT : écran des autorisations, puis onglet Missions.
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { cas, ouvrirApp, saisir, toucher, attendre, capture, clavierFerme, QA } from './lib.mjs';

export const ORG = 'rabatexpress';
export const EMAIL = 'livreur@rabatexpress.ma';

/** Mot de passe du livreur, lu dans COMPTES.md — jamais écrit en dur dans un cas. */
export function motDePasse() {
  const lignes = fs.readFileSync(`${QA}/COMPTES.md`, 'utf-8').split('\n').filter((l) => l.includes(EMAIL));
  const m = /tempPassword=(\S+)/.exec(lignes.at(-1) ?? '');
  if (!m) throw new Error(`mot de passe introuvable pour ${EMAIL} dans COMPTES.md`);
  return m[1];
}

/** Connexion complète, réutilisée par les cas suivants. */
export async function seConnecter(tc) {
  await ouvrirApp();
  await capture(tc, '01-ecran-de-connexion');
  await saisir('login-organisation', ORG);
  await saisir('login-email', EMAIL);
  await saisir('login-mot-de-passe', motDePasse());
  await clavierFerme();

  const noeuds = await attendre('login-organisation');
  assert.equal(noeuds.texte, ORG, `l'organisation saisie doit tenir (lu : « ${noeuds.texte} »)`);
  await capture(tc, '02-identifiants-saisis');
  await toucher('login-valider');
}

export default cas('TC-G01', 'Connexion livreur', async () => {
  await seConnecter('TC-G01');

  // L'écran des autorisations s'intercale avant les missions (détaillé par TC-G02).
  await attendre('Autorisations', { timeout: 45_000, message: "l'écran des autorisations ne s'affiche pas" });
  await capture('TC-G01', '03-ecran-des-autorisations');
  console.log('  connexion aboutie → écran des autorisations');
});
