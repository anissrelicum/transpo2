// Temps de conduite — règlement EU 561/2006 (cf. PRD Lot 3 §5.11, écran « Mon shift »).
// Lancement : pnpm --filter @transpo/domain test
//
// Ces seuils ne sont pas vérifiables sur un émulateur : atteindre 9 h de conduite
// demanderait de manipuler l'horloge du téléphone, refusée sur une image Android de
// production. La recette mobile vérifie donc ce qui s'observe (le compteur avance, le
// shift démarre et s'arrête) ; les paliers réglementaires, eux, se tiennent ici.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eu561Status, EU561_MAX_DRIVE_HOURS } from './index.ts';

const h = (n: number) => n * 3_600_000;
const min = (n: number) => n * 60_000;

test('journée ordinaire : aucun palier franchi', () => {
  const r = eu561Status({ drivenMs: h(3), amplitudeMs: h(4) });
  assert.equal(r.level, 'ok');
  assert.equal(r.remainingMs, h(6));
  assert.equal(r.restMs, h(1), 'le repos est le service moins la conduite');
});

test('pause obligatoire à partir de 4 h 30 de conduite', () => {
  assert.equal(eu561Status({ drivenMs: h(4) + min(29), amplitudeMs: h(5) }).level, 'ok');
  assert.equal(eu561Status({ drivenMs: h(4) + min(30), amplitudeMs: h(5) }).level, 'pause');
});

test('alerte dans les 30 dernières minutes avant la limite', () => {
  assert.equal(eu561Status({ drivenMs: h(8) + min(29), amplitudeMs: h(9) }).level, 'pause');
  assert.equal(eu561Status({ drivenMs: h(8) + min(30), amplitudeMs: h(9) }).level, 'warn');
  assert.equal(eu561Status({ drivenMs: h(8) + min(59), amplitudeMs: h(9) }).level, 'warn');
});

test('limite journalière atteinte à 9 h, et jamais de restant négatif', () => {
  const pile = eu561Status({ drivenMs: h(EU561_MAX_DRIVE_HOURS), amplitudeMs: h(10) });
  assert.equal(pile.level, 'limite');
  assert.equal(pile.remainingMs, 0);

  const audela = eu561Status({ drivenMs: h(11), amplitudeMs: h(12) });
  assert.equal(audela.level, 'limite');
  assert.equal(audela.remainingMs, 0, 'le restant se borne à zéro plutôt que de passer négatif');
});

test('une amplitude inférieure à la conduite ne produit pas un repos négatif', () => {
  // Cas dégradé (horloge remise en arrière, reprise de shift) : mieux vaut zéro repos
  // affiché qu'un « -1h20 » incompréhensible pour le conducteur.
  assert.equal(eu561Status({ drivenMs: h(5), amplitudeMs: h(4) }).restMs, 0);
});
