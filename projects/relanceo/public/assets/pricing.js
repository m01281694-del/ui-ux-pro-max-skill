// Page tarifs : tout le contenu commercial (prix, limites, fonctionnalités) provient de /api/plans,
// lui-même dérivé de config/plans.json. Aucun prix ni droit n'est écrit dans ce fichier.
const CHECK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
const GAUGE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 12l4-3"/></svg>';
const CONFIG_LABEL = { ai_provider: 'IA', email_provider: 'e-mails', support_process: 'support' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n) => new Intl.NumberFormat('fr-FR').format(n);

function limitLines(data, plan) {
  const l = plan.limits;
  const out = [`${fmt(l.requests_monthly)} demandes par mois`, `${l.seats} collaborateur${l.seats > 1 ? 's' : ''}`];
  out.push(l.ai_operations_monthly > 0 ? `${fmt(l.ai_operations_monthly)} opérations IA par mois` : 'Assistance IA non incluse');
  if (l.automation_sends_monthly > 0) {
    out.push(`${fmt(l.automation_sends_monthly)} relances automatiques par mois`, `${l.automation_rules_active} règles d'automatisation actives`);
  } else {
    out.push('Aucune relance automatique');
  }
  return out;
}

function pendingTag(data, feature) {
  const key = feature.requires_configuration;
  if (!key || data.configuration[key]) return '';
  return ` <span class="pending" title="Fonctionnalité développée, prestataire non encore activé sur cette instance">activation en cours</span>`;
}

function renderPlans(data) {
  const root = document.getElementById('plans');
  const prev = { pro: 'Tout Starter, et :', business: 'Tout Pro, et :' };
  root.innerHTML = data.plans.map((p, i) => {
    const own = data.features.filter((f) => f.permissions.every((perm) => p.permissions.includes(perm))
      && !(i > 0 && f.permissions.every((perm) => data.plans[i - 1].permissions.includes(perm))));
    const cta = data.configuration.billing_enabled
      ? `<a class="btn ${p.highlight ? 'primary' : ''}" href="/inscription.html?offre=${encodeURIComponent(p.id)}">Choisir ${esc(p.name)}</a>`
      : `<a class="btn ${p.highlight ? 'primary' : ''}" href="/inscription.html?offre=${encodeURIComponent(p.id)}">Choisir ${esc(p.name)}</a>`;
    return `<article class="plan ${p.highlight ? 'highlight' : ''}" aria-labelledby="plan-${p.id}">
      ${p.highlight ? '<span class="badge">Le plus complet</span>' : ''}
      <h2 id="plan-${p.id}">${esc(p.name)}</h2>
      <p class="tagline">${esc(p.audience)}</p>
      <div class="price"><span class="amount">${esc(p.price_label)}</span><span class="per">/ mois</span></div>
      <div class="tax">${esc(data.commercial.price_tax_note)}</div>
      <ul>
        ${limitLines(data, p).map((t) => `<li class="limit">${GAUGE}<span>${esc(t)}</span></li>`).join('')}
        ${prev[p.id] ? `<li><span></span><strong>${prev[p.id]}</strong></li>` : ''}
        ${own.map((f) => `<li>${CHECK}<span>${esc(f.label)}${pendingTag(data, f)}</span></li>`).join('')}
      </ul>
      ${p.custom_offer_note ? `<p class="note">${esc(p.custom_offer_note)}</p>` : ''}
      ${cta}
    </article>`;
  }).join('');
  root.setAttribute('aria-busy', 'false');
}

function renderCompare(data) {
  const t = document.getElementById('compare');
  const hl = (p) => (p.highlight ? ' class="hl"' : '');
  let html = `<caption class="skip">Comparatif des offres</caption><thead><tr><th scope="col">Fonctionnalité</th>${data.plans.map((p) => `<th scope="col"${hl(p)}>${esc(p.name)}<br><small>${esc(p.price_label)} / mois</small></th>`).join('')}</tr></thead><tbody>`;
  html += `<tr class="group"><td colspan="${data.plans.length + 1}">Limites</td></tr>`;
  for (const [m, def] of Object.entries(data.metrics)) {
    html += `<tr><th scope="row">${esc(def.label)}</th>${data.plans.map((p) => `<td${hl(p)}>${p.limits[m] > 0 ? fmt(p.limits[m]) : '<span class="no">—</span>'}</td>`).join('')}</tr>`;
  }
  let group = null;
  for (const f of data.features) {
    if (f.group !== group) { group = f.group; html += `<tr class="group"><td colspan="${data.plans.length + 1}">${esc(group)}</td></tr>`; }
    html += `<tr><th scope="row">${esc(f.label)}${pendingTag(data, f)}</th>${data.plans.map((p) => {
      const yes = f.permissions.every((perm) => p.permissions.includes(perm));
      return `<td${hl(p)}>${yes ? '<span class="yes" aria-label="Inclus">✓</span>' : '<span class="no" aria-label="Non inclus">—</span>'}</td>`;
    }).join('')}</tr>`;
  }
  t.innerHTML = `${html}</tbody>`;
}

async function main() {
  try {
    const res = await fetch('/api/plans');
    const data = await res.json();
    if (!data.commercial.ready) {
      const n = document.getElementById('notice');
      n.innerHTML = `<strong>Prévisualisation.</strong> ${esc(data.commercial.notice)}`;
      n.hidden = false;
    }
    if (!data.configuration.billing_enabled) {
      document.getElementById('footer-note').textContent = 'Le paiement en ligne n\'est pas encore activé : aucune somme ne peut être prélevée depuis cette page.';
    }
    renderPlans(data);
    // Données structurées pour Google (générées depuis le catalogue, jamais codées en dur).
    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'RELANCEO',
      applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
      description: 'Suivi des demandes clients, assistance IA et relances automatiques pour les PME.',
      offers: data.plans.map((p) => ({ '@type': 'Offer', name: p.name, price: (p.price_cents / 100).toFixed(2), priceCurrency: data.currency, url: `${location.origin}/inscription.html?offre=${p.id}` })),
    });
    document.head.append(ld);
    renderCompare(data);
  } catch {
    document.getElementById('plans').innerHTML = '<p class="msg error">Impossible de charger les offres. Réessayez plus tard.</p>';
  }
}
main();
