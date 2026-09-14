// Helpers de recette section A — homelab K8s.
// Les captures partent dans qa/recette/<run>/TC-XXX/ (conventions qa/README.md).
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';

export const RUN = process.env.RUN_ID || '2026-09-12-homelab';
export const QA_DIR = path.resolve(__dirname, `../../../qa/recette/${RUN}`);
export const COMPTES = path.join(QA_DIR, 'COMPTES.md');

/**
 * Date ISO décalée de `n` jours (UTC). Les specs du run 07/09 codaient les dates
 * en dur (« 2026-09-09 »), ce qui les rendait injouables le lendemain : toute
 * date attendue se calcule désormais à partir du jour d'exécution.
 */
export function isoPlus(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function shotDir(tc: string): string {
  const dir = path.join(QA_DIR, tc);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Marqueur d'étape incrusté dans la vidéo (remplace les captures PNG du run 07/09).
 * Affiche « TC-A03 — 02 provisionner rabatexpress » en bas de l'écran et marque une
 * pause pour que l'étape soit lisible à la lecture. Signature identique à l'ancien
 * `shot()` : les 64 specs existantes n'ont pas à changer.
 */
export async function step(page: Page, tc: string, name: string) {
  const libelle = `${tc}  ·  ${name.replace(/-/g, ' ')}`;
  await page
    .evaluate((t) => {
      let el = document.getElementById('__recette__');
      if (!el) {
        el = document.createElement('div');
        el.id = '__recette__';
        el.style.cssText =
          'position:fixed;left:16px;bottom:16px;z-index:2147483647;pointer-events:none;' +
          'background:#6F259F;color:#fff;border-radius:8px;padding:10px 16px;' +
          'font:600 15px/1.3 Inter,system-ui,-apple-system,sans-serif;letter-spacing:.01em;' +
          'box-shadow:0 4px 16px rgba(0,0,0,.3)';
        document.body.appendChild(el);
      }
      el.textContent = t;
    }, libelle)
    .catch(() => {});
  await page.waitForTimeout(900);
}

/** Compat run 07/09 : `shot`/`shotVp` ne produisent plus de PNG mais un repère vidéo. */
export const shot = step;
export const shotVp = step;

/**
 * Attend qu'une ligne de tenant affiche `texte`, en rechargeant la page.
 * Le cycle d'abonnement (« Lancer le cycle ») écrit en base puis `router.refresh()` ;
 * un `page.reload()` immédiat peut encore rendre l'état d'avant. On recharge jusqu'à
 * convergence plutôt que d'attendre sur un DOM figé.
 * Ligne ciblée par locator DOM (et non par rôle) à cause du défaut AN-12.
 */
export async function attendreLigne(page: Page, slug: string, texte: string, timeout = 45_000) {
  const ligne = () => page.locator('tr', { hasText: slug }).first();
  await expect
    .poll(async () => {
      const t = await ligne().innerText().catch(() => '');
      if (t.includes(texte)) return true;
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      return (await ligne().innerText().catch(() => '')).includes(texte);
    }, { timeout, intervals: [1000, 2000, 3000, 3000, 5000] })
    .toBe(true);
  return ligne();
}

/** Connexion super-admin → /saas. */
export async function loginSaas(page: Page) {
  await page.goto('/login?realm=saas');
  await page.locator('input[name="email"]').fill('ops@transpo.ma');
  await page.locator('input[name="password"]').fill('transpo');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/saas**', { timeout: 45_000 });
  await expect(page.getByRole('heading', { name: 'Organisations' })).toBeVisible();
}

/** Connexion tenant via ?org=<slug>. Retourne le message d'erreur éventuel. */
export async function loginTenant(page: Page, slug: string, email: string, password: string): Promise<string | null> {
  await page.goto(`/login?org=${slug}`);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  // Course entre la redirection et le message d'erreur : un cas qui attend un refus
  // (B04 enchaine 6 tentatives) ne doit pas payer le delai complet a chaque essai.
  // La page de connexion rend en permanence un conteneur [role="alert"] vide : seule
  // une alerte PORTANT DU TEXTE signale un refus, sinon la course conclurait a tort
  // a un echec des l'affichage du formulaire.
  const alertBox = page.locator('[role="alert"]');
  const alerteRemplie = alertBox.filter({ hasText: /\S/ }).first();
  // Un compte MARCHAND n'atterrit pas sur /dashboard mais sur son portail : n'attendre
  // que le tableau de bord d'exploitation faisait passer une connexion réussie pour un
  // refus, au bout de 30 s d'attente et sans le moindre message d'erreur à montrer.
  const ok = await Promise.race([
    page.waitForURL(/\/(dashboard|portail)/, { timeout: 30_000 }).then(() => true),
    alerteRemplie.waitFor({ state: 'visible', timeout: 30_000 }).then(() => false),
  ]).catch(() => false);
  if (ok) return null;
  if (!(await alertBox.count())) return 'pas de message affiche';
  // Le conteneur d'alerte apparait avant d'etre rempli : on attend un texte non vide.
  let texte = '';
  for (let i = 0; i < 20 && !texte.trim(); i++) {
    texte = (await alertBox.first().textContent()) ?? '';
    if (!texte.trim()) await page.waitForTimeout(250);
  }
  return texte;
}

/**
 * Detecte le gel d'interface AN-12 et le leve par un rechargement.
 * Apres une mutation qui ferme son dialogue sans attendre la fin de l'appel
 * (UsersView.tsx:158, SaasTenantsView.tsx:358), Radix ne restaure ni
 * `pointer-events`, ni le verrou de defilement, ni `aria-hidden` : la page est
 * entierement non cliquable jusqu'au rechargement. Renvoie true si le gel etait la.
 */
export async function leverGelAN12(page: Page): Promise<boolean> {
  const gele = await page
    .evaluate(() => getComputedStyle(document.body).pointerEvents === 'none')
    .catch(() => false);
  if (gele) {
    console.log('AN-12 : interface figee apres mutation — rechargement necessaire');
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
  }
  return gele;
}

/**
 * Déconnexion → retour /login.
 * La console plateforme n'a pas de menu avatar mais un bouton « Quitter » (SaasNav) :
 * on le prend s'il est là, sinon on passe par le menu avatar de la console transport.
 */
export async function logout(page: Page, name?: string) {
  // `inviteUser` rend le mot de passe révélé SANS refermer son dialogue (TC-B07 et TC-B08
  // en inspectent le contenu). Un cas qui invite puis se déconnecte laissait donc un modal
  // ouvert : le clic sur l'avatar était intercepté et la déconnexion expirait au bout de
  // 20 s, sans rapport avec la règle testée (TC-L07 et TC-Q05, homelab 14/09).
  // Un dialogue déjà en train de se fermer (le cas vient de cliquer « Fermer », Radix
  // joue sa sortie) disparaît tout seul : on lui laisse une seconde avant d'insister,
  // sinon le clic tombait sur un bouton en cours de détachement — TC-B11, 14/09.
  const modal = page.getByRole('dialog');
  if (await modal.count()) {
    await expect(modal).toHaveCount(0, { timeout: 1_000 }).catch(() => undefined);
  }
  if (await modal.count()) {
    const fermer = modal.getByRole('button', { name: 'Fermer' });
    if (await fermer.count()) await fermer.first().click().catch(() => undefined);
    else await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 10_000 });
  }
  await leverGelAN12(page);
  const quitter = page.getByRole('button', { name: 'Quitter' });
  if (await quitter.count()) {
    await quitter.click();
    await page.waitForURL('**/login**', { timeout: 15_000 });
    return;
  }
  const cible = () => (name
    ? page.locator('div[aria-haspopup="menu"]').filter({ hasText: name })
    : page.locator('[aria-haspopup="menu"]').first());
  // La matrice RBAC (B15) laisse la page sur un ecran d'acces refuse, qui n'a pas de
  // barre superieure : on revient sur une page applicative avant de deconnecter.
  if (!(await cible().count())) {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await leverGelAN12(page);
  }
  await cible().click();
  await page.getByRole('menuitem', { name: 'Se déconnecter' }).click();
  await page.waitForURL('**/login**', { timeout: 15_000 });
}

/** Invite un utilisateur depuis /users ; retourne le mot de passe temporaire affiché. */
export async function inviteUser(page: Page, name: string, email: string, roleLabel?: string): Promise<string> {
  await page.getByRole('button', { name: 'Inviter' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByPlaceholder('Nom complet').fill(name);
  await dlg.getByPlaceholder('prenom.nom@tenant.ma').fill(email);
  if (roleLabel) {
    await dlg.getByRole('combobox').click();
    await page.getByRole('option', { name: roleLabel }).click();
  }
  await dlg.getByRole('button', { name: 'Inviter' }).click();
  const reveal = page.getByRole('dialog').filter({ hasText: 'ne sera plus affiché' });
  await expect(reveal.getByText('Mot de passe temporaire')).toBeVisible({ timeout: 15_000 });
  await expect(reveal.getByText(`${name} (${email})`)).toBeVisible();
  return ((await reveal.locator('[style*="code-font"]').first().textContent()) ?? '').trim();
}

/**
 * Lit le mot de passe temporaire révélé par un dialogue de provisioning / d'invitation.
 *
 * Il est tiré de `randomBytes(9).toString('base64url')` : douze caractères de l'alphabet
 * base64url, tiret et SOULIGNÉ compris. Les cas le récupéraient avec un motif qui oubliait
 * le souligné — un mot de passe sur quatre était donc consigné tronqué dans COMPTES.md, et
 * le cas qui s'y connectait plus tard échouait sur « Identifiants invalides » (TC-A23 et
 * TC-A24 le 14/09, pour un secret coupé à « ojn2baZ »).
 */
export async function lireMotDePasseRevele(reveal: Locator): Promise<string> {
  const texte = ((await reveal.locator('code, [style*="code-font"]').first().textContent()) ?? '').trim();
  const m = /^[A-Za-z0-9_-]{12}$/.exec(texte);
  if (!m) throw new Error(`mot de passe temporaire illisible : « ${texte} »`);
  return texte;
}

/** Ouvre le menu « … » de la ligne d'un tenant sur /saas. */
export async function openTenantMenu(page: Page, slug: string) {
  const row = page.getByRole('row', { name: new RegExp(slug) });
  await row.getByRole('button').last().click();
}

/** Ouvre le menu « … » de la ligne d'un plan sur /saas/plans. */
export async function openPlanMenu(page: Page, code: string) {
  const row = page.getByRole('row', { name: new RegExp(code) });
  await row.getByRole('button').last().click();
}

/** Écoute le prochain window.alert et renvoie son message. */
export function nextAlert(page: Page): Promise<string> {
  return new Promise((resolve) => {
    page.once('dialog', async (d) => { const m = d.message(); await d.accept(); resolve(m); });
  });
}

/** SQL arbitraire sur la base du homelab (préparation/vérification hors périmètre UI). */
export function sql(query: string): string {
  const b64 = Buffer.from(query).toString('base64');
  // L'accès à la base dépend de l'environnement de recette : `kubectl exec` sur le homelab,
  // `docker exec` sur un poste local. Le coder en dur rendait TOUTE la suite injouable dès
  // que le cluster était éteint — ce qui est arrivé le 13/09.
  const exec = process.env.PG_EXEC || 'kubectl exec -n transpo deploy/postgres --';
  return execSync(
    `${exec} sh -c 'echo ${b64} | base64 -d | psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -F" | "'`,
    { encoding: 'utf-8' },
  ).trim();
}

/**
 * Mot de passe temporaire d'un compte, relu depuis COMPTES.md (dernière occurrence).
 * Les specs du run 07/09 codaient le mot de passe en dur : après un reset de base le
 * tenant est reprovisionné avec un nouveau secret et le cas échouait — ou pire,
 * passait pour la mauvaise raison quand il attendait un refus de connexion.
 */
export function motDePasse(email: string): string {
  const lignes = fs.existsSync(COMPTES) ? fs.readFileSync(COMPTES, 'utf-8').split('\n') : [];
  const match = lignes.filter((l) => l.includes(email)).pop();
  const mdp = match?.match(/tempPassword=(\S+)/)?.[1];
  if (!mdp) throw new Error(`Aucun mot de passe consigné pour ${email} dans ${COMPTES}`);
  return mdp;
}

/**
 * Pose un compte par le CLI `account` de @transpo/db (contournement documenté §0.3).
 *
 * L'accès au CLI dépend de l'environnement, comme pour `sql()` : en local il tourne sur le
 * poste, sur le homelab il faut entrer dans le pod API. Le coder en dur pour le homelab
 * rendait TC-B02 injouable en local — et inversement.
 */
export function compteCli(tenant: string, email: string, nom: string, role: string, motDePasse: string): string {
  const args = `${tenant} ${email} '${nom}' ${role} ${motDePasse}`;
  // Le jeton %ARGS% est obligatoire dès que la commande enveloppe le CLI (`sh -c "…"` dans
  // le pod du homelab) : collés en queue, les arguments sortaient des guillemets et le CLI
  // était appelé à vide.
  const base = process.env.ACCOUNT_EXEC || 'pnpm --filter @transpo/db account';
  const cmd = base.includes('%ARGS%') ? base.replace('%ARGS%', args) : `${base} ${args}`;
  return execSync(cmd, { encoding: 'utf-8' }).trim();
}

/** Consigne un identifiant temporaire capturé (utile aux sections suivantes). */
export function saveCredential(line: string) {
  fs.appendFileSync(COMPTES, line + '\n');
}

/**
 * Remet le parc et l'effectif à zéro (hors périmètre UI).
 *
 * TC-D01 et TC-D06 partent d'une liste vide : sans cette remise à plat, ils n'étaient
 * jouables qu'une seule fois, juste après la réinitialisation de la base. Le détachement
 * précède la suppression, le retrait d'un véhicule rattaché étant désormais refusé (AN-15).
 * `page` doit déjà être connectée en administrateur du tenant.
 */
export async function viderFlotte(page: Page): Promise<void> {
  sql(`UPDATE tenant_rabatexpress.orders SET driver = NULL
        WHERE status IN ('NOUVELLE','ASSIGNEE','RETRAIT','RECUPEREE','LIVRAISON')`);
  await page.evaluate(async () => {
    const lire = async (url: string) => {
      const d = await (await fetch(url)).json();
      return Array.isArray(d) ? d : d.items ?? [];
    };
    for (const d of await lire('/api/proxy/v1/drivers')) {
      if (d.vehicleId) {
        await fetch(`/api/proxy/v1/drivers/${d.id}/vehicle`, {
          method: 'PATCH', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ vehicleId: null }),
        });
      }
    }
    for (const v of await lire('/api/proxy/v1/vehicles')) {
      await fetch(`/api/proxy/v1/vehicles/${v.id}`, { method: 'DELETE' });
    }
    for (const d of await lire('/api/proxy/v1/drivers')) {
      await fetch(`/api/proxy/v1/drivers/${d.id}`, { method: 'DELETE' });
    }
  });
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
}

/** Une commande créée par l'API, pour poser un décor sans rejouer tout l'assistant. */
export type Fixture = {
  merchant?: string; fromCity?: string; toCity?: string; cod?: number;
  proofLevel?: string; size?: string; dropContact?: string;
};

/**
 * Crée `n` commandes via l'API depuis la page courante (session de la page).
 * L'assistant est couvert par TC-F01/F02 ; partout ailleurs, les commandes ne sont qu'un
 * décor et les faire naître à l'écran coûterait des minutes sans rien prouver de plus.
 * Retourne les références créées, dans l'ordre.
 */
export async function creerCommandes(page: Page, fixtures: Fixture[]): Promise<string[]> {
  return page.evaluate(async (fs) => {
    const refs: string[] = [];
    for (const f of fs) {
      const r = await fetch('/api/orders', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          merchant: f.merchant ?? 'Boutique Test',
          fromCity: f.fromCity ?? 'Rabat',
          toCity: f.toCity ?? 'Casablanca',
          cod: f.cod ?? 0,
          size: f.size ?? 'Moyen',
          proofLevel: f.proofLevel ?? 'photo_signature',
          dropContact: f.dropContact ?? 'Client Test',
          dropAddress: '1 rue de la Recette',
        }),
      });
      const o = await r.json();
      refs.push(o.ref);
    }
    return refs;
  }, fixtures);
}

/**
 * Joue une livraison COMPLÈTE dans la peau du livreur (API terrain) et rend la référence.
 *
 * Les sections caisse, fraude et pilotage ont besoin de livraisons réelles — encaissement
 * compris — sans dépendre de l'émulateur Android : le parcours mobile lui-même est tenu
 * par la section G. On emprunte donc le MÊME chemin que l'app (assigner, avancer, preuve),
 * jamais un `UPDATE` qui fabriquerait un état que le produit ne sait pas produire.
 */
export async function livrerCommeLivreur(
  page: Page,
  options: { cod?: number; driver?: string; codCollected?: number } = {},
): Promise<{ ref: string; code: string; cod: number }> {
  const cod = options.cod ?? 300;
  const driver = options.driver ?? 'Hamid Ouali';
  const [ref] = await creerCommandes(page, [{ cod, proofLevel: 'aucune', toCity: 'Casablanca' }]);
  await page.evaluate(async ([r, d]) => {
    await fetch(`/api/proxy/v1/orders/${r}/assign`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ driver: d }),
    });
  }, [ref, driver] as const);

  // Les appels au terrain partent du CONTEXTE NODE, pas de la page : l'API est sur un autre
  // port que la console, et un `fetch` depuis le navigateur y est refusé par la politique
  // d'origine (« Failed to fetch »). Le proxy de la console, lui, ne porte pas le jeton du
  // livreur — d'où l'appel direct, authentifié ici.
  const jeton = await jetonLivreur(page);
  const API = process.env.API_URL || 'http://localhost:3000';
  const entetes = { 'content-type': 'application/json', 'x-tenant-slug': 'rabatexpress',
                    authorization: `Bearer ${jeton}` };
  for (const _ of [1, 2, 3]) {
    await page.request.post(`${API}/v1/driver/orders/${ref}/advance`, {
      headers: { ...entetes, 'idempotency-key': `${ref}:advance:${Date.now()}:${Math.random()}` },
      data: {},
    });
  }
  await page.request.post(`${API}/v1/driver/orders/${ref}/proof`, {
    headers: { ...entetes, 'idempotency-key': `${ref}:proof:${Date.now()}` },
    data: { codCollected: options.codCollected ?? cod },
  });

  const code = sql(`SELECT code FROM tenant_rabatexpress.orders WHERE ref = '${ref}'`).trim();
  return { ref, code, cod };
}

/** Jeton du compte livreur — obtenu côté Node, jamais depuis la page. */
export async function jetonLivreur(page: Page): Promise<string> {
  const API = process.env.API_URL || 'http://localhost:3000';
  const r = await page.request.post(`${API}/v1/auth/login`, {
    headers: { 'content-type': 'application/json', 'x-tenant-slug': 'rabatexpress' },
    data: { email: 'livreur@rabatexpress.ma', password: motDePasse('livreur@rabatexpress.ma') },
  });
  if (!r.ok()) throw new Error(`connexion livreur impossible (${r.status()})`);
  return (await r.json()).token as string;
}

/**
 * Déclare un ÉCHEC de livraison depuis le terrain, comme le ferait l'app (TC-G10), et
 * rend la référence. Sert de décor aux sections retours et pilotage.
 */
export async function echouerCommeLivreur(
  page: Page,
  options: { cod?: number; reason?: string; driver?: string } = {},
): Promise<{ ref: string; reason: string }> {
  const cod = options.cod ?? 300;
  const driver = options.driver ?? 'Hamid Ouali';
  const reason = options.reason ?? 'Destinataire absent — deux passages sans réponse';
  const [ref] = await creerCommandes(page, [{ cod, proofLevel: 'aucune', toCity: 'Salé' }]);
  await page.evaluate(async ([r, d]) => {
    await fetch(`/api/proxy/v1/orders/${r}/assign`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ driver: d }),
    });
  }, [ref, driver] as const);

  const jeton = await jetonLivreur(page);
  const API = process.env.API_URL || 'http://localhost:3000';
  const entetes = { 'content-type': 'application/json', 'x-tenant-slug': 'rabatexpress',
                    authorization: `Bearer ${jeton}` };
  for (const _ of [1, 2, 3]) {
    await page.request.post(`${API}/v1/driver/orders/${ref}/advance`, {
      headers: { ...entetes, 'idempotency-key': `${ref}:advance:${Date.now()}:${Math.random()}` },
      data: {},
    });
  }
  await page.request.post(`${API}/v1/driver/orders/${ref}/fail`, {
    headers: { ...entetes, 'idempotency-key': `${ref}:fail:${Date.now()}` },
    data: { reason },
  });
  return { ref, reason };
}

/** Vide le carnet de commandes du tenant (hors périmètre UI, pour rejouer un cas). */
export async function viderCommandes(page: Page): Promise<void> {
  sql('DELETE FROM tenant_rabatexpress.orders');
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Supprime un tenant de recette : schéma + ligne de plateforme + abonnements.
 *
 * Les cas de provisionnement (TC-A03 → A06) ne peuvent pas se rejouer sur `rabatexpress` :
 * il faudrait le détruire pour le recréer, et avec lui tout le jeu de données construit par
 * les sections C à F. Ils travaillent donc sur des slugs JETABLES, créés et supprimés dans
 * le cas lui-même. Écart au §0.4 du plan, assumé et consigné : ce qui est prouvé, c'est que
 * le provisionnement fonctionne — pas qu'il a fonctionné pour un slug particulier.
 */
export function supprimerTenant(slug: string): void {
  const id = sql(`SELECT id FROM platform.tenants WHERE slug = '${slug}'`);
  if (!id) return;
  sql(`DELETE FROM platform.subscriptions WHERE tenant_id = '${id}'`);
  sql(`DELETE FROM platform.tenants WHERE slug = '${slug}'`);
  sql(`DROP SCHEMA IF EXISTS tenant_${slug} CASCADE`);
}

/** Nombre d'organisations enregistrées sur la plateforme. */
export function nbTenants(): number {
  return Number(sql('SELECT count(*) FROM platform.tenants'));
}

/**
 * Vide l'effectif de chauffeurs (hors périmètre UI).
 *
 * Un chauffeur porteur de courses en cours n'est plus supprimable sans repreneur (règle
 * posée en TC-D11) : la remise à plat détache donc d'abord les commandes ouvertes. C'est
 * volontairement fait en base — le cas testé est ailleurs, et passer par l'UI ferait jouer
 * une règle métier à un endroit où elle n'est pas le sujet.
 */
export async function viderEffectif(page: Page): Promise<void> {
  sql(`UPDATE tenant_rabatexpress.orders SET driver = NULL
        WHERE status IN ('NOUVELLE','ASSIGNEE','RETRAIT','RECUPEREE','LIVRAISON')`);
  await page.evaluate(async () => {
    const r = await fetch('/api/proxy/v1/drivers');
    const d = await r.json();
    for (const x of (Array.isArray(d) ? d : d.items ?? [])) {
      if (x.vehicleId) {
        await fetch(`/api/proxy/v1/drivers/${x.id}/vehicle`, {
          method: 'PATCH', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ vehicleId: null }),
        });
      }
      await fetch(`/api/proxy/v1/drivers/${x.id}`, { method: 'DELETE' });
    }
  });
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
}
