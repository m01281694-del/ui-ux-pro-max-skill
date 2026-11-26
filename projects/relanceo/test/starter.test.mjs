import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startEnv } from './helpers.mjs';

let env;
let s;
before(async () => {
  env = await startEnv();
  s = await env.tenant('starter');
});
after(() => env.close());

test('STARTER — peut créer et gérer des demandes et des clients', async () => {
  const c = await s.call('POST', '/api/customers', { name: 'Client A', email: 'a@client.test' });
  assert.equal(c.status, 201);
  const r = await s.call('POST', '/api/requests', { subject: 'Devis toiture', body: 'Bonjour…', customer_id: c.body.id });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const p = await s.call('PATCH', `/api/requests/${r.body.id}`, { status: 'in_progress', priority: 'high' });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  const m = await s.call('POST', `/api/requests/${r.body.id}/messages`, { direction: 'outbound', body: 'Appel passé' });
  assert.equal(m.status, 201, JSON.stringify(m.body));
  const rem = await s.call('POST', `/api/requests/${r.body.id}/reminders`, { due_at: '2030-01-01T09:00:00Z', note: 'Rappeler' });
  assert.equal(rem.status, 201);
  const h = await s.call('GET', `/api/requests/${r.body.id}/history`);
  assert.deepEqual(h.body.map((e) => e.kind), ['created', 'status_changed', 'priority_changed', 'message_outbound']);
  const list = await s.call('GET', '/api/requests');
  assert.equal(list.body.length, 1);
});

test('STARTER — statistiques essentielles accessibles, avancées refusées avec proposition Pro', async () => {
  const b = await s.call('GET', '/api/stats/basic');
  assert.equal(b.status, 200);
  assert.equal(b.body.period.created, 1);
  const a = await s.call('GET', '/api/stats/advanced');
  assert.equal(a.status, 403);
  assert.equal(a.body.error.code, 'plan_required');
  assert.equal(a.body.error.upgrade.required_plan, 'pro');
  assert.equal(a.body.error.upgrade.price_cents, 9900);
});

test('STARTER — ne peut pas accéder aux fonctionnalités Pro (IA, modèles, priorités avancées, équipe)', async () => {
  const r = await s.call('POST', '/api/requests', { subject: 'Autre' });
  for (const path of [`/api/requests/${r.body.id}/ai/summary`, `/api/requests/${r.body.id}/ai/classify`, `/api/requests/${r.body.id}/ai/suggest-reply`]) {
    const res = await s.call('POST', path, undefined, { 'Idempotency-Key': 'k1' });
    assert.equal(res.status, 403, path);
    assert.equal(res.body.error.code, 'plan_required');
  }
  assert.equal(env.ai.calls.length, 0, 'aucun appel au fournisseur IA');
  assert.equal((await s.call('GET', '/api/templates')).status, 403);
  assert.equal((await s.call('POST', '/api/templates', { name: 'x', body: 'y' })).status, 403);
  const urgent = await s.call('POST', '/api/requests', { subject: 'Urgent', priority: 'urgent' });
  assert.equal(urgent.status, 403);
  assert.equal(urgent.body.error.upgrade.required_plan, 'pro');
  const inv = await s.call('POST', '/api/team/invitations', { email: 'x@y.test' });
  assert.equal(inv.status, 403);
});

test('STARTER — ne peut pas utiliser les automatisations ni appeler directement leur API', async () => {
  const calls = [
    ['GET', '/api/automations'],
    ['POST', '/api/automations', { name: 'R', delay_hours: 48 }],
    ['GET', '/api/automations/jobs'],
    ['POST', '/api/automations/pause-all', { paused: false }],
    ['POST', '/api/automations/00000000-0000-0000-0000-000000000000/activate', { confirm_authorization: true }],
  ];
  for (const [m, p, b] of calls) {
    const res = await s.call(m, p, b);
    assert.equal(res.status, 403, `${m} ${p}`);
    assert.equal(res.body.error.code, 'plan_required');
    assert.equal(res.body.error.upgrade.required_plan, 'business');
    assert.match(res.body.error.upgrade.title, /Automatisez vos relances avec Business/);
  }
});

test('STARTER — la base refuse aussi une insertion directe de règle (contournement du serveur)', async () => {
  await assert.rejects(
    env.db.asUser(s.userId, (tx) => tx.query(
      `insert into automation_rules (tenant_id, name, delay_hours) values ($1, 'contournement', 48)`, [s.tenantId])),
    /row-level security|forbidden/);
  // Même via le rôle serveur, le trigger refuse une règle pour une entreprise non Business.
  await assert.rejects(
    env.db.asService((tx) => tx.query(
      `insert into automation_rules (tenant_id, name, delay_hours) values ($1, 'contournement', 48)`, [s.tenantId])),
    /forbidden:automations.create/);
});

test('STARTER — limite de 100 demandes par mois, alertes 70/85/100 %', async () => {
  const t = await env.tenant('starter');
  let last;
  for (let i = 0; i < 100; i++) {
    last = await t.call('POST', '/api/requests', { subject: `Demande ${i}` });
    assert.equal(last.status, 201, `demande ${i}: ${JSON.stringify(last.body)}`);
  }
  const over = await t.call('POST', '/api/requests', { subject: 'Une de trop' });
  assert.equal(over.status, 429);
  assert.equal(over.body.error.code, 'quota_exceeded');
  assert.equal(over.body.error.limit, 100);
  assert.equal(over.body.error.upgrade.required_plan, 'pro');
  assert.equal(over.body.error.upgrade.new_limit, 500);
  const usage = await t.call('GET', '/api/usage');
  assert.deepEqual(usage.body.alerts.map((a) => a.threshold).sort((a, b) => a - b), [70, 85, 100]);
  const notif = await t.call('GET', '/api/notifications');
  assert.equal(notif.body.filter((n) => n.kind === 'quota_alert').length, 3);
  const count = await env.db.asService((tx) => tx.one('select count(*)::int as n from requests where tenant_id = $1', [t.tenantId]));
  assert.equal(count.n, 100);
});

test('STARTER — un seul collaborateur : invitation impossible même par la fonction SQL', async () => {
  const res = await env.db.asUser(s.userId, (tx) => tx.one(`select app.invite_member($1, 'b@x.test', 'member', 'h') as r`, [s.tenantId]).catch((e) => ({ err: e.message })));
  assert.match(res.err, /forbidden:team.invite/);
});
