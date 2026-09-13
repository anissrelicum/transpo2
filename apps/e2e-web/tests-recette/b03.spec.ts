import { test, expect } from '@playwright/test';
import { loginTenant, shotVp } from './helpers';

// TC-B03 — Organisation inconnue.
// PAS : /login?org=inexistant → n'importe quel identifiant.
// ATT : EXACTEMENT la même réponse qu'un mot de passe faux — « Identifiants invalides. ».
// Le message d'avant (« Tenant inconnu : <slug> », 400) permettait d'énumérer les clients
// de la plateforme en comparant deux réponses (OBS-01) : le cas vérifie donc les DEUX
// réponses et leur égalité, pas seulement le libellé.
test('TC-B03 — organisation inconnue : réponse indistinguable d’un mot de passe faux', async ({ page }) => {
  test.setTimeout(120_000);
  const inconnue = await loginTenant(page, 'inexistant', 'nimporte@qui.ma', 'nimportequoi');
  console.log(`organisation inconnue → ${inconnue}`);
  await shotVp(page, 'TC-B03', '01-organisation-inconnue');
  expect(inconnue).toContain('Identifiants invalides');
  expect(inconnue).not.toContain('inexistant');
  expect(inconnue).not.toContain('Tenant');

  // Organisation RÉELLE, mot de passe faux : même message, à la lettre.
  const reelle = await loginTenant(page, 'rabatexpress', `sonde-b03-${Date.now().toString(36)}@rabatexpress.ma`, 'nimportequoi');
  console.log(`organisation réelle, mdp faux → ${reelle}`);
  await shotVp(page, 'TC-B03', '02-organisation-reelle-mdp-faux');
  expect(reelle?.trim()).toBe(inconnue?.trim());

  // Et le code HTTP ne doit pas trahir non plus ce que le message tait.
  const codes = await page.evaluate(async () => {
    const essai = async (tenant: string) => {
      const r = await fetch('/api/login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenant, email: 'sonde@qui.ma', password: 'x' }),
      });
      return r.status;
    };
    return { inconnue: await essai('inexistant'), reelle: await essai('rabatexpress') };
  });
  console.log(`codes HTTP → ${JSON.stringify(codes)}`);
  expect(codes.inconnue).toBe(codes.reelle);
  await shotVp(page, 'TC-B03', '03-memes-codes-http');
});
