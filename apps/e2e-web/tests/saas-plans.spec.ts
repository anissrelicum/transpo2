import { test, expect } from '@playwright/test';
import {
  loginSaas, nextAlert, openPlanMenu, provisionTenant, saasApi, saasToken, uniq, waitReady,
} from './helpers';

// Régression A11 / A13 / A19 / A18 — catalogue de plans, création à l'usage, archivage protégé.
// Série : le plan à l'usage créé ici sert de plan « avec abonné » pour l'archivage.
test.describe.configure({ mode: 'serial' });

let token: string;
const suffix = uniq('');
const usageCode = `usage-reg-${suffix}`;
const usageLabel = `Usage Reg ${suffix}`;
const freeCode = `sans-abonne-reg-${suffix}`;

test.beforeAll(async ({ request }) => {
  await waitReady(request);
  token = await saasToken(request);
});

// Catalogue « au moins les 4 plans forfait historiques » : les tarifs/quotas exacts
// dépendent de l'environnement (la recette homelab a pu les ajuster), on vérifie
// la présence des plans, leur type Forfait et la forme tarif/quota.
test('catalogue : les 4 plans forfait avec tarifs et quotas', async ({ page }) => {
  await loginSaas(page);
  await page.goto('/saas/plans');
  await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible();

  for (const name of [/Essai/, /TPE Coursier/, /Transporteur/, /Entreprise/]) {
    const row = page.getByRole('row', { name });
    await expect(row).toBeVisible();
    await expect(row).toContainText('Forfait');
    await expect(row).toContainText(/Gratuit|\d[\d ]* DH\/mois/);
    await expect(row).toContainText(/\d[\d ]* cmd\/mois|Commandes illimitées/);
  }
});

test('création d’un plan à l’usage + version 3 paliers publiée', async ({ page }) => {
  test.setTimeout(120_000);
  await loginSaas(page);
  await page.goto('/saas/plans');
  await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible();

  // Création du plan (code auto depuis le libellé, rendu unique pour la régression).
  await page.getByRole('button', { name: 'Nouveau plan' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Pay as you go').fill(usageLabel);
  await dialog.getByPlaceholder('pay-as-you-go').fill(usageCode);
  await dialog.getByPlaceholder('الدفع حسب الاستعمال').fill('الدفع حسب الاستعمال');
  await dialog.getByRole('button', { name: 'Créer le plan' }).click();
  await expect(dialog).toBeHidden();
  await page.reload();

  // Bandeau « plan sans tarif » : il liste NOTRE plan (d'anciens runs peuvent laisser
  // d'autres plans sans tarif → on vérifie la mention du libellé, pas le nombre).
  // On cible le texte du Callout : un getByText regex remonterait jusqu'à un ancêtre
  // contenant aussi la ligne du plan dans le tableau (faux positif persistant).
  const banner = page.locator('.rt-CalloutText', { hasText: 'sans tarif' });
  await expect(banner).toContainText(usageLabel, { timeout: 30_000 });

  // Nouvelle version de tarif, mode À l'usage, 3 paliers : 1–100 à 6 · 101–500 à 4,50 · 501+ à 3.
  await openPlanMenu(page, usageCode);
  await page.getByRole('menuitem', { name: /Nouvelle version de tarif/ }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/Premier tarif de ce plan/)).toBeVisible();
  await dialog.getByRole('combobox').first().click();
  await page.getByRole('option', { name: /À l’usage/ }).click();

  const tierRows = dialog.locator('table tbody tr');
  await expect(tierRows).toHaveCount(1);
  await tierRows.nth(0).locator('input').last().fill('6');
  await dialog.getByRole('button', { name: 'Ajouter un palier' }).click();
  await expect(tierRows).toHaveCount(2);
  await dialog.getByRole('button', { name: 'Ajouter un palier' }).click();
  await expect(tierRows).toHaveCount(3);
  // Borne haute du palier 2 à 500 (recale automatiquement le palier 3 à 501).
  await tierRows.nth(1).locator('input').first().fill('500');
  await tierRows.nth(1).locator('input').last().fill('4.50');
  await tierRows.nth(2).locator('input').last().fill('3');
  await expect(tierRows.nth(2)).toContainText('501');
  await expect(tierRows.nth(2)).toContainText('et au-delà');

  await dialog.getByRole('button', { name: 'Publier le tarif' }).click();
  await expect(dialog).toBeHidden();
  await page.reload();

  // Bandeau ne mentionne plus notre plan (il peut rester visible pour d'autres
  // plans sans tarif légués par d'anciens runs), ligne à jour.
  await expect(page.locator('.rt-CalloutText', { hasText: usageLabel })).toHaveCount(0, { timeout: 30_000 });
  const row = page.getByRole('row', { name: new RegExp(usageCode) });
  await expect(row).toContainText('À l’usage — dès 3 DH/cmd', { timeout: 30_000 });
  await expect(row).toContainText('3 paliers · rétroactif');
});

test('code de plan en doublon refusé (409 « Plan déjà existant »)', async ({ page, request }) => {
  // API : le code du plan créé plus haut est refusé à la recréation.
  const dup = await saasApi(request, token, 'POST', 'plans', {
    code: usageCode, labelFr: 'Doublon', labelAr: 'تكرار',
  });
  expect(dup.status).toBe(409);
  expect(JSON.stringify(dup.body)).toContain(`Plan déjà existant : ${usageCode}`);

  // UI : « Essai » s'auto-code en « essai » (déjà pris) → alerte explicite, rien n'est créé.
  await loginSaas(page);
  await page.goto('/saas/plans');
  await page.getByRole('button', { name: 'Nouveau plan' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Pay as you go').fill('Essai');
  await expect(dialog.getByPlaceholder('pay-as-you-go')).toHaveValue('essai');
  await dialog.getByPlaceholder('الدفع حسب الاستعمال').fill('تجربة');

  const alertMsg = nextAlert(page);
  await dialog.getByRole('button', { name: 'Créer le plan' }).click();
  expect(await alertMsg).toContain('Plan déjà existant : essai');
  await dialog.getByRole('button', { name: 'Annuler' }).click();
});

test('archivage : refusé avec abonné, effectif sans abonné (puis restauration)', async ({ page, request }) => {
  test.setTimeout(180_000);

  // Un abonné sur le plan à l'usage : un tenant provisionné dessus (essai).
  const sub = await provisionTenant(request, token, {
    slug: uniq('regsub'), name: 'Regression Sub', planCode: usageCode,
  });
  expect(sub.slug).toBeTruthy();
  // Un plan sans abonné ni tarif, créé par API.
  const created = await saasApi(request, token, 'POST', 'plans', {
    code: freeCode, labelFr: `Sans Abonné Reg ${suffix}`, labelAr: 'بدون مشترك',
  });
  expect(created.status).toBe(201);

  await loginSaas(page);
  await page.goto('/saas/plans');
  await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible();

  // 1. Plan avec abonné : archivage refusé, plan toujours au catalogue.
  await openPlanMenu(page, usageCode);
  await page.getByRole('menuitem', { name: 'Archiver' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm.getByText(/1 organisation\(s\) y sont abonnées/)).toBeVisible();
  const refused = nextAlert(page);
  await confirm.getByRole('button', { name: 'Archiver' }).click();
  expect(await refused).toContain('organisation(s) sont abonnées à ce plan');
  await page.reload(); // referme proprement menu + dialogue
  await expect(page.getByRole('row', { name: new RegExp(usageCode) })).toBeVisible();

  // 2. Plan sans abonné : archivage effectif → hors catalogue par défaut.
  await openPlanMenu(page, freeCode);
  await page.getByRole('menuitem', { name: 'Archiver' }).click();
  await expect(confirm.getByText(/Aucun abonné/)).toBeVisible();
  await confirm.getByRole('button', { name: 'Archiver' }).click();
  await page.reload();
  await expect(page.getByRole('row', { name: new RegExp(freeCode) })).toHaveCount(0, { timeout: 30_000 });

  // Visible uniquement avec « Afficher les plans archivés ». Le badge « Archivé » est
  // rendu sur la carte (grille), pas dans la ligne du tableau : on vérifie la ligne
  // réapparue + au moins un badge Archivé (d'anciens runs peuvent en laisser d'autres).
  await page.getByRole('switch').check();
  const archivedRow = page.getByRole('row', { name: new RegExp(freeCode) });
  await expect(archivedRow).toBeVisible();
  await expect(page.getByText('Archivé', { exact: true }).first()).toBeVisible();

  // Sorti du sélecteur de plan du provisioning.
  await page.goto('/saas');
  await page.getByRole('button', { name: 'Provisionner' }).click();
  const prov = page.getByRole('dialog');
  await prov.getByRole('combobox').click();
  await expect(page.getByRole('option', { name: new RegExp(`Sans Abonné Reg ${suffix}`) })).toHaveCount(0);
  await expect(page.getByRole('option', { name: 'Transporteur' })).toBeVisible();
  await page.keyboard.press('Escape');
  await prov.getByRole('button', { name: 'Annuler' }).click();

  // 3. Restaurer : retour au catalogue.
  await page.goto('/saas/plans');
  await page.getByRole('switch').check();
  await openPlanMenu(page, freeCode);
  await page.getByRole('menuitem', { name: 'Restaurer' }).click();
  await page.reload();
  const restored = page.getByRole('row', { name: new RegExp(freeCode) });
  await expect(restored).toBeVisible({ timeout: 30_000 });
  await expect(restored).not.toContainText('Archivé');
});
