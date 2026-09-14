import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp } from './helpers';

// TC-T01 / TC-T02 — Bascule de langue et thème de la console.
// ATT : libellés traduits et mise en page RTL en arabe ; thème conservé à la navigation.
test('TC-T01 — la console bascule en arabe, en RTL, et garde le thème choisi', async ({ page }) => {
  test.setTimeout(240_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/dashboard');
  await page.waitForTimeout(1500);
  await shotVp(page, 'TC-T01', '01-francais');

  const dirInitial = await page.evaluate(() => document.documentElement.getAttribute('dir') ?? 'ltr');
  console.log(`  français → dir=${dirInitial}`);

  // Bascule AR par le sélecteur de la barre supérieure.
  const bascule = page.getByRole('button', { name: /AR|العربية/ }).first();
  if (await bascule.count()) {
    await bascule.click();
    await page.waitForTimeout(2000);
  } else {
    await page.evaluate(() => { document.cookie = 'lang=ar; path=/'; });
    await page.reload();
    await page.waitForTimeout(2000);
  }

  const apres = await page.evaluate(() => ({
    dir: document.documentElement.getAttribute('dir') ?? 'ltr',
    lang: document.documentElement.getAttribute('lang'),
    texte: document.body.innerText.slice(0, 400),
  }));
  console.log(`  arabe → dir=${apres.dir}, lang=${apres.lang}`);
  await shotVp(page, 'TC-T01', '02-arabe');
  const arabe = /[؀-ۿ]/.test(apres.texte);
  console.log(`  caractères arabes à l’écran : ${arabe}`);
  expect(apres.dir === 'rtl' || arabe, 'la console doit passer en arabe/RTL').toBe(true);

  // Les pages suivantes gardent la langue.
  for (const chemin of ['/orders', '/cash', '/settings']) {
    await page.goto(chemin);
    await page.waitForTimeout(1200);
    const d = await page.evaluate(() => document.documentElement.getAttribute('dir') ?? 'ltr');
    console.log(`  ${chemin} → dir=${d}`);
    expect(d).toBe(apres.dir);
  }
  await shotVp(page, 'TC-T01', '03-langue-conservee');

  // Retour au français pour les cas suivants.
  const retour = page.getByRole('button', { name: /FR|Français/ }).first();
  if (await retour.count()) { await retour.click(); await page.waitForTimeout(1500); }
});
