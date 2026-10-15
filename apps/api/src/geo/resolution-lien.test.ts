// Résolution réseau des liens de localisation — avec un `fetch` simulé : on vérifie ce
// que le résolveur CONTACTE (et surtout ce qu'il refuse de contacter), sans réseau réel.
// Lancement : pnpm --filter @transpo/api test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resoudreLien, ErreurLienCarte, type CodeErreurLien } from './resolution-lien.ts';

type Reponse = { status: number; location?: string; body?: string };

/** `fetch` simulé : une table URL → réponse, et le journal des URL contactées. */
function faux(table: Record<string, Reponse | (() => Promise<Response>)>) {
  const appels: string[] = [];
  const f = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    appels.push(url);
    assert.equal(init?.redirect, 'manual', 'les redirections doivent être suivies à la main');
    const r = table[url];
    if (!r) return new Response('introuvable', { status: 404 });
    if (typeof r === 'function') return r();
    return new Response(r.body ?? '', { status: r.status, headers: r.location ? { location: r.location } : {} });
  }) as typeof fetch;
  return { f, appels };
}

async function echoue(p: Promise<unknown>, code: CodeErreurLien) {
  await assert.rejects(p, (e) => e instanceof ErreurLienCarte && e.code === code);
}

const COURT = 'https://maps.app.goo.gl/AbCdEf123';
const PLACE = 'https://www.google.com/maps/place/Twin+Center/@33.58,-7.63,17z/data=!3m1!4b1!4m6!3m5!8m2!3d33.5856!4d-7.6339';

test('lien court → 302 vers un lieu Google : position lue SANS contacter la destination', async () => {
  const { f, appels } = faux({ [COURT]: { status: 302, location: PLACE } });
  const r = await resoudreLien(COURT, { fetch: f });
  assert.deepEqual([r.lat, r.lng, r.precision, r.via, r.source], [33.5856, -7.6339, 'exacte', 'redirection', 'google']);
  assert.equal(r.url, COURT, 'le lien d’ORIGINE est conservé pour le livreur');
  assert.deepEqual(appels, [COURT]);
});

test('lien court dans un message WhatsApp', async () => {
  const { f } = faux({ [COURT]: { status: 302, location: PLACE } });
  const r = await resoudreLien(`Voici ma position 👉 ${COURT}`, { fetch: f });
  assert.equal(r.url, COURT);
  assert.equal(r.lat, 33.5856);
});

test('chaîne de redirections puis page : position lue dans le HTML', async () => {
  const etape = 'https://maps.google.com/?q=Twin+Center&ftid=0xda7d:0x6e8e';
  const { f, appels } = faux({
    'https://goo.gl/maps/Xyz': { status: 301, location: etape },
    [etape]: { status: 200, body: '<link rel="canonical" href="https://www.google.com/maps/place/Twin+Center/data=!4m2!3m1!1s0x0:0x0!3d33.5856!4d-7.6339">' },
  });
  const r = await resoudreLien('https://goo.gl/maps/Xyz', { fetch: f });
  assert.deepEqual([r.lat, r.lng, r.via], [33.5856, -7.6339, 'page']);
  assert.deepEqual(appels, ['https://goo.gl/maps/Xyz', etape]);
});

test('Waze court (ul.waze.com) → redirection relative vers `?ll=`', async () => {
  const { f } = faux({ 'https://ul.waze.com/ul?venue_id=1': { status: 302, location: '/ul?ll=33.5731%2C-7.5898&navigate=yes' } });
  const r = await resoudreLien('https://ul.waze.com/ul?venue_id=1', { fetch: f });
  assert.deepEqual([r.lat, r.lng, r.source], [33.5731, -7.5898, 'waze']);
});

test('consentement Google : la suite `continue` est lue, consent.google.com jamais contacté', async () => {
  const consent = `https://consent.google.com/ml?continue=${encodeURIComponent(PLACE)}&gl=FR`;
  const { f, appels } = faux({ [COURT]: { status: 302, location: consent } });
  const r = await resoudreLien(COURT, { fetch: f });
  assert.equal(r.lat, 33.5856);
  assert.deepEqual(appels, [COURT]);
});

/* ---------------- SSRF ---------------- */
test('SSRF : redirection vers les métadonnées cloud → refusée, jamais contactée', async () => {
  const { f, appels } = faux({ [COURT]: { status: 302, location: 'http://169.254.169.254/latest/meta-data/' } });
  await echoue(resoudreLien(COURT, { fetch: f }), 'HOTE_REFUSE');
  assert.deepEqual(appels, [COURT]);
});

test('SSRF : redirection vers le réseau interne / un autre site → refusée', async () => {
  for (const cible of ['http://localhost:3000/v1/orders', 'http://api:3000/health', 'https://evil.example/?q=33.5,-7.5', 'file:///etc/passwd']) {
    const { f, appels } = faux({ [COURT]: { status: 302, location: cible } });
    await echoue(resoudreLien(COURT, { fetch: f }), 'HOTE_REFUSE');
    assert.deepEqual(appels, [COURT], `ne doit pas contacter ${cible}`);
  }
});

test('SSRF : lien collé hors liste blanche → refusé sans aucune requête', async () => {
  const { f, appels } = faux({});
  await echoue(resoudreLien('https://bit.ly/3xYz', { fetch: f }), 'HOTE_REFUSE');
  await echoue(resoudreLien('http://10.0.0.12/admin', { fetch: f }), 'HOTE_REFUSE');
  assert.deepEqual(appels, []);
});

test('lien quelconque portant des coordonnées : position gardée, lien REMPLACÉ', async () => {
  const { f, appels } = faux({});
  const r = await resoudreLien('https://exemple.com/carte?q=33.5731,-7.5898', { fetch: f });
  assert.deepEqual([r.lat, r.lng], [33.5731, -7.5898]);
  assert.equal(r.url, 'https://www.google.com/maps/search/?api=1&query=33.5731,-7.5898');
  assert.deepEqual(appels, []);
});

test('plus de 5 redirections → abandon', async () => {
  const table: Record<string, Reponse> = {};
  for (let i = 0; i < 8; i++) table[`https://maps.google.com/r${i}`] = { status: 302, location: `https://maps.google.com/r${i + 1}` };
  const { f, appels } = faux(table);
  await echoue(resoudreLien('https://maps.google.com/r0', { fetch: f }), 'INJOIGNABLE');
  assert.equal(appels.length, 6, '1 requête initiale + 5 redirections, pas une de plus');
});

/* ---------------- Échecs réseau ---------------- */
test('lien court périmé (404) → LIEN_EXPIRE', async () => {
  const { f } = faux({ [COURT]: { status: 404 } });
  await echoue(resoudreLien(COURT, { fetch: f }), 'LIEN_EXPIRE');
});

test('service en erreur (503) / réseau coupé → INJOIGNABLE', async () => {
  await echoue(resoudreLien(COURT, { fetch: faux({ [COURT]: { status: 503 } }).f }), 'INJOIGNABLE');
  await echoue(resoudreLien(COURT, { fetch: faux({ [COURT]: async () => { throw new TypeError('fetch failed'); } }).f }), 'INJOIGNABLE');
});

test('délai dépassé → INJOIGNABLE (une seule échéance pour toute la chaîne)', async () => {
  const lent = (async (_u: string | URL, init?: RequestInit) => new Promise<Response>((_, rej) => {
    init?.signal?.addEventListener('abort', () => rej(new DOMException('timeout', 'TimeoutError')));
  })) as typeof fetch;
  const t0 = Date.now();
  await echoue(resoudreLien(COURT, { fetch: lent, timeoutMs: 80 }), 'INJOIGNABLE');
  assert.ok(Date.now() - t0 < 2000);
});

test('page lue au plus 512 Kio : une position au-delà est ignorée', async () => {
  const loin = 'x'.repeat(600 * 1024) + '!3d33.5731!4d-7.5898';
  const pres = '!3d33.5731!4d-7.5898' + 'x'.repeat(600 * 1024);
  const final = 'https://maps.google.com/?q=Lieu&ftid=1';
  await echoue(resoudreLien(final, { fetch: faux({ [final]: { status: 200, body: loin } }).f }), 'SANS_COORDONNEES');
  const r = await resoudreLien(final, { fetch: faux({ [final]: { status: 200, body: pres } }).f });
  assert.equal(r.lat, 33.5731);
});

/* ---------------- Géocodage de dernier recours ---------------- */
test('Plans `?address=` : géocodé sans contacter Apple', async () => {
  const { f, appels } = faux({});
  const demandes: string[] = [];
  const r = await resoudreLien('https://maps.apple.com/?address=Boulevard%20Zerktouni,%20Casablanca', {
    fetch: f, geocoder: async (q) => { demandes.push(q); return { lat: 33.5883, lng: -7.6324 }; },
  });
  assert.deepEqual([r.lat, r.lng, r.via, r.source], [33.5883, -7.6324, 'geocodage', 'apple']);
  assert.deepEqual(demandes, ['Boulevard Zerktouni, Casablanca']);
  assert.deepEqual(appels, []);
});

test('recherche Google textuelle : cadrage par défaut ignoré, nom du lieu géocodé', async () => {
  const final = 'https://www.google.com/maps/place/Mosqu%C3%A9e+Hassan+II';
  const page = '<meta content="https://maps.google.com/maps/api/staticmap?center=33.466%2C-7.687" property="og:image">';
  const r = await resoudreLien(final, {
    fetch: faux({ [final]: { status: 200, body: page } }).f,
    geocoder: async (q) => (q === 'Mosquée Hassan II' ? { lat: 33.6084, lng: -7.6326 } : null),
  });
  assert.deepEqual([r.lat, r.lng, r.via], [33.6084, -7.6326, 'geocodage']);
});

test('page sans position ni nom de lieu → SANS_COORDONNEES', async () => {
  const final = 'https://maps.google.com/maps/x';
  await echoue(resoudreLien(final, { fetch: faux({ [final]: { status: 200, body: '<html></html>' } }).f }), 'SANS_COORDONNEES');
});

/* ---------------- Entrées ---------------- */
test('coordonnées brutes : aucun réseau, lien Google généré', async () => {
  const { f, appels } = faux({});
  const r = await resoudreLien('33.5731, -7.5898', { fetch: f });
  assert.deepEqual([r.lat, r.lng, r.via, r.source], [33.5731, -7.5898, 'texte', 'coordonnees']);
  assert.equal(r.url, 'https://www.google.com/maps/search/?api=1&query=33.5731,-7.5898');
  assert.deepEqual(appels, []);
});

test('vide / texte sans lien / trop long', async () => {
  const { f } = faux({});
  await echoue(resoudreLien('   ', { fetch: f }), 'LIEN_VIDE');
  await echoue(resoudreLien('derrière la mosquée', { fetch: f }), 'LIEN_NON_RECONNU');
  await echoue(resoudreLien('https://maps.app.goo.gl/' + 'a'.repeat(5000), { fetch: f }), 'LIEN_NON_RECONNU');
});
