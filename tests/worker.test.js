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
  assert.match(html, /NEXORA Admin/);
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

test('support endpoint validates input before database access', async () => {
  const response = await worker.fetch(
    new Request('https://example.test/api/support', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '', email: 'invalid', message: 'short' })
    }),
    {}
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: 'أدخل الاسم والبريد ورسالة من 8 أحرف على الأقل.'
  });
});

test('profile updates require authentication', async () => {
  const response = await worker.fetch(
    new Request('https://example.test/api/profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Test User' })
    }),
    {}
  );
  assert.equal(response.status, 401);
});

test('registration creates a user and session, login verifies the password, logout clears it', async () => {
  const users = [];
  const sessions = [];
  const db = {
    prepare(sql) {
      let params = [];
      return {
        bind(...values) { params = values; return this; },
        async first() {
          if (sql.includes('WHERE email=?') && sql.startsWith('SELECT id FROM users')) {
            return users.find(user => user.email === params[0]) || null;
          }
          if (sql.includes('WHERE account_id=?')) {
            return users.find(user => user.account_id === params[0]) || null;
          }
          if (sql.includes('WHERE email=?') && sql.startsWith('SELECT id,account_id')) {
            return users.find(user => user.email === params[0]) || null;
          }
          return null;
        },
        async run() {
          if (sql.startsWith('INSERT INTO users')) {
            const [id, account_id, name, email, password_hash, salt, avatar, theme, plan, plan_status, created_at] = params;
            users.push({ id, account_id, name, email, password_hash, salt, avatar, theme, plan, plan_status, plan_expires_at: null, team_owner_id: null, team_members: '[]', created_at });
          } else if (sql.startsWith('INSERT INTO sessions')) {
            const [token, user_id, expires_at, created_at] = params;
            sessions.push({ token, user_id, expires_at, created_at });
          } else if (sql.startsWith('DELETE FROM sessions')) {
            const index = sessions.findIndex(session => session.token === params[0]);
            if (index >= 0) sessions.splice(index, 1);
          }
          return { success: true };
        }
      };
    }
  };
  const env = { DB: db };
  const register = await worker.fetch(new Request('https://example.test/api/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Test User', email: 'TEST@example.com', password: 'password123', avatar: 'avatar1' })
  }), env);
  assert.equal(register.status, 201);
  const registered = await register.json();
  assert.equal(registered.user.email, 'test@example.com');
  assert.match(registered.user.account_id, /^\d{10}$/);
  assert.equal('password_hash' in registered.user, false);
  assert.equal(sessions.length, 1);
  const duplicate = await worker.fetch(new Request('https://example.test/api/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Another User', email: 'test@example.com', password: 'password123', avatar: 'avatar1' })
  }), env);
  assert.equal(duplicate.status, 409);

  const wrongPassword = await worker.fetch(new Request('https://example.test/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', password: 'incorrect-password' })
  }), env);
  assert.equal(wrongPassword.status, 401);
  const token = register.headers.get('set-cookie').match(/nxsession=([^;]+)/)[1];

  const login = await worker.fetch(new Request('https://example.test/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', password: 'password123' })
  }), env);
  assert.equal(login.status, 200);
  assert.equal((await login.json()).user.id, registered.user.id);
  assert.equal(sessions.length, 2);

  const logout = await worker.fetch(new Request('https://example.test/api/logout', {
    method: 'POST',
    headers: { cookie: `nxsession=${token}`, 'content-type': 'application/json' },
    body: '{}'
  }), env);
  assert.equal(logout.status, 200);
  assert.equal(sessions.length, 1);
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
});

test('registration rejects short passwords and malformed email addresses', async () => {
  const response = await worker.fetch(new Request('https://example.test/api/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Test User', email: 'not-an-email', password: 'short' })
  }), {});
  assert.equal(response.status, 400);
});

test('administrative data endpoint rejects requests without an admin session', async () => {
  const response = await worker.fetch(
    new Request('https://example.test/api/admin/data'),
    {}
  );
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'سجّل دخول الإدارة.' });
});
