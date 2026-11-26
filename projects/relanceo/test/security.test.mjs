import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startEnv } from './helpers.mjs';

let env;
let A;
let B;
let bRequest;
let bCustomer;
before(async () => {
  env = await startEnv();
  A = await env.tenant('business', { name: 'Entreprise A' });
  B = await env.tenant('business', { name: 'Entreprise B' });
  bCustomer = (await B.call('POST', '/api/customers', { name: 'Client secret de B', email: 'secret@b.test' })).body;
  bRequest = (await B.call('POST', '/api/requests', { subject: 'Confidentiel B', customer_id: bCustomer.id })).body;
  await A.call('POST', '/api/requests', { subject: 'Demande A' });
});
after(() => env.close());

test('Isolation API : A ne voit ni ne modifie rien de B', async () => {
  assert.equal((await A.call('GET', `/api/requests/${bRequest.id}`)).status, 404);
  assert.equal((await A.call('PATCH', `/api/requests/${bRequest.id}`, { status: 'closed' })).status, 404);
  assert.equal((await A.call('GET', `/api/customers/${bCustomer.id}`)).status, 404);
  assert.ok(!(await A.call('GET', '/api/requests')).body.some((r) => r.id === bRequest.id));
  assert.ok(!(await A.call('GET', '/api/customers')).body.some((c) => c.id === bCustomer.id));
  const msg = await A.call('POST', `/api/requests/${bRequest.id}/messages`, { direction: 'inbound', body: 'x' });
  assert.equal(msg.status, 403);
  const rem = await A.call('POST', `/api/requests/${bRequest.id}/reminders`, { due_at: '2030-01-01T00:00:00Z' });
  assert.equal(rem.status, 403);
  const ai = await A.call('POST', `/api/requests/${bRequest.id}/ai/summary`, undefined, { 'Idempotency-Key': 'x' });
  assert.equal(ai.status, 404);
  const attach = await A.call('POST', '/api/requests', { subject: 'vol', customer_id: bCustomer.id });
  assert.equal(attach.status, 404, 'client d\'une autre entreprise');
});

test('Isolation API : en-tête X-Tenant-Id d\'une autre entreprise refusé', async () => {
  const r = await A.call('GET', '/api/requests', undefined, { 'X-Tenant-Id': B.tenantId });
  assert.equal(r.status, 403);
  assert.equal(r.body.error.code, 'not_a_member');
  const bad = await A.call('GET', '/api/requests', undefined, { 'X-Tenant-Id': "' or 1=1 --" });
  assert.equal(bad.status, 403);
});

test('Isolation base (RLS) : lectures et écritures directes sous l\'identité de A', async () => {
  const rows = await env.db.asUser(A.userId, (tx) => tx.query('select id from requests where tenant_id = $1', [B.tenantId]));
  assert.equal(rows.length, 0);
  for (const table of ['customers', 'requests', 'messages', 'automation_jobs', 'automation_rules', 'usage_counters', 'subscriptions', 'memberships', 'notifications']) {
    const all = await env.db.asUser(A.userId, (tx) => tx.query(`select tenant_id from ${table}`));
    assert.ok(all.every((r) => r.tenant_id === A.tenantId), `${table} : uniquement les lignes de A`);
  }
  const upd = await env.db.asUser(A.userId, (tx) => tx.query(`update requests set status = 'closed' where id = $1 returning id`, [bRequest.id]));
  assert.equal(upd.length, 0);
  await assert.rejects(env.db.asUser(A.userId, (tx) => tx.query(
    `insert into customers (tenant_id, name) values ($1, 'intrus')`, [B.tenantId])), /row-level security/);
  await assert.rejects(env.db.asUser(A.userId, (tx) => tx.query(
    `update requests set tenant_id = $1`, [B.tenantId])), /permission denied/);
  await assert.rejects(env.db.asUser(A.userId, (tx) => tx.query(
    `select app.create_request($1, null, 'x', '', null, null, null, 'k')`, [B.tenantId])), /forbidden:requests.create/);
  assert.equal((await env.db.asUser(A.userId, (tx) => tx.one('select app.get_entitlements($1) as e', [B.tenantId]))).e, null);
  await assert.rejects(env.db.asUser(A.userId, (tx) => tx.query(`select app.consume_ai($1, 'summary', 'k')`, [B.tenantId])), /forbidden/);
  await assert.rejects(env.db.asUser(A.userId, (tx) => tx.query(`select * from billing_events`)), /permission denied/);
  await assert.rejects(env.db.asUser(A.userId, (tx) => tx.query(`select * from sessions`)), /permission denied/);
  await assert.rejects(env.db.asUser(A.userId, (tx) => tx.query(`select * from cost_ledger`)), /permission denied/);
  await assert.rejects(env.db.asUser(A.userId, (tx) => tx.query(`select app.enforce_plan_limits($1)`, [B.tenantId])), /permission denied/);
});

test('Rôles : un utilisateur ne peut pas s\'attribuer Business ni devenir propriétaire', async () => {
  const s = await env.tenant('starter');
  await assert.rejects(env.db.asUser(s.userId, (tx) => tx.query(`insert into subscriptions (tenant_id, plan_id, status) values ($1, 'business', 'active')`, [s.tenantId])), /permission denied/);
  await assert.rejects(env.db.asUser(s.userId, (tx) => tx.query(`update plan_permissions set plan_id = 'starter'`)), /permission denied/);
  await assert.rejects(env.db.asUser(s.userId, (tx) => tx.query(`insert into plan_limits values ('starter', 'requests_monthly', 999999)`)), /permission denied/);
  const m = await env.addMember(A);
  const changed = await env.db.asUser(m.userId, (tx) => tx.query(`update memberships set role = 'owner' where user_id = app.current_user_id() returning id`));
  assert.equal(changed.length, 0, 'aucune ligne modifiable sans team.manage');
  const adm = await env.addMember(A, 'admin');
  await assert.rejects(env.db.asUser(adm.userId, (tx) => tx.query(`update memberships set role = 'owner' where user_id = app.current_user_id()`)), /forbidden:owner_change/);
  const ent = (await m.call('GET', '/api/entitlements')).body;
  assert.equal(ent.role, 'member');
  assert.ok(!ent.permissions.includes('billing.manage'));
});

test('Collaborateur retiré : perd immédiatement l\'accès', async () => {
  const m = await env.addMember(A);
  assert.equal((await m.call('GET', '/api/requests')).status, 200);
  const team = await A.call('GET', '/api/team');
  const me = (await m.call('GET', '/api/me')).body.user;
  const row = team.body.members.find((x) => x.email === me.email);
  assert.equal((await A.call('PATCH', `/api/team/${row.id}`, { status: 'removed' })).status, 200);
  const after = await m.call('GET', '/api/requests');
  assert.equal(after.status, 403);
});

test('Authentification : sans jeton, jeton invalide => 401 ; webhooks publics protégés par signature', async () => {
  assert.equal((await env.api(null, 'GET', '/api/requests')).status, 401);
  assert.equal((await env.api('faux', 'GET', '/api/requests')).status, 401);
  assert.equal((await env.api(null, 'GET', '/api/plans')).status, 200);
  const raw = await env.api(null, 'POST', '/api/webhooks/stripe', '{"id":"evt","type":"customer.subscription.created","data":{"object":{}}}', { 'Content-Type': 'application/json' });
  assert.equal(raw.status, 400);
});

test('Entrées : identifiants non UUID, JSON invalide, corps trop gros', async () => {
  assert.equal((await A.call('GET', '/api/requests/1 or 1=1')).status, 404);
  assert.equal((await A.call('POST', '/api/requests', '{pas du json')).status, 400);
  assert.equal((await A.call('POST', '/api/requests', { subject: 'x'.repeat(200 * 1024) })).status, 413);
});

test('Webhook entrant : un jeton de réponse ne permet de toucher qu\'à sa propre demande', async () => {
  const r = await env.inbound({ reply_token: 'inexistant', text: 'x' });
  assert.equal(r.status, 404);
});
