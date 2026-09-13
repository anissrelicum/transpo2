import { test, expect } from '@playwright/test';
import { loginTenant, shotVp } from './helpers';

// TC-B04 — Anti-bruteforce.
// PAS : sur /login?org=rabatexpress, 6 tentatives avec un mauvais mot de passe.
// ATT : les 5 premières → « Identifiants invalides » ; la 6ᵉ → 429 « Trop de tentatives.
// Réessayez plus tard. »
// Note : email dédié jetable (compteur keyé tenant+email, blocage 15 min) — l'email admin
// n'est pas touché. L'email porte un suffixe unique par run : le compteur vit en mémoire
// du processus API (cf. OBS-02) et un email fixe resterait bloqué d'un run sur l'autre,
// rendant le cas injouable deux fois de suite.
test('TC-B04 — anti-bruteforce (6 tentatives)', async ({ page }) => {
  test.setTimeout(120_000);
  const email = `brute-b04-${Date.now().toString(36)}@rabatexpress.ma`;
  for (let i = 1; i <= 6; i++) {
    const err = await loginTenant(page, 'rabatexpress', email, `mauvais-mdp-${i}`);
    console.log(`tentative ${i} → ${err}`);
    if (i <= 5) expect(err).toContain('Identifiants invalides');
    else {
      expect(err).toContain('Trop de tentatives');
      await shotVp(page, 'TC-B04', '02-sixieme-tentative-429');
    }
    if (i === 5) await shotVp(page, 'TC-B04', '01-cinquieme-identifiants-invalides');
  }
});
