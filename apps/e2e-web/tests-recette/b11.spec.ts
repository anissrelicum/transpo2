import * as fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { COMPTES, loginTenant, logout, shotVp, saveCredential } from './helpers';

// TC-B11 — Réinitialisation de mot de passe.
// PAS : en admin, /users → menu du dispatcher → Réinitialiser le mot de passe.
// ATT : nouveau mot de passe temporaire affiché ; l'ancien ne fonctionne plus, le nouveau fonctionne.
function pwdOf(marker: string): string {
  const lines = fs.readFileSync(COMPTES, 'utf-8').split('\n').filter((l) => l.includes(marker));
  const m = /tempPassword=(\S+)/.exec(lines.at(-1) ?? '');
  if (!m) throw new Error(`mot de passe introuvable pour ${marker}`);
  return m[1];
}

// NB : lignes ciblees par locator DOM et non par role — apres la fermeture d'un dialogue
// declenchee par une mutation, le conteneur racine garde aria-hidden (defaut AN-12) et
// l'arbre d'accessibilite se vide : getByRole('row') ne trouve plus rien.
test('TC-B11 — réinitialisation du mot de passe dispatcher', async ({ page }) => {
  test.setTimeout(120_000);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const oldPwd = pwdOf('TC-B07');
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await page.goto('/users');

  const row = page.locator('tr', { hasText: 'dispatch@rabatexpress.ma' }).first();
  await row.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Réinitialiser le mot de passe' }).click();
  const reveal = page.getByRole('dialog').filter({ hasText: 'ne sera plus affiché' });
  await expect(reveal.getByText('Mot de passe temporaire')).toBeVisible({ timeout: 15_000 });
  await expect(reveal.getByText('Reda Ziani')).toBeVisible();
  const newPwd = ((await reveal.locator('[style*="code-font"]').first().textContent()) ?? '').trim();
  expect(newPwd.length).toBeGreaterThan(8);
  expect(newPwd).not.toBe(oldPwd);
  console.log(`TC-B11 nouveau mdp dispatcher = ${newPwd}`);
  saveCredential(`TC-B11 rabatexpress DISPATCHER dispatch@rabatexpress.ma tempPassword=${newPwd}`);
  await shotVp(page, 'TC-B11', '01-nouveau-mot-de-passe-temporaire');

  // Bouton Copier (même composant que le dialogue d'invitation de TC-B07).
  // Contexte HTTP (homelab) : navigator.clipboard est indisponible hors contexte sécurisé.
  // On observe : disponibilité de l'API, erreur JS éventuelle, bascule de l'icône (✓ vert).
  let pageError: string | null = null;
  page.once('pageerror', (e) => { pageError = e.message; });
  const clipboardApi = await page.evaluate(() => typeof navigator.clipboard?.writeText === 'function');
  await reveal.getByRole('button').first().click();
  await page.waitForTimeout(500);
  const copiedIcon = await reveal.locator('button svg[data-radix-check-icon], button:has(svg)').first().evaluate(
    (btn) => (btn.closest('button')?.className ?? '') + '|' + (btn.closest('button')?.getAttribute('data-accent-color') ?? ''),
  ).catch(() => '');
  const clip = clipboardApi
    ? await page.evaluate(() => navigator.clipboard.readText()).catch(() => null)
    : null;
  console.log(`TC-B11 Copier → clipboardApi=${clipboardApi} pageError=${pageError} presse-papiers=${clip} icone=${copiedIcon}`);
  await shotVp(page, 'TC-B11', '01b-bouton-copier-apres-clic');

  await reveal.getByRole('button', { name: 'Fermer' }).click();
  await logout(page, 'Nadia Alaoui');

  // L'ancien ne fonctionne plus.
  const errOld = await loginTenant(page, 'rabatexpress', 'dispatch@rabatexpress.ma', oldPwd);
  console.log(`ancien mdp → ${errOld}`);
  expect(errOld).toContain('Identifiants invalides');
  await shotVp(page, 'TC-B11', '02-ancien-mdp-refuse');

  // Le nouveau fonctionne.
  const errNew = await loginTenant(page, 'rabatexpress', 'dispatch@rabatexpress.ma', newPwd);
  expect(errNew).toBeNull();
  await expect(page).toHaveURL(/\/dashboard/);
  await shotVp(page, 'TC-B11', '03-nouveau-mdp-accepte');
});
