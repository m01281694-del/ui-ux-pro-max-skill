// Suivi des coûts variables (FinOps) et alertes internes de dépenses anormales.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
export function loadCosts(file = path.join(here, '..', 'config', 'costs.json')) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function aiCostEur(costs, { inputTokens, outputTokens, model }) {
  const m = model && costs.ai.alternative_model_for_review?.model === model ? costs.ai.alternative_model_for_review : costs.ai;
  const usd = (inputTokens / 1e6) * m.input_usd_per_mtok + (outputTokens / 1e6) * m.output_usd_per_mtok;
  return usd * costs.usd_to_eur;
}

export async function recordCost(tx, { tenantId, category, units, amountEur, metadata = {} }) {
  await tx.query(
    'insert into cost_ledger (tenant_id, category, units, amount_eur, metadata, created_at) values ($1,$2,$3,$4,$5, app.now())',
    [tenantId, category, units, amountEur.toFixed(6), JSON.stringify(metadata)]);
}

// À exécuter périodiquement (service). Une alerte par entreprise et par mois au plus.
export async function checkCostAnomalies(db, costs, catalog) {
  return db.asService(async (tx) => {
    const now = db.now();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const rows = await tx.query(
      `select c.tenant_id, s.plan_id, sum(c.amount_eur)::float as spent
         from cost_ledger c join subscriptions s on s.tenant_id = c.tenant_id
        where c.created_at >= $1 group by c.tenant_id, s.plan_id`, [monthStart]);
    const alerts = [];
    for (const r of rows) {
      const plan = catalog.plans.find((p) => p.id === r.plan_id);
      const ceiling = (plan.price_cents / 100) * costs.alerts.max_variable_cost_ratio_of_plan_price;
      if (r.spent > ceiling) {
        const inserted = await tx.one(
          `insert into internal_alerts (tenant_id, kind, dedupe_key, message, data) values ($1, 'cost_ratio', $2, $3, $4)
           on conflict (dedupe_key) do nothing returning id`,
          [r.tenant_id, `cost_ratio:${r.tenant_id}:${month}`,
           `Coûts variables ${r.spent.toFixed(2)} € > ${ceiling.toFixed(2)} € (plafond ${costs.alerts.max_variable_cost_ratio_of_plan_price * 100} % du prix ${plan.name}).`,
           JSON.stringify({ spent: r.spent, ceiling, plan: plan.id })]);
        if (inserted) alerts.push({ tenant_id: r.tenant_id, spent: r.spent, ceiling });
      }
    }
    const day = now.toISOString().slice(0, 10);
    const daily = await tx.one(`select coalesce(sum(amount_eur), 0)::float as spent from cost_ledger where created_at >= $1::date`, [day]);
    if (daily.spent > costs.alerts.platform_daily_spend_alert_eur) {
      const inserted = await tx.one(
        `insert into internal_alerts (kind, dedupe_key, message, data) values ('platform_daily_spend', $1, $2, $3)
         on conflict (dedupe_key) do nothing returning id`,
        [`daily:${day}`, `Dépenses plateforme du jour : ${daily.spent.toFixed(2)} €`, JSON.stringify(daily)]);
      if (inserted) alerts.push({ platform: true, spent: daily.spent });
    }
    return alerts;
  }, 'cost-monitor');
}
