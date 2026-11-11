import { ck, now } from './utils.js';
// Session lookup and subscription entitlement checks.
async function U(r,e){const t=ck(r,'nxsession');if(!t)return null;const s=await e.DB.prepare('SELECT user_id,expires_at FROM sessions WHERE token=?').bind(t).first();if(!s||s.expires_at<=now()){if(s)await e.DB.prepare('DELETE FROM sessions WHERE token=?').bind(t).run();return null}return await e.DB.prepare('SELECT id,account_id,name,email,avatar,theme,plan,plan_status,plan_expires_at,team_owner_id,team_members FROM users WHERE id=?').bind(s.user_id).first()}
const P=u=>u&&u.plan_status==='active'&&['plus','team'].includes(u.plan)&&(!u.plan_expires_at||u.plan_expires_at>now());
export { U, P };
