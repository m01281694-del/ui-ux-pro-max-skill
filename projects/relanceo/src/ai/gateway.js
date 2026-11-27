// Passerelle IA (Pro et Business). Rôle : ASSISTER l'utilisateur.
// Aucune fonction de ce module n'envoie de message : il renvoie un texte que l'utilisateur relit.
// Chaque appel : contrôle du droit -> consommation idempotente du quota -> appel fournisseur
// -> journal de coût. En cas d'échec du fournisseur, la consommation est remboursée.
import { AppError, quotaError, requirePermission } from '../entitlements.js';
import { aiCostEur, recordCost } from '../costs.js';

const KINDS = {
  summary: { permission: 'ai.summary', maxTokens: 1024 },
  classification: { permission: 'ai.classification', maxTokens: 512 },
  suggestions: { permission: 'ai.suggestions', maxTokens: 2048 },
};

export class DisabledAiProvider {
  name = 'disabled';
  configured = false;
  async run() {
    throw new AppError(503, 'ai_not_configured', "L'assistance IA n'est pas encore configurée sur cette instance (aucun fournisseur IA).");
  }
}

// Fournisseur de test : réponses déterministes, coût simulé.
export class FakeAiProvider {
  name = 'fake';
  configured = true;
  constructor() { this.calls = []; this.fail = false; }
  async run(kind, input) {
    this.calls.push({ kind, input });
    if (this.fail) throw new Error('provider_down');
    const out = {
      summary: { summary: `Résumé : ${input.subject}` },
      classification: { category: 'devis', priority: 'high', rationale: 'Mots-clés de demande de devis' },
      suggestions: { reply: `Bonjour, merci pour votre message concernant « ${input.subject} ».` },
    }[kind];
    return { output: out, usage: { inputTokens: 1800, outputTokens: 450 }, model: 'fake' };
  }
}

export async function runAi(ctx, { kind, requestId, idempotencyKey }) {
  const spec = KINDS[kind];
  if (!spec) throw new AppError(400, 'invalid_ai_kind', 'Type d\'opération IA inconnu.');
  requirePermission(ctx, spec.permission);
  if (!idempotencyKey) throw new AppError(400, 'idempotency_key_required', 'En-tête Idempotency-Key requis.');
  const provider = ctx.services.ai;
  if (!provider.configured) await provider.run();

  const { db, userId, tenantId } = ctx;
  const idem = `ai:${kind}:${requestId}:${idempotencyKey}`;
  const prepared = await db.asUser(userId, async (tx) => {
    const req = await tx.one('select id, subject, body, status, priority from requests where id = $1 and tenant_id = $2', [requestId, tenantId]);
    if (!req) throw new AppError(404, 'not_found', 'Demande introuvable.');
    const q = (await tx.one('select app.consume_ai($1, $2, $3) as r', [tenantId, kind, idem])).r;
    return { req, q };
  });
  if (!prepared.q.ok) throw quotaError(ctx, prepared.q);

  let result;
  try {
    result = await provider.run(kind, { subject: prepared.req.subject, body: prepared.req.body });
  } catch (err) {
    console.error(`[ai] ${kind} échec : ${err?.status ?? ''} ${err?.message ?? err}`);
    await db.asUser(userId, (tx) => tx.one('select app.refund_ai($1, $2) as r', [tenantId, idem]));
    if (err instanceof AppError) throw err;
    throw new AppError(502, 'ai_provider_error', "Le service d'IA n'a pas répondu. Aucune opération n'a été décomptée.");
  }

  const cost = aiCostEur(ctx.services.costs, { ...result.usage, model: result.model });
  await db.asService((tx) => recordCost(tx, {
    tenantId, category: 'ai', units: result.usage.inputTokens + result.usage.outputTokens, amountEur: cost,
    metadata: { kind, model: result.model, request_id: requestId, input_tokens: result.usage.inputTokens, output_tokens: result.usage.outputTokens },
  }), 'ai-gateway');

  // Résumé / classification : enregistrés comme PROPOSITION, jamais appliqués automatiquement à la priorité.
  if (kind === 'summary') {
    await db.asUser(userId, (tx) => tx.query('update requests set ai_summary = $1 where id = $2 and tenant_id = $3',
      [result.output.summary, requestId, tenantId]));
  }
  return { kind, output: result.output, quota: { used: prepared.q.used, limit: prepared.q.limit, alerts: prepared.q.alerts ?? [] }, auto_sent: false };
}
