// Calculateur de gain : uniquement à partir des valeurs saisies par le visiteur.
(async () => {
  const $ = (id) => document.getElementById(id);
  const eur = (n) => `${Math.round(n).toLocaleString('fr-FR')} €`;
  let price = null;
  try {
    const d = await fetch('/api/plans').then((r) => r.json());
    price = d.plans.find((p) => p.id === 'business').price_cents / 100;
  } catch { /* prix indisponible : le coût affiche « — » */ }
  const calc = () => {
    const montant = Math.max(0, Number($('r-montant').value) || 0);
    const marge = Math.min(100, Math.max(0, Number($('r-marge').value) || 0)) / 100;
    const recup = Math.max(0, Number($('r-recup').value) || 0);
    const devis = Math.max(0, Number($('r-devis').value) || 0);
    const hint = document.querySelector('#r-recup + .hint');
    if (hint) hint.textContent = devis ? `Hypothèse à choisir vous-même : ${recup.toLocaleString('fr-FR')} sur ${devis} devis, soit ${(100 * recup / devis).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} % de vos devis.` : 'Hypothèse à choisir vous-même.';
    const ca = recup * montant * 12;
    const mg = ca * marge;
    const cost = price == null ? null : price * 12;
    $('r-ca').textContent = eur(ca);
    $('r-mg').textContent = eur(mg);
    $('r-cost').textContent = cost == null ? '—' : eur(cost);
    $('r-roi').textContent = cost ? `× ${(mg / cost).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}` : '—';
  };
  ['r-devis', 'r-montant', 'r-marge', 'r-recup'].forEach((id) => $(id).addEventListener('input', calc));
  calc();
})();
