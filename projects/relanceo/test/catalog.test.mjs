import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadCatalog, validateCatalog } from '../src/plans.js';
import { buildRoutes } from '../src/http/routes.js';
import { checkCostAnomalies } from '../src/costs.js';
import { computeEconomics } from '../scripts/economics.mjs';
import { startEnv } from './helpers.mjs';

const catalog = loadCatalog();
let env;
before(async () => { env = await startEnv(); });
after(() => env.close());

test('Catalogue : Starter et Pro ne peuvent jamais inclure les automatisations (validation bloquante)', () => {
  const broken = structuredClone(catalog);
  broken.plans.find((p) => p.id === 'pro').permissions.push('automations.execute');
  assert.throws(() => validateCatalog(broken), /pro ne doit jamais inclure automations.execute/);
  const broken2 = structuredClone(catalog);
  broken2.plans.find((p) => p.id === 'starter').limits.automation_sends_monthly = 10;
  assert.throws(() => validateCatalog(broken2), /aucun envoi automatique/);
});

test('Quotas configurés (valeurs de départ du cahier des charges)', () => {
  const l = Object.fromEntries(catalog.plans.map((p) => [p.id, p.limits]));
  assert.deepEqual([l.starter.requests_monthly, l.pro.requests_monthly], [100, 500]);
  assert.deepEqual([l.starter.seats, l.pro.seats, l.business.seats], [1, 3, 10]);
  assert.ok(l.business.requests_monthly > l.pro.requests_monthly, 'Business : plafond élevé mais fini');
  assert.deepEqual(catalog.plans.map((p) => p.price_cents), [4999, 9900, 14999]);
});

test('Base = catalogue : permissions et limites recopiées à l\'identique', async () => {
  const perms = await env.db.asService((tx) => tx.query('select plan_id, permission from plan_permissions order by 1, 2'));
  const limits = await env.db.asService((tx) => tx.query('select plan_id, metric, limit_value from plan_limits'));
  for (const p of catalog.plans) {
    assert.deepEqual(perms.filter((r) => r.plan_id === p.id).map((r) => r.permission), [...p.permissions].sort());
    for (const [m, v] of Object.entries(p.limits)) {
      assert.equal(Number(limits.find((r) => r.plan_id === p.id && r.metric === m).limit_value), v);
    }
  }
});

test('Chaque fonctionnalité annoncée est réellement protégée par une route (ou par le planificateur)', () => {
  const protectedPerms = new Set(buildRoutes().map((r) => r.permission).filter(Boolean));
  protectedPerms.add('automations.execute'); // vérifiée par runAutomationTick (test business/lifecycle)
  protectedPerms.add('priorities.advanced'); // vérifiée dans POST/PATCH /api/requests et en base
  protectedPerms.add('support.priority'); // processus humain : drapeau de configuration requis
  for (const f of catalog.features) {
    for (const perm of f.permissions) {
      assert.ok(protectedPerms.has(perm), `« ${f.label} » (${perm}) n'est contrôlé par aucune route`);
      assert.ok(catalog.plans.some((p) => p.permissions.includes(perm)), `${perm} n'est vendu dans aucune offre`);
    }
  }
});

test('Pages commerciales : aucune promesse interdite, aucun prix codé en dur', () => {
  const pricing = readFileSync(new URL('../public/pricing.html', import.meta.url), 'utf8')
    + readFileSync(new URL('../public/assets/pricing.js', import.meta.url), 'utf8');
  const banned = [/illimit/i, /unlimited/i, /24\s*h\s*\/\s*24/i, /24\/7/, /multi-?sites?/i, /multi-?entreprises?/i, /SMS/];
  for (const re of banned) assert.ok(!re.test(pricing), `motif interdit : ${re}`);
  assert.ok(!/49\s*€|99\s*€|149\s*€/.test(pricing), 'prix lus depuis /api/plans, jamais codés en dur');
  const cfg = JSON.stringify(catalog.plans) + JSON.stringify(catalog.features);
  for (const re of [/illimit/i, /24\s*h\s*\/\s*24/i]) assert.ok(!re.test(cfg));
});

test('Page tarifs : les fonctionnalités dépendant d\'un prestataire non configuré sont signalées', async () => {
  const res = await env.api(null, 'GET', '/api/plans');
  assert.equal(res.status, 200);
  assert.equal(res.body.commercial.ready, false);
  assert.equal(typeof res.body.configuration.ai_provider, 'boolean');
  assert.equal(res.body.configuration.support_process, false);
  assert.ok(res.body.features.some((f) => f.requires_configuration === 'support_process'));
});

test('Économie : chaque offre reste rentable au plafond d\'usage (hypothèses actuelles)', () => {
  const e = computeEconomics();
  for (const p of e.plans) assert.ok(p.worst.margin > 0, `${p.id} non rentable au plafond`);
});

test('FinOps : alerte interne si les coûts variables d\'une entreprise dépassent 35 % de son abonnement', async () => {
  const t = await env.tenant('pro');
  await env.db.asService((tx) => tx.query(`insert into cost_ledger (tenant_id, category, units, amount_eur, created_at) values ($1, 'ai', 1, 40, app.now())`, [t.tenantId]));
  const alerts = await checkCostAnomalies(env.db, env.services.costs, catalog);
  assert.ok(alerts.some((a) => a.tenant_id === t.tenantId));
  const again = await checkCostAnomalies(env.db, env.services.costs, catalog);
  assert.ok(!again.some((a) => a.tenant_id === t.tenantId), 'une seule alerte par mois');
});

test('Offre personnalisée : dérogation de quota par l\'opérateur, sans modifier le code', async () => {
  const t = await env.tenant('business');
  await env.db.asService((tx) => tx.query(
    `insert into tenant_limit_overrides (tenant_id, metric, limit_value, reason, approved_by) values ($1, 'seats', 25, 'Contrat sur devis', 'operateur@relanceo')`, [t.tenantId]));
  assert.equal((await t.call('GET', '/api/entitlements')).body.limits.seats, 25);
});

test('Affichage des prix : 49,99 € / 99 € / 149,99 €', async () => {
  const res = await env.api(null, 'GET', '/api/plans');
  assert.deepEqual(res.body.plans.map((p) => p.price_label), ['49,99 €', '99 €', '149,99 €']);
});
