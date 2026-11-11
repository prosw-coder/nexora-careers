import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

const env = {};

test('health endpoint reports service status', async () => {
  const response = await worker.fetch(new Request('https://example.test/health'), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: 'NEXORA CAREERS' });
});

test('public homepage serves Arabic RTL HTML', async () => {
  const response = await worker.fetch(new Request('https://example.test/'), env);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /text\/html/);
  assert.match(html, /lang="ar"/);
  assert.match(html, /dir="rtl"/);
  assert.match(html, /NEXORA CAREERS/);
});

test('admin page serves HTML', async () => {
  const response = await worker.fetch(new Request('https://example.test/admin'), env);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /text\/html/);
  assert.match(html, /NEXORA CAREERS/);
});

test('unknown routes return a JSON 404', async () => {
  const response = await worker.fetch(new Request('https://example.test/not-a-route'), env);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'المسار غير موجود.' });
});
