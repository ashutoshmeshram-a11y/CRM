import { getStore } from '@netlify/blobs';

const STORE = 'crm-auth';
const USERS = 'users';
const SESSIONS = 'sessions';
const SESSION_DAYS = 7;

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const b64 = (s) => Buffer.from(s).toString('base64url');
const rand = () => b64(crypto.getRandomValues(new Uint8Array(32)));
const hash = async (value) => b64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));

async function getUsers(store) {
  const users = await store.get(USERS, { type: 'json' });
  if (Array.isArray(users) && users.length) return users;
  const adminPassword = Netlify.env.get('CRM_ADMIN_PASSWORD');
  if (!adminPassword) return [];
  const admin = { id: 'admin', name: 'Administrator', username: 'admin', role: 'admin', passwordHash: await hash(adminPassword) };
  await store.setJSON(USERS, [admin]);
  return [admin];
}

export async function authenticate(request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const store = getStore(STORE, { consistency: 'strong' });
  const sessions = (await store.get(SESSIONS, { type: 'json' })) || {};
  const session = sessions[token];
  if (!session || session.expiresAt < Date.now()) return null;
  const users = await getUsers(store);
  return users.find(u => u.id === session.userId) || null;
}

export default async function handler(request) {
  try {
    const store = getStore(STORE, { consistency: 'strong' });
    const users = await getUsers(store);
    if (request.method === 'POST') {
      const { username, password } = await request.json();
      const user = users.find(u => u.username.toLowerCase() === String(username || '').trim().toLowerCase());
      if (!user || !(await hash(String(password || ''))) === user.passwordHash) return json({ error: 'Invalid username or password' }, 401);
      const token = rand();
      const sessions = (await store.get(SESSIONS, { type: 'json' })) || {};
      sessions[token] = { userId: user.id, expiresAt: Date.now() + SESSION_DAYS * 86400000 };
      await store.setJSON(SESSIONS, sessions);
      return json({ token, user: { id: user.id, name: user.name, username: user.username, role: user.role } });
    }
    if (request.method === 'GET') {
      const user = await authenticate(request);
      return user ? json({ authenticated: true, user: { id: user.id, name: user.name, username: user.username, role: user.role } }) : json({ authenticated: false }, 401);
    }
    if (request.method === 'DELETE') {
      const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
      const sessions = (await store.get(SESSIONS, { type: 'json' })) || {};
      delete sessions[token];
      await store.setJSON(SESSIONS, sessions);
      return json({ loggedOut: true });
    }
    return json({ error: 'Method not allowed' }, 405);
  } catch (e) { return json({ error: e instanceof Error ? e.message : String(e) }, 500); }
}
