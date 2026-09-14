import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, viderEffectif, motDePasse } from './helpers';

// TC-D06 — Ajouter les chauffeurs.
// PAS : /drivers → Ajouter un chauffeur → Hamid Ouali (données §0.4) → Ajouter ;
//       puis Sara Bennis avec une visite médicale échue.
// ATT : les deux fiches existent ; Sara Bennis est marquée non conforme / non affectable.
test('TC-D06 — ajout de Hamid Ouali et Sara Bennis (visite échue)', async ({ page }) => {
  test.setTimeout(150_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/drivers');
  // Pré-requis (hors périmètre) : l'effectif doit être vide pour que le cas se rejoue.
  await viderEffectif(page);
  await expect(page.getByText('Aucun chauffeur.')).toBeVisible();
  await shotVp(page, 'TC-D06', '01-liste-vide');

  async function addDriver(d: { name: string; city: string; vehicle: string; phone: string; licenseNo: string; licenseDue: string; medicalDue: string }) {
    await page.getByRole('button', { name: 'Ajouter un chauffeur' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByPlaceholder('Youssef Benali').fill(d.name);
    await dlg.getByRole('combobox').nth(0).click();
    await page.getByRole('option', { name: d.city, exact: true }).click();
    await dlg.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: d.vehicle, exact: true }).click();
    await dlg.getByPlaceholder('+212600000000').fill(d.phone);
    await dlg.getByPlaceholder('AB123456').fill(d.licenseNo);
    await dlg.locator('input[type="date"]').nth(0).fill(d.licenseDue);
    await dlg.locator('input[type="date"]').nth(1).fill(d.medicalDue);
    await dlg.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(page.getByRole('row', { name: new RegExp(d.name) })).toBeVisible({ timeout: 15_000 });
  }

  await addDriver({ name: 'Hamid Ouali', city: 'Rabat', vehicle: 'Moto', phone: '+212611111111', licenseNo: 'ZZ111111', licenseDue: '2029-01-01', medicalDue: '2029-01-01' });
  await shotVp(page, 'TC-D06', '02-hamid-cree');

  await addDriver({ name: 'Sara Bennis', city: 'Rabat', vehicle: 'Fourgon', phone: '+212622222222', licenseNo: 'ZZ222222', licenseDue: '2029-01-01', medicalDue: '2026-01-01' });

  // Hamid : conforme (visite verte), pas de badge Bloqué.
  const hamid = page.getByRole('row', { name: /Hamid Ouali/ });
  await expect(hamid.getByText('ZZ111111')).toBeVisible();
  await expect(hamid.getByText('Bloqué')).toHaveCount(0);

  // Sara : visite médicale expirée → marquée non conforme / non affectable.
  const sara = page.getByRole('row', { name: /Sara Bennis/ });
  await expect(sara.getByText(/Expiré \(\d+ j\)/)).toBeVisible();
  await expect(sara.getByText('Bloqué')).toBeVisible();
  await expect(page.getByText(/1 chauffeur\(s\) au permis ou à la visite médicale expirés/)).toBeVisible();
  await expect(page.getByText('2 chauffeurs · 2 disponibles · 1 non affectable(s)')).toBeVisible();
  await shotVp(page, 'TC-D06', '03-sara-non-conforme');
});
