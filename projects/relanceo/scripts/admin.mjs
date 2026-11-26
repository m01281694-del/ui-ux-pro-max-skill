// Outil opérateur (serveur arrêté). Toute action est journalisée avec l'acteur.
//   node scripts/admin.mjs set-plan <tenant_id> <starter|pro|business> <acteur> [statut]
//   node scripts/admin.mjs override <tenant_id> <métrique> <limite> <acteur> "<motif>"
//   node scripts/admin.mjs alerts
import { openDb } from '../src/db.js';
import { operatorSetSubscription } from '../src/accounts.js';

const [cmd, ...args] = process.argv.slice(2);
const db = await openDb({ dataDir: process.env.RELANCEO_DATA_DIR ?? '.data/pglite' });
try {
  if (cmd === 'set-plan') {
    const [tenantId, planId, actor, status = 'active'] = args;
    await operatorSetSubscription(db, tenantId, { planId, status, actor });
    console.log('OK', await db.asService((tx) => tx.one('select plan_id, status, current_period_end from subscriptions where tenant_id = $1', [tenantId])));
  } else if (cmd === 'override') {
    const [tenantId, metric, limit, actor, reason] = args;
    await db.asService((tx) => tx.query(
      `insert into tenant_limit_overrides (tenant_id, metric, limit_value, reason, approved_by) values ($1,$2,$3,$4,$5)
       on conflict (tenant_id, metric) do update set limit_value = excluded.limit_value, reason = excluded.reason, approved_by = excluded.approved_by`,
      [tenantId, metric, Number(limit), reason, actor]), `operator:${actor}`);
    console.log('OK');
  } else if (cmd === 'alerts') {
    console.table(await db.asService((tx) => tx.query('select kind, tenant_id, message, created_at from internal_alerts order by id desc limit 50')));
  } else {
    console.log('Commandes : set-plan | override | alerts');
  }
} finally {
  await db.close();
}
