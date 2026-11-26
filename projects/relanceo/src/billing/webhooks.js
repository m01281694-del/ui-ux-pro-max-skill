// Traitement des webhooks de facturation (format Stripe).
// Garanties :
//  - signature vérifiée AVANT toute lecture du contenu (src/http/server.js) ;
//  - idempotence : un même événement (id) n'est appliqué qu'une fois ;
//  - ordre : un événement plus ancien que le dernier appliqué est ignoré (ignored_stale) ;
//  - l'offre est déduite du PRIX facturé (table de correspondance serveur), jamais d'une métadonnée ;
//  - une redirection « paiement réussi » ou checkout.session.completed n'active rien.
const STATUS_MAP = {
  active: 'active', trialing: 'active', past_due: 'past_due', unpaid: 'past_due',
  canceled: 'canceled', incomplete: 'incomplete', incomplete_expired: 'canceled', paused: 'suspended',
};

const ts = (sec) => (sec ? new Date(sec * 1000).toISOString() : null);

export async function handleBillingEvent(db, event, { priceToPlan, catalog }) {
  if (!event?.id || !event?.type || !event?.data?.object) return { status: 400, body: { error: 'invalid_event' } };
  const existing = await db.asService(async (tx) => {
    const inserted = await tx.one(
      `insert into billing_events (id, provider, type, event_created_at, payload) values ($1, 'stripe', $2, $3, $4)
       on conflict (id) do nothing returning id`,
      [event.id, event.type, ts(event.created), JSON.stringify(event)]);
    if (inserted) return null;
    return tx.one('select status from billing_events where id = $1', [event.id]);
  }, 'billing-webhook');
  if (existing && ['processed', 'ignored', 'ignored_stale'].includes(existing.status)) {
    return { status: 200, body: { received: true, duplicate: true } };
  }

  try {
    const outcome = await db.asService((tx) => apply(tx, event, { priceToPlan, catalog }), `stripe:${event.id}`);
    await db.asService((tx) => tx.query(
      `update billing_events set status = $2, tenant_id = $3, processed_at = now(), error = null where id = $1`,
      [event.id, outcome.status, outcome.tenantId ?? null]), 'billing-webhook');
    return { status: 200, body: { received: true, result: outcome.status } };
  } catch (err) {
    await db.asService(async (tx) => {
      await tx.query(`update billing_events set status = 'failed', error = $2 where id = $1`, [event.id, String(err.message)]);
      await tx.query(
        `insert into internal_alerts (kind, dedupe_key, message, data) values ('billing_webhook_failed', $1, $2, $3)
         on conflict (dedupe_key) do nothing`,
        [`billing:${event.id}`, `Webhook ${event.type} en échec : ${err.message}`, JSON.stringify({ event_id: event.id })]);
    }, 'billing-webhook');
    // 500 => le prestataire renverra l'événement (une fois la cause corrigée, il sera rejoué).
    return { status: 500, body: { received: true, error: 'processing_failed' } };
  }
}

async function findSubscription(tx, { subscriptionId, customerId }) {
  if (subscriptionId) {
    const s = await tx.one('select * from subscriptions where provider_subscription_id = $1', [subscriptionId]);
    if (s) return s;
  }
  if (customerId) return tx.one('select * from subscriptions where provider_customer_id = $1', [customerId]);
  return null;
}

function price(catalog, planId) {
  return catalog.plans.find((p) => p.id === planId)?.price_cents ?? 0;
}

async function apply(tx, event, { priceToPlan, catalog }) {
  const obj = event.data.object;
  const created = ts(event.created);

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const item = obj.items?.data?.[0];
      const planId = priceToPlan[item?.price?.id];
      if (!planId) throw new Error(`unknown_price:${item?.price?.id}`);
      const status = event.type === 'customer.subscription.deleted' ? 'canceled' : STATUS_MAP[obj.status];
      if (!status) throw new Error(`unknown_status:${obj.status}`);
      const ps = ts(obj.current_period_start ?? item.current_period_start);
      const pe = ts(obj.current_period_end ?? item.current_period_end);

      let sub = await findSubscription(tx, { subscriptionId: obj.id, customerId: obj.customer });
      let tenantId = sub?.tenant_id;
      if (!tenantId) {
        tenantId = obj.metadata?.tenant_id;
        const t = tenantId && await tx.one('select id from tenants where id = $1', [tenantId]);
        if (!t) throw new Error('tenant_not_resolved');
        sub = await tx.one('select * from subscriptions where tenant_id = $1', [tenantId]);
        if (sub?.provider_customer_id && sub.provider_customer_id !== obj.customer) throw new Error('customer_mismatch');
      }
      if (sub?.provider_updated_at && created && new Date(created) < new Date(sub.provider_updated_at)) {
        return { status: 'ignored_stale', tenantId };
      }

      // Rétrogradation : appliquée au renouvellement, pas au milieu d'une période payée.
      let effectivePlan = planId;
      let scheduled = null;
      const sameCycle = sub?.current_period_start && ps && new Date(ps).getTime() === new Date(sub.current_period_start).getTime();
      if (sub && status === 'active' && sameCycle && price(catalog, planId) < price(catalog, sub.plan_id)) {
        effectivePlan = sub.plan_id;
        scheduled = planId;
      } else if (sub?.scheduled_plan_id && !sameCycle) {
        effectivePlan = planId;
      }

      if (sub) {
        await tx.query(
          `update subscriptions set plan_id = $2, status = $3, current_period_start = $4, current_period_end = $5,
              cancel_at_period_end = $6, scheduled_plan_id = $7, provider = 'stripe', provider_customer_id = $8,
              provider_subscription_id = $9, provider_updated_at = $10, updated_at = now(),
              past_due_since = case when $3 = 'past_due' then coalesce(past_due_since, app.now()) else null end
            where tenant_id = $1`,
          [tenantId, effectivePlan, status, ps, pe, Boolean(obj.cancel_at_period_end) && status !== 'canceled',
           scheduled, obj.customer, obj.id, created]);
      } else {
        await tx.query(
          `insert into subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end, cancel_at_period_end,
              provider, provider_customer_id, provider_subscription_id, provider_updated_at, past_due_since)
           values ($1,$2,$3,$4,$5,$6,'stripe',$7,$8,$9, case when $3 = 'past_due' then app.now() end)`,
          [tenantId, planId, status, ps, pe, Boolean(obj.cancel_at_period_end), obj.customer, obj.id, created]);
      }
      await tx.query(
        `update plan_change_requests set status = 'confirmed' where tenant_id = $1 and status = 'pending' and to_plan = $2`,
        [tenantId, planId]);
      return { status: 'processed', tenantId };
    }

    case 'invoice.paid':
    case 'invoice.payment_succeeded':
    case 'invoice.payment_failed': {
      const subscriptionId = obj.subscription ?? obj.parent?.subscription_details?.subscription;
      const sub = await findSubscription(tx, { subscriptionId, customerId: obj.customer });
      if (!sub) throw new Error('subscription_not_found');
      if (sub.provider_updated_at && created && new Date(created) < new Date(sub.provider_updated_at)) {
        return { status: 'ignored_stale', tenantId: sub.tenant_id };
      }
      if (event.type === 'invoice.payment_failed') {
        await tx.query(
          `update subscriptions set status = 'past_due', past_due_since = coalesce(past_due_since, app.now()),
              provider_updated_at = $2, updated_at = now() where tenant_id = $1 and status in ('active', 'past_due')`,
          [sub.tenant_id, created]);
        await tx.query(`insert into notifications (tenant_id, kind, message) values ($1, 'payment_failed', $2)`,
          [sub.tenant_id, 'Le dernier paiement a échoué. Mettez à jour votre moyen de paiement pour conserver l\'accès complet.']);
      } else {
        const line = obj.lines?.data?.[0]?.period;
        await tx.query(
          `update subscriptions set status = case when status in ('past_due', 'incomplete', 'suspended') then 'active' else status end,
              past_due_since = null,
              current_period_start = coalesce($3, current_period_start), current_period_end = coalesce($4, current_period_end),
              plan_id = case when $5 and scheduled_plan_id is not null then scheduled_plan_id else plan_id end,
              scheduled_plan_id = case when $5 then null else scheduled_plan_id end,
              provider_updated_at = $2, updated_at = now()
            where tenant_id = $1 and status <> 'canceled'`,
          [sub.tenant_id, created, ts(line?.start), ts(line?.end), obj.billing_reason === 'subscription_cycle']);
      }
      return { status: 'processed', tenantId: sub.tenant_id };
    }

    case 'charge.refunded': {
      const sub = await findSubscription(tx, { customerId: obj.customer });
      await tx.query(
        `insert into internal_alerts (tenant_id, kind, dedupe_key, message, data) values ($1, 'refund', $2, $3, $4)
         on conflict (dedupe_key) do nothing`,
        [sub?.tenant_id ?? null, `refund:${event.id}`,
         `Remboursement de ${(obj.amount_refunded ?? 0) / 100} € : à traiter manuellement (aucun changement d'accès automatique).`,
         JSON.stringify({ charge: obj.id })]);
      return { status: 'processed', tenantId: sub?.tenant_id };
    }

    case 'checkout.session.completed':
      // N'active rien : l'activation n'a lieu qu'à réception de customer.subscription.* / invoice.paid.
      return { status: 'ignored' };

    default:
      return { status: 'ignored' };
  }
}
