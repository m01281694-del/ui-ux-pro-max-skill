// Démarrage local : base PGlite persistante dans .data/, trois entreprises de démonstration
// (une par offre) et leurs jetons de session. Aucun paiement, e-mail ou appel IA réel n'est
// effectué tant que les variables d'environnement correspondantes ne sont pas définies.
import { buildApp } from '../src/app.js';
import { listen } from '../src/http/server.js';
import { hashPassword } from '../src/auth.js';
import { createTenantWithOwner, operatorSetSubscription } from '../src/accounts.js';
import { runAutomationTick } from '../src/automations/engine.js';
import { checkCostAnomalies } from '../src/costs.js';

const port = Number(process.env.PORT ?? 3000);
const { db, app, services, catalog } = await buildApp({ dataDir: process.env.RELANCEO_DATA_DIR ?? '.data/pglite' });

const existing = await db.asService((tx) => tx.query(`select t.id, t.name, m.user_id from tenants t join memberships m on m.tenant_id = t.id and m.role = 'owner' where t.name like 'Démo %'`));
const demo = existing.length ? existing : [];
if (!existing.length) {
  for (const plan of ['starter', 'pro', 'business']) {
    const { tenantId, userId } = await createTenantWithOwner(db, { tenantName: `Démo ${plan}`, email: `demo-${plan}@relanceo.invalid` });
    await operatorSetSubscription(db, tenantId, { planId: plan, actor: 'dev-seed' });
    demo.push({ id: tenantId, name: `Démo ${plan}`, user_id: userId });
  }
}
const DEMO_PASSWORD = 'Demo-relanceo-2026';
const hash = await hashPassword(DEMO_PASSWORD);
console.log(`\nComptes de démonstration (mot de passe : ${DEMO_PASSWORD}) :`);
for (const t of demo) {
  await db.asService((tx) => tx.query(`insert into user_credentials (user_id, password_hash) values ($1, $2)
    on conflict (user_id) do update set password_hash = excluded.password_hash`, [t.user_id, hash]));
  const u = await db.asService((tx) => tx.one('select email from users where id = $1', [t.user_id]));
  console.log(`  ${t.name.padEnd(14)} ${u.email}`);
}

await listen(app, port);
console.log(`\nRELANCEO : http://localhost:${port}/  ·  connexion : http://localhost:${port}/connexion.html`);
console.log(`Paiement : ${services.billing.name} · E-mail : ${services.email.name} · IA : ${services.ai.name} · Automatisations : ${process.env.AUTOMATIONS_ENABLED === 'true' ? 'activées' : 'désactivées'}`);

// Planificateur (en production : un cron unique, pas un setInterval par instance).
setInterval(async () => {
  try {
    await runAutomationTick(db, services);
    await checkCostAnomalies(db, services.costs, catalog);
  } catch (err) { console.error('[scheduler]', err.message); }
}, 60_000);
