import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, sql, creerCommandes, motDePasse } from './helpers';

// TC-D11 — Retirer un chauffeur.
// PAS : créer un chauffeur jetable → Retirer. Puis sur un chauffeur PORTEUR de commandes
//       en cours : Retirer → désigner le repreneur → Transférer et retirer.
// ATT : sans commande en cours, retrait direct. Avec des commandes en cours, le retrait est
//       possible À CONDITION de désigner un repreneur : les courses EN COURS passent à son
//       nom, les courses CLÔTURÉES restent au nom du partant — l'historique dit qui a livré.
test('TC-D11 — retrait d’un chauffeur, avec transfert de ses courses', async ({ page }) => {
  test.setTimeout(150_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/drivers');
  const jetable = () => page.getByRole('row', { name: /Karim Jetable/ });

  // Pré-requis (hors périmètre) : effacer les figurants d'un run précédent.
  sql(`DELETE FROM tenant_rabatexpress.orders WHERE merchant='Transfert Test'`);
  sql(`DELETE FROM tenant_rabatexpress.drivers WHERE name IN ('Karim Jetable','Younes Partant','Sonde Sans Repreneur')`);
  await page.reload();
  const effectifInitial = Number(sql(`SELECT count(*) FROM tenant_rabatexpress.drivers`));
  console.log(`effectif de départ → ${effectifInitial}`);

  await page.getByRole('button', { name: 'Ajouter un chauffeur' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByPlaceholder('Youssef Benali').fill('Karim Jetable');
  await dlg.getByPlaceholder('+212600000000').fill('+212633333333');
  await dlg.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(jetable()).toBeVisible({ timeout: 15_000 });
  // Le nombre de DISPONIBLES dépend de TC-D10 (qui laisse Sara indisponible) : seul
  // l'effectif compte ici.
  await expect(page.getByText(new RegExp(`^${effectifInitial + 1} chauffeurs · `))).toBeVisible();
  await shotVp(page, 'TC-D11', '01-chauffeur-jetable-cree');

  await jetable().getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Retirer' }).click();
  const alerte = page.getByRole('alertdialog');
  await expect(alerte.getByRole('heading', { name: 'Retirer Karim Jetable ?' })).toBeVisible();
  // Sans course en cours, le dialogue dit simplement ce qui advient de l'historique.
  await expect(alerte.getByText(/Ses commandes clôturées restent à son nom/)).toBeVisible();
  await shotVp(page, 'TC-D11', '02-confirmation-retrait');
  const suppr = page.waitForResponse(
    (r) => r.url().includes('/v1/drivers/') && r.request().method() === 'DELETE',
  );
  await alerte.getByRole('button', { name: 'Retirer' }).click();
  console.log(`DELETE /v1/drivers/<Karim Jetable> → ${(await suppr).status()}`);

  await page.reload();
  await expect(jetable()).toHaveCount(0);
  await expect(page.getByText(new RegExp(`^${effectifInitial} chauffeurs · `))).toBeVisible();
  await shotVp(page, 'TC-D11', '03-jetable-retire');

  // --- Second volet : un chauffeur qui PORTE des courses en cours -----------------------
  // Décor : un chauffeur sur le départ, avec deux courses ouvertes et une clôturée.
  await page.goto('/orders');
  const refs = await creerCommandes(page, [
    { merchant: 'Transfert Test', toCity: 'Tanger' },
    { merchant: 'Transfert Test', toCity: 'Tanger' },
  ]);
  await page.goto('/drivers');
  await page.evaluate(async () => {
    await fetch('/api/proxy/v1/drivers', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Younes Partant', city: 'Rabat', phone: '+212677777777' }),
    });
  });
  await page.evaluate(async (rs) => {
    for (const r of rs) {
      await fetch(`/api/orders/${encodeURIComponent(r)}/assign`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ driver: 'Younes Partant' }),
      });
    }
  }, refs);
  // Une course déjà livrée à son nom : elle ne doit PAS changer de main.
  sql(`INSERT INTO tenant_rabatexpress.orders (ref, code, status, merchant, from_city, to_city, driver, cod, proof_level)
       VALUES ('CMD-HIST-D11', 'HISTD11X', 'LIVREE', 'Transfert Test', 'Rabat', 'Tanger', 'Younes Partant', 0, 'photo')
       ON CONFLICT (ref) DO UPDATE SET driver='Younes Partant', status='LIVREE'`);
  await page.reload();

  const partant = () => page.getByRole('row', { name: /Younes Partant/ });
  await expect(partant().getByText('2 en cours')).toBeVisible({ timeout: 15_000 });
  await shotVp(page, 'TC-D11', '04-chauffeur-porteur-de-courses');

  // Le dialogue annonce le nombre de courses et EXIGE un repreneur.
  await partant().getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Retirer' }).click();
  const alerteTransfert = page.getByRole('alertdialog');
  await expect(alerteTransfert.getByText(/2 commande\(s\) sont en cours/)).toBeVisible();
  const bouton = alerteTransfert.getByRole('button', { name: 'Transférer et retirer' });
  await expect(bouton).toBeDisabled();
  await shotVp(page, 'TC-D11', '05-repreneur-exige');

  await alerteTransfert.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Hamid Ouali' }).click();
  await expect(bouton).toBeEnabled();
  await bouton.click();
  await page.waitForTimeout(1500);
  await page.reload();

  // Le partant a disparu, ses courses EN COURS ont changé de main.
  await expect(partant()).toHaveCount(0);
  const transferees = sql(
    `SELECT count(*) FROM tenant_rabatexpress.orders WHERE merchant='Transfert Test' AND status='ASSIGNEE' AND driver='Hamid Ouali'`,
  );
  console.log(`courses transférées à Hamid Ouali → ${transferees}`);
  expect(Number(transferees)).toBe(2);

  // La course CLÔTURÉE reste au nom de celui qui l'a livrée.
  const historique = sql(`SELECT driver FROM tenant_rabatexpress.orders WHERE ref='CMD-HIST-D11'`);
  console.log(`course livrée → toujours au nom de « ${historique} »`);
  expect(historique).toBe('Younes Partant');
  await shotVp(page, 'TC-D11', '06-courses-transferees');

  // Sans repreneur, l'API refuse : on ne laisse pas des colis sans porteur.
  const sansRepreneur = await page.evaluate(async () => {
    const j = { 'content-type': 'application/json' };
    const d = await (await fetch('/api/proxy/v1/drivers', {
      method: 'POST', headers: j,
      body: JSON.stringify({ name: 'Sonde Sans Repreneur', city: 'Rabat' }),
    })).json();
    const o = await (await fetch('/api/orders', {
      method: 'POST', headers: j,
      body: JSON.stringify({ merchant: 'Transfert Test', fromCity: 'Rabat', toCity: 'Salé' }),
    })).json();
    await fetch(`/api/orders/${encodeURIComponent(o.ref)}/assign`, {
      method: 'POST', headers: j, body: JSON.stringify({ driver: 'Sonde Sans Repreneur' }),
    });
    const res = await fetch(`/api/proxy/v1/drivers/${d.id}`, { method: 'DELETE' });
    return { status: res.status, body: await res.json().catch(() => null), id: d.id, ref: o.ref };
  });
  console.log(`retrait sans repreneur → ${sansRepreneur.status} ${JSON.stringify(sansRepreneur.body)}`);
  expect(sansRepreneur.status).toBe(400);
  expect(JSON.stringify(sansRepreneur.body)).toContain('Transférez-les');
  await shotVp(page, 'TC-D11', '07-refus-sans-repreneur');

  // Nettoyage du décor de ce volet.
  await page.evaluate(async ({ id, ref }) => {
    await fetch(`/api/orders/${encodeURIComponent(ref)}/cancel`, { method: 'POST' });
    await fetch(`/api/proxy/v1/drivers/${id}`, { method: 'DELETE' });
  }, sansRepreneur);
  sql(`DELETE FROM tenant_rabatexpress.orders WHERE merchant='Transfert Test'`);
});
