import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, isoPlus } from './helpers';

// TC-D21 — Aucune action de la flotte ne fige la console (non-régression AN-13).
// PAS : enchaîner sans jamais recharger — rattacher, renouveler, modifier une fiche,
//       changer un état.
// ATT : après CHAQUE enregistrement, la page reste cliquable (pointer-events rendu, verrou
//       de défilement levé, racine non aria-hidden) et la donnée est à jour.
//
// Le défaut ne se voyait pas à l'œil : la donnée s'affichait correctement, mais plus rien
// n'était cliquable. C'est donc l'état du document qu'on mesure, pas seulement l'affichage.
type Etat = { pointerEvents: string; scrollLocked: boolean; ariaHiddenRacine: boolean };

test('TC-D21 — la console reste vivante après chaque action de la flotte', async ({ page }) => {
  test.setTimeout(180_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();

  async function etat(): Promise<Etat> {
    // Deux tours de boucle d'affichage : le rafraîchissement est volontairement différé.
    await page.waitForTimeout(2500);
    return page.evaluate(() => ({
      pointerEvents: getComputedStyle(document.body).pointerEvents,
      scrollLocked: document.body.hasAttribute('data-scroll-locked'),
      ariaHiddenRacine: document.querySelector('.radix-themes')?.getAttribute('aria-hidden') === 'true',
    }));
  }
  const releves: Record<string, Etat> = {};
  async function verifier(action: string) {
    const e = await etat();
    releves[action] = e;
    expect(e.pointerEvents, `${action} : la page doit rester cliquable`).not.toBe('none');
    expect(e.scrollLocked, `${action} : le verrou de défilement doit être levé`).toBe(false);
    expect(e.ariaHiddenRacine, `${action} : la racine ne doit pas rester aria-hidden`).toBe(false);
  }

  await page.goto('/drivers');
  const hamid = () => page.getByRole('row', { name: /Hamid Ouali/ });

  // 1. Rattacher un véhicule.
  await hamid().getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Rattacher un véhicule' }).click();
  let dlg = page.getByRole('dialog');
  await dlg.getByRole('combobox').click();
  await page.getByRole('option', { name: /1111-A-11/ }).click();
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  await verifier('rattacher un véhicule');
  await expect(hamid().getByText('1111-A-11')).toBeVisible();
  await shotVp(page, 'TC-D21', '01-apres-rattachement');

  // 2. Renouveler une échéance — SANS recharger entre les deux actions.
  await hamid().getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Renouveler le permis' }).click();
  dlg = page.getByRole('dialog');
  await dlg.locator('input[type="date"]').fill(isoPlus(730));
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  await verifier('renouveler une échéance');
  await shotVp(page, 'TC-D21', '02-apres-renouvellement');

  // 3. Modifier la fiche — toujours sans recharger.
  await hamid().getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Modifier la fiche' }).click();
  dlg = page.getByRole('dialog');
  await dlg.getByRole('combobox').nth(0).click();
  await page.getByRole('option', { name: 'Rabat', exact: true }).click();
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  await verifier('modifier la fiche');
  await shotVp(page, 'TC-D21', '03-apres-modification');

  // 4. Changer l'état d'un véhicule, même enchaînement.
  await page.goto('/vehicles');
  const v = page.getByRole('row', { name: /2222-B-22/ });
  await v.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Mettre en maintenance' }).click();
  await verifier('changer l’état d’un véhicule');
  await expect(v.getByText('Maintenance', { exact: true })).toBeVisible();
  await v.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Réactiver' }).click();
  await verifier('réactiver un véhicule');
  await shotVp(page, 'TC-D21', '04-apres-changements-etat');

  // 5. Preuve d'interactivité réelle, sans rechargement : on ouvre le menu d'une AUTRE
  // ligne, puis le menu avatar. Un premier clic peut servir à refermer le menu « … » resté
  // ouvert derrière le dialogue — ce qui ne bloque rien, contrairement au gel.
  const autreLigne = page.getByRole('row', { name: /1111-A-11/ });
  await autreLigne.getByRole('button').last().click();
  await expect(page.getByRole('menuitem', { name: 'Mettre en maintenance' })).toBeVisible();
  await page.keyboard.press('Escape');
  const avatar = page.locator('div[aria-haspopup="menu"]').filter({ hasText: 'Nadia Alaoui' });
  await avatar.click();
  if (!(await page.getByRole('menuitem', { name: 'Se déconnecter' }).count())) await avatar.click();
  await expect(page.getByRole('menuitem', { name: 'Se déconnecter' })).toBeVisible();
  await page.keyboard.press('Escape');
  console.log(`RELEVÉS → ${JSON.stringify(releves)}`);
  await shotVp(page, 'TC-D21', '05-menu-encore-cliquable');
});
