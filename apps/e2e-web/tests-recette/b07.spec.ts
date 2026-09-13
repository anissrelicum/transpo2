import { test, expect } from '@playwright/test';
import { inviteUser, loginTenant, shotVp, saveCredential, sql } from './helpers';

// TC-B07 — Invitation d'un dispatcher.
// PAS : /users → Inviter → Nom Reda Ziani, email dispatch@rabatexpress.ma, rôle Dispatcher.
// ATT : dialogue « Mot de passe temporaire » affiché une seule fois, bouton Copier fonctionnel.
test('TC-B07 — invitation dispatcher', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await page.goto('/users');
  await expect(page.getByRole('heading', { name: 'Utilisateurs & rôles' })).toBeVisible();
  // Pré-requis (hors périmètre) : l'adresse doit être libre, sinon c'est le refus de doublon
  // (TC-B09) qui se déclenche et non l'invitation testée ici.
  sql(`DELETE FROM tenant_rabatexpress.users WHERE email = 'dispatch@rabatexpress.ma'`);
  await page.reload();

  const pwd = await inviteUser(page, 'Reda Ziani', 'dispatch@rabatexpress.ma'); // rôle Dispatcher par défaut
  expect(pwd.length).toBeGreaterThan(8);
  console.log(`TC-B07 mdp temporaire dispatcher = ${pwd}`);
  saveCredential(`TC-B07 rabatexpress DISPATCHER dispatch@rabatexpress.ma tempPassword=${pwd}`);
  await shotVp(page, 'TC-B07', '01-dialogue-mot-de-passe-temporaire');

  // Bouton Copier fonctionnel. On verifie le RETOUR VISUEL (bouton vert + coche) et non
  // le contenu du presse-papiers : le homelab est servi en HTTP, donc hors contexte
  // securise, et `navigator.clipboard.readText()` y est indisponible cote test. Le
  // produit, lui, retombe sur execCommand (apps/console-web/lib/clipboard.ts) — un
  // echec de copie afficherait l'alerte « Copie impossible ».
  const reveal = page.getByRole('dialog').filter({ hasText: 'ne sera plus affiché' });
  const boutonCopier = reveal.getByRole('button').first();
  await boutonCopier.click();
  await expect(reveal.locator('[data-accent-color="green"]')).toBeVisible({ timeout: 10_000 });
  console.log('TC-B07 copie → retour visuel vert confirme (presse-papiers non lisible en HTTP)');

  await reveal.getByRole('button', { name: 'Fermer' }).click();
  // Le dialogue fermé, le mot de passe n'est plus affiché (affichage unique).
  await expect(page.getByText(pwd)).toHaveCount(0);
  const row = page.locator('tr', { hasText: 'dispatch@rabatexpress.ma' }).first();
  await expect(row.getByText('Reda Ziani')).toBeVisible();
  await expect(row.getByText('Dispatcher')).toBeVisible();
  await expect(row.getByText('Actif', { exact: true })).toBeVisible();
  await shotVp(page, 'TC-B07', '02-dispatcher-liste');
});
