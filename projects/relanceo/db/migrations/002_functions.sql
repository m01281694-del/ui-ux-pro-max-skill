-- RELANCEO — Subscription Entitlements System, côté base.
-- Toute la logique « statut d'abonnement -> droits » vit ici, une seule fois.
-- Le serveur Node interroge app.get_entitlements() et ne recalcule jamais ces règles.

-- Horloge contrôlable (tests) : app.now = paramètre de transaction, sinon now().
create or replace function app.now() returns timestamptz
language sql stable as $$
  select coalesce(nullif(current_setting('app.now', true), '')::timestamptz, now())
$$;

-- Identité de l'appelant (compatible Supabase : request.jwt.claims ->> 'sub').
create or replace function app.current_user_id() returns uuid
language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;

create or replace function app.config(k text) returns jsonb
language sql stable security definer set search_path = public, app as $$
  select value from app_config where key = k
$$;

-- Entreprises dont l'appelant est membre actif. SECURITY DEFINER pour éviter la récursion RLS.
create or replace function app.user_tenant_ids() returns setof uuid
language sql stable security definer set search_path = public, app as $$
  select tenant_id from memberships where user_id = app.current_user_id() and status = 'active'
$$;

create or replace function app.is_member(t uuid) returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (select 1 from memberships where tenant_id = t and user_id = app.current_user_id() and status = 'active')
$$;

create or replace function app.user_role(t uuid) returns text
language sql stable security definer set search_path = public, app as $$
  select role from memberships where tenant_id = t and user_id = app.current_user_id() and status = 'active'
$$;

-- 'full' | 'readonly'
create or replace function app.tenant_access_mode(t uuid) returns text
language plpgsql stable security definer set search_path = public, app as $$
declare
  s subscriptions%rowtype;
  pol jsonb := app.config('access_policy');
  n timestamptz := app.now();
begin
  select * into s from subscriptions where tenant_id = t;
  if not found then return 'readonly'; end if;
  if s.current_period_end is not null
     and n > s.current_period_end + make_interval(days => (pol ->> 'period_end_grace_days')::int) then
    return 'readonly';                                   -- renouvellement jamais confirmé
  end if;
  if s.status = 'active' then return 'full'; end if;
  if s.status = 'past_due' and s.past_due_since is not null
     and n < s.past_due_since + make_interval(days => (pol ->> 'past_due_grace_days')::int) then
    return 'full';                                       -- délai de grâce après échec de paiement
  end if;
  return 'readonly';
end $$;

-- Droit accordé à l'ENTREPRISE par son abonnement (indépendant du rôle de l'utilisateur).
create or replace function app.tenant_has_entitlement(t uuid, perm text) returns boolean
language plpgsql stable security definer set search_path = public, app as $$
declare
  p text;
  v_mode text := app.tenant_access_mode(t);
begin
  select plan_id into p from subscriptions where tenant_id = t;
  if p is null then p := 'starter'; end if;
  if not exists (select 1 from plan_permissions where plan_id = p and permission = perm) then
    return false;
  end if;
  if v_mode = 'full' then return true; end if;
  return exists (select 1 from access_policy_permissions ap where ap.mode = 'readonly' and ap.permission = perm);
end $$;

create or replace function app.role_allows(r text, perm text) returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (select 1 from role_permissions where role = r and (permission = perm or permission = '*'))
$$;

-- Droit effectif de l'utilisateur courant = membre actif ET rôle ET abonnement.
create or replace function app.has_permission(t uuid, perm text) returns boolean
language sql stable security definer set search_path = public, app as $$
  select coalesce(app.role_allows(app.user_role(t), perm), false) and app.tenant_has_entitlement(t, perm)
$$;

create or replace function app.tenant_limit(t uuid, m text) returns bigint
language sql stable security definer set search_path = public, app as $$
  select coalesce(
    (select limit_value from tenant_limit_overrides where tenant_id = t and metric = m),
    (select pl.limit_value from subscriptions s join plan_limits pl on pl.plan_id = s.plan_id
      where s.tenant_id = t and pl.metric = m),
    0)
$$;

-- Période de consommation courante, alignée sur le cycle d'abonnement.
-- Si le webhook de renouvellement tarde, la période avance quand même mois par mois
-- à partir de l'ancre de facturation : les compteurs se réinitialisent toujours.
create or replace function app.current_period(t uuid, out ps timestamptz, out pe timestamptz)
language plpgsql stable security definer set search_path = public, app as $$
declare
  s subscriptions%rowtype;
  n timestamptz := app.now();
  guard int := 0;
begin
  select * into s from subscriptions where tenant_id = t;
  if not found or s.current_period_start is null or s.current_period_end is null then
    ps := date_trunc('month', n); pe := ps + interval '1 month'; return;
  end if;
  ps := s.current_period_start; pe := s.current_period_end;
  while n >= pe and guard < 240 loop ps := pe; pe := pe + interval '1 month'; guard := guard + 1; end loop;
  while n < ps and guard < 480 loop pe := ps; ps := ps - interval '1 month'; guard := guard + 1; end loop;
end $$;

create or replace function app.gauge_usage(t uuid, m text) returns bigint
language sql stable security definer set search_path = public, app as $$
  select case m
    when 'seats' then
      (select count(*) from memberships where tenant_id = t and status = 'active')
      + (select count(*) from invitations where tenant_id = t and status = 'pending' and expires_at > app.now())
    when 'automation_rules_active' then
      (select count(*) from automation_rules where tenant_id = t and status = 'active')
    else 0 end
$$;

-- ------------------------------------------------------------ quotas (interne)
-- Consommation atomique et idempotente :
--  * l'événement est inséré d'abord (clé unique) -> une même clé ne compte jamais deux fois,
--    y compris si deux transactions concurrentes arrivent en même temps ;
--  * le compteur est incrémenté par un UPDATE conditionnel (verrou de ligne) -> pas de dépassement.
create or replace function app._consume(t uuid, m text, amount int, idem text, actor uuid, ref uuid)
returns jsonb language plpgsql volatile security definer set search_path = public, app as $$
declare
  lim bigint := app.tenant_limit(t, m);
  per record;
  ev_id bigint;
  prev usage_events%rowtype;
  newused bigint;
  cur bigint;
  th int;
  fired int[] := '{}';
begin
  if amount is null or amount <= 0 then raise exception 'invalid_amount'; end if;
  select * into per from app.current_period(t);

  if idem is not null then
    insert into usage_events (tenant_id, metric, amount, idempotency_key, ref_id, period_start, actor_user_id)
    values (t, m, amount, idem, ref, per.ps, actor)
    on conflict (tenant_id, metric, idempotency_key) do nothing
    returning id into ev_id;
    if ev_id is null then
      select * into prev from usage_events where tenant_id = t and metric = m and idempotency_key = idem;
      return jsonb_build_object('ok', not prev.refunded, 'replay', true, 'ref_id', prev.ref_id, 'limit', lim,
        'used', (select used from usage_counters where tenant_id = t and metric = m and period_start = prev.period_start));
    end if;
  end if;

  if lim <= 0 then
    if ev_id is not null then delete from usage_events where id = ev_id; end if;
    return jsonb_build_object('ok', false, 'reason', 'not_included', 'limit', 0, 'used', 0, 'metric', m);
  end if;

  insert into usage_counters (tenant_id, metric, period_start, period_end, used)
  values (t, m, per.ps, per.pe, 0) on conflict do nothing;

  update usage_counters set used = used + amount, updated_at = now()
   where tenant_id = t and metric = m and period_start = per.ps and used + amount <= lim
   returning used into newused;

  if newused is null then
    if ev_id is not null then delete from usage_events where id = ev_id; end if;
    select used into cur from usage_counters where tenant_id = t and metric = m and period_start = per.ps;
    return jsonb_build_object('ok', false, 'reason', 'quota_exceeded', 'limit', lim, 'used', cur, 'metric', m,
                              'period_end', per.pe);
  end if;

  if idem is null then
    insert into usage_events (tenant_id, metric, amount, idempotency_key, ref_id, period_start, actor_user_id)
    values (t, m, amount, null, ref, per.ps, actor);
  end if;

  for th in select (jsonb_array_elements_text(app.config('quota_alert_thresholds')))::int loop
    if newused * 100 >= th * lim then
      insert into quota_alerts (tenant_id, metric, period_start, threshold)
      values (t, m, per.ps, th) on conflict do nothing;
      if found then
        fired := fired || th;
        insert into notifications (tenant_id, kind, message, data)
        values (t, 'quota_alert',
                format('Vous avez utilisé %s %% de votre quota « %s » (%s / %s).', th, m, newused, lim),
                jsonb_build_object('metric', m, 'threshold', th, 'used', newused, 'limit', lim));
      end if;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'replay', false, 'used', newused, 'limit', lim, 'metric', m,
                            'alerts', to_jsonb(fired), 'period_start', per.ps, 'period_end', per.pe);
end $$;

-- Annulation d'une consommation (ex. envoi définitivement échoué). Idempotente.
create or replace function app._refund(t uuid, m text, idem text) returns boolean
language plpgsql volatile security definer set search_path = public, app as $$
declare ev usage_events%rowtype;
begin
  update usage_events set refunded = true
   where tenant_id = t and metric = m and idempotency_key = idem and not refunded
   returning * into ev;
  if not found then return false; end if;
  update usage_counters set used = greatest(used - ev.amount, 0), updated_at = now()
   where tenant_id = t and metric = m and period_start = ev.period_start;
  return true;
end $$;

-- ------------------------------------------------------------ API publique (authenticated)
create or replace function app.forbid(perm text) returns void language plpgsql as $$
begin
  raise exception 'forbidden:%', perm using errcode = '42501';
end $$;

create or replace function app.get_entitlements(t uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare
  s subscriptions%rowtype;
  r text := app.user_role(t);
  per record;
  plan_perms text[];
  tenant_perms text[];
  user_perms text[];
  lim jsonb;
  usage jsonb;
begin
  if r is null then return null; end if;
  select * into s from subscriptions where tenant_id = t;
  select * into per from app.current_period(t);
  select coalesce(array_agg(permission order by permission), '{}') into plan_perms
    from plan_permissions where plan_id = coalesce(s.plan_id, 'starter');
  select coalesce(array_agg(p order by p), '{}') into tenant_perms
    from unnest(plan_perms) p where app.tenant_has_entitlement(t, p);
  select coalesce(array_agg(p order by p), '{}') into user_perms
    from unnest(tenant_perms) p where app.role_allows(r, p);
  select coalesce(jsonb_object_agg(metric, app.tenant_limit(t, metric)), '{}') into lim
    from plan_limits where plan_id = coalesce(s.plan_id, 'starter');
  select coalesce(jsonb_object_agg(k, v), '{}') into usage from (
    select pl.metric as k,
      case when pl.metric in ('seats', 'automation_rules_active') then app.gauge_usage(t, pl.metric)
           else coalesce((select used from usage_counters uc where uc.tenant_id = t and uc.metric = pl.metric
                           and uc.period_start = per.ps), 0) end as v
    from plan_limits pl where pl.plan_id = coalesce(s.plan_id, 'starter')) x;
  return jsonb_build_object(
    'tenant_id', t,
    'role', r,
    'plan_id', s.plan_id,
    'status', coalesce(s.status, 'none'),
    'access_mode', app.tenant_access_mode(t),
    'cancel_at_period_end', coalesce(s.cancel_at_period_end, false),
    'scheduled_plan_id', s.scheduled_plan_id,
    'current_period_start', per.ps,
    'current_period_end', per.pe,
    'renewal_date', s.current_period_end,
    'past_due_since', s.past_due_since,
    'plan_permissions', to_jsonb(plan_perms),
    'tenant_permissions', to_jsonb(tenant_perms),
    'permissions', to_jsonb(user_perms),
    'limits', lim,
    'usage', usage);
end $$;

create or replace function app.create_request(
  t uuid, p_customer uuid, p_subject text, p_body text, p_priority text, p_channel text, p_due timestamptz, idem text)
returns jsonb language plpgsql volatile security definer set search_path = public, app as $$
declare
  res jsonb;
  rid uuid := gen_random_uuid();
begin
  if not app.has_permission(t, 'requests.create') then perform app.forbid('requests.create'); end if;
  if coalesce(p_priority, 'normal') in ('low', 'urgent') or p_due is not null then
    if not app.has_permission(t, 'priorities.advanced') then perform app.forbid('priorities.advanced'); end if;
  end if;
  if p_customer is not null and not exists (select 1 from customers where id = p_customer and tenant_id = t) then
    raise exception 'customer_not_found' using errcode = 'P0002';
  end if;
  res := app._consume(t, 'requests_monthly', 1, idem, app.current_user_id(), rid);
  if not (res ->> 'ok')::boolean then return res; end if;
  if (res ->> 'replay')::boolean then return res || jsonb_build_object('request_id', res ->> 'ref_id'); end if;
  insert into requests (id, tenant_id, customer_id, subject, body, priority, channel, due_at, created_by)
  values (rid, t, p_customer, p_subject, coalesce(p_body, ''), coalesce(p_priority, 'normal'),
          coalesce(p_channel, 'manual'), p_due, app.current_user_id());
  insert into request_events (tenant_id, request_id, kind, data, actor_user_id)
  values (t, rid, 'created', jsonb_build_object('subject', p_subject), app.current_user_id());
  return res || jsonb_build_object('request_id', rid);
end $$;

create or replace function app.consume_ai(t uuid, kind text, idem text) returns jsonb
language plpgsql volatile security definer set search_path = public, app as $$
begin
  if kind not in ('summary', 'classification', 'suggestions') then raise exception 'invalid_ai_kind'; end if;
  if not app.has_permission(t, 'ai.' || kind) then perform app.forbid('ai.' || kind); end if;
  return app._consume(t, 'ai_operations_monthly', 1, idem, app.current_user_id(), null);
end $$;

create or replace function app.refund_ai(t uuid, idem text) returns boolean
language plpgsql volatile security definer set search_path = public, app as $$
begin
  if not app.is_member(t) then perform app.forbid('member'); end if;
  if not app._refund(t, 'ai_operations_monthly', idem) then return false; end if;
  -- La clé redevient utilisable : l'utilisateur peut réessayer la même opération.
  delete from usage_events where tenant_id = t and metric = 'ai_operations_monthly' and idempotency_key = idem;
  return true;
end $$;

create or replace function app.invite_member(t uuid, p_email text, p_role text, p_token_hash text) returns jsonb
language plpgsql volatile security definer set search_path = public, app as $$
declare
  lim bigint;
  used bigint;
  inv_id uuid;
begin
  if not app.has_permission(t, 'team.invite') then perform app.forbid('team.invite'); end if;
  if p_role not in ('admin', 'member') then raise exception 'invalid_role'; end if;
  perform 1 from tenants where id = t for update;             -- sérialise les invitations concurrentes
  lim := app.tenant_limit(t, 'seats');
  used := app.gauge_usage(t, 'seats');
  if used + 1 > lim then
    return jsonb_build_object('ok', false, 'reason', 'quota_exceeded', 'metric', 'seats', 'limit', lim, 'used', used);
  end if;
  if exists (select 1 from memberships m join users u on u.id = m.user_id
              where m.tenant_id = t and lower(u.email) = lower(p_email) and m.status <> 'removed') then
    return jsonb_build_object('ok', false, 'reason', 'already_member');
  end if;
  insert into invitations (tenant_id, email, role, token_hash, invited_by, expires_at)
  values (t, lower(p_email), p_role, p_token_hash, app.current_user_id(), app.now() + interval '7 days')
  returning id into inv_id;
  return jsonb_build_object('ok', true, 'invitation_id', inv_id, 'limit', lim, 'used', used + 1);
end $$;

create or replace function app.accept_invitation(p_token_hash text) returns jsonb
language plpgsql volatile security definer set search_path = public, app as $$
declare
  inv invitations%rowtype;
  uemail text;
  lim bigint;
  used bigint;
begin
  select email into uemail from users where id = app.current_user_id();
  select * into inv from invitations where token_hash = p_token_hash for update;
  if not found or inv.status <> 'pending' or inv.expires_at <= app.now() then
    return jsonb_build_object('ok', false, 'reason', 'invalid_invitation');
  end if;
  if lower(uemail) <> lower(inv.email) then return jsonb_build_object('ok', false, 'reason', 'email_mismatch'); end if;
  perform 1 from tenants where id = inv.tenant_id for update;
  lim := app.tenant_limit(inv.tenant_id, 'seats');
  used := app.gauge_usage(inv.tenant_id, 'seats');            -- l'invitation est déjà comptée
  if used > lim then
    return jsonb_build_object('ok', false, 'reason', 'quota_exceeded', 'metric', 'seats', 'limit', lim, 'used', used);
  end if;
  insert into memberships (tenant_id, user_id, role) values (inv.tenant_id, app.current_user_id(), inv.role)
  on conflict (tenant_id, user_id) do update set status = 'active', role = excluded.role, updated_at = now();
  update invitations set status = 'accepted' where id = inv.id;
  return jsonb_build_object('ok', true, 'tenant_id', inv.tenant_id);
end $$;

create or replace function app.reactivate_member(t uuid, p_membership uuid) returns jsonb
language plpgsql volatile security definer set search_path = public, app as $$
declare lim bigint; used bigint;
begin
  if not app.has_permission(t, 'team.manage') then perform app.forbid('team.manage'); end if;
  perform 1 from tenants where id = t for update;
  lim := app.tenant_limit(t, 'seats');
  used := app.gauge_usage(t, 'seats');
  if used + 1 > lim then
    return jsonb_build_object('ok', false, 'reason', 'quota_exceeded', 'metric', 'seats', 'limit', lim, 'used', used);
  end if;
  update memberships set status = 'active', updated_at = now()
   where id = p_membership and tenant_id = t and status = 'suspended_over_limit';
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ------------------------------------------------------------ application des limites du plan
-- Appelée automatiquement après tout changement d'abonnement (trigger) et par le planificateur.
-- Ne supprime JAMAIS de donnée : met en pause, suspend, annule des envois planifiés.
create or replace function app.enforce_plan_limits(t uuid) returns jsonb
language plpgsql volatile security definer set search_path = public, app as $$
declare
  paused int := 0;
  canceled int := 0;
  suspended int := 0;
  lim bigint;
  excess bigint;
  rules_lim bigint;
begin
  if not app.tenant_has_entitlement(t, 'automations.execute') then
    update automation_rules set status = 'paused_by_plan', updated_at = now()
     where tenant_id = t and status = 'active';
    get diagnostics paused = row_count;
    update automation_jobs set status = 'canceled', reason = 'plan_or_subscription', updated_at = now()
     where tenant_id = t and status = 'pending';
    get diagnostics canceled = row_count;
  else
    rules_lim := app.tenant_limit(t, 'automation_rules_active');
    update automation_rules set status = 'paused_by_plan', updated_at = now()
     where id in (select id from automation_rules where tenant_id = t and status = 'active'
                   order by created_at desc offset rules_lim);
    get diagnostics paused = row_count;
  end if;

  lim := app.tenant_limit(t, 'seats');
  excess := app.gauge_usage(t, 'seats') - lim;
  if excess > 0 then
    -- Les invitations en attente sont suspendues d'abord, puis les membres non propriétaires
    -- les plus récents. Le propriétaire n'est jamais suspendu. Réactivation possible ensuite.
    with x as (
      select id from invitations where tenant_id = t and status = 'pending' and expires_at > app.now()
      order by created_at desc limit excess)
    update invitations set status = 'suspended_over_limit' where id in (select id from x);
    get diagnostics suspended = row_count;
    excess := app.gauge_usage(t, 'seats') - lim;
    if excess > 0 then
      with x as (
        select id from memberships where tenant_id = t and status = 'active' and role <> 'owner'
        order by created_at desc limit excess)
      update memberships set status = 'suspended_over_limit', updated_at = now() where id in (select id from x);
      get diagnostics excess = row_count;
      suspended := suspended + excess;
    end if;
  end if;
  return jsonb_build_object('automations_paused', paused, 'jobs_canceled', canceled, 'seats_suspended', suspended);
end $$;

-- ------------------------------------------------------------ triggers
create or replace function app.tg_subscription_audit() returns trigger
language plpgsql security definer set search_path = public, app as $$
declare effects jsonb;
begin
  insert into subscription_audit_log (tenant_id, actor, action, old_value, new_value)
  values (new.tenant_id, coalesce(nullif(current_setting('app.actor', true), ''), case when app.current_user_id() is not null then 'user:' || app.current_user_id() else 'service' end),
          lower(tg_op), case when tg_op = 'UPDATE' then to_jsonb(old) end, to_jsonb(new));
  effects := app.enforce_plan_limits(new.tenant_id);
  if (effects ->> 'automations_paused')::int > 0 or (effects ->> 'seats_suspended')::int > 0 then
    insert into notifications (tenant_id, kind, message, data)
    values (new.tenant_id, 'plan_limits_applied',
            'Votre abonnement a changé : certaines automatisations ont été mises en pause et/ou des accès collaborateurs suspendus. Aucune donnée n''a été supprimée.',
            effects);
  end if;
  return new;
end $$;

drop trigger if exists subscriptions_audit on subscriptions;
create trigger subscriptions_audit after insert or update on subscriptions
for each row execute function app.tg_subscription_audit();

create or replace function app.tg_immutable_tenant() returns trigger language plpgsql as $$
begin
  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'tenant_id is immutable' using errcode = '42501';
  end if;
  return new;
end $$;

do $$ declare tbl text; begin
  foreach tbl in array array['customers', 'requests', 'reminders', 'message_templates', 'automation_rules',
                             'messages', 'memberships', 'invitations', 'notifications', 'tenant_settings'] loop
    execute format('drop trigger if exists %I_immutable_tenant on %I', tbl, tbl);
    execute format('create trigger %I_immutable_tenant before update on %I for each row execute function app.tg_immutable_tenant()', tbl, tbl);
  end loop;
end $$;

-- Garde-fou des automatisations, applicable quel que soit le chemin d'écriture.
create or replace function app.tg_automation_rule_guard() returns trigger
language plpgsql security definer set search_path = public, app as $$
declare tpl message_templates%rowtype;
begin
  if tg_op = 'INSERT' and not app.tenant_has_entitlement(new.tenant_id, 'automations.create') then
    raise exception 'forbidden:automations.create' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and app.current_user_id() is not null
     and not app.tenant_has_entitlement(new.tenant_id, 'automations.create') then
    raise exception 'forbidden:automations.create' using errcode = '42501';
  end if;
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') then
    if not app.tenant_has_entitlement(new.tenant_id, 'automations.execute') then
      raise exception 'forbidden:automations.execute' using errcode = '42501';
    end if;
    select * into tpl from message_templates where id = new.template_id and tenant_id = new.tenant_id;
    if not found or tpl.status <> 'approved' then
      raise exception 'automation_template_not_approved' using errcode = '23514';
    end if;
    if new.authorized_by is null or new.authorized_at is null then
      raise exception 'automation_not_authorized' using errcode = '23514';
    end if;
    perform 1 from tenants where id = new.tenant_id for update;
    if app.gauge_usage(new.tenant_id, 'automation_rules_active') + 1
       > app.tenant_limit(new.tenant_id, 'automation_rules_active') then
      raise exception 'quota_exceeded:automation_rules_active' using errcode = '23514';
    end if;
  end if;
  if new.template_id is not null and not exists (
       select 1 from message_templates where id = new.template_id and tenant_id = new.tenant_id) then
    raise exception 'template_not_found' using errcode = '23503';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists automation_rules_guard on automation_rules;
create trigger automation_rules_guard before insert or update on automation_rules
for each row execute function app.tg_automation_rule_guard();

-- Toute relance en attente est annulée si la demande est clôturée.
create or replace function app.tg_request_closed() returns trigger
language plpgsql security definer set search_path = public, app as $$
begin
  if new.status = 'closed' and old.status <> 'closed' then
    new.closed_at := coalesce(new.closed_at, app.now());
    update automation_jobs set status = 'canceled', reason = 'request_closed', updated_at = now()
     where request_id = new.id and status = 'pending';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists requests_closed on requests;
create trigger requests_closed before update on requests
for each row execute function app.tg_request_closed();

-- Un message entrant (réponse du client) arrête les relances de la demande.
create or replace function app.tg_message_inserted() returns trigger
language plpgsql security definer set search_path = public, app as $$
begin
  if app.current_user_id() is not null and new.origin <> 'manual' then
    raise exception 'forbidden:message_origin' using errcode = '42501';
  end if;
  if app.current_user_id() is not null and new.automation_job_id is not null then
    raise exception 'forbidden:message_origin' using errcode = '42501';
  end if;
  if new.direction = 'inbound' then
    update requests set last_customer_reply_at = new.created_at where id = new.request_id;
    update automation_jobs set status = 'canceled', reason = 'customer_replied', updated_at = now()
     where request_id = new.request_id and status = 'pending';
  elsif new.status in ('sent', 'logged') then
    update requests set last_outbound_at = new.created_at,
                        first_response_at = coalesce(first_response_at, new.created_at)
     where id = new.request_id;
  end if;
  insert into request_events (tenant_id, request_id, kind, data, actor_user_id)
  values (new.tenant_id, new.request_id, 'message_' || new.direction,
          jsonb_build_object('origin', new.origin, 'status', new.status, 'message_id', new.id), new.created_by);
  return new;
end $$;

drop trigger if exists messages_inserted on messages;
create trigger messages_inserted after insert on messages
for each row execute function app.tg_message_inserted();

-- Seul un propriétaire/administrateur peut valider un modèle ; la validation est horodatée.
create or replace function app.tg_template_guard() returns trigger
language plpgsql security definer set search_path = public, app as $$
begin
  -- Modifier le contenu d'un modèle validé le repasse en brouillon : il doit être revalidé.
  if tg_op = 'UPDATE' and old.status = 'approved' and new.status = 'approved'
     and (new.body <> old.body or new.subject <> old.subject) then
    new.status := 'draft'; new.approved_by := null; new.approved_at := null;
  end if;
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') then
    if app.current_user_id() is not null then
      if coalesce(app.user_role(new.tenant_id), '') not in ('owner', 'admin') then
        raise exception 'forbidden:templates.approve' using errcode = '42501';
      end if;
      new.approved_by := app.current_user_id();
    end if;
    new.approved_at := now();
  end if;
  if new.status <> 'approved' then new.approved_by := null; new.approved_at := null; end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists templates_guard on message_templates;
create trigger templates_guard before insert or update on message_templates
for each row execute function app.tg_template_guard();

-- Un modèle repassé en brouillon met en pause les règles actives qui l'utilisent.
create or replace function app.tg_template_after() returns trigger
language plpgsql security definer set search_path = public, app as $$
begin
  if old.status = 'approved' and new.status <> 'approved' then
    update automation_rules set status = 'paused' where template_id = new.id and status = 'active';
  end if;
  return new;
end $$;

drop trigger if exists templates_after on message_templates;
create trigger templates_after after update on message_templates
for each row execute function app.tg_template_after();

-- Protection du propriétaire.
-- SECURITY INVOKER volontaire : current_user vaut "authenticated" pour une écriture directe de
-- l'utilisateur, et le propriétaire des fonctions pour app.reactivate_member (contrôle de places).
create or replace function app.tg_membership_guard() returns trigger
language plpgsql as $$
begin
  if current_user = 'authenticated' then
    if old.role = 'owner' or new.role = 'owner' then
      raise exception 'forbidden:owner_change' using errcode = '42501';
    end if;
    if new.status = 'active' and old.status <> 'active' then
      raise exception 'forbidden:use_reactivate_member' using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists memberships_guard on memberships;
create trigger memberships_guard before update on memberships
for each row execute function app.tg_membership_guard();

-- Horodatage par défaut via app.now() (horloge contrôlable pour les tests de cycles).
do $$ declare tbl text; begin
  foreach tbl in array array['customers', 'requests', 'request_events', 'reminders', 'message_templates', 'automation_rules',
                             'automation_jobs', 'messages', 'notifications', 'usage_events', 'quota_alerts',
                             'subscription_audit_log', 'plan_change_requests', 'invitations', 'memberships'] loop
    execute format('alter table %I alter column created_at set default app.now()', tbl);
  end loop;
end $$;
