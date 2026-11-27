// RELANCEO — application cliente.
// Aucune règle d'abonnement ici : l'interface affiche les droits calculés par le serveur
// (/api/entitlements). Chaque action est revérifiée côté serveur et dans la base.
'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n) => new Intl.NumberFormat('fr-FR').format(Number(n ?? 0));
const dateFr = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
const dateTimeFr = (d) => (d ? new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const euros = (cents) => `${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: cents % 100 ? 2 : 0 })} €`;

const S = { ent: null, me: null, catalog: null };
const view = $('#view');

// ------------------------------------------------------------------ réseau
async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(method !== 'GET' ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
      ...(S.tenantId ? { 'X-Tenant-Id': S.tenantId } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) { location.href = `/connexion.html?suite=${encodeURIComponent(location.pathname + location.hash)}`; throw new Error('unauthenticated'); }
  return { status: res.status, ok: res.ok, body: json };
}
const errMsg = (r) => r.body?.error?.message ?? 'Une erreur est survenue.';

function toast(message, kind = '') {
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.textContent = message;
  $('#toasts').append(t);
  while ($('#toasts').children.length > 3) $('#toasts').firstElementChild.remove();
  setTimeout(() => t.remove(), 5200);
}

// ------------------------------------------------------------------ fenêtre modale
const modal = $('#modal');
function openModal(html, bind) {
  $('#modal-inner').innerHTML = html;
  modal.showModal();
  $$('[data-close]', modal).forEach((b) => { b.onclick = () => modal.close(); });
  bind?.($('#modal-inner'));
}

// ------------------------------------------------------------------ icônes (traits, 24×24)
const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V21H3z M9 21v-6h6v6',
  inbox: 'M3 13h5l2 3h4l2-3h5 M5 5h14l2 8v6H3v-6z',
  users: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1 M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M22 19v-1a4 4 0 0 0-3-3.9 M16 4.1a3 3 0 0 1 0 5.8',
  file: 'M14 3H6v18h12V7z M14 3v4h4 M9 13h6 M9 17h6',
  zap: 'M13 2 4 14h7l-1 8 9-12h-7z',
  team: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M4 21a8 8 0 0 1 16 0',
  chart: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
  card: 'M2 6h20v12H2z M2 10h20 M6 15h4',
  user: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10 M3 22a9 9 0 0 1 18 0',
  lock: 'M6 11h12v10H6z M8 11V7a4 4 0 1 1 8 0v4',
  plus: 'M12 5v14 M5 12h14',
  sparkle: 'M12 3v4 M12 17v4 M3 12h4 M17 12h4 M6 6l2.5 2.5 M15.5 15.5 18 18 M6 18l2.5-2.5 M15.5 8.5 18 6',
};
const icon = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[n]}"/></svg>`;

// ------------------------------------------------------------------ droits (lus, jamais calculés)
const can = (perm) => S.ent?.permissions.includes(perm);
const lockedBy = (perm) => S.ent?.locked?.[perm] ?? null;

const STATUS = { new: ['Nouvelle', 'blue'], in_progress: ['En cours', 'blue'], waiting_customer: ['En attente client', 'amber'], closed: ['Clôturée', 'green'] };
const PRIORITY = { low: ['Basse', ''], normal: ['Normale', ''], high: ['Haute', 'amber'], urgent: ['Urgente', 'red'] };
const CHANNEL = { manual: 'saisie manuelle', email: 'reçue par e-mail', phone: 'reçue par téléphone', form: 'formulaire', other: 'autre canal' };
const chip = (map, k) => { const [l, c] = map[k] ?? [k, '']; return `<span class="chip ${c}">${esc(l)}</span>`; };
const SUB_STATUS = { active: ['Actif', 'green'], past_due: ['Paiement en échec', 'amber'], suspended: ['Suspendu', 'red'], canceled: ['Résilié', 'red'], incomplete: ['Paiement en attente', 'amber'], none: ['Aucune offre', 'amber'] };

function upsellPanel(perm) {
  const u = lockedBy(perm);
  if (!u) {
    return `<div class="panel"><div class="lockcard"><div class="icon">${icon('lock')}</div><h2>Accès non disponible</h2>
      <p>${S.ent.access_mode === 'readonly' ? 'Votre abonnement n\'est pas actif : seules la consultation et l\'export sont possibles.' : 'Votre rôle ne permet pas cette action. Demandez à un administrateur.'}</p>
      ${S.ent.access_mode === 'readonly' ? '<a class="btn primary" href="#/abonnement">Voir mon abonnement</a>' : ''}</div></div>`;
  }
  return `<div class="panel"><div class="lockcard"><div class="icon">${icon('lock')}</div>
    <h2>${esc(u.title)}</h2><p>${esc(u.body)}</p>
    ${u.benefits.length ? `<ul>${u.benefits.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
    <p><strong>Offre ${esc(u.required_plan_name)} — ${esc(u.price_label)}</strong></p>
    <button class="btn primary" type="button" data-upsell="${esc(perm)}">Passer à ${esc(u.required_plan_name)}</button></div></div>`;
}

function openUpsell(perm) {
  const u = lockedBy(perm);
  if (!u) return;
  openModal(`<h2>${esc(u.title)}</h2><p>${esc(u.body)}</p>
    ${u.benefits.length ? `<ul>${u.benefits.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
    <p><strong>Offre ${esc(u.required_plan_name)} : ${esc(u.price_label)}</strong></p>
    <div class="actions"><button class="btn ghost" data-close type="button">Plus tard</button>
    <a class="btn primary" href="#/abonnement?offre=${esc(u.required_plan)}" data-close>Voir l'offre ${esc(u.required_plan_name)}</a></div>`);
}
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-upsell]');
  if (b) { ev.preventDefault(); openUpsell(b.dataset.upsell); }
});

// ------------------------------------------------------------------ navigation
const NAV = [
  ['', 'Tableau de bord', 'home', null],
  ['demandes', 'Demandes', 'inbox', 'requests.view'],
  ['clients', 'Clients', 'users', 'customers.view'],
  ['modeles', 'Modèles', 'file', 'templates.manage'],
  ['automatisations', 'Automatisations', 'zap', 'automations.view'],
  ['equipe', 'Équipe', 'team', 'team.view'],
  ['statistiques', 'Statistiques', 'chart', 'statistics.basic'],
  ['abonnement', 'Abonnement', 'card', 'billing.view'],
  ['compte', 'Mon compte', 'user', null],
];

function renderSide(current) {
  const e = S.ent;
  const [label, color] = SUB_STATUS[e.status] ?? [e.status, ''];
  $('#side').innerHTML = `<a class="brand" href="#/">RELAN<span>CEO</span></a>
    ${NAV.map(([path, text, ic, perm]) => {
      const lock = perm && lockedBy(perm) ? `<span class="lockdot">${esc(lockedBy(perm).required_plan_name)}</span>` : '';
      return `<a class="item" href="#/${path}" ${current === path ? 'aria-current="page"' : ''}>${icon(ic)}<span>${text}</span>${lock}</a>`;
    }).join('')}
    <div class="spacer"></div>
    <div class="plan-chip"><strong>${esc(S.me.company)}</strong>${esc(e.plan?.name ? `Offre ${e.plan.name}` : 'Aucune offre')} · <span class="chip ${color}">${esc(label)}</span></div>
    <a class="item" href="#" id="logout">${icon('lock')}<span>Se déconnecter</span></a>`;
  $('#logout').onclick = async (ev) => { ev.preventDefault(); await api('POST', '/api/auth/logout'); location.href = '/connexion.html'; };
}

$('#menu-btn').onclick = () => {
  const open = $('#side').classList.toggle('open');
  $('#menu-btn').setAttribute('aria-expanded', String(open));
};

function accessBanner() {
  const e = S.ent;
  const demo = S.catalog?.configuration?.demo_mode ? '<div class="banner info"><div class="grow"><strong>Version de démonstration</strong> — paiements simulés, aucun prélèvement ; les données peuvent être effacées à tout moment.</div></div>' : '';
  return demo + accessBannerInner(e);
}
function accessBannerInner(e) {
  if (e.status === 'none' || e.status === 'incomplete') {
    return `<div class="banner info"><div class="grow"><strong>Bienvenue sur RELANCEO.</strong> Choisissez votre offre pour commencer à enregistrer vos demandes.</div><a class="btn sm primary" href="#/abonnement">Choisir une offre</a></div>`;
  }
  if (e.status === 'past_due' && e.access_mode === 'full') {
    return `<div class="banner warn"><div class="grow"><strong>Le dernier paiement a échoué.</strong> Mettez à jour votre moyen de paiement pour conserver l'accès complet.</div><button class="btn sm" type="button" data-portal>Mettre à jour</button></div>`;
  }
  if (e.access_mode === 'readonly') {
    return `<div class="banner danger"><div class="grow"><strong>Accès en lecture seule.</strong> ${e.status === 'canceled' ? 'Votre abonnement est résilié.' : 'Votre abonnement n\'est pas actif.'} Vos données sont conservées et exportables.</div><a class="btn sm primary" href="#/abonnement">Réactiver</a></div>`;
  }
  if (e.cancel_at_period_end) {
    return `<div class="banner warn"><div class="grow">Résiliation programmée : votre offre reste active jusqu'au <strong>${dateFr(e.renewal_date)}</strong>.</div><a class="btn sm" href="#/abonnement">Gérer</a></div>`;
  }
  return '';
}
document.addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-portal]');
  if (!b) return;
  ev.preventDefault();
  b.disabled = true;
  const r = await api('POST', '/api/billing/portal');
  b.disabled = false;
  if (r.ok) location.href = r.body.url; else toast(errMsg(r), 'error');
});

function head(title, sub = '', actions = '') {
  return `${accessBanner()}<div class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="row">${actions}</div></div>`;
}

function meter(label, used, limit) {
  const pct = limit > 0 ? Math.min(100, Math.round((100 * used) / limit)) : 0;
  const cls = pct >= 100 ? 'w100' : pct >= 70 ? 'w70' : '';
  return `<div class="meter ${cls}"><div class="row" style="justify-content:space-between"><span>${esc(label)}</span><span>${fmt(used)} / ${fmt(limit)}</span></div>
    <div class="bar" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="${limit}" aria-valuenow="${used}"><i style="width:${pct}%"></i></div></div>`;
}
const METRIC_LABEL = { requests_monthly: 'Demandes', ai_operations_monthly: 'Opérations IA', automation_sends_monthly: 'Relances automatiques', seats: 'Collaborateurs', automation_rules_active: 'Règles actives' };
const meters = () => Object.entries(S.ent.limits).filter(([, l]) => l > 0).map(([m, l]) => meter(METRIC_LABEL[m] ?? m, S.ent.usage[m] ?? 0, l)).join('');

// ------------------------------------------------------------------ vues
async function viewDashboard() {
  const [stats, notif, reqs] = await Promise.all([
    can('statistics.basic') ? api('GET', '/api/stats/basic') : null,
    api('GET', '/api/notifications'),
    can('requests.view') ? api('GET', '/api/requests') : null,
  ]);
  const st = stats?.body ?? { by_status: {}, period: {} };
  const open = (st.by_status?.new ?? 0) + (st.by_status?.in_progress ?? 0);
  const recent = (reqs?.body ?? []).slice(0, 6);
  const hello = S.me.user.display_name ? `Bonjour ${S.me.user.display_name.split(' ')[0]}` : 'Bonjour';
  view.innerHTML = `${head(hello, `Voici l'activité de ${esc(S.me.company)}.`, can('requests.create') ? `<a class="btn primary" href="#/demandes?nouvelle=1">${icon('plus', 'ico')} Nouvelle demande</a>` : '')}
    <div class="kpis">
      <div class="kpi-card"><div class="label">À traiter</div><div class="value">${fmt(open)}</div></div>
      <div class="kpi-card"><div class="label">En attente client</div><div class="value">${fmt(st.by_status?.waiting_customer ?? 0)}</div></div>
      <div class="kpi-card"><div class="label">Rappels échus</div><div class="value">${fmt(st.reminders_due ?? 0)}</div></div>
      <div class="kpi-card"><div class="label">Clôturées ce mois</div><div class="value">${fmt(st.period?.closed ?? 0)}</div></div>
    </div>
    <div class="cols">
      <section class="panel"><header><h2>Demandes récentes</h2><a class="btn sm" href="#/demandes">Tout voir</a></header>
        ${recent.length ? `<div class="scroll-x"><table class="data"><thead><tr><th>Objet</th><th>Client</th><th>Statut</th><th>Priorité</th></tr></thead><tbody>
        ${recent.map((r) => `<tr class="click" data-href="#/demandes/${r.id}"><td><strong>${esc(r.subject)}</strong></td><td>${esc(r.customer_name ?? '—')}</td><td>${chip(STATUS, r.status)}</td><td>${chip(PRIORITY, r.priority)}</td></tr>`).join('')}
        </tbody></table></div>` : '<div class="empty"><strong>Aucune demande pour l\'instant</strong>Enregistrez la première pour commencer le suivi.</div>'}
      </section>
      <div>
        <section class="panel"><header><h2>Consommation</h2><a class="btn sm" href="#/abonnement">Détails</a></header><div class="body">${meters() || '<p class="muted">Aucun quota actif.</p>'}<p class="small muted">Période jusqu'au ${dateFr(S.ent.current_period_end)}.</p></div></section>
        <section class="panel"><header><h2>Notifications</h2></header><div class="body"><ul class="list">${(notif.body.length ? notif.body.slice(0, 6) : [{ message: 'Aucune notification.' }]).map((n) => `<li>${esc(n.message)}${n.created_at ? `<br><small class="muted">${dateTimeFr(n.created_at)}</small>` : ''}</li>`).join('')}</ul></div></section>
      </div>
    </div>`;
}

async function viewRequests(params) {
  if (!can('requests.view')) { view.innerHTML = head('Demandes') + upsellPanel('requests.view'); return; }
  const filter = params.get('statut') ?? '';
  const r = await api('GET', `/api/requests${filter ? `?status=${encodeURIComponent(filter)}` : ''}`);
  const rows = r.body;
  const tabs = [['', 'Toutes'], ['new', 'Nouvelles'], ['in_progress', 'En cours'], ['waiting_customer', 'En attente client'], ['closed', 'Clôturées']];
  view.innerHTML = `${head('Demandes', 'Toutes les demandes de vos clients, au même endroit.', can('requests.create') ? `<button class="btn primary" type="button" id="new-req">${icon('plus', 'ico')} Nouvelle demande</button>` : '')}
    <div class="tabs" role="group" aria-label="Filtrer par statut">${tabs.map(([k, l]) => `<button type="button" data-filter="${k}" aria-pressed="${k === filter}">${l}</button>`).join('')}</div>
    <div class="field" style="max-width:360px"><input class="input" id="search" type="search" placeholder="Rechercher un objet ou un client" aria-label="Rechercher"></div>
    <section class="panel">${rows.length ? `<div class="scroll-x"><table class="data"><thead><tr><th>Objet</th><th>Client</th><th>Statut</th><th>Priorité</th><th>Échéance</th><th>Créée le</th></tr></thead><tbody id="req-rows">
      ${rows.map((x) => `<tr class="click" data-href="#/demandes/${x.id}" data-q="${esc(`${x.subject} ${x.customer_name ?? ''}`.toLowerCase())}"><td><strong>${esc(x.subject)}</strong></td><td>${esc(x.customer_name ?? '—')}</td><td>${chip(STATUS, x.status)}</td><td>${chip(PRIORITY, x.priority)}</td><td>${x.due_at ? dateFr(x.due_at) : '—'}</td><td>${dateFr(x.created_at)}</td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty"><strong>Aucune demande</strong>Les demandes enregistrées apparaîtront ici.</div>'}</section>`;
  $$('[data-filter]').forEach((b) => { b.onclick = () => { location.hash = `#/demandes${b.dataset.filter ? `?statut=${b.dataset.filter}` : ''}`; }; });
  $('#search').oninput = (ev) => { const q = ev.target.value.toLowerCase(); $$('#req-rows tr').forEach((tr) => { tr.hidden = !tr.dataset.q.includes(q); }); };
  if ($('#new-req')) $('#new-req').onclick = newRequestModal;
  if (params.get('nouvelle') === '1' && can('requests.create')) newRequestModal();
}

async function newRequestModal() {
  const customers = can('customers.view') ? (await api('GET', '/api/customers')).body : [];
  const adv = can('priorities.advanced');
  openModal(`<h2>Nouvelle demande</h2>
    <form id="f-req">
      <div class="field"><label for="r-subject">Objet</label><input class="input" id="r-subject" required maxlength="300" placeholder="Ex. : Devis rénovation salle de bain"></div>
      <div class="field"><label for="r-customer">Client</label><select class="input" id="r-customer"><option value="">— Sans client —</option><option value="__new">+ Nouveau client…</option>${customers.map((c) => `<option value="${c.id}">${esc(c.name)}${c.email ? ` (${esc(c.email)})` : ''}</option>`).join('')}</select></div>
      <div id="new-cust" hidden class="grid2"><div class="field"><label for="c-name">Nom du client</label><input class="input" id="c-name"></div><div class="field"><label for="c-email">E-mail du client</label><input class="input" id="c-email" type="email"></div></div>
      <div class="field"><label for="r-body">Message du client</label><textarea class="input" id="r-body" maxlength="20000"></textarea></div>
      <div class="grid2">
        <div class="field"><label for="r-priority">Priorité</label><select class="input" id="r-priority"><option value="normal">Normale</option><option value="high">Haute</option>${adv ? '<option value="urgent">Urgente</option><option value="low">Basse</option>' : ''}</select>${adv ? '' : '<span class="hint">Urgente / basse : <a href="#" data-upsell="priorities.advanced">offre Pro</a></span>'}</div>
        <div class="field"><label for="r-channel">Canal</label><select class="input" id="r-channel"><option value="manual">Saisie</option><option value="email">E-mail</option><option value="phone">Téléphone</option><option value="form">Formulaire</option><option value="other">Autre</option></select></div>
      </div>
      ${adv ? '<div class="field"><label for="r-due">Échéance de traitement</label><input class="input" id="r-due" type="date"></div>' : ''}
      <div id="r-msg"></div>
      <div class="actions"><button class="btn ghost" type="button" data-close>Annuler</button><button class="btn primary" type="submit">Enregistrer</button></div>
    </form>`, (root) => {
    $('#r-customer', root).onchange = (ev) => { $('#new-cust', root).hidden = ev.target.value !== '__new'; };
    $('#f-req', root).onsubmit = async (ev) => {
      ev.preventDefault();
      let customer = $('#r-customer', root).value || null;
      if (customer === '__new') {
        const c = await api('POST', '/api/customers', { name: $('#c-name', root).value, email: $('#c-email', root).value || null });
        if (!c.ok) { $('#r-msg', root).innerHTML = `<p class="msg error">${esc(errMsg(c))}</p>`; return; }
        customer = c.body.id;
      }
      const due = $('#r-due', root)?.value;
      const r = await api('POST', '/api/requests', { subject: $('#r-subject', root).value, body: $('#r-body', root).value, customer_id: customer, priority: $('#r-priority', root).value, channel: $('#r-channel', root).value, due_at: due ? new Date(`${due}T18:00:00`).toISOString() : undefined });
      if (!r.ok) {
        $('#r-msg', root).innerHTML = `<p class="msg error">${esc(errMsg(r))}${r.body.error?.upgrade?.required_plan_name ? ` <a href="#/abonnement" data-close>Voir l'offre ${esc(r.body.error.upgrade.required_plan_name)}</a>` : ''}</p>`;
        return;
      }
      modal.close();
      toast('Demande enregistrée.');
      await refreshEntitlements();
      location.hash = `#/demandes/${r.body.id}`;
    };
  });
}

async function viewRequest(id) {
  const r = await api('GET', `/api/requests/${id}`);
  if (!r.ok) { view.innerHTML = head('Demande') + `<div class="panel"><div class="empty"><strong>Demande introuvable</strong></div></div>`; return; }
  const q = r.body;
  const hist = (await api('GET', `/api/requests/${id}/history`)).body;
  const manage = can('requests.manage');
  const adv = can('priorities.advanced');
  const prioOpts = (adv ? ['urgent', 'high', 'normal', 'low'] : ['high', 'normal']).concat(adv || ['high', 'normal'].includes(q.priority) ? [] : [q.priority]);
  const aiBtn = (kind, perm, label) => (can(perm)
    ? `<button class="btn sm" type="button" data-ai="${kind}">${icon('sparkle', 'ico')} ${label}</button>`
    : `<button class="btn sm" type="button" data-upsell="${perm}">${icon('lock', 'ico')} ${label}</button>`);
  const EVENT = { created: 'Demande créée', status_changed: 'Statut modifié', priority_changed: 'Priorité modifiée', message_outbound: 'Échange sortant', message_inbound: 'Réponse du client', automation_sent: 'Relance automatique envoyée' };
  view.innerHTML = `${head(q.subject, `Créée le ${dateFr(q.created_at)} · ${esc(CHANNEL[q.channel] ?? q.channel)}${q.customer_id ? ` · <a href="#/clients/${q.customer_id}">fiche client</a>` : ''}`, '<a class="btn sm" href="#/demandes">← Retour</a>')}
    <div class="cols"><div>
      <section class="panel"><header><h2>Message du client</h2><div class="row">${chip(STATUS, q.status)} ${chip(PRIORITY, q.priority)}</div></header>
        <div class="body"><p class="prewrap">${esc(q.body) || '<span class="muted">Aucun contenu.</span>'}</p>
        <div class="row">${aiBtn('summary', 'ai.summary', 'Résumer')}${aiBtn('classify', 'ai.classification', 'Classer et prioriser')}${aiBtn('suggest-reply', 'ai.suggestions', 'Suggérer une réponse')}</div>
        <div id="ai-out">${q.ai_summary ? `<div class="ai-box"><span class="tag">Résumé IA</span><p>${esc(q.ai_summary)}</p></div>` : ''}</div></div></section>
      <section class="panel"><header><h2>Échanges</h2></header><div class="body">
        ${q.messages.length ? q.messages.map((m) => `<div class="message ${m.direction === 'inbound' ? 'in' : 'out'}"><div class="meta">${m.direction === 'inbound' ? 'Client' : (m.origin === 'automation' ? 'Relance automatique' : 'Vous')} · ${dateTimeFr(m.created_at)} · ${esc(m.status)}</div>${m.subject ? `<strong>${esc(m.subject)}</strong>` : ''}<div class="prewrap">${esc(m.body)}</div></div>`).join('') : '<p class="muted">Aucun échange enregistré.</p>'}
        ${manage ? `<form id="f-msg" style="margin-top:14px"><div class="field"><label for="m-body">Journaliser un échange</label><textarea class="input" id="m-body" required placeholder="Ex. : appel du client, devis envoyé par e-mail…"></textarea><span class="hint">RELANCEO enregistre l'échange dans l'historique ; il n'envoie pas de message.</span></div>
          <div class="row"><button class="btn sm" type="submit" name="dir" value="outbound">Échange sortant</button><button class="btn sm" type="submit" name="dir" value="inbound">Réponse du client</button></div></form>` : ''}
      </div></section>
    </div><div>
      ${manage ? `<section class="panel"><header><h2>Suivi</h2></header><div class="body">
        <div class="field"><label for="q-status">Statut</label><select class="input" id="q-status">${Object.entries(STATUS).map(([k, [l]]) => `<option value="${k}" ${k === q.status ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label for="q-priority">Priorité</label><select class="input" id="q-priority">${prioOpts.map((k) => `<option value="${k}" ${k === q.priority ? 'selected' : ''}>${PRIORITY[k][0]}</option>`).join('')}</select>${adv ? '' : '<span class="hint">Niveaux urgente/basse et échéance : <a href="#" data-upsell="priorities.advanced">offre Pro</a></span>'}</div>
        ${adv ? `<div class="field"><label for="q-due">Échéance</label><input class="input" id="q-due" type="date" value="${q.due_at ? q.due_at.slice(0, 10) : ''}"></div>` : ''}
        <button class="btn sm primary" type="button" id="save-q">Enregistrer</button></div></section>` : ''}
      <section class="panel"><header><h2>Rappels</h2></header><div class="body">
        <ul class="list">${q.reminders.length ? q.reminders.map((m) => `<li>${m.done_at ? '<s>' : ''}${dateTimeFr(m.due_at)} — ${esc(m.note) || 'Rappel'}${m.done_at ? '</s>' : ` <button class="btn sm" type="button" data-done="${m.id}">Fait</button>`}</li>`).join('') : '<li class="muted">Aucun rappel.</li>'}</ul>
        ${can('reminders.manual') ? `<form id="f-rem" style="margin-top:12px"><div class="field"><label for="rem-date">Date du rappel</label><input class="input" id="rem-date" type="datetime-local" required></div><div class="field"><label for="rem-note">Note</label><input class="input" id="rem-note" maxlength="2000" placeholder="Ex. : rappeler pour le devis"></div><button class="btn sm" type="submit">Ajouter un rappel</button><p class="hint small muted">Rappel pour votre équipe : rien n'est envoyé au client.</p></form>` : ''}
      </div></section>
      <section class="panel"><header><h2>Historique</h2></header><div class="body"><ul class="timeline">${hist.map((h) => `<li><div>${esc(EVENT[h.kind] ?? h.kind)}${h.data?.to ? ` : ${esc((STATUS[h.data.to] ?? PRIORITY[h.data.to] ?? [h.data.to])[0])}` : ''}<small>${dateTimeFr(h.created_at)}</small></div></li>`).join('')}</ul></div></section>
    </div></div>`;
  $$('[data-ai]').forEach((b) => { b.onclick = () => runAi(id, b.dataset.ai, b); });
  if ($('#save-q')) {
    $('#save-q').onclick = async () => {
      const due = $('#q-due')?.value;
      const body = { status: $('#q-status').value, priority: $('#q-priority').value };
      if (adv) body.due_at = due ? new Date(`${due}T18:00:00`).toISOString() : null;
      const res = await api('PATCH', `/api/requests/${id}`, body);
      if (res.ok) { toast('Demande mise à jour.'); viewRequest(id); } else toast(errMsg(res), 'error');
    };
  }
  if ($('#f-msg')) {
    $('#f-msg').onsubmit = async (ev) => {
      ev.preventDefault();
      const res = await api('POST', `/api/requests/${id}/messages`, { direction: ev.submitter?.value ?? 'outbound', body: $('#m-body').value });
      if (res.ok) { toast('Échange enregistré.'); viewRequest(id); } else toast(errMsg(res), 'error');
    };
  }
  if ($('#f-rem')) {
    $('#f-rem').onsubmit = async (ev) => {
      ev.preventDefault();
      const res = await api('POST', `/api/requests/${id}/reminders`, { due_at: new Date($('#rem-date').value).toISOString(), note: $('#rem-note').value });
      if (res.ok) { toast('Rappel ajouté.'); viewRequest(id); } else toast(errMsg(res), 'error');
    };
  }
  $$('[data-done]').forEach((b) => { b.onclick = async () => { await api('PATCH', `/api/reminders/${b.dataset.done}`, { done: true }); viewRequest(id); }; });
}

async function runAi(id, kind, btn) {
  btn.disabled = true;
  const out = $('#ai-out');
  out.innerHTML = '<div class="ai-box"><span class="tag">IA</span><p class="muted">Analyse en cours…</p></div>';
  const r = await api('POST', `/api/requests/${id}/ai/${kind}`);
  btn.disabled = false;
  if (!r.ok) { out.innerHTML = `<div class="ai-box"><p class="msg error">${esc(errMsg(r))}</p></div>`; return; }
  const o = r.body.output;
  const quota = `<p class="small muted">Opérations IA utilisées : ${fmt(r.body.quota.used)} / ${fmt(r.body.quota.limit)}</p>`;
  if (kind === 'summary') out.innerHTML = `<div class="ai-box"><span class="tag">Résumé IA</span><p>${esc(o.summary)}</p>${quota}</div>`;
  if (kind === 'classify') {
    out.innerHTML = `<div class="ai-box"><span class="tag">Proposition IA</span><p>Catégorie : <strong>${esc(o.category)}</strong> · Priorité proposée : ${chip(PRIORITY, o.priority)}</p><p class="small">${esc(o.rationale)}</p>
      <button class="btn sm" type="button" id="apply-cls">Appliquer cette proposition</button>${quota}</div>`;
    $('#apply-cls').onclick = async () => {
      const body = { category: o.category };
      if (can('priorities.advanced') || ['normal', 'high'].includes(o.priority)) body.priority = o.priority;
      const res = await api('PATCH', `/api/requests/${id}`, body);
      if (res.ok) { toast('Proposition appliquée.'); viewRequest(id); } else toast(errMsg(res), 'error');
    };
  }
  if (kind === 'suggest-reply') {
    out.innerHTML = `<div class="ai-box"><span class="tag">Brouillon de réponse — à relire</span><textarea class="input" id="draft">${esc(o.reply)}</textarea>
      <div class="row" style="margin-top:8px"><button class="btn sm" type="button" id="copy-draft">Copier</button></div><p class="small muted">Rien n'est envoyé : copiez la réponse dans votre messagerie après relecture.</p>${quota}</div>`;
    $('#copy-draft').onclick = async () => { await navigator.clipboard.writeText($('#draft').value); toast('Réponse copiée.'); };
  }
  refreshEntitlements();
}

async function viewCustomers() {
  if (!can('customers.view')) { view.innerHTML = head('Clients') + upsellPanel('customers.view'); return; }
  const rows = (await api('GET', '/api/customers')).body;
  view.innerHTML = `${head('Clients', 'Vos fiches clients et leur historique.', can('customers.manage') ? `<button class="btn primary" type="button" id="new-c">${icon('plus', 'ico')} Nouveau client</button>` : '')}
    <section class="panel">${rows.length ? `<div class="scroll-x"><table class="data"><thead><tr><th>Nom</th><th>E-mail</th><th>Téléphone</th><th>Relances</th></tr></thead><tbody>
    ${rows.map((c) => `<tr class="click" data-href="#/clients/${c.id}"><td><strong>${esc(c.name)}</strong></td><td>${esc(c.email ?? '—')}</td><td>${esc(c.phone ?? '—')}</td><td>${c.opted_out_at ? '<span class="chip red">Désinscrit</span>' : '<span class="chip">Accepte</span>'}</td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty"><strong>Aucun client</strong>Ajoutez vos clients pour suivre leurs demandes.</div>'}</section>`;
  if ($('#new-c')) $('#new-c').onclick = () => customerModal();
}

function customerModal(c = null) {
  openModal(`<h2>${c ? 'Modifier le client' : 'Nouveau client'}</h2><form id="f-c">
    <div class="field"><label for="c-n">Nom</label><input class="input" id="c-n" required maxlength="200" value="${esc(c?.name ?? '')}"></div>
    <div class="grid2"><div class="field"><label for="c-e">E-mail</label><input class="input" id="c-e" type="email" value="${esc(c?.email ?? '')}"></div>
    <div class="field"><label for="c-p">Téléphone</label><input class="input" id="c-p" value="${esc(c?.phone ?? '')}"></div></div>
    <div class="field"><label for="c-no">Notes</label><textarea class="input" id="c-no">${esc(c?.notes ?? '')}</textarea></div>
    <div id="c-msg"></div><div class="actions"><button class="btn ghost" type="button" data-close>Annuler</button><button class="btn primary" type="submit">Enregistrer</button></div></form>`, (root) => {
    $('#f-c', root).onsubmit = async (ev) => {
      ev.preventDefault();
      const body = { name: $('#c-n', root).value, email: $('#c-e', root).value || null, phone: $('#c-p', root).value || null, notes: $('#c-no', root).value || null };
      const r = c ? await api('PATCH', `/api/customers/${c.id}`, body) : await api('POST', '/api/customers', body);
      if (!r.ok) { $('#c-msg', root).innerHTML = `<p class="msg error">${esc(errMsg(r))}</p>`; return; }
      modal.close(); toast('Client enregistré.'); route();
    };
  });
}

async function viewCustomer(id) {
  const r = await api('GET', `/api/customers/${id}`);
  if (!r.ok) { view.innerHTML = head('Client') + '<div class="panel"><div class="empty"><strong>Client introuvable</strong></div></div>'; return; }
  const c = r.body;
  view.innerHTML = `${head(c.name, [c.email, c.phone].filter(Boolean).map(esc).join(' · '), `<a class="btn sm" href="#/clients">← Retour</a>${can('customers.manage') ? '<button class="btn sm" type="button" id="edit-c">Modifier</button>' : ''}`)}
    ${c.opted_out_at ? `<div class="banner warn">Ce client s'est désinscrit des relances automatiques le ${dateFr(c.opted_out_at)}.</div>` : ''}
    ${c.notes ? `<section class="panel"><header><h2>Notes</h2></header><div class="body prewrap">${esc(c.notes)}</div></section>` : ''}
    <section class="panel"><header><h2>Demandes</h2></header>${c.requests.length ? `<div class="scroll-x"><table class="data"><tbody>${c.requests.map((q) => `<tr class="click" data-href="#/demandes/${q.id}"><td><strong>${esc(q.subject)}</strong></td><td>${chip(STATUS, q.status)}</td><td>${dateFr(q.created_at)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Aucune demande.</div>'}</section>`;
  if ($('#edit-c')) $('#edit-c').onclick = () => customerModal(c);
}

async function viewTemplates() {
  if (!can('templates.manage')) { view.innerHTML = head('Modèles de réponses') + upsellPanel('templates.manage'); return; }
  const rows = (await api('GET', '/api/templates')).body;
  const admin = ['owner', 'admin'].includes(S.ent.role);
  view.innerHTML = `${head('Modèles de réponses', 'Vos réponses fréquentes. Variables : {{customer.name}}, {{request.subject}}, {{company.name}}.', `<button class="btn primary" type="button" id="new-t">${icon('plus', 'ico')} Nouveau modèle</button>`)}
    <section class="panel">${rows.length ? `<div class="scroll-x"><table class="data"><thead><tr><th>Nom</th><th>Objet</th><th>Statut</th><th></th></tr></thead><tbody>
    ${rows.map((t) => `<tr><td><strong>${esc(t.name)}</strong></td><td>${esc(t.subject || '—')}</td><td>${t.status === 'approved' ? '<span class="chip green">Validé</span>' : '<span class="chip amber">Brouillon</span>'}</td>
      <td class="row"><button class="btn sm" type="button" data-edit="${t.id}">Modifier</button>${t.status !== 'approved' && admin ? `<button class="btn sm" type="button" data-approve="${t.id}">Valider</button>` : ''}</td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty"><strong>Aucun modèle</strong>Créez votre premier modèle de réponse.</div>'}</section>
    <p class="small muted">Un modèle modifié repasse en brouillon et doit être revalidé avant d'être utilisé par une automatisation.</p>`;
  const tplModal = (t = null) => openModal(`<h2>${t ? 'Modifier le modèle' : 'Nouveau modèle'}</h2><form id="f-t">
      <div class="field"><label for="t-n">Nom</label><input class="input" id="t-n" required maxlength="120" value="${esc(t?.name ?? '')}"></div>
      <div class="field"><label for="t-s">Objet de l'e-mail</label><input class="input" id="t-s" maxlength="300" value="${esc(t?.subject ?? '')}"></div>
      <div class="field"><label for="t-b">Contenu</label><textarea class="input" id="t-b" required style="min-height:180px">${esc(t?.body ?? 'Bonjour {{customer.name}},\n\n')}</textarea></div>
      <div id="t-msg"></div><div class="actions"><button class="btn ghost" type="button" data-close>Annuler</button><button class="btn primary" type="submit">Enregistrer</button></div></form>`, (root) => {
    $('#f-t', root).onsubmit = async (ev) => {
      ev.preventDefault();
      const body = { name: $('#t-n', root).value, subject: $('#t-s', root).value, body: $('#t-b', root).value };
      const r = t ? await api('PATCH', `/api/templates/${t.id}`, body) : await api('POST', '/api/templates', body);
      if (!r.ok) { $('#t-msg', root).innerHTML = `<p class="msg error">${esc(errMsg(r))}</p>`; return; }
      modal.close(); toast('Modèle enregistré.'); route();
    };
  });
  $('#new-t').onclick = () => tplModal();
  $$('[data-edit]').forEach((b) => { b.onclick = () => tplModal(rows.find((t) => t.id === b.dataset.edit)); });
  $$('[data-approve]').forEach((b) => { b.onclick = async () => { const r = await api('POST', `/api/templates/${b.dataset.approve}/approve`); if (r.ok) { toast('Modèle validé.'); route(); } else toast(errMsg(r), 'error'); }; });
}

async function viewAutomations() {
  if (!can('automations.view')) { view.innerHTML = head('Automatisations de relances') + upsellPanel('automations.create'); return; }
  const [a, jobs, tpls] = await Promise.all([api('GET', '/api/automations'), api('GET', '/api/automations/jobs'), can('templates.manage') ? api('GET', '/api/templates') : { body: [] }]);
  const d = a.body;
  const canEdit = can('automations.create');
  const approved = tpls.body.filter((t) => t.status === 'approved');
  const RULE = { draft: ['Brouillon', 'amber'], active: ['Active', 'green'], paused: ['En pause', ''], paused_by_plan: ['En pause (offre)', 'red'] };
  const JOB = { pending: ['Planifiée', 'blue'], sending: ['Envoi…', 'blue'], sent: ['Envoyée', 'green'], failed: ['Échec', 'red'], skipped: ['Ignorée', ''], canceled: ['Annulée', ''], needs_review: ['À vérifier', 'amber'] };
  const REASON = { customer_replied: 'le client a répondu', request_closed: 'demande clôturée', customer_opted_out: 'client désinscrit', tenant_paused: 'pause d\'urgence', plan_or_subscription: 'abonnement', monthly_send_quota_reached: 'quota mensuel atteint', frequency_limited: 'limite de fréquence', hourly_cap: 'plafond horaire', conditions_not_met: 'conditions non remplies', no_email: 'pas d\'e-mail client' };
  const ready = d.globally_enabled && d.email_provider_configured;
  view.innerHTML = `${head('Automatisations de relances', 'Relancez automatiquement les clients qui n\'ont pas répondu. Les relances s\'arrêtent dès qu\'ils répondent.', canEdit ? `<button class="btn primary" type="button" id="new-rule">${icon('plus', 'ico')} Nouvelle règle</button>` : '')}
    ${ready ? '' : '<div class="banner warn"><div class="grow"><strong>Envoi automatique pas encore activé sur ce service.</strong> Vous pouvez préparer vos règles ; aucun message ne partira tant que l\'envoi d\'e-mails n\'est pas configuré par RELANCEO.</div></div>'}
    <div class="banner ${d.settings?.automations_paused ? 'danger' : 'ok'}"><div class="grow">${d.settings?.automations_paused ? '<strong>Toutes les relances sont en pause.</strong> Aucun message ne sera envoyé.' : 'Les règles actives s\'exécutent automatiquement. Vous pouvez tout arrêter à tout moment.'}</div>
      ${['owner', 'admin'].includes(S.ent.role) ? `<button class="btn sm ${d.settings?.automations_paused ? 'primary' : 'danger'}" type="button" id="pause-all">${d.settings?.automations_paused ? 'Reprendre' : 'Tout mettre en pause'}</button>` : ''}</div>
    <section class="panel"><header><h2>Règles</h2><span class="small muted">${fmt(S.ent.usage.automation_rules_active ?? 0)} / ${fmt(S.ent.limits.automation_rules_active ?? 0)} actives</span></header>
      ${d.rules.length ? `<div class="scroll-x"><table class="data"><thead><tr><th>Règle</th><th>Délai</th><th>Tentatives</th><th>Statut</th><th></th></tr></thead><tbody>
      ${d.rules.map((r) => `<tr><td><strong>${esc(r.name)}</strong><br><small class="muted">Demandes : ${(r.conditions.statuses ?? []).map((s) => STATUS[s]?.[0] ?? s).join(', ')}</small></td><td>${r.delay_hours % 24 === 0 ? `${r.delay_hours / 24} j` : `${r.delay_hours} h`}</td><td>${r.max_attempts}</td><td>${chip(RULE, r.status)}</td>
        <td class="row">${canEdit && r.status !== 'active' ? `<button class="btn sm primary" type="button" data-activate="${r.id}">Activer</button>` : ''}${canEdit && r.status === 'active' ? `<button class="btn sm" type="button" data-pause="${r.id}">Pause</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty"><strong>Aucune règle</strong>Exemple : relancer 2 jours après un devis resté sans réponse.</div>'}</section>
    <section class="panel"><header><h2>Historique des relances</h2></header>
      ${jobs.body.length ? `<div class="scroll-x"><table class="data"><thead><tr><th>Prévue le</th><th>Tentative</th><th>Statut</th><th>Détail</th><th></th></tr></thead><tbody>
      ${jobs.body.slice(0, 100).map((j) => `<tr><td>${dateTimeFr(j.scheduled_for)}</td><td>${j.attempt}</td><td>${chip(JOB, j.status)}</td><td class="small">${esc(REASON[j.reason] ?? j.reason ?? (j.sent_at ? `envoyée le ${dateTimeFr(j.sent_at)}` : ''))}${j.last_error ? ` · ${esc(j.last_error)}` : ''}</td><td><a class="btn sm" href="#/demandes/${j.request_id}">Demande</a></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">Aucune relance pour le moment.</div>'}</section>`;
  if ($('#pause-all')) $('#pause-all').onclick = async () => { const r = await api('POST', '/api/automations/pause-all', { paused: !d.settings?.automations_paused }); if (r.ok) route(); else toast(errMsg(r), 'error'); };
  $$('[data-pause]').forEach((b) => { b.onclick = async () => { const r = await api('POST', `/api/automations/${b.dataset.pause}/pause`); if (r.ok) { toast('Règle mise en pause.'); await refreshEntitlements(); route(); } else toast(errMsg(r), 'error'); }; });
  $$('[data-activate]').forEach((b) => {
    b.onclick = () => openModal(`<h2>Activer la règle</h2>
      <p>Des e-mails seront envoyés automatiquement à vos clients selon cette règle, avec un lien de désinscription. Les envois s'arrêtent dès que le client répond, que la demande est clôturée ou que vous mettez en pause.</p>
      <label class="check"><input type="checkbox" id="consent"><span>Au nom de mon entreprise, j'autorise l'envoi automatique de ces relances à nos clients, qui nous ont adressé une demande, et je confirme que ces envois respectent les règles applicables aux communications électroniques.</span></label>
      <div id="a-msg"></div><div class="actions"><button class="btn ghost" type="button" data-close>Annuler</button><button class="btn primary" type="button" id="do-activate">Activer</button></div>`, (root) => {
      $('#do-activate', root).onclick = async () => {
        if (!$('#consent', root).checked) { $('#a-msg', root).innerHTML = '<p class="msg error">Cochez l\'autorisation pour activer.</p>'; return; }
        const r = await api('POST', `/api/automations/${b.dataset.activate}/activate`, { confirm_authorization: true });
        if (!r.ok) { $('#a-msg', root).innerHTML = `<p class="msg error">${esc(errMsg(r))}</p>`; return; }
        modal.close(); toast('Règle activée.'); await refreshEntitlements(); route();
      };
    });
  });
  if ($('#new-rule')) {
    $('#new-rule').onclick = () => openModal(`<h2>Nouvelle règle de relance</h2><form id="f-rule">
      <div class="field"><label for="ru-n">Nom</label><input class="input" id="ru-n" required maxlength="120" placeholder="Ex. : Relance devis sans réponse"></div>
      <div class="field"><label for="ru-t">Message envoyé (modèle validé)</label><select class="input" id="ru-t" required>${approved.length ? approved.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('') : '<option value="">Aucun modèle validé</option>'}</select>${approved.length ? '' : '<span class="hint">Créez et validez d\'abord un modèle dans <a href="#/modeles" data-close>Modèles</a>.</span>'}</div>
      <div class="grid2"><div class="field"><label for="ru-d">Relancer après (jours sans réponse)</label><input class="input" id="ru-d" type="number" min="1" max="30" value="2" required></div>
      <div class="field"><label for="ru-a">Nombre maximum de relances</label><input class="input" id="ru-a" type="number" min="1" max="5" value="2" required></div></div>
      <div class="field"><span class="label">Pour les demandes au statut</span>${['waiting_customer', 'new', 'in_progress'].map((s) => `<label class="check"><input type="checkbox" name="st" value="${s}" ${s === 'waiting_customer' ? 'checked' : ''}><span>${STATUS[s][0]}</span></label>`).join('')}</div>
      <p class="small muted">La règle est créée en brouillon : vous l'activerez ensuite explicitement.</p>
      <div id="ru-msg"></div><div class="actions"><button class="btn ghost" type="button" data-close>Annuler</button><button class="btn primary" type="submit">Créer</button></div></form>`, (root) => {
      $('#f-rule', root).onsubmit = async (ev) => {
        ev.preventDefault();
        const statuses = $$('input[name=st]:checked', root).map((i) => i.value);
        const r = await api('POST', '/api/automations', { name: $('#ru-n', root).value, template_id: $('#ru-t', root).value || null, delay_hours: Number($('#ru-d', root).value) * 24, max_attempts: Number($('#ru-a', root).value), conditions: { statuses } });
        if (!r.ok) { $('#ru-msg', root).innerHTML = `<p class="msg error">${esc(errMsg(r))}</p>`; return; }
        modal.close(); toast('Règle créée en brouillon.'); route();
      };
    });
  }
}

async function viewTeam() {
  const r = await api('GET', '/api/team');
  if (!r.ok) { view.innerHTML = head('Équipe') + upsellPanel('team.view'); return; }
  const t = r.body;
  const manage = can('team.manage');
  const ROLE = { owner: 'Propriétaire', admin: 'Administrateur', member: 'Membre' };
  view.innerHTML = `${head('Équipe', `${fmt(t.seats.used)} place(s) utilisée(s) sur ${fmt(t.seats.limit)}.`, can('team.invite') ? `<button class="btn primary" type="button" id="invite">${icon('plus', 'ico')} Inviter</button>` : (lockedBy('team.invite') ? `<button class="btn" type="button" data-upsell="team.invite">${icon('lock', 'ico')} Inviter</button>` : ''))}
    <section class="panel"><div class="scroll-x"><table class="data"><thead><tr><th>Personne</th><th>Rôle</th><th>Statut</th><th></th></tr></thead><tbody>
    ${t.members.map((m) => `<tr><td><strong>${esc(m.display_name ?? m.email)}</strong><br><small class="muted">${esc(m.email)}</small></td>
      <td>${manage && m.role !== 'owner' ? `<select class="input" data-role="${m.id}" aria-label="Rôle">${['admin', 'member'].map((ro) => `<option value="${ro}" ${ro === m.role ? 'selected' : ''}>${ROLE[ro]}</option>`).join('')}</select>` : ROLE[m.role]}</td>
      <td>${m.status === 'active' ? '<span class="chip green">Actif</span>' : '<span class="chip amber">Suspendu (limite de l\'offre)</span>'}</td>
      <td class="row">${manage && m.role !== 'owner' ? `${m.status !== 'active' ? `<button class="btn sm" type="button" data-react="${m.id}">Réactiver</button>` : ''}<button class="btn sm danger" type="button" data-remove="${m.id}">Retirer</button>` : ''}</td></tr>`).join('')}
    ${t.invitations.map((i) => `<tr><td><strong>${esc(i.email)}</strong><br><small class="muted">Invitation jusqu'au ${dateFr(i.expires_at)}</small></td><td>${ROLE[i.role]}</td><td><span class="chip blue">${i.status === 'pending' ? 'Invité' : 'Suspendue'}</span></td><td>${manage ? `<button class="btn sm" type="button" data-revoke="${i.id}">Annuler</button>` : ''}</td></tr>`).join('')}
    </tbody></table></div></section>`;
  if ($('#invite')) {
    $('#invite').onclick = () => openModal(`<h2>Inviter un collaborateur</h2><form id="f-inv">
      <div class="field"><label for="i-e">E-mail</label><input class="input" id="i-e" type="email" required></div>
      <div class="field"><label for="i-r">Rôle</label><select class="input" id="i-r"><option value="member">Membre — traite les demandes</option><option value="admin">Administrateur — gère aussi l'équipe et les automatisations</option></select></div>
      <div id="i-msg"></div><div class="actions"><button class="btn ghost" type="button" data-close>Fermer</button><button class="btn primary" type="submit">Envoyer l'invitation</button></div></form>`, (root) => {
      $('#f-inv', root).onsubmit = async (ev) => {
        ev.preventDefault();
        const res = await api('POST', '/api/team/invitations', { email: $('#i-e', root).value, role: $('#i-r', root).value });
        if (!res.ok) { $('#i-msg', root).innerHTML = `<p class="msg error">${esc(errMsg(res))}</p>`; return; }
        $('#i-msg', root).innerHTML = res.body.email_sent
          ? '<p class="msg">Invitation envoyée par e-mail.</p>'
          : `<p class="msg">E-mail non envoyé automatiquement. Transmettez ce lien à la personne invitée (il ne fonctionne que pour son adresse) :<br><input class="input" readonly value="${esc(res.body.link)}"></p>`;
        await refreshEntitlements();
      };
    });
    modal.addEventListener('close', () => { if (location.hash.startsWith('#/equipe')) route(); }, { once: true });
  }
  $$('[data-role]').forEach((s) => { s.onchange = async () => { const res = await api('PATCH', `/api/team/${s.dataset.role}`, { role: s.value }); toast(res.ok ? 'Rôle modifié.' : errMsg(res), res.ok ? '' : 'error'); }; });
  $$('[data-remove]').forEach((b) => { b.onclick = async () => { if (!confirm('Retirer cette personne de l\'équipe ? Elle perdra immédiatement l\'accès.')) return; const res = await api('PATCH', `/api/team/${b.dataset.remove}`, { status: 'removed' }); if (res.ok) { await refreshEntitlements(); route(); } else toast(errMsg(res), 'error'); }; });
  $$('[data-react]').forEach((b) => { b.onclick = async () => { const res = await api('POST', `/api/team/${b.dataset.react}/reactivate`); if (res.ok) { await refreshEntitlements(); route(); } else toast(errMsg(res), 'error'); }; });
  $$('[data-revoke]').forEach((b) => { b.onclick = async () => { const res = await api('POST', `/api/team/invitations/${b.dataset.revoke}/revoke`); if (res.ok) { await refreshEntitlements(); route(); } else toast(errMsg(res), 'error'); }; });
}

async function viewStats() {
  if (!can('statistics.basic')) { view.innerHTML = head('Statistiques') + upsellPanel('statistics.basic'); return; }
  const b = (await api('GET', '/api/stats/basic')).body;
  const count = Object.values(b.by_status).reduce((x, y) => x + y, 0);
  const total = count || 1;
  const bars = (items) => `<div class="bars">${items.map(([l, n, max]) => `<div class="b"><span>${esc(l)}</span><div class="track"><div class="fill" style="width:${Math.round((100 * n) / (max || 1))}%"></div></div><strong>${fmt(n)}</strong></div>`).join('')}</div>`;
  let adv = upsellPanel('statistics.advanced');
  if (can('statistics.advanced')) {
    const a = (await api('GET', '/api/stats/advanced')).body;
    const maxW = Math.max(1, ...a.weekly.map((w) => w.created));
    adv = `<div class="kpis"><div class="kpi-card"><div class="label">1re réponse (moyenne)</div><div class="value">${a.avg_first_response_hours == null ? '—' : `${fmt(a.avg_first_response_hours)} h`}</div></div>
      <div class="kpi-card"><div class="label">Taux de clôture</div><div class="value">${a.closure_rate_pct == null ? '—' : `${fmt(a.closure_rate_pct)} %`}</div></div></div>
      <div class="cols"><section class="panel"><header><h2>Demandes créées par semaine</h2></header><div class="body">${a.weekly.length ? bars(a.weekly.map((w) => [`Sem. du ${new Date(w.week).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`, w.created, maxW])) : '<p class="muted">Pas encore de données.</p>'}</div></section>
      <section class="panel"><header><h2>Par priorité</h2></header><div class="body">${bars(a.by_priority.map((p) => [PRIORITY[p.priority]?.[0] ?? p.priority, p.n, total]))}</div></section></div>`;
  }
  view.innerHTML = `${head('Statistiques', 'Le suivi de vos demandes en un coup d\'œil.')}
    <div class="kpis"><div class="kpi-card"><div class="label">Créées ce mois</div><div class="value">${fmt(b.period.created)}</div></div>
    <div class="kpi-card"><div class="label">Clôturées ce mois</div><div class="value">${fmt(b.period.closed)}</div></div>
    <div class="kpi-card"><div class="label">Rappels échus</div><div class="value">${fmt(b.reminders_due)}</div></div>
    <div class="kpi-card"><div class="label">Total</div><div class="value">${fmt(count)}</div></div></div>
    <section class="panel"><header><h2>Par statut</h2></header><div class="body">${bars(Object.entries(STATUS).map(([k, [l]]) => [l, b.by_status[k] ?? 0, total]))}</div></section>
    <h2 class="section" style="margin-top:28px">Statistiques avancées</h2>${adv}`;
}

async function viewBilling(params) {
  const e = S.ent;
  const billing = (await api('GET', '/api/billing')).body;
  const plans = S.catalog.plans;
  const needsCheckout = ['none', 'canceled', 'incomplete'].includes(e.status);
  const manage = can('billing.manage');
  const [sl, sc] = SUB_STATUS[e.status] ?? [e.status, ''];
  let notice = '';
  if (params.get('paiement') === 'confirmation') notice = '<div class="banner ok" id="pay-wait"><div class="grow"><strong>Merci !</strong> Nous attendons la confirmation de votre paiement par Stripe ; votre offre s\'active automatiquement dans quelques secondes.</div></div>';
  if (params.get('paiement') === 'annule') notice = '<div class="banner warn">Paiement annulé : aucun prélèvement n\'a été effectué.</div>';
  if (!billing.billing_enabled) notice += '<div class="banner warn"><div class="grow"><strong>Paiement en ligne pas encore ouvert.</strong> Aucun prélèvement ne peut être effectué pour le moment.</div></div>';
  const card = (p) => {
    const current = p.id === e.plan_id && !needsCheckout;
    const scheduled = e.scheduled_plan_id === p.id;
    let action = '';
    if (!manage) action = '';
    else if (current) action = '<span class="chip green">Offre actuelle</span>';
    else if (scheduled) action = `<span class="chip amber">Prévue le ${dateFr(e.renewal_date)}</span>`;
    else if (needsCheckout) action = `<button class="btn ${p.highlight ? 'primary' : ''}" type="button" data-checkout="${p.id}">Choisir ${esc(p.name)}</button>`;
    else action = `<button class="btn ${p.price_cents > (plans.find((x) => x.id === e.plan_id)?.price_cents ?? 0) ? 'primary' : ''}" type="button" data-change="${p.id}">${p.price_cents > (plans.find((x) => x.id === e.plan_id)?.price_cents ?? 0) ? 'Passer à' : 'Rétrograder vers'} ${esc(p.name)}</button>`;
    return `<article class="plan ${current ? 'current' : ''} ${p.highlight && !current ? 'highlight' : ''}"><h2>${esc(p.name)}</h2><p class="tagline">${esc(p.tagline)}</p>
      <div class="price"><span class="amount">${esc(p.price_label)}</span><span class="per">/ mois</span></div>
      <ul><li class="limit"><span></span><span>${fmt(p.limits.requests_monthly)} demandes / mois · ${p.limits.seats} collaborateur${p.limits.seats > 1 ? 's' : ''}</span></li>
      <li class="limit"><span></span><span>${p.limits.ai_operations_monthly ? `${fmt(p.limits.ai_operations_monthly)} opérations IA / mois` : 'Sans IA'}</span></li>
      <li class="limit"><span></span><span>${p.limits.automation_sends_monthly ? `${fmt(p.limits.automation_sends_monthly)} relances automatiques / mois` : 'Sans relance automatique'}</span></li></ul>${action}</article>`;
  };
  view.innerHTML = `${head('Abonnement', 'Votre offre, votre consommation et vos factures.')}${notice}
    <div class="cols"><section class="panel"><header><h2>Offre actuelle</h2><span class="chip ${sc}">${esc(sl)}</span></header><div class="body">
      <div class="kpi" style="font-size:1.6rem;font-weight:800">${esc(e.plan?.name && !needsCheckout ? `${e.plan.name} — ${euros(e.plan.price_cents)} / mois` : 'Aucune offre active')}</div>
      ${!needsCheckout ? `<p class="muted">${e.cancel_at_period_end ? `Se termine le <strong>${dateFr(e.renewal_date)}</strong> (résiliation programmée).` : `Prochain renouvellement : <strong>${dateFr(e.renewal_date)}</strong>.`}</p>` : '<p class="muted">Choisissez une offre ci-dessous. Paiement sécurisé par Stripe, sans engagement, résiliable à tout moment pour la fin du mois en cours.</p>'}
      ${e.scheduled_plan_id ? `<p class="banner info">Passage à l'offre ${esc(plans.find((p) => p.id === e.scheduled_plan_id)?.name)} prévu le ${dateFr(e.renewal_date)}.</p>` : ''}
      <div class="row">${manage && billing.billing_enabled && !needsCheckout ? '<button class="btn" type="button" data-portal>Moyen de paiement et factures</button>' : ''}
      ${manage && !needsCheckout && billing.billing_enabled ? (e.cancel_at_period_end ? '<button class="btn primary" type="button" id="resume">Annuler la résiliation</button>' : '<button class="btn danger" type="button" id="cancel">Résilier</button>') : ''}
      ${can('data.export') ? '<button class="btn" type="button" id="export">Exporter mes données</button>' : ''}</div></div></section>
    <section class="panel"><header><h2>Consommation de la période</h2></header><div class="body">${meters() || '<p class="muted">Aucune consommation.</p>'}<p class="small muted">Du ${dateFr(e.current_period_start)} au ${dateFr(e.current_period_end)}. Alertes à 70 %, 85 % et 100 %.</p></div></section></div>
    <h2 class="section">${needsCheckout ? 'Choisissez votre offre' : 'Changer d\'offre'}</h2>
    <div class="plan-pick">${plans.map(card).join('')}</div>
    <p class="small muted" style="margin-top:14px">${esc(S.catalog.commercial.price_tax_note)} Montée en gamme : active dès la confirmation du paiement. Rétrogradation : à la fin de la période en cours. Aucune donnée n'est supprimée lors d'un changement d'offre.</p>`;

  $$('[data-checkout]').forEach((b) => { b.onclick = async () => {
    b.disabled = true;
    const r = await api('POST', '/api/billing/checkout', { plan: b.dataset.checkout });
    b.disabled = false;
    if (r.ok && r.body.checkout_url) location.href = r.body.checkout_url; else toast(errMsg(r), 'error');
  }; });
  $$('[data-change]').forEach((b) => { b.onclick = async () => {
    const pv = await api('GET', `/api/billing/preview?plan=${b.dataset.change}`);
    if (!pv.ok) { toast(errMsg(pv), 'error'); return; }
    const p = pv.body;
    openModal(`<h2>${p.kind === 'upgrade' ? 'Passer à' : 'Rétrograder vers'} ${esc(plans.find((x) => x.id === p.to).name)}</h2>
      <p><strong>${euros(p.price_from_cents)} → ${euros(p.price_to_cents)} / mois.</strong> ${esc(p.effective)}</p>
      ${p.gained_permissions.length ? `<p>Vous gagnez :</p><ul>${p.gained_permissions.map((x) => `<li>${esc(x.label)}</li>`).join('')}</ul>` : ''}
      ${p.lost_permissions.length ? `<p>Ne sera plus disponible :</p><ul>${p.lost_permissions.map((x) => `<li>${esc(x.label)}</li>`).join('')}</ul>` : ''}
      ${p.warnings.length ? `<div class="banner warn"><div class="grow">${p.warnings.map(esc).join('<br>')}</div></div>` : ''}
      <p class="small muted">${esc(p.data_policy)}</p><div id="ch-msg"></div>
      <div class="actions"><button class="btn ghost" type="button" data-close>Annuler</button><button class="btn primary" type="button" id="do-change">Confirmer</button></div>`, (root) => {
      $('#do-change', root).onclick = async () => {
        const r = await api('POST', '/api/billing/change-plan', { plan: p.to });
        if (r.status === 202) { modal.close(); toast(r.body.message); if (r.body.checkout_url) location.href = r.body.checkout_url; return; }
        $('#ch-msg', root).innerHTML = `<p class="msg error">${esc(errMsg(r))}</p>`;
      };
    });
  }; });
  if ($('#cancel')) $('#cancel').onclick = () => openModal(`<h2>Résilier l'abonnement</h2><p>Votre offre reste active jusqu'au <strong>${dateFr(e.renewal_date)}</strong>. Ensuite, votre espace passe en lecture seule : vos données sont conservées et exportables, et vous pourrez vous réabonner.</p>
      <div id="cc-msg"></div><div class="actions"><button class="btn ghost" type="button" data-close>Garder mon abonnement</button><button class="btn danger" type="button" id="do-cancel">Résilier</button></div>`, (root) => {
    $('#do-cancel', root).onclick = async () => { const r = await api('POST', '/api/billing/cancel'); if (r.ok) { modal.close(); toast(r.body.message); } else $('#cc-msg', root).innerHTML = `<p class="msg error">${esc(errMsg(r))}</p>`; };
  });
  if ($('#resume')) $('#resume').onclick = async () => { const r = await api('POST', '/api/billing/resume'); toast(r.ok ? r.body.message : errMsg(r), r.ok ? '' : 'error'); };
  if ($('#export')) $('#export').onclick = async () => {
    const r = await api('GET', '/api/export');
    const blob = new Blob([JSON.stringify(r.body, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `relanceo-export-${new Date().toISOString().slice(0, 10)}.json` });
    a.click(); URL.revokeObjectURL(a.href);
  };
  const wanted = params.get('offre');
  if (wanted && needsCheckout && manage) $(`[data-checkout="${wanted}"]`)?.focus();
  if (params.get('paiement') === 'confirmation') waitForActivation();
}

async function waitForActivation() {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    await refreshEntitlements();
    if (S.ent.status === 'active') { toast(`Offre ${S.ent.plan.name} activée. Bienvenue !`); location.hash = '#/'; return; }
  }
  const w = $('#pay-wait');
  if (w) w.innerHTML = '<div class="grow">La confirmation tarde. Si vous avez bien payé, votre offre s\'activera dès réception par Stripe ; vous pouvez actualiser la page dans quelques minutes.</div>';
}

async function viewAccount() {
  view.innerHTML = `${head('Mon compte', esc(S.me.user.email))}
    <section class="panel" style="max-width:560px"><header><h2>Changer de mot de passe</h2></header><div class="body"><form id="f-pw">
      <div class="field"><label for="pw-c">Mot de passe actuel</label><input class="input" id="pw-c" type="password" autocomplete="current-password" required></div>
      <div class="field"><label for="pw-n">Nouveau mot de passe</label><input class="input" id="pw-n" type="password" autocomplete="new-password" minlength="10" required><span class="hint">10 caractères minimum. Vos autres appareils seront déconnectés.</span></div>
      <div id="pw-msg"></div><button class="btn primary" type="submit">Mettre à jour</button></form></div></section>
    <section class="panel" style="max-width:560px"><header><h2>Mes données</h2></header><div class="body"><p class="muted small">Pour toute demande relative à vos données personnelles, consultez la <a href="/confidentialite.html">politique de confidentialité</a>.</p></div></section>`;
  $('#f-pw').onsubmit = async (ev) => {
    ev.preventDefault();
    const r = await api('POST', '/api/auth/password', { current: $('#pw-c').value, password: $('#pw-n').value });
    $('#pw-msg').innerHTML = `<p class="msg ${r.ok ? '' : 'error'}">${esc(r.ok ? 'Mot de passe modifié.' : errMsg(r))}</p>`;
    if (r.ok) ev.target.reset();
  };
}

async function viewJoin(params) {
  const r = await api('POST', '/api/invitations/accept', { token: params.get('token') });
  if (r.ok) { toast('Vous avez rejoint l\'équipe.'); location.href = '/app.html'; return; }
  view.innerHTML = `<div class="panel"><div class="empty"><strong>Invitation impossible à accepter</strong>${esc(errMsg(r))}</div></div>`;
}

// ------------------------------------------------------------------ routeur
async function refreshEntitlements() {
  const r = await api('GET', '/api/entitlements');
  if (r.ok) S.ent = r.body;
  return S.ent;
}

async function route() {
  const [path, qs] = location.hash.replace(/^#\/?/, '').split('?');
  const params = new URLSearchParams(qs ?? '');
  const [section, id] = path.split('/');
  $('#side').classList.remove('open');
  renderSide(section ?? '');
  try {
    if (section === 'rejoindre') return await viewJoin(params);
    if (section === 'demandes' && id) return await viewRequest(id);
    if (section === 'clients' && id) return await viewCustomer(id);
    const views = { '': viewDashboard, demandes: viewRequests, clients: viewCustomers, modeles: viewTemplates, automatisations: viewAutomations, equipe: viewTeam, statistiques: viewStats, abonnement: viewBilling, compte: viewAccount };
    await (views[section] ?? viewDashboard)(params);
  } catch (err) {
    if (err.message !== 'unauthenticated') view.innerHTML = '<div class="banner danger">Impossible de charger cette page. Vérifiez votre connexion puis réessayez.</div>';
  }
  view.focus({ preventScroll: true });
}

view.addEventListener('click', (ev) => {
  const tr = ev.target.closest('tr[data-href]');
  if (tr && !ev.target.closest('a,button,select,input')) location.hash = tr.dataset.href;
});
window.addEventListener('hashchange', route);

(async function boot() {
  const me = await api('GET', '/api/me');
  if (!me.body.memberships?.length) {
    view.innerHTML = '<div class="panel"><div class="empty"><strong>Aucun espace actif</strong>Votre accès a peut-être été retiré. Contactez l\'administrateur de votre entreprise.</div></div>';
    return;
  }
  // Plusieurs entreprises : la première est utilisée (le serveur vérifie l'appartenance à chaque requête).
  if (me.body.memberships.length > 1) S.tenantId = me.body.memberships[0].tenant_id;
  S.me = { user: me.body.user, company: me.body.memberships[0].name };
  const [, catalog] = await Promise.all([refreshEntitlements(), fetch('/api/plans').then((r) => r.json())]);
  S.catalog = catalog;
  route();
})();
