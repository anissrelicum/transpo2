import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, motDePasse } from './helpers';

// TC-D08 — Rattacher un véhicule.
// PAS : menu de Hamid Ouali → Rattacher un véhicule → 1111-A-11 → Enregistrer.
// ATT : la plaque apparaît sur la fiche chauffeur.
// Note : exécuté avant TC-D05 car le scénario « retirer un véhicule rattaché » de D05
// exige ce rattachement.
//
// Le cas mesure aussi le gel d'interface AN-13 : le dialogue se ferme sans attendre la
// mutation (DriversView.tsx:231), en course avec `router.refresh()`. On relève l'état de
// la page APRÈS enregistrement avant de conclure, puis on vérifie que la donnée est bien
// écrite (rechargement manuel).
test('TC-D08 — rattachement du véhicule 1111-A-11 à Hamid Ouali', async ({ page }) => {
  test.setTimeout(120_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/drivers');

  const row = () => page.getByRole('row', { name: /Hamid Ouali/ });
  // Pré-requis (hors périmètre du cas) : le cas doit pouvoir se rejouer sur une base déjà
  // passée par ce rattachement — on détache par appel direct avant de commencer. Le
  // détachement efface au passage le type déclaré du chauffeur (« Moto » du §0.4), que
  // rien ne permet de ressaisir : cf. AN-14.
  const detache = await page.evaluate(async () => {
    const r = await fetch('/api/proxy/v1/drivers');
    const ds = await r.json();
    const liste = Array.isArray(ds) ? ds : ds.items ?? [];
    const h = liste.find((d: any) => d.name === 'Hamid Ouali');
    if (!h?.vehicleId) return false;
    await fetch(`/api/proxy/v1/drivers/${h.id}/vehicle`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vehicleId: null }),
    });
    return true;
  });
  if (detache) console.log('pré-requis : rattachement précédent défait');
  await page.reload();
  await expect(row()).toBeVisible();
  await expect(row().getByText('1111-A-11')).toHaveCount(0);
  await shotVp(page, 'TC-D08', '00-fiche-sans-vehicule');

  await row().getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Rattacher un véhicule' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText('Hamid Ouali — véhicule du parc affecté au quotidien.')).toBeVisible();
  await dlg.getByRole('combobox').click();
  await shotVp(page, 'TC-D08', '01-options-vehicules');
  await page.getByRole('option', { name: /1111-A-11/ }).click();
  await shotVp(page, 'TC-D08', '02-vehicule-selectionne');

  const patch = page.waitForResponse(
    (r) => r.url().includes('/v1/drivers/') && r.url().endsWith('/vehicle') && r.request().method() === 'PATCH',
  );
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  const res = await patch;
  console.log(`PATCH .../vehicle → ${res.status()}`);
  expect(res.status()).toBe(200);

  // État de la page 3 s après l'enregistrement : ce que voit réellement l'administrateur.
  await page.waitForTimeout(3000);
  const etat = await page.evaluate(() => ({
    pointerEvents: getComputedStyle(document.body).pointerEvents,
    scrollLocked: document.body.hasAttribute('data-scroll-locked'),
    ariaHiddenRacine: document.querySelector('.radix-themes')?.getAttribute('aria-hidden') === 'true',
    dialogueOuvert: !!document.querySelector('[role="dialog"]'),
    plaqueAffichee: document.body.innerText.includes('1111-A-11'),
  }));
  console.log(`APRÈS ENREGISTREMENT → ${JSON.stringify(etat)}`);
  await shotVp(page, 'TC-D08', '03-apres-enregistrement');

  // La donnée est bien écrite : un rechargement manuel fait apparaître la plaque et le
  // type synchronisé (Fourgon).
  await page.reload();
  await expect(row().getByText('1111-A-11')).toBeVisible({ timeout: 15_000 });
  await expect(row().getByText('Fourgon', { exact: true })).toBeVisible();
  await shotVp(page, 'TC-D08', '04-plaque-apres-rechargement');

  // Verdict du cas : l'attendu « la plaque apparaît sur la fiche chauffeur » n'est tenu
  // qu'après rechargement manuel — cf. AN-13.
  expect(etat.plaqueAffichee, 'AN-13 : la plaque doit apparaître sans rechargement').toBe(true);
});
