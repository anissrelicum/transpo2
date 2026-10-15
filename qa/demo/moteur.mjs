// Moteur des vidéos de démo Transpo.
//
// Un chapitre = un script qui pilote un vrai navigateur sur l'environnement publié, et dit
// sa narration phrase par phrase (`dire`). Chaque phrase est synthétisée par Deepgram
// (voix française), et le moteur ne garde au montage QUE les intervalles où l'on parle ou
// montre une action : les temps de chargement entre deux écrans sont coupés.
//
//   DEEPGRAM_API_KEY=… node qa/demo/chapitres/01-vitrine.mjs
//
// Sortie : qa/demo/sortie/<chapitre>.mp4 (+ .srt). Rien de binaire n'est versionné.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';

const RACINE = path.resolve(import.meta.dirname, '../..');
const require = createRequire(path.join(RACINE, 'apps/e2e-web/package.json'));
const { chromium } = require('@playwright/test');

export const SORTIE = path.join(RACINE, 'qa/demo/sortie');
export const WEB = process.env.WEB_URL || 'http://app.wedowonders.com';
export const VITRINE = process.env.VITRINE_URL || 'http://transpo.wedowonders.com';
export const API = process.env.API_URL || 'http://transpo-api.wedowonders.com';
const VOIX = process.env.DEMO_VOIX || 'aura-2-agathe-fr';
const LARGEUR = 1440, HAUTEUR = 900;

// Comptes du transporteur de démo, écrits par amorcer-demo.mjs ({ tenant, comptes: [...] }).
// DEMO_COMPTES permet de répéter un chapitre sur un autre tenant déjà amorcé.
export function jeu() {
  const f = process.env.DEMO_COMPTES || path.join(SORTIE, 'comptes.json');
  if (!fs.existsSync(f)) throw new Error(`comptes introuvables : ${f} — lancer amorcer-demo.mjs`);
  return JSON.parse(fs.readFileSync(f, 'utf-8'));
}
export function compte(predicat) {
  const c = jeu().comptes.find(predicat);
  if (!c) throw new Error('compte de démo introuvable');
  return c;
}

function duree(fichier) {
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'csv=p=0', fichier], { encoding: 'utf-8' }).trim());
}

/** Synthèse Deepgram, mise en cache par (voix, texte) : rejouer un chapitre ne repaie rien. */
export async function voix(texte) {
  const dossier = path.join(SORTIE, 'voix');
  fs.mkdirSync(dossier, { recursive: true });
  const f = path.join(dossier, `${createHash('sha1').update(VOIX + texte).digest('hex')}.mp3`);
  if (!fs.existsSync(f)) {
    const cle = process.env.DEEPGRAM_API_KEY;
    if (!cle) throw new Error('DEEPGRAM_API_KEY manquante');
    const r = await fetch(`https://api.deepgram.com/v1/speak?model=${VOIX}&encoding=mp3`, {
      method: 'POST',
      headers: { authorization: `Token ${cle}`, 'content-type': 'application/json' },
      body: JSON.stringify({ text: texte }),
    });
    if (!r.ok) throw new Error(`Deepgram ${r.status} : ${await r.text()}`);
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  }
  return { fichier: f, duree: duree(f) };
}

// Curseur visible + bandeau de chapitre : la vidéo Playwright ne montre pas la souris.
const DECOR = (chapitre) => `
(() => {
  const poser = () => {
    if (document.getElementById('__demo_curseur')) return;
    const c = document.createElement('div');
    c.id = '__demo_curseur';
    c.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;width:22px;height:22px;' +
      'margin:-3px 0 0 -3px;transition:transform .12s ease;' +
      'background:url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'22\\' height=\\'22\\'><path d=\\'M3 2l14 8-6 1.6L8 18z\\' fill=\\'#111\\' stroke=\\'#fff\\' stroke-width=\\'1.6\\' stroke-linejoin=\\'round\\'/></svg>') + '") no-repeat';
    const p = JSON.parse(sessionStorage.getItem('__demo_pos') || '[720,450]');
    c.style.left = p[0] + 'px'; c.style.top = p[1] + 'px';
    document.documentElement.appendChild(c);
    addEventListener('mousemove', (e) => {
      c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px';
      sessionStorage.setItem('__demo_pos', JSON.stringify([e.clientX, e.clientY]));
    }, true);
    addEventListener('mousedown', (e) => {
      c.style.transform = 'scale(.8)';
      const o = document.createElement('div');
      o.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;border-radius:50%;' +
        'width:36px;height:36px;margin:-18px 0 0 -18px;border:3px solid #3E63DD;opacity:.9;' +
        'left:' + e.clientX + 'px;top:' + e.clientY + 'px;transition:all .45s ease-out';
      document.documentElement.appendChild(o);
      requestAnimationFrame(() => { o.style.transform = 'scale(1.8)'; o.style.opacity = '0'; });
      setTimeout(() => o.remove(), 500);
    }, true);
    addEventListener('mouseup', () => { c.style.transform = ''; }, true);
    ${chapitre ? `
    const b = document.createElement('div');
    b.id = '__demo_chapitre';
    b.textContent = ${JSON.stringify(chapitre)};
    b.style.cssText = 'position:fixed;right:18px;bottom:16px;z-index:2147483645;pointer-events:none;' +
      'background:rgba(17,24,39,.78);color:#fff;border-radius:999px;padding:7px 14px;' +
      'font:600 13px/1 Inter,system-ui,sans-serif;letter-spacing:.02em;direction:ltr;unicode-bidi:isolate';
    document.documentElement.appendChild(b);` : ''}
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', poser); else poser();
})();`;

export class Tournage {
  constructor(nom, { chapitre, viewport } = {}) {
    this.nom = nom;
    this.chapitre = chapitre;
    this.viewport = viewport || { width: LARGEUR, height: HAUTEUR };
    this.segments = [];
  }

  async ouvrir() {
    this.brut = path.join(SORTIE, 'brut', this.nom);
    fs.rmSync(this.brut, { recursive: true, force: true });
    this.images = path.join(this.brut, 'images');
    fs.mkdirSync(this.images, { recursive: true });
    this.navigateur = await chromium.launch();
    this.contexte = await this.navigateur.newContext({
      viewport: this.viewport, deviceScaleFactor: 1, locale: 'fr-FR',
    });
    await this.contexte.addInitScript(DECOR(this.chapitre));
    this.page = await this.contexte.newPage();
    // Capture par screencast CDP plutôt que la vidéo Playwright : chaque image porte l'heure
    // réelle de son rendu. Sous charge, la vidéo Playwright s'étirait de 3 à 8 % par rapport
    // à l'horloge du script, et les coupes du montage tombaient jusqu'à 7 s à côté de la voix.
    this.trames = [];
    this.cdp = await this.contexte.newCDPSession(this.page);
    this.cdp.on('Page.screencastFrame', (f) => {
      const fichier = path.join(this.images, `${String(this.trames.length).padStart(6, '0')}.jpg`);
      fs.writeFileSync(fichier, Buffer.from(f.data, 'base64'));
      this.trames.push({ t: f.metadata.timestamp * 1000, fichier });
      this.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    await this.cdp.send('Page.startScreencast', {
      format: 'jpeg', quality: 90, maxWidth: this.viewport.width, maxHeight: this.viewport.height, everyNthFrame: 1,
    });
    this.t0 = Date.now();
    return this.page;
  }

  maintenant() { return (Date.now() - this.t0) / 1000; }

  /** Navigation hors montage : le chargement sera coupé. */
  async aller(url, attendre) {
    await this.page.goto(url.startsWith('http') ? url : WEB + url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    if (attendre) await attendre();
    await this.page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    await this.page.waitForTimeout(600);
  }

  /**
   * Dit `texte` ; `actions` se jouent pendant la narration. L'intervalle gardé au montage
   * dure max(narration, actions) + une respiration.
   */
  async dire(texte, actions) {
    const v = await voix(texte);
    const a = this.maintenant();
    const debut = Date.now();
    await Promise.all([
      this.page.waitForTimeout(v.duree * 1000 + 450),
      actions ? actions() : null,
    ]);
    // Une action plus longue que la phrase garde la fin de l'action à l'image.
    const b = Math.max(this.maintenant(), a + (Date.now() - debut) / 1000);
    this.segments.push({ a, b, audio: v.fichier, texte });
  }

  /** Montre une action sans narration (gardée au montage). */
  async montrer(actions, pause = 400) {
    const a = this.maintenant();
    await actions();
    await this.page.waitForTimeout(pause);
    this.segments.push({ a, b: this.maintenant(), audio: null, texte: '' });
  }

  /** Clic avec déplacement visible du curseur. */
  async cliquer(cible, opts = {}) {
    const loc = typeof cible === 'string' ? this.page.locator(cible).first() : cible;
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    const bb = await loc.boundingBox();
    if (bb) {
      await this.page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 22 });
      await this.page.waitForTimeout(180);
    }
    await loc.click(opts);
  }

  async survoler(cible) {
    const loc = typeof cible === 'string' ? this.page.locator(cible).first() : cible;
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    const bb = await loc.boundingBox();
    if (bb) await this.page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 22 });
  }

  /** Saisie lisible, caractère par caractère. */
  async taper(cible, texte, delai = 40) {
    const loc = typeof cible === 'string' ? this.page.locator(cible).first() : cible;
    await this.cliquer(loc);
    await loc.fill('');
    await loc.pressSequentially(texte, { delay: delai });
  }

  /** Défilement doux de la page (ou d'un conteneur). */
  async defiler(dy, duree = 1200) {
    const pas = 30;
    for (let i = 0; i < pas; i++) {
      await this.page.mouse.wheel(0, dy / pas);
      await this.page.waitForTimeout(duree / pas);
    }
  }

  /** Carton de titre plein écran, aux couleurs de Transpo. */
  async carton(numero, titre, sousTitre) {
    const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
<style>
html,body{margin:0;height:100%;font-family:Inter,system-ui,sans-serif;color:#fff;overflow:hidden}
body{background:radial-gradient(1200px 700px at 20% 10%,#5472E4 0%,#3E63DD 35%,#1F2D5C 100%);
display:flex;flex-direction:column;justify-content:center;padding:0 120px;box-sizing:border-box}
.marque{display:flex;align-items:center;gap:14px;font-weight:800;font-size:28px;opacity:.95}
.logo{width:44px;height:44px;border-radius:12px;background:#fff;color:#3E63DD;display:grid;place-items:center;font-size:24px}
.num{margin-top:70px;font-weight:600;font-size:22px;letter-spacing:.18em;text-transform:uppercase;opacity:.75}
h1{margin:14px 0 0;font-size:76px;line-height:1.05;font-weight:800;letter-spacing:-.02em;max-width:1100px}
p{margin:26px 0 0;font-size:28px;line-height:1.4;opacity:.85;max-width:1000px}
.barre{position:absolute;left:120px;bottom:90px;width:120px;height:6px;border-radius:3px;background:#fff;opacity:.6}
.fade{animation:f .8s ease both}.d1{animation-delay:.15s}.d2{animation-delay:.35s}
@keyframes f{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
</style></head><body>
<div class="marque fade"><div class="logo">➜</div>Transpo</div>
${numero ? `<div class="num fade d1">${numero}</div>` : ''}
<h1 class="fade d1">${titre}</h1>
${sousTitre ? `<p class="fade d2">${sousTitre}</p>` : ''}
<div class="barre"></div></body></html>`;
    await this.page.setContent(html, { waitUntil: 'load' });
    await this.page.waitForTimeout(300);
  }

  async fermer() {
    const fin = this.maintenant();
    await this.cdp.send('Page.stopScreencast').catch(() => {});
    await this.contexte.close();
    await this.navigateur.close();
    return monter(this.nom, this.assembler(fin), this.segments);
  }

  /** Vidéo brute à cadence fixe, chaque image tenue jusqu'à la suivante sur l'horloge réelle. */
  assembler(fin) {
    if (!this.trames.length) throw new Error('aucune image capturée');
    const tr = this.trames.map((x) => ({ ...x, s: (x.t - this.t0) / 1000 })).sort((a, b) => a.s - b.s);
    const lignes = [];
    tr.forEach((x, i) => {
      const debut = i === 0 ? 0 : x.s;
      const suivant = i + 1 < tr.length ? tr[i + 1].s : Math.max(fin, x.s + 0.1);
      lignes.push(`file '${x.fichier}'`, `duration ${Math.max(0.001, suivant - debut).toFixed(3)}`);
    });
    lignes.push(`file '${tr[tr.length - 1].fichier}'`);
    const liste = path.join(this.brut, 'images.txt');
    fs.writeFileSync(liste, lignes.join('\n'));
    const sortie = path.join(this.brut, 'brut.mp4');
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', liste,
      '-vf', `fps=30,scale=${this.viewport.width}:${this.viewport.height}:force_original_aspect_ratio=decrease,` +
      `pad=${this.viewport.width}:${this.viewport.height}:(ow-iw)/2:(oh-ih)/2:color=white,format=yuv420p`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', sortie]);
    fs.rmSync(this.images, { recursive: true, force: true });
    return sortie;
  }
}

const srtTemps = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

/** Découpe la vidéo brute sur les segments gardés, pose la voix, enchaîne avec fondus. */
export function monter(nom, brut, segments, { largeur = LARGEUR, hauteur = HAUTEUR } = {}) {
  const tmp = path.join(SORTIE, 'brut', `${nom}-segments`);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const liste = [];
  const srt = [];
  let curseur = 0;
  segments.forEach((s, i) => {
    const d = Math.max(0.5, s.b - s.a);
    const coupe = i === 0 || Math.abs(segments[i - 1].b - s.a) > 0.25;
    const fondu = coupe ? `,fade=t=in:st=0:d=0.3` : '';
    const sortie = path.join(tmp, `${String(i).padStart(3, '0')}.mp4`);
    const entreesAudio = s.audio ? ['-i', s.audio] : ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo'];
    execFileSync('ffmpeg', [
      '-y', '-v', 'error', '-ss', s.a.toFixed(3), '-t', d.toFixed(3), '-i', brut,
      ...entreesAudio,
      '-filter_complex',
      `[0:v]fps=30,scale=${largeur}:${hauteur}:force_original_aspect_ratio=decrease,` +
      `pad=${largeur}:${hauteur}:(ow-iw)/2:(oh-ih)/2:color=white,format=yuv420p${fondu}[v];` +
      `[1:a]aresample=48000,aformat=channel_layouts=stereo,adelay=150|150,apad[a]`,
      '-map', '[v]', '-map', '[a]', '-t', d.toFixed(3),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', sortie,
    ]);
    liste.push(`file '${sortie}'`);
    if (s.texte) srt.push(`${srt.length + 1}\n${srtTemps(curseur + 0.15)} --> ${srtTemps(curseur + d - 0.3)}\n${s.texte}\n`);
    curseur += d;
  });
  const fListe = path.join(tmp, 'liste.txt');
  fs.writeFileSync(fListe, liste.join('\n'));
  const final = path.join(SORTIE, `${nom}.mp4`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', fListe,
    '-c', 'copy', '-movflags', '+faststart', final]);
  fs.writeFileSync(path.join(SORTIE, `${nom}.srt`), srt.join('\n'));
  console.log(`✓ ${final} — ${curseur.toFixed(1)} s, ${segments.length} segments`);
  return final;
}

/** Saisie visible des identifiants — à jouer pendant une narration (`t.dire(…, () => …)`). */
export async function saisirConnexion(t, email, motDePasse) {
  await t.taper('input[name="email"]', email, 30);
  await t.taper('input[name="password"]', motDePasse, 30);
  await t.cliquer(t.page.getByRole('button', { name: 'Se connecter' }));
}
