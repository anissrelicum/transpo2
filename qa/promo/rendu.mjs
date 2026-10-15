// Rendu de la vidéo promotionnelle Portrail (30 s, 1920×1080, 30 i/s).
//
// promo.html expose `rendu(t)` : chaque image est dessinée à son instant exact puis capturée,
// ce qui donne un mouvement parfaitement régulier quelle que soit la charge de la machine.
// La bande-son mêle la voix (Deepgram, une prise par phrase, calée sur PISTES) et la musique,
// abaissée sous la voix et normalisée à −14 LUFS (standard des plateformes web).
//
//   node qa/promo/rendu.mjs            → qa/promo/sortie/portrail-promo.mp4
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ICI = import.meta.dirname;
const RACINE = path.resolve(ICI, '../..');
const { chromium } = createRequire(path.join(RACINE, 'apps/e2e-web/package.json'))('@playwright/test');
const SORTIE = path.join(ICI, 'sortie');
const IMAGES = path.join(SORTIE, 'images');
const IPS = 30;

// Instant de départ de chaque phrase de la voix (medias/voix-N.wav), en secondes.
const PISTES = [0.45, 4.5, 8.6, 13.2, 17.6, 21.25, 27.7];

fs.mkdirSync(IMAGES, { recursive: true });
for (const f of fs.readdirSync(IMAGES)) fs.unlinkSync(path.join(IMAGES, f));

const nav = await chromium.launch();
const page = await nav.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto('file://' + path.join(ICI, 'promo.html'));
await page.evaluate(() => window.pret);
const duree = await page.evaluate(() => window.DUREE);
const total = Math.round(duree * IPS);
const debut = Date.now();
for (let i = 0; i < total; i++) {
  await page.evaluate((t) => window.rendu(t), i / IPS);
  await page.screenshot({ path: path.join(IMAGES, `${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 93 });
  if (i % 150 === 0) console.log(`  image ${i}/${total} — ${((Date.now() - debut) / 1000).toFixed(0)} s`);
}
await nav.close();

// Bande-son : voix posées à leur instant, musique abaissée sous la voix (compression
// déclenchée par la voix), fondu de sortie, puis normalisation.
const voix = PISTES.map((_, i) => path.join(ICI, 'medias', `voix-${i + 1}.wav`));
const entrees = [
  '-i', path.join(ICI, 'medias', 'musique-motivating-mornings.mp3'),
  ...voix.flatMap((v) => ['-i', v]),
];
const poses = PISTES.map((t, i) => `[${i + 1}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(t * 1000)}|${Math.round(t * 1000)}[v${i}]`);
const filtre = [
  ...poses,
  `${PISTES.map((_, i) => `[v${i}]`).join('')}amix=inputs=${PISTES.length}:normalize=0,volume=1.6,apad=whole_dur=${duree}[voix]`,
  '[voix]asplit=2[voixA][voixB]',
  `[0:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${duree},afade=t=in:st=0:d=0.4,afade=t=out:st=${duree - 1.8}:d=1.8,volume=0.55[mus]`,
  '[mus][voixA]sidechaincompress=threshold=0.02:ratio=5:attack=15:release=350[musb]',
  '[musb][voixB]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=9[a]',
].join(';');
const audio = path.join(SORTIE, 'bande-son.wav');
execFileSync('ffmpeg', ['-y', '-v', 'error', ...entrees, '-filter_complex', filtre, '-map', '[a]',
  '-t', String(duree), '-ar', '48000', audio]);

const video = path.join(SORTIE, 'portrail-promo.mp4');
execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(IPS), '-i', path.join(IMAGES, '%05d.jpg'),
  '-i', audio, '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', video]);
console.log(`✓ ${video} — ${duree} s, ${total} images en ${((Date.now() - debut) / 1000).toFixed(0)} s`);
