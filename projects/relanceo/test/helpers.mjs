import { buildApp } from '../src/app.js';
import { listen, createSession } from '../src/http/server.js';
import { createTenantWithOwner, operatorSetSubscription, createUser } from '../src/accounts.js';
import { FakeAiProvider } from '../src/ai/gateway.js';
import { MemoryEmailProvider } from '../src/email/provider.js';
import { FakeBillingProvider } from '../src/billing/provider.js';
import { signPayload } from '../src/billing/signature.js';

export const WEBHOOK_SECRET = 'whsec_test_secret';
export const INBOUND_SECRET = 'inbound_test_secret';
export const PRICES = { starter: 'price_starter_test', pro: 'price_pro_test', business: 'price_business_test' };

export async function startEnv({ env: envOverrides = {}, services = {} } = {}) {
  const env = {
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    INBOUND_WEBHOOK_SECRET: INBOUND_SECRET,
    STRIPE_PRICE_STARTER: PRICES.starter,
    STRIPE_PRICE_PRO: PRICES.pro,
    STRIPE_PRICE_BUSINESS: PRICES.business,
    AUTOMATIONS_ENABLED: 'true',
    ...envOverrides,
  };
  const fakes = {
    ai: new FakeAiProvider(),
    email: new MemoryEmailProvider(),
    billing: new FakeBillingProvider(),
    ...services,
  };
  // TEST_DATABASE_URL défini => chaque environnement de test obtient une base Postgres neuve.
  let databaseUrl;
  let dropDb = async () => {};
  if (process.env.TEST_DATABASE_URL) {
    const { default: pg } = await import('pg');
    const name = `relanceo_t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const admin = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
    await admin.connect();
    await admin.query(`create database ${name}`);
    await admin.end();
    const u = new URL(process.env.TEST_DATABASE_URL);
    u.pathname = `/${name}`;
    databaseUrl = u.toString();
    dropDb = async () => {
      const c = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
      await c.connect();
      await c.query(`drop database if exists ${name} with (force)`);
      await c.end();
    };
  }
  const built = await buildApp({ env, services: fakes, databaseUrl: databaseUrl ?? null });
  const server = await listen(built.app, 0);
  const base = `http://127.0.0.1:${server.address().port}`;

  async function api(token, method, path, body, headers = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, body: json };
  }

  // Crée une entreprise avec un propriétaire et (optionnellement) un abonnement.
  async function tenant(plan, { status = 'active', name, email } = {}) {
    const n = Math.random().toString(36).slice(2, 8);
    const { tenantId, userId } = await createTenantWithOwner(built.db, {
      tenantName: name ?? `Entreprise ${plan} ${n}`, email: email ?? `owner-${plan}-${n}@example.test`,
    });
    if (plan) await operatorSetSubscription(built.db, tenantId, { planId: plan, status, actor: 'test' });
    const token = await createSession(built.db, userId, 24 * 365);
    const call = (method, path, body, headers) => api(token, method, path, body, headers);
    return { tenantId, userId, token, call };
  }

  async function addMember(t, role = 'member') {
    const email = `m-${Math.random().toString(36).slice(2, 8)}@example.test`;
    const inv = await t.call('POST', '/api/team/invitations', { email, role });
    if (inv.status !== 201) return { inv };
    const userId = await createUser(built.db, email);
    const token = await createSession(built.db, userId, 24 * 365);
    const call = (method, path, body, headers) => api(token, method, path, body, headers);
    const acc = await call('POST', '/api/invitations/accept', { token: inv.body.accept_token });
    return { inv, acc, userId, token, call };
  }

  function webhook(event, { secret = WEBHOOK_SECRET, timestamp } = {}) {
    const payload = JSON.stringify(event);
    return api(null, 'POST', '/api/webhooks/stripe', payload, {
      'Content-Type': 'application/json', 'Stripe-Signature': signPayload(secret, payload, timestamp),
    });
  }

  function inbound(payloadObj, secret = INBOUND_SECRET) {
    const payload = JSON.stringify(payloadObj);
    return api(null, 'POST', '/api/webhooks/inbound-email', payload, {
      'Content-Type': 'application/json', 'X-Relanceo-Signature': signPayload(secret, payload),
    });
  }

  async function close() {
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
    await built.db.close();
    await dropDb();
  }

  return { ...built, ...fakes, env, base, api, tenant, addMember, webhook, inbound, close };
}

let seq = 0;
export function stripeSubEvent(type, { tenantId, customer, subscription, price, status = 'active', start, end, cancelAtPeriodEnd = false, created }) {
  seq += 1;
  return {
    id: `evt_${Date.now()}_${seq}`,
    type,
    created: created ?? Math.floor(Date.now() / 1000) + seq,
    data: {
      object: {
        id: subscription, customer, status, cancel_at_period_end: cancelAtPeriodEnd,
        metadata: { tenant_id: tenantId },
        items: { data: [{ price: { id: price }, current_period_start: start, current_period_end: end }] },
      },
    },
  };
}

export function invoiceEvent(type, { customer, subscription, billingReason = 'subscription_cycle', start, end, created }) {
  seq += 1;
  return {
    id: `evt_inv_${Date.now()}_${seq}`, type, created: created ?? Math.floor(Date.now() / 1000) + seq,
    data: { object: { id: `in_${seq}`, customer, subscription, billing_reason: billingReason,
      lines: { data: start ? [{ period: { start, end } }] : [] } } },
  };
}
