import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startEnv } from './helpers.mjs';
import { runAutomationTick } from '../src/automations/engine.js';

let env;
let b;
let tpl;
let rule;
const T0 = new Date('2030-03-04T08:00:00Z').getTime();
const H = 3600 * 1000;
const at = (hours) => { env.db.clock = new Date(T0 + hours * H); };
const tick = () => runAutomationTick(env.db, env.services, { env: env.env });

async function newWaitingRequest(customerName = 'Client', email) {
  const c = await b.call('POST', '/api/customers', { name: customerName, email: email ?? `${Math.random().toString(36).slice(2)}@client.test` });
  const r = await b.call('POST', '/api/requests', { subject: `Devis ${customerName}`, customer_id: c.body.id });
  await b.call('PATCH', `/api/requests/${r.body.id}`, { status: 'waiting_customer' });
  await b.call('POST', `/api/requests/${r.body.id}/messages`, { direction: 'outbound', body: 'Devis envoyé' });
  return { requestId: r.body.id, customerId: c.body.id };
}

// Isole chaque scénario : clôture les demandes des scénarios précédents (leurs 2es relances sinon).
async function closeAll() {
  await env.db.asService((tx) => tx.query(`update requests set status = 'closed' where tenant_id = $1 and status <> 'closed'`, [b.tenantId]));
}

async function jobsFor(requestId) {
  return env.db.asService((tx) => tx.query('select attempt, status, reason from automation_jobs where request_id = $1 order by attempt, created_at', [requestId]));
}

before(async () => {
  env = await startEnv();
  at(0);
  b = await env.tenant('business');
  // Période longue pour couvrir les scénarios sur plusieurs semaines sans renouvellement.
  await env.db.asService((tx) => tx.query(`update subscriptions set current_period_end = $2 where tenant_id = $1`,
    [b.tenantId, new Date(T0 + 5000 * H).toISOString()]));
});
after(() => env.close());

test('BUSINESS — configuration : modèle validé et autorisation explicite exigés avant activation', async () => {
  const t = await b.call('POST', '/api/templates', { name: 'Relance devis', subject: 'Votre devis', body: 'Bonjour {{customer.name}}, avez-vous pu consulter notre devis « {{request.subject}} » ?' });
  tpl = t.body;
  const r = await b.call('POST', '/api/automations', { name: 'Relance 48 h', template_id: tpl.id, delay_hours: 48, max_attempts: 2, conditions: { statuses: ['waiting_customer'] } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  rule = r.body;
  assert.equal(rule.status, 'draft');
  const noTpl = await b.call('POST', `/api/automations/${rule.id}/activate`, { confirm_authorization: true });
  assert.equal(noTpl.status, 422);
  assert.equal(noTpl.body.error.code, 'template_not_approved');
  await b.call('POST', `/api/templates/${tpl.id}/approve`);
  const noAuth = await b.call('POST', `/api/automations/${rule.id}/activate`, {});
  assert.equal(noAuth.status, 422);
  assert.equal(noAuth.body.error.code, 'authorization_required');
  const ok = await b.call('POST', `/api/automations/${rule.id}/activate`, { confirm_authorization: true });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.status, 'active');
  assert.equal(ok.body.authorized_by, b.userId);
  const bad = await b.call('POST', '/api/automations', { name: 'Trop rapide', template_id: tpl.id, delay_hours: 1 });
  assert.equal(bad.status, 400, 'délai minimum 24 h');
});

test('BUSINESS — relance envoyée après le délai, une seule fois, puis 2e tentative, puis arrêt (max)', async () => {
  at(0);
  const { requestId } = await newWaitingRequest('Dupont');
  at(47);
  await tick();
  assert.equal(env.email.sent.length, 0, 'pas avant le délai');
  at(49);
  const [r1, r2] = await Promise.all([tick(), tick()]);
  assert.equal((r1.sent ?? 0) + (r2.sent ?? 0), 1, 'deux passages simultanés : un seul envoi');
  await tick();
  assert.equal(env.email.sent.length, 1);
  const mail = env.email.sent[0];
  assert.match(mail.text, /Bonjour Dupont/);
  assert.match(mail.text, /\/u\/[a-f0-9]+/, 'lien de désinscription');
  assert.ok(mail.headers['List-Unsubscribe']);
  at(49 + 47);
  await tick();
  assert.equal(env.email.sent.length, 1, 'la 2e relance attend le délai depuis la 1re');
  at(49 + 49);
  await tick();
  assert.equal(env.email.sent.length, 2);
  at(400);
  await tick();
  await tick();
  assert.equal(env.email.sent.length, 2, 'max_attempts = 2');
  const jobs = await jobsFor(requestId);
  assert.deepEqual(jobs.map((j) => [j.attempt, j.status]), [[1, 'sent'], [2, 'sent']]);
  const hist = await b.call('GET', '/api/automations/jobs');
  assert.ok(hist.body.filter((j) => j.request_id === requestId).every((j) => j.message_status === 'sent'));
  const history = await b.call('GET', `/api/requests/${requestId}/history`);
  assert.equal(history.body.filter((e) => e.kind === 'automation_sent').length, 2);
});

test('BUSINESS — arrêt automatique quand le client répond (webhook entrant signé)', async () => {
  env.email.sent.length = 0;
  at(500);
  const { requestId } = await newWaitingRequest('Martin');
  at(549);
  await tick();
  assert.equal(env.email.sent.length, 1);
  const token = (await env.db.asService((tx) => tx.one('select reply_token from requests where id = $1', [requestId]))).reply_token;
  const forged = await env.inbound({ reply_token: token, text: 'x' }, 'mauvais-secret');
  assert.equal(forged.status, 400, 'signature invalide refusée');
  at(560);
  const ok = await env.inbound({ reply_token: token, subject: 'Re: devis', text: 'Merci, je regarde' });
  assert.equal(ok.status, 200);
  at(700);
  await tick();
  await tick();
  assert.equal(env.email.sent.length, 1, 'aucune relance après la réponse');
});

test('BUSINESS — arrêt quand la demande est clôturée, relance planifiée annulée', async () => {
  env.email.sent.length = 0;
  at(1000);
  const { requestId } = await newWaitingRequest('Bernard');
  at(1049);
  await tick();
  assert.equal(env.email.sent.length, 1);
  at(1060);
  await tick(); // planifie la tentative 2 (échéance 1097 h)
  const pending = await jobsFor(requestId);
  assert.equal(pending.at(-1).status, 'pending');
  await b.call('PATCH', `/api/requests/${requestId}`, { status: 'closed' });
  const after = await jobsFor(requestId);
  assert.deepEqual([after.at(-1).status, after.at(-1).reason], ['canceled', 'request_closed']);
  at(1200);
  await tick();
  assert.equal(env.email.sent.length, 1);
});

test('BUSINESS — client désinscrit, pause d\'urgence, interrupteur global : aucun envoi', async () => {
  env.email.sent.length = 0;
  at(1500);
  const a = await newWaitingRequest('Optout');
  const token = (await env.db.asService((tx) => tx.one('select unsubscribe_token from customers where id = $1', [a.customerId]))).unsubscribe_token;
  const u = await env.api(null, 'POST', `/u/${token}`);
  assert.equal(u.status, 200);
  at(1549);
  await tick();
  assert.equal(env.email.sent.length, 0, 'désinscrit');

  at(1600);
  await newWaitingRequest('Pause');
  const p = await b.call('POST', '/api/automations/pause-all', { paused: true });
  assert.equal(p.body.automations_paused, true);
  at(1649);
  const r = await tick();
  assert.equal(r.tenants_blocked, 1);
  assert.equal(env.email.sent.length, 0, 'pause d\'urgence');
  await b.call('POST', '/api/automations/pause-all', { paused: false });

  const off = await runAutomationTick(env.db, env.services, { env: { AUTOMATIONS_ENABLED: 'false' } });
  assert.equal(off.skipped, 'automations_globally_disabled');
  assert.equal(env.email.sent.length, 0);
  await tick();
  assert.equal(env.email.sent.length, 1, 'reprise après levée de la pause');
});

test('BUSINESS — erreurs d\'envoi : nouvelle tentative, puis échec définitif journalisé et non décompté', async () => {
  await closeAll();
  env.email.sent.length = 0;
  at(2000);
  const a = await newWaitingRequest('Retry');
  env.email.failNext = 1;
  at(2049);
  const r = await tick();
  assert.equal(r.retried, 1);
  assert.equal(env.email.sent.length, 0);
  at(2049.5);
  await tick();
  assert.equal(env.email.sent.length, 1, 'renvoyé après échec temporaire');
  assert.equal((await jobsFor(a.requestId))[0].status, 'sent');

  await closeAll();
  at(2100);
  const bReq = await newWaitingRequest('Perm');
  const usedBefore = (await b.call('GET', '/api/entitlements')).body.usage.automation_sends_monthly;
  env.email.failPermanently = true;
  at(2149);
  const r2 = await tick();
  env.email.failPermanently = false;
  assert.equal(r2.failed, 1);
  assert.equal((await jobsFor(bReq.requestId))[0].status, 'failed');
  const usedAfter = (await b.call('GET', '/api/entitlements')).body.usage.automation_sends_monthly;
  assert.equal(usedAfter, usedBefore, 'échec définitif remboursé');
  const notif = await b.call('GET', '/api/notifications');
  assert.ok(notif.body.some((n) => n.kind === 'automation_failed'));
});

test('BUSINESS — quota mensuel d\'envois automatiques : pas d\'envoi au-delà', async () => {
  await closeAll();
  env.email.sent.length = 0;
  at(2500);
  await newWaitingRequest('Quota');
  await env.db.asService((tx) => tx.query(
    `insert into usage_counters (tenant_id, metric, period_start, period_end, used)
     select $1, 'automation_sends_monthly', ps, pe, 6000 from app.current_period($1)
     on conflict (tenant_id, metric, period_start) do update set used = 6000`, [b.tenantId]));
  at(2549);
  await tick();
  assert.equal(env.email.sent.length, 0);
  const jobs = await env.db.asService((tx) => tx.query(`select reason from automation_jobs where tenant_id = $1 and reason = 'monthly_send_quota_reached'`, [b.tenantId]));
  assert.equal(jobs.length, 1);
});

test('BUSINESS — plafond de 20 règles actives', async () => {
  const t = await env.tenant('business');
  const tp = await t.call('POST', '/api/templates', { name: 'T', body: 'Bonjour' });
  await t.call('POST', `/api/templates/${tp.body.id}/approve`);
  for (let i = 0; i < 20; i++) {
    const r = await t.call('POST', '/api/automations', { name: `R${i}`, template_id: tp.body.id, delay_hours: 48 });
    const a = await t.call('POST', `/api/automations/${r.body.id}/activate`, { confirm_authorization: true });
    assert.equal(a.status, 200, JSON.stringify(a.body));
  }
  const r = await t.call('POST', '/api/automations', { name: 'R21', template_id: tp.body.id, delay_hours: 48 });
  const a = await t.call('POST', `/api/automations/${r.body.id}/activate`, { confirm_authorization: true });
  assert.equal(a.status, 429);
});

test('BUSINESS — modifier un modèle validé le repasse en brouillon et met en pause ses règles', async () => {
  const t = await env.tenant('business');
  const tp = await t.call('POST', '/api/templates', { name: 'T', body: 'Bonjour' });
  await t.call('POST', `/api/templates/${tp.body.id}/approve`);
  const r = await t.call('POST', '/api/automations', { name: 'R', template_id: tp.body.id, delay_hours: 48 });
  await t.call('POST', `/api/automations/${r.body.id}/activate`, { confirm_authorization: true });
  const edited = await t.call('PATCH', `/api/templates/${tp.body.id}`, { body: 'Bonjour, texte modifié' });
  assert.equal(edited.body.status, 'draft');
  const rules = await t.call('GET', '/api/automations');
  assert.equal(rules.body.rules[0].status, 'paused');
});

test('BUSINESS — rôles : un membre consulte l\'historique mais ne configure pas les automatisations', async () => {
  const m = await env.addMember(b);
  assert.equal(m.acc.status, 200);
  assert.equal((await m.call('GET', '/api/automations/jobs')).status, 200);
  const c = await m.call('POST', '/api/automations', { name: 'x', delay_hours: 48 });
  assert.equal(c.status, 403);
  assert.equal(c.body.error.code, 'forbidden_role');
  assert.equal((await m.call('POST', '/api/automations/pause-all', { paused: true })).status, 403);
});

test('BUSINESS — 10 collaborateurs maximum', async () => {
  const t = await env.tenant('business');
  for (let i = 0; i < 9; i++) {
    const m = await env.addMember(t);
    assert.equal(m.acc?.status, 200, `membre ${i + 2}`);
  }
  const extra = await env.addMember(t);
  assert.equal(extra.inv.status, 429);
  assert.equal(extra.inv.body.error.upgrade.custom_offer, true, 'au-delà de Business : offre personnalisée');
});
