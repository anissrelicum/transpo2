import { test, expect } from '@playwright/test';
import { loginSaas, nextAlert, shotVp } from './helpers';

// TC-A22 — Le cycle est neutre quand il n'y a rien à faire : « Lancer le cycle » deux fois
// de suite → mêmes compteurs à zéro, aucun statut ne bouge.
test('TC-A22 — Cycle neutre ×2', async ({ page }) => {
  test.setTimeout(120_000);
  await loginSaas(page);

  for (const n of [1, 2]) {
    const alertMsg = nextAlert(page);
    await page.getByRole('button', { name: 'Lancer le cycle' }).click();
    const msg = await alertMsg;
    console.log(`cycle ${n} → ${msg.replace(/\n/g, ' | ')}`);
    expect(msg).toContain('0 essai(s) expiré(s)');
    expect(msg).toContain('0 suspension(s)');
    expect(msg).toContain('0 reconduction(s)');
    expect(msg).toContain('0 statut(s) tenant réaligné(s)');
    await shotVp(page, 'TC-A22', `0${n}-cycle-${n}-compteurs-zero`);
  }

  // Aucun statut ne bouge.
  await page.reload();
  const atlas = page.getByRole('row', { name: /atlasfret/ });
  await expect(atlas.getByText('Essai')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('row', { name: /tangerlog/ }).getByText('Essai')).toBeVisible();
  await expect(page.getByRole('row', { name: /rabatexpress/ }).getByText('Actif')).toBeVisible();
  await shotVp(page, 'TC-A22', '03-statuts-inchanges');
});
