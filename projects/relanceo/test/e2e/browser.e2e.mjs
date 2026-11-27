// Parcours complet dans un vrai navigateur (Chromium via Playwright) :
// accueil -> inscription -> page de paiement (Stripe simulé : webhooks signés) -> offre active ->
// demande, IA, client, modèle, automatisation, équipe, statistiques, abonnement, déconnexion.
// Usage : npm run test:e2e   (captures dans E2E_SHOTS ou ./e2e-shots)
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { startEnv, stripeSubEvent, invoiceEvent, PRICES } from '../helpers.mjs';
import { StripeBillingProvider } from '../../src/billing/provider.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const shots = process.env.E2E_SHOTS ?? './e2e-shots';
mkdirSync(shots, { recursive: true });

let env;
let browser;
let pendingCheckout = null;
// Faux Stripe : la session de paiement renvoie vers checkout.stripe.test, intercepté par le navigateur.
const fakeFetch = async (url, init) => {
  const p = new URL(url).pathname;
  const params = Object.fromEntries(new URLSearchParams(init.body ?? ''));
  if (p === '/v1/checkout/sessions') {
    pendingCheckout = params;
    return { ok: true, status: 200, json: async () => ({ id: 'cs_e2e', url: 'https://checkout.stripe.test/pay' }) };
  }
  if (p === '/v1/billing_portal/sessions') return { ok: true, status: 200, json: async () => ({ id: 'bps', url: `${env.base}/app.html#/abonnement` }) };
  return { ok: true, status: 200, json: async () => ({ id: 'x', items: { data: [{ id: 'si' }] } }) };
};

const errors = [];
let step = 0;
async function shot(page, name) {
  step += 1;
  await page.screenshot({ path: `${shots}/${String(step).padStart(2, '0')}-${name}.png`, fullPage: true });
}

try {
  env = await startEnv({ services: { appUrl: 'http://127.0.0.1' } });
  env.services.appUrl = env.base;
  env.services.billing = new StripeBillingProvider({ secretKey: 'sk_test_e2e', priceMap: PRICES, appUrl: env.base, fetchImpl: fakeFetch });

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

  // Paiement Stripe simulé : à l'arrivée sur la page de paiement, on « paie » (webhooks signés) puis on revient.
  await page.route('https://checkout.stripe.test/**', async (route) => {
    const now = Math.floor(Date.now() / 1000);
    const tenantId = pendingCheckout['subscription_data[metadata][tenant_id]'];
    const plan = Object.entries(PRICES).find(([, v]) => v === pendingCheckout['line_items[0][price]'])[0];
    await env.webhook(stripeSubEvent('customer.subscription.created', { tenantId, customer: 'cus_e2e', subscription: 'sub_e2e', price: PRICES[plan], start: now, end: now + 30 * 86400 }));
    await env.webhook(invoiceEvent('invoice.paid', { customer: 'cus_e2e', subscription: 'sub_e2e', billingReason: 'subscription_create' }));
    await route.fulfill({ status: 302, headers: { location: pendingCheckout.success_url } });
  });

  // 1. Accueil
  await page.goto(`${env.base}/`);
  await page.waitForSelector('.plan');
  const prices = await page.$$eval('.plan .amount', (els) => els.map((e) => e.textContent.trim()));
  assert.deepEqual(prices, ['49,99 €', '99 €', '149,99 €']);
  await shot(page, 'accueil');

  // 2. Inscription avec l'offre Business choisie sur l'accueil
  await page.click('.plan.highlight a.btn');
  await page.waitForURL(/inscription\.html\?offre=business/);
  await page.fill('#company', 'Menuiserie Martin');
  await page.fill('#name', 'Claire Martin');
  await page.fill('#email', 'claire@menuiserie-martin.test');
  await page.fill('#password', 'MotDePasse-2026');
  await page.check('#accept_terms');
  await shot(page, 'inscription');
  await page.click('button[type=submit]');

  // 3. Retour de paiement -> activation automatique -> tableau de bord
  await page.waitForURL(/app\.html#\/$/, { timeout: 30000 });
  await page.waitForSelector('.kpis');
  assert.match(await page.textContent('.plan-chip'), /Business/);
  assert.equal(pendingCheckout.customer_email, 'claire@menuiserie-martin.test');
  await shot(page, 'tableau-de-bord');

  // 4. Nouvelle demande avec nouveau client
  await page.click('a[href="#/demandes?nouvelle=1"]');
  await page.waitForSelector('#f-req');
  await page.fill('#r-subject', 'Devis escalier en chêne');
  await page.selectOption('#r-customer', '__new');
  await page.fill('#c-name', 'Mme Leroy');
  await page.fill('#c-email', 'leroy@client.test');
  await page.fill('#r-body', 'Bonjour, je souhaiterais un devis pour un escalier en chêne de 14 marches.');
  await page.selectOption('#r-priority', 'urgent');
  await shot(page, 'nouvelle-demande');
  await page.click('#f-req button[type=submit]');
  await page.waitForSelector('[data-ai="suggest-reply"]');

  // 5. IA : brouillon de réponse (jamais envoyé)
  await page.click('[data-ai="suggest-reply"]');
  await page.waitForSelector('#draft');
  assert.match(await page.inputValue('#draft'), /Devis escalier/);
  await page.selectOption('#q-status', 'waiting_customer');
  await page.click('#save-q');
  await page.waitForSelector('text=Demande mise à jour.');
  await shot(page, 'demande-detail');

  // 6. Liste des demandes
  await page.goto(`${env.base}/app.html#/demandes`);
  await page.waitForSelector('#req-rows tr');
  await shot(page, 'demandes');

  // 7. Modèle + validation
  await page.goto(`${env.base}/app.html#/modeles`);
  await page.click('#new-t');
  await page.fill('#t-n', 'Relance devis');
  await page.fill('#t-s', 'Votre devis {{request.subject}}');
  await page.fill('#t-b', 'Bonjour {{customer.name}},\n\nAvez-vous pu consulter notre devis ? Nous restons à votre disposition.');
  await page.click('#f-t button[type=submit]');
  await page.waitForSelector('[data-approve]');
  await page.click('[data-approve]');
  await page.waitForSelector('text=Validé');
  await shot(page, 'modeles');

  // 8. Automatisation : création + activation avec autorisation explicite
  await page.goto(`${env.base}/app.html#/automatisations`);
  await page.click('#new-rule');
  await page.fill('#ru-n', 'Relance devis sans réponse');
  await page.click('#f-rule button[type=submit]');
  await page.waitForSelector('[data-activate]');
  await page.click('[data-activate]');
  await page.click('#do-activate');
  await page.waitForSelector('text=Cochez l\'autorisation');
  await page.check('#consent');
  await shot(page, 'activation-consentement');
  await page.click('#do-activate');
  await page.waitForSelector('[data-pause]');
  await shot(page, 'automatisations');

  // 9. Équipe : invitation (e-mail envoyé par le prestataire de test)
  await page.goto(`${env.base}/app.html#/equipe`);
  await page.click('#invite');
  await page.fill('#i-e', 'paul@menuiserie-martin.test');
  await page.click('#f-inv button[type=submit]');
  await page.waitForSelector('text=Invitation envoyée par e-mail.');
  await page.keyboard.press('Escape');
  await page.waitForSelector('text=paul@menuiserie-martin.test');
  await shot(page, 'equipe');

  // 10. Statistiques et abonnement
  await page.goto(`${env.base}/app.html#/statistiques`);
  await page.waitForSelector('.bars');
  await shot(page, 'statistiques');
  await page.goto(`${env.base}/app.html#/abonnement`);
  await page.waitForSelector('[data-change="starter"]');
  await page.click('[data-change="starter"]');
  await page.waitForSelector('text=Ne sera plus disponible');
  await shot(page, 'retrogradation-apercu');
  await page.click('#modal [data-close]');
  await shot(page, 'abonnement');

  // 11. Mobile
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.context().addCookies(await page.context().cookies());
  await mobile.goto(`${env.base}/app.html#/`);
  await mobile.waitForSelector('.kpis');
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'pas de débordement horizontal');
  await mobile.screenshot({ path: `${shots}/${String(++step).padStart(2, '0')}-mobile.png`, fullPage: true });
  const home = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await home.goto(`${env.base}/`);
  await home.waitForSelector('.plan');
  assert.equal(await home.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'accueil mobile sans débordement');

  // 12. Déconnexion
  await page.goto(`${env.base}/app.html#/`);
  await page.waitForSelector('#logout');
  await page.click('#logout');
  await page.waitForURL(/connexion\.html/);
  await shot(page, 'connexion');

  assert.deepEqual(errors, [], 'aucune erreur JavaScript');
  console.log(`E2E OK — ${step} captures dans ${shots}`);
} catch (err) {
  console.error('E2E ÉCHEC :', err);
  if (errors.length) console.error('Erreurs navigateur :', errors);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await env?.close();
}
