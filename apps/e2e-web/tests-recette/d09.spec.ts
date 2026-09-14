import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, isoPlus, motDePasse } from './helpers';

// TC-D09 — Régulariser un chauffeur.
// PAS : renouveler la visite médicale de Sara Bennis avec une date future → Enregistrer.
// ATT : elle redevient affectable.
test('TC-D09 — visite médicale renouvelée, Sara Bennis redevient affectable', async ({ page }) => {
  test.setTimeout(120_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/drivers');

  const sara = () => page.getByRole('row', { name: /Sara Bennis/ });
  // Pré-requis (hors périmètre) : le cas part d'une visite médicale échue, pour être
  // rejouable. L'endpoint `renew` accepte une date passée sans broncher — cf. OBS-10.
  await page.evaluate(async (echue) => {
    const r = await fetch('/api/proxy/v1/drivers');
    const ds = await r.json();
    const s = (Array.isArray(ds) ? ds : ds.items ?? []).find((d: any) => d.name === 'Sara Bennis');
    if (s && !s.medicalExpired) {
      await fetch(`/api/proxy/v1/drivers/${s.id}/renew`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ field: 'medical', due: echue }),
      });
    }
  }, isoPlus(-254));
  await page.reload();
  await expect(sara().getByText(/Expiré \(\d+ j\)/)).toBeVisible();
  await expect(sara().getByText('Bloqué')).toBeVisible();
  await expect(page.getByText(/exclus des suggestions de dispatch/)).toBeVisible();
  await shotVp(page, 'TC-D09', '01-visite-expiree-bloquee');

  const echeance = isoPlus(365);
  await sara().getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Renouveler la visite médicale' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText('Sara Bennis — nouvelle date d’échéance.')).toBeVisible();
  await dlg.locator('input[type="date"]').fill(echeance);
  await shotVp(page, 'TC-D09', '02-nouvelle-echeance');
  const renew = page.waitForResponse(
    (r) => r.url().includes('/v1/drivers/') && r.url().endsWith('/renew') && r.request().method() === 'POST',
  );
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  console.log(`POST .../renew → ${(await renew).status()}`);

  // État de la page après enregistrement : mesure du gel AN-13 (RenewItem ferme son
  // dialogue sans attendre la mutation, DriversView.tsx:250).
  await page.waitForTimeout(3000);
  const etat = await page.evaluate(() => ({
    pointerEvents: getComputedStyle(document.body).pointerEvents,
    ariaHiddenRacine: document.querySelector('.radix-themes')?.getAttribute('aria-hidden') === 'true',
  }));
  console.log(`APRÈS ENREGISTREMENT → ${JSON.stringify(etat)}`);

  await page.reload();
  await expect(sara().getByText(/Expiré/)).toHaveCount(0);
  await expect(sara().getByText('Bloqué')).toHaveCount(0);
  await expect(page.getByText(/exclus des suggestions de dispatch/)).toHaveCount(0);
  // KPI Conformité repassé à 0 : plus aucun chauffeur non affectable.
  await expect(page.getByText('2 chauffeurs · 2 disponibles · 0 non affectable(s)')).toBeVisible();
  await shotVp(page, 'TC-D09', '03-sara-affectable');
});
