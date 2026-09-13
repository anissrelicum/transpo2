import { test, expect } from '@playwright/test';
import { loginTenant, shotVp } from './helpers';

// TC-B07 (suite) — le run précédent a créé le compte et capturé le dialogue
// « Mot de passe temporaire » avant de s'interrompre. On vérifie ici que le
// dispatcher invité est bien listé et actif, et que le mot de passe n'est
// plus affiché nulle part (affichage unique).
test('TC-B07 suite — dispatcher listé et actif', async ({ page }) => {
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await page.goto('/users');
  await expect(page.getByRole('heading', { name: 'Utilisateurs & rôles' })).toBeVisible();

  const row = page.getByRole('row', { name: /dispatch@rabatexpress\.ma/ });
  await expect(row.getByText('Reda Ziani')).toBeVisible();
  await expect(row.getByText('Dispatcher')).toBeVisible();
  await expect(row.getByText('Actif', { exact: true })).toBeVisible();
  // Le mot de passe temporaire n'apparaît plus dans la page (affichage unique).
  await expect(page.getByText('X3zv45hwK1Tc')).toHaveCount(0);
  await shotVp(page, 'TC-B07', '02-dispatcher-liste');
});
