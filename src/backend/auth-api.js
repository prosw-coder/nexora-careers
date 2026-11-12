// Registration, login, and logout endpoints backed by D1 sessions.
import { J, id, now, ck, B, sc, H } from './utils.js';

const SESSION_TTL = 30 * 24 * 60 * 60;
const AVATARS = new Set(['avatar1','avatar2','avatar3','avatar4','male1','male2','female1','female2','👨🏻','👨🏽','👩🏻','👩🏽']);

async function allowAttempt(e, key, max, ttl) {
  const count = Number(await e.STORE.get(key) || 0);
  if (count >= max) return false;
  await e.STORE.put(key, String(count + 1), { expirationTtl: ttl });
  return true;
}

function safeUser(row) {
  return {
    id: row.id, account_id: row.account_id, name: row.name, email: row.email,
    avatar: row.avatar, theme: row.theme, plan: row.plan,
    plan_status: row.plan_status, plan_expires_at: row.plan_expires_at,
    team_member: !!row.team_owner_id
  };
}

async function handleAuthApi(p, m, r, e) {
  if (p === '/api/register' && m === 'POST') {
    const ip = r.headers.get('CF-Connecting-IP') || 'unknown';
    if (!await allowAttempt(e, 'auth:register:' + ip, 8, 3600)) return J({ error: 'وصلت إلى الحد المؤقت لإنشاء الحسابات من هذا الاتصال. حاول لاحقاً.' }, 429);
    const b = await B(r), name = String(b.name || '').trim().slice(0, 90);
    const email = String(b.email || '').trim().toLowerCase().slice(0, 160);
    const password = String(b.password || ''), avatar = String(b.avatar || 'avatar1');
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 128) return J({ error: 'أدخل الاسم والبريد الإلكتروني الصحيح وكلمة مرور من 8 أحرف على الأقل.' }, 400);
    if (!AVATARS.has(avatar)) return J({ error: 'الصورة المختارة غير صالحة.' }, 400);
    if (await e.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first()) return J({ error: 'هذا البريد الإلكتروني مسجل مسبقاً.' }, 409);
    let accountId = '';
    for (let attempt = 0; attempt < 8; attempt++) {
      const value = crypto.getRandomValues(new Uint32Array(1))[0] % 9000000000 + 1000000000;
      const candidate = String(value);
      if (!await e.DB.prepare('SELECT id FROM users WHERE account_id=?').bind(candidate).first()) { accountId = candidate; break; }
    }
    if (!accountId) return J({ error: 'تعذر إنشاء رقم حساب فريد. حاول مرة أخرى.' }, 503);
    const userId = id(), salt = id() + id(), passwordHash = await H(password, salt), createdAt = now();
    await e.DB.prepare('INSERT INTO users(id,account_id,name,email,password_hash,salt,avatar,theme,plan,plan_status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(userId, accountId, name, email, passwordHash, salt, avatar, 'light', 'free', 'active', createdAt).run();
    const token = id(), expiresAt = now() + SESSION_TTL * 1000;
    await e.DB.prepare('INSERT INTO sessions(token,user_id,expires_at,created_at) VALUES(?,?,?,?)').bind(token, userId, expiresAt, now()).run();
    const user = { id: userId, account_id: accountId, name, email, avatar, theme: 'light', plan: 'free', plan_status: 'active', plan_expires_at: null, team_member: false };
    return J({ ok: true, user }, 201, { 'set-cookie': sc('nxsession', token, SESSION_TTL) });
  }
  if (p === '/api/login' && m === 'POST') {
    const ip = r.headers.get('CF-Connecting-IP') || 'unknown';
    const rateKey = 'auth:login:' + ip;
    if (Number(await e.STORE.get(rateKey) || 0) >= 10) return J({ error: 'محاولات تسجيل دخول كثيرة. حاول بعد 15 دقيقة.' }, 429);
    const b = await B(r), email = String(b.email || '').trim().toLowerCase().slice(0, 160), password = String(b.password || '');
    if (!email || !password || password.length > 128) return J({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' }, 401);
    const row = await e.DB.prepare('SELECT id,account_id,name,email,password_hash,salt,avatar,theme,plan,plan_status,plan_expires_at,team_owner_id FROM users WHERE email=?').bind(email).first();
    if (!row || await H(password, row.salt) !== row.password_hash) {
      const count = Number(await e.STORE.get(rateKey) || 0) + 1;
      await e.STORE.put(rateKey, String(count), { expirationTtl: 900 });
      return J({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' }, 401);
    }
    await e.STORE.delete(rateKey);
    const token = id();
    await e.DB.prepare('INSERT INTO sessions(token,user_id,expires_at,created_at) VALUES(?,?,?,?)').bind(token, row.id, now() + SESSION_TTL * 1000, now()).run();
    return J({ ok: true, user: safeUser(row) }, 200, { 'set-cookie': sc('nxsession', token, SESSION_TTL) });
  }
  if (p === '/api/logout' && m === 'POST') {
    const token = ck(r, 'nxsession');
    if (token) await e.DB.prepare('DELETE FROM sessions WHERE token=?').bind(token).run();
    return J({ ok: true }, 200, { 'set-cookie': sc('nxsession', '', 0) });
  }
  return null;
}
export { handleAuthApi };
