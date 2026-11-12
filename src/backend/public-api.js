// Public read endpoints and public catalog data.
import { J } from './utils.js';
import { U, P } from './auth.js';

// The four free jobs rotate every Thursday at 00:00 Jordan time (UTC+3).
function weeklyFreeJobIds(all) {
  if (!all.length) return new Set();
  const local = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const daysSinceThursday = (local.getUTCDay() + 3) % 7;
  const thursdayUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysSinceThursday) - 3 * 60 * 60 * 1000;
  const weekNumber = Math.floor(thursdayUtc / 604800000);
  const start = ((weekNumber * 4) % all.length + all.length) % all.length;
  const count = Math.min(4, all.length);
  return new Set(Array.from({ length: count }, (_, i) => all[(start + i) % all.length].id));
}

async function handlePublicReadApi(p, m, r, e) {
  if (p === '/api/me' && m === 'GET') {
    const me = await U(r, e);
    if (!me) return J({ user: null });
    const profile = JSON.parse(await e.STORE.get('profile:' + me.id) || '{}');
    return J({ user: {
      id: me.id, account_id: me.account_id, name: me.name, email: me.email,
      avatar: me.avatar, theme: me.theme, plan: me.plan,
      plan_status: me.plan_status, plan_expires_at: me.plan_expires_at,
      team_member: !!me.team_owner_id, profile
    } });
  }
  if (p === '/api/public-data' && m === 'GET') {
    const me = await U(r, e), paid = P(me);
    const result = await e.DB.prepare('SELECT id,title,company,description,location,category,job_type,official_url,icon,is_featured,salary,education_level,work_hours,start_date,end_date,governorate,created_at FROM jobs WHERE is_published=1 ORDER BY is_featured DESC,created_at DESC').all();
    const all = result.results || [], freeIds = weeklyFreeJobIds(all);
    const jobs = all.map(x => {
      if (paid || freeIds.has(x.id)) return { ...x, locked: false, free_weekly: !paid };
      return { id: x.id, title: x.title, locked: true };
    });
    if (!paid) jobs.sort((a, b) => Number(!!a.locked) - Number(!!b.locked));
    const c = await e.DB.prepare('SELECT id,title,provider,description,url FROM courses WHERE is_published=1 ORDER BY created_at DESC').all();
    const courses = (c.results || []).map((x, i) => paid ? ({ ...x, locked: false }) : i < 2 ? ({ ...x, locked: false }) : ({ id: x.id, title: x.title, locked: true }));
    const news = await e.DB.prepare('SELECT id,title,body,image_url,link_url FROM announcements WHERE is_published=1 ORDER BY created_at DESC').all();
    return J({ jobs, job_count: jobs.length, courses, announcements: news.results || [] });
  }
  if (p.startsWith('/api/job/') && m === 'GET') {
    const me = await U(r, e), jid = decodeURIComponent(p.slice(9));
    const job = await e.DB.prepare('SELECT * FROM jobs WHERE id=? AND is_published=1').bind(jid).first();
    if (!job) return J({ error: 'الوظيفة غير موجودة.' }, 404);
    if (!P(me)) {
      const rows = await e.DB.prepare('SELECT id FROM jobs WHERE is_published=1 ORDER BY is_featured DESC,created_at DESC').all();
      if (!weeklyFreeJobIds(rows.results || []).has(jid)) return J({ error: 'تفاصيل هذه الوظيفة متاحة للمشتركين. فعّل اشتراك Plus أو Team لعرضها.', upgrade_required: true }, 403);
    }
    return J({ job, can_apply: true, basic_only: false });
  }
  if (p.startsWith('/api/course/') && m === 'GET') {
    const me = await U(r, e), cid = decodeURIComponent(p.slice(12));
    const c = await e.DB.prepare('SELECT * FROM courses WHERE id=? AND is_published=1').bind(cid).first();
    if (!c) return J({ error: 'الدورة غير موجودة.' }, 404);
    if (!P(me)) {
      const rows = await e.DB.prepare('SELECT id FROM courses WHERE is_published=1 ORDER BY created_at DESC').all();
      if ((rows.results || []).findIndex(x => x.id === cid) >= 2) return J({ error: 'هذه التفاصيل متاحة للمشتركين. فعّل اشتراك Plus أو Team لعرضها.', upgrade_required: true }, 403);
    }
    return J({ course: c });
  }
  return null;
}
export { handlePublicReadApi, weeklyFreeJobIds };
