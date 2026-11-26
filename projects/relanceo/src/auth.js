// Comptes utilisateurs : inscription, connexion, sessions, mot de passe oublié.
// Mots de passe : scrypt (N=2^15, r=8, p=1) + sel aléatoire ; comparaison à temps constant.
// Jetons (session, réinitialisation, invitation) : aléatoires 256 bits, stockés hachés (SHA-256).
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { AppError } from './entitlements.js';
import { hashToken, createSession } from './http/server.js';
import { createTenantWithOwner } from './accounts.js';
import { sendTransactional } from './email/templates.js';

const scrypt = promisify(scryptCb);
const N = 2 ** 15;
const KEYLEN = 64;
export const TERMS_VERSION = '2026-11-draft';
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, { N, r: 8, p: 1, maxmem: 128 * N * 8 * 2 });
  return `scrypt$${N}$8$1$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [alg, n, r, p, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64');
  const got = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: 128 * Number(n) * Number(r) * 2 });
  return got.length === expected.length && timingSafeEqual(got, expected);
}

// Hachage factice pour égaliser le temps de réponse quand l'e-mail n'existe pas.
let dummyHash;
async function dummy() { dummyHash ??= await hashPassword('relanceo-dummy-password'); return dummyHash; }

export function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < 10) throw new AppError(400, 'weak_password', 'Le mot de passe doit contenir au moins 10 caractères.');
  if (pw.length > 200) throw new AppError(400, 'weak_password', 'Mot de passe trop long.');
  if (!/[a-zA-Z]/.test(pw) || !/[0-9\W]/.test(pw)) throw new AppError(400, 'weak_password', 'Utilisez des lettres et au moins un chiffre ou un symbole.');
}

function normEmail(e) {
  const email = String(e ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new AppError(400, 'invalid_email', 'Adresse e-mail invalide.');
  return email;
}

// Anti force brute partagé entre instances (table auth_throttle) : fenêtre de 15 minutes.
export async function throttle(db, key, max) {
  const n = await db.asService((tx) => tx.one(
    `insert into auth_throttle (key, window_start, attempts)
     values ($1, date_trunc('hour', app.now()) + floor(extract(minute from app.now()) / 15) * interval '15 min', 1)
     on conflict (key, window_start) do update set attempts = auth_throttle.attempts + 1
     returning attempts`, [key]), 'auth');
  if (n.attempts > max) throw new AppError(429, 'too_many_attempts', 'Trop de tentatives. Réessayez dans 15 minutes.');
}

export async function signup(ctx, { companyName, name, email, password, acceptTerms }) {
  email = normEmail(email);
  const company = String(companyName ?? '').trim();
  if (!company || company.length > 200) throw new AppError(400, 'invalid_input', 'Nom de l\'entreprise requis.');
  if (acceptTerms !== true) throw new AppError(400, 'terms_required', 'Vous devez accepter les conditions générales.');
  validatePassword(password);
  await throttle(ctx.db, `signup:${ctx.ip}`, 10);
  const exists = await ctx.db.asService((tx) => tx.one('select id from users where email = $1', [email]), 'auth');
  if (exists) throw new AppError(409, 'email_taken', 'Un compte existe déjà avec cette adresse. Connectez-vous ou réinitialisez votre mot de passe.');
  const hash = await hashPassword(password);
  const { tenantId, userId } = await createTenantWithOwner(ctx.db, { tenantName: company, email, displayName: String(name ?? '').trim().slice(0, 120) || null });
  await ctx.db.asService(async (tx) => {
    await tx.query('insert into user_credentials (user_id, password_hash) values ($1, $2)', [userId, hash]);
    await tx.query('update users set terms_accepted_at = app.now(), terms_version = $2 where id = $1', [userId, TERMS_VERSION]);
  }, 'auth');
  await sendTransactional(ctx.services, 'welcome', { to: email, name, company, appUrl: ctx.services.appUrl });
  return { userId, tenantId, token: await createSession(ctx.db, userId) };
}

export async function login(ctx, { email, password }) {
  email = normEmail(email);
  await throttle(ctx.db, `login-ip:${ctx.ip}`, 30);
  await throttle(ctx.db, `login:${email}`, 8);
  const row = await ctx.db.asService((tx) => tx.one(
    'select u.id, c.password_hash from users u left join user_credentials c on c.user_id = u.id where u.email = $1', [email]), 'auth');
  const ok = await verifyPassword(String(password ?? ''), row?.password_hash ?? await dummy());
  if (!row?.password_hash || !ok) throw new AppError(401, 'invalid_credentials', 'E-mail ou mot de passe incorrect.');
  await ctx.db.asService((tx) => tx.query('update users set last_login_at = app.now() where id = $1', [row.id]), 'auth');
  return { userId: row.id, token: await createSession(ctx.db, row.id) };
}

export async function logout(ctx, token) {
  if (token) await ctx.db.asService((tx) => tx.query('delete from sessions where token_hash = $1', [hashToken(token)]), 'auth');
}

// Réponse identique que le compte existe ou non (pas d'énumération des comptes).
export async function forgotPassword(ctx, { email }) {
  email = normEmail(email);
  await throttle(ctx.db, `forgot:${ctx.ip}`, 10);
  const user = await ctx.db.asService((tx) => tx.one('select id from users where email = $1', [email]), 'auth');
  if (!user) return { sent: true };
  const token = randomBytes(32).toString('base64url');
  await ctx.db.asService((tx) => tx.query(
    `insert into password_resets (token_hash, user_id, expires_at) values ($1, $2, app.now() + interval '1 hour')`,
    [hashToken(token), user.id]), 'auth');
  await sendTransactional(ctx.services, 'password_reset', { to: email, link: `${ctx.services.appUrl}/reinitialiser.html#token=${token}` });
  return { sent: true };
}

export async function resetPassword(ctx, { token, password }) {
  validatePassword(password);
  const hash = await hashPassword(password);
  const done = await ctx.db.asService(async (tx) => {
    const r = await tx.one(
      `update password_resets set used_at = app.now() where token_hash = $1 and used_at is null and expires_at > app.now() returning user_id`,
      [hashToken(String(token ?? ''))]);
    if (!r) return null;
    await tx.query(`insert into user_credentials (user_id, password_hash) values ($1, $2)
                    on conflict (user_id) do update set password_hash = excluded.password_hash, updated_at = now()`, [r.user_id, hash]);
    await tx.query('delete from sessions where user_id = $1', [r.user_id]); // déconnecte tous les appareils
    return r;
  }, 'auth');
  if (!done) throw new AppError(400, 'invalid_token', 'Lien invalide ou expiré. Refaites une demande.');
  return { reset: true };
}

export async function changePassword(ctx, { current, password }) {
  validatePassword(password);
  const row = await ctx.db.asService((tx) => tx.one('select password_hash from user_credentials where user_id = $1', [ctx.userId]), 'auth');
  if (!row || !(await verifyPassword(String(current ?? ''), row.password_hash))) {
    throw new AppError(400, 'invalid_credentials', 'Mot de passe actuel incorrect.');
  }
  const hash = await hashPassword(password);
  await ctx.db.asService(async (tx) => {
    await tx.query('update user_credentials set password_hash = $2, updated_at = now() where user_id = $1', [ctx.userId, hash]);
    await tx.query('delete from sessions where user_id = $1 and token_hash <> $2', [ctx.userId, hashToken(ctx.sessionToken ?? '')]);
  }, 'auth');
  return { changed: true };
}

export async function lookupInvitation(ctx, token) {
  const inv = await ctx.db.asService((tx) => tx.one(
    `select i.email, i.role, t.name as company, (select id from users where email = i.email) as user_id
       from invitations i join tenants t on t.id = i.tenant_id
      where i.token_hash = $1 and i.status = 'pending' and i.expires_at > app.now()`, [hashToken(String(token ?? ''))]), 'auth');
  if (!inv) throw new AppError(404, 'invalid_invitation', 'Invitation invalide ou expirée.');
  return { email: inv.email, role: inv.role, company: inv.company, has_account: Boolean(inv.user_id) };
}

// Création de compte depuis une invitation : l'adresse est celle de l'invitation, non modifiable.
export async function signupInvited(ctx, { token, name, password, acceptTerms }) {
  if (acceptTerms !== true) throw new AppError(400, 'terms_required', 'Vous devez accepter les conditions générales.');
  validatePassword(password);
  const inv = await lookupInvitation(ctx, token);
  if (inv.has_account) throw new AppError(409, 'email_taken', 'Un compte existe déjà : connectez-vous pour rejoindre l\'équipe.');
  const hash = await hashPassword(password);
  const userId = await ctx.db.asService(async (tx) => {
    const u = await tx.one(`insert into users (email, display_name, terms_accepted_at, terms_version) values ($1, $2, app.now(), $3) returning id`,
      [inv.email, String(name ?? '').trim().slice(0, 120) || null, TERMS_VERSION]);
    await tx.query('insert into user_credentials (user_id, password_hash) values ($1, $2)', [u.id, hash]);
    return u.id;
  }, 'auth');
  const res = await ctx.db.asUser(userId, async (tx) => (await tx.one('select app.accept_invitation($1) as r', [hashToken(String(token))])).r);
  if (!res.ok) throw new AppError(res.reason === 'quota_exceeded' ? 429 : 400, res.reason, 'Impossible de rejoindre l\'équipe (plus de place disponible ou invitation expirée).');
  return { userId, tenantId: res.tenant_id, token: await createSession(ctx.db, userId) };
}
