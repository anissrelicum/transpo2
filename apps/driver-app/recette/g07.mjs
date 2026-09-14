// TC-G07 — Encaissement du COD.
// ATT : montant ≤ 0 refusé ; à la validation → « Livraison réussie » ; la commande passe
//       Livrée côté console et le COD est rattaché à la caisse du chauffeur.
import assert from 'node:assert/strict';
import { cas, ecran, chercher, toucher, saisir, attendre, capture, sleep, api,
  missionsPour, viderMissions, visible, clavierFerme } from './lib.mjs';
import { seConnecter } from './g01.mjs';
import { passerAutorisations } from './g02.mjs';
import { jusquAuSeuilDeLivraison, prendreLaPhoto, actionPrincipale } from './g06.mjs';

const MONTANT = 450;

export default cas('TC-G07', 'Encaissement du COD', async () => {
  await viderMissions('Hamid Ouali');
  const [ref] = await missionsPour('Hamid Ouali', [{ cod: MONTANT, proofLevel: 'photo' }]);

  await seConnecter('TC-G07');
  await passerAutorisations();
  await jusquAuSeuilDeLivraison('TC-G07', ref);

  await toucher('Confirmer la livraison');
  await attendre('Photo du colis livré', { timeout: 25_000 });
  await prendreLaPhoto();
  await capture('TC-G07', '01-preuve-photo');

  // La preuve validée, l'encaissement s'intercale avant la clôture.
  await toucher('Valider la preuve');
  await attendre('cod-montant-recu', { timeout: 25_000, message: 'l’écran d’encaissement ne s’ouvre pas' });
  await sleep(1000);

  // L'écran d'encaissement annonce le montant dû par le client.
  const noeuds = await ecran();
  const textes = noeuds.map((n) => `${n.texte} ${n.description}`).join(' | ');
  assert.match(textes, /Montant à encaisser|Encaissement/, 'l’encaissement doit être demandé');
  assert.match(textes, new RegExp(String(MONTANT)), 'le montant dû doit être affiché');
  await capture('TC-G07', '02-encaissement-demande');

  // Un montant nul n'est pas un encaissement : le produit doit le refuser — soit en
  // fermant la validation, soit en la rejetant explicitement. Ce qui compte, c'est qu'une
  // livraison payable ne puisse pas se clore sur 0 DH encaissé.
  await saisir('cod-montant-recu', '0');
  await clavierFerme();
  await sleep(800);
  const boutonZero = (await ecran()).find((n) => n.classe.includes('Button') && n.centre
    && /Valider|Confirmer l’encaissement|Montant incomplet/.test(n.description || n.texte));
  console.log(`  montant 0 → « ${boutonZero?.description ?? boutonZero?.texte} » (actif : ${boutonZero?.actif})`);
  let refus = boutonZero?.actif === false;
  if (!refus) {
    await toucher(boutonZero.description || boutonZero.texte);
    await sleep(1500);
    const apres = await ecran();
    const alerte = apres.find((n) => /incomplet|Montant/i.test(n.texte) && n.classe.includes('TextView'));
    refus = !(await visible('Livraison réussie'));
    console.log(`  validation tentée à 0 → ${refus ? `refusée (« ${alerte?.texte ?? 'sans message'} »)` : 'ACCEPTÉE'}`);
    for (const l of ['OK', 'Corriger', 'Annuler']) if (await visible(l)) { await toucher(l); break; }
  }
  await capture('TC-G07', '03-montant-nul-refuse');
  assert.ok(refus, 'un encaissement de 0 DH sur une commande payable doit être refusé');
  const avantCloture = await api(`/v1/orders/${encodeURIComponent(ref)}`);
  assert.notEqual(avantCloture.status, 'LIVREE', 'la livraison ne doit pas se clore sur un encaissement nul');

  // Montant exact : la validation s'ouvre et la livraison se clôt.
  await saisir('cod-montant-recu', String(MONTANT));
  await clavierFerme();
  await sleep(800);
  const ouvert = (await ecran()).find((n) => n.classe.includes('Button') && n.centre
    && /Valider|Confirmer l’encaissement/.test(n.description || n.texte));
  assert.equal(ouvert?.actif, true, 'le montant exact doit ouvrir la validation');
  await capture('TC-G07', '04-montant-exact');
  await toucher(ouvert.description || ouvert.texte);
  await sleep(1500);
  // Une confirmation d'encaissement peut s'intercaler.
  for (const libelle of ['Oui, encaissé', 'Confirmer']) {
    if (await visible(libelle)) { await toucher(libelle); break; }
  }

  await attendre('Livraison réussie', { timeout: 30_000, message: 'l’écran de succès ne s’affiche pas' });
  await capture('TC-G07', '05-livraison-reussie');

  // Côté exploitation : la commande est Livrée et le COD est marqué encaissé.
  const commande = await api(`/v1/orders/${encodeURIComponent(ref)}`);
  console.log(`  console → ${commande.status}, COD encaissé : ${commande.codPaid}`);
  assert.equal(commande.status, 'LIVREE', 'la commande doit passer Livrée');
  assert.equal(commande.codPaid, true, 'le COD doit être marqué encaissé');

  // Et l'argent est rattaché au chauffeur, pas seulement à la commande : la réconciliation
  // de caisse somme les COD encaissés de ses livraisons.
  const recon = await api('/v1/cash/reconciliation');
  const sienne = recon.find((r) => r.driver === 'Hamid Ouali');
  console.log(`  réconciliation de Hamid Ouali → ${sienne?.theorique} DH sur ${sienne?.deliveries} livraison(s)`);
  assert.ok(sienne, 'le chauffeur doit apparaître à la réconciliation de caisse');
  assert.ok(sienne.theorique >= MONTANT, `le COD encaissé (${MONTANT}) doit être porté au théorique du chauffeur`);

  // À CONSIGNER pour la section L : aucune SESSION de caisse n'est ouverte automatiquement
  // pour un livreur qui encaisse. Le théorique existe, mais le déclaré, le dépôt et l'écart
  // n'ont pas de support tant qu'une session n'est pas créée par ailleurs.
  const sessions = await api('/v1/cash/sessions');
  const session = sessions.find((x) => x.driver === 'Hamid Ouali');
  console.log(`  session de caisse ouverte ? ${session ? 'oui' : 'NON — à confronter en section L'}`);
});
