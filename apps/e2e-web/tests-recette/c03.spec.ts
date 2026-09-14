import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, sql, motDePasse } from './helpers';

// TC-C03 — Régional.
// PAS : devise, fuseau horaire, langue par défaut → Enregistrer.
// ATT : persistance.
// Note : devise et fuseau n'ont qu'une option (MAD / Africa-Casablanca) ; la langue par
// défaut bascule FR → AR → FR pour prouver l'écriture (la langue d'affichage de la console
// dépend du cookie `lang`, pas de ce réglage — pas d'impact sur l'UI du test).
test('TC-C03 — régional : langue par défaut persistée', async ({ page }) => {
  test.setTimeout(120_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/settings');

  // Carte Régional : 3ᵉ sélecteur = langue par défaut ; 2ᵉ bouton Enregistrer de la page.
  const langTrigger = page.getByRole('combobox').nth(2);
  const saveRegional = page.getByRole('button', { name: 'Enregistrer' }).nth(1);

  await expect(langTrigger).toContainText('Français');
  await shotVp(page, 'TC-C03', '01-regional-defauts');

  await langTrigger.click();
  await page.getByRole('option', { name: 'العربية' }).click();
  await saveRegional.click();
  // Un seul bouton « Enregistré ✓ » à la fois (état partagé entre les cartes).
  await expect(page.getByRole('button', { name: 'Enregistré ✓' })).toBeVisible();
  await shotVp(page, 'TC-C03', '02-langue-ar-enregistree');

  await page.reload();
  await expect(page.getByRole('combobox').nth(2)).toContainText('العربية');
  await shotVp(page, 'TC-C03', '03-ar-apres-rechargement');
  const db = sql(`SELECT currency, timezone, default_lang FROM tenant_rabatexpress.company_settings WHERE id='default'`);
  console.log(`base → ${db}`);
  expect(db).toBe('MAD | Africa/Casablanca | ar');

  // Restauration FR.
  await page.getByRole('combobox').nth(2).click();
  await page.getByRole('option', { name: 'Français' }).click();
  await page.getByRole('button', { name: 'Enregistrer' }).nth(1).click();
  await expect(page.getByRole('button', { name: 'Enregistré ✓' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('combobox').nth(2)).toContainText('Français');
  await shotVp(page, 'TC-C03', '04-fr-restaure');
  expect(sql(`SELECT default_lang FROM tenant_rabatexpress.company_settings WHERE id='default'`)).toBe('fr');
});
