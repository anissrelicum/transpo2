import { test, expect, Page } from '@playwright/test';

const base = process.env.WEB_URL || 'http://console-web:3001';

// Attend que la console (build de prod, routes précompilées) réponde.
test.beforeAll(async ({ request }) => {
  for (let i = 0; i < 40; i++) {
    try { const r = await request.get(`${base}/login`); if (r.ok()) return; } catch { /* pas prêt */ }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('console-web indisponible');
});

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="tenant"]', 'casaexpress');
  await page.fill('input[name="email"]', 'admin@casaexpress.ma');
  await page.fill('input[name="password"]', 'transpo');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/); // attend la fin de la navigation post-login
}

test('login CasaExpress → tableau de bord dans le shell (sidebar)', async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible();
  // La sidebar affiche la navigation groupée.
  await expect(page.getByText('Opérations')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Commandes' })).toBeVisible();
});

test('navigation sidebar → Commandes : liste des 2 commandes', async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole('link', { name: 'Commandes' }).click();
  await expect(page).toHaveURL(/\/orders/);
  await expect(page.getByTestId('orders-count')).toHaveText('2 commande(s)');
  await expect(page.getByTestId('order-row')).toHaveCount(2);
});

test('filtre par statut → n’affiche que les commandes du statut choisi', async ({ page }) => {
  await login(page);
  await page.goto('/orders');
  await page.getByTestId('filter-NOUVELLE').click();
  await expect(page).toHaveURL(/status=NOUVELLE/);
  await expect(page.getByTestId('orders-count')).toHaveText('1 commande(s)');
  await expect(page.getByTestId('order-row')).toHaveCount(1);

  await page.getByTestId('filter-all').click();
  await expect(page.getByTestId('order-row')).toHaveCount(2);
  await expect(page.getByTestId('page-indicator')).toHaveText('Page 1 / 1');
});

// Smoke : chaque écran du menu rend son titre (aucun 500 / redirection login).
const SCREENS: [string, string][] = [
  ['/dashboard', 'Tableau de bord'],
  ['/orders', 'Commandes'],
  ['/analytics', 'Analytics & SLA'],
  ['/fraud', 'Fraude COD'],
  ['/tournees', 'Tournées'],
  ['/dispatch', 'Dispatch'],
  ['/fleet', 'PC flotte — temps réel'],
  ['/zones', 'Zones'],
  ['/hub', 'Tri en hub'],
  ['/returns', 'Retours'],
  ['/vehicles', 'Véhicules'],
  ['/drivers', 'Chauffeurs'],
  ['/pricing', 'Tarification'],
  ['/invoices', 'Factures'],
  ['/cash', 'Caisse'],
  ['/payout', 'Reversement COD'],
  ['/users', 'Utilisateurs'],
  ['/notifications', 'Centre de notifications'],
  ['/reviews', 'Avis clients'],
  ['/templates', 'Modèles de notification'],
  ['/settings', 'Paramètres'],
];

test('tous les écrans du menu rendent leur titre (branchés API)', async ({ page }) => {
  await login(page);
  for (const [path, title] of SCREENS) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(path.replace('/', '\\/')));
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  }
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
