// Tableau de bord du propriétaire de RELANCEO : revenu mensuel, abonnés, prospects, alertes.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const euros = (c) => `${(c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const d = (x) => (x ? new Date(x).toLocaleDateString('fr-FR') : '—');
const main = document.getElementById('main');
const LEAD = { new: ['Nouveau', 'blue'], contacted: ['Contacté', 'amber'], won: ['Gagné', 'green'], lost: ['Perdu', ''] };

async function load() {
  const r = await fetch('/api/admin/overview', { credentials: 'same-origin' });
  if (r.status === 401) { location.href = '/connexion.html?suite=/admin.html'; return; }
  const o = await r.json();
  if (!r.ok) { main.innerHTML = `<div class="banner danger">${esc(o.error?.message)}</div>`; return; }
  const goal = 1000000;
  const active = o.subscriptions.filter((s) => s.status === 'active').reduce((a, s) => a + s.n, 0);
  const byPlan = (p) => o.subscriptions.filter((s) => s.plan_id === p && s.status === 'active').reduce((a, s) => a + s.n, 0);
  main.innerHTML = `
    <div class="page-head"><div><h1>Pilotage</h1><p>Vue d'ensemble de votre activité RELANCEO.</p></div></div>
    <div class="kpis">
      <div class="kpi-card"><div class="label">Revenu mensuel récurrent</div><div class="value">${euros(o.mrr_cents)}</div><div class="small muted">abonnements payants Stripe</div></div>
      <div class="kpi-card"><div class="label">Abonnés actifs</div><div class="value">${active}</div><div class="small muted">Starter ${byPlan('starter')} · Pro ${byPlan('pro')} · Business ${byPlan('business')}</div></div>
      <div class="kpi-card"><div class="label">Inscriptions (30 j)</div><div class="value">${o.signups_30d}</div></div>
      <div class="kpi-card"><div class="label">Prospects à traiter</div><div class="value">${o.leads.filter((l) => l.status === 'new').length}</div></div>
    </div>
    <section class="panel"><header><h2>Objectif 10 000 € encaissés</h2></header><div class="body">
      <p class="small muted">Au rythme actuel (${euros(o.mrr_cents)} / mois), il faut ${o.mrr_cents > 0 ? `${Math.ceil(goal / o.mrr_cents)} mois` : '— (aucun revenu pour l\'instant)'} pour encaisser 10 000 €.</p>
      <div class="meter"><div class="bar"><i style="width:${Math.min(100, Math.round((100 * o.mrr_cents * 4) / goal))}%"></i></div><p class="small muted">Projection sur 4 mois au revenu mensuel actuel : ${euros(o.mrr_cents * 4)}.</p></div>
    </div></section>
    <section class="panel"><header><h2>Prospects (demandes de démo)</h2></header>${o.leads.length ? `<div class="scroll-x"><table class="data"><thead><tr><th>Date</th><th>Contact</th><th>Entreprise</th><th>Besoin</th><th>Statut</th></tr></thead><tbody>
      ${o.leads.map((l) => `<tr><td>${d(l.created_at)}</td><td><strong>${esc(l.name)}</strong><br><a href="mailto:${esc(l.email)}">${esc(l.email)}</a>${l.phone ? `<br><a href="tel:${esc(l.phone)}">${esc(l.phone)}</a>` : ''}</td><td>${esc(l.company ?? '—')}<br><small class="muted">${esc(l.team_size ?? '')}</small></td><td class="small">${esc(l.message ?? '')}</td>
      <td><select class="input" data-lead="${l.id}" aria-label="Statut">${Object.entries(LEAD).map(([k, [lab]]) => `<option value="${k}" ${k === l.status ? 'selected' : ''}>${lab}</option>`).join('')}</select></td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty">Aucun prospect pour le moment.</div>'}</section>
    <section class="panel"><header><h2>Entreprises clientes</h2></header><div class="scroll-x"><table class="data"><thead><tr><th>Entreprise</th><th>Propriétaire</th><th>Offre</th><th>Statut</th><th>Renouvellement</th><th>Demandes</th><th>Inscrite le</th></tr></thead><tbody>
      ${o.tenants.map((t) => `<tr><td><strong>${esc(t.name)}</strong></td><td>${esc(t.owner_email ?? '—')}</td><td>${esc(t.plan_id ?? '—')}${t.provider === 'manual' ? ' <span class="chip">manuel</span>' : ''}</td><td>${esc(t.status ?? 'aucune')}</td><td>${d(t.current_period_end)}</td><td>${t.requests}</td><td>${d(t.created_at)}</td></tr>`).join('')}
    </tbody></table></div></section>
    <section class="panel"><header><h2>Alertes internes</h2><span class="small muted">Coûts variables 30 j : ${o.costs_30d_eur.toFixed(2)} €</span></header><div class="body"><ul class="list">${o.alerts.length ? o.alerts.map((a) => `<li>${d(a.created_at)} — ${esc(a.message)}</li>`).join('') : '<li class="muted">Aucune alerte.</li>'}</ul></div></section>`;
  main.querySelectorAll('[data-lead]').forEach((s) => {
    s.onchange = async () => {
      await fetch(`/api/admin/leads/${s.dataset.lead}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: s.value }) });
    };
  });
}
load();
