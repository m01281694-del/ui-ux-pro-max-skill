// Registre des routes. Chaque route déclare la permission exigée : le serveur la vérifie AVANT le
// handler (requirePermission), puis la base la revérifie (RLS / fonctions). Ce registre sert aussi
// au test « chaque fonctionnalité annoncée correspond à une route réellement protégée ».
import { randomBytes, randomUUID } from 'node:crypto';
import { AppError, quotaError, requirePermission } from '../entitlements.js';
import { diffPlans, publicCatalog, planById, upsellFor } from '../plans.js';
import { runAi } from '../ai/gateway.js';
import { hashToken, sessionCookie } from './server.js';
import * as auth from '../auth.js';
import { sendTransactional } from '../email/templates.js';

const withSession = (status, body, token, appUrl) => ({ __http: true, status, body, headers: { 'Set-Cookie': sessionCookie(token, appUrl) } });

const asUser = (ctx, fn) => ctx.db.asUser(ctx.userId, fn);
const str = (v, max = 300) => (v == null ? null : String(v).slice(0, max));
const STATUSES = ['new', 'in_progress', 'waiting_customer', 'closed'];

function pick(obj, keys) {
  return Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));
}

async function updateRow(tx, table, id, tenantId, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) throw new AppError(400, 'nothing_to_update', 'Aucun champ à modifier.');
  const sets = keys.map((k, i) => `${k} = $${i + 3}`).join(', ');
  const row = await tx.one(`update ${table} set ${sets} where id = $1 and tenant_id = $2 returning *`, [id, tenantId, ...keys.map((k) => fields[k])]);
  if (!row) throw new AppError(404, 'not_found', 'Ressource introuvable.');
  return row;
}

export function buildRoutes() {
  return [
    // ------------------------------------------------------------ public
    {
      method: 'GET', path: '/api/plans', auth: false,
      handler: (ctx) => ({
        ...publicCatalog(ctx.catalog),
        configuration: {
          billing_enabled: Boolean(ctx.services.billing?.enabled),
          ai_provider: Boolean(ctx.services.ai?.configured),
          email_provider: Boolean(ctx.services.email?.configured),
          automations_enabled: ctx.env.AUTOMATIONS_ENABLED === 'true',
          support_process: ctx.env.SUPPORT_PROCESS_READY === 'true',
        },
      }),
    },

    // ------------------------------------------------------------ comptes
    {
      method: 'POST', path: '/api/auth/signup', auth: false,
      handler: async (ctx) => {
        const r = await auth.signup(ctx, { companyName: ctx.body.company, name: ctx.body.name, email: ctx.body.email, password: ctx.body.password, acceptTerms: ctx.body.accept_terms });
        return withSession(201, { user_id: r.userId, tenant_id: r.tenantId }, r.token, ctx.services.appUrl);
      },
    },
    {
      method: 'POST', path: '/api/auth/login', auth: false,
      handler: async (ctx) => {
        const r = await auth.login(ctx, { email: ctx.body.email, password: ctx.body.password });
        return withSession(200, { user_id: r.userId }, r.token, ctx.services.appUrl);
      },
    },
    {
      method: 'POST', path: '/api/auth/logout', tenant: false,
      handler: async (ctx) => {
        await auth.logout(ctx, ctx.sessionToken);
        return withSession(200, { logged_out: true }, null, ctx.services.appUrl);
      },
    },
    { method: 'POST', path: '/api/auth/forgot', auth: false, handler: (ctx) => auth.forgotPassword(ctx, { email: ctx.body.email }) },
    { method: 'POST', path: '/api/auth/reset', auth: false, handler: (ctx) => auth.resetPassword(ctx, { token: ctx.body.token, password: ctx.body.password }) },
    { method: 'POST', path: '/api/auth/password', tenant: false, handler: (ctx) => auth.changePassword(ctx, { current: ctx.body.current, password: ctx.body.password }) },
    { method: 'GET', path: '/api/invitations/lookup', auth: false, handler: (ctx) => auth.lookupInvitation(ctx, ctx.query.token) },
    {
      method: 'POST', path: '/api/auth/signup-invited', auth: false,
      handler: async (ctx) => {
        const r = await auth.signupInvited(ctx, { token: ctx.body.token, name: ctx.body.name, password: ctx.body.password, acceptTerms: ctx.body.accept_terms });
        return withSession(201, { user_id: r.userId, tenant_id: r.tenantId }, r.token, ctx.services.appUrl);
      },
    },

    // ------------------------------------------------------------ session / droits
    {
      method: 'GET', path: '/api/me', tenant: false,
      handler: (ctx) => asUser(ctx, async (tx) => ({
        user: await tx.one('select id, email, display_name from users where id = app.current_user_id()'),
        memberships: await tx.query(
          `select m.tenant_id, m.role, t.name from memberships m join tenants t on t.id = m.tenant_id
            where m.user_id = app.current_user_id() and m.status = 'active'`),
      })),
    },
    {
      method: 'GET', path: '/api/entitlements',
      handler: (ctx) => {
        const locked = {};
        for (const perm of Object.keys(ctx.catalog.permissions)) {
          if (!ctx.ent.plan_permissions.includes(perm)) locked[perm] = upsellFor(ctx.catalog, perm, ctx.ent.plan_id);
        }
        const plan = planById(ctx.catalog, ctx.ent.plan_id);
        return { ...ctx.ent, plan: plan && { id: plan.id, name: plan.name, price_cents: plan.price_cents }, locked };
      },
    },

    // ------------------------------------------------------------ clients
    {
      method: 'GET', path: '/api/customers', permission: 'customers.view',
      handler: (ctx) => asUser(ctx, (tx) => tx.query(
        'select id, name, email, phone, notes, opted_out_at, created_at from customers where tenant_id = $1 order by name limit 500', [ctx.tenantId])),
    },
    {
      method: 'POST', path: '/api/customers', permission: 'customers.manage',
      handler: (ctx) => {
        const name = str(ctx.body.name, 200);
        if (!name) throw new AppError(400, 'invalid_input', 'Nom requis.');
        return asUser(ctx, async (tx) => ({
          __http: true, status: 201,
          body: await tx.one(
            'insert into customers (tenant_id, name, email, phone, notes) values ($1,$2,$3,$4,$5) returning id, name, email, phone, notes',
            [ctx.tenantId, name, str(ctx.body.email, 254), str(ctx.body.phone, 40), str(ctx.body.notes, 5000)]),
        }));
      },
    },
    {
      method: 'GET', path: '/api/customers/:id', permission: 'customers.view',
      handler: (ctx) => asUser(ctx, async (tx) => {
        const c = await tx.one('select id, name, email, phone, notes, opted_out_at, created_at from customers where id = $1 and tenant_id = $2', [ctx.params.id, ctx.tenantId]);
        if (!c) throw new AppError(404, 'not_found', 'Client introuvable.');
        c.requests = await tx.query('select id, subject, status, priority, created_at from requests where customer_id = $1 order by created_at desc', [c.id]);
        return c;
      }),
    },
    {
      method: 'PATCH', path: '/api/customers/:id', permission: 'customers.manage',
      handler: (ctx) => asUser(ctx, (tx) => updateRow(tx, 'customers', ctx.params.id, ctx.tenantId, pick(ctx.body, ['name', 'email', 'phone', 'notes']))),
    },

    // ------------------------------------------------------------ demandes
    {
      method: 'GET', path: '/api/requests', permission: 'requests.view',
      handler: (ctx) => asUser(ctx, (tx) => {
        const order = ctx.ent.permissions.includes('priorities.advanced')
          ? `array_position(array['urgent','high','normal','low'], priority), due_at nulls last, created_at desc`
          : 'created_at desc';
        const status = STATUSES.includes(ctx.query.status) ? ctx.query.status : null;
        return tx.query(
          `select id, customer_id, subject, status, priority, due_at, category, channel, created_at, updated_at, closed_at,
                  last_outbound_at, last_customer_reply_at
             from requests where tenant_id = $1 and ($2::text is null or status = $2) order by ${order} limit 500`,
          [ctx.tenantId, status]);
      }),
    },
    {
      method: 'POST', path: '/api/requests', permission: 'requests.create',
      handler: async (ctx) => {
        const subject = str(ctx.body.subject);
        if (!subject) throw new AppError(400, 'invalid_input', 'Objet requis.');
        if (['low', 'urgent'].includes(ctx.body.priority) || ctx.body.due_at) requirePermission(ctx, 'priorities.advanced');
        const idem = str(ctx.headers['idempotency-key'], 200) ?? randomUUID();
        const res = await asUser(ctx, async (tx) => (await tx.one(
          'select app.create_request($1, $2, $3, $4, $5, $6, $7, $8) as r',
          [ctx.tenantId, ctx.body.customer_id ?? null, subject, str(ctx.body.body, 20000) ?? '', ctx.body.priority ?? null,
           ctx.body.channel ?? null, ctx.body.due_at ?? null, `request:${idem}`])).r);
        if (!res.ok) throw quotaError(ctx, res);
        return { __http: true, status: res.replay ? 200 : 201, body: { id: res.request_id, replay: res.replay, quota: { used: res.used, limit: res.limit, alerts: res.alerts ?? [] } } };
      },
    },
    {
      method: 'GET', path: '/api/requests/:id', permission: 'requests.view',
      handler: (ctx) => asUser(ctx, async (tx) => {
        const r = await tx.one('select * from requests where id = $1 and tenant_id = $2', [ctx.params.id, ctx.tenantId]);
        if (!r) throw new AppError(404, 'not_found', 'Demande introuvable.');
        delete r.reply_token;
        r.messages = await tx.query('select id, direction, origin, subject, body, status, created_at, sent_at from messages where request_id = $1 order by created_at', [r.id]);
        r.reminders = await tx.query('select id, due_at, note, done_at from reminders where request_id = $1 order by due_at', [r.id]);
        return r;
      }),
    },
    {
      method: 'GET', path: '/api/requests/:id/history', permission: 'requests.view',
      handler: (ctx) => asUser(ctx, (tx) => tx.query(
        'select kind, data, actor_user_id, created_at from request_events where request_id = $1 and tenant_id = $2 order by id', [ctx.params.id, ctx.tenantId])),
    },
    {
      method: 'PATCH', path: '/api/requests/:id', permission: 'requests.manage',
      handler: (ctx) => {
        const fields = pick(ctx.body, ['status', 'priority', 'due_at', 'category', 'subject', 'body', 'customer_id']);
        if (fields.status && !STATUSES.includes(fields.status)) throw new AppError(400, 'invalid_input', 'Statut invalide.');
        if ((['low', 'urgent'].includes(fields.priority) || fields.due_at) ) requirePermission(ctx, 'priorities.advanced');
        return asUser(ctx, async (tx) => {
          const before = await tx.one('select status, priority from requests where id = $1 and tenant_id = $2', [ctx.params.id, ctx.tenantId]);
          if (!before) throw new AppError(404, 'not_found', 'Demande introuvable.');
          const row = await updateRow(tx, 'requests', ctx.params.id, ctx.tenantId, fields);
          for (const k of ['status', 'priority']) {
            if (fields[k] && fields[k] !== before[k]) {
              await tx.query('insert into request_events (tenant_id, request_id, kind, data, actor_user_id) values ($1,$2,$3,$4, app.current_user_id())',
                [ctx.tenantId, row.id, `${k}_changed`, JSON.stringify({ from: before[k], to: fields[k] })]);
            }
          }
          delete row.reply_token;
          return row;
        });
      },
    },
    {
      // Suivi manuel : journaliser un échange (appel, e-mail envoyé depuis sa messagerie, réponse reçue).
      method: 'POST', path: '/api/requests/:id/messages', permission: 'requests.manage',
      handler: (ctx) => {
        const direction = ctx.body.direction === 'inbound' ? 'inbound' : 'outbound';
        return asUser(ctx, async (tx) => ({
          __http: true, status: 201,
          body: await tx.one(
            `insert into messages (tenant_id, request_id, direction, origin, subject, body, status, created_by)
             values ($1, $2, $3, 'manual', $4, $5, $6, app.current_user_id()) returning id, direction, status, created_at`,
            [ctx.tenantId, ctx.params.id, direction, str(ctx.body.subject), str(ctx.body.body, 20000) ?? '', direction === 'inbound' ? 'received' : 'logged']),
        }));
      },
    },

    // ------------------------------------------------------------ rappels manuels
    {
      method: 'POST', path: '/api/requests/:id/reminders', permission: 'reminders.manual',
      handler: (ctx) => {
        if (!ctx.body.due_at || Number.isNaN(Date.parse(ctx.body.due_at))) throw new AppError(400, 'invalid_input', 'Date de rappel requise.');
        return asUser(ctx, async (tx) => ({
          __http: true, status: 201,
          body: await tx.one(
            'insert into reminders (tenant_id, request_id, due_at, note, created_by) values ($1,$2,$3,$4, app.current_user_id()) returning *',
            [ctx.tenantId, ctx.params.id, ctx.body.due_at, str(ctx.body.note, 2000) ?? '']),
        }));
      },
    },
    {
      method: 'GET', path: '/api/reminders', permission: 'requests.view',
      handler: (ctx) => asUser(ctx, (tx) => tx.query(
        `select r.*, q.subject from reminders r join requests q on q.id = r.request_id
          where r.tenant_id = $1 and r.done_at is null and ($2::boolean is not true or r.due_at <= app.now()) order by r.due_at`,
        [ctx.tenantId, ctx.query.due === '1'])),
    },
    {
      method: 'PATCH', path: '/api/reminders/:id', permission: 'reminders.manual',
      handler: (ctx) => asUser(ctx, (tx) => updateRow(tx, 'reminders', ctx.params.id, ctx.tenantId,
        ctx.body.done ? { done_at: new Date(ctx.db.now()).toISOString() } : pick(ctx.body, ['note', 'due_at']))),
    },

    // ------------------------------------------------------------ statistiques
    {
      method: 'GET', path: '/api/stats/basic', permission: 'statistics.basic',
      handler: (ctx) => asUser(ctx, async (tx) => {
        const byStatus = await tx.query('select status, count(*)::int as n from requests where tenant_id = $1 group by status', [ctx.tenantId]);
        const period = await tx.one(
          `select count(*) filter (where created_at >= ps)::int as created, count(*) filter (where closed_at >= ps)::int as closed
             from requests, app.current_period($1) where tenant_id = $1`, [ctx.tenantId]);
        const due = await tx.one('select count(*)::int as n from reminders where tenant_id = $1 and done_at is null and due_at <= app.now()', [ctx.tenantId]);
        return { by_status: Object.fromEntries(byStatus.map((r) => [r.status, r.n])), period, reminders_due: due.n };
      }),
    },
    {
      method: 'GET', path: '/api/stats/advanced', permission: 'statistics.advanced',
      handler: (ctx) => asUser(ctx, async (tx) => {
        const t = ctx.tenantId;
        const first = await tx.one(
          `select round(avg(extract(epoch from first_response_at - created_at)) / 3600, 1)::float as avg_first_response_hours,
                  round(100.0 * count(*) filter (where status = 'closed') / nullif(count(*), 0), 1)::float as closure_rate_pct
             from requests where tenant_id = $1`, [t]);
        const byPriority = await tx.query('select priority, count(*)::int as n from requests where tenant_id = $1 group by priority', [t]);
        const byCategory = await tx.query(`select coalesce(category, 'non classée') as category, count(*)::int as n from requests where tenant_id = $1 group by 1`, [t]);
        const weekly = await tx.query(
          `select to_char(date_trunc('week', created_at), 'YYYY-MM-DD') as week, count(*)::int as created
             from requests where tenant_id = $1 and created_at >= app.now() - interval '8 weeks' group by 1 order by 1`, [t]);
        const out = { ...first, by_priority: byPriority, by_category: byCategory, weekly };
        if (ctx.ent.permissions.includes('automations.view')) {
          out.automations = await tx.query('select status, coalesce(reason, \'\') as reason, count(*)::int as n from automation_jobs where tenant_id = $1 group by 1, 2', [t]);
        }
        return out;
      }),
    },

    // ------------------------------------------------------------ modèles (Pro+)
    {
      method: 'GET', path: '/api/templates', permission: 'templates.manage',
      handler: (ctx) => asUser(ctx, (tx) => tx.query('select * from message_templates where tenant_id = $1 and status <> \'archived\' order by name', [ctx.tenantId])),
    },
    {
      method: 'POST', path: '/api/templates', permission: 'templates.manage',
      handler: (ctx) => {
        if (!ctx.body.name || !ctx.body.body) throw new AppError(400, 'invalid_input', 'Nom et contenu requis.');
        return asUser(ctx, async (tx) => ({
          __http: true, status: 201,
          body: await tx.one(
            `insert into message_templates (tenant_id, name, subject, body, created_by) values ($1,$2,$3,$4, app.current_user_id()) returning *`,
            [ctx.tenantId, str(ctx.body.name, 120), str(ctx.body.subject) ?? '', str(ctx.body.body, 10000)]),
        }));
      },
    },
    {
      method: 'PATCH', path: '/api/templates/:id', permission: 'templates.manage',
      handler: (ctx) => {
        const f = pick(ctx.body, ['name', 'subject', 'body']);
        if (ctx.body.archived) f.status = 'archived';
        return asUser(ctx, (tx) => updateRow(tx, 'message_templates', ctx.params.id, ctx.tenantId, f));
      },
    },
    {
      method: 'POST', path: '/api/templates/:id/approve', permission: 'templates.manage',
      handler: (ctx) => asUser(ctx, (tx) => updateRow(tx, 'message_templates', ctx.params.id, ctx.tenantId, { status: 'approved' })),
    },

    // ------------------------------------------------------------ IA (Pro+) — assistance uniquement
    { method: 'POST', path: '/api/requests/:id/ai/summary', permission: 'ai.summary',
      handler: (ctx) => runAi(ctx, { kind: 'summary', requestId: ctx.params.id, idempotencyKey: ctx.headers['idempotency-key'] }) },
    { method: 'POST', path: '/api/requests/:id/ai/classify', permission: 'ai.classification',
      handler: (ctx) => runAi(ctx, { kind: 'classification', requestId: ctx.params.id, idempotencyKey: ctx.headers['idempotency-key'] }) },
    { method: 'POST', path: '/api/requests/:id/ai/suggest-reply', permission: 'ai.suggestions',
      handler: (ctx) => runAi(ctx, { kind: 'suggestions', requestId: ctx.params.id, idempotencyKey: ctx.headers['idempotency-key'] }) },

    // ------------------------------------------------------------ automatisations (Business)
    {
      method: 'GET', path: '/api/automations', permission: 'automations.view',
      handler: (ctx) => asUser(ctx, async (tx) => ({
        rules: await tx.query('select * from automation_rules where tenant_id = $1 order by created_at', [ctx.tenantId]),
        settings: await tx.one('select * from tenant_settings where tenant_id = $1', [ctx.tenantId]),
        globally_enabled: ctx.env.AUTOMATIONS_ENABLED === 'true',
        email_provider_configured: Boolean(ctx.services.email?.configured),
      })),
    },
    {
      method: 'POST', path: '/api/automations', permission: 'automations.create',
      handler: (ctx) => {
        const b = ctx.body;
        const statuses = Array.isArray(b.conditions?.statuses) ? b.conditions.statuses.filter((s) => STATUSES.includes(s) && s !== 'closed') : ['waiting_customer'];
        if (statuses.length === 0) throw new AppError(400, 'invalid_input', 'Au moins un statut de demande non clôturé est requis.');
        const conditions = { statuses };
        if (Array.isArray(b.conditions?.priorities)) conditions.priorities = b.conditions.priorities.filter((p) => ['low', 'normal', 'high', 'urgent'].includes(p));
        return asUser(ctx, async (tx) => ({
          __http: true, status: 201,
          body: await tx.one(
            `insert into automation_rules (tenant_id, name, template_id, delay_hours, max_attempts, conditions, created_by)
             values ($1,$2,$3,$4,$5,$6, app.current_user_id()) returning *`,
            [ctx.tenantId, str(b.name, 120), b.template_id ?? null, Number(b.delay_hours), Number(b.max_attempts ?? 2), JSON.stringify(conditions)]),
        }));
      },
    },
    {
      method: 'PATCH', path: '/api/automations/:id', permission: 'automations.create',
      handler: (ctx) => {
        const f = pick(ctx.body, ['name', 'template_id', 'delay_hours', 'max_attempts']);
        if (ctx.body.conditions) f.conditions = JSON.stringify(ctx.body.conditions);
        return asUser(ctx, async (tx) => {
          // Toute modification d'une règle active la repasse en pause : réactivation explicite requise.
          const cur = await tx.one('select status from automation_rules where id = $1 and tenant_id = $2', [ctx.params.id, ctx.tenantId]);
          if (cur?.status === 'active') f.status = 'paused';
          return updateRow(tx, 'automation_rules', ctx.params.id, ctx.tenantId, f);
        });
      },
    },
    {
      method: 'POST', path: '/api/automations/:id/activate', permission: 'automations.create',
      handler: (ctx) => {
        if (ctx.body.confirm_authorization !== true) {
          throw new AppError(422, 'authorization_required',
            "Confirmez que l'entreprise autorise l'envoi automatique de ces relances à ses clients et que ces envois respectent les règles applicables.");
        }
        return asUser(ctx, (tx) => updateRow(tx, 'automation_rules', ctx.params.id, ctx.tenantId, {
          status: 'active', authorized_by: ctx.userId, authorized_at: new Date(ctx.db.now()).toISOString(),
        }));
      },
    },
    {
      method: 'POST', path: '/api/automations/:id/pause', permission: 'automations.create',
      handler: (ctx) => asUser(ctx, async (tx) => {
        const row = await updateRow(tx, 'automation_rules', ctx.params.id, ctx.tenantId, { status: 'paused' });
        return row;
      }),
    },
    {
      // Arrêt d'urgence de toutes les relances de l'entreprise (effet immédiat au prochain passage).
      method: 'POST', path: '/api/automations/pause-all', permission: 'automations.view',
      handler: (ctx) => asUser(ctx, async (tx) => tx.one(
        `insert into tenant_settings (tenant_id, automations_paused) values ($1, $2)
         on conflict (tenant_id) do update set automations_paused = excluded.automations_paused, updated_at = now() returning *`,
        [ctx.tenantId, ctx.body.paused !== false])),
    },
    {
      method: 'GET', path: '/api/automations/jobs', permission: 'automations.view',
      handler: (ctx) => asUser(ctx, (tx) => tx.query(
        `select j.id, j.rule_id, j.request_id, j.attempt, j.scheduled_for, j.status, j.reason, j.tries, j.last_error,
                m.status as message_status, m.sent_at, m.provider_message_id
           from automation_jobs j left join messages m on m.id = j.message_id
          where j.tenant_id = $1 order by j.created_at desc limit 500`, [ctx.tenantId])),
    },

    // ------------------------------------------------------------ équipe
    {
      method: 'GET', path: '/api/team', permission: 'team.view',
      handler: (ctx) => asUser(ctx, async (tx) => ({
        members: await tx.query(
          `select m.id, m.role, m.status, u.email, u.display_name from memberships m join users u on u.id = m.user_id
            where m.tenant_id = $1 and m.status <> 'removed' order by m.created_at`, [ctx.tenantId]),
        invitations: await tx.query('select id, email, role, status, expires_at from invitations where tenant_id = $1 and status in (\'pending\', \'suspended_over_limit\')', [ctx.tenantId]),
        seats: { used: ctx.ent.usage.seats, limit: ctx.ent.limits.seats },
      })),
    },
    {
      method: 'POST', path: '/api/team/invitations', permission: 'team.invite',
      handler: async (ctx) => {
        const email = str(ctx.body.email, 254);
        if (!email || !email.includes('@')) throw new AppError(400, 'invalid_input', 'E-mail invalide.');
        const token = randomBytes(24).toString('base64url');
        const res = await asUser(ctx, async (tx) => (await tx.one('select app.invite_member($1,$2,$3,$4) as r',
          [ctx.tenantId, email, ctx.body.role === 'admin' ? 'admin' : 'member', hashToken(token)])).r);
        if (!res.ok && res.reason === 'quota_exceeded') throw quotaError(ctx, res);
        if (!res.ok) throw new AppError(409, res.reason, 'Cette personne fait déjà partie de l\'équipe.');
        const link = `${ctx.services.appUrl}/invitation.html#token=${token}`;
        const company = await asUser(ctx, (tx) => tx.one('select name from tenants where id = $1', [ctx.tenantId]));
        const me = await asUser(ctx, (tx) => tx.one('select coalesce(display_name, email) as n from users where id = app.current_user_id()'));
        const mail = await sendTransactional(ctx.services, 'invitation', { to: email, company: company.name, inviter: me.n, link });
        // Le lien est aussi renvoyé à l'administrateur (à transmettre lui-même si l'e-mail n'est pas parti).
        // Il ne fonctionne que pour l'adresse invitée.
        return { __http: true, status: 201, body: { id: res.invitation_id, accept_token: token, link, email_sent: mail.sent, seats: { used: res.used, limit: res.limit } } };
      },
    },
    {
      method: 'POST', path: '/api/team/invitations/:id/revoke', permission: 'team.manage',
      handler: (ctx) => asUser(ctx, async (tx) => {
        const r = await tx.one(`update invitations set status = 'revoked' where id = $1 and tenant_id = $2 and status in ('pending', 'suspended_over_limit') returning id, status`, [ctx.params.id, ctx.tenantId]);
        if (!r) throw new AppError(404, 'not_found', 'Invitation introuvable.');
        return r;
      }),
    },
    {
      method: 'POST', path: '/api/invitations/accept', tenant: false,
      handler: async (ctx) => {
        const res = await asUser(ctx, async (tx) => (await tx.one('select app.accept_invitation($1) as r', [hashToken(String(ctx.body.token ?? ''))])).r);
        if (!res.ok) throw new AppError(res.reason === 'quota_exceeded' ? 429 : 400, res.reason, 'Invitation impossible à accepter.');
        return res;
      },
    },
    {
      method: 'PATCH', path: '/api/team/:id', permission: 'team.manage',
      handler: (ctx) => {
        const f = {};
        if (['admin', 'member'].includes(ctx.body.role)) f.role = ctx.body.role;
        if (ctx.body.status === 'removed') f.status = 'removed';
        return asUser(ctx, (tx) => updateRow(tx, 'memberships', ctx.params.id, ctx.tenantId, f));
      },
    },
    {
      method: 'POST', path: '/api/team/:id/reactivate', permission: 'team.manage',
      handler: async (ctx) => {
        const res = await asUser(ctx, async (tx) => (await tx.one('select app.reactivate_member($1, $2) as r', [ctx.tenantId, ctx.params.id])).r);
        if (!res.ok && res.reason === 'quota_exceeded') throw quotaError(ctx, res);
        if (!res.ok) throw new AppError(404, 'not_found', 'Collaborateur introuvable.');
        return res;
      },
    },

    // ------------------------------------------------------------ consommation, notifications, export
    {
      method: 'GET', path: '/api/usage', permission: 'billing.view',
      handler: (ctx) => asUser(ctx, async (tx) => ({
        current: { usage: ctx.ent.usage, limits: ctx.ent.limits, period_start: ctx.ent.current_period_start, period_end: ctx.ent.current_period_end },
        history: await tx.query('select metric, period_start, period_end, used from usage_counters where tenant_id = $1 order by period_start desc, metric', [ctx.tenantId]),
        alerts: await tx.query('select metric, period_start, threshold, created_at from quota_alerts where tenant_id = $1 order by created_at desc', [ctx.tenantId]),
      })),
    },
    {
      method: 'GET', path: '/api/notifications',
      handler: (ctx) => asUser(ctx, (tx) => tx.query('select id, kind, message, data, read_at, created_at from notifications where tenant_id = $1 order by created_at desc limit 100', [ctx.tenantId])),
    },
    {
      method: 'GET', path: '/api/export', permission: 'data.export',
      handler: (ctx) => asUser(ctx, async (tx) => ({
        exported_at: new Date(ctx.db.now()).toISOString(),
        customers: await tx.query('select * from customers where tenant_id = $1', [ctx.tenantId]),
        requests: await tx.query('select * from requests where tenant_id = $1', [ctx.tenantId]),
        messages: await tx.query('select * from messages where tenant_id = $1', [ctx.tenantId]),
        reminders: await tx.query('select * from reminders where tenant_id = $1', [ctx.tenantId]),
        templates: ctx.ent.plan_permissions.includes('templates.manage') || ctx.ent.plan_permissions.includes('automations.view')
          ? await tx.query('select * from message_templates where tenant_id = $1', [ctx.tenantId]) : [],
      })),
    },

    // ------------------------------------------------------------ abonnement
    {
      method: 'GET', path: '/api/billing', permission: 'billing.view',
      handler: (ctx) => asUser(ctx, async (tx) => ({
        subscription: await tx.one(
          `select plan_id, status, current_period_start, current_period_end, cancel_at_period_end, scheduled_plan_id, past_due_since
             from subscriptions where tenant_id = $1`, [ctx.tenantId]),
        audit: await tx.query('select action, actor, created_at, new_value->>\'plan_id\' as plan_id, new_value->>\'status\' as status from subscription_audit_log where tenant_id = $1 order by id desc limit 50', [ctx.tenantId]),
        requests: await tx.query('select from_plan, to_plan, kind, status, created_at from plan_change_requests where tenant_id = $1 order by created_at desc limit 20', [ctx.tenantId]),
        billing_enabled: Boolean(ctx.services.billing?.enabled),
      })),
    },
    {
      method: 'GET', path: '/api/billing/preview', permission: 'billing.view',
      handler: (ctx) => previewChange(ctx, String(ctx.query.plan ?? '')),
    },
    {
      method: 'POST', path: '/api/billing/change-plan', permission: 'billing.manage',
      handler: (ctx) => requestChange(ctx, String(ctx.body.plan ?? '')),
    },
    {
      // Premier abonnement (ou ré-abonnement après résiliation) : page de paiement Stripe.
      method: 'POST', path: '/api/billing/checkout', permission: 'billing.manage',
      handler: (ctx) => startCheckout(ctx, String(ctx.body.plan ?? '')),
    },
    {
      // Portail client Stripe : carte bancaire, factures, adresse de facturation, résiliation.
      method: 'POST', path: '/api/billing/portal', permission: 'billing.manage',
      handler: async (ctx) => {
        const billing = ctx.services.billing;
        if (!billing?.enabled) throw new AppError(503, 'billing_disabled', "Le paiement en ligne n'est pas encore activé.");
        const sub = await ctx.db.asService((tx) => tx.one('select provider_customer_id from subscriptions where tenant_id = $1', [ctx.tenantId]), 'billing');
        if (!sub?.provider_customer_id) throw new AppError(409, 'no_billing_account', 'Aucun compte de facturation : choisissez d\'abord une offre.');
        try {
          const r = await billing.portal({ customerId: sub.provider_customer_id });
          return { url: r.url };
        } catch {
          throw new AppError(502, 'billing_provider_error', 'Le prestataire de paiement est indisponible. Réessayez dans quelques minutes.');
        }
      },
    },
    {
      method: 'POST', path: '/api/billing/cancel', permission: 'billing.manage',
      handler: (ctx) => requestCancel(ctx, 'cancel'),
    },
    {
      method: 'POST', path: '/api/billing/resume', permission: 'billing.manage',
      handler: (ctx) => requestCancel(ctx, 'resume'),
    },
  ];
}

export async function previewChange(ctx, target) {
  const current = ctx.ent.plan_id;
  if (!planById(ctx.catalog, target)) throw new AppError(400, 'unknown_plan', 'Offre inconnue.');
  if (!current) throw new AppError(409, 'no_subscription', 'Aucun abonnement en cours.');
  const diff = diffPlans(ctx.catalog, current, target);
  const to = planById(ctx.catalog, target);
  const impacts = await ctx.db.asUser(ctx.userId, async (tx) => {
    const activeRules = (await tx.one(`select count(*)::int as n from automation_rules where tenant_id = $1 and status = 'active'`, [ctx.tenantId])).n;
    const pendingJobs = (await tx.one(`select count(*)::int as n from automation_jobs where tenant_id = $1 and status = 'pending'`, [ctx.tenantId])).n;
    const templates = (await tx.one(`select count(*)::int as n from message_templates where tenant_id = $1`, [ctx.tenantId])).n;
    return { activeRules, pendingJobs, templates };
  });
  const seatsOver = Math.max(0, (ctx.ent.usage.seats ?? 0) - to.limits.seats);
  const warnings = [];
  if (diff.kind === 'downgrade') {
    if (!to.permissions.includes('automations.execute') && impacts.activeRules > 0) {
      warnings.push(`${impacts.activeRules} automatisation(s) active(s) seront mises en pause (configuration conservée) et ${impacts.pendingJobs} relance(s) planifiée(s) annulée(s).`);
    }
    if (seatsOver > 0) {
      warnings.push(`Vous avez ${ctx.ent.usage.seats} collaborateurs/invitations pour ${to.limits.seats} place(s) : ${seatsOver} accès seront suspendus (les plus récents, jamais le propriétaire), sans suppression. Vous pouvez choisir avant l'échéance en retirant les accès de votre choix.`);
    }
    if (!to.permissions.includes('templates.manage') && impacts.templates > 0) {
      warnings.push(`Vos ${impacts.templates} modèle(s) seront conservés mais non modifiables.`);
    }
    for (const l of diff.limits) {
      const used = ctx.ent.usage[l.metric] ?? 0;
      if (['requests_monthly', 'ai_operations_monthly'].includes(l.metric) && used > l.to) {
        warnings.push(`Consommation actuelle « ${l.label} » (${used}) supérieure à la limite ${to.name} (${l.to}) : la nouvelle limite s'appliquera au prochain cycle.`);
      }
    }
  }
  return {
    ...diff,
    price_from_cents: planById(ctx.catalog, current).price_cents,
    price_to_cents: to.price_cents,
    effective: diff.kind === 'upgrade'
      ? 'Dès la confirmation du paiement par le prestataire (pas avant).'
      : `À la fin de la période en cours (${ctx.ent.renewal_date ?? 'date de renouvellement'}). Jusqu'à cette date, votre offre actuelle reste active.`,
    data_policy: 'Aucune donnée n\'est supprimée lors d\'un changement d\'offre.',
    warnings,
  };
}

async function recordChangeRequest(ctx, { from, to, kind, status, reference = null }) {
  await ctx.db.asService((tx) => tx.query(
    `insert into plan_change_requests (tenant_id, requested_by, from_plan, to_plan, kind, status, provider_reference) values ($1,$2,$3,$4,$5,$6,$7)`,
    [ctx.tenantId, ctx.userId, from, to, kind, status, reference]), `user:${ctx.userId}`);
}

const NEEDS_CHECKOUT = new Set(['none', 'canceled', 'incomplete']);

async function startCheckout(ctx, target) {
  const plan = planById(ctx.catalog, target);
  if (!plan) throw new AppError(400, 'unknown_plan', 'Offre inconnue.');
  if (!NEEDS_CHECKOUT.has(ctx.ent.status)) {
    throw new AppError(409, 'already_subscribed', 'Vous avez déjà un abonnement : utilisez le changement d\'offre.');
  }
  const billing = ctx.services.billing;
  if (!billing?.enabled) {
    await recordChangeRequest(ctx, { from: ctx.ent.plan_id ?? 'none', to: target, kind: 'upgrade', status: 'billing_disabled' });
    throw new AppError(503, 'billing_disabled', "Le paiement en ligne n'est pas encore activé. Aucun prélèvement n'a été effectué.");
  }
  const sub = await ctx.db.asService((tx) => tx.one('select provider_customer_id from subscriptions where tenant_id = $1', [ctx.tenantId]), 'billing');
  const me = await ctx.db.asUser(ctx.userId, (tx) => tx.one('select email from users where id = app.current_user_id()'));
  try {
    const r = await billing.startCheckout({
      tenantId: ctx.tenantId, planId: target, customerId: sub?.provider_customer_id ?? null, email: me.email,
      idempotencyKey: `checkout:${ctx.tenantId}:${target}:${ctx.headers['idempotency-key'] ?? randomUUID()}`,
    });
    await recordChangeRequest(ctx, { from: ctx.ent.plan_id ?? 'none', to: target, kind: 'upgrade', status: 'pending', reference: r.reference });
    return { __http: true, status: 201, body: { checkout_url: r.url,
      message: 'Vous allez être redirigé vers la page de paiement sécurisée. Votre offre sera activée dès la confirmation du paiement.' } };
  } catch {
    await recordChangeRequest(ctx, { from: ctx.ent.plan_id ?? 'none', to: target, kind: 'upgrade', status: 'failed' });
    throw new AppError(502, 'billing_provider_error', 'Le prestataire de paiement est indisponible. Aucun prélèvement n\'a été effectué.');
  }
}

async function requestChange(ctx, target) {
  if (NEEDS_CHECKOUT.has(ctx.ent.status)) return startCheckout(ctx, target);
  const preview = await previewChange(ctx, target);
  if (preview.kind === 'same') throw new AppError(409, 'same_plan', 'Vous êtes déjà sur cette offre.');
  const billing = ctx.services.billing;
  if (!billing?.enabled) {
    await recordChangeRequest(ctx, { from: preview.from, to: target, kind: preview.kind, status: 'billing_disabled' });
    throw new AppError(503, 'billing_disabled', "Le paiement en ligne n'est pas encore activé. Aucun changement n'a été effectué. Contactez-nous pour changer d'offre.");
  }
  const sub = await ctx.db.asService((tx) => tx.one('select provider, provider_subscription_id, provider_customer_id from subscriptions where tenant_id = $1', [ctx.tenantId]), 'billing');
  if (!sub?.provider_subscription_id) {
    throw new AppError(409, 'manual_subscription', 'Votre abonnement est géré manuellement : contactez-nous pour changer d\'offre.');
  }
  const idempotencyKey = `plan:${ctx.tenantId}:${target}:${ctx.headers['idempotency-key'] ?? randomUUID()}`;
  try {
    const r = await billing.changePlan({ subscriptionId: sub.provider_subscription_id, planId: target, kind: preview.kind, idempotencyKey });
    await recordChangeRequest(ctx, { from: preview.from, to: target, kind: preview.kind, status: 'pending', reference: r.reference });
    return { __http: true, status: 202, body: { status: 'pending_provider_confirmation', checkout_url: r.url ?? null, preview,
      message: "Votre demande est transmise. L'offre sera modifiée dès la confirmation du prestataire de paiement." } };
  } catch (err) {
    await recordChangeRequest(ctx, { from: preview.from, to: target, kind: preview.kind, status: 'failed' });
    throw new AppError(502, 'billing_provider_error', 'Le prestataire de paiement est indisponible. Aucun changement n\'a été effectué.');
  }
}

async function requestCancel(ctx, kind) {
  const billing = ctx.services.billing;
  const plan = ctx.ent.plan_id ?? 'starter';
  if (!billing?.enabled) {
    await recordChangeRequest(ctx, { from: plan, to: plan, kind, status: 'billing_disabled' });
    throw new AppError(503, 'billing_disabled', "Le paiement en ligne n'est pas encore activé. Aucun changement n'a été effectué.");
  }
  const sub = await ctx.db.asService((tx) => tx.one('select provider_subscription_id from subscriptions where tenant_id = $1', [ctx.tenantId]), 'billing');
  if (!sub?.provider_subscription_id) throw new AppError(409, 'no_subscription', 'Aucun abonnement payant à modifier.');
  try {
    const fn = kind === 'cancel' ? 'cancelAtPeriodEnd' : 'resume';
    const r = await billing[fn]({ subscriptionId: sub.provider_subscription_id, idempotencyKey: `${kind}:${ctx.tenantId}:${ctx.headers['idempotency-key'] ?? randomUUID()}` });
    await recordChangeRequest(ctx, { from: plan, to: plan, kind, status: 'pending', reference: r.reference });
    return { __http: true, status: 202, body: { status: 'pending_provider_confirmation',
      message: kind === 'cancel'
        ? `L'abonnement restera actif jusqu'au ${ctx.ent.renewal_date ?? 'terme de la période'}, puis passera en lecture seule. Vos données ne sont pas supprimées.`
        : 'La réactivation sera effective dès confirmation du prestataire.' } };
  } catch {
    await recordChangeRequest(ctx, { from: plan, to: plan, kind, status: 'failed' });
    throw new AppError(502, 'billing_provider_error', 'Le prestataire de paiement est indisponible. Aucun changement n\'a été effectué.');
  }
}
