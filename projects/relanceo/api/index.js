// Point d'entrée Vercel (fonction Node) : toutes les routes /api/* et /u/* passent par le serveur RELANCEO.
// Production : DATABASE_URL (Postgres) obligatoire.
// Démonstration (DEMO_MODE=true, sans DATABASE_URL) : base PGlite en mémoire, comptes de démonstration,
// paiements simulés ; les données disparaissent au redémarrage de l'instance.
import { buildApp } from '../src/app.js';
import { createTenantWithOwner, operatorSetSubscription } from '../src/accounts.js';
import { hashPassword } from '../src/auth.js';

let ready;
async function boot() {
  const demo = process.env.DEMO_MODE === 'true' && !process.env.DATABASE_URL;
  if (!process.env.DATABASE_URL && !demo) throw new Error('DATABASE_URL manquant : une base Postgres est obligatoire en production.');
  const built = await buildApp({ databaseUrl: process.env.DATABASE_URL ?? null });
  if (demo) {
    const hash = await hashPassword('Demo-relanceo-2026');
    for (const plan of ['starter', 'pro', 'business']) {
      const { tenantId, userId } = await createTenantWithOwner(built.db, { tenantName: `Démo ${plan[0].toUpperCase()}${plan.slice(1)}`, email: `demo-${plan}@relanceo.app` });
      await operatorSetSubscription(built.db, tenantId, { planId: plan, actor: 'demo-seed' });
      await built.db.asService((tx) => tx.query('insert into user_credentials (user_id, password_hash) values ($1, $2)', [userId, hash]));
    }
  }
  return built.app;
}

export default async function handler(req, res) {
  try {
    ready ??= boot();
    (await ready).handle(req, res);
  } catch (err) {
    console.error('[relanceo] démarrage impossible', err);
    ready = undefined;
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: { code: 'service_unavailable', message: 'Service momentanément indisponible.' } }));
  }
}
