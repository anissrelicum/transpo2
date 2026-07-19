import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { api, waitForApi } from '../helpers.mjs';

before(async () => { await waitForApi(); });

test('GET /health → ok', async () => {
  const r = await api('/health');
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'ok');
});
