// Shared HTTP, cookie, request-body, ID, time, and password-hash helpers.
const J=(d,s=200,h={})=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...h}});
const id=()=>crypto.randomUUID(),now=()=>Date.now(),ck=(r,n)=>(r.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(n+'='))?.slice(n.length+1),B=async r=>{try{return await r.json()}catch{return {}}},sc=(n,v,t)=>n+'='+v+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+t;
export { J, id, now, ck, B, sc, H };
