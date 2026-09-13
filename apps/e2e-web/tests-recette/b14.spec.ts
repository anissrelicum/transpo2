import { test, expect } from '@playwright/test';
import { loginTenant, nextAlert, shotVp } from './helpers';

// TC-B14 — Protection du dernier admin.
// PAS : tenter de Désactiver l'unique compte ADMIN, puis de lui Changer de rôle.
// ATT : refus explicite — il doit rester au moins un administrateur actif.
// NB : lignes ciblees par locator DOM et non par role — apres la fermeture d'un dialogue
// declenchee par une mutation, le conteneur racine garde aria-hidden (defaut AN-12) et
// l'arbre d'accessibilite se vide : getByRole('row') ne trouve plus rien.
test('TC-B14 — protection du dernier administrateur', async ({ page }) => {
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await page.goto('/users');
  const row = page.locator('tr', { hasText: 'admin@rabatexpress.ma' }).first();

  // 1. Désactiver l'unique admin → refus explicite.
  await row.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Désactiver' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm.getByText(/Désactiver Nadia Alaoui/)).toBeVisible();
  const alert1 = nextAlert(page);
  await confirm.getByRole('button', { name: 'Désactiver' }).click();
  const msg1 = await alert1;
  console.log(`désactivation dernier admin → ${msg1}`);
  expect(msg1).toContain('dernier administrateur');
  // Le menu « … » reste ouvert après le refus (onSelect preventDefault) et masque
  // le tableau en aria-hidden → on le ferme avant de vérifier la ligne.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(row.getByText('Actif', { exact: true })).toBeVisible();
  await shotVp(page, 'TC-B14', '01-desactivation-refusee-toujours-actif');

  // 2. Changer de rôle de l'unique admin → refus explicite.
  await row.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Changer de rôle' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Comptable' }).click();
  const alert2 = nextAlert(page);
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  const msg2 = await alert2;
  console.log(`rétrogradation dernier admin → ${msg2}`);
  expect(msg2).toContain('dernier administrateur');
  await page.keyboard.press('Escape');
  await expect(row.getByText('Administrateur')).toBeVisible();
  await shotVp(page, 'TC-B14', '02-changement-role-refuse-toujours-admin');
});
