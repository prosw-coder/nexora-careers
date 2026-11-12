import { PAGE } from './frontend/public-page.js';
import { ADMIN } from './frontend/admin-page.js';
import { J } from './backend/utils.js';
import { handleAuthApi } from './backend/auth-api.js';
import { handlePublicReadApi } from './backend/public-api.js';
import { handleAccountApi } from './backend/account-api.js';
import { handleAdminApi } from './backend/admin-api.js';
async function route(r,e){const u=new URL(r.url),p=u.pathname,m=r.method;
if(p==='/'&&m==='GET'){let visitor=(r.headers.get('cookie')||'').match(/(?:^|;\s*)nxvisitor=([a-zA-Z0-9-]{20,60})(?:;|$)/)?.[1],fresh=!visitor;if(!visitor)visitor=crypto.randomUUID();if(e.DB)await e.DB.prepare('INSERT INTO site_visitors(visitor_id,first_seen,last_seen,visit_count) VALUES(?,?,?,1) ON CONFLICT(visitor_id) DO UPDATE SET last_seen=excluded.last_seen,visit_count=site_visitors.visit_count+1').bind(visitor,Date.now(),Date.now()).run();const h=new Headers({'content-type':'text/html; charset=utf-8','cache-control':'no-store'});if(fresh)h.append('set-cookie','nxvisitor='+visitor+'; Path=/; Max-Age=31536000; Secure; HttpOnly; SameSite=Lax');return new Response(PAGE,{headers:h})}
if(p==='/admin'&&m==='GET')return new Response(ADMIN,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
if(p==='/robots.txt'&&m==='GET')return new Response('User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/',{headers:{'content-type':'text/plain; charset=utf-8','cache-control':'public, max-age=3600'}});
if(p==='/health')return J({ok:true,service:'NEXORA CAREERS'});
if(p.startsWith('/assets/')&&m==='GET'){const key=decodeURIComponent(p.slice(8));const obj=await e.ASSETS.get(key);if(!obj)return J({error:'الملف غير موجود.'},404);const h=new Headers();obj.writeHttpMetadata(h);h.set('etag',obj.httpEtag);h.set('cache-control','public, max-age=31536000, immutable');return new Response(obj.body,{headers:h})}
const authResponse=await handleAuthApi(p,m,r,e);if(authResponse)return authResponse;
const publicReadResponse=await handlePublicReadApi(p,m,r,e);if(publicReadResponse)return publicReadResponse;
const accountResponse=await handleAccountApi(p,m,r,e);if(accountResponse)return accountResponse;
const adminResponse=await handleAdminApi(p,m,r,e);if(adminResponse)return adminResponse;
return J({error:'المسار غير موجود.'},404)}
export default {async fetch(req,env){try{const response=await route(req,env);const headers=new Headers(response.headers);headers.set('x-content-type-options','nosniff');headers.set('x-frame-options','DENY');headers.set('referrer-policy','strict-origin-when-cross-origin');headers.set('permissions-policy','camera=(), microphone=(), geolocation=()');headers.set('strict-transport-security','max-age=31536000');return new Response(response.body,{status:response.status,statusText:response.statusText,headers})}catch(err){const response=J({error:'خطأ داخلي في الخادم.'},500);const headers=new Headers(response.headers);headers.set('x-content-type-options','nosniff');headers.set('x-frame-options','DENY');headers.set('referrer-policy','strict-origin-when-cross-origin');headers.set('strict-transport-security','max-age=31536000');return new Response(response.body,{status:500,headers})}}};