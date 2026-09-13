import { test, expect } from '@playwright/test';
import { loginSaas, loginTenant, logout, shotVp, sql } from './helpers';

// TC-A29 — Créer / réinitialiser l'administrateur d'une organisation existante.
//
// Le cas se joue sur `tangerlog` et NON sur `rabatexpress` : l'endpoint regénère un mot de
// passe aléatoire, et le réinitialiser sur `admin@rabatexpress.ma` invaliderait le `Test1234`
// du §0.4 dont dépendent toutes les autres specs du run.
// PAS : /saas → menu d'une organisation → Créer / réinitialiser l'administrateur, d'abord
//       sur une adresse inconnue, puis sur l'administrateur existant.
// ATT : mot de passe temporaire affiché une seule fois, connexion aboutie, action tracée
//       au journal d'audit. C'est la sortie du trou AN-11 : une organisation sans admin
//       actif se récupère depuis la console, sans accès shell à la production.
test('TC-A29 — administrateur d’une organisation existante créé puis réinitialisé', async ({ page }) => {
  test.setTimeout(240_000);
  await loginSaas(page);

  async function reinitialiser(slug: string, nom: string, email: string): Promise<string> {
    await page.goto('/saas');
    const ligne = page.getByRole('row', { name: new RegExp(slug) });
    await ligne.getByRole('button').last().click();
    await page.getByRole('menuitem', { name: 'Créer / réinitialiser l’administrateur' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByPlaceholder('Nadia Alaoui').fill(nom);
    await dlg.getByPlaceholder(/admin@/).fill(email);
    await dlg.getByRole('button', { name: 'Enregistrer' }).click();
    const reveal = page.getByRole('dialog').filter({ hasText: 'ne sera plus affiché' });
    await expect(reveal.getByRole('heading', { name: 'Compte administrateur créé' })).toBeVisible({ timeout: 20_000 });
    await expect(reveal.getByText(`${nom} (${email})`)).toBeVisible();
    const mdp = ((await reveal.locator('[style*="code-font"]').first().textContent()) ?? '').trim();
    await page.keyboard.press('Escape');
    // Non-régression AN-13 sur la console PLATEFORME : l'action passe par un dialogue
    // ouvert depuis le menu « … » d'une ligne, exactement le motif qui figeait la page.
    await page.waitForTimeout(1500);
    const etat = await page.evaluate(() => ({
      pointerEvents: getComputedStyle(document.body).pointerEvents,
      scrollLocked: document.body.hasAttribute('data-scroll-locked'),
      ariaHiddenRacine: document.querySelector('.radix-themes')?.getAttribute('aria-hidden') === 'true',
      menusOuverts: document.querySelectorAll('[role="menu"]').length,
    }));
    console.log(`état de /saas après l'action → ${JSON.stringify(etat)}`);
    expect(etat.pointerEvents, 'la console plateforme doit rester cliquable').not.toBe('none');
    expect(etat.scrollLocked).toBe(false);
    expect(etat.ariaHiddenRacine).toBe(false);
    expect(etat.menusOuverts, 'le menu « … » ne doit pas survivre au dialogue').toBe(0);
    return mdp;
  }

  // 1. Adresse INCONNUE de l'organisation : un administrateur est créé.
  const emailNeuf = `secours-${Date.now().toString(36)}@tangerlog.ma`;
  const mdpNeuf = await reinitialiser('tangerlog', 'Admin de secours', emailNeuf);
  console.log(`admin créé → ${emailNeuf}`);
  expect(mdpNeuf.length).toBeGreaterThan(8);
  await shotVp(page, 'TC-A29', '01-admin-cree-mot-de-passe-affiche');

  // Le mot de passe n'est pas réaffiché : il n'existe plus nulle part dans la console.
  await page.reload();
  await expect(page.getByText(mdpNeuf)).toHaveCount(0);
  await shotVp(page, 'TC-A29', '02-mot-de-passe-non-reaffiche');

  // 2. Il ouvre bien la console de l'organisation, avec le rôle Administrateur.
  await logout(page);
  let err = await loginTenant(page, 'tangerlog', emailNeuf, mdpNeuf);
  expect(err).toBeNull();
  await expect(page.getByText('Administrateur').first()).toBeVisible();
  await shotVp(page, 'TC-A29', '03-connexion-admin-de-secours');
  await logout(page, 'Admin de secours');

  // 3. Adresse DÉJÀ administratrice : le compte est réinitialisé, pas dupliqué.
  await loginSaas(page);
  const mdpReset = await reinitialiser('tangerlog', 'Admin de secours', emailNeuf);
  console.log(`admin réinitialisé → ${emailNeuf}`);
  await shotVp(page, 'TC-A29', '04-admin-existant-reinitialise');
  const comptes = sql(`SELECT count(*) FROM tenant_tangerlog.users WHERE email='${emailNeuf}'`);
  expect(Number(comptes)).toBe(1);

  // L'ancien mot de passe ne vaut plus, le nouveau ouvre la console.
  await logout(page);
  err = await loginTenant(page, 'tangerlog', emailNeuf, mdpNeuf);
  expect(err).toContain('Identifiants invalides');
  err = await loginTenant(page, 'tangerlog', emailNeuf, mdpReset);
  expect(err).toBeNull();
  await shotVp(page, 'TC-A29', '05-nouveau-mot-de-passe-accepte');

  // 4. Les deux actions sont tracées au journal d'audit.
  const trace = sql(
    `SELECT action FROM platform.audit_log WHERE action IN ('tenant.admin.create','tenant.admin.reset') ORDER BY at DESC LIMIT 2`,
  );
  console.log(`journal d'audit → ${trace.replace(/\n/g, ' | ')}`);
  expect(trace).toContain('tenant.admin.create');
  expect(trace).toContain('tenant.admin.reset');

  // Le jeu de données §0.4 est intact : `admin@rabatexpress.ma` / `Test1234` n'a pas été touché.
  await logout(page, 'Admin de secours');
  const refMaintenue = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(refMaintenue).toBeNull();
  await shotVp(page, 'TC-A29', '06-jeu-de-donnees-intact');
});
