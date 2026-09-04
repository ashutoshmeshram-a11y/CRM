import { getStore } from '@netlify/blobs';

const STORE_NAME = 'crm-leads';
const KEY = 'leads';

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate',
    },
  });
}

export default async function handler(request) {
  try {
    const store = getStore(STORE_NAME, { consistency: 'strong' });

    if (request.method === 'GET') {
      const leads = (await store.get(KEY, { type: 'json' })) ?? [];
      return response({ leads: Array.isArray(leads) ? leads : [] });
    }

    if (request.method === 'PUT') {
      const payload = await request.json();
      if (!payload || !Array.isArray(payload.leads)) {
        return response({ error: 'leads must be an array' }, 400);
      }
      await store.setJSON(KEY, payload.leads);
      return response({ leads: payload.leads, saved: true });
    }

    if (request.method === 'DELETE') {
      await store.delete(KEY);
      return response({ leads: [], saved: true });
    }

    return response({ error: 'Method not allowed' }, 405);
  } catch (error) {
    console.error('CRM storage error:', error);
    return response({
      error: 'Unable to access persistent lead storage',
      detail: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}
