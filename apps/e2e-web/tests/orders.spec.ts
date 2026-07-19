import { test, expect } from '@playwright/test';

// Attend que Next (dev, démarrage à froid) réponde avant de lancer les cas.
test.beforeAll(async ({ request }) => {
  const base = process.env.WEB_URL || 'http://console-web:3001';
  // Attend que Next réponde ET préchauffe les routes (compilation à la demande en dev).
  let up = false;
  for (let i = 0; i < 40; i++) {
    try { const r = await request.get(`${base}/login`); if (r.ok()) { up = true; break; } } catch { /* pas prêt */ }
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (!up) throw new Error('console-web indisponible');
  // Préchauffe /orders (sinon la 1re navigation compile à froid → flaky).
  await request.get(`${base}/orders`).catch(() => {});
});

test('login CasaExpress → liste des 2 commandes', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="tenant"]', 'casaexpress');
  await page.fill('input[name="email"]', 'admin@casaexpress.ma');
  await page.fill('input[name="password"]', 'transpo');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/orders/);
  await expect(page.getByTestId('orders-count')).toHaveText('2 commande(s)');
  await expect(page.getByTestId('order-row')).toHaveCount(2);
});

test('mauvais mot de passe → message d’erreur, reste sur /login', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="tenant"]', 'casaexpress');
  await page.fill('input[name="email"]', 'admin@casaexpress.ma');
  await page.fill('input[name="password"]', 'faux');
  await page.click('button[type="submit"]');

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
