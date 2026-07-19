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

// Le tenant vient du host ; sur console-web (pas de sous-domaine) → défaut casaexpress.
// Pour cibler un autre tenant en test, on passe l'override ?org=<slug>.
async function login(page: Page, org?: string, email = 'admin@casaexpress.ma') {
  await page.goto(org ? `/login?org=${org}` : '/login');
  await page.fill('input[name="email"]', email);
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
  await expect(page.getByTestId('orders-count')).toHaveText('2 résultat(s)');
  await expect(page.getByTestId('order-row')).toHaveCount(2);
});

test('recherche → filtre la liste dense en direct', async ({ page }) => {
  await login(page);
  await page.goto('/orders');
  await expect(page.getByTestId('order-row')).toHaveCount(2);
  // Recherche par marchand (une seule commande "Atlas Cosmetics" seedée).
  await page.getByPlaceholder('Réf, code, marchand, ville…').fill('Atlas');
  await expect(page.getByTestId('orders-count')).toHaveText('1 résultat(s)');
  await expect(page.getByTestId('order-row')).toHaveCount(1);
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

test('création via l’assistant 3 étapes (tenant e2e) → apparaît dans la liste', async ({ page }) => {
  await login(page, 'e2e', 'admin@e2e.ma'); // override host → tenant e2e
  await page.goto('/orders');
  const countText = await page.getByTestId('orders-count').textContent();
  const before = parseInt(countText?.match(/\d+/)?.[0] || '0', 10);

  await page.getByRole('link', { name: 'Nouvelle commande' }).click();
  await expect(page).toHaveURL(/\/orders\/new/);
  // Étape 1 → 2 → 3
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByTestId('wizard-merchant').fill('Boutique Test UI');
  await page.getByRole('button', { name: 'Créer la commande' }).click();

  await expect(page).toHaveURL(/\/orders$/);
  await expect(page.getByTestId('orders-count')).toHaveText(new RegExp(`${before + 1} résultat`));
  await expect(page.getByText('Boutique Test UI').first()).toBeVisible();
});

test('détail commande : cycle de vie + onglets', async ({ page }) => {
  await login(page);
  await page.goto('/orders');
  await page.getByTestId('order-row').first().getByRole('link').first().click();
  await expect(page).toHaveURL(/\/orders\/CMD/);
  await expect(page.getByRole('heading', { name: 'Cycle de vie' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Facturation' })).toBeVisible();
  await page.getByRole('tab', { name: 'Facturation' }).click();
  await expect(page.getByText('Total TTC')).toBeVisible();
});

test('actions commande : menu d’actions présent (ADMIN)', async ({ page }) => {
  await login(page);
  await page.goto('/orders');
  // La colonne d'actions expose un menu par ligne pour un ADMIN.
  const menus = page.locator('[data-testid="order-row"] button');
  await expect(menus.first()).toBeVisible();
});

test('action d’écriture via proxy : création d’une zone (tenant e2e)', async ({ page }) => {
  await login(page, 'e2e', 'admin@e2e.ma');
  await page.goto('/zones');
  await page.getByRole('button', { name: 'Nouvelle zone' }).click();
  await page.getByPlaceholder('Casa Centre').fill('Zone Test UI');
  await page.getByRole('button', { name: 'Créer' }).click();
  await expect(page.getByText('Zone Test UI').first()).toBeVisible();
});

test('organisation détectée depuis l’adresse (host / override)', async ({ page }) => {
  await page.goto('/login?org=casaexpress');
  await expect(page.getByTestId('detected-org')).toHaveText('casaexpress');
});

test('mauvais mot de passe → message d’erreur, reste sur /login', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'admin@casaexpress.ma');
  await page.fill('input[name="password"]', 'faux');
  await page.click('button[type="submit"]');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
