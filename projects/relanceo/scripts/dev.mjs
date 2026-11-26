// Démarrage local : base PGlite persistante dans .data/, trois entreprises de démonstration
// (une par offre) et leurs jetons de session. Aucun paiement, e-mail ou appel IA réel n'est
// effectué tant que les variables d'environnement correspondantes ne sont pas définies.
import { buildApp } from '../src/app.js';
import { listen, createSession } from '../src/http/server.js';
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
console.log('\nJetons de session de démonstration (valables 7 jours) :');
for (const t of demo) console.log(`  ${t.name.padEnd(14)} ${await createSession(db, t.user_id)}`);

await listen(app, port);
console.log(`\nRELANCEO : http://localhost:${port}/pricing.html  ·  espace : http://localhost:${port}/app.html`);
console.log(`Paiement : ${services.billing.name} · E-mail : ${services.email.name} · IA : ${services.ai.name} · Automatisations : ${process.env.AUTOMATIONS_ENABLED === 'true' ? 'activées' : 'désactivées'}`);

// Planificateur (en production : un cron unique, pas un setInterval par instance).
setInterval(async () => {
  try {
    await runAutomationTick(db, services);
    await checkCostAnomalies(db, services.costs, catalog);
  } catch (err) { console.error('[scheduler]', err.message); }
}, 60_000);
