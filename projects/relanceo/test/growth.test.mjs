import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startEnv } from './helpers.mjs';
import { parseCustomersCsv } from '../src/admin.js';

let env;
before(async () => { env = await startEnv({ env: { ADMIN_EMAILS: 'patron@relanceo.test', OPERATOR_EMAIL: 'patron@relanceo.test' } }); });
after(() => env.close());

test('Demande de démo : enregistrée, notifiée par e-mail, robots ignorés, champs exigés', async () => {
  const ok = await env.api(null, 'POST', '/api/leads', { name: 'Marc', company: 'Plomberie', email: 'marc@p.test', message: 'Intéressé' });
  assert.equal(ok.status, 201);
  assert.ok(env.email.sent.some((m) => m.to === 'patron@relanceo.test' && /Plomberie/.test(m.subject)));
  const bot = await env.api(null, 'POST', '/api/leads', { name: 'Bot', email: 'bot@spam.test', website: 'http://spam' });
  assert.equal(bot.status, 201);
  assert.equal((await env.api(null, 'POST', '/api/leads', { name: '', email: 'x' })).status, 400);
  const n = await env.db.asService((tx) => tx.one('select count(*)::int as n from leads'));
  assert.equal(n.n, 1, 'le robot n\'est pas enregistré');
});

test('Pilotage : réservé à ADMIN_EMAILS ; revenu mensuel calculé sur les abonnements payants', async () => {
  const client = await env.tenant('business');
  assert.equal((await client.call('GET', '/api/admin/overview')).status, 403, 'un client n\'y a pas accès');
  const { createUser } = await import('../src/accounts.js');
  const { createSession } = await import('../src/http/server.js');
  const uid = await createUser(env.db, 'patron@relanceo.test');
  const tok = await createSession(env.db, uid);
  await env.db.asService((tx) => tx.query(`update subscriptions set provider = 'stripe' where tenant_id = $1`, [client.tenantId]));
  const o = await env.api(tok, 'GET', '/api/admin/overview');
  assert.equal(o.status, 200);
  assert.equal(o.body.mrr_cents, 14999);
  assert.ok(o.body.tenants.some((t) => t.id === client.tenantId));
  const lead = o.body.leads[0];
  assert.equal((await env.api(tok, 'PATCH', `/api/admin/leads/${lead.id}`, { status: 'contacted' })).body.status, 'contacted');
  await assert.rejects(env.db.asUser(client.userId, (tx) => tx.query('select * from leads')), /permission denied/);
});

test('Import CSV : séparateur ; ou , , en-têtes accentués, doublons ignorés, autre entreprise intacte', async () => {
  assert.deepEqual(parseCustomersCsv('Nom;Téléphone;E-mail\n"Durand, SARL";0600;CONTACT@durand.test\nMartin;;'),
    [{ name: 'Durand, SARL', email: 'contact@durand.test', phone: '0600' }, { name: 'Martin', email: null, phone: null }]);
  assert.throws(() => parseCustomersCsv('email\nx@y.z'), /nom/);
  const t = await env.tenant('starter');
  const other = await env.tenant('starter');
  const csv = 'nom,email,telephone\nA,a@x.test,01\nB,b@x.test,02\nA bis,A@x.test,03';
  const r = await t.call('POST', '/api/customers/import', { csv });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body, { created: 2, skipped: 1 });
  assert.equal((await t.call('GET', '/api/customers')).body.length, 2);
  assert.equal((await other.call('GET', '/api/customers')).body.length, 0);
});
