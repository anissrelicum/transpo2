import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp } from './helpers';

// TC-T02 — Thème clair / sombre.
// ATT : la bascule change réellement le thème, le contraste reste lisible, et la
//       préférence est CONSERVÉE d'une page à l'autre — sinon l'exploitant la repose à
//       chaque navigation.
test('TC-T02 — bascule de thème et persistance', async ({ page }) => {
  test.setTimeout(180_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/dashboard');
  await page.waitForTimeout(1500);

  /** Apparence effective : la classe posée par Radix sur la racine, et le fond réel. */
  const apparence = () => page.evaluate(() => ({
    classe: document.documentElement.className + ' ' + (document.body.className ?? ''),
    fond: getComputedStyle(document.body).backgroundColor,
    texte: getComputedStyle(document.body).color,
  }));

  const avant = await apparence();
  console.log(`  départ → fond ${avant.fond}, texte ${avant.texte}`);
  await shotVp(page, 'TC-T02', '01-theme-initial');

  // La bascule est l'icône lune/soleil de la barre supérieure.
  const bascule = page.getByRole('button').filter({ has: page.locator('svg') });
  const lune = page.locator('button:has(svg)').first();
  await page.getByRole('button', { name: /Passer en sombre|Passer en clair/ }).first().click()
    .catch(async () => { await lune.click(); });
  await page.waitForTimeout(1500);

  const apres = await apparence();
  console.log(`  après bascule → fond ${apres.fond}, texte ${apres.texte}`);
  await shotVp(page, 'TC-T02', '02-theme-bascule');
  expect(apres.fond, 'le fond doit changer avec le thème').not.toBe(avant.fond);

  // Le contraste reste exploitable : fond et texte ne se confondent pas.
  expect(apres.fond).not.toBe(apres.texte);

  // Et la préférence survit à la navigation.
  for (const chemin of ['/orders', '/cash']) {
    await page.goto(chemin);
    await page.waitForTimeout(1200);
    const ici = await apparence();
    console.log(`  ${chemin} → fond ${ici.fond}`);
    expect(ici.fond, `le thème doit être conservé sur ${chemin}`).toBe(apres.fond);
  }
  await shotVp(page, 'TC-T02', '03-theme-conserve');

  // Retour au thème d'origine pour ne pas surprendre les cas suivants.
  await page.goto('/dashboard');
  await page.getByRole('button', { name: /Passer en sombre|Passer en clair/ }).first().click().catch(() => {});
});
