import { test, expect } from '@playwright/test';
import { loginTenant, shotVp } from './helpers';

// TC-B01 — Un tenant provisionné n'a aucun compte.
// PAS : /login?org=rabatexpress → admin@rabatexpress.ma / n'importe quoi → Se connecter.
// ATT : « Identifiants invalides ». Consigner AN-01 (§3).
// Note : rabatexpress a déjà un admin (créé au provisioning, correctif AN-01) → on teste
// l'intention du cas avec un email inexistant (personne@rabatexpress.ma) : aucun identifiant
// ne doit passer sur un compte non amorcé.
test('TC-B01 — identifiants invalides sur compte non amorcé', async ({ page }) => {
  const err = await loginTenant(page, 'rabatexpress', 'personne@rabatexpress.ma', 'nimportequoi');
  console.log(`TC-B01 erreur affichée → ${err}`);
  await shotVp(page, 'TC-B01', '01-identifiants-invalides');
  expect(err).toContain('Identifiants invalides');
});
