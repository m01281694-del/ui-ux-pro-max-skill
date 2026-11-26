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
}

// Implémentation Stripe (API REST, form-encoded). NON testée contre Stripe dans ce dépôt.
// Activation : BILLING_PROVIDER=stripe + STRIPE_SECRET_KEY + STRIPE_PRICE_<PLAN> + STRIPE_WEBHOOK_SECRET.
export class StripeBillingProvider {
  name = 'stripe';
  enabled = true;
  constructor({ secretKey, priceMap, appUrl, fetchImpl = fetch }) {
    if (!secretKey) throw new Error('STRIPE_SECRET_KEY manquant');
    this.key = secretKey; this.priceMap = priceMap; this.appUrl = appUrl; this.fetch = fetchImpl;
  }
  async #api(method, pathname, params, idempotencyKey) {
    const res = await this.fetch(`https://api.stripe.com/v1/${pathname}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: params ? new URLSearchParams(params).toString() : undefined,
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`stripe_${res.status}_${body?.error?.code ?? 'error'}`);
    return body;
  }
  async startCheckout({ tenantId, planId, customerId, idempotencyKey }) {
    const s = await this.#api('POST', 'checkout/sessions', {
      mode: 'subscription',
      'line_items[0][price]': this.priceMap[planId],
      'line_items[0][quantity]': '1',
      success_url: `${this.appUrl}/app.html?checkout=pending`,
      cancel_url: `${this.appUrl}/pricing.html`,
      client_reference_id: tenantId,
      'subscription_data[metadata][tenant_id]': tenantId,
      ...(customerId ? { customer: customerId } : {}),
    }, idempotencyKey);
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
  if (env.BILLING_PROVIDER === 'stripe') {
    return new StripeBillingProvider({ secretKey: env.STRIPE_SECRET_KEY, priceMap: priceMapFromEnv(env), appUrl: env.APP_URL });
  }
  return new DisabledBillingProvider();
}
