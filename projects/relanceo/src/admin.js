// Espace propriétaire de RELANCEO (vous) : vue d'ensemble commerciale et opérationnelle.
// Accès réservé aux comptes dont l'e-mail figure dans ADMIN_EMAILS (variable serveur).
import { AppError } from './entitlements.js';

export async function requireAdmin(ctx) {
  const allowed = String(ctx.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  const me = await ctx.db.asService((tx) => tx.one('select email from users where id = $1', [ctx.userId]), 'admin');
  if (!me || !allowed.includes(me.email.toLowerCase())) throw new AppError(403, 'forbidden', 'Accès réservé à l\'administrateur de RELANCEO.');
}

export async function overview(ctx) {
  await requireAdmin(ctx);
  return ctx.db.asService(async (tx) => {
    const subs = await tx.query(
      `select s.plan_id, s.status, count(*)::int as n from subscriptions s group by 1, 2 order by 1, 2`);
    const mrrCents = (await tx.one(
      `select coalesce(sum(p.price_cents), 0)::int as c from subscriptions s join plans p on p.id = s.plan_id
        where s.status in ('active', 'past_due') and s.provider <> 'manual'`)).c;
    const mrrAll = (await tx.one(
      `select coalesce(sum(p.price_cents), 0)::int as c from subscriptions s join plans p on p.id = s.plan_id where s.status in ('active', 'past_due')`)).c;
    const tenants = await tx.query(
      `select t.id, t.name, t.created_at, u.email as owner_email, s.plan_id, s.status, s.provider, s.current_period_end,
              (select count(*)::int from requests r where r.tenant_id = t.id) as requests
         from tenants t
         left join memberships m on m.tenant_id = t.id and m.role = 'owner'
         left join users u on u.id = m.user_id
         left join subscriptions s on s.tenant_id = t.id
        order by t.created_at desc limit 200`);
    const signups30 = (await tx.one(`select count(*)::int as n from tenants where created_at > now() - interval '30 days'`)).n;
    const leads = await tx.query('select * from leads order by created_at desc limit 200');
    const alerts = await tx.query('select kind, message, created_at from internal_alerts order by id desc limit 30');
    const costs30 = (await tx.one(`select coalesce(sum(amount_eur), 0)::float as eur from cost_ledger where created_at > now() - interval '30 days'`)).eur;
    return { mrr_cents: mrrCents, mrr_including_manual_cents: mrrAll, subscriptions: subs, signups_30d: signups30, tenants, leads, alerts, costs_30d_eur: costs30 };
  }, 'admin');
}

export async function updateLead(ctx, id, status) {
  await requireAdmin(ctx);
  if (!['new', 'contacted', 'won', 'lost'].includes(status)) throw new AppError(400, 'invalid_input', 'Statut invalide.');
  const r = await ctx.db.asService((tx) => tx.one('update leads set status = $2 where id = $1 returning id, status', [id, status]), 'admin');
  if (!r) throw new AppError(404, 'not_found', 'Prospect introuvable.');
  return r;
}

// Import CSV de clients (séparateur , ou ;). Colonnes reconnues : nom/name, email/e-mail, telephone/phone.
export function parseCustomersCsv(text) {
  const lines = String(text ?? '').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new AppError(400, 'invalid_csv', 'Fichier vide : une ligne d\'en-tête puis une ligne par client.');
  const sep = (lines[0].match(/;/g) ?? []).length > (lines[0].match(/,/g) ?? []).length ? ';' : ',';
  const split = (line) => {
    const out = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (c === sep && !q) { out.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    out.push(cur.trim());
    return out;
  };
  const norm = (h) => h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
  const head = split(lines[0]).map(norm);
  const col = (names) => head.findIndex((h) => names.includes(h));
  const iName = col(['nom', 'name', 'client', 'raisonsociale', 'societe', 'entreprise']);
  const iEmail = col(['email', 'mail', 'courriel', 'adresseemail']);
  const iPhone = col(['telephone', 'tel', 'phone', 'portable', 'mobile']);
  if (iName < 0) throw new AppError(400, 'invalid_csv', 'Colonne « nom » introuvable dans la première ligne.');
  if (lines.length - 1 > 2000) throw new AppError(400, 'invalid_csv', '2 000 clients maximum par import.');
  return lines.slice(1).map(split).map((c) => ({
    name: (c[iName] ?? '').slice(0, 200),
    email: iEmail >= 0 && /@/.test(c[iEmail] ?? '') ? c[iEmail].toLowerCase().slice(0, 254) : null,
    phone: iPhone >= 0 ? (c[iPhone] ?? '').slice(0, 40) || null : null,
  })).filter((r) => r.name);
}
