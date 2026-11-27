const p = new URLSearchParams(location.hash.slice(1));
const $ = (id) => document.getElementById(id);
if (p.get('portail')) { $('portal').hidden = false; } else {
  $('pay').hidden = false;
  fetch('/api/plans').then((r) => r.json()).then((d) => {
    const plan = d.plans.find((x) => x.id === p.get('offre'));
    if (plan) { $('title').textContent = `Offre ${plan.name}`; $('desc').textContent = `${plan.price_label} par mois — abonnement mensuel sans engagement.`; }
  });
  $('ok').onclick = async () => {
    $('ok').disabled = true;
    const r = await fetch('/api/demo/pay', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session: p.get('session') }) });
    if (r.ok) { location.href = '/app.html#/abonnement?paiement=confirmation'; return; }
    const j = await r.json().catch(() => ({}));
    $('msg').innerHTML = `<p class="msg error">${(j.error?.message ?? 'Échec.').replace(/[<>&]/g, '')}</p>`;
    $('ok').disabled = false;
  };
}
