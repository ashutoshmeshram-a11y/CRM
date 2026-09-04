import { getStore } from '@netlify/blobs';

const STORE_NAME = 'crm-leads';
const KEY = 'leads';

function json(body, status = 200) {
  return {
    statusCode: status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify(body),
  };
}

export default async function handler(request) {
  const store = getStore(STORE_NAME);

  try {
    if (request.method === 'GET') {
      const leads = (await store.get(KEY, { type: 'json' })) ?? [];
      return json({ leads });
    }

    if (request.method === 'PUT') {
      const payload = await request.json();
      if (!Array.isArray(payload.leads)) return json({ error: 'leads must be an array' }, 400);
      await store.setJSON(KEY, payload.leads);
      return json({ leads: payload.leads });
    }

    if (request.method === 'DELETE') {
      await store.delete(KEY);
      return json({ leads: [] });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (error) {
    console.error('CRM storage error:', error);
    return json({ error: 'Unable to access persistent lead storage' }, 500);
  }
}
