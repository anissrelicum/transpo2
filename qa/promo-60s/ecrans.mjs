import { createRequire } from 'node:module';
const { chromium } = createRequire('/Volumes/workspace/transpo2/apps/e2e-web/package.json')('@playwright/test');
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } }); const p = await ctx.newPage();
await p.addInitScript(() => { setInterval(() => { if (!document.body) return; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (/\+212\s?\d/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/\s*·?\s*\+212[\d\s]+/g, ''); }, 100); });
await p.goto('https://app.wedowonders.com/login', { waitUntil: 'networkidle' });
await p.fill('input[name=email]', 'admin@portraildemo.ma'); await p.fill('input[name=password]', 'bQD1JSGVCgN1');
await p.keyboard.press('Enter'); await p.waitForURL(/dashboard|fleet|orders/, { timeout: 30000 });
for (const r of ['payout', 'invoices', 'cash', 'dashboard']) { await p.goto('https://app.wedowonders.com/' + r, { waitUntil: 'networkidle' }); await p.waitForTimeout(2500); await p.screenshot({ path: `c-${r}.png` }); }
await p.evaluate(() => fetch('/api/lang', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang: 'ar' }) }));
await p.goto('https://app.wedowonders.com/fleet', { waitUntil: 'networkidle' }); await p.waitForTimeout(8000); await p.screenshot({ path: 'c-ar-fleet.png' });
await p.goto('https://app.wedowonders.com/dashboard', { waitUntil: 'networkidle' }); await p.waitForTimeout(2500); await p.screenshot({ path: 'c-ar-dashboard.png' });
await p.evaluate(() => fetch('/api/lang', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang: 'fr' }) }));
await b.close();
