import { getStore } from '@netlify/blobs';

const STORE='crm-auth', USERS='users', SESSIONS='sessions', SESSION_DAYS=7;
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const b64=s=>Buffer.from(s).toString('base64url');
const rand=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
const hash=async value=>b64(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
const publicUser=u=>({id:u.id,name:u.name,username:u.username,role:u.role});

async function getUsers(store){
  const users=await store.get(USERS,{type:'json'});
  if(Array.isArray(users)&&users.length)return users;
  const password=Netlify.env.get('CRM_ADMIN_PASSWORD');
  if(!password) return [];
  const admin={id:'admin',name:'Administrator',username:'admin',role:'admin',passwordHash:await hash(password)};
  await store.setJSON(USERS,[admin]); return [admin];
}
export async function authenticate(request){
  const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,''); if(!token)return null;
  const store=getStore(STORE,{consistency:'strong'}); const sessions=(await store.get(SESSIONS,{type:'json'}))||{}; const s=sessions[token];
  if(!s||s.expiresAt<Date.now())return null; const users=await getUsers(store); return users.find(u=>u.id===s.userId)||null;
}
export default async function handler(request){
 try{
  const store=getStore(STORE,{consistency:'strong'}); const users=await getUsers(store);
  if(request.method==='POST'){
   const {username,password}=await request.json(); const user=users.find(u=>u.username.toLowerCase()===String(username||'').trim().toLowerCase());
   if(!user || (await hash(String(password||'')))!==user.passwordHash)return json({error:'Invalid username or password'},401);
   const token=rand(); const sessions=(await store.get(SESSIONS,{type:'json'}))||{}; sessions[token]={userId:user.id,expiresAt:Date.now()+SESSION_DAYS*86400000}; await store.setJSON(SESSIONS,sessions);
   return json({token,user:publicUser(user)});
  }
  if(request.method==='GET'){const user=await authenticate(request); return user?json({authenticated:true,user:publicUser(user)}):json({authenticated:false},401);}
  if(request.method==='DELETE'){const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'');const sessions=(await store.get(SESSIONS,{type:'json'}))||{};if(token)delete sessions[token];await store.setJSON(SESSIONS,sessions);return json({loggedOut:true});}
  if(request.method==='PUT'){
   const actor=await authenticate(request); if(!actor||actor.role!=='admin')return json({error:'Admin access required'},403);
   const body=await request.json(); const username=String(body.username||'').trim(); const name=String(body.name||username).trim(); const password=String(body.password||'');
   if(!username||password.length<8)return json({error:'Username and password (8+ characters) are required'},400);
   if(users.some(u=>u.username.toLowerCase()===username.toLowerCase()))return json({error:'Username already exists'},409);
   users.push({id:'u_'+rand(),name,username,role:'coach',passwordHash:await hash(password)}); await store.setJSON(USERS,users); return json({users:users.map(publicUser)});
  }
  if(request.method==='PATCH'){
   const actor=await authenticate(request); if(!actor||actor.role!=='admin')return json({error:'Admin access required'},403);
   const body=await request.json(); const target=users.find(u=>u.id===body.id); if(!target)return json({error:'Coach not found'},404);
   if(body.name)target.name=String(body.name).trim(); if(body.password){if(String(body.password).length<8)return json({error:'Password must be at least 8 characters'},400);target.passwordHash=await hash(String(body.password));}
   await store.setJSON(USERS,users); return json({user:publicUser(target)});
  }
  return json({error:'Method not allowed'},405);
 }catch(e){return json({error:e instanceof Error?e.message:String(e)},500);}
}
