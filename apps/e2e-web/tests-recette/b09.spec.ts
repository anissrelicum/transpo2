import { test, expect } from '@playwright/test';
import { loginTenant, nextAlert, shotVp } from './helpers';

// TC-B09 — Email invalide / doublon.
// PAS : inviter « pasunemail » ; puis réinviter dispatch@rabatexpress.ma.
// ATT : « Email invalide. » puis « Cet email est déjà utilisé. ».
test('TC-B09 — email invalide puis doublon', async ({ page }) => {
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await page.goto('/users');

  // 1. Email invalide : le formulaire bloque la soumission (bouton désactivé) ;
  //    le message « Email invalide. » est vérifié au niveau API.
  await page.getByRole('button', { name: 'Inviter' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByPlaceholder('Nom complet').fill('Test Invalide');
  await dlg.getByPlaceholder('prenom.nom@tenant.ma').fill('pasunemail');
  await expect(dlg.getByRole('button', { name: 'Inviter' })).toBeDisabled();
  await shotVp(page, 'TC-B09', '01-email-invalide-bouton-desactive');
  const apiRes = await page.request.post('/api/proxy/v1/users', {
    data: { email: 'pasunemail', name: 'Test Invalide', role: 'DISPATCHER' },
  });
  const apiBody = await apiRes.json().catch(() => null);
  console.log(`API invite email invalide → ${apiRes.status()} ${JSON.stringify(apiBody)}`);
  expect(apiRes.status()).toBe(400);
  expect(apiBody?.error).toContain('Email invalide');
  await dlg.getByRole('button', { name: 'Annuler' }).click();

  // 2. Doublon : réinviter dispatch@rabatexpress.ma → alerte « Cet email est déjà utilisé. ».
  await page.getByRole('button', { name: 'Inviter' }).click();
  await dlg.getByPlaceholder('Nom complet').fill('Doublon Dispatch');
  await dlg.getByPlaceholder('prenom.nom@tenant.ma').fill('dispatch@rabatexpress.ma');
  const alertMsg = nextAlert(page);
  await dlg.getByRole('button', { name: 'Inviter' }).click();
  const msg = await alertMsg;
  console.log(`doublon → ${msg}`);
  expect(msg).toContain('Cet email est déjà utilisé');
  await shotVp(page, 'TC-B09', '02-doublon-alerte-dialogue-ouvert');
});
