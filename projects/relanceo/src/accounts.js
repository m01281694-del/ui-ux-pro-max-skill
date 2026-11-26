// Création d'entreprise / utilisateur (opérations serveur). L'abonnement initial est créé par
// l'opérateur ou par les webhooks du prestataire — jamais par une saisie de l'utilisateur.
export async function createTenantWithOwner(db, { tenantName, email, displayName }) {
  return db.asService(async (tx) => {
    const user = (await tx.one('select id from users where email = $1', [email.toLowerCase()]))
      ?? (await tx.one('insert into users (email, display_name) values ($1, $2) returning id', [email.toLowerCase(), displayName ?? null]));
    const tenant = await tx.one('insert into tenants (name) values ($1) returning id', [tenantName]);
    await tx.query(`insert into memberships (tenant_id, user_id, role) values ($1, $2, 'owner')`, [tenant.id, user.id]);
    await tx.query('insert into tenant_settings (tenant_id) values ($1)', [tenant.id]);
    return { tenantId: tenant.id, userId: user.id };
  }, 'signup');
}

export async function createUser(db, email, displayName = null) {
  return db.asService(async (tx) => (await tx.one(
    'insert into users (email, display_name) values ($1, $2) returning id', [email.toLowerCase(), displayName])).id, 'signup');
}

// Attribution manuelle par un opérateur (paiement désactivé, offre personnalisée, geste commercial).
// Journalisée automatiquement (trigger subscriptions_audit) avec l'acteur fourni.
export async function operatorSetSubscription(db, tenantId, { planId, status = 'active', periodStart, periodEnd, actor }) {
  if (!actor) throw new Error('actor requis pour la traçabilité');
  return db.asService(async (tx) => {
    const ps = periodStart ?? new Date(db.now()).toISOString();
    const pe = periodEnd ?? new Date(new Date(ps).getTime() + 30 * 86400000).toISOString();
    await tx.query(
      `insert into subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end, provider, past_due_since)
       values ($1, $2, $3, $4, $5, 'manual', case when $3 = 'past_due' then app.now() end)
       on conflict (tenant_id) do update set plan_id = excluded.plan_id, status = excluded.status,
         current_period_start = excluded.current_period_start, current_period_end = excluded.current_period_end,
         past_due_since = case when excluded.status = 'past_due' then coalesce(subscriptions.past_due_since, app.now()) else null end,
         scheduled_plan_id = null, updated_at = now()`,
      [tenantId, planId, status, ps, pe]);
  }, `operator:${actor}`);
}
