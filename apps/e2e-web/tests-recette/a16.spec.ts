import { test, expect } from '@playwright/test';
import { loginSaas, openPlanMenu, shotVp, sql } from './helpers';

// TC-A16 — Le prix est gelé pour les abonnés : sur Entreprise, publier une nouvelle version
// de tarif → l'ancienne se ferme la veille et CONSERVE ses abonnés, la nouvelle est courante
// avec 0 abonné.
//
// Les numéros de version et la date d'effet se calculent à partir de la DERNIÈRE version
// publiée, et non à partir du jour du run : le produit exige une date strictement
// postérieure à la version en place, si bien qu'un cas figé sur « demain » ne se rejouait
// qu'une seule fois.
test('TC-A16 — Prix gelé pour les abonnés', async ({ page }) => {
  test.setTimeout(180_000);
  const etat = sql(`
    SELECT max(pv.version), max(pv.effective_from)::text, count(s.id)
      FROM platform.plans p
      JOIN platform.plan_versions pv ON pv.plan_id = p.id
      LEFT JOIN platform.subscriptions s ON s.plan_version_id = pv.id AND s.ended_at IS NULL
     WHERE p.code = 'entreprise'`);
  const [vMaxTxt, dernierEffet, abonnesTxt] = etat.split(' | ');
  const vPrecedente = Number(vMaxTxt);
  const vNouvelle = vPrecedente + 1;
  const abonnes = Number(abonnesTxt);
  const lendemain = new Date(dernierEffet);
  lendemain.setUTCDate(lendemain.getUTCDate() + 1);
  const dateEffet = lendemain.toISOString().slice(0, 10);
  const veille = dernierEffet;
  const nouveauPrix = String(2599 + vNouvelle * 100);
  console.log(`v${vPrecedente} (${dernierEffet}, ${abonnes} abonné(s)) → v${vNouvelle} au ${dateEffet} à ${nouveauPrix} DH`);

  await loginSaas(page);
  await page.goto('/saas/plans');
  await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible();

  await openPlanMenu(page, 'entreprise');
  await page.getByRole('menuitem', { name: /Nouvelle version de tarif/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(new RegExp(`Les ${abonnes} abonné\\(s\\) actuels`))).toBeVisible();
  await shotVp(page, 'TC-A16', '01-dialogue-v2-abonnes-gardent-prix');

  await dialog.locator('input[type="date"]').fill(dateEffet); // lendemain de la version en place
  await dialog.locator('input[type="number"]').first().fill(nouveauPrix);
  await shotVp(page, 'TC-A16', '02-nouvelle-version-datee');

  await dialog.getByRole('button', { name: 'Publier le tarif' }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByRole('row', { name: /Entreprise/ })).toBeVisible({ timeout: 30_000 });

  // Historique des tarifs : v1 fermée à la veille, conserve 1 abonné ; v2 courante, 0 abonné.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible();
  await openPlanMenu(page, 'entreprise');
  await page.getByRole('menuitem', { name: /Historique des tarifs/ }).click();
  const histo = page.getByRole('dialog');
  await expect(histo.getByText(/Historique des tarifs — Entreprise/)).toBeVisible();
  // L'ancienne version est fermée la VEILLE de la nouvelle, et garde ses abonnés : c'est
  // exactement ce que « prix gelé » veut dire.
  const ancienne = histo.getByRole('row', { name: new RegExp(`^v${vPrecedente}\\b`) });
  await expect(ancienne).toContainText(`→ ${veille}`);
  await expect(ancienne).toContainText(String(abonnes));
  const nouvelle = histo.getByRole('row', { name: new RegExp(`^v${vNouvelle}\\b`) });
  await expect(nouvelle).toContainText('courante');
  await expect(nouvelle).toContainText(`${dateEffet} → …`);
  await expect(nouvelle).toContainText('0');
  await shotVp(page, 'TC-A16', '03-historique-ancienne-fermee-nouvelle-courante');
  await histo.getByRole('button', { name: 'Fermer' }).click();
});
