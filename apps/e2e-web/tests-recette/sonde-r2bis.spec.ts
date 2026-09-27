import { test, expect } from '@playwright/test';
import { loginTenant } from './helpers';

// Sonde : durée de vie des dialogues ouverts depuis le menu « … » après le correctif R2.
test('Sonde R2bis — cycle de vie des dialogues du menu', async ({ page }) => {
  test.setTimeout(90_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await page.goto('/users');
  const row = page.getByRole('row', { name: /admin@rabatexpress\.ma/ });

  const sonder = async (item: string, cible: string) => {
    await row.getByRole('button').last().click();
    await page.getByRole('menuitem', { name: item }).click();
    let survivant = -1;
    for (let i = 0; i < 10; i++) {
      const n = await page.locator(`[role="${cible}"]`).count();
      if (n > 0) survivant = i * 300;
      await page.waitForTimeout(300);
    }
    console.log(`SONDE « ${item} » → ${cible} visible jusqu'à ~${survivant} ms (-1 = jamais apparu)`);
    // Nettoyage si quelque chose est resté ouvert.
    for (let i = 0; i < 4 && (await page.locator('[role="menu"], [role="alertdialog"], [role="dialog"]').count()) > 0; i++) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  };

  await sonder('Changer de rôle', 'dialog');
  await sonder('Réinitialiser le mot de passe', 'dialog');
  await sonder('Désactiver', 'alertdialog');

  // Témoin : le dialogue « Inviter » (bouton hors menu) doit survivre.
  await page.getByRole('button', { name: 'Inviter' }).click();
  await page.waitForTimeout(1500);
  const inv = await page.locator('[role="dialog"]').count();
  console.log(`SONDE « Inviter » (bouton) → dialog encore présent après 1,5 s : ${inv > 0}`);
});
