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

test('public data exposes only the first three free jobs and courses', async () => {
  const jobs = Array.from({ length: 4 }, (_, i) => ({
    id: `job-${i + 1}`, title: `Job ${i + 1}`, company: 'Example',
    location: 'Amman', category: 'Technology', job_type: 'Full-time',
    icon: 'briefcase', is_featured: 0, salary: 'Confidential'
  }));
  const courses = Array.from({ length: 4 }, (_, i) => ({
    id: `course-${i + 1}`, title: `Course ${i + 1}`,
    provider: 'Example', description: 'Course description', url: 'https://example.test'
  }));
  const db = {
    prepare(sql) {
      return {
        async all() {
          if (sql.includes('FROM jobs')) return { results: jobs };
          if (sql.includes('FROM courses')) return { results: courses };
          if (sql.includes('FROM announcements')) return { results: [] };
          throw new Error(`Unexpected query: ${sql}`);
        }
      };
    }
  };
  const response = await worker.fetch(
    new Request('https://example.test/api/public-data'),
    { DB: db }
  );
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.job_count, 4);
  assert.deepEqual(data.jobs.map(item => item.locked), [false, false, false, true]);
  assert.deepEqual(data.courses.map(item => item.locked), [false, false, false, true]);
  assert.equal(data.jobs[3].salary, undefined);
  assert.equal(data.courses[3].url, undefined);
});

test('job details require an authenticated session', async () => {
  const response = await worker.fetch(
    new Request('https://example.test/api/job/job-1'),
    {}
  );
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'سجّل الدخول أولاً لعرض التفاصيل.' });
});
