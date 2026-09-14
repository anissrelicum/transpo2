import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-P05 — Modèles de notification.
// ATT : création, modification, puis rétablissement de la valeur d'origine ; les variables
//       déclarées sont réellement substituées.
test('TC-P05 — cycle de vie d’un modèle de notification', async ({ page }) => {
  test.setTimeout(180_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();

  await page.goto('/templates');
  await page.waitForTimeout(2000);
  await shotVp(page, 'TC-P05', '01-modeles');
  const corps = await page.locator('body').innerText();
  expect(corps).toMatch(/order\.(created|delivered)/);

  // Modification d'un modèle existant, par l'API que l'écran utilise.
  const evenement = 'order.delivered';
  const avant = await page.evaluate(async () => (await (await fetch('/api/proxy/v1/notifications/templates')).json()));
  const modeleAvant = avant.find((t: any) => t.event === evenement);
  console.log(`  modèle ${evenement} → « ${modeleAvant?.fr} »`);

  const texte = 'Votre colis {code} est arrive. Merci de votre confiance.';
  const maj = await page.evaluate(async ([ev, fr]) => {
    const r = await fetch(`/api/proxy/v1/notifications/templates/${ev}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fr, ar: 'وصل طردكم {code}.', active: true }),
    });
    return r.status;
  }, [evenement, texte] as const);
  console.log(`  enregistrement → ${maj}`);
  expect(maj).toBe(200);

  // La substitution des variables est réelle : le message envoyé porte le vrai code.
  const envoi = await page.evaluate(async (ev) => {
    const r = await fetch('/api/proxy/v1/notifications/send', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: ev, channel: 'SMS', recipient: '+212600111222', vars: { code: 'TESTCODE' } }),
    });
    return r.json();
  }, evenement);
  console.log(`  message rendu → « ${envoi.body} »`);
  expect(envoi.body).toContain('TESTCODE');
  expect(envoi.body).not.toContain('{code}');
  await shotVp(page, 'TC-P05', '02-modele-modifie');

  // Rétablissement : le modèle retrouve le texte du catalogue.
  const reset = await page.evaluate(async (ev) => (await fetch(`/api/proxy/v1/notifications/templates/${ev}/reset`, {
    method: 'POST',
  })).status, evenement);
  console.log(`  rétablissement → ${reset}`);
  expect(reset).toBe(200);
  const apres = await page.evaluate(async () => (await (await fetch('/api/proxy/v1/notifications/templates')).json()));
  const modeleApres = apres.find((t: any) => t.event === evenement);
  console.log(`  modèle rétabli → « ${modeleApres?.fr} »`);
  expect(modeleApres.fr).not.toBe(texte);
  await shotVp(page, 'TC-P05', '03-modele-retabli');
});
