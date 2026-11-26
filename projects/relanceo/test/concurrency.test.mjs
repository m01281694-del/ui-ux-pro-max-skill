// Requêtes simultanées. NB : PGlite (Postgres embarqué) exécute les transactions l'une après l'autre ;
// ces tests valident l'absence de « vérifier puis agir » non atomique côté application et le
// comportement des contraintes. Le verrouillage multi-connexions de Postgres (UPDATE conditionnel,
// ON CONFLICT, SELECT … FOR UPDATE) n'est pas exercé ici : à valider sur l'infrastructure cible.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startEnv } from './helpers.mjs';

let env;
before(async () => { env = await startEnv(); });
after(() => env.close());

const setUsed = (t, metric, used) => env.db.asService((tx) => tx.query(
  `insert into usage_counters (tenant_id, metric, period_start, period_end, used)
   select $1, $2, ps, pe, $3 from app.current_period($1)`, [t.tenantId, metric, used]));

test('30 créations simultanées avec 10 places restantes : exactement 10 acceptées', async () => {
  const t = await env.tenant('starter');
  await setUsed(t, 'requests_monthly', 90);
  const results = await Promise.all(Array.from({ length: 30 }, (_, i) => t.call('POST', '/api/requests', { subject: `p${i}` })));
  assert.equal(results.filter((r) => r.status === 201).length, 10);
  assert.equal(results.filter((r) => r.status === 429).length, 20);
  const ent = (await t.call('GET', '/api/entitlements')).body;
  assert.equal(ent.usage.requests_monthly, 100);
  const n = await env.db.asService((tx) => tx.one('select count(*)::int as n from requests where tenant_id = $1', [t.tenantId]));
  assert.equal(n.n, 10);
});

test('Même clé d\'idempotence envoyée 10 fois en parallèle : une seule demande, un seul décompte', async () => {
  const t = await env.tenant('starter');
  const results = await Promise.all(Array.from({ length: 10 }, () => t.call('POST', '/api/requests', { subject: 'double clic' }, { 'Idempotency-Key': 'clic-1' })));
  const ids = new Set(results.map((r) => r.body.id));
  assert.equal(ids.size, 1);
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal(results.filter((r) => r.body.replay).length, 9);
  assert.equal((await t.call('GET', '/api/entitlements')).body.usage.requests_monthly, 1);
});

test('Invitations simultanées : jamais plus de places que la limite', async () => {
  const t = await env.tenant('pro');
  const res = await Promise.all(Array.from({ length: 8 }, (_, i) => t.call('POST', '/api/team/invitations', { email: `c${i}@x.test` })));
  assert.equal(res.filter((r) => r.status === 201).length, 2, 'propriétaire + 2 invitations = 3');
  assert.equal((await t.call('GET', '/api/entitlements')).body.usage.seats, 3);
});

test('Opérations IA simultanées avec la même clé : un seul décompte', async () => {
  const t = await env.tenant('pro');
  const r = await t.call('POST', '/api/requests', { subject: 'IA' });
  const res = await Promise.all(Array.from({ length: 5 }, () => t.call('POST', `/api/requests/${r.body.id}/ai/summary`, undefined, { 'Idempotency-Key': 'same' })));
  assert.ok(res.every((x) => x.status === 200), JSON.stringify(res.map((x) => x.body)));
  assert.equal((await t.call('GET', '/api/entitlements')).body.usage.ai_operations_monthly, 1);
});

test('Activation simultanée de règles au plafond : jamais plus de 20 règles actives', async () => {
  const t = await env.tenant('business');
  const tp = await t.call('POST', '/api/templates', { name: 'T', body: 'B' });
  await t.call('POST', `/api/templates/${tp.body.id}/approve`);
  const ids = [];
  for (let i = 0; i < 25; i++) ids.push((await t.call('POST', '/api/automations', { name: `R${i}`, template_id: tp.body.id, delay_hours: 48 })).body.id);
  const res = await Promise.all(ids.map((id) => t.call('POST', `/api/automations/${id}/activate`, { confirm_authorization: true })));
  assert.equal(res.filter((r) => r.status === 200).length, 20);
  assert.equal((await t.call('GET', '/api/entitlements')).body.usage.automation_rules_active, 20);
});
