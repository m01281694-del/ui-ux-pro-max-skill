// Estimation des coûts et marges par abonnement, à partir de config/plans.json et config/costs.json.
// Usage : npm run economics            (tableau)
//         node scripts/economics.mjs --json
// Toutes les valeurs de costs.json sont des HYPOTHÈSES à remplacer par les tarifs réels.
import { loadCatalog } from '../src/plans.js';
import { loadCosts } from '../src/costs.js';
import { pathToFileURL } from 'node:url';

export function aiCostPerOp(costs, model = costs.ai) {
  const usd = (costs.ai.avg_input_tokens_per_op / 1e6) * model.input_usd_per_mtok
    + (costs.ai.avg_output_tokens_per_op / 1e6) * model.output_usd_per_mtok;
  return usd * costs.usd_to_eur;
}

export function computeEconomics(catalog = loadCatalog(), costs = loadCosts(), { vatIncluded = false } = {}) {
  const customers = Object.values(costs.scenario.customers).reduce((a, b) => a + b, 0);
  const infra = costs.infrastructure;
  const fixedTotal = infra.hosting_monthly_eur + infra.database_monthly_eur + infra.storage_monthly_eur
    + infra.monitoring_monthly_eur + costs.email.monthly_fixed_eur;
  const fixedShare = fixedTotal / customers;
  const perOp = aiCostPerOp(costs);
  const perOpAlt = costs.ai.alternative_model_for_review ? aiCostPerOp(costs, costs.ai.alternative_model_for_review) : null;

  const plans = catalog.plans.map((p) => {
    const gross = p.price_cents / 100;
    const revenue = vatIncluded ? gross / 1.2 : gross;
    const payment = gross * (costs.payments.percent + costs.payments.billing_percent) / 100 + costs.payments.fixed_eur;
    const support = (costs.support.minutes_per_customer_month[p.id] / 60) * costs.support.hourly_cost_eur;
    const scenario = (ratio) => {
      const ai = p.limits.ai_operations_monthly * ratio * perOp;
      const email = p.limits.automation_sends_monthly * ratio * costs.email.eur_per_email;
      const total = ai + email + payment + support + fixedShare;
      return {
        ai: round(ai), email: round(email), payment: round(payment), support: round(support), fixed_share: round(fixedShare),
        total: round(total), margin: round(revenue - total), margin_pct: round(100 * (revenue - total) / revenue, 1),
        variable_usage_ratio_of_price: round((ai + email) / gross, 3),
      };
    };
    const typical = scenario(costs.scenario.usage_ratio_typical);
    const worst = scenario(costs.scenario.usage_ratio_worst);
    const flags = [];
    if (worst.margin <= 0) flags.push('NON RENTABLE au plafond d\'usage : ajuster prix ou quotas avant commercialisation');
    if (worst.variable_usage_ratio_of_price > costs.alerts.max_variable_cost_ratio_of_plan_price) {
      flags.push(`Coûts variables au plafond > ${costs.alerts.max_variable_cost_ratio_of_plan_price * 100} % du prix`);
    }
    if (worst.margin_pct < 50) flags.push('Marge < 50 % au plafond d\'usage');
    return { id: p.id, name: p.name, price: gross, revenue_net: round(revenue), typical, worst, flags };
  });
  return {
    assumptions: {
      as_of: costs.as_of, customers_in_scenario: customers, fixed_monthly_total_eur: round(fixedTotal),
      ai_model: costs.ai.model, ai_cost_per_operation_eur: round(perOp, 4),
      ai_cost_per_operation_alternative_eur: perOpAlt == null ? null : round(perOpAlt, 5),
      usage_ratio_typical: costs.scenario.usage_ratio_typical, usage_ratio_worst: costs.scenario.usage_ratio_worst,
      prices_treated_as: vatIncluded ? 'TTC (TVA 20 % déduite)' : 'HT',
    },
    plans,
  };
}

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const json = process.argv.includes('--json');
  const ht = computeEconomics();
  const ttc = computeEconomics(undefined, undefined, { vatIncluded: true });
  if (json) {
    console.log(JSON.stringify({ ht, ttc }, null, 2));
  } else {
    console.log('Hypothèses :', ht.assumptions);
    for (const [label, data] of [['Prix HT', ht], ['Si les prix affichés sont TTC', ttc]]) {
      console.log(`\n=== ${label} ===`);
      console.table(data.plans.map((p) => ({
        offre: p.name, prix: p.price, 'revenu net': p.revenue_net,
        'coût typique': p.typical.total, 'marge typique %': p.typical.margin_pct,
        'coût plafond': p.worst.total, 'marge plafond %': p.worst.margin_pct, alertes: p.flags.join(' | ') || '—',
      })));
    }
  }
}
