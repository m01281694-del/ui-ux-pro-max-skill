// Subscription Entitlements System — point d'entrée serveur.
// Toutes les vérifications de droits du serveur passent par ce module ; il ne recalcule rien :
// il lit le verdict de la base (app.get_entitlements), qui applique les mêmes règles que les
// politiques RLS. Deux barrières indépendantes : ce contrôle applicatif, puis la base elle-même.
import { upsellFor } from './plans.js';

export class AppError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function loadEntitlements(tx, tenantId) {
  const row = await tx.one('select app.get_entitlements($1) as e', [tenantId]);
  if (!row?.e) throw new AppError(403, 'not_a_member', "Vous n'avez pas accès à cette entreprise.");
  return row.e;
}

export function can(ent, permission) {
  return ent.permissions.includes(permission);
}

// Lève une erreur explicite selon la cause : offre insuffisante, abonnement inactif, ou rôle.
export function requirePermission(ctx, permission) {
  const ent = ctx.ent;
  if (ent.permissions.includes(permission)) return;
  if (!ent.plan_permissions.includes(permission)) {
    throw new AppError(403, 'plan_required', 'Cette fonctionnalité n\'est pas incluse dans votre offre.', {
      permission,
      upgrade: upsellFor(ctx.catalog, permission, ent.plan_id),
    });
  }
  if (!ent.tenant_permissions.includes(permission)) {
    throw new AppError(403, 'subscription_inactive',
      'Votre abonnement n\'est pas actif : l\'accès est limité à la consultation et à l\'export de vos données.',
      { permission, status: ent.status });
  }
  throw new AppError(403, 'forbidden_role', 'Votre rôle ne permet pas cette action. Contactez un administrateur.', { permission, role: ent.role });
}

// Traduit un refus de quota renvoyé par la base en réponse claire avec proposition de montée en gamme.
export function quotaError(ctx, res) {
  const nextPlan = ctx.catalog.plans
    .filter((p) => p.limits[res.metric] > (res.limit ?? 0))
    .sort((a, b) => a.price_cents - b.price_cents)[0];
  const msg = res.reason === 'not_included'
    ? 'Cette ressource n\'est pas incluse dans votre offre.'
    : `Quota atteint pour cette période (${res.used ?? 0} / ${res.limit}).`;
  return new AppError(res.reason === 'not_included' ? 403 : 429, res.reason, msg, {
    metric: res.metric,
    used: res.used,
    limit: res.limit,
    period_end: res.period_end ?? null,
    upgrade: nextPlan ? {
      required_plan: nextPlan.id,
      required_plan_name: nextPlan.name,
      price_cents: nextPlan.price_cents,
      new_limit: nextPlan.limits[res.metric],
    } : { custom_offer: true, message: 'Contactez-nous pour étudier une offre personnalisée.' },
  });
}

// Erreurs Postgres -> erreurs applicatives (la base a refusé : défense en profondeur).
export function mapDbError(err) {
  const msg = String(err?.message ?? '');
  if (err?.code === '42501' || /permission denied|row-level security|forbidden:/.test(msg)) {
    return new AppError(403, 'forbidden', 'Action refusée.', { db: msg.replace(/^.*forbidden:/, 'forbidden:') });
  }
  if (/quota_exceeded:/.test(msg)) return new AppError(429, 'quota_exceeded', 'Limite atteinte.', { db: msg });
  if (/automation_template_not_approved/.test(msg)) {
    return new AppError(422, 'template_not_approved', 'Le modèle de message doit être validé par un administrateur avant activation.');
  }
  if (/automation_not_authorized/.test(msg)) {
    return new AppError(422, 'authorization_required', "L'autorisation explicite d'envoi doit être donnée avant activation.");
  }
  if (err?.code === '23514' || err?.code === '22P02' || err?.code === '23502') return new AppError(400, 'invalid_input', 'Données invalides.', { db: msg });
  if (err?.code === '23503' || /not_found/.test(msg)) return new AppError(404, 'not_found', 'Ressource introuvable.');
  return null;
}
