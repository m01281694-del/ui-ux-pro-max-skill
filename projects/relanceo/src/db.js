// Accès base de données.
// - asUser(userId, fn)  : transaction exécutée sous le rôle "authenticated" avec l'identité de
//                         l'utilisateur => toutes les politiques RLS s'appliquent.
// - asService(fn, actor): transaction sous "service_role" (webhooks, planificateur, opérateur).
// En production (Supabase / Postgres managé), remplacer PGlite par un pool `pg` : les mêmes
// requêtes SQL, migrations, rôles et politiques s'appliquent.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadCatalog } from './plans.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, '..', 'db', 'migrations');

export async function openDb({ dataDir, catalog = loadCatalog() } = {}) {
  const pg = dataDir ? new PGlite(dataDir) : new PGlite();
  await pg.waitReady;
  await pg.exec(`create table if not exists schema_migrations (name text primary key, applied_at timestamptz default now())`);
  const done = new Set((await pg.query('select name from schema_migrations')).rows.map((r) => r.name));
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue;
    await pg.exec(readFileSync(path.join(migrationsDir, file), 'utf8'));
    await pg.query('insert into schema_migrations(name) values ($1)', [file]);
  }
  const db = new Db(pg);
  await db.syncCatalog(catalog);
  return db;
}

export class Db {
  constructor(pg) {
    this.pg = pg;
    this.clock = null; // Date | null — horloge simulée pour les tests
  }

  now() {
    return this.clock ? new Date(this.clock) : new Date();
  }

  async #prepare(tx) {
    if (this.clock) await tx.query(`select set_config('app.now', $1, true)`, [new Date(this.clock).toISOString()]);
  }

  async asUser(userId, fn) {
    if (!userId) throw new Error('asUser requires a user id');
    return this.pg.transaction(async (tx) => {
      await this.#prepare(tx);
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: userId, role: 'authenticated' })]);
      await tx.exec('set local role authenticated');
      return fn(wrap(tx));
    });
  }

  async asService(fn, actor = 'service') {
    return this.pg.transaction(async (tx) => {
      await this.#prepare(tx);
      await tx.query(`select set_config('app.actor', $1, true)`, [actor]);
      await tx.exec('set local role service_role');
      return fn(wrap(tx));
    });
  }

  // Recopie le catalogue (config/plans.json) dans la base : source unique, deux exécutions cohérentes.
  async syncCatalog(catalog) {
    await this.pg.transaction(async (tx) => {
      for (const p of catalog.plans) {
        await tx.query(
          `insert into plans (id, name, price_cents, currency, interval, catalog_version) values ($1,$2,$3,$4,$5,$6)
           on conflict (id) do update set name = excluded.name, price_cents = excluded.price_cents, currency = excluded.currency,
             interval = excluded.interval, catalog_version = excluded.catalog_version, updated_at = now()`,
          [p.id, p.name, p.price_cents, catalog.currency, p.interval, catalog.catalog_version]);
        await tx.query('delete from plan_permissions where plan_id = $1', [p.id]);
        for (const perm of p.permissions) {
          await tx.query('insert into plan_permissions (plan_id, permission) values ($1, $2)', [p.id, perm]);
        }
        await tx.query('delete from plan_limits where plan_id = $1', [p.id]);
        for (const [metric, value] of Object.entries(p.limits)) {
          await tx.query('insert into plan_limits (plan_id, metric, limit_value) values ($1, $2, $3)', [p.id, metric, value]);
        }
      }
      await tx.query('delete from role_permissions');
      for (const [role, perms] of Object.entries(catalog.roles)) {
        for (const perm of perms) await tx.query('insert into role_permissions values ($1, $2)', [role, perm]);
      }
      await tx.query('delete from access_policy_permissions');
      for (const perm of catalog.access_policy.readonly_permissions) {
        await tx.query(`insert into access_policy_permissions values ('readonly', $1)`, [perm]);
      }
      const cfg = {
        access_policy: catalog.access_policy,
        quota_alert_thresholds: catalog.quota_alert_thresholds,
        catalog_version: catalog.catalog_version,
      };
      for (const [key, value] of Object.entries(cfg)) {
        await tx.query(
          `insert into app_config (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value, updated_at = now()`,
          [key, JSON.stringify(value)]);
      }
    });
  }

  async close() {
    await this.pg.close();
  }
}

function wrap(tx) {
  return {
    async query(sql, params = []) {
      return (await tx.query(sql, params)).rows;
    },
    async one(sql, params = []) {
      const rows = (await tx.query(sql, params)).rows;
      return rows[0] ?? null;
    },
    async exec(sql) {
      return tx.exec(sql);
    },
  };
}
