import * as fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { COMPTES, loginTenant, logout, shotVp } from './helpers';

// TC-E08 — Écriture des zones : ouverte au dispatcher, fermée au comptable.
// La matrice RBAC du plan (§B) place « Dispatch, Zones… : écriture » en ✅ pour le
// dispatcher et en ❌ pour le comptable. Le cas confronte les deux rôles.
function pwdOf(marker: string): string {
  const lines = fs.readFileSync(COMPTES, 'utf-8').split('\n').filter((l) => l.includes(marker));
  const m = /tempPassword=(\S+)/.exec(lines.at(-1) ?? '');
  if (!m) throw new Error(`mot de passe introuvable pour ${marker}`);
  return m[1];
}

test('TC-E08 — zones : dispatcher écrit, comptable consulte', async ({ page }) => {
  test.setTimeout(180_000);

  // 1. Dispatcher : l'écriture lui est ouverte.
  let err = await loginTenant(page, 'rabatexpress', 'dispatch@rabatexpress.ma', pwdOf('TC-B11'));
  expect(err).toBeNull();
  await page.goto('/zones');
  await expect(page.getByRole('button', { name: 'Nouvelle zone' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeVisible();
  await shotVp(page, 'TC-E08', '01-dispatcher-peut-ecrire');

  const dispatcher = await page.evaluate(async () => {
    const zs = await (await fetch('/api/proxy/v1/dispatch/zones')).json();
    const z = (Array.isArray(zs) ? zs : zs.items ?? [])[0];
    const r = await fetch(`/api/proxy/v1/dispatch/zones/${z.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ color: 'cyan' }),
    });
    return r.status;
  });
  console.log(`PATCH zone (dispatcher) → ${dispatcher}`);
  expect(dispatcher).toBe(200);

  // 2. Comptable : consultation seule, écritures refusées 403.
  await logout(page, 'Reda Ziani').catch(() => logout(page));
  err = await loginTenant(page, 'rabatexpress', 'compta@rabatexpress.ma', pwdOf('TC-B08'));
  expect(err).toBeNull();
  await page.goto('/zones');
  await expect(page.getByRole('button', { name: 'Nouvelle zone' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enregistrer' })).toHaveCount(0);
  await shotVp(page, 'TC-E08', '02-comptable-lecture-seule');

  const comptable = await page.evaluate(async () => {
    const zs = await (await fetch('/api/proxy/v1/dispatch/zones')).json();
    const z = (Array.isArray(zs) ? zs : zs.items ?? [])[0];
    const j = { 'content-type': 'application/json' };
    return {
      creation: (await fetch('/api/proxy/v1/dispatch/zones', { method: 'POST', headers: j, body: JSON.stringify({ nameFr: 'Zone comptable' }) })).status,
      maj: (await fetch(`/api/proxy/v1/dispatch/zones/${z.id}`, { method: 'PATCH', headers: j, body: JSON.stringify({ color: 'crimson' }) })).status,
      suppression: (await fetch(`/api/proxy/v1/dispatch/zones/${z.id}`, { method: 'DELETE' })).status,
    };
  });
  console.log(`écritures comptable → ${JSON.stringify(comptable)}`);
  expect(comptable.creation).toBe(403);
  expect(comptable.maj).toBe(403);
  expect(comptable.suppression).toBe(403);
  await shotVp(page, 'TC-E08', '03-api-403');
});
