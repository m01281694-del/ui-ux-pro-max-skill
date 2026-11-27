// Prestataire de paiement. Par défaut : DÉSACTIVÉ (aucun paiement réel sans autorisation explicite).
// Le frontend ne reçoit jamais de clé secrète ; il ne peut que demander une intention de changement.
// L'abonnement n'est JAMAIS activé par ce module : seuls les webhooks vérifiés modifient l'état.
export class BillingDisabledError extends Error {
  constructor() { super('billing_disabled'); }
}

export class DisabledBillingProvider {
  name = 'disabled';
  enabled = false;
  async startCheckout() { throw new BillingDisabledError(); }
  async changePlan() { throw new BillingDisabledError(); }
  async cancelAtPeriodEnd() { throw new BillingDisabledError(); }
  async resume() { throw new BillingDisabledError(); }
  async portal() { throw new BillingDisabledError(); }
}

// Prestataire de test : enregistre les appels ; l'état ne change que lorsque le test envoie le webhook signé.
export class FakeBillingProvider {
  name = 'fake';
  enabled = true;
  constructor() { this.calls = []; this.fail = false; }
  async #call(op, args) {
    this.calls.push({ op, ...args });
    if (this.fail) throw new Error('provider_unavailable');
    return { reference: `fake_${op}_${this.calls.length}` };
  }
  startCheckout(a) { return this.#call('startCheckout', a).then((r) => ({ ...r, url: 'https://checkout.invalid/session' })); }
  changePlan(a) { return this.#call('changePlan', a); }
  cancelAtPeriodEnd(a) { return this.#call('cancelAtPeriodEnd', a); }
  resume(a) { return this.#call('resume', a); }
  portal(a) { return this.#call('portal', a).then((r) => ({ ...r, url: 'https://billing.invalid/portal' })); }
}

// Implémentation Stripe (API REST, form-encoded, version d'API figée).
// Testée contre un faux serveur Stripe (test/stripe.test.mjs) ; à valider en mode test Stripe avant production.
// Activation : BILLING_PROVIDER=stripe + STRIPE_SECRET_KEY + STRIPE_PRICE_<PLAN> + STRIPE_WEBHOOK_SECRET + APP_URL.
export const STRIPE_API_VERSION = '2024-06-20';

export class StripeBillingProvider {
  name = 'stripe';
  enabled = true;
  constructor({ secretKey, priceMap, appUrl, automaticTax = false, fetchImpl = fetch, baseUrl = 'https://api.stripe.com' }) {
    if (!secretKey) throw new Error('STRIPE_SECRET_KEY manquant');
    if (!appUrl) throw new Error('APP_URL manquant');
    for (const plan of ['starter', 'pro', 'business']) if (!priceMap[plan]) throw new Error(`STRIPE_PRICE_${plan.toUpperCase()} manquant`);
    this.key = secretKey; this.priceMap = priceMap; this.appUrl = appUrl; this.fetch = fetchImpl; this.baseUrl = baseUrl;
    this.automaticTax = automaticTax;
    this.mode = secretKey.startsWith('sk_live_') ? 'live' : 'test';
  }
  async #api(method, pathname, params, idempotencyKey) {
    const res = await this.fetch(`${this.baseUrl}/v1/${pathname}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': STRIPE_API_VERSION,
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: params ? new URLSearchParams(params).toString() : undefined,
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`stripe_${res.status}_${body?.error?.code ?? 'error'}`);
    return body;
  }
  async startCheckout({ tenantId, planId, customerId, email, idempotencyKey }) {
    const s = await this.#api('POST', 'checkout/sessions', {
      mode: 'subscription',
      locale: 'fr',
      'line_items[0][price]': this.priceMap[planId],
      'line_items[0][quantity]': '1',
      success_url: `${this.appUrl}/app.html#/abonnement?paiement=confirmation`,
      cancel_url: `${this.appUrl}/app.html#/abonnement?paiement=annule`,
      client_reference_id: tenantId,
      'subscription_data[metadata][tenant_id]': tenantId,
      'metadata[tenant_id]': tenantId,
      billing_address_collection: 'required',
      'tax_id_collection[enabled]': 'true',
      ...(this.automaticTax ? { 'automatic_tax[enabled]': 'true' } : {}),
      ...(customerId ? { customer: customerId, 'customer_update[address]': 'auto', 'customer_update[name]': 'auto' } : (email ? { customer_email: email } : {})),
    }, idempotencyKey);
    return { reference: s.id, url: s.url };
  }
  // Portail client Stripe : moyen de paiement, factures, résiliation (configuré par scripts/stripe-setup.mjs).
  async portal({ customerId }) {
    const s = await this.#api('POST', 'billing_portal/sessions', { customer: customerId, locale: 'fr', return_url: `${this.appUrl}/app.html#/abonnement` });
    return { reference: s.id, url: s.url };
  }
  async changePlan({ subscriptionId, planId, kind, idempotencyKey }) {
    const sub = await this.#api('GET', `subscriptions/${subscriptionId}`);
    const item = sub.items.data[0].id;
    const s = await this.#api('POST', `subscriptions/${subscriptionId}`, {
      'items[0][id]': item,
      'items[0][price]': this.priceMap[planId],
      proration_behavior: kind === 'upgrade' ? 'always_invoice' : 'none',
      ...(kind === 'upgrade' ? { payment_behavior: 'pending_if_incomplete' } : {}),
    }, idempotencyKey);
    return { reference: s.id };
    // NB : pour une rétrogradation « à l'échéance », un Subscription Schedule est préférable —
    // la rétrogradation est donc planifiée côté RELANCEO (scheduled_plan_id) et appliquée au renouvellement.
  }
  async cancelAtPeriodEnd({ subscriptionId, idempotencyKey }) {
    return { reference: (await this.#api('POST', `subscriptions/${subscriptionId}`, { cancel_at_period_end: 'true' }, idempotencyKey)).id };
  }
  async resume({ subscriptionId, idempotencyKey }) {
    return { reference: (await this.#api('POST', `subscriptions/${subscriptionId}`, { cancel_at_period_end: 'false' }, idempotencyKey)).id };
  }
}

export function priceMapFromEnv(env = process.env) {
  return { starter: env.STRIPE_PRICE_STARTER, pro: env.STRIPE_PRICE_PRO, business: env.STRIPE_PRICE_BUSINESS };
}

export function billingProviderFromEnv(env = process.env) {
  if (env.BILLING_PROVIDER === 'demo') return new DemoBillingProvider();
  if (env.BILLING_PROVIDER === 'stripe') {
    return new StripeBillingProvider({ secretKey: env.STRIPE_SECRET_KEY, priceMap: priceMapFromEnv(env), appUrl: env.APP_URL, automaticTax: env.STRIPE_AUTOMATIC_TAX === 'true' });
  }
  return new DisabledBillingProvider();
}

// MODE DÉMONSTRATION (BILLING_PROVIDER=demo) : simule Stripe pour tester le parcours sans paiement.
// Les « paiements » passent par la page /demo-paiement.html, clairement signalée, puis par le MÊME
// traitement de webhooks que la production (handleBillingEvent). Aucun prélèvement n'est possible.
export class DemoBillingProvider {
  name = 'demo';
  enabled = true;
  demo = true;
  constructor() { this.sessions = new Map(); this.n = 0; }
  attach({ db, catalog, apply }) { this.db = db; this.catalog = catalog; this.apply = apply; }
  async startCheckout({ tenantId, planId }) {
    const id = `demo_cs_${Date.now()}_${++this.n}`;
    this.sessions.set(id, { tenantId, planId });
    return { reference: id, url: `/demo-paiement.html#session=${id}&offre=${planId}` };
  }
  async #subEvent(type, sub, overrides = {}) {
    const now = Math.floor(Date.now() / 1000);
    const start = sub?.current_period_start ? Math.floor(new Date(sub.current_period_start).getTime() / 1000) : now;
    const end = sub?.current_period_end ? Math.floor(new Date(sub.current_period_end).getTime() / 1000) : now + 30 * 86400;
    const o = { planId: sub?.plan_id, cancel: sub?.cancel_at_period_end ?? false, status: 'active', ...overrides };
    return this.apply({
      id: `evt_demo_${Date.now()}_${++this.n}`, type, created: now + this.n,
      data: { object: { id: o.subscriptionId ?? sub.provider_subscription_id, customer: o.customerId ?? sub.provider_customer_id, status: o.status,
        cancel_at_period_end: o.cancel, metadata: { tenant_id: o.tenantId ?? sub?.tenant_id },
        items: { data: [{ price: { id: `demo_price_${o.planId}` }, current_period_start: start, current_period_end: end }] } } },
    });
  }
  async #sub(subscriptionId) {
    return this.db.asService((tx) => tx.one('select * from subscriptions where provider_subscription_id = $1', [subscriptionId]), 'demo-billing');
  }
  async pay(sessionId) {
    const s = this.sessions.get(sessionId);
    if (!s) return false;
    this.sessions.delete(sessionId);
    const existing = await this.db.asService((tx) => tx.one('select provider_customer_id from subscriptions where tenant_id = $1', [s.tenantId]), 'demo-billing');
    const customerId = existing?.provider_customer_id ?? `demo_cus_${s.tenantId.slice(0, 8)}`;
    await this.#subEvent('customer.subscription.created', null, { tenantId: s.tenantId, planId: s.planId, customerId, subscriptionId: `demo_sub_${Date.now()}` });
    return true;
  }
  async changePlan({ subscriptionId, planId }) { const sub = await this.#sub(subscriptionId); await this.#subEvent('customer.subscription.updated', sub, { planId }); return { reference: 'demo' }; }
  async cancelAtPeriodEnd({ subscriptionId }) { const sub = await this.#sub(subscriptionId); await this.#subEvent('customer.subscription.updated', sub, { cancel: true }); return { reference: 'demo' }; }
  async resume({ subscriptionId }) { const sub = await this.#sub(subscriptionId); await this.#subEvent('customer.subscription.updated', sub, { cancel: false }); return { reference: 'demo' }; }
  async portal() { return { reference: 'demo', url: '/demo-paiement.html#portail=1' }; }
}
