// Tableau de bord. Ce fichier n'embarque AUCUNE règle d'abonnement : il affiche ce que renvoie
// /api/entitlements (droits calculés par le serveur) et les messages d'upsell fournis par le serveur.
// Masquer un bouton ici ne protège rien : chaque action est revérifiée côté serveur et en base.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n) => new Intl.NumberFormat('fr-FR').format(n);
const date = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
let token = null;
try { token = sessionStorage.getItem('relanceo_token'); } catch { /* stockage indisponible */ }

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(method === 'POST' ? { 'Idempotency-Key': crypto.randomUUID() } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

const STATUS = {
  active: ['Actif', 'ok'], past_due: ['Paiement en échec', 'warn'], suspended: ['Suspendu', 'danger'],
  canceled: ['Résilié', 'danger'], incomplete: ['En attente de paiement', 'warn'], none: ['Aucun abonnement', 'warn'],
};

// Tuiles : libellé -> permission. La décision « verrouillé / disponible » vient du serveur.
const TILES = [
  ['Demandes clients', 'requests.create'], ['Fiches clients', 'customers.manage'], ['Rappels manuels', 'reminders.manual'],
  ['Statistiques essentielles', 'statistics.basic'], ['Statistiques avancées', 'statistics.advanced'],
  ['Priorités avancées', 'priorities.advanced'], ['Modèles de réponses', 'templates.manage'],
  ['Résumé IA', 'ai.summary'], ['Classification IA', 'ai.classification'], ['Suggestions de réponse IA', 'ai.suggestions'],
  ['Automatisations de relances', 'automations.create'], ['Historique des automatisations', 'automations.view'],
  ['Équipe', 'team.invite'],
];

function renderSub(e) {
  const [label, cls] = STATUS[e.status] ?? [e.status, 'warn'];
  const extra = [];
  if (e.access_mode === 'readonly') extra.push('<p class="msg error">Accès en lecture seule : consultation et export de vos données uniquement.</p>');
  if (e.cancel_at_period_end) extra.push(`<p class="msg">Résiliation programmée au ${date(e.renewal_date)}.</p>`);
  if (e.scheduled_plan_id) extra.push(`<p class="msg">Changement vers ${esc(e.scheduled_plan_id)} prévu au ${date(e.renewal_date)}.</p>`);
  document.getElementById('sub').innerHTML = `
    <div class="kpi">${esc(e.plan?.name ?? '—')}</div>
    <p><span class="status ${cls}">${esc(label)}</span></p>
    <p class="tax">Renouvellement : ${date(e.renewal_date)} · Rôle : ${esc(e.role)}</p>
    ${extra.join('')}
    <a class="btn" href="/pricing.html">Comparer les offres</a>`;
}

function renderMeters(e) {
  const labels = { requests_monthly: 'Demandes', ai_operations_monthly: 'Opérations IA', automation_sends_monthly: 'Relances automatiques', seats: 'Collaborateurs', automation_rules_active: 'Règles actives' };
  document.getElementById('meters').innerHTML = Object.entries(e.limits).filter(([, lim]) => lim > 0).map(([m, lim]) => {
    const used = Number(e.usage[m] ?? 0);
    const pct = Math.min(100, Math.round((100 * used) / lim));
    const cls = pct >= 100 ? 'w100' : pct >= 70 ? 'w70' : '';
    return `<div class="meter ${cls}"><div class="row"><span>${esc(labels[m] ?? m)}</span><span>${fmt(used)} / ${fmt(lim)}</span></div>
      <div class="bar" role="progressbar" aria-label="${esc(labels[m] ?? m)}" aria-valuemin="0" aria-valuemax="${lim}" aria-valuenow="${used}"><i style="width:${pct}%"></i></div></div>`;
  }).join('') + `<p class="tax">Période du ${date(e.current_period_start)} au ${date(e.current_period_end)}.</p>`;
}

function renderFeatures(e) {
  const root = document.getElementById('features');
  root.innerHTML = TILES.map(([label, perm]) => {
    const on = e.permissions.includes(perm);
    const locked = e.locked[perm];
    const state = on ? '<span class="lock">Inclus</span>'
      : locked ? `<span class="lock">Offre ${esc(locked.required_plan_name)}</span>`
        : '<span class="lock">Non disponible pour votre rôle ou votre statut</span>';
    return `<button type="button" class="feature ${on ? 'on' : 'locked'}" data-perm="${esc(perm)}">${state}<strong>${esc(label)}</strong></button>`;
  }).join('');
  root.onclick = (ev) => {
    const btn = ev.target.closest('.feature');
    if (!btn) return;
    const u = e.locked[btn.dataset.perm];
    if (u) openUpsell(u);
  };
}

async function openUpsell(u) {
  const d = document.getElementById('upsell');
  document.getElementById('up-title').textContent = u.title;
  document.getElementById('up-body').textContent = u.body;
  document.getElementById('up-benefits').innerHTML = u.benefits.map((b) => `<li>${esc(b)}</li>`).join('');
  document.getElementById('up-price').textContent = `Offre ${u.required_plan_name} : ${u.price_label}`;
  document.getElementById('up-msg').innerHTML = '';
  const pv = await api('GET', `/api/billing/preview?plan=${encodeURIComponent(u.required_plan)}`);
  document.getElementById('up-preview').innerHTML = pv.status === 200
    ? `<p class="tax">${esc(pv.body.effective)} ${esc(pv.body.data_policy)}</p>` : '';
  const cta = document.getElementById('up-cta');
  cta.textContent = `Passer à ${u.required_plan_name}`;
  cta.disabled = false;
  cta.onclick = async () => {
    cta.disabled = true;
    const r = await api('POST', '/api/billing/change-plan', { plan: u.required_plan });
    const box = document.getElementById('up-msg');
    if (r.status === 202 && r.body.checkout_url) { window.location.href = r.body.checkout_url; return; }
    box.innerHTML = `<p class="msg ${r.status >= 400 ? 'error' : ''}">${esc(r.body.message ?? r.body.error?.message ?? 'Demande envoyée.')}</p>`;
  };
  d.querySelector('[data-close]').onclick = () => d.close();
  d.showModal();
}

async function load() {
  const e = await api('GET', '/api/entitlements');
  if (e.status === 401) { showLogin(); return; }
  if (e.status !== 200) { document.getElementById('main').innerHTML = `<p class="msg error">${esc(e.body.error?.message)}</p>`; return; }
  document.getElementById('dash').hidden = false;
  document.getElementById('logout').hidden = false;
  renderSub(e.body); renderMeters(e.body); renderFeatures(e.body);
  const [n, r] = await Promise.all([api('GET', '/api/notifications'), api('GET', '/api/requests')]);
  document.getElementById('notifications').innerHTML = (n.body.length ? n.body : [{ message: 'Aucune notification.' }]).slice(0, 8)
    .map((x) => `<li>${esc(x.message)}</li>`).join('');
  document.getElementById('requests').innerHTML = (Array.isArray(r.body) && r.body.length ? r.body : []).slice(0, 8)
    .map((x) => `<li><strong>${esc(x.subject)}</strong> · ${esc(x.status)} · ${esc(x.priority)}</li>`).join('') || '<li>Aucune demande.</li>';
  const wanted = new URLSearchParams(location.search).get('plan');
  if (wanted && wanted !== e.body.plan_id) {
    const anyLocked = Object.values(e.body.locked).find((u) => u.required_plan === wanted);
    if (anyLocked) openUpsell(anyLocked);
  }
}

function showLogin() {
  document.getElementById('login').hidden = false;
  document.getElementById('login-btn').onclick = () => {
    token = document.getElementById('token').value.trim();
    try { sessionStorage.setItem('relanceo_token', token); } catch { /* ignoré */ }
    document.getElementById('login').hidden = true;
    load();
  };
}

document.getElementById('logout').onclick = (ev) => {
  ev.preventDefault();
  try { sessionStorage.removeItem('relanceo_token'); } catch { /* ignoré */ }
  location.href = '/app.html';
};
if (token) load(); else showLogin();
