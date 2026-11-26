// Configure votre compte Stripe pour RELANCEO, à partir de config/plans.json :
//   1. un produit + un prix mensuel en euros par offre (réutilisés s'ils existent déjà : lookup_key) ;
//   2. l'endpoint de webhook vers APP_URL/api/webhooks/stripe (événements nécessaires uniquement) ;
//   3. le portail client (carte bancaire, factures, adresse, résiliation à l'échéance ; pas de changement d'offre).
// Affiche ensuite les variables d'environnement à recopier dans l'hébergeur.
//
//   STRIPE_SECRET_KEY=sk_test_... APP_URL=https://votre-domaine.fr node scripts/stripe-setup.mjs
//
// Par défaut les prix sont « taxes comprises » : le client paie exactement 49,99 € / 99 € / 149,99 €.
// Commencez TOUJOURS avec une clé de test (sk_test_). Un prix Stripe ne peut pas être modifié :
// si vous changez un prix dans plans.json, un nouveau prix est créé (version suivante du lookup_key).
import { pathToFileURL } from 'node:url';
import { loadCatalog } from '../src/plans.js';
import { STRIPE_API_VERSION } from '../src/billing/provider.js';

export const WEBHOOK_EVENTS = [
  'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
  'invoice.paid', 'invoice.payment_failed', 'charge.refunded', 'checkout.session.completed',
];

export async function setupStripe({ secretKey, appUrl, taxBehavior = 'inclusive', catalog = loadCatalog(), fetchImpl = fetch, baseUrl = 'https://api.stripe.com', log = console.log }) {
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY requis');
  if (!/^https:\/\//.test(appUrl ?? '')) throw new Error('APP_URL doit être une adresse https:// publique (Stripe doit pouvoir appeler le webhook)');
  const api = async (method, path, params) => {
    const qs = params ? new URLSearchParams(params).toString() : '';
    const res = await fetchImpl(`${baseUrl}/v1/${path}${method === 'GET' && qs ? `?${qs}` : ''}`, {
      method,
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Stripe-Version': STRIPE_API_VERSION },
      body: method === 'GET' ? undefined : qs,
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`Stripe ${path} : ${body?.error?.message ?? res.status}`);
    return body;
  };
  const mode = secretKey.startsWith('sk_live_') ? 'PRODUCTION (live)' : 'TEST';
  log(`Compte Stripe — mode ${mode}`);

  const env = { BILLING_PROVIDER: 'stripe', APP_URL: appUrl };
  for (const plan of catalog.plans) {
    let version = 1;
    let price;
    for (;;) {
      const lookup = `relanceo_${plan.id}_monthly_v${version}`;
      const found = (await api('GET', 'prices', { 'lookup_keys[]': lookup, active: 'true' })).data[0];
      if (!found) break;
      if (found.unit_amount === plan.price_cents && found.currency === catalog.currency.toLowerCase()) { price = found; break; }
      version += 1; // montant différent : on crée une nouvelle version, l'ancienne reste pour les abonnés existants
    }
    if (!price) {
      const product = await api('POST', 'products', {
        name: `RELANCEO ${plan.name}`, description: plan.audience, 'metadata[relanceo_plan]': plan.id,
      });
      price = await api('POST', 'prices', {
        product: product.id, currency: catalog.currency.toLowerCase(), unit_amount: String(plan.price_cents),
        'recurring[interval]': 'month', lookup_key: `relanceo_${plan.id}_monthly_v${version}`,
        tax_behavior: taxBehavior, 'metadata[relanceo_plan]': plan.id,
      });
      log(`  ${plan.name} : prix créé ${price.id} (${plan.price_cents / 100} €/mois)`);
    } else {
      log(`  ${plan.name} : prix existant ${price.id}`);
    }
    env[`STRIPE_PRICE_${plan.id.toUpperCase()}`] = price.id;
  }

  const url = `${appUrl.replace(/\/$/, '')}/api/webhooks/stripe`;
  const hooks = (await api('GET', 'webhook_endpoints', { limit: '100' })).data;
  if (hooks.some((h) => h.url === url)) {
    log(`  Webhook déjà présent pour ${url} : réutilisez son secret (Stripe ne le réaffiche pas) ou supprimez-le puis relancez.`);
  } else {
    const params = { url, api_version: STRIPE_API_VERSION, description: 'RELANCEO — abonnements' };
    WEBHOOK_EVENTS.forEach((e, i) => { params[`enabled_events[${i}]`] = e; });
    const hook = await api('POST', 'webhook_endpoints', params);
    env.STRIPE_WEBHOOK_SECRET = hook.secret;
    log(`  Webhook créé : ${url}`);
  }

  await api('POST', 'billing_portal/configurations', {
    'business_profile[headline]': 'Gérez votre abonnement RELANCEO',
    'features[payment_method_update][enabled]': 'true',
    'features[invoice_history][enabled]': 'true',
    'features[customer_update][enabled]': 'true',
    'features[customer_update][allowed_updates][0]': 'address',
    'features[customer_update][allowed_updates][1]': 'name',
    'features[customer_update][allowed_updates][2]': 'tax_id',
    'features[subscription_cancel][enabled]': 'true',
    'features[subscription_cancel][mode]': 'at_period_end',
    'features[subscription_update][enabled]': 'false',
    default_return_url: `${appUrl.replace(/\/$/, '')}/app.html#/abonnement`,
    default: 'true',
  }).catch((err) => log(`  Portail client : configuration manuelle nécessaire (${err.message})`));
  log('  Portail client configuré (carte, factures, résiliation à l\'échéance).');
  return env;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    // inclusive (défaut) : le client paie exactement le prix affiché (49,99 €), taxes comprises.
    // exclusive : le prix affiché est HT, la TVA s'ajoute (nécessite Stripe Tax ou des taux de TVA).
    const env = await setupStripe({ secretKey: process.env.STRIPE_SECRET_KEY, appUrl: process.env.APP_URL, taxBehavior: process.env.STRIPE_TAX_BEHAVIOR ?? 'inclusive' });
    console.log('\nVariables à définir chez votre hébergeur (ne les publiez jamais) :\n');
    for (const [k, v] of Object.entries(env)) console.log(`${k}=${v}`);
    console.log('STRIPE_SECRET_KEY=<votre clé secrète>');
  } catch (err) {
    console.error(`Échec : ${err.message}`);
    process.exit(1);
  }
}
