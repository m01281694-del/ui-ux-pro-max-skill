// Serveur HTTP RELANCEO (Node, sans framework).
// Chaîne de contrôle de chaque requête API authentifiée :
//   1. authentification (jeton de session, côté serveur) ;
//   2. résolution de l'entreprise : uniquement parmi les adhésions ACTIVES de l'utilisateur ;
//   3. droits : app.get_entitlements (base) -> requirePermission (refus explicite + upsell) ;
//   4. exécution sous le rôle "authenticated" : la base revérifie tout (RLS, triggers, fonctions).
// Les champs envoyés par le client (plan, statut d'abonnement, tenant_id, quotas…) ne sont jamais lus
// pour décider d'un droit.
import http from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { runAutomationTick } from '../automations/engine.js';
import { checkCostAnomalies } from '../costs.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppError, loadEntitlements, mapDbError, requirePermission } from '../entitlements.js';
import { verifySignature } from '../billing/signature.js';
import { handleBillingEvent } from '../billing/webhooks.js';
import { buildRoutes } from './routes.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(here, '..', '..', 'public');
const MAX_BODY = 100 * 1024;
export const SESSION_COOKIE = 'relanceo_session';
const SESSION_DAYS = 7;

export function parseCookies(header) {
  const out = {};
  for (const part of String(header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function sessionCookie(token, appUrl) {
  const secure = String(appUrl ?? '').startsWith('https://') ? '; Secure' : '';
  return token
    ? `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`
    : `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export const hashToken = (t) => createHash('sha256').update(String(t)).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');

export async function createSession(db, userId, ttlHours = 24 * 7) {
  const token = newToken();
  await db.asService((tx) => tx.query(
    `insert into sessions (token_hash, user_id, expires_at) values ($1, $2, app.now() + make_interval(hours => $3))`,
    [hashToken(token), userId, ttlHours]), 'auth');
  return token;
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
  'Cache-Control': 'no-store',
};

function send(res, status, body, headers = {}) {
  const isString = typeof body === 'string';
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': isString ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8',
    ...headers,
  });
  res.end(isString ? body : JSON.stringify(body));
}

async function readBody(req, max = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > max) { tooLarge = true; chunks.length = 0; return; } // on vide le flux sans le stocker
      chunks.push(c);
    });
    req.on('end', () => (tooLarge
      ? reject(new AppError(413, 'payload_too_large', 'Requête trop volumineuse.'))
      : resolve(Buffer.concat(chunks).toString('utf8'))));
    req.on('error', reject);
  });
}

function compile(pattern) {
  const keys = [];
  const re = new RegExp(`^${pattern.replace(/:([a-zA-Z_]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })}$`);
  return (p) => {
    const m = re.exec(p);
    if (!m) return null;
    return Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createApp({ db, catalog, services, env = process.env }) {
  const routes = buildRoutes().map((r) => ({ ...r, match: compile(r.path) }));
  const rate = new Map();

  function rateLimited(key, limit = 300) {
    const minute = Math.floor(Date.now() / 60000);
    const k = `${key}:${minute}`;
    const n = (rate.get(k) ?? 0) + 1;
    rate.set(k, n);
    if (rate.size > 10000) for (const old of rate.keys()) if (!old.endsWith(`:${minute}`)) rate.delete(old);
    return n > limit;
  }

  // Session : en-tête Authorization (API) ou cookie HttpOnly (navigateur).
  function sessionToken(req) {
    const m = /^Bearer\s+(.+)$/.exec(req.headers.authorization ?? '');
    if (m) return { token: m[1], via: 'bearer' };
    const c = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    return c ? { token: c, via: 'cookie' } : null;
  }

  async function authenticate(req) {
    const s = sessionToken(req);
    if (!s) throw new AppError(401, 'unauthenticated', 'Authentification requise.');
    const row = await db.asService((tx) => tx.one(
      'select user_id from sessions where token_hash = $1 and expires_at > app.now()', [hashToken(s.token)]), 'auth');
    if (!row) throw new AppError(401, 'unauthenticated', 'Session invalide ou expirée.');
    return { userId: row.user_id, ...s };
  }

  // Protection CSRF : une requête authentifiée par cookie qui modifie des données doit venir de notre origine.
  function checkOrigin(req) {
    const origin = req.headers.origin;
    const allowed = new Set([new URL(services.appUrl ?? 'http://localhost').origin, `http://${req.headers.host}`, `https://${req.headers.host}`]);
    if (!origin || !allowed.has(origin)) throw new AppError(403, 'csrf', 'Origine de la requête refusée.');
  }

  async function resolveTenant(userId, req) {
    const memberships = await db.asUser(userId, (tx) => tx.query(
      `select tenant_id from memberships where user_id = app.current_user_id() and status = 'active'`));
    const requested = req.headers['x-tenant-id'];
    if (requested) {
      if (!UUID_RE.test(requested) || !memberships.some((m) => m.tenant_id === requested)) {
        throw new AppError(403, 'not_a_member', "Vous n'avez pas accès à cette entreprise.");
      }
      return requested;
    }
    if (memberships.length === 1) return memberships[0].tenant_id;
    if (memberships.length === 0) throw new AppError(403, 'no_tenant', 'Aucune entreprise active pour ce compte.');
    throw new AppError(400, 'tenant_required', 'En-tête X-Tenant-Id requis (plusieurs entreprises).');
  }

  async function handleWebhook(req, res, raw) {
    const secret = env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return send(res, 503, { error: { code: 'billing_disabled', message: 'Webhooks de paiement non configurés.' } });
    const v = verifySignature({ secret, payload: raw, header: req.headers['stripe-signature'] });
    if (!v.ok) return send(res, 400, { error: { code: 'invalid_signature', message: v.reason } });
    let event;
    try { event = JSON.parse(raw); } catch { return send(res, 400, { error: { code: 'invalid_json' } }); }
    const out = await handleBillingEvent(db, event, { priceToPlan: services.priceToPlan, catalog });
    return send(res, out.status, out.body);
  }

  async function handleInbound(req, res, raw) {
    const secret = env.INBOUND_WEBHOOK_SECRET;
    if (!secret) return send(res, 503, { error: { code: 'inbound_disabled', message: 'Réception des réponses non configurée.' } });
    const v = verifySignature({ secret, payload: raw, header: req.headers['x-relanceo-signature'] });
    if (!v.ok) return send(res, 400, { error: { code: 'invalid_signature', message: v.reason } });
    let p;
    try { p = JSON.parse(raw); } catch { return send(res, 400, { error: { code: 'invalid_json' } }); }
    const result = await db.asService(async (tx) => {
      const r = await tx.one('select id, tenant_id from requests where reply_token = $1', [String(p.reply_token ?? '')]);
      if (!r) return null;
      await tx.query(
        `insert into messages (tenant_id, request_id, direction, origin, subject, body, status)
         values ($1, $2, 'inbound', 'inbound_webhook', $3, $4, 'received')`,
        [r.tenant_id, r.id, String(p.subject ?? '').slice(0, 300), String(p.text ?? '').slice(0, 20000)]);
      return r;
    }, 'inbound-email');
    return send(res, result ? 200 : 404, result ? { received: true } : { error: { code: 'unknown_reply_token' } });
  }

  // Tâche planifiée (Vercel Cron ou tout autre ordonnanceur) : relances, alertes de coûts, ménage.
  // Protégée par CRON_SECRET (en-tête Authorization: Bearer <secret>, envoyé automatiquement par Vercel).
  async function handleCron(req, res) {
    const secret = env.CRON_SECRET;
    const given = /^Bearer\s+(.+)$/.exec(req.headers.authorization ?? '')?.[1] ?? '';
    if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
      return send(res, 401, { error: { code: 'unauthorized' } });
    }
    const automations = await runAutomationTick(db, services, { env });
    const costAlerts = await checkCostAnomalies(db, services.costs, catalog);
    await db.asService(async (tx) => {
      await tx.query(`delete from sessions where expires_at < app.now()`);
      await tx.query(`delete from auth_throttle where window_start < app.now() - interval '1 day'`);
      await tx.query(`delete from password_resets where expires_at < app.now() - interval '1 day'`);
    }, 'cron');
    return send(res, 200, { ok: true, automations, cost_alerts: costAlerts.length });
  }

  // Référencement : adresses absolues construites sur le domaine réel (APP_URL ou domaine appelé).
  function seoFile(req, res, pathname) {
    const origin = /^https?:\/\//.test(env.APP_URL ?? '') ? env.APP_URL.replace(/\/$/, '') : `https://${req.headers.host}`;
    if (pathname === '/robots.txt') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
      return res.end(`User-agent: *\nAllow: /\nDisallow: /app.html\nDisallow: /api/\nDisallow: /u/\nDisallow: /demo-paiement.html\nSitemap: ${origin}/sitemap.xml\n`);
    }
    const pages = ['/', '/cuisinistes-menuisiers.html', '/mentions-legales.html', '/cgv.html', '/confidentialite.html'];
    res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    return res.end(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `  <url><loc>${origin}${p}</loc></url>`).join('\n')}\n</urlset>\n`);
  }

  async function handleUnsubscribe(req, res, token) {
    const customer = await db.asService((tx) => tx.one('select id, opted_out_at from customers where unsubscribe_token = $1', [token]), 'unsubscribe');
    if (!customer) return send(res, 404, '<!doctype html><meta charset="utf-8"><title>Lien invalide</title><p>Lien invalide ou expiré.</p>');
    if (req.method === 'POST') {
      await db.asService((tx) => tx.query('update customers set opted_out_at = coalesce(opted_out_at, app.now()) where id = $1', [customer.id]), 'unsubscribe');
      return send(res, 200, '<!doctype html><meta charset="utf-8"><title>Désinscription confirmée</title><p>Vous ne recevrez plus de relances automatiques.</p>');
    }
    return send(res, 200, `<!doctype html><meta charset="utf-8"><title>Se désinscrire</title>
      <form method="post"><p>Ne plus recevoir de relances automatiques ?</p><button type="submit">Confirmer</button></form>`);
  }

  async function serveStatic(res, pathname) {
    const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!file.startsWith(PUBLIC_DIR)) return send(res, 404, { error: { code: 'not_found' } });
    try {
      const data = await readFile(file);
      const type = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' }[path.extname(file)] ?? 'application/octet-stream';
      res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': type, 'Cache-Control': 'no-cache' });
      res.end(data);
    } catch {
      send(res, 404, { error: { code: 'not_found' } });
    }
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;
    try {
      if (rateLimited(req.headers.authorization ?? req.headers.cookie ?? req.socket.remoteAddress ?? 'anon')) {
        throw new AppError(429, 'rate_limited', 'Trop de requêtes. Réessayez dans une minute.');
      }
      if (req.method === 'POST' && pathname === '/api/webhooks/stripe') return await handleWebhook(req, res, await readBody(req));
      if (req.method === 'POST' && pathname === '/api/webhooks/inbound-email') return await handleInbound(req, res, await readBody(req));
      if ((req.method === 'GET' || req.method === 'POST') && pathname === '/api/cron/tick') return await handleCron(req, res);
      if (req.method === 'GET' && (pathname === '/robots.txt' || pathname === '/sitemap.xml')) return seoFile(req, res, pathname);
      const unsub = /^\/u\/([a-f0-9]{16,80})$/.exec(pathname);
      if (unsub && (req.method === 'GET' || req.method === 'POST')) return await handleUnsubscribe(req, res, unsub[1]);
      if (!pathname.startsWith('/api/')) {
        if (req.method !== 'GET') throw new AppError(405, 'method_not_allowed', 'Méthode non autorisée.');
        return await serveStatic(res, pathname);
      }

      const route = routes.find((r) => r.method === req.method && r.match(pathname));
      if (!route) throw new AppError(404, 'not_found', 'Route inconnue.');
      const params = route.match(pathname);
      for (const [k, v] of Object.entries(params)) {
        if (k.endsWith('id') && !UUID_RE.test(v)) throw new AppError(404, 'not_found', 'Ressource introuvable.');
      }
      let body = {};
      if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
        const raw = await readBody(req, pathname === '/api/customers/import' ? 1.5 * 1024 * 1024 : MAX_BODY);
        if (raw) {
          if (!String(req.headers['content-type'] ?? '').includes('application/json')) {
            throw new AppError(415, 'unsupported_media_type', 'JSON attendu.');
          }
          try { body = JSON.parse(raw); } catch { throw new AppError(400, 'invalid_json', 'JSON invalide.'); }
          if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new AppError(400, 'invalid_json', 'Objet JSON attendu.');
        }
      }
      const ip = env.TRUST_PROXY === 'true'
        ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket.remoteAddress
        : req.socket.remoteAddress;
      const ctx = { db, catalog, services, env, params, body, query: Object.fromEntries(url.searchParams), headers: req.headers, ip, cookies: parseCookies(req.headers.cookie) };
      if (route.auth !== false) {
        const a = await authenticate(req);
        ctx.userId = a.userId;
        ctx.sessionToken = a.token;
        if (a.via === 'cookie' && req.method !== 'GET') checkOrigin(req);
        if (route.tenant !== false) {
          ctx.tenantId = await resolveTenant(ctx.userId, req);
          ctx.ent = await db.asUser(ctx.userId, (tx) => loadEntitlements(tx, ctx.tenantId));
          if (route.permission) requirePermission(ctx, route.permission);
        }
      }
      const out = await route.handler(ctx);
      return out?.__http ? send(res, out.status, out.body, out.headers ?? {}) : send(res, 200, out ?? {});
    } catch (err) {
      const e = err instanceof AppError ? err : mapDbError(err);
      if (e) return send(res, e.status, { error: { code: e.code, message: e.message, ...e.details } });
      console.error('[relanceo] erreur interne', err);
      return send(res, 500, { error: { code: 'internal_error', message: 'Erreur interne.' } });
    }
  }

  return { handle, routes };
}

export function listen(app, port = 3000) {
  const server = http.createServer((req, res) => { app.handle(req, res); });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}
