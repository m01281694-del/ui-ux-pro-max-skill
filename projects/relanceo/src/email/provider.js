// Envoi d'e-mails. Aucun envoi réel tant qu'aucun prestataire n'est configuré.
//  - DisabledEmailProvider (défaut) : refuse tout envoi (les automatisations ne peuvent pas partir).
//  - ResendEmailProvider : API HTTP Resend (clé lue côté serveur uniquement). NON testé contre l'API réelle.
//  - MemoryEmailProvider : tests / démonstration locale, avec injection d'erreurs.
export class EmailNotConfiguredError extends Error {
  constructor() { super('email_provider_not_configured'); this.permanent = true; }
}

export class DisabledEmailProvider {
  name = 'disabled';
  configured = false;
  async send() { throw new EmailNotConfiguredError(); }
}

export class MemoryEmailProvider {
  name = 'memory';
  configured = true;
  constructor() { this.sent = []; this.failNext = 0; this.failPermanently = false; }
  async send(msg) {
    if (this.failPermanently) { const e = new Error('provider_rejected'); e.permanent = true; throw e; }
    if (this.failNext > 0) { this.failNext -= 1; throw new Error('provider_timeout'); }
    if (this.sent.some((m) => m.idempotencyKey === msg.idempotencyKey)) {
      return { id: this.sent.find((m) => m.idempotencyKey === msg.idempotencyKey).id, duplicate: true };
    }
    const id = `mem_${this.sent.length + 1}`;
    this.sent.push({ ...msg, id });
    return { id };
  }
}

export class ResendEmailProvider {
  name = 'resend';
  configured = true;
  constructor({ apiKey, from, fetchImpl = fetch }) {
    if (!apiKey || !from) throw new Error('RESEND_API_KEY et EMAIL_FROM requis');
    this.apiKey = apiKey; this.from = from; this.fetch = fetchImpl;
  }
  async send({ to, subject, text, replyTo, headers, idempotencyKey }) {
    const res = await this.fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ from: this.from, to: [to], subject, text, reply_to: replyTo, headers }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = new Error(`resend_${res.status}`);
      e.permanent = res.status >= 400 && res.status < 500 && res.status !== 429;
      throw e;
    }
    return { id: body.id };
  }
}

export function emailProviderFromEnv(env = process.env) {
  if (env.EMAIL_PROVIDER === 'resend') return new ResendEmailProvider({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM });
  return new DisabledEmailProvider();
}
