import { PAGE } from './frontend/public-page.js';
import { ADMIN } from './frontend/admin-page.js';
import { J } from './backend/utils.js';
import { handleAuthApi } from './backend/auth-api.js';
import { handlePublicReadApi } from './backend/public-api.js';
import { handleAccountApi } from './backend/account-api.js';
import { handleAdminApi } from './backend/admin-api.js';
async function route(r,e){const u=new URL(r.url),p=u.pathname,m=r.method;
if(p==='/'&&m==='GET')return new Response(PAGE,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
if(p==='/admin'&&m==='GET')return new Response(ADMIN,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
if(p==='/health')return J({ok:true,service:'NEXORA CAREERS'});
const authResponse=await handleAuthApi(p,m,r,e);if(authResponse)return authResponse;
const publicReadResponse=await handlePublicReadApi(p,m,r,e);if(publicReadResponse)return publicReadResponse;
const accountResponse=await handleAccountApi(p,m,r,e);if(accountResponse)return accountResponse;
const adminResponse=await handleAdminApi(p,m,r,e);if(adminResponse)return adminResponse;
return J({error:'المسار غير موجود.'},404)}
export default {async fetch(req,env){try{return await route(req,env)}catch(err){const p=new URL(req.url).pathname;return J({error:'خطأ داخلي في الخادم.'},500)}}};