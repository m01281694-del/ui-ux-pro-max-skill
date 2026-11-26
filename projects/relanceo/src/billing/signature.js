// Vérification des signatures de webhooks (schéma Stripe : en-tête "t=<ts>,v1=<hmac>",
// HMAC-SHA256 de "<ts>.<corps brut>" avec le secret de l'endpoint, tolérance d'horodatage).
import { createHmac, timingSafeEqual } from 'node:crypto';

export function signPayload(secret, payload, timestamp = Math.floor(Date.now() / 1000)) {
  const sig = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

export function verifySignature({ secret, payload, header, toleranceSec = 300, nowSec = Math.floor(Date.now() / 1000) }) {
  if (!secret) return { ok: false, reason: 'no_secret_configured' };
  if (typeof header !== 'string' || !header) return { ok: false, reason: 'missing_signature' };
  const parts = Object.create(null);
  const v1 = [];
  for (const item of header.split(',')) {
    const [k, v] = item.split('=');
    if (k === 'v1') v1.push(v); else if (k) parts[k] = v;
  }
  const t = Number(parts.t);
  if (!Number.isInteger(t) || v1.length === 0) return { ok: false, reason: 'malformed_signature' };
  if (Math.abs(nowSec - t) > toleranceSec) return { ok: false, reason: 'timestamp_out_of_tolerance' };
  const expected = Buffer.from(createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex'), 'hex');
  const match = v1.some((s) => {
    const got = Buffer.from(String(s), 'hex');
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
  return match ? { ok: true, timestamp: t } : { ok: false, reason: 'signature_mismatch' };
}
