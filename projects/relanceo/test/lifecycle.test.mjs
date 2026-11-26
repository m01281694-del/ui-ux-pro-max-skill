import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startEnv, stripeSubEvent, invoiceEvent, PRICES } from './helpers.mjs';
import { signPayload } from '../src/billing/signature.js';
import { createTenantWithOwner } from '../src/accounts.js';
import { createSession } from '../src/http/server.js';
import { runAutomationTick } from '../src/automations/engine.js';

let env;
const DAY = 86400;
const T0 = Math.floor(new Date('2031-01-10T00:00:00Z').getTime() / 1000);
const setClock = (sec) => { env.db.clock = new Date(sec * 1000); };

before(async () => { env = await startEnv(); setClock(T0); });
after(() => env.close());
beforeEach(() => setClock(T0));

// Entreprise sans abonnement, comme après une inscription : l'abonnement viendra des webhooks.
async function freshTenant() {
  const n = Math.random().toString(36).slice(2, 8);
  const { tenantId, userId } = await createTenantWithOwner(env.db, { tenantName: `T ${n}`, email: `o-${n}@x.test` });
  const token = await createSession(env.db, userId, 24 * 365);
  return { tenantId, userId, call: (m, p, b, h) => env.api(token, m, p, b, h), cus: `cus_${n}`, sub: `sub_${n}` };
}

const subEvt = (t, type, price, extra = {}) => stripeSubEvent(type, {
  tenantId: t.tenantId, customer: t.cus, subscription: t.sub, price, start: T0, end: T0 + 30 * DAY, created: env.db.clock.getTime() / 1000 + 1, ...extra,
});

test('Sans abonnement confirmé : lecture seule, aucune création possible', async () => {
  const t = await freshTenant();
  const e = (await t.call('GET', '/api/entitlements')).body;
  assert.equal(e.status, 'none');
  assert.equal(e.access_mode, 'readonly');
  const r = await t.call('POST', '/api/requests', { subject: 'x' });
  assert.equal(r.status, 403);
  assert.equal(r.body.error.code, 'subscription_inactive');
});

test('Webhook : signature absente, falsifiée, périmée => refusé ; aucun changement', async () => {
  const t = await freshTenant();
  const evt = subEvt(t, 'customer.subscription.created', PRICES.business);
  const payload = JSON.stringify(evt);
  const none = await env.api(null, 'POST', '/api/webhooks/stripe', payload, { 'Content-Type': 'application/json' });
  assert.equal(none.status, 400);
  const forged = await env.webhook(evt, { secret: 'whsec_pirate' });
  assert.equal(forged.status, 400);
  const old = await env.webhook(evt, { timestamp: Math.floor(Date.now() / 1000) - 3600 });
  assert.equal(old.status, 400);
  const tampered = await env.api(null, 'POST', '/api/webhooks/stripe', payload.replace(PRICES.business, PRICES.pro), {
    'Content-Type': 'application/json', 'Stripe-Signature': signPayload('whsec_test_secret', payload) });
  assert.equal(tampered.status, 400, 'corps modifié après signature');
  assert.equal((await t.call('GET', '/api/entitlements')).body.status, 'none');
});

test('Redirection « succès » / checkout.session.completed n\'active rien', async () => {
  const t = await freshTenant();
  const r = await env.webhook({ id: `evt_cs_${t.sub}`, type: 'checkout.session.completed', created: T0, data: { object: { id: 'cs_1', client_reference_id: t.tenantId, metadata: { plan: 'business' } } } });
  assert.equal(r.status, 200);
  assert.equal(r.body.result, 'ignored');
  assert.equal((await t.call('GET', '/api/entitlements')).body.access_mode, 'readonly');
});

test('Cycle complet : création -> montée Starter→Pro→Business -> données conservées', async () => {
  const t = await freshTenant();
  assert.equal((await env.webhook(subEvt(t, 'customer.subscription.created', PRICES.starter))).status, 200);
  let e = (await t.call('GET', '/api/entitlements')).body;
  assert.equal(e.plan_id, 'starter');
  assert.equal(e.access_mode, 'full');
  const c = await t.call('POST', '/api/customers', { name: 'Fidèle', email: 'f@x.test' });
  const r = await t.call('POST', '/api/requests', { subject: 'Historique', customer_id: c.body.id });
  assert.equal(r.status, 201);

  // Demande de changement : rien ne change tant que le prestataire n'a pas confirmé.
  const ch = await t.call('POST', '/api/billing/change-plan', { plan: 'pro' });
  assert.equal(ch.status, 202, JSON.stringify(ch.body));
  assert.equal((await t.call('GET', '/api/entitlements')).body.plan_id, 'starter');
  assert.equal(env.billing.calls.at(-1).op, 'changePlan');

  await env.webhook(subEvt(t, 'customer.subscription.updated', PRICES.pro));
  e = (await t.call('GET', '/api/entitlements')).body;
  assert.equal(e.plan_id, 'pro');
  assert.ok(e.permissions.includes('ai.suggestions'));
  await env.webhook(subEvt(t, 'customer.subscription.updated', PRICES.business));
  e = (await t.call('GET', '/api/entitlements')).body;
  assert.equal(e.plan_id, 'business');
  assert.ok(e.permissions.includes('automations.create'));
  const detail = await t.call('GET', `/api/requests/${r.body.id}`);
  assert.equal(detail.status, 200, 'données conservées, même compte');
  const billing = await t.call('GET', '/api/billing');
  assert.ok(billing.body.audit.length >= 3, 'changements journalisés');
  assert.ok(billing.body.requests.some((x) => x.to_plan === 'pro' && x.status === 'confirmed'));
});

test('Starter → Business directement', async () => {
  const t = await freshTenant();
  await env.webhook(subEvt(t, 'customer.subscription.created', PRICES.starter));
  await env.webhook(subEvt(t, 'customer.subscription.updated', PRICES.business));
  assert.equal((await t.call('GET', '/api/entitlements')).body.plan_id, 'business');
});

test('Rétrogradation Business → Starter : prévisualisation, application à l\'échéance, rien supprimé', async () => {
  const t = await freshTenant();
  await env.webhook(subEvt(t, 'customer.subscription.created', PRICES.business));
  // Données Business : 3 collaborateurs, une automatisation active, un modèle.
  const members = [];
  for (let i = 0; i < 2; i++) {
    const email = `dg-${i}-${t.sub}@x.test`;
    const inv = await t.call('POST', '/api/team/invitations', { email });
    const { createUser } = await import('../src/accounts.js');
    const uid = await createUser(env.db, email);
    const tok = await createSession(env.db, uid, 24 * 365);
    await env.api(tok, 'POST', '/api/invitations/accept', { token: inv.body.accept_token });
    members.push(uid);
  }
  const tpl = await t.call('POST', '/api/templates', { name: 'T', body: 'Bonjour' });
  await t.call('POST', `/api/templates/${tpl.body.id}/approve`);
  const rule = await t.call('POST', '/api/automations', { name: 'R', template_id: tpl.body.id, delay_hours: 48 });
  await t.call('POST', `/api/automations/${rule.body.id}/activate`, { confirm_authorization: true });

  const pv = await t.call('GET', '/api/billing/preview?plan=starter');
  assert.equal(pv.status, 200);
  assert.equal(pv.body.kind, 'downgrade');
  assert.ok(pv.body.lost_permissions.some((p) => p.permission === 'automations.execute'));
  assert.ok(pv.body.warnings.some((w) => /automatisation/.test(w)));
  assert.ok(pv.body.warnings.some((w) => /collaborateurs/.test(w)));
  assert.match(pv.body.effective, /fin de la période/);

  // Le prestataire confirme la rétrogradation dans la même période : planifiée, pas appliquée.
  await env.webhook(subEvt(t, 'customer.subscription.updated', PRICES.starter));
  let e = (await t.call('GET', '/api/entitlements')).body;
  assert.equal(e.plan_id, 'business', 'reste Business jusqu\'à l\'échéance');
  assert.equal(e.scheduled_plan_id, 'starter');

  // Renouvellement : nouvelle période => Starter appliqué.
  setClock(T0 + 31 * DAY);
  await env.webhook(subEvt(t, 'customer.subscription.updated', PRICES.starter, { start: T0 + 30 * DAY, end: T0 + 60 * DAY }));
  e = (await t.call('GET', '/api/entitlements')).body;
  assert.equal(e.plan_id, 'starter');
  assert.equal(e.scheduled_plan_id, null);
  const rules = await env.db.asService((tx) => tx.query('select status from automation_rules where tenant_id = $1', [t.tenantId]));
  assert.deepEqual(rules.map((r) => r.status), ['paused_by_plan'], 'automatisation conservée, en pause');
  const ms = await env.db.asService((tx) => tx.query(`select role, status from memberships where tenant_id = $1 order by created_at`, [t.tenantId]));
  assert.deepEqual(ms.map((m) => m.status), ['active', 'suspended_over_limit', 'suspended_over_limit'], 'propriétaire conservé, autres suspendus (non supprimés)');
  const tpls = await env.db.asService((tx) => tx.query('select id from message_templates where tenant_id = $1', [t.tenantId]));
  assert.equal(tpls.length, 1);
  const notif = await t.call('GET', '/api/notifications');
  assert.ok(notif.body.some((n) => n.kind === 'plan_limits_applied'));
  // Ré-upgrade : les automatisations ne repartent PAS toutes seules.
  await env.webhook(subEvt(t, 'customer.subscription.updated', PRICES.business, { start: T0 + 30 * DAY, end: T0 + 60 * DAY }));
  const r2 = await env.db.asService((tx) => tx.one('select status from automation_rules where tenant_id = $1', [t.tenantId]));
  assert.equal(r2.status, 'paused_by_plan');
  // Réactivation explicite d'un collaborateur suspendu.
  const team = await t.call('GET', '/api/team');
  const susp = team.body.members.find((m) => m.status === 'suspended_over_limit');
  const re = await t.call('POST', `/api/team/${susp.id}/reactivate`);
  assert.equal(re.status, 200, JSON.stringify(re.body));
  setClock(T0);
});

test('Paiement échoué : délai de grâce de 7 jours, puis lecture seule ; paiement => réactivation', async () => {
  const t = await freshTenant();
  await env.webhook(subEvt(t, 'customer.subscription.created', PRICES.pro));
  setClock(T0 + 2 * DAY);
  await env.webhook(invoiceEvent('invoice.payment_failed', { customer: t.cus, subscription: t.sub, created: T0 + 2 * DAY }));
  let e = (await t.call('GET', '/api/entitlements')).body;
  assert.equal(e.status, 'past_due');
  assert.equal(e.access_mode, 'full', 'pendant le délai de grâce');
  assert.equal((await t.call('POST', '/api/requests', { subject: 'en grâce' })).status, 201);
  setClock(T0 + 10 * DAY);
  e = (await t.call('GET', '/api/entitlements')).body;
  assert.equal(e.access_mode, 'readonly', 'suspension après le délai');
  const blocked = await t.call('POST', '/api/requests', { subject: 'bloqué' });
  assert.equal(blocked.body.error.code, 'subscription_inactive');
  assert.equal((await t.call('GET', '/api/requests')).status, 200, 'consultation possible');
  assert.equal((await t.call('GET', '/api/export')).status, 200, 'export possible');
  await env.webhook(invoiceEvent('invoice.paid', { customer: t.cus, subscription: t.sub, billingReason: 'subscription_update', created: T0 + 10 * DAY + 60 }));
  e = (await t.call('GET', '/api/entitlements')).body;
  assert.equal(e.status, 'active');
  assert.equal(e.access_mode, 'full', 'réactivation');
  setClock(T0);
});

test('Annulation à l\'échéance puis expiration : lecture seule, données conservées ; réactivation possible', async () => {
  const t = await freshTenant();
  await env.webhook(subEvt(t, 'customer.subscription.created', PRICES.pro));
  await t.call('POST', '/api/requests', { subject: 'à garder' });
  const c = await t.call('POST', '/api/billing/cancel');
  assert.equal(c.status, 202);
  await env.webhook(subEvt(t, 'customer.subscription.updated', PRICES.pro, { cancelAtPeriodEnd: true }));
  let e = (await t.call('GET', '/api/entitlements')).body;
  assert.equal(e.cancel_at_period_end, true);
  assert.equal(e.access_mode, 'full', 'actif jusqu\'à l\'échéance');
  setClock(T0 + 30 * DAY + 10);
  await env.webhook(subEvt(t, 'customer.subscription.deleted', PRICES.pro, { status: 'canceled' }));
  e = (await t.call('GET', '/api/entitlements')).body;
  assert.equal(e.status, 'canceled');
  assert.equal(e.access_mode, 'readonly');
  assert.equal((await t.call('GET', '/api/requests')).body.length, 1, 'données conservées');
  // Réactivation : nouvel abonnement chez le prestataire.
  await env.webhook(stripeSubEvent('customer.subscription.created', { tenantId: t.tenantId, customer: t.cus, subscription: `${t.sub}_2`, price: PRICES.pro, start: T0 + 31 * DAY, end: T0 + 61 * DAY, created: T0 + 31 * DAY }));
  setClock(T0 + 31 * DAY + 10);
  e = (await t.call('GET', '/api/entitlements')).body;
  assert.equal(e.access_mode, 'full');
  setClock(T0);
});

test('Renouvellement : invoice.paid (cycle) => nouvelle période, compteurs remis à zéro, historique conservé', async () => {
  const t = await freshTenant();
  await env.webhook(subEvt(t, 'customer.subscription.created', PRICES.starter));
  for (let i = 0; i < 3; i++) await t.call('POST', '/api/requests', { subject: `r${i}` });
  assert.equal((await t.call('GET', '/api/entitlements')).body.usage.requests_monthly, 3);
  setClock(T0 + 30 * DAY + 5);
  await env.webhook(invoiceEvent('invoice.paid', { customer: t.cus, subscription: t.sub, start: T0 + 30 * DAY, end: T0 + 60 * DAY, created: T0 + 30 * DAY + 5 }));
  const e = (await t.call('GET', '/api/entitlements')).body;
  assert.equal(e.usage.requests_monthly, 0, 'compteur réinitialisé');
  assert.equal(new Date(e.renewal_date).getTime(), (T0 + 60 * DAY) * 1000);
  const usage = await t.call('GET', '/api/usage');
  assert.ok(usage.body.history.some((h) => h.metric === 'requests_monthly' && Number(h.used) === 3), 'historique de consommation');
  setClock(T0);
});

test('Réinitialisation même si le webhook de renouvellement tarde (période avancée par ancre)', async () => {
  const t = await freshTenant();
  await env.webhook(subEvt(t, 'customer.subscription.created', PRICES.starter));
  await t.call('POST', '/api/requests', { subject: 'x' });
  setClock(T0 + 30 * DAY + 3600);
  const e = (await t.call('GET', '/api/entitlements')).body;
  assert.equal(e.usage.requests_monthly, 0);
  assert.equal(e.access_mode, 'full', 'tolérance de 3 jours');
  setClock(T0 + 34 * DAY);
  assert.equal((await t.call('GET', '/api/entitlements')).body.access_mode, 'readonly', 'renouvellement jamais confirmé');
  setClock(T0);
});

test('Webhooks : idempotence, événements dans le désordre, prix inconnu', async () => {
  const t = await freshTenant();
  const created = subEvt(t, 'customer.subscription.created', PRICES.pro);
  await env.webhook(created);
  const dup = await env.webhook(created);
  assert.equal(dup.body.duplicate, true);
  const newer = subEvt(t, 'customer.subscription.updated', PRICES.business, { created: T0 + 1000 });
  const older = subEvt(t, 'customer.subscription.updated', PRICES.starter, { created: T0 + 500, status: 'past_due' });
  await env.webhook(newer);
  const stale = await env.webhook(older);
  assert.equal(stale.body.result, 'ignored_stale');
  const e = (await t.call('GET', '/api/entitlements')).body;
  assert.deepEqual([e.plan_id, e.status, e.scheduled_plan_id], ['business', 'active', null]);
  const unknown = await env.webhook(subEvt(t, 'customer.subscription.updated', 'price_inconnu', { created: T0 + 2000 }));
  assert.equal(unknown.status, 500, 'rejoué plus tard par le prestataire');
  assert.equal((await t.call('GET', '/api/entitlements')).body.plan_id, 'business');
  const alert = await env.db.asService((tx) => tx.one(`select count(*)::int as n from internal_alerts where kind = 'billing_webhook_failed'`));
  assert.ok(alert.n >= 1);
});

test('Remboursement : enregistré et signalé, sans changement d\'accès automatique', async () => {
  const t = await freshTenant();
  await env.webhook(subEvt(t, 'customer.subscription.created', PRICES.pro));
  const r = await env.webhook({ id: `evt_ref_${t.sub}`, type: 'charge.refunded', created: T0, data: { object: { id: 'ch_1', customer: t.cus, amount_refunded: 9900 } } });
  assert.equal(r.status, 200);
  assert.equal((await t.call('GET', '/api/entitlements')).body.access_mode, 'full');
  const a = await env.db.asService((tx) => tx.one(`select count(*)::int as n from internal_alerts where kind = 'refund' and tenant_id = $1`, [t.tenantId]));
  assert.equal(a.n, 1);
});

test('Erreurs du prestataire de paiement et paiement désactivé : aucun changement', async () => {
  const t = await freshTenant();
  await env.webhook(subEvt(t, 'customer.subscription.created', PRICES.starter));
  env.billing.fail = true;
  const r = await t.call('POST', '/api/billing/change-plan', { plan: 'pro' });
  env.billing.fail = false;
  assert.equal(r.status, 502);
  assert.equal((await t.call('GET', '/api/entitlements')).body.plan_id, 'starter');

  const off = await startEnv({ services: { billing: new (await import('../src/billing/provider.js')).DisabledBillingProvider() } });
  try {
    const s = await off.tenant('starter');
    const res = await s.call('POST', '/api/billing/change-plan', { plan: 'business' });
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, 'billing_disabled');
    assert.equal((await s.call('GET', '/api/entitlements')).body.plan_id, 'starter');
  } finally { await off.close(); }
});

test('Falsification : le client ne peut pas choisir son offre ni son statut', async () => {
  const t = await freshTenant();
  await env.webhook(subEvt(t, 'customer.subscription.created', PRICES.starter));
  const res = await t.call('POST', '/api/billing/change-plan', { plan: 'pro', status: 'active', price_cents: 0, plan_id: 'business' });
  assert.equal(res.status, 202);
  assert.equal(env.billing.calls.at(-1).planId, 'pro', 'seule l\'intention « pro » est transmise au prestataire');
  assert.equal((await t.call('GET', '/api/entitlements')).body.plan_id, 'starter');
  const unknown = await t.call('POST', '/api/billing/change-plan', { plan: 'enterprise_gratuit' });
  assert.equal(unknown.status, 400);
  // Webhook signé dont la métadonnée annonce un autre tenant : le client Stripe déjà lié prime.
  const other = await freshTenant();
  const hijack = stripeSubEvent('customer.subscription.updated', { tenantId: other.tenantId, customer: t.cus, subscription: t.sub, price: PRICES.business, start: T0, end: T0 + 30 * DAY, created: T0 + 5000 });
  await env.webhook(hijack);
  assert.equal((await other.call('GET', '/api/entitlements')).body.status, 'none', 'aucun abonnement attribué à l\'autre entreprise');
});

test('Expiration de l\'automatisation au moment de l\'exécution si l\'abonnement devient inactif', async () => {
  const t = await freshTenant();
  await env.webhook(subEvt(t, 'customer.subscription.created', PRICES.business));
  const tpl = await t.call('POST', '/api/templates', { name: 'T', body: 'Bonjour' });
  await t.call('POST', `/api/templates/${tpl.body.id}/approve`);
  const rule = await t.call('POST', '/api/automations', { name: 'R', template_id: tpl.body.id, delay_hours: 24 });
  await t.call('POST', `/api/automations/${rule.body.id}/activate`, { confirm_authorization: true });
  const c = await t.call('POST', '/api/customers', { name: 'C', email: 'c@x.test' });
  const r = await t.call('POST', '/api/requests', { subject: 'S', customer_id: c.body.id });
  await t.call('PATCH', `/api/requests/${r.body.id}`, { status: 'waiting_customer' });
  setClock(T0 + 2 * DAY);
  await env.webhook(invoiceEvent('invoice.payment_failed', { customer: t.cus, subscription: t.sub, created: T0 + 2 * DAY }));
  setClock(T0 + 12 * DAY);
  const before = env.email.sent.length;
  const rep = await runAutomationTick(env.db, env.services, { env: env.env });
  assert.equal(env.email.sent.length, before, 'aucun envoi après la fin du délai de grâce');
  assert.ok(rep.tenants_blocked >= 1);
  const st = await env.db.asService((tx) => tx.one('select status from automation_rules where id = $1', [rule.body.id]));
  assert.equal(st.status, 'paused_by_plan');
  setClock(T0);
});
