// TC-G16 — Historique & gains.
// ATT : les livraisons réussies apparaissent avec la rémunération par course, et le COD
//       encaissé est présenté comme de l'argent du marchand — pas comme un gain.
import assert from 'node:assert/strict';
import { cas, ecran, toucher, attendre, capture, sleep, apiLivreur } from './lib.mjs';
import { seConnecter } from './g01.mjs';
import { passerAutorisations } from './g02.mjs';

export default cas('TC-G16', 'Historique & gains', async () => {
  await seConnecter('TC-G16');
  await passerAutorisations();

  await toucher('Profil');
  await attendre('Historique & gains', { timeout: 25_000 });
  await toucher('Historique & gains');
  await attendre('Livraisons', { timeout: 25_000, message: 'l’écran des gains ne s’ouvre pas' });
  await sleep(2500);
  await capture('TC-G16', '01-historique-et-gains');

  const noeuds = await ecran();
  const textes = noeuds.map((n) => n.texte).join(' | ');

  // Le tarif par course est annoncé, et il vient du serveur — pas d'un chiffre d'écran.
  const reference = await apiLivreur('/v1/driver/history');
  console.log(`  serveur → ${reference.deliveries} livraison(s), ${reference.gains} DH de gains, `
    + `${reference.codCollected} DH de COD encaissé (${reference.feePerDelivery} DH/course)`);
  assert.match(textes, new RegExp(String(reference.feePerDelivery)), 'la rémunération par course doit être affichée');
  assert.match(textes, /par livraison/, 'le tarif doit être présenté comme un tarif par livraison');

  // Les compteurs de l'écran collent à ce que l'exploitation facturera.
  assert.match(textes, new RegExp(`\\b${reference.deliveries}\\b`), 'le nombre de livraisons doit être affiché');
  assert.match(textes, new RegExp(String(reference.gains)), 'le total des gains doit être affiché');
  console.log('  compteurs de l’écran conformes à l’historique serveur');

  // Chaque livraison du jour est listée par sa référence.
  for (const o of reference.orders.slice(0, 3)) {
    assert.match(textes, new RegExp(o.ref), `la livraison ${o.ref} doit figurer à l’historique`);
  }
  console.log(`  ${Math.min(3, reference.orders.length)} livraison(s) retrouvée(s) par référence`);

  // Le COD n'est pas un gain : l'écran doit le dire, sans quoi un livreur peut croire
  // que l'argent collecté lui revient.
  assert.match(textes, /Contre-remboursement encaissé/, 'le COD encaissé doit être présenté à part');
  assert.match(textes, /ne fait pas partie de vos gains/, 'l’écran doit dire que le COD n’est pas un gain');
  console.log('  COD encaissé présenté à part, explicitement hors gains');
  await capture('TC-G16', '02-cod-hors-gains');
});
