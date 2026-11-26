// Intégration Stripe testée contre un FAUX serveur Stripe en mémoire (aucun appel réseau).
// Vérifie les requêtes envoyées (chemin, paramètres, en-têtes, idempotence) et le parcours complet :
// inscription -> paiement -> webhooks signés -> offre active -> portail client.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startEnv, stripeSubEvent, invoiceEvent, PRICES } from './helpers.mjs';
import { StripeBillingProvider, STRIPE_API_VERSION } from '../src/billing/provider.js';
import { setupStripe, WEBHOOK_EVENTS } from '../scripts/stripe-setup.mjs';

function fakeStripe() {
  const calls = [];
  const state = { prices: [], hooks: [], n: 0 };
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    const params = Object.fromEntries(new URLSearchParams(init.method === 'GET' ? u.search : init.body ?? ''));
    calls.push({ method: init.method, path: u.pathname, params, headers: init.headers });
    const ok = (body) => ({ ok: true, status: 200, json: async () => body });
    const id = (p) => `${p}_${++state.n}`;
    const p = u.pathname;
    if (init.headers.Authorization !== 'Bearer sk_test_fake') return { ok: false, status: 401, json: async () => ({ error: { code: 'invalid_key', message: 'bad key' } }) };
    if (p === '/v1/checkout/sessions') return ok({ id: id('cs'), url: `https://checkout.stripe.test/${state.n}` });
    if (p === '/v1/billing_portal/sessions') return ok({ id: id('bps'), url: 'https://billing.stripe.test/session' });
    if (p.startsWith('/v1/subscriptions/') && init.method === 'GET') return ok({ id: 'sub_1', items: { data: [{ id: 'si_1' }] } });
    if (p.startsWith('/v1/subscriptions/')) return ok({ id: 'sub_1' });
    if (p === '/v1/prices' && init.method === 'GET') return ok({ data: state.prices.filter((x) => x.lookup_key === params['lookup_keys[]']) });
    if (p === '/v1/products') return ok({ id: id('prod') });
    if (p === '/v1/prices') { const pr = { id: id('price'), unit_amount: Number(params.unit_amount), currency: params.currency, lookup_key: params.lookup_key }; state.prices.push(pr); return ok(pr); }
    if (p === '/v1/webhook_endpoints' && init.method === 'GET') return ok({ data: state.hooks });
    if (p === '/v1/webhook_endpoints') { const h = { id: id('we'), url: params.url, secret: 'whsec_created' }; state.hooks.push(h); return ok(h); }
    if (p === '/v1/billing_portal/configurations') return ok({ id: id('bpc') });
    return { ok: false, status: 404, json: async () => ({ error: { code: 'not_found' } }) };
  };
  return { calls, state, fetchImpl };
}

let env;
let stripe;
before(async () => {
  stripe = fakeStripe();
  const provider = new StripeBillingProvider({ secretKey: 'sk_test_fake', priceMap: PRICES, appUrl: 'https://app.relanceo.test', fetchImpl: stripe.fetchImpl });
  env = await startEnv({ services: { billing: provider, appUrl: 'https://app.relanceo.test' } });
});
after(() => env.close());

test('Configuration incomplète refusée au démarrage (prix ou URL manquants)', () => {
  assert.throws(() => new StripeBillingProvider({ secretKey: 'sk_test_x', priceMap: { starter: 'p' }, appUrl: 'https://x' }), /STRIPE_PRICE_PRO/);
  assert.throws(() => new StripeBillingProvider({ secretKey: 'sk_test_x', priceMap: PRICES }), /APP_URL/);
});

test('Parcours complet : inscription -> page de paiement Stripe -> webhooks -> offre active -> portail', async () => {
  const signup = await env.api(null, 'POST', '/api/auth/signup', { company: 'Menuiserie Martin', email: 'contact@martin.test', password: 'MotDePasse-2026', accept_terms: true });
  assert.equal(signup.status, 201);
  const { createSession } = await import('../src/http/server.js');
  const token = await createSession(env.db, signup.body.user_id);
  const call = (m, p, b) => env.api(token, m, p, b);

  const co = await call('POST', '/api/billing/checkout', { plan: 'business', price_cents: 1 });
  assert.equal(co.status, 201, JSON.stringify(co.body));
  assert.match(co.body.checkout_url, /^https:\/\/checkout\.stripe\.test\//);
  const req = stripe.calls.find((c) => c.path === '/v1/checkout/sessions');
  assert.equal(req.params['line_items[0][price]'], PRICES.business, 'le prix vient du serveur, pas du navigateur');
  assert.equal(req.params.mode, 'subscription');
  assert.equal(req.params['subscription_data[metadata][tenant_id]'], signup.body.tenant_id);
  assert.equal(req.params.customer_email, 'contact@martin.test');
  assert.equal(req.params.locale, 'fr');
  assert.equal(req.headers['Stripe-Version'], STRIPE_API_VERSION);
  assert.ok(req.headers['Idempotency-Key']);
  assert.equal((await call('GET', '/api/entitlements')).body.access_mode, 'readonly', 'rien n\'est actif avant le webhook');

  const now = Math.floor(Date.now() / 1000);
  await env.webhook(stripeSubEvent('customer.subscription.created', { tenantId: signup.body.tenant_id, customer: 'cus_martin', subscription: 'sub_martin', price: PRICES.business, start: now, end: now + 30 * 86400 }));
  await env.webhook(invoiceEvent('invoice.paid', { customer: 'cus_martin', subscription: 'sub_martin', billingReason: 'subscription_create' }));
  const ent = (await call('GET', '/api/entitlements')).body;
  assert.deepEqual([ent.plan_id, ent.status, ent.access_mode], ['business', 'active', 'full']);
  assert.equal((await call('POST', '/api/billing/checkout', { plan: 'pro' })).status, 409, 'pas de double abonnement');

  const portal = await call('POST', '/api/billing/portal');
  assert.equal(portal.status, 200);
  assert.equal(portal.body.url, 'https://billing.stripe.test/session');
  assert.equal(stripe.calls.find((c) => c.path === '/v1/billing_portal/sessions').params.customer, 'cus_martin');

  const up = await call('POST', '/api/billing/change-plan', { plan: 'pro' });
  assert.equal(up.status, 202);
  const upd = stripe.calls.filter((c) => c.path === '/v1/subscriptions/sub_martin' && c.method === 'POST').at(-1);
  assert.equal(upd.params['items[0][price]'], PRICES.pro);
  assert.equal(upd.params.proration_behavior, 'none', 'rétrogradation : pas de remboursement au prorata');
  const cancel = await call('POST', '/api/billing/cancel');
  assert.equal(cancel.status, 202);
  assert.equal(stripe.calls.at(-1).params.cancel_at_period_end, 'true');
});

test('Erreur Stripe (clé invalide) : message clair, aucun changement', async () => {
  const bad = new StripeBillingProvider({ secretKey: 'sk_test_mauvaise', priceMap: PRICES, appUrl: 'https://x.test', fetchImpl: stripe.fetchImpl });
  await assert.rejects(bad.startCheckout({ tenantId: 't', planId: 'pro' }), /stripe_401_invalid_key/);
});

test('Script de configuration Stripe : produits, prix aux bons montants, webhook, portail ; relançable', async () => {
  const s = fakeStripe();
  const logs = [];
  const out = await setupStripe({ secretKey: 'sk_test_fake', appUrl: 'https://app.relanceo.test', fetchImpl: s.fetchImpl, log: (m) => logs.push(m) });
  assert.deepEqual(s.state.prices.map((p) => [p.lookup_key, p.unit_amount, p.currency]), [
    ['relanceo_starter_monthly_v1', 4999, 'eur'], ['relanceo_pro_monthly_v1', 9900, 'eur'], ['relanceo_business_monthly_v1', 14999, 'eur']]);
  assert.equal(s.calls.find((c) => c.path === '/v1/prices' && c.method === 'POST').params.tax_behavior, 'inclusive');
  const hook = s.calls.find((c) => c.path === '/v1/webhook_endpoints' && c.method === 'POST');
  assert.equal(hook.params.url, 'https://app.relanceo.test/api/webhooks/stripe');
  assert.deepEqual(Object.entries(hook.params).filter(([k]) => k.startsWith('enabled_events')).map(([, v]) => v), WEBHOOK_EVENTS);
  assert.equal(out.STRIPE_WEBHOOK_SECRET, 'whsec_created');
  assert.equal(out.STRIPE_PRICE_PRO, s.state.prices[1].id);
  const portal = s.calls.find((c) => c.path === '/v1/billing_portal/configurations');
  assert.equal(portal.params['features[subscription_cancel][mode]'], 'at_period_end');
  assert.equal(portal.params['features[subscription_update][enabled]'], 'false');
  const before = s.state.prices.length;
  await setupStripe({ secretKey: 'sk_test_fake', appUrl: 'https://app.relanceo.test', fetchImpl: s.fetchImpl, log: () => {} });
  assert.equal(s.state.prices.length, before, 'relance sans doublon de prix');
  await assert.rejects(setupStripe({ secretKey: 'sk_test_fake', appUrl: 'http://localhost:3000', fetchImpl: s.fetchImpl }), /https/);
});
