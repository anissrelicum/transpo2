// Non-régression : localisation d'un point par lien collé (WhatsApp, Google Maps…) dans
// l'assistant de création, conservation du lien et restitution sur la fiche commande.
// Les liens employés portent leurs coordonnées : aucun accès réseau sortant n'est requis
// (le géocodage inverse Nominatim est best-effort, son absence ne change pas le parcours).
import { test, expect, type Page } from '@playwright/test';
import { waitReady, BASE, API } from './helpers';

const LIEN_PLACE = 'https://www.google.com/maps/place/Twin+Center/@33.5880,-7.6330,17z/data=!3m1!4b1!4m6!3m5!8m2!3d33.5856!4d-7.6339';

test.beforeAll(async ({ request }) => {
  await waitReady(request);
  const probe = await request.post(`${API}/v1/auth/login`, {
    headers: { 'x-tenant-slug': 'e2e' }, data: { email: 'admin@e2e.ma', password: 'transpo' },
  }).catch(() => null);
  test.skip(probe?.status() !== 200, 'tenant e2e absent — spec réservée à la stack seedée');
});

async function login(page: Page) {
  await page.goto('/login?org=e2e');
  await page.fill('input[name="email"]', 'admin@e2e.ma');
  await page.fill('input[name="password"]', 'transpo');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);
}

/** Collage réel (évènement `paste` avec presse-papiers), comme un Ctrl+V. */
async function coller(page: Page, testId: string, texte: string) {
  const champ = page.getByTestId(testId);
  await champ.click();
  await champ.evaluate((el, t) => {
    const dt = new DataTransfer();
    dt.setData('text/plain', t);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, texte);
}

test('assistant : coller un lien place l’épingle, garde le lien et le transmet à la fiche', async ({ page }) => {
  await login(page);
  await page.goto('/orders/new');

  // Étape 1 — retrait : collage d'un lien Google « lieu » → position précise `!3d!4d`.
  await coller(page, 'loc-retrait-input', `📍 Voici l'adresse : ${LIEN_PLACE}`);
  await expect(page.getByTestId('loc-retrait-kept')).toContainText('Lien conservé — envoyé au livreur');
  await expect(page.getByTestId('loc-retrait-coords')).toHaveText('33.58560, -7.63390');
  await expect(page.getByTestId('loc-retrait-kept').getByRole('link')).toHaveAttribute('href', LIEN_PLACE);
  // La carte affiche l'épingle.
  await expect(page.getByTestId('loc-retrait-block').locator('.leaflet-marker-icon')).toHaveCount(1);

  await page.getByRole('button', { name: 'Continuer' }).click();

  // Étape 2 — livraison : erreurs explicites d'abord.
  await page.getByTestId('loc-livraison-input').fill('derrière la mosquée');
  await page.getByTestId('loc-livraison-locate').click();
  await expect(page.getByTestId('loc-livraison-error')).toContainText('Lien non reconnu');
  await page.getByTestId('loc-livraison-input').fill('https://bit.ly/3xYz');
  await page.getByTestId('loc-livraison-locate').click();
  await expect(page.getByTestId('loc-livraison-error')).toContainText('Lien refusé');

  // Puis des coordonnées brutes (bouton « Localiser »).
  await page.getByTestId('loc-livraison-input').fill('33.5731, -7.5898');
  await page.getByTestId('loc-livraison-locate').click();
  await expect(page.getByTestId('loc-livraison-error')).toHaveCount(0);
  await expect(page.getByTestId('loc-livraison-coords')).toHaveText('33.57310, -7.58980');
  // Deux épingles : le devis bascule sur la distance réelle estimée.
  await expect(page.getByTestId('wizard-distance')).toContainText('distance estimée entre les deux épingles');

  // Effacer puis recoller : le bouton d'effacement agit réellement.
  await page.getByTestId('loc-livraison-clear').click();
  await expect(page.getByTestId('loc-livraison-coords')).toHaveCount(0);
  await expect(page.getByTestId('wizard-distance')).toContainText('distance de ville à ville');
  await coller(page, 'loc-livraison-input', 'https://waze.com/ul?ll=33.5731%2C-7.5898&navigate=yes');
  await expect(page.getByTestId('loc-livraison-coords')).toHaveText('33.57310, -7.58980');

  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Créer la commande' }).click();

  // Fiche commande : carte des deux points + liens d'origine « Ouvrir dans Maps ».
  await expect(page).toHaveURL(/\/orders\/CMD-/);
  await expect(page.getByTestId('order-locations')).toBeVisible();
  await expect(page.getByTestId('open-maps-retrait')).toHaveAttribute('href', LIEN_PLACE);
  await expect(page.getByTestId('open-maps-livraison')).toHaveAttribute('href', 'https://waze.com/ul?ll=33.5731%2C-7.5898&navigate=yes');
  await expect(page.getByTestId('order-locations').locator('.leaflet-marker-icon')).toHaveCount(2);
});

test('assistant en arabe : bloc localisation traduit, sens RTL', async ({ page, context }) => {
  await login(page);
  await context.addCookies([{ name: 'lang', value: 'ar', url: BASE }]);
  await page.goto('/orders/new');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByPlaceholder('ألصقوا رابط الموقع (خرائط Google، واتساب، Waze…)')).toBeVisible();
  await coller(page, 'loc-retrait-input', 'https://maps.google.com/?q=33.5731,-7.5898');
  await expect(page.getByTestId('loc-retrait-kept')).toContainText('تم الاحتفاظ بالرابط');
});
