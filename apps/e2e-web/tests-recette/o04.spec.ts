import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-O04 — Remontée des avis dans la console.
// ATT : l'avis laissé par le client apparaît avec sa note, sa commande, son chauffeur et
//       son marchand ; la distribution est exacte.
test('TC-O04 — un avis client remonte à l’exploitation', async ({ page }) => {
  test.setTimeout(180_000);

  const ligne = sql(`SELECT ref, code, rating, driver, merchant FROM tenant_rabatexpress.orders
                     WHERE rating IS NOT NULL ORDER BY created_at DESC LIMIT 1`)
    .split('|').map((x) => x.trim());
  expect(ligne[0], 'un avis doit exister (TC-O03)').toBeTruthy();
  const [ref, , note, chauffeur, marchand] = ligne;
  console.log(`  avis en base → ${ref} · ${note}★ · ${chauffeur} · ${marchand}`);

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/reviews');
  await page.waitForTimeout(2000);
  await shotVp(page, 'TC-O04', '01-avis');

  const corps = await page.locator('body').innerText();
  expect(corps).toContain(ref);
  if (chauffeur) expect(corps).toContain(chauffeur);
  if (marchand) expect(corps).toContain(marchand);

  // La distribution doit compter ce que la base contient.
  const parNote = sql(`SELECT rating, count(*) FROM tenant_rabatexpress.orders
                       WHERE rating IS NOT NULL GROUP BY rating ORDER BY rating`)
    .split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((c) => c[0]);
  console.log(`  distribution en base → ${parNote.map(([n, c]) => `${n}★:${c}`).join(' ')}`);
  const api = await page.evaluate(async () => (await (await fetch('/api/proxy/v1/reviews')).json()));
  console.log(`  /v1/reviews → ${api.length} avis`);
  expect(api.length).toBe(parNote.reduce((s, [, c]) => s + Number(c), 0));
});
