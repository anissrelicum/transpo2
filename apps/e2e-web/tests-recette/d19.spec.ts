import { test, expect } from '@playwright/test';
import { loginTenant, shotVp } from './helpers';

// TC-D19 — Modifier la fiche d'un chauffeur (non-régression AN-14).
// PAS : menu de Sara Bennis → Modifier la fiche → ville, type déclaré, téléphone, permis.
//       Puis rattacher un véhicule à Hamid Ouali et le détacher.
// ATT : les champs persistent ; le type déclaré SURVIT au détachement.
test('TC-D19 — fiche chauffeur modifiable, type déclaré conservé au détachement', async ({ page }) => {
  test.setTimeout(180_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await page.goto('/drivers');

  // 1. Modification de la fiche de Sara Bennis.
  const sara = () => page.getByRole('row', { name: /Sara Bennis/ });
  await sara().getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Modifier la fiche' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText('Sara Bennis — informations du chauffeur.')).toBeVisible();
  await dlg.getByRole('combobox').nth(0).click();
  await page.getByRole('option', { name: 'Casablanca', exact: true }).click();
  await dlg.getByRole('combobox').nth(1).click();
  await page.getByRole('option', { name: 'Camion', exact: true }).click();
  await dlg.getByPlaceholder('+212600000000').fill('+212655555555');
  await dlg.getByPlaceholder('AB123456').fill('ZZ999999');
  await shotVp(page, 'TC-D19', '01-fiche-modifiee');
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();

  await page.reload();
  await expect(sara().getByText('Casablanca · +212655555555')).toBeVisible();
  await expect(sara().getByText('ZZ999999')).toBeVisible();
  await expect(sara().getByText('Camion (non rattaché)')).toBeVisible();
  await shotVp(page, 'TC-D19', '02-modifications-persistees');

  // 2. Le type déclaré survit à un rattachement puis à un détachement (AN-14).
  const hamid = () => page.getByRole('row', { name: /Hamid Ouali/ });
  async function rattacher(option: string) {
    await hamid().getByRole('button').last().click();
    await page.getByRole('menuitem', { name: 'Rattacher un véhicule' }).click();
    const d = page.getByRole('dialog');
    await d.getByRole('combobox').click();
    await page.getByRole('option', { name: option, exact: option === 'Aucun' }).click();
    await d.getByRole('button', { name: 'Enregistrer' }).click();
    await page.waitForTimeout(1500);
    await page.reload();
  }
  // Type déclaré AVANT tout rattachement.
  const avant = await hamid().locator('td').nth(0).innerText();
  console.log(`type déclaré avant rattachement → ${avant.replace(/\n/g, ' ')}`);

  await rattacher('1111-A-11');
  await expect(hamid().getByText('1111-A-11')).toBeVisible();
  await shotVp(page, 'TC-D19', '03-rattache');

  await rattacher('Aucun');
  await expect(hamid().getByText('1111-A-11')).toHaveCount(0);
  const apres = await hamid().locator('td').nth(0).innerText();
  console.log(`type déclaré après détachement → ${apres.replace(/\n/g, ' ')}`);
  // Le détachement ne laisse pas la COLONNE VÉHICULE vide : la capacité déclarée survit.
  // (Le « — » de la colonne Performance est légitime : aucune course clôturée.)
  const celluleVehicule = hamid().locator('td').nth(0);
  await expect(celluleVehicule).toContainText('(non rattaché)');
  expect((await celluleVehicule.innerText()).trim()).not.toBe('—');
  await shotVp(page, 'TC-D19', '04-type-declare-conserve');

  // 3. Renommer un chauffeur porteur de commandes est refusé avec son motif — à ce stade
  // du run aucune commande n'existe : le renommage doit donc aboutir.
  await sara().getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Modifier la fiche' }).click();
  const d2 = page.getByRole('dialog');
  await d2.locator('input').first().fill('Sara Bennis');
  await d2.getByRole('button', { name: 'Enregistrer' }).click();
  await page.reload();
  await expect(sara()).toBeVisible();
  await shotVp(page, 'TC-D19', '05-fiche-finale');
});
