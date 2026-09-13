import * as fs from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { COMPTES, loginSaas, loginTenant, nextAlert, shotVp, sql, saveCredential } from './helpers';

// TC-A28 — Cohérence statut d'abonnement / accès : pour chacun des 5 statuts, comparer la
// colonne Abonnement et la connexion au tenant.
// ATT : Essai et Actif → connexion OK ; Impayé → connexion OK (relance, pas coupure) ;
// Suspendu et Résilié → connexion refusée.
// État requis : tangerlog ESSAI, rabatexpress ACTIF, atlasfret RÉSILIE (acquis A01–A27) ;
// sont provisionnés ici : demoimpaye (IMPAYE) et demosuspendu (SUSPENDU).

const subStatus = (slug: string) =>
  sql(`SELECT COALESCE(s.status,'AUCUN') FROM platform.tenants t
       LEFT JOIN platform.subscriptions s ON s.tenant_id = t.id AND s.ended_at IS NULL
       WHERE t.slug='${slug}'`);

function savedPassword(slug: string): string | null {
  if (!fs.existsSync(COMPTES)) return null;
  const line = fs.readFileSync(COMPTES, 'utf-8').split('\n').find((l) => l.includes(`${slug} ADMIN`));
  return line ? (/tempPassword=(\S+)/.exec(line)?.[1] ?? null) : null;
}

/**
 * Prépare une organisation de démonstration et renvoie un mot de passe admin utilisable.
 * Si elle existe déjà (run précédent) mais que son mot de passe n'est plus connu, on le
 * régénère par l'action « Créer / réinitialiser l'administrateur » — celle-là même que
 * TC-A29 a fait ajouter : c'est ce qui rend ce cas rejouable.
 */
async function provision(page: Page, slug: string, name: string, adminEmail: string): Promise<string> {
  const existe = sql(`SELECT slug FROM platform.tenants WHERE slug='${slug}'`);
  if (existe) {
    const mdp = await page.evaluate(async ({ slug, adminEmail }) => {
      const r = await fetch(`/api/proxy/v1/saas/tenants/${slug}/admin`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, name: 'Admin Démo' }),
      });
      const d = await r.json().catch(() => null);
      return d?.admin?.tempPassword ?? '';
    }, { slug, adminEmail });
    expect(mdp.length).toBeGreaterThan(8);
    saveCredential(`TC-A28 ${slug} ADMIN ${adminEmail} tempPassword=${mdp}`);
    return mdp;
  }
  await page.getByRole('button', { name: 'Provisionner' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('rabatexpress', { exact: true }).fill(slug);
  await dialog.getByPlaceholder('Rabat Express').fill(name);
  await dialog.getByPlaceholder('Youssef Tazi').fill('Admin Démo');
  await dialog.getByPlaceholder('admin@rabatexpress.ma').fill(adminEmail);
  await dialog.getByRole('button', { name: 'Provisionner' }).click();
  const reveal = page.getByRole('dialog');
  await expect(reveal.getByText('Compte administrateur créé')).toBeVisible({ timeout: 20_000 });
  const pwd = (await reveal.locator('[style*="code-font"]').first().textContent())?.trim() ?? '';
  saveCredential(`TC-A28 ${slug} ADMIN ${adminEmail} tempPassword=${pwd}`);
  await reveal.getByRole('button', { name: 'Fermer' }).click();
  return pwd;
}

test('TC-A28 — Cohérence statut / accès (5 statuts)', async ({ page }) => {
  test.setTimeout(300_000);
  await loginSaas(page);

  // 1. Préparer IMPAYE et SUSPENDU (idempotent en cas de re-run).
  let pwdImpaye = savedPassword('demoimpaye');
  if (!pwdImpaye || sql(`SELECT slug FROM platform.tenants WHERE slug='demoimpaye'`)) {
    pwdImpaye = await provision(page, 'demoimpaye', 'Démo Impayé', 'admin@demoimpaye.ma');
  }
  let pwdSuspendu = savedPassword('demosuspendu');
  if (!pwdSuspendu || sql(`SELECT slug FROM platform.tenants WHERE slug='demosuspendu'`)) {
    pwdSuspendu = await provision(page, 'demosuspendu', 'Démo Suspendu', 'admin@demosuspendu.ma');
  }

  const cycle = async () => {
    const alertMsg = nextAlert(page);
    await page.getByRole('button', { name: 'Lancer le cycle' }).click();
    const msg = await alertMsg;
    console.log(`cycle → ${msg.replace(/\n/g, ' | ')}`);
    await page.reload();
    await expect(page.getByRole('row', { name: /demoimpaye/ })).toBeVisible({ timeout: 30_000 });
    return msg;
  };

  if (subStatus('demoimpaye') === 'ESSAI' || subStatus('demosuspendu') === 'ESSAI') {
    sql(`UPDATE platform.subscriptions SET trial_ends_at = current_date - 1
         WHERE tenant_id IN (SELECT id FROM platform.tenants WHERE slug IN ('demoimpaye','demosuspendu'))
           AND ended_at IS NULL AND status = 'ESSAI'`);
    await cycle();
  }
  if (subStatus('demosuspendu') === 'IMPAYE') {
    sql(`UPDATE platform.subscriptions SET past_due_since = current_date - 8
         WHERE tenant_id = (SELECT id FROM platform.tenants WHERE slug='demosuspendu') AND ended_at IS NULL`);
    await cycle();
  }

  // 2. Les 5 statuts présents dans la colonne Abonnement.
  expect(subStatus('tangerlog')).toBe('ESSAI');
  expect(subStatus('rabatexpress')).toBe('ACTIF');
  expect(subStatus('demoimpaye')).toBe('IMPAYE');
  expect(subStatus('demosuspendu')).toBe('SUSPENDU');
  expect(subStatus('atlasfret')).toBe('AUCUN'); // résilié : plus d'abonnement courant
  await expect(page.getByRole('row', { name: /tangerlog/ }).getByText('Essai', { exact: true })).toBeVisible();
  await expect(page.getByRole('row', { name: /rabatexpress/ }).getByText('Actif', { exact: true })).toBeVisible();
  await expect(page.getByRole('row', { name: /demoimpaye/ }).getByText('Impayé', { exact: true })).toBeVisible();
  await expect(page.getByRole('row', { name: /demosuspendu/ }).getByText('Suspendu', { exact: true })).toBeVisible();
  await expect(page.getByRole('row', { name: /atlasfret/ }).getByText('Aucun abonnement')).toBeVisible();
  await shotVp(page, 'TC-A28', '01-cinq-statuts-dans-la-liste');

  // 3. Connexion au tenant pour chaque statut.
  //
  // Les mots de passe ne sont plus repris d'un run précédent : ils sont REGÉNÉRÉS ici, par
  // l'action « Créer / réinitialiser l'administrateur ». Sans cela, le cas dépendait de
  // lignes de COMPTES.md écrites des jours plus tôt, que d'autres cas avaient pu invalider
  // — et il « passait » alors pour la mauvaise raison : un refus de connexion dû à un mot
  // de passe périmé, et non au statut d'abonnement testé.
  const regenerer = (slug: string, email: string) => page.evaluate(async ({ slug, email }) => {
    const r = await fetch(`/api/proxy/v1/saas/tenants/${slug}/admin`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, name: 'Admin Recette' }),
    });
    const d = await r.json().catch(() => null);
    return d?.admin?.tempPassword ?? '';
  }, { slug, email });

  const cas: Array<[string, string, string, string, boolean]> = [
    ['ESSAI', 'tangerlog', 'admin@tangerlog.ma', await regenerer('tangerlog', 'admin@tangerlog.ma'), true],
    ['ACTIF', 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234', true],
    ['IMPAYE', 'demoimpaye', 'admin@demoimpaye.ma', pwdImpaye, true],
    ['SUSPENDU', 'demosuspendu', 'admin@demosuspendu.ma', pwdSuspendu, false],
    ['RÉSILIE', 'atlasfret', 'admin@atlasfret.ma', await regenerer('atlasfret', 'admin@atlasfret.ma'), false],
  ];
  // Un refus doit venir du STATUT, pas d'un mot de passe faux : on l'exige non vide.
  for (const [statut, slug, , pwd] of cas) {
    expect(pwd.length, `${statut} ${slug} : mot de passe de test manquant`).toBeGreaterThan(4);
  }
  let i = 2;
  for (const [statut, slug, email, pwd, attendu] of cas) {
    const err = await loginTenant(page, slug, email, pwd);
    console.log(`${statut} ${slug} → ${err === null ? 'connexion OK' : `refusée (${err})`}`);
    expect(err === null).toBe(attendu);
    await shotVp(page, 'TC-A28', `0${i}-connexion-${slug}-${attendu ? 'ok' : 'refusee'}`);
    i++;
  }
});
