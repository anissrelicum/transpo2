import { test, expect } from '@playwright/test';
import { loginTenant, logout, shotVp, saveCredential, nextAlert } from './helpers';

// Retest BUG-B1 (ex-TC-B07/B11) — bouton « Copier » du dialogue de mot de passe temporaire
// en contexte HTTP : navigator.clipboard indisponible → repli execCommand('copy') OU alerte
// explicite ; jamais d'échec silencieux (TypeError non rattrapé, icône figée).

test('Retest BUG-B1 — Copier en HTTP : repli execCommand ou alerte explicite', async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await page.goto('/users');

  // Réinitialisation du mdp dispatcher → dialogue « Mot de passe temporaire ».
  const row = page.getByRole('row', { name: /dispatch@rabatexpress\.ma/ });
  await row.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Réinitialiser le mot de passe' }).click();
  const reveal = page.getByRole('dialog').filter({ hasText: 'ne sera plus affiché' });
  await expect(reveal.getByText('Mot de passe temporaire')).toBeVisible({ timeout: 15_000 });
  await expect(reveal.getByText('Reda Ziani')).toBeVisible();
  const pwd = ((await reveal.locator('[style*="code-font"]').first().textContent()) ?? '').trim();
  expect(pwd.length).toBeGreaterThan(8);
  await shotVp(page, 'TC-B11', 'retest-01-dialogue-mdp-temporaire');

  // Contexte HTTP : confirmer que navigator.clipboard est bien indisponible.
  const clipboardApi = await page.evaluate(() => typeof navigator.clipboard?.writeText === 'function');
  console.log(`navigator.clipboard.writeText disponible = ${clipboardApi}`);

  // Espion sur le repli : trace execCommand('copy') + valeur effectivement copiée.
  await page.evaluate(() => {
    (window as any).__copy = { called: false, ok: null, value: null };
    const orig = document.execCommand.bind(document);
    document.execCommand = (cmd: string, ...a: unknown[]) => {
      if (cmd === 'copy') {
        const ta = document.querySelector('textarea[readonly]') as HTMLTextAreaElement | null;
        (window as any).__copy = { called: true, ok: null, value: ta ? ta.value : null };
      }
      const r = orig(cmd as never, ...(a as never[]));
      if (cmd === 'copy') (window as any).__copy.ok = r;
      return r;
    };
  });

  // Clic Copier : soit alerte explicite, soit feedback ✓ (repli execCommand réussi).
  const alertP = nextAlert(page).catch(() => null);
  await reveal.getByRole('button').first().click();
  const alertMsg = await Promise.race([alertP, page.waitForTimeout(2500).then(() => null)]);
  const trace = await page.evaluate(() => (window as any).__copy);
  await shotVp(page, 'TC-B11', 'retest-02-apres-clic-copier');

  // Vérification presse-papier si l'API existe (ne doit pas échouer le test en HTTP).
  const clipContent = clipboardApi
    ? await page.evaluate(() => navigator.clipboard.readText()).catch(() => '(lecture refusée)')
    : '(API indisponible en HTTP)';
  console.log(`alerte=${alertMsg} trace=${JSON.stringify(trace)} presse-papiers=${clipContent}`);
  console.log(`pageErrors=${JSON.stringify(pageErrors)}`);

  if (alertMsg !== null) {
    // Voie 2 : échec de copie mais alerte explicite (pas de silence).
    expect(alertMsg).toContain('Copie impossible');
    console.log('BUG-B1 corrigé via alerte explicite.');
  } else {
    // Voie 1 : repli execCommand a copié le bon mot de passe + feedback ✓.
    expect(trace.called, 'repli execCommand non déclenché et aucune alerte : échec silencieux').toBe(true);
    expect(trace.ok, 'execCommand(\'copy\') a renvoyé false sans alerte').toBe(true);
    expect(trace.value, 'valeur copiée ≠ mot de passe affiché').toBe(pwd);
    console.log('BUG-B1 corrigé via repli execCommand + feedback ✓.');
  }

  // Jamais d'échec silencieux : aucune erreur JS liée au presse-papier.
  const clipErrors = [...pageErrors, ...consoleErrors].filter((e) => /clipboard|writeText|Cannot read propert/i.test(e));
  expect(clipErrors, `erreurs console/page liées au clipboard : ${clipErrors.join(' | ')}`).toEqual([]);

  saveCredential(`TC-B11 retest rabatexpress DISPATCHER dispatch@rabatexpress.ma tempPassword=${pwd}`);
  await reveal.getByRole('button', { name: 'Fermer' }).click();
  await logout(page, 'Nadia Alaoui');
});
