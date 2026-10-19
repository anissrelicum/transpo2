import { createRequire } from 'node:module';
import * as fs from 'node:fs'; import * as path from 'node:path';
const { chromium } = createRequire('/Volumes/workspace/transpo2/apps/e2e-web/package.json')('@playwright/test');
const IPS = 30, DOS = 'images6'; fs.rmSync(DOS, { recursive: true, force: true }); fs.mkdirSync(DOS);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('file://' + path.resolve('m2/montage-darija-voix.html')); await p.evaluate(() => window.pret);
const total = 47 * IPS, t0 = Date.now();
for (let i = 0; i < total; i++) {
  await p.evaluate((t) => window.rendu(t), i / IPS);
  await p.screenshot({ path: `${DOS}/${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
  if (i % 300 === 0) console.log(i, ((Date.now() - t0) / 1000).toFixed(0) + ' s');
}
await b.close();
