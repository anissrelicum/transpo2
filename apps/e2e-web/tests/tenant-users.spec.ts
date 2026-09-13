import { test, expect } from '@playwright/test';
import {
  inviteUser, loginTenant, logout, nextAlert, provisionTenant, saasToken, uniq, waitReady,
} from './helpers';

// Régression B07 / B09 / B10 / B13 / B14 — gestion des utilisateurs d'un tenant.
// Série : le tenant et le dispatcher sont partagés entre les tests du fichier.
test.describe.configure({ mode: 'serial' });

const slug = uniq('regusers');
const adminEmail = `admin@${slug}.ma`;
const dispEmail = `dispatch@${slug}.ma`;
let adminPassword = '';
let dispPassword = '';

test.beforeAll(async ({ request }) => {
  await waitReady(request);
  const token = await saasToken(request);
  const t = await provisionTenant(request, token, {
    slug, name: 'Regression Users', city: 'Casablanca', planCode: 'transporteur',
    adminEmail, adminName: 'Admin Users',
  });
  adminPassword = t.adminPassword ?? '';
  expect(adminPassword.length).toBeGreaterThan(8);
});

test('invitation dispatcher : mdp temporaire affiché une fois, première connexion', async ({ page }) => {
  test.setTimeout(120_000);
  let err = await loginTenant(page, slug, adminEmail, adminPassword);
  expect(err).toBeNull();
  await page.goto('/users');
  await expect(page.getByRole('heading', { name: 'Utilisateurs & rôles' })).toBeVisible();

  dispPassword = await inviteUser(page, 'Disp Reg', dispEmail); // rôle Dispatcher par défaut
  expect(dispPassword.length).toBeGreaterThan(8);

  const reveal = page.getByRole('dialog').filter({ hasText: 'ne sera plus affiché' });
  await reveal.getByRole('button', { name: 'Fermer' }).click();
  // Le dialogue fermé, le mot de passe n'est plus affiché (affichage unique).
  await expect(page.getByText(dispPassword)).toHaveCount(0);

  const row = page.getByRole('row', { name: new RegExp(dispEmail) });
  await expect(row.getByText('Disp Reg')).toBeVisible();
  await expect(row.getByText('Dispatcher')).toBeVisible();
  await expect(row.getByText('Actif', { exact: true })).toBeVisible();
  await logout(page, 'Admin Users');

  // Première connexion avec le mot de passe temporaire.
  err = await loginTenant(page, slug, dispEmail, dispPassword);
  expect(err).toBeNull();
  await expect(page.getByText('Disp Reg')).toBeVisible();
  await expect(page.getByText('Dispatcher')).toBeVisible();
});

test('email en doublon refusé : alerte explicite, rien créé', async ({ page }) => {
  const err = await loginTenant(page, slug, adminEmail, adminPassword);
  expect(err).toBeNull();
  await page.goto('/users');

  await page.getByRole('button', { name: 'Inviter' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByPlaceholder('Nom complet').fill('Doublon Dispatch');
  await dlg.getByPlaceholder('prenom.nom@tenant.ma').fill(dispEmail);
  const alertMsg = nextAlert(page);
  await dlg.getByRole('button', { name: 'Inviter' }).click();
  expect(await alertMsg).toContain('Cet email est déjà utilisé');
  await dlg.getByRole('button', { name: 'Annuler' }).click();

  // Toujours une seule ligne pour cet email.
  await expect(page.getByRole('row', { name: new RegExp(dispEmail) })).toHaveCount(1);
});

test('désactivation → connexion refusée → réactivation → connexion rétablie', async ({ page }) => {
  test.setTimeout(150_000);
  let err = await loginTenant(page, slug, adminEmail, adminPassword);
  expect(err).toBeNull();
  await page.goto('/users');

  // 1. Désactiver (avec confirmation).
  const row = page.getByRole('row', { name: new RegExp(dispEmail) });
  await row.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Désactiver' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm.getByText('Désactiver Disp Reg ?')).toBeVisible();
  await confirm.getByRole('button', { name: 'Désactiver' }).click();
  // Sur le homelab (Next 14 en build de prod), le rafraîchissement RSC après mutation
  // peut servir un rendu périmé ; un rechargement complet force la relecture.
  await page.reload();
  await expect(row.getByText('Désactivé', { exact: true })).toBeVisible({ timeout: 15_000 });
  await logout(page, 'Admin Users');

  // 2. Connexion refusée quand inactif.
  const errOff = await loginTenant(page, slug, dispEmail, dispPassword);
  expect(errOff).not.toBeNull();
  expect(errOff).toContain('Identifiants invalides');

  // 3. Réactiver → connexion rétablie.
  err = await loginTenant(page, slug, adminEmail, adminPassword);
  expect(err).toBeNull();
  await page.goto('/users');
  await row.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Réactiver' }).click();
  await page.reload(); // même raison : rendu RSC potentiellement périmé sur le homelab
  await expect(row.getByText('Actif', { exact: true })).toBeVisible({ timeout: 15_000 });
  await logout(page, 'Admin Users');

  err = await loginTenant(page, slug, dispEmail, dispPassword);
  expect(err).toBeNull();
  await expect(page).toHaveURL(/\/dashboard/);
});

test('protection du dernier administrateur : désactivation et rétrogradation refusées', async ({ page }) => {
  const err = await loginTenant(page, slug, adminEmail, adminPassword);
  expect(err).toBeNull();
  await page.goto('/users');
  const row = page.getByRole('row', { name: new RegExp(adminEmail) });

  // 1. Désactiver l'unique admin → refus explicite.
  await row.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Désactiver' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm.getByText(/Désactiver Admin Users/)).toBeVisible();
  const alert1 = nextAlert(page);
  await confirm.getByRole('button', { name: 'Désactiver' }).click();
  expect(await alert1).toContain('dernier administrateur');
  // Le menu reste ouvert après le refus (masque le tableau en aria-hidden) → on le ferme.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(row.getByText('Actif', { exact: true })).toBeVisible();

  // 2. Rétrograder l'unique admin → refus explicite.
  await row.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Changer de rôle' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Comptable' }).click();
  const alert2 = nextAlert(page);
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  expect(await alert2).toContain('dernier administrateur');
  await page.keyboard.press('Escape');
  await expect(row.getByText('Administrateur')).toBeVisible();
});
