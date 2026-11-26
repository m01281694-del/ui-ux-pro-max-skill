// Chargement et validation du catalogue d'offres (config/plans.json).
// Ce module ne prend AUCUNE décision d'accès : il décrit les offres (affichage, upsell, prévisualisation).
// Les décisions d'accès sont prises par la base (app.get_entitlements / app.has_permission).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
export const CATALOG_PATH = path.join(here, '..', 'config', 'plans.json');

export function loadCatalog(file = CATALOG_PATH) {
  const catalog = JSON.parse(readFileSync(file, 'utf8'));
  validateCatalog(catalog);
  return Object.freeze(catalog);
}

export function validateCatalog(c) {
  const errors = [];
  const perms = new Set(Object.keys(c.permissions ?? {}));
  const metrics = new Set(Object.keys(c.metrics ?? {}));
  if (!Array.isArray(c.plans) || c.plans.length === 0) errors.push('plans manquants');
  const ids = new Set();
  for (const p of c.plans ?? []) {
    if (ids.has(p.id)) errors.push(`plan en double: ${p.id}`);
    ids.add(p.id);
    if (!Number.isInteger(p.price_cents) || p.price_cents < 0) errors.push(`${p.id}: prix invalide`);
    for (const perm of p.permissions) if (!perms.has(perm)) errors.push(`${p.id}: permission inconnue ${perm}`);
    for (const m of metrics) {
      if (!Number.isInteger(p.limits?.[m]) || p.limits[m] < 0) errors.push(`${p.id}: limite manquante ou invalide pour ${m}`);
    }
    for (const m of Object.keys(p.limits ?? {})) if (!metrics.has(m)) errors.push(`${p.id}: métrique inconnue ${m}`);
    for (const ro of c.access_policy.readonly_permissions) {
      if (['billing.manage', 'billing.view', 'data.export'].includes(ro) && !p.permissions.includes(ro)) {
        errors.push(`${p.id}: ${ro} doit être inclus (accès à la facturation et export toujours possibles)`);
      }
    }
  }
  for (const [role, list] of Object.entries(c.roles ?? {})) {
    for (const perm of list) if (perm !== '*' && !perms.has(perm)) errors.push(`rôle ${role}: permission inconnue ${perm}`);
  }
  for (const f of c.features ?? []) {
    for (const perm of f.permissions) if (!perms.has(perm)) errors.push(`fonctionnalité « ${f.label} »: permission inconnue ${perm}`);
  }
  for (const [key, u] of Object.entries(c.upsell ?? {})) {
    if (!ids.has(u.required_plan)) errors.push(`upsell ${key}: offre inconnue ${u.required_plan}`);
    for (const perm of u.permissions) {
      const plan = c.plans.find((p) => p.id === u.required_plan);
      if (plan && !plan.permissions.includes(perm)) errors.push(`upsell ${key}: ${u.required_plan} n'inclut pas ${perm}`);
    }
  }
  // Règles commerciales impératives du cahier des charges.
  for (const id of ['starter', 'pro']) {
    const p = c.plans.find((x) => x.id === id);
    if (!p) continue;
    for (const perm of ['automations.create', 'automations.execute']) {
      if (p.permissions.includes(perm)) errors.push(`${id} ne doit jamais inclure ${perm}`);
    }
    if (p.limits.automation_sends_monthly !== 0) errors.push(`${id}: aucun envoi automatique autorisé`);
  }
  if (errors.length) throw new Error(`Catalogue d'offres invalide:\n- ${errors.join('\n- ')}`);
}

export function planById(catalog, id) {
  return catalog.plans.find((p) => p.id === id) ?? null;
}

// Offre la moins chère qui inclut une permission.
export function lowestPlanWith(catalog, permission) {
  return [...catalog.plans].sort((a, b) => a.price_cents - b.price_cents).find((p) => p.permissions.includes(permission)) ?? null;
}

export function formatPrice(catalog, cents) {
  const euros = cents / 100;
  return `${Number.isInteger(euros) ? euros : euros.toFixed(2).replace('.', ',')} €`;
}

// Message de montée en gamme : clair, non trompeur, avec offre requise et prix.
export function upsellFor(catalog, permission, currentPlanId) {
  const entry = Object.entries(catalog.upsell).find(([, u]) => u.permissions.includes(permission));
  const required = entry ? planById(catalog, entry[1].required_plan) : lowestPlanWith(catalog, permission);
  if (!required) return null;
  const u = entry?.[1];
  const override = u?.by_plan?.[currentPlanId] ?? {};
  return {
    permission,
    feature: entry?.[0] ?? permission,
    required_plan: required.id,
    required_plan_name: required.name,
    price_cents: required.price_cents,
    price_label: `${formatPrice(catalog, required.price_cents)} / mois`,
    title: override.title ?? u?.title ?? `Disponible avec ${required.name}`,
    body: override.body ?? u?.body ?? catalog.permissions[permission],
    benefits: u?.benefits ?? [],
    current_plan: currentPlanId,
  };
}

// Vue publique (page tarifs) — strictement dérivée du catalogue.
export function publicCatalog(catalog) {
  return {
    catalog_version: catalog.catalog_version,
    currency: catalog.currency,
    commercial: catalog.commercial,
    metrics: catalog.metrics,
    plans: catalog.plans.map((p) => ({
      id: p.id, name: p.name, price_cents: p.price_cents, price_label: formatPrice(catalog, p.price_cents),
      interval: p.interval, tagline: p.tagline, audience: p.audience, highlight: p.highlight,
      custom_offer_note: p.custom_offer_note ?? null, limits: p.limits, permissions: p.permissions,
    })),
    features: catalog.features,
    upsell: catalog.upsell,
  };
}

// Comparaison de deux offres : ce qui est gagné / perdu (prévisualisation d'un changement).
export function diffPlans(catalog, fromId, toId) {
  const from = planById(catalog, fromId);
  const to = planById(catalog, toId);
  if (!from || !to) throw new Error('unknown_plan');
  const lost = from.permissions.filter((p) => !to.permissions.includes(p));
  const gained = to.permissions.filter((p) => !from.permissions.includes(p));
  const limits = Object.keys(catalog.metrics).map((m) => ({ metric: m, label: catalog.metrics[m].label, from: from.limits[m], to: to.limits[m] }));
  const kind = to.price_cents > from.price_cents ? 'upgrade' : to.price_cents < from.price_cents ? 'downgrade' : 'same';
  return {
    kind,
    from: from.id,
    to: to.id,
    lost_permissions: lost.map((p) => ({ permission: p, label: catalog.permissions[p] })),
    gained_permissions: gained.map((p) => ({ permission: p, label: catalog.permissions[p] })),
    limits,
  };
}
