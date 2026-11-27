// Pages d'authentification. La session est un cookie HttpOnly posé par le serveur :
// aucun jeton n'est accessible au JavaScript de la page.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const page = document.body.dataset.page;
const hashParams = new URLSearchParams(location.hash.slice(1));
const query = new URLSearchParams(location.search);

async function post(path, body) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
function show(msg, ok = false) { $('msg').innerHTML = msg ? `<p class="msg ${ok ? '' : 'error'}">${esc(msg)}</p>` : ''; }
function busy(form, on) { form.querySelector('button[type=submit]').disabled = on; }

async function afterSignup(plan) {
  if (!plan) { location.href = '/app.html#/abonnement'; return; }
  const r = await post('/api/billing/checkout', { plan });
  if (r.status === 201 && r.body.checkout_url) { location.href = r.body.checkout_url; return; }
  location.href = `/app.html#/abonnement?offre=${encodeURIComponent(plan)}`;
}

async function showSelectedPlan() {
  const plan = query.get('offre');
  if (!plan) return;
  const data = await fetch('/api/plans').then((r) => r.json()).catch(() => null);
  const p = data?.plans.find((x) => x.id === plan);
  if (!p) return;
  const box = $('aside-plan');
  box.innerHTML = `<strong style="color:#fff;font-size:1.1rem">Offre ${esc(p.name)} — ${esc(p.price_label)} / mois</strong><br>${esc(p.audience)}`;
  box.hidden = false;
}

const form = $('form');
const handlers = {
  async signup(f) {
    const r = await post('/api/auth/signup', { company: f.company.value, name: f.elements.namedItem('name').value, email: f.email.value, password: f.password.value, accept_terms: f.accept_terms.checked });
    if (r.status !== 201) return show(r.body.error?.message ?? 'Inscription impossible.');
    await afterSignup(query.get('offre'));
  },
  async login(f) {
    const r = await post('/api/auth/login', { email: f.email.value, password: f.password.value });
    if (r.status !== 200) return show(r.body.error?.message ?? 'Connexion impossible.');
    const next = query.get('suite');
    location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : '/app.html';
  },
  async forgot(f) {
    const r = await post('/api/auth/forgot', { email: f.email.value });
    if (r.status !== 200) return show(r.body.error?.message ?? 'Demande impossible.');
    show('Si un compte existe pour cette adresse, un e-mail vient de vous être envoyé. Pensez à vérifier vos indésirables.', true);
  },
  async reset(f) {
    const r = await post('/api/auth/reset', { token: hashParams.get('token'), password: f.password.value });
    if (r.status !== 200) return show(r.body.error?.message ?? 'Lien invalide.');
    form.hidden = true;
    $('msg').innerHTML = '<p class="msg">Mot de passe modifié. <a href="/connexion.html">Se connecter</a></p>';
    form.after($('msg'));
  },
  async invite(f) {
    const r = await post('/api/auth/signup-invited', { token: hashParams.get('token'), name: f.elements.namedItem('name').value, password: f.password.value, accept_terms: f.accept_terms.checked });
    if (r.status !== 201) return show(r.body.error?.message ?? 'Impossible de rejoindre l\'équipe.');
    location.href = '/app.html';
  },
};

if (form) {
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    show('');
    busy(form, true);
    try { await handlers[page](form); } catch { show('Connexion au serveur impossible. Réessayez.'); } finally { busy(form, false); }
  });
}

if (page === 'signup') showSelectedPlan();
if (page === 'invite') {
  (async () => {
    const token = hashParams.get('token');
    const res = await fetch(`/api/invitations/lookup?token=${encodeURIComponent(token ?? '')}`);
    const inv = await res.json().catch(() => ({}));
    if (res.status !== 200) { $('inv-text').textContent = inv.error?.message ?? 'Invitation invalide ou expirée.'; return; }
    $('inv-title').textContent = `Rejoindre ${inv.company}`;
    $('inv-text').textContent = `Vous êtes invité(e) à rejoindre l'espace « ${inv.company} » sur RELANCEO.`;
    if (inv.has_account) {
      $('has-account').hidden = false;
      $('login-accept').href = `/connexion.html?suite=${encodeURIComponent(`/app.html#/rejoindre?token=${token}`)}`;
    } else {
      form.hidden = false;
      form.email.value = inv.email;
    }
  })();
}
