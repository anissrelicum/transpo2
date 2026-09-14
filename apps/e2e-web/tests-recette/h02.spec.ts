import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-H02 — Code invalide au hub.
// ATT : bouton désactivé à 7 caractères ; erreur explicite pour un code inconnu de 8.
test('TC-H02 — code colis invalide ou inconnu', async ({ page }) => {
  test.setTimeout(120_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();

  await page.goto('/hub');
  await expect(page.getByRole('heading', { name: 'Tri en hub' })).toBeVisible();

  const champ = page.getByPlaceholder(/Scanner ou saisir un code colis/);
  const bouton = page.getByRole('button', { name: 'Enregistrer l’entrée' });

  // Sept caractères : ni badge « Prêt », ni action possible.
  await champ.fill('ABC1234');
  await expect(bouton).toBeDisabled();
  await expect(page.getByText('Prêt', { exact: true })).toHaveCount(0);
  await shotVp(page, 'TC-H02', '01-sept-caracteres');

  // Huit caractères inconnus : l'action s'ouvre — c'est le serveur qui tranche, et il doit
  // le dire clairement plutôt que de laisser l'agent devant un écran inchangé.
  await champ.fill('ZZ99ZZ99');
  await expect(bouton).toBeEnabled();
  const message = new Promise<string>((r) => page.once('dialog', async (d) => { const m = d.message(); await d.accept(); r(m); }));
  await bouton.click();
  const texte = await message;
  console.log(`  code inconnu → « ${texte} »`);
  expect(texte).toMatch(/inconnu/i);
  await shotVp(page, 'TC-H02', '02-code-inconnu-refuse');

  // Rien n'est entré au hub.
  const dansLeHub = sql(`SELECT count(*) FROM tenant_rabatexpress.orders WHERE code = 'ZZ99ZZ99'`);
  expect(dansLeHub.trim()).toBe('0');
});
