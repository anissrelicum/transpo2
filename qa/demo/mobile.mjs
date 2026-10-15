// Tournage de l'app livreur sur l'émulateur Android.
//
// Chaque phrase (`dire`) enregistre son propre clip par `adb shell screenrecord` pendant que
// les gestes se jouent : le montage n'a rien à couper. Le téléphone est ensuite incrusté
// dans un cadre 1440×900 aux couleurs de Transpo, avec le libellé de l'étape à gauche.
import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SORTIE, voix } from './moteur.mjs';

const RACINE = path.resolve(import.meta.dirname, '../..');
const { chromium } = createRequire(path.join(RACINE, 'apps/e2e-web/package.json'))('@playwright/test');
export const ADB = `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`;
export const adb = (...args) => execFileSync(ADB, args, { encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024 });
export const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const AMORCE = 1.2; // secondes de démarrage de screenrecord, retirées au montage

/* ---------------------------------------------------------------- écran */

/** Arbre d'accessibilité aplati (même approche que apps/driver-app/recette/lib.mjs). */
export async function ecran() {
  for (let essai = 1; essai <= 10; essai++) {
    adb('shell', 'rm', '-f', '/sdcard/ui.xml');
    try { adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml'); } catch { /* réessai */ }
    let xml = '';
    try { xml = adb('shell', 'cat', '/sdcard/ui.xml'); } catch { xml = ''; }
    if (xml.includes('<node ')) {
      const dec = (v) => v.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, '&');
      return xml.split('<node ').slice(1).map((b) => {
        const a = (n) => dec((new RegExp(`${n}="([^"]*)"`).exec(b) ?? [])[1] ?? '');
        const [, x1, y1, x2, y2] = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(b) ?? [];
        return { id: a('resource-id'), texte: a('text'), description: a('content-desc'),
          centre: x1 ? [Math.round((+x1 + +x2) / 2), Math.round((+y1 + +y2) / 2)] : null };
      });
    }
    await pause(Math.min(300 * essai, 1500));
  }
  throw new Error('arbre d’accessibilité indisponible');
}

export function chercher(noeuds, cible) {
  const t = String(cible);
  const re = cible instanceof RegExp ? cible : null;
  const ok = (v) => (re ? re.test(v) : v === t);
  return noeuds.find((n) => n.centre && (n.id === t || ok(n.description)))
    ?? noeuds.find((n) => n.centre && ok(n.texte))
    // Android met les boutons des boîtes natives en CAPITALES (« CONFIRMER »).
    ?? (re ? null : noeuds.find((n) => n.centre && [n.texte, n.description].some((v) => v.trim().toLowerCase() === t.toLowerCase())))
    ?? (re ? null : noeuds.find((n) => n.centre && (n.texte.includes(t) || n.description.includes(t))))
    ?? null;
}

export async function attendre(cible, timeout = 30_000) {
  const fin = Date.now() + timeout;
  do {
    const n = chercher(await ecran(), cible);
    if (n) return n;
    await pause(800);
  } while (Date.now() < fin);
  throw new Error(`« ${cible} » introuvable à l’écran`);
}
export const visible = async (cible) => chercher(await ecran(), cible) !== null;

export async function toucher(cible) {
  const n = await attendre(cible);
  adb('shell', 'input', 'tap', String(n.centre[0]), String(n.centre[1]));
  await pause(700);
  return n;
}

/**
 * Saisie ASCII (seul alphabet que `input text` sache taper), RELUE puis refaite si besoin :
 * `input text` va plus vite que le rendu du champ React Native, et des caractères tombent.
 */
export async function saisir(cible, valeur) {
  const echappe = (v) => v.replace(/ /g, '%s').replace(/([()<>|;&*\\~"'`$?[\]{}#!@])/g, '\\$1');
  for (let essai = 1; essai <= 4; essai++) {
    await toucher(cible);
    await pause(600);
    adb('shell', 'input', 'keyevent', 'KEYCODE_MOVE_END');
    adb('shell', 'input', 'keyevent', '--longpress', ...Array(45).fill('KEYCODE_DEL'));
    await pause(300);
    for (const morceau of valeur.match(/.{1,3}/g) ?? []) {
      adb('shell', 'input', 'text', echappe(morceau));
      await pause(220 + essai * 80);
    }
    await pause(500);
    const n = chercher(await ecran(), cible);
    const lu = n?.texte ?? '';
    const masque = /^[•*·]+$/.test(lu);
    // Un champ secret peut se relire vide selon la version d'Android : on ne peut rien y vérifier.
    if (masque ? [...lu].length === valeur.length : lu === valeur || (lu === '' && /mot-de-passe|password/i.test(String(cible)))) return;
  }
  throw new Error(`saisie de « ${cible} » impossible à fiabiliser`);
}

export function glisser([x1, y1], [x2, y2], ms = 450) {
  adb('shell', 'input', 'swipe', String(x1), String(y1), String(x2), String(y2), String(ms));
}

/* ------------------------------------------------------------- tournage */

async function fond(html, sortie) {
  const nav = await chromium.launch();
  const p = await nav.newPage({ viewport: { width: 1440, height: 900 } });
  await p.setContent(html, { waitUntil: 'load' });
  await p.waitForTimeout(400);
  await p.screenshot({ path: sortie });
  await nav.close();
}

const cadre = (chapitre, titre, etape) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
<style>html,body{margin:0;width:1440px;height:900px;font-family:Inter,system-ui,sans-serif;color:#fff;overflow:hidden}
body{background:radial-gradient(1100px 700px at 15% 0%,#5472E4 0%,#3E63DD 38%,#1F2D5C 100%)}
.g{position:absolute;left:110px;top:0;bottom:0;width:640px;display:flex;flex-direction:column;justify-content:center}
.m{display:flex;align-items:center;gap:12px;font-weight:800;font-size:24px}
.l{width:38px;height:38px;border-radius:10px;background:#fff;color:#3E63DD;display:grid;place-items:center}
.c{margin-top:60px;font-weight:600;font-size:18px;letter-spacing:.16em;text-transform:uppercase;opacity:.75}
h1{margin:12px 0 0;font-size:56px;line-height:1.08;font-weight:800;letter-spacing:-.02em}
.e{margin-top:34px;display:inline-flex;align-self:flex-start;gap:10px;align-items:center;background:rgba(255,255,255,.14);
border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:12px 20px;font-size:22px;font-weight:600}
.d{width:10px;height:10px;border-radius:50%;background:#7CE3A1}
.t{position:absolute;left:880px;top:16px;width:404px;height:868px;border-radius:46px;background:#0B0F1A;
box-shadow:0 30px 80px rgba(0,0,0,.45),0 0 0 2px rgba(255,255,255,.15)}
</style></head><body><div class="g"><div class="m"><div class="l">➜</div>Transpo</div>
<div class="c">${chapitre}</div><h1>${titre}</h1>${etape ? `<div class="e"><span class="d"></span>${etape}</div>` : ''}</div>
<div class="t"></div></body></html>`;

export class TournageMobile {
  constructor(nom, { chapitre, titre }) {
    this.nom = nom; this.chapitre = chapitre; this.titre = titre;
    this.dossier = path.join(SORTIE, 'brut', nom);
    fs.rmSync(this.dossier, { recursive: true, force: true });
    fs.mkdirSync(this.dossier, { recursive: true });
    this.segments = [];
    this.etape = '';
  }

  /** Libellé affiché à gauche du téléphone pour les phrases suivantes. */
  etapeCourante(libelle) { this.etape = libelle; }

  async dire(texte, actions) {
    const v = await voix(texte);
    const i = this.segments.length;
    const distant = `/sdcard/demo-${i}.mp4`;
    adb('shell', 'rm', '-f', distant);
    const rec = spawn(ADB, ['shell', 'screenrecord', '--bit-rate', '8000000', '--time-limit', '170', distant]);
    const fini = new Promise((r) => rec.on('exit', r));
    await pause(AMORCE * 1000);
    const debut = Date.now();
    await Promise.all([pause(v.duree * 1000 + 450), actions ? actions() : null]);
    const d = (Date.now() - debut) / 1000;
    await pause(300);
    // SIGINT sur le seul screenrecord : `pkill` vise aussi des processus système et échoue.
    try {
      const pid = adb('shell', 'pidof', 'screenrecord').trim();
      if (pid) adb('shell', 'kill', '-2', ...pid.split(/\s+/));
    } catch { /* déjà arrêté */ }
    await Promise.race([fini, pause(10_000)]);
    await pause(800);
    const local = path.join(this.dossier, `clip-${i}.mp4`);
    adb('pull', distant, local);
    const png = path.join(this.dossier, `fond-${i}.png`);
    await fond(cadre(this.chapitre, this.titre, this.etape), png);
    this.segments.push({ clip: local, fond: png, audio: v.fichier, texte, d });
  }

  /** Carton plein écran (sans téléphone), parlé. */
  async carton(texte, numero, titre, sousTitre) {
    const v = await voix(texte);
    const png = path.join(this.dossier, `carton-${this.segments.length}.png`);
    await fond(`<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
<style>html,body{margin:0;width:1440px;height:900px;font-family:Inter,system-ui,sans-serif;color:#fff;overflow:hidden}
body{background:radial-gradient(1200px 700px at 20% 10%,#5472E4 0%,#3E63DD 35%,#1F2D5C 100%);display:flex;flex-direction:column;justify-content:center;padding:0 120px;box-sizing:border-box}
.m{display:flex;align-items:center;gap:14px;font-weight:800;font-size:28px}.l{width:44px;height:44px;border-radius:12px;background:#fff;color:#3E63DD;display:grid;place-items:center;font-size:24px}
.n{margin-top:70px;font-weight:600;font-size:22px;letter-spacing:.18em;text-transform:uppercase;opacity:.75}
h1{margin:14px 0 0;font-size:76px;line-height:1.05;font-weight:800;letter-spacing:-.02em}p{margin:26px 0 0;font-size:28px;line-height:1.4;opacity:.85;max-width:1000px}
.b{position:absolute;left:120px;bottom:90px;width:120px;height:6px;border-radius:3px;background:#fff;opacity:.6}</style></head>
<body><div class="m"><div class="l">➜</div>Transpo</div><div class="n">${numero}</div><h1>${titre}</h1><p>${sousTitre}</p><div class="b"></div></body></html>`, png);
    this.segments.push({ clip: null, fond: png, audio: v.fichier, texte, d: v.duree + 0.45 });
  }

  fermer() {
    const tmp = path.join(this.dossier, 'segments');
    fs.mkdirSync(tmp, { recursive: true });
    const liste = [];
    const srt = [];
    let t = 0;
    const ts = (s) => { const ms = Math.round(s * 1000); const p = (n, l = 2) => String(n).padStart(l, '0');
      return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`; };
    this.segments.forEach((s, i) => {
      const out = path.join(tmp, `${String(i).padStart(3, '0')}.mp4`);
      const d = s.d.toFixed(3);
      const entrees = ['-loop', '1', '-framerate', '30', '-t', d, '-i', s.fond];
      let filtre;
      if (s.clip) {
        entrees.push('-ss', String(AMORCE), '-i', s.clip, '-i', s.audio);
        filtre = '[1:v]fps=30,scale=388:-2[tel];[0:v][tel]overlay=888:(H-h)/2:shortest=0,format=yuv420p,fade=t=in:st=0:d=0.25[v];' +
          '[2:a]aresample=48000,aformat=channel_layouts=stereo,adelay=150|150,apad[a]';
      } else {
        entrees.push('-i', s.audio);
        filtre = '[0:v]format=yuv420p,fade=t=in:st=0:d=0.3[v];[1:a]aresample=48000,aformat=channel_layouts=stereo,adelay=150|150,apad[a]';
      }
      execFileSync('ffmpeg', ['-y', '-v', 'error', ...entrees, '-filter_complex', filtre,
        '-map', '[v]', '-map', '[a]', '-t', d, '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
        '-r', '30', '-c:a', 'aac', '-b:a', '160k', out]);
      liste.push(`file '${out}'`);
      srt.push(`${i + 1}\n${ts(t + 0.15)} --> ${ts(t + s.d - 0.3)}\n${s.texte}\n`);
      t += s.d;
    });
    fs.writeFileSync(path.join(tmp, 'liste.txt'), liste.join('\n'));
    const final = path.join(SORTIE, `${this.nom}.mp4`);
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'liste.txt'),
      '-c', 'copy', '-movflags', '+faststart', final]);
    fs.writeFileSync(path.join(SORTIE, `${this.nom}.srt`), srt.join('\n'));
    console.log(`✓ ${final} — ${t.toFixed(1)} s, ${this.segments.length} segments`);
    return final;
  }
}
