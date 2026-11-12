// Account, support, subscription, team, and job-application write endpoints.
import { J, id, now, B } from './utils.js';
import { U, P } from './auth.js';
import { weeklyFreeJobIds } from './public-api.js';

function teamList(me) {
  try { const list = JSON.parse(me.team_members || '[]'); return Array.isArray(list) ? list : []; }
  catch { return []; }
}
function isTeamOwner(me) { return !!me && me.plan === 'team' && P(me) && !me.team_owner_id; }
async function findTeamCandidate(e, owner, accountId) {
  if (!/^\d{10}$/.test(accountId)) return { error: J({ error: 'أدخل رقم حساب صحيحاً من 10 أرقام.' }, 400) };
  if (accountId === owner.account_id) return { error: J({ error: 'لا يمكنك إضافة حسابك إلى فريقك.' }, 400) };
  const user = await e.DB.prepare('SELECT id,account_id,name,plan,plan_status,plan_expires_at,team_owner_id,team_members FROM users WHERE account_id=?').bind(accountId).first();
  if (!user) return { error: J({ error: 'الحساب غير موجود.' }, 404) };
  if (user.plan !== 'free' || user.team_owner_id || (user.team_members && user.team_members !== '[]')) return { error: J({ error: 'لا يمكن إضافة هذا الحساب؛ يجب أن يكون حساباً مجانياً غير مرتبط بفريق.' }, 409) };
  const members = teamList(owner);
  if (members.length >= 3) return { error: J({ error: 'وصلت إلى الحد الأقصى، وهو 3 أعضاء.' }, 409) };
  if (members.includes(user.id)) return { error: J({ error: 'هذا العضو مضاف بالفعل.' }, 409) };
  return { user, members };
}

async function handleAccountApi(p, m, r, e) {
  if (p === '/api/favorites' && m === 'GET') {
    const me = await U(r, e);
    if (!me) return J({ error: 'سجّل الدخول أولاً.' }, 401);
    const rows = await e.DB.prepare('SELECT jobs.id,jobs.title,jobs.company,jobs.location,jobs.category,jobs.job_type,jobs.icon,jobs.is_featured FROM favorite_jobs JOIN jobs ON jobs.id=favorite_jobs.job_id WHERE favorite_jobs.user_id=? AND jobs.is_published=1 ORDER BY favorite_jobs.created_at DESC').bind(me.id).all();
    return J({ favorites: (rows.results || []).map(x => P(me) ? x : ({ id: x.id, title: x.title })) });
  }
  if (p === '/api/favorites/toggle' && m === 'POST') {
    const me = await U(r, e);
    if (!me) return J({ error: 'سجّل الدخول لحفظ الوظائف في المفضلات.' }, 401);
    const b = await B(r), jobId = String(b.job_id || '');
    if (!jobId || jobId.length > 120) return J({ error: 'الوظيفة غير محددة.' }, 400);
    const job = await e.DB.prepare('SELECT id FROM jobs WHERE id=? AND is_published=1').bind(jobId).first();
    if (!job) return J({ error: 'الوظيفة غير متاحة.' }, 404);
    const exists = await e.DB.prepare('SELECT job_id FROM favorite_jobs WHERE user_id=? AND job_id=?').bind(me.id, jobId).first();
    if (exists) {
      await e.DB.prepare('DELETE FROM favorite_jobs WHERE user_id=? AND job_id=?').bind(me.id, jobId).run();
      return J({ ok: true, saved: false });
    }
    await e.DB.prepare('INSERT INTO favorite_jobs(user_id,job_id,created_at) VALUES(?,?,?)').bind(me.id, jobId, now()).run();
    return J({ ok: true, saved: true });
  }
  if (p === '/api/profile' && m === 'POST') {
    const me = await U(r, e);
    if (!me) return J({ error: 'سجّل الدخول أولاً.' }, 401);
    const b = await B(r), name = String(b.name || '').trim().slice(0, 90), avatar = String(b.avatar || me.avatar || 'avatar1');
    if (!name) return J({ error: 'الاسم الكامل مطلوب.' }, 400);
    if (!['avatar1','avatar2','avatar3','avatar4','male1','male2','female1','female2','👨🏻','👨🏽','👩🏻','👩🏽'].includes(avatar)) return J({ error: 'الصورة المختارة غير صالحة.' }, 400);
    const profile = { title: String(b.title || '').trim().slice(0, 90), city: String(b.city || '').trim().slice(0, 70), bio: String(b.bio || '').trim().slice(0, 600), skills: Array.isArray(b.skills) ? b.skills.map(x => String(x).trim().slice(0, 40)).filter(Boolean).slice(0, 12) : [] };
    await e.DB.prepare('UPDATE users SET name=?,avatar=? WHERE id=?').bind(name, avatar, me.id).run();
    await e.STORE.put('profile:' + me.id, JSON.stringify(profile));
    return J({ ok: true, user: { id: me.id, account_id: me.account_id, name, email: me.email, avatar, theme: me.theme, plan: me.plan, plan_status: me.plan_status, plan_expires_at: me.plan_expires_at, team_member: !!me.team_owner_id, profile } });
  }
  if (p === '/api/support' && m === 'POST') {
    const b = await B(r), name = String(b.name || '').trim().slice(0, 100), email = String(b.email || '').trim().slice(0, 160).toLowerCase(), message = String(b.message || '').trim().slice(0, 3000);
    if (!name || !email.includes('@') || message.length < 8) return J({ error: 'أدخل الاسم والبريد ورسالة من 8 أحرف على الأقل.' }, 400);
    const me = await U(r, e);
    await e.DB.prepare('INSERT INTO support_messages(id,user_id,name,email,message,status,created_at) VALUES(?,?,?,?,?,?,?)').bind(id(), me?.id || null, name, email, message, 'new', now()).run();
    return J({ ok: true });
  }
  if (p === '/api/plan-request' && m === 'POST') {
    const me = await U(r, e);
    if (!me) return J({ error: 'سجّل الدخول أولاً.' }, 401);
    const b = await B(r);
    if (!['plus', 'team'].includes(b.plan)) return J({ error: 'الباقة غير صحيحة.' }, 400);
    if (await e.DB.prepare("SELECT id FROM plan_requests WHERE user_id=? AND plan=? AND status='pending'").bind(me.id, b.plan).first()) return J({ error: 'لديك طلب قيد المراجعة.' }, 409);
    await e.DB.prepare('INSERT INTO plan_requests(id,user_id,plan,price_jod,status,created_at) VALUES(?,?,?,?,?,?)').bind(id(), me.id, b.plan, b.plan === 'plus' ? 5 : 12, 'pending', now()).run();
    return J({ ok: true });
  }
  if (p === '/api/team/lookup' && m === 'POST') {
    const me = await U(r, e);
    if (!isTeamOwner(me)) return J({ error: 'هذه الميزة متاحة لمالك Team الفعال فقط.' }, 403);
    const b = await B(r), accountId = String(b.account_id || '').trim();
    const found = await findTeamCandidate(e, me, accountId);
    if (found.error) return found.error;
    // Deliberately return only the account holder's name and account number.
    return J({ user: { account_id: found.user.account_id, name: found.user.name } });
  }
  if (p === '/api/team/add' && m === 'POST') {
    const me = await U(r, e);
    if (!isTeamOwner(me)) return J({ error: 'هذه الميزة متاحة لمالك Team الفعال فقط.' }, 403);
    const b = await B(r), accountId = String(b.account_id || '').trim();
    if (b.confirm !== true) return J({ error: 'أكد إضافة العضو بعد التحقق من اسمه.' }, 400);
    const found = await findTeamCandidate(e, me, accountId);
    if (found.error) return found.error;
    const expiry = me.plan_expires_at || null;
    const next = found.members.concat([found.user.id]);
    await e.DB.batch([
      e.DB.prepare('UPDATE users SET team_members=? WHERE id=?').bind(JSON.stringify(next), me.id),
      e.DB.prepare('UPDATE users SET plan=?,plan_status=?,plan_expires_at=?,team_owner_id=? WHERE id=? AND plan=\'free\' AND (team_owner_id IS NULL OR team_owner_id=\'\')').bind('team', 'active', expiry, me.id, found.user.id)
    ]);
    const verified = await e.DB.prepare('SELECT id FROM users WHERE id=? AND team_owner_id=? AND plan=?').bind(found.user.id, me.id, 'team').first();
    if (!verified) return J({ error: 'تعذر تفعيل العضوية. حدّث الصفحة وحاول مجدداً.' }, 409);
    return J({ ok: true, member_name: found.user.name });
  }
  if (p === '/api/team/members' && m === 'GET') {
    const me = await U(r, e);
    if (!isTeamOwner(me)) return J({ error: 'هذه الميزة متاحة لمالك Team الفعال فقط.' }, 403);
    const ids = teamList(me);
    if (!ids.length) return J({ members: [] });
    const placeholders = ids.map(() => '?').join(',');
    const rows = await e.DB.prepare('SELECT name FROM users WHERE id IN (' + placeholders + ')').bind(...ids).all();
    return J({ members: (rows.results || []).map(x => ({ name: x.name })) });
  }
  if (p === '/api/applications' && m === 'POST') {
    const me = await U(r, e);
    if (!me) return J({ error: 'سجّل الدخول أولاً لتقديم طلبك.' }, 401);
    const b = await B(r), job = await e.DB.prepare('SELECT id FROM jobs WHERE id=? AND is_published=1').bind(b.job_id).first();
    if (!job) return J({ error: 'الوظيفة غير متاحة.' }, 404);
    if (!P(me)) {
      const rows = await e.DB.prepare('SELECT id FROM jobs WHERE is_published=1 ORDER BY is_featured DESC,created_at DESC').all();
      if (!weeklyFreeJobIds(rows.results || []).has(String(b.job_id))) return J({ error: 'يمكنك التقديم على الوظائف المجانية الأربع لهذا الأسبوع فقط.' , upgrade_required: true }, 403);
    }
    await e.DB.prepare('INSERT INTO applications(id,user_id,job_id,full_name,email,created_at) VALUES(?,?,?,?,?,?)').bind(id(), me.id, b.job_id, me.name, me.email, now()).run();
    return J({ ok: true });
  }
  return null;
}
export { handleAccountApi };
