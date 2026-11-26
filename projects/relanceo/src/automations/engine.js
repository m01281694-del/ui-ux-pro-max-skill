// Planificateur des relances automatiques (Business).
// Exécuté côté serveur uniquement (service_role), par exemple chaque minute via un cron.
// Garde-fous, revérifiés AU MOMENT DE L'ENVOI (pas seulement à la planification) :
//  - interrupteur global AUTOMATIONS_ENABLED=true obligatoire ;
//  - droit automations.execute de l'entreprise (abonnement Business actif) ;
//  - pause d'urgence de l'entreprise (tenant_settings.automations_paused) ;
//  - règle active, modèle validé, autorisation explicite enregistrée ;
//  - demande non clôturée, statut conforme aux conditions, client sans réponse depuis la dernière relance ;
//  - client joignable par e-mail et non désinscrit ;
//  - nombre maximal de relances par demande, une seule relance automatique par client et par 24 h ;
//  - plafond horaire par entreprise, quota mensuel d'envois ;
//  - anti-doublon : contrainte unique (règle, demande, tentative) + réservation atomique du job.
import { recordCost } from '../costs.js';

const MIN_HOURS_BETWEEN_AUTOMATED_MESSAGES_PER_CUSTOMER = 24;
const MAX_TRIES = 3;
const STUCK_SENDING_MINUTES = 15;

export function renderTemplate(text, vars) {
  return String(text).replace(/\{\{\s*([a-z_.]+)\s*\}\}/g, (_, key) => {
    const v = key.split('.').reduce((o, k) => (o == null ? o : o[k]), vars);
    return v == null ? '' : String(v);
  });
}

const SCHEDULER_LOCK = 724_002;

export async function runAutomationTick(db, services, { env = process.env } = {}) {
  if (env.AUTOMATIONS_ENABLED !== 'true') return { skipped: 'automations_globally_disabled' };
  if (!services.email?.configured) return { skipped: 'email_provider_not_configured' };
  // Un seul planificateur à la fois, même si le cron se chevauche ou si plusieurs instances tournent.
  return db.withLock(SCHEDULER_LOCK, () => tick(db, services));
}

async function tick(db, services) {
  const report = { planned: 0, sent: 0, skipped: 0, failed: 0, retried: 0, needs_review: 0, tenants_blocked: 0 };

  // 0. Jobs bloqués en « sending » (crash pendant l'envoi) : pas de renvoi automatique -> revue humaine.
  await db.asService((tx) => tx.query(
    `update automation_jobs set status = 'needs_review', reason = 'interrupted_during_send', updated_at = now()
      where status = 'sending' and updated_at < app.now() - make_interval(mins => $1)`, [STUCK_SENDING_MINUTES]), 'scheduler');

  // 1. Entreprises ayant des règles actives : on revérifie le droit d'exécution.
  const tenants = await db.asService((tx) => tx.query(
    `select distinct tenant_id from automation_rules where status = 'active'`), 'scheduler');
  for (const { tenant_id: t } of tenants) {
    const ok = await db.asService(async (tx) => {
      const ent = (await tx.one(`select app.tenant_has_entitlement($1, 'automations.execute') as ok`, [t])).ok;
      if (!ent) { await tx.query('select app.enforce_plan_limits($1)', [t]); return false; }
      const st = await tx.one('select automations_paused from tenant_settings where tenant_id = $1', [t]);
      return !st?.automations_paused;
    }, 'scheduler');
    if (!ok) { report.tenants_blocked += 1; continue; }
    report.planned += await planTenant(db, t);
  }

  // 2. Exécution des jobs échus.
  const due = await db.asService((tx) => tx.query(
    `select id from automation_jobs where status = 'pending' and scheduled_for <= app.now() order by scheduled_for limit 500`), 'scheduler');
  for (const { id } of due) {
    const r = await executeJob(db, services, id);
    report[r] = (report[r] ?? 0) + 1;
  }
  return report;
}

async function planTenant(db, t) {
  return db.asService(async (tx) => {
    const rows = await tx.query(
      `with candidates as (
         select r.id as rule_id, q.id as request_id, r.delay_hours, r.max_attempts,
                greatest(q.created_at, coalesce(q.last_outbound_at, q.created_at)) as base,
                (select count(*) from automation_jobs j where j.rule_id = r.id and j.request_id = q.id
                   and j.status in ('sent', 'pending', 'sending', 'needs_review')) as attempts_used
           from automation_rules r
           join requests q on q.tenant_id = r.tenant_id
           join customers c on c.id = q.customer_id
          where r.tenant_id = $1 and r.status = 'active'
            and q.status <> 'closed'
            and q.status in (select jsonb_array_elements_text(r.conditions -> 'statuses'))
            and (r.conditions -> 'priorities' is null
                 or q.priority in (select jsonb_array_elements_text(r.conditions -> 'priorities')))
            and c.email is not null and c.opted_out_at is null
            and (q.last_customer_reply_at is null
                 or q.last_customer_reply_at < greatest(q.created_at, coalesce(q.last_outbound_at, q.created_at))))
       insert into automation_jobs (tenant_id, rule_id, request_id, attempt, scheduled_for)
       select $1, rule_id, request_id, attempts_used + 1, base + make_interval(hours => delay_hours)
         from candidates
        where attempts_used < max_attempts
          and not exists (select 1 from automation_jobs j where j.request_id = candidates.request_id
                            and j.status in ('pending', 'sending'))
       on conflict (rule_id, request_id, attempt) do nothing
       returning id`, [t]);
    return rows.length;
  }, 'scheduler');
}

async function skip(db, jobId, reason, status = 'skipped') {
  await db.asService((tx) => tx.query(
    `update automation_jobs set status = $2, reason = $3, updated_at = now() where id = $1`, [jobId, status, reason]), 'scheduler');
  return status === 'canceled' ? 'skipped' : 'skipped';
}

export async function executeJob(db, services, jobId) {
  // Réservation atomique : un seul exécuteur peut faire passer le job de pending à sending.
  const claimed = await db.asService((tx) => tx.one(
    `update automation_jobs set status = 'sending', tries = tries + 1, updated_at = now()
      where id = $1 and status = 'pending' and scheduled_for <= app.now() returning *`, [jobId]), 'scheduler');
  if (!claimed) return 'skipped';

  const ctx = await db.asService(async (tx) => {
    const job = claimed;
    const ent = (await tx.one(`select app.tenant_has_entitlement($1, 'automations.execute') as ok`, [job.tenant_id])).ok;
    const settings = await tx.one('select * from tenant_settings where tenant_id = $1', [job.tenant_id]);
    const rule = await tx.one('select * from automation_rules where id = $1', [job.rule_id]);
    const tpl = rule?.template_id ? await tx.one('select * from message_templates where id = $1', [rule.template_id]) : null;
    const request = await tx.one('select * from requests where id = $1', [job.request_id]);
    const customer = request?.customer_id ? await tx.one('select * from customers where id = $1', [request.customer_id]) : null;
    const tenant = await tx.one('select * from tenants where id = $1', [job.tenant_id]);
    const recentToCustomer = customer ? (await tx.one(
      `select count(*)::int as n from messages m join requests q on q.id = m.request_id
        where q.customer_id = $1 and m.origin = 'automation' and m.status = 'sent'
          and m.sent_at > app.now() - make_interval(hours => $2)`, [customer.id, MIN_HOURS_BETWEEN_AUTOMATED_MESSAGES_PER_CUSTOMER])).n : 0;
    const lastHour = (await tx.one(
      `select count(*)::int as n from messages where tenant_id = $1 and origin = 'automation'
        and created_at > app.now() - interval '1 hour'`, [job.tenant_id])).n;
    return { job, ent, settings, rule, tpl, request, customer, tenant, recentToCustomer, lastHour };
  }, 'scheduler');

  const { job, rule, tpl, request, customer } = ctx;
  if (!ctx.ent) return skip(db, job.id, 'plan_or_subscription', 'canceled');
  if (ctx.settings?.automations_paused) return skip(db, job.id, 'tenant_paused', 'canceled');
  if (!rule || rule.status !== 'active') return skip(db, job.id, 'rule_not_active', 'canceled');
  if (!tpl || tpl.status !== 'approved') return skip(db, job.id, 'template_not_approved', 'canceled');
  if (!rule.authorized_by) return skip(db, job.id, 'not_authorized', 'canceled');
  if (!request || request.status === 'closed') return skip(db, job.id, 'request_closed', 'canceled');
  const statuses = rule.conditions?.statuses ?? [];
  if (!statuses.includes(request.status)) return skip(db, job.id, 'conditions_not_met', 'canceled');
  const base = new Date(request.last_outbound_at ?? request.created_at);
  if (request.last_customer_reply_at && new Date(request.last_customer_reply_at) >= base) {
    return skip(db, job.id, 'customer_replied', 'canceled');
  }
  if (!customer?.email) return skip(db, job.id, 'no_email');
  if (customer.opted_out_at) return skip(db, job.id, 'customer_opted_out', 'canceled');
  if (ctx.recentToCustomer > 0) {
    // Limitation de fréquence : on décale plutôt que d'envoyer.
    await db.asService((tx) => tx.query(
      `update automation_jobs set status = 'pending', reason = 'frequency_limited', tries = tries - 1,
          scheduled_for = app.now() + make_interval(hours => $2), updated_at = now() where id = $1`,
      [job.id, MIN_HOURS_BETWEEN_AUTOMATED_MESSAGES_PER_CUSTOMER]), 'scheduler');
    return 'retried';
  }
  if (ctx.lastHour >= (ctx.settings?.automation_hourly_cap ?? 50)) {
    await db.asService((tx) => tx.query(
      `update automation_jobs set status = 'pending', reason = 'hourly_cap', tries = tries - 1,
          scheduled_for = app.now() + interval '1 hour', updated_at = now() where id = $1`, [job.id]), 'scheduler');
    return 'retried';
  }

  const idem = `automation_job:${job.id}`;
  const quota = await db.asService((tx) => tx.one(
    `select app._consume($1, 'automation_sends_monthly', 1, $2, null, $3) as r`, [job.tenant_id, idem, job.id]), 'scheduler');
  if (!quota.r.ok) return skip(db, job.id, quota.r.reason === 'quota_exceeded' ? 'monthly_send_quota_reached' : 'not_included');

  const appUrl = services.appUrl ?? 'http://localhost:3000';
  const vars = {
    customer: { name: customer.name },
    request: { subject: request.subject },
    company: { name: ctx.settings?.sender_name || ctx.tenant.name },
  };
  const subject = renderTemplate(tpl.subject || `Re: ${request.subject}`, vars);
  const unsubscribeUrl = `${appUrl}/u/${customer.unsubscribe_token}`;
  const text = `${renderTemplate(tpl.body, vars)}\n\n—\n${vars.company.name}\nVous recevez ce message au sujet de votre demande « ${request.subject} ». Pour ne plus recevoir de relances automatiques : ${unsubscribeUrl}`;

  const message = await db.asService((tx) => tx.one(
    `insert into messages (tenant_id, request_id, direction, origin, subject, body, status, automation_job_id)
     values ($1, $2, 'outbound', 'automation', $3, $4, 'queued', $5) returning id`,
    [job.tenant_id, request.id, subject, text, job.id]), 'scheduler');

  try {
    const res = await services.email.send({
      to: customer.email,
      subject,
      text,
      replyTo: services.replyDomain ? `reply+${request.reply_token}@${services.replyDomain}` : undefined,
      headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      idempotencyKey: idem,
    });
    await db.asService(async (tx) => {
      await tx.query(`update messages set status = 'sent', sent_at = app.now(), provider_message_id = $2 where id = $1`, [message.id, res.id]);
      await tx.query(
        `update requests set last_outbound_at = app.now(), first_response_at = coalesce(first_response_at, app.now()) where id = $1`,
        [request.id]);
      await tx.query(`update automation_jobs set status = 'sent', message_id = $2, reason = null, updated_at = now() where id = $1`, [job.id, message.id]);
      await tx.query(
        `insert into request_events (tenant_id, request_id, kind, data) values ($1, $2, 'automation_sent', $3)`,
        [job.tenant_id, request.id, JSON.stringify({ rule_id: rule.id, job_id: job.id, attempt: job.attempt, message_id: message.id })]);
      await recordCost(tx, { tenantId: job.tenant_id, category: 'email', units: 1, amountEur: services.costs.email.eur_per_email, metadata: { job_id: job.id } });
    }, 'scheduler');
    return 'sent';
  } catch (err) {
    const permanent = Boolean(err.permanent) || claimed.tries >= MAX_TRIES;
    await db.asService(async (tx) => {
      await tx.query(`update messages set status = 'failed', error = $2 where id = $1`, [message.id, String(err.message)]);
      if (permanent) {
        await tx.query(`update automation_jobs set status = 'failed', last_error = $2, updated_at = now() where id = $1`, [job.id, String(err.message)]);
        await tx.query(`select app._refund($1, 'automation_sends_monthly', $2)`, [job.tenant_id, idem]);
        await tx.query(`insert into notifications (tenant_id, kind, message, data) values ($1, 'automation_failed', $2, $3)`,
          [job.tenant_id, `Une relance automatique n'a pas pu être envoyée (${err.message}).`, JSON.stringify({ job_id: job.id })]);
      } else {
        await tx.query(
          `update automation_jobs set status = 'pending', last_error = $2,
              scheduled_for = app.now() + make_interval(mins => $3), updated_at = now() where id = $1`,
          [job.id, String(err.message), 15 * 2 ** (claimed.tries - 1)]);
        await tx.query(`select app._refund($1, 'automation_sends_monthly', $2)`, [job.tenant_id, idem]);
        await tx.query(`delete from usage_events where tenant_id = $1 and metric = 'automation_sends_monthly' and idempotency_key = $2`, [job.tenant_id, idem]);
      }
    }, 'scheduler');
    return permanent ? 'failed' : 'retried';
  }
}
