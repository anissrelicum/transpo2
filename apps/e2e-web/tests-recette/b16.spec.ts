import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-B16 — Le comptage anti-bruteforce est partagé et compte aussi par source.
// PAS : épuiser le quota sur une adresse, redémarrer l'API, réessayer ; puis enchaîner des
//       échecs sur des adresses toutes différentes depuis la même machine.
// ATT : après redémarrage le blocage TIENT (compteur en base, pas en mémoire du processus),
//       et le balayage d'adresses finit par être freiné à son tour (OBS-02).
test('TC-B16 — compteur d’échecs durable et comptage par source', async ({ page }) => {
  test.setTimeout(300_000);
  const email = `brute-b16-${Date.now().toString(36)}@rabatexpress.ma`;

  // 1. Épuiser le quota du compte (5 échecs), la 6ᵉ tentative est refusée en 429.
  for (let i = 1; i <= 6; i++) {
    const err = await loginTenant(page, 'rabatexpress', email, `mauvais-${i}`);
    if (i <= 5) expect(err).toContain('Identifiants invalides');
    else expect(err).toContain('Trop de tentatives');
  }
  await shotVp(page, 'TC-B16', '01-quota-du-compte-epuise');

  // Le compteur est bien EN BASE, partagé par toutes les répliques.
  const enBase = sql(`SELECT count FROM platform.login_attempts WHERE key = 'u:rabatexpress:${email}'`);
  console.log(`compteur en base pour ${email} → ${enBase}`);
  expect(Number(enBase)).toBeGreaterThanOrEqual(5);

  // 2. Redémarrage de l'API : un compteur en mémoire repartait de zéro ici.
  sql('SELECT 1'); // garde-fou : la connexion kubectl fonctionne avant de redémarrer.
  await page.waitForTimeout(500);
  const { execSync } = await import('node:child_process');
  execSync('kubectl rollout restart deployment/transpo-api -n transpo', { encoding: 'utf-8' });
  execSync('kubectl rollout status deployment/transpo-api -n transpo --timeout=180s', { encoding: 'utf-8' });
  console.log('API redémarrée');

  // Le service peut encore router vers l'ancien pod pendant quelques secondes : on attend
  // une réponse applicative (et non une erreur de passerelle) avant de conclure.
  let apres: string | null = null;
  for (let i = 0; i < 10; i++) {
    apres = await loginTenant(page, 'rabatexpress', email, 'encore-mauvais');
    if (apres && /Trop de tentatives|Identifiants invalides/.test(apres)) break;
    console.log(`(API pas encore stable : « ${apres} »)`);
    await page.waitForTimeout(3000);
  }
  console.log(`après redémarrage → ${apres}`);
  expect(apres).toContain('Trop de tentatives');
  await shotVp(page, 'TC-B16', '02-blocage-survit-au-redemarrage');

  // 3. Password spraying : des adresses toutes différentes, depuis la même machine.
  //
  // Ce que ce volet vérifie a CHANGÉ le 14/09, et le changement est le constat lui-même.
  // Il attendait qu'un balayage soit freiné « par source ». Or derrière l'ingress, l'adresse
  // du client n'arrive pas jusqu'à l'API : elle retombait sur celle d'un pod du cluster, la
  // même pour tout le monde. Le compteur « par source » était donc un compteur UNIQUE et
  // PARTAGÉ, et le voir freiner était une mauvaise nouvelle déguisée en bonne : trente
  // mauvais mots de passe, venus de n'importe qui, refusaient la connexion à TOUS les
  // utilisateurs pendant quinze minutes.
  //
  // Le produit ne compte plus par source quand la source n'est pas identifiable. Ce cas
  // vérifie désormais la propriété qui compte : un balayage n'enferme PAS les comptes
  // légitimes.
  const marque = Date.now().toString(36);
  let freine = 0;
  for (let i = 1; i <= 32; i++) {
    const err = await loginTenant(page, 'rabatexpress', `spray-${marque}-${i}@rabatexpress.ma`, 'Test1234');
    if (err?.includes('Trop de tentatives')) { freine = i; break; }
  }
  console.log(`balayage freiné à la tentative n°${freine} (0 = jamais freiné, attendu ici)`);
  await shotVp(page, 'TC-B16', '03-balayage-sans-verrouillage-collectif');

  // Aucune clé de source ne doit avoir été créée : l'adresse du pod n'est pas une source.
  const parSource = sql(`SELECT count(*) FROM platform.login_attempts WHERE key LIKE 'ip:%'`);
  console.log(`clés « ip: » en base → ${parSource} (0 = la source n'est pas identifiable ici)`);
  expect(Number(parSource)).toBe(0);

  // Et le compte légitime, lui, se connecte toujours : le balayage n'a verrouillé personne.
  // C'est le contraire exact de ce qui se passait avant, où ce cas laissait la plateforme
  // inaccessible pour un quart d'heure — y compris à la suite de la recette.
  const ok = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(ok).toBeNull();
  await shotVp(page, 'TC-B16', '04-run-debloque');
});
