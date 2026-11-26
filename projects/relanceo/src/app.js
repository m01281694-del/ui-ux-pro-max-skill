// Assemblage de l'application à partir de l'environnement.
import { openDb } from './db.js';
import { loadCatalog } from './plans.js';
import { loadCosts } from './costs.js';
import { createApp } from './http/server.js';
import { billingProviderFromEnv, priceMapFromEnv } from './billing/provider.js';
import { emailProviderFromEnv } from './email/provider.js';
import { aiProviderFromEnv } from './ai/anthropic.js';

export async function buildServices(env = process.env, overrides = {}) {
  const priceMap = priceMapFromEnv(env);
  const priceToPlan = Object.fromEntries(Object.entries(priceMap).filter(([, v]) => v).map(([plan, price]) => [price, plan]));
  return {
    billing: billingProviderFromEnv(env),
    email: emailProviderFromEnv(env),
    ai: await aiProviderFromEnv(env),
    costs: loadCosts(),
    priceToPlan,
    appUrl: env.APP_URL ?? 'http://localhost:3000',
    replyDomain: env.REPLY_DOMAIN ?? null,
    ...overrides,
  };
}

export async function buildApp({ env = process.env, dataDir, databaseUrl = env.DATABASE_URL, services: overrides } = {}) {
  const catalog = loadCatalog();
  const db = await openDb({ dataDir, databaseUrl, catalog });
  const services = await buildServices(env, overrides);
  const app = createApp({ db, catalog, services, env });
  return { db, catalog, services, app };
}
