import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startEnv } from './helpers.mjs';

let env;
let p;
before(async () => {
  env = await startEnv();
  p = await env.tenant('pro');
});
after(() => env.close());

test('PRO — fonctions Starter + Pro : priorités avancées, modèles, statistiques avancées', async () => {
  const r = await p.call('POST', '/api/requests', { subject: 'Réclamation livraison', priority: 'urgent', due_at: '2030-01-02T00:00:00Z' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  await p.call('POST', '/api/requests', { subject: 'Info', priority: 'low' });
  const list = await p.call('GET', '/api/requests');
  assert.equal(list.body[0].priority, 'urgent', 'file triée par priorité');
  const tpl = await p.call('POST', '/api/templates', { name: 'Accusé', subject: 'Votre demande', body: 'Bonjour {{customer.name}}' });
  assert.equal(tpl.status, 201);
  const ok = await p.call('POST', `/api/templates/${tpl.body.id}/approve`);
  assert.equal(ok.body.status, 'approved');
  const a = await p.call('GET', '/api/stats/advanced');
  assert.equal(a.status, 200);
  assert.ok(!('automations' in a.body), 'pas de statistiques d\'automatisation pour Pro');
});

test('PRO — suggestions IA : quota décompté, rien n\'est envoyé au client', async () => {
  const r = await p.call('POST', '/api/requests', { subject: 'Demande de devis' });
  const s = await p.call('POST', `/api/requests/${r.body.id}/ai/suggest-reply`, undefined, { 'Idempotency-Key': 'sugg-1' });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.equal(s.body.auto_sent, false);
  assert.match(s.body.output.reply, /Demande de devis/);
  const again = await p.call('POST', `/api/requests/${r.body.id}/ai/suggest-reply`, undefined, { 'Idempotency-Key': 'sugg-1' });
  assert.equal(again.body.quota.used, 1, 'même clé d\'idempotence : pas de double comptage');
  const sum = await p.call('POST', `/api/requests/${r.body.id}/ai/summary`, undefined, { 'Idempotency-Key': 'sum-1' });
  assert.equal(sum.body.quota.used, 2);
  const cls = await p.call('POST', `/api/requests/${r.body.id}/ai/classify`, undefined, { 'Idempotency-Key': 'cls-1' });
  assert.equal(cls.body.output.priority, 'high');
  const detail = await p.call('GET', `/api/requests/${r.body.id}`);
  assert.equal(detail.body.priority, 'normal', 'la priorité proposée par l\'IA n\'est pas appliquée automatiquement');
  assert.equal(detail.body.messages.length, 0, 'aucun message créé par l\'IA');
  const costs = await env.db.asService((tx) => tx.one(`select count(*)::int as n from cost_ledger where tenant_id = $1 and category = 'ai'`, [p.tenantId]));
  assert.ok(costs.n >= 3, 'coût IA journalisé');
});

test('PRO — échec du fournisseur IA : erreur claire et opération non décomptée', async () => {
  const r = await p.call('POST', '/api/requests', { subject: 'Panne' });
  const before = (await p.call('GET', '/api/entitlements')).body.usage.ai_operations_monthly;
  env.ai.fail = true;
  const res = await p.call('POST', `/api/requests/${r.body.id}/ai/summary`, undefined, { 'Idempotency-Key': 'fail-1' });
  env.ai.fail = false;
  assert.equal(res.status, 502);
  const after = (await p.call('GET', '/api/entitlements')).body.usage.ai_operations_monthly;
  assert.equal(after, before);
});

test('PRO — automatisations refusées avec le message Business dédié', async () => {
  const res = await p.call('GET', '/api/automations');
  assert.equal(res.status, 403);
  assert.equal(res.body.error.upgrade.required_plan, 'business');
  assert.equal(res.body.error.upgrade.body, 'Cette fonctionnalité est réservée à Business. Passez à Business pour configurer vos automatisations de relances.');
  assert.equal(res.body.error.upgrade.price_cents, 14999);
});

test('PRO — ne peut pas contourner la restriction par requête API ou falsification', async () => {
  // Champs falsifiés dans le corps : ignorés.
  const forged = await p.call('POST', '/api/automations', { name: 'R', delay_hours: 48, plan: 'business', plan_id: 'business', tenant_permissions: ['automations.create'] });
  assert.equal(forged.status, 403);
  // Accès direct à la base sous l'identité de l'utilisateur.
  await assert.rejects(env.db.asUser(p.userId, (tx) => tx.query(
    `insert into automation_rules (tenant_id, name, delay_hours) values ($1, 'x', 48)`, [p.tenantId])), /row-level security|forbidden/);
  await assert.rejects(env.db.asUser(p.userId, (tx) => tx.query(
    `update subscriptions set plan_id = 'business' where tenant_id = $1`, [p.tenantId])), /permission denied/);
  await assert.rejects(env.db.asUser(p.userId, (tx) => tx.query(
    `insert into tenant_limit_overrides values ($1, 'requests_monthly', 999999, 'moi', 'moi')`, [p.tenantId])), /permission denied/);
  await assert.rejects(env.db.asUser(p.userId, (tx) => tx.query(
    `update usage_counters set used = 0 where tenant_id = $1`, [p.tenantId])), /permission denied/);
  await assert.rejects(env.db.asUser(p.userId, (tx) => tx.query(
    `select app._consume($1, 'requests_monthly', -50, null, null, null)`, [p.tenantId])), /permission denied/);
  await assert.rejects(env.db.asUser(p.userId, (tx) => tx.query(
    `insert into requests (tenant_id, subject) values ($1, 'sans quota')`, [p.tenantId])), /permission denied/);
  await assert.rejects(env.db.asUser(p.userId, (tx) => tx.query(
    `insert into messages (tenant_id, request_id, direction, origin, status) select tenant_id, id, 'outbound', 'automation', 'sent' from requests where tenant_id = $1 limit 1`, [p.tenantId])), /row-level security|forbidden/);
  const ent = (await p.call('GET', '/api/entitlements')).body;
  assert.equal(ent.plan_id, 'pro');
  assert.ok(!ent.permissions.includes('automations.execute'));
});

test('PRO — 3 collaborateurs maximum, quatrième refusé avec proposition Business', async () => {
  const t = await env.tenant('pro');
  const m1 = await env.addMember(t);
  assert.equal(m1.acc.status, 200, JSON.stringify(m1.acc.body));
  const m2 = await env.addMember(t, 'admin');
  assert.equal(m2.acc.status, 200);
  const m3 = await env.addMember(t);
  assert.equal(m3.inv.status, 429);
  assert.equal(m3.inv.body.error.metric, 'seats');
  assert.equal(m3.inv.body.error.upgrade.required_plan, 'business');
  // Un membre n'a pas le droit d'inviter ni de gérer l'abonnement (rôle).
  const byMember = await m1.call('POST', '/api/team/invitations', { email: 'z@z.test' });
  assert.equal(byMember.status, 403);
  assert.equal(byMember.body.error.code, 'forbidden_role');
  assert.equal((await m1.call('POST', '/api/billing/change-plan', { plan: 'business' })).body.error.code, 'forbidden_role');
});

test('PRO — ne peut pas dépasser son quota de demandes (500)', async () => {
  const t = await env.tenant('pro');
  await env.db.asService((tx) => tx.query(
    `insert into usage_counters (tenant_id, metric, period_start, period_end, used)
     select $1, 'requests_monthly', ps, pe, 499 from app.current_period($1)`, [t.tenantId]));
  assert.equal((await t.call('POST', '/api/requests', { subject: 'n°500' })).status, 201);
  const over = await t.call('POST', '/api/requests', { subject: 'n°501' });
  assert.equal(over.status, 429);
  assert.equal(over.body.error.upgrade.required_plan, 'business');
});

test('PRO — quota IA (1000) : refus au-delà', async () => {
  const t = await env.tenant('pro');
  const r = await t.call('POST', '/api/requests', { subject: 'IA' });
  await env.db.asService((tx) => tx.query(
    `insert into usage_counters (tenant_id, metric, period_start, period_end, used)
     select $1, 'ai_operations_monthly', ps, pe, 1000 from app.current_period($1)`, [t.tenantId]));
  const res = await t.call('POST', `/api/requests/${r.body.id}/ai/summary`, undefined, { 'Idempotency-Key': 'q' });
  assert.equal(res.status, 429);
  assert.equal(res.body.error.metric, 'ai_operations_monthly');
});
