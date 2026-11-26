-- RELANCEO — isolation multi-entreprises (Row Level Security) et privilèges.
-- Principe : "authenticated" ne voit que les lignes des entreprises dont il est membre actif,
-- et n'écrit que là où son rôle ET l'abonnement de l'entreprise l'autorisent.
-- Abonnements, compteurs, événements de facturation, coûts : lecture seule (ou aucun accès).

-- Postgres accorde EXECUTE à PUBLIC par défaut : on le retire partout dans le schéma app.
revoke all on all functions in schema app from public;
revoke all on all tables in schema public from public;
grant usage on schema app to authenticated, service_role;
grant usage on schema public to authenticated, service_role;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema app to service_role;

-- Fonctions appelables par un utilisateur connecté (toutes vérifient elles-mêmes les droits).
grant execute on function
  app.now(), app.current_user_id(), app.user_tenant_ids(), app.is_member(uuid), app.user_role(uuid),
  app.has_permission(uuid, text), app.tenant_has_entitlement(uuid, text), app.role_allows(text, text),
  app.tenant_access_mode(uuid), app.tenant_limit(uuid, text), app.current_period(uuid), app.gauge_usage(uuid, text),
  app.config(text), app.forbid(text),
  app.get_entitlements(uuid), app.create_request(uuid, uuid, text, text, text, text, timestamptz, text),
  app.consume_ai(uuid, text, text), app.refund_ai(uuid, text),
  app.invite_member(uuid, text, text, text), app.accept_invitation(text), app.reactivate_member(uuid, uuid)
to authenticated;
-- Jamais accordées à authenticated : app._consume, app._refund, app.enforce_plan_limits.

do $$ declare tbl text; begin
  foreach tbl in array array[
    'tenants', 'users', 'memberships', 'invitations', 'sessions', 'subscriptions', 'tenant_limit_overrides',
    'subscription_audit_log', 'plan_change_requests', 'billing_events', 'usage_counters', 'usage_events',
    'quota_alerts', 'notifications', 'customers', 'requests', 'request_events', 'reminders',
    'message_templates', 'automation_rules', 'automation_jobs', 'messages', 'tenant_settings',
    'cost_ledger', 'internal_alerts', 'plans', 'plan_permissions', 'plan_limits', 'role_permissions',
    'access_policy_permissions', 'app_config'] loop
    execute format('alter table %I enable row level security', tbl);
    execute format('alter table %I force row level security', tbl);
  end loop;
end $$;

-- Catalogue public en lecture.
grant select on plans, plan_permissions, plan_limits, role_permissions, access_policy_permissions to authenticated;
create policy catalog_read on plans for select to authenticated using (true);
create policy catalog_read on plan_permissions for select to authenticated using (true);
create policy catalog_read on plan_limits for select to authenticated using (true);
create policy catalog_read on role_permissions for select to authenticated using (true);
create policy catalog_read on access_policy_permissions for select to authenticated using (true);

-- Comptes
grant select on tenants, users, memberships, invitations to authenticated;
grant update (role, status) on memberships to authenticated;
grant update (status) on invitations to authenticated;
create policy tenant_read on tenants for select to authenticated using (id in (select app.user_tenant_ids()));
create policy users_read on users for select to authenticated using (
  id = app.current_user_id()
  or id in (select user_id from memberships where tenant_id in (select app.user_tenant_ids())));
create policy members_read on memberships for select to authenticated
  using (tenant_id in (select app.user_tenant_ids()));
create policy members_update on memberships for update to authenticated
  using (app.has_permission(tenant_id, 'team.manage'))
  with check (app.has_permission(tenant_id, 'team.manage') and status in ('removed', 'suspended_over_limit', 'active'));
create policy invitations_read on invitations for select to authenticated
  using (app.has_permission(tenant_id, 'team.view'));
create policy invitations_revoke on invitations for update to authenticated
  using (app.has_permission(tenant_id, 'team.manage')) with check (status = 'revoked');
-- sessions, billing_events, cost_ledger, internal_alerts, tenant_limit_overrides, app_config :
-- aucune politique pour authenticated => aucun accès.

-- Abonnement : lecture seule pour qui a billing.view. Aucune écriture possible côté utilisateur.
grant select on subscriptions, subscription_audit_log, plan_change_requests to authenticated;
create policy sub_read on subscriptions for select to authenticated using (app.has_permission(tenant_id, 'billing.view'));
create policy sub_audit_read on subscription_audit_log for select to authenticated
  using (app.has_permission(tenant_id, 'billing.view'));
create policy pcr_read on plan_change_requests for select to authenticated
  using (app.has_permission(tenant_id, 'billing.view'));

-- Quotas : lecture seule.
grant select on usage_counters, usage_events, quota_alerts to authenticated;
create policy usage_read on usage_counters for select to authenticated using (tenant_id in (select app.user_tenant_ids()));
create policy usage_ev_read on usage_events for select to authenticated using (app.has_permission(tenant_id, 'billing.view'));
create policy quota_alerts_read on quota_alerts for select to authenticated using (tenant_id in (select app.user_tenant_ids()));

grant select, update (read_at) on notifications to authenticated;
create policy notif_read on notifications for select to authenticated using (tenant_id in (select app.user_tenant_ids()));
create policy notif_mark on notifications for update to authenticated
  using (tenant_id in (select app.user_tenant_ids())) with check (tenant_id in (select app.user_tenant_ids()));

-- Clients
grant select, insert, update (name, email, phone, notes) on customers to authenticated;
create policy customers_read on customers for select to authenticated using (app.has_permission(tenant_id, 'customers.view'));
create policy customers_insert on customers for insert to authenticated with check (app.has_permission(tenant_id, 'customers.manage'));
create policy customers_update on customers for update to authenticated
  using (app.has_permission(tenant_id, 'customers.manage')) with check (app.has_permission(tenant_id, 'customers.manage'));

-- Demandes : création UNIQUEMENT via app.create_request (quota). Pas d'INSERT direct.
grant select, update (status, priority, due_at, category, ai_summary, customer_id, subject, body) on requests to authenticated;
create policy requests_read on requests for select to authenticated using (app.has_permission(tenant_id, 'requests.view'));
create policy requests_update on requests for update to authenticated
  using (app.has_permission(tenant_id, 'requests.manage'))
  with check (app.has_permission(tenant_id, 'requests.manage')
              and (priority in ('normal', 'high') or app.has_permission(tenant_id, 'priorities.advanced'))
              and (customer_id is null or exists (select 1 from customers c where c.id = customer_id and c.tenant_id = requests.tenant_id)));

grant select, insert on request_events to authenticated;
grant usage on sequence request_events_id_seq to authenticated;
create policy req_events_read on request_events for select to authenticated using (app.has_permission(tenant_id, 'requests.view'));
create policy req_events_insert on request_events for insert to authenticated
  with check (app.has_permission(tenant_id, 'requests.manage') and actor_user_id = app.current_user_id()
              and exists (select 1 from requests r where r.id = request_id and r.tenant_id = request_events.tenant_id));

grant select, insert, update (done_at, note, due_at) on reminders to authenticated;
create policy reminders_read on reminders for select to authenticated using (app.has_permission(tenant_id, 'requests.view'));
create policy reminders_insert on reminders for insert to authenticated
  with check (app.has_permission(tenant_id, 'reminders.manual')
              and exists (select 1 from requests r where r.id = request_id and r.tenant_id = reminders.tenant_id));
create policy reminders_update on reminders for update to authenticated
  using (app.has_permission(tenant_id, 'reminders.manual')) with check (app.has_permission(tenant_id, 'reminders.manual'));

-- Messages : un utilisateur ne peut que JOURNALISER un échange manuel (origin = 'manual').
grant select, insert on messages to authenticated;
create policy messages_read on messages for select to authenticated using (app.has_permission(tenant_id, 'requests.view'));
create policy messages_insert on messages for insert to authenticated
  with check (app.has_permission(tenant_id, 'requests.manage') and origin = 'manual' and status in ('logged', 'received')
              and automation_job_id is null
              and exists (select 1 from requests r where r.id = request_id and r.tenant_id = messages.tenant_id));

-- Modèles (Pro et Business)
grant select, insert, update (name, subject, body, status) on message_templates to authenticated;
create policy templates_read on message_templates for select to authenticated
  using (app.has_permission(tenant_id, 'templates.manage') or app.has_permission(tenant_id, 'automations.view'));
create policy templates_insert on message_templates for insert to authenticated
  with check (app.has_permission(tenant_id, 'templates.manage'));
create policy templates_update on message_templates for update to authenticated
  using (app.has_permission(tenant_id, 'templates.manage')) with check (app.has_permission(tenant_id, 'templates.manage'));

-- Automatisations (Business). La base refuse l'écriture si l'abonnement ne l'autorise pas.
grant select, insert, update (name, template_id, delay_hours, max_attempts, conditions, status, authorized_by, authorized_at)
  on automation_rules to authenticated;
create policy rules_read on automation_rules for select to authenticated using (app.has_permission(tenant_id, 'automations.view'));
create policy rules_insert on automation_rules for insert to authenticated
  with check (app.has_permission(tenant_id, 'automations.create') and status in ('draft', 'paused'));
create policy rules_update on automation_rules for update to authenticated
  using (app.has_permission(tenant_id, 'automations.create'))
  with check (app.has_permission(tenant_id, 'automations.create')
              and status in ('draft', 'active', 'paused')
              and (authorized_by is null or authorized_by = app.current_user_id()));

grant select on automation_jobs to authenticated;
create policy jobs_read on automation_jobs for select to authenticated using (app.has_permission(tenant_id, 'automations.view'));

grant select, insert, update (automations_paused, automation_hourly_cap, sender_name, updated_at) on tenant_settings to authenticated;
create policy settings_read on tenant_settings for select to authenticated using (tenant_id in (select app.user_tenant_ids()));
create policy settings_insert on tenant_settings for insert to authenticated
  with check (app.has_permission(tenant_id, 'automations.create'));
-- Mettre en pause est toujours possible pour un administrateur ; relancer exige automations.create.
create policy settings_update on tenant_settings for update to authenticated
  using (app.user_role(tenant_id) in ('owner', 'admin'))
  with check (app.user_role(tenant_id) in ('owner', 'admin')
              and (automations_paused or app.has_permission(tenant_id, 'automations.create')));
