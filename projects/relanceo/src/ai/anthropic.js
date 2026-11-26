// Fournisseur IA Claude (SDK officiel @anthropic-ai/sdk). La clé ANTHROPIC_API_KEY reste côté serveur.
// État : implémenté mais NON testé contre l'API réelle dans ce dépôt (aucune clé fournie).
// Les tests automatisés utilisent FakeAiProvider.
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM = `Tu assistes une entreprise française qui traite des demandes de ses clients.
Tu ne t'adresses jamais directement au client et tu n'envoies rien : tu proposes, un humain décide.
Réponds en français. N'invente aucune information absente de la demande (prix, délais, engagements).`;

const SCHEMAS = {
  summary: {
    type: 'object', additionalProperties: false, required: ['summary'],
    properties: { summary: { type: 'string', description: 'Résumé factuel en 2 à 4 phrases' } },
  },
  classification: {
    type: 'object', additionalProperties: false, required: ['category', 'priority', 'rationale'],
    properties: {
      category: { type: 'string', enum: ['devis', 'commande', 'reclamation', 'information', 'rendez_vous', 'facturation', 'autre'] },
      priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
      rationale: { type: 'string' },
    },
  },
  suggestions: {
    type: 'object', additionalProperties: false, required: ['reply'],
    properties: { reply: { type: 'string', description: 'Brouillon de réponse, à relire par un humain' } },
  },
};

const INSTRUCTIONS = {
  summary: 'Résume la demande client ci-dessous.',
  classification: 'Propose une catégorie et une priorité pour la demande client ci-dessous, avec une justification courte.',
  suggestions: 'Rédige un brouillon de réponse courtois et prudent à la demande client ci-dessous. Signale entre crochets toute information que l\'entreprise doit compléter.',
};

export class AnthropicAiProvider {
  name = 'anthropic';
  configured = true;
  constructor({ model = 'claude-opus-5-5', client = new Anthropic() } = {}) {
    this.model = model;
    this.client = client;
  }

  async run(kind, { subject, body }) {
    const response = await this.client.beta.messages.create({
      model: this.model,
      max_tokens: 4096,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMAS[kind] } },
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: `${INSTRUCTIONS[kind]}\n\n<demande>\n<objet>${subject}</objet>\n<message>${body}</message>\n</demande>`,
      }],
    });
    if (response.stop_reason === 'refusal') throw new Error('ai_refusal');
    if (response.stop_reason === 'max_tokens') throw new Error('ai_truncated');
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    return {
      output: JSON.parse(text),
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
      model: response.model,
    };
  }
}

export async function aiProviderFromEnv(env = process.env) {
  const { DisabledAiProvider } = await import('./gateway.js');
  if (env.AI_PROVIDER === 'anthropic') return new AnthropicAiProvider({ model: env.AI_MODEL || 'claude-opus-5-5' });
  return new DisabledAiProvider();
}
