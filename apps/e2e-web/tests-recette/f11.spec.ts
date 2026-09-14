import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, sql, creerCommandes, motDePasse } from './helpers';

// TC-F11 — Fiche commande.
// PAS : ouvrir /orders/<ref> → onglets Détails, Preuve de livraison, Historique,
//       Facturation ; cliquer l'icône copier du code.
// ATT : onglets fonctionnels ; historique HORODATÉ cohérent avec les transitions faites ;
//       code copié (icône ✓).
test('TC-F11 — fiche commande : onglets, historique, copie du code', async ({ page }) => {
  test.setTimeout(180_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();

  // Le cas se fabrique une commande qui a VÉCU : créée, affectée, puis avancée jusqu'à la
  // livraison en cours. Les commandes antérieures au journal des transitions n'en ont pas,
  // et le journal ne se réécrit pas rétroactivement — c'est le prix d'un vrai historique.
  await page.goto('/orders');
  const [ref] = await creerCommandes(page, [{ merchant: 'Fiche Test', toCity: 'Tanger', cod: 300 }]);
  await page.evaluate(async (r) => {
    const appel = (action: string, body: unknown = {}) => fetch(`/api/orders/${encodeURIComponent(r)}/${action}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    await appel('assign', { driver: 'Hamid Ouali' });
    await appel('advance');
    await appel('advance');
    await appel('advance');
  }, ref);
  console.log(`fiche ouverte → ${ref}`);
  expect(sql(`SELECT status FROM tenant_rabatexpress.orders WHERE ref='${ref}'`)).toBe('LIVRAISON');
  await page.goto(`/orders/${ref}`);
  await expect(page.getByRole('heading', { name: ref })).toBeVisible();
  await shotVp(page, 'TC-F11', '01-onglet-details');

  // Détails : les coordonnées des deux points sont restituées.
  await expect(page.getByText('Retrait', { exact: true })).toBeVisible();
  await expect(page.getByText('Livraison', { exact: true })).toBeVisible();
  await expect(page.getByText('Colis', { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: 'Preuve de livraison' }).click();
  await shotVp(page, 'TC-F11', '02-onglet-preuve');

  // Historique : une entrée par transition RÉELLEMENT faite, chacune horodatée.
  await page.getByRole('tab', { name: 'Historique' }).click();
  const lignes = page.getByTestId('order-event');
  await expect(lignes.first()).toBeVisible({ timeout: 15_000 });
  const nb = await lignes.count();
  const texte = await lignes.allInnerTexts();
  console.log(`historique → ${nb} entrée(s) :\n${texte.join('\n')}`);
  // Création → ASSIGNEE → RETRAIT → RECUPEREE → LIVRAISON : cinq faits enregistrés.
  expect(nb).toBe(5);
  // Le premier fait est la création, le dernier l'état courant.
  expect(texte[0]).toContain('Commande créée');
  expect(texte.at(-1)).toContain('En route (livraison)');
  // Chaque fait porte son auteur : un litige se tranche sur qui a fait quoi, et quand.
  for (const t of texte) expect(t).toContain('admin@rabatexpress.ma');
  // Chaque entrée porte une date et une heure, pas seulement un libellé d'étape.
  for (const t of texte) expect(t).toMatch(/\d{2}\/\d{2}\/\d{4}.*\d{2}:\d{2}/);
  await shotVp(page, 'TC-F11', '03-onglet-historique');

  await page.getByRole('tab', { name: 'Facturation' }).click();
  await expect(page.getByText('Commission (15 %)')).toBeVisible();
  await expect(page.getByText('Total TTC')).toBeVisible();
  await shotVp(page, 'TC-F11', '04-onglet-facturation');

  // Copie du code de suivi : le retour visuel ne doit pas mentir. Le homelab est servi en
  // HTTP — hors contexte sécurisé, `navigator.clipboard` est indisponible et le produit
  // doit retomber sur la méthode de repli plutôt qu'afficher un faux succès.
  // Deux chemins mènent au presse-papiers selon le contexte : `navigator.clipboard` en
  // contexte sécurisé (localhost, HTTPS), le repli `execCommand` sinon — et seul le
  // second émet un évènement `copy`. Guetter l'évènement faisait donc échouer le cas en
  // local alors que le produit copiait bien. On constate le RÉSULTAT : ce qu'il y a dans
  // le presse-papiers, ou à défaut l'évènement.
  const code = sql(`SELECT code FROM tenant_rabatexpress.orders WHERE ref='${ref}'`).trim();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await page.evaluate(async () => {
    (window as any).__copie = null;
    document.addEventListener('copy', () => { (window as any).__copie = true; }, { once: true });
    await navigator.clipboard?.writeText('').catch(() => {});
  });
  await page.getByRole('button', { name: /Copier le code/ }).click();
  await page.waitForTimeout(800);
  const constat = await page.evaluate(async () => ({
    evenement: (window as any).__copie,
    contenu: await navigator.clipboard?.readText().catch(() => null),
  }));
  console.log(`code ${code} · presse-papiers « ${constat.contenu} » · évènement ${constat.evenement}`);
  expect(constat.contenu === code || constat.evenement === true,
    'le retour vert doit correspondre à une copie réelle').toBe(true);
  await shotVp(page, 'TC-F11', '05-code-copie');
});
