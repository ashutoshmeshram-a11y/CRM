import { getStore } from '@netlify/blobs';

const STORE_NAME = 'crm-leads';
const KEY = 'leads';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

const first = (...values) => values.find(v => v !== undefined && v !== null && String(v).trim() !== '');
const text = v => v == null ? '' : String(v).trim();

function normalize(payload) {
  const root = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const lead = root?.lead && typeof root.lead === 'object' ? root.lead : root;
  const name = first(lead.name, lead.full_name, lead.fullName, lead.customer_name, lead.contact_name, [lead.first_name, lead.last_name].filter(Boolean).join(' '));
  const email = first(lead.email, lead.email_address, lead.Email);
  const phone = first(lead.phone, lead.phone_number, lead.mobile, lead.mobile_number, lead.Phone);
  if (!name && !email && !phone) return null;
  const source = '5-Day Reset Challenge';
  const externalId = first(lead.id, lead.lead_id, lead.contact_id, lead.submission_id, lead.form_submission_id);
  const fingerprint = text(externalId) || `${text(email).toLowerCase()}|${text(phone)}|${text(name).toLowerCase()}|${source}`;
  return {
    id: `ff-${fingerprint.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120)}`,
    name: text(name) || 'New Lead',
    email: text(email),
    phone: text(phone),
    stage: 'new',
    source,
    ownerId: '',
    notes: 'Captured from FlexiFunnels 5-Day Reset Challenge',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    flexiFunnels: lead
  };
}

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  try {
    const expected = Netlify.env.get('FLEXIFUNNELS_WEBHOOK_SECRET');
    if (expected) {
      const supplied = request.headers.get('x-webhook-secret') || new URL(request.url).searchParams.get('secret');
      if (supplied !== expected) return json({ error: 'Unauthorized webhook' }, 401);
    }
    const payload = await request.json();
    const lead = normalize(payload);
    if (!lead) return json({ error: 'No name, email, or phone found in webhook payload' }, 400);

    const store = getStore(STORE_NAME, { consistency: 'strong' });
    const existing = (await store.get(KEY, { type: 'json' })) ?? [];
    const leads = Array.isArray(existing) ? existing : [];
    const email = lead.email.toLowerCase();
    const phone = lead.phone.replace(/\D/g, '');
    const duplicateIndex = leads.findIndex(l =>
      (lead.flexiFunnels?.id && (l.flexiFunnels?.id === lead.flexiFunnels.id || l.id === lead.id)) ||
      (email && text(l.email).toLowerCase() === email) ||
      (phone && text(l.phone).replace(/\D/g, '') === phone)
    );

    if (duplicateIndex >= 0) {
      const old = leads[duplicateIndex];
      leads[duplicateIndex] = { ...old, name: lead.name || old.name, email: lead.email || old.email, phone: lead.phone || old.phone, source: old.source || lead.source, updatedAt: new Date().toISOString(), flexiFunnels: lead.flexiFunnels };
      await store.setJSON(KEY, leads);
      return json({ received: true, duplicate: true, lead: leads[duplicateIndex] });
    }

    leads.unshift(lead);
    await store.setJSON(KEY, leads);
    return json({ received: true, duplicate: false, lead });
  } catch (error) {
    console.error(error);
    return json({ error: 'Unable to save FlexiFunnels lead' }, 500);
  }
}
