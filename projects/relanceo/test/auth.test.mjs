import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startEnv } from './helpers.mjs';
import { hashPassword, verifyPassword } from '../src/auth.js';

let env;
before(async () => { env = await startEnv(); });
after(() => env.close());

// Client « navigateur » : cookie conservé, en-tête Origin comme un vrai navigateur.
function browser() {
  let cookie = '';
  const call = async (method, path, body, extra = {}) => {
    const res = await fetch(env.base + path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), Origin: env.base, ...extra },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, body: json, setCookie: set };
  };
  return { call, get cookie() { return cookie; } };
}

const PW = 'MotDePasse-2026';

test('Mots de passe : scrypt salé, vérification correcte', async () => {
  const h = await hashPassword(PW);
  assert.match(h, /^scrypt\$/);
  assert.notEqual(h, await hashPassword(PW), 'sel aléatoire');
  assert.equal(await verifyPassword(PW, h), true);
  assert.equal(await verifyPassword('autre', h), false);
});

test('Inscription : compte + entreprise, cookie HttpOnly, sans abonnement tant que rien n\'est payé', async () => {
  const b = browser();
  const r = await b.call('POST', '/api/auth/signup', { company: 'Plomberie Durand', name: 'Léa Durand', email: 'lea@durand.test', password: PW, accept_terms: true });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.match(r.setCookie, /HttpOnly/);
  assert.match(r.setCookie, /SameSite=Lax/);
  const ent = await b.call('GET', '/api/entitlements');
  assert.equal(ent.body.status, 'none');
  assert.equal(ent.body.access_mode, 'readonly');
  assert.equal(ent.body.role, 'owner');
  const welcome = env.email.sent.find((m) => m.to === 'lea@durand.test');
  assert.match(welcome.subject, /Bienvenue/);
  const dup = await browser().call('POST', '/api/auth/signup', { company: 'X', email: 'LEA@durand.test', password: PW, accept_terms: true });
  assert.equal(dup.status, 409);
});

test('Inscription : CGU obligatoires, mot de passe robuste exigé', async () => {
  const b = browser();
  assert.equal((await b.call('POST', '/api/auth/signup', { company: 'A', email: 'a@a.test', password: PW })).body.error.code, 'terms_required');
  assert.equal((await b.call('POST', '/api/auth/signup', { company: 'A', email: 'a@a.test', password: 'court', accept_terms: true })).body.error.code, 'weak_password');
  assert.equal((await b.call('POST', '/api/auth/signup', { company: 'A', email: 'pas-un-email', password: PW, accept_terms: true })).body.error.code, 'invalid_email');
});

test('Connexion / déconnexion ; message identique pour e-mail inconnu et mauvais mot de passe', async () => {
  await browser().call('POST', '/api/auth/signup', { company: 'Garage', email: 'paul@garage.test', password: PW, accept_terms: true });
  const b = browser();
  const bad = await b.call('POST', '/api/auth/login', { email: 'paul@garage.test', password: 'faux-mot-de-passe' });
  const unknown = await b.call('POST', '/api/auth/login', { email: 'inconnu@garage.test', password: 'faux-mot-de-passe' });
  assert.equal(bad.status, 401);
  assert.deepEqual(bad.body, unknown.body);
  const ok = await b.call('POST', '/api/auth/login', { email: 'paul@garage.test', password: PW });
  assert.equal(ok.status, 200);
  assert.equal((await b.call('GET', '/api/me')).status, 200);
  assert.equal((await b.call('POST', '/api/auth/logout')).status, 200);
  assert.equal((await b.call('GET', '/api/me')).status, 401);
});

test('Anti force brute : verrouillage après 8 échecs sur un compte', async () => {
  await browser().call('POST', '/api/auth/signup', { company: 'Cible', email: 'cible@x.test', password: PW, accept_terms: true });
  const b = browser();
  let last;
  for (let i = 0; i < 9; i++) last = await b.call('POST', '/api/auth/login', { email: 'cible@x.test', password: `essai-${i}` });
  assert.equal(last.status, 429);
  const good = await b.call('POST', '/api/auth/login', { email: 'cible@x.test', password: PW });
  assert.equal(good.status, 429, 'même le bon mot de passe est refusé pendant le blocage');
});

test('CSRF : une écriture par cookie depuis une autre origine est refusée', async () => {
  const b = browser();
  await b.call('POST', '/api/auth/signup', { company: 'Csrf', email: 'csrf@x.test', password: PW, accept_terms: true });
  const evil = await b.call('POST', '/api/customers', { name: 'pirate' }, { Origin: 'https://site-malveillant.test' });
  assert.equal(evil.status, 403);
  assert.equal(evil.body.error.code, 'csrf');
});

test('Mot de passe oublié : e-mail avec lien, nouveau mot de passe, anciennes sessions fermées, lien à usage unique', async () => {
  const b = browser();
  await b.call('POST', '/api/auth/signup', { company: 'Oubli', email: 'oubli@x.test', password: PW, accept_terms: true });
  const unknown = await browser().call('POST', '/api/auth/forgot', { email: 'personne@x.test' });
  const known = await browser().call('POST', '/api/auth/forgot', { email: 'oubli@x.test' });
  assert.deepEqual(unknown.body, known.body, 'pas d\'énumération des comptes');
  const mail = env.email.sent.filter((m) => m.to === 'oubli@x.test').at(-1);
  const token = /#token=([\w-]+)/.exec(mail.text)[1];
  assert.equal((await browser().call('POST', '/api/auth/reset', { token, password: 'NouveauMotDePasse-1' })).status, 200);
  assert.equal((await b.call('GET', '/api/me')).status, 401, 'sessions existantes révoquées');
  assert.equal((await browser().call('POST', '/api/auth/reset', { token, password: 'EncoreUn-Autre-2' })).status, 400, 'usage unique');
  assert.equal((await browser().call('POST', '/api/auth/login', { email: 'oubli@x.test', password: 'NouveauMotDePasse-1' })).status, 200);
});

test('Invitation par e-mail : création de compte du collaborateur et rattachement à l\'équipe', async () => {
  const owner = await env.tenant('pro');
  const inv = await owner.call('POST', '/api/team/invitations', { email: 'nouvelle@x.test', role: 'member' });
  assert.equal(inv.status, 201);
  assert.equal(inv.body.email_sent, true);
  const mail = env.email.sent.find((m) => m.to === 'nouvelle@x.test');
  const token = /#token=([\w-]+)/.exec(mail.text)[1];
  const look = await browser().call('GET', `/api/invitations/lookup?token=${token}`);
  assert.equal(look.body.email, 'nouvelle@x.test');
  const b = browser();
  const r = await b.call('POST', '/api/auth/signup-invited', { token, name: 'Nina', password: PW, accept_terms: true });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const ent = await b.call('GET', '/api/entitlements');
  assert.equal(ent.body.role, 'member');
  assert.equal(ent.body.plan_id, 'pro');
  assert.equal((await browser().call('GET', `/api/invitations/lookup?token=${token}`)).status, 404, 'invitation consommée');
});

test('Changement de mot de passe : ancien mot de passe exigé', async () => {
  const b = browser();
  await b.call('POST', '/api/auth/signup', { company: 'Chg', email: 'chg@x.test', password: PW, accept_terms: true });
  assert.equal((await b.call('POST', '/api/auth/password', { current: 'faux', password: 'Nouveau-Mdp-123' })).status, 400);
  assert.equal((await b.call('POST', '/api/auth/password', { current: PW, password: 'Nouveau-Mdp-123' })).status, 200);
  assert.equal((await b.call('GET', '/api/me')).status, 200, 'la session courante reste ouverte');
});
