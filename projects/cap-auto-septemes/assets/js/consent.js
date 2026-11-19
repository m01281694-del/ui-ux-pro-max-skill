/* =====================================================================
   CAP AUTO SEPTÈMES — Gestion du consentement (cookies & traceurs)
   Conforme aux recommandations CNIL :
   - aucun traceur non essentiel avant consentement ;
   - « Tout refuser » aussi accessible que « Tout accepter » ;
   - choix conservé (durée configurable, 6 mois par défaut) ;
   - retrait du consentement possible à tout moment (« Gérer mes cookies »).
   Les services sont déclarés dans content/site.js → cookies.services.
   ===================================================================== */
(function () {
  "use strict";
  var CAP = window.CAP;
  var C = CAP.content;
  var cfg = C.cookies || {};
  var KEY = "cap_consent";
  var VERSION = cfg.policy_version || 1;
  var DURATION = (cfg.consent_duration_days || 180) * 864e5;

  var CATEGORIES = {
    necessaires: { title: "Strictement nécessaires", text: "Indispensables au fonctionnement du site (mémorisation de vos choix de consentement, sécurité). Ils ne peuvent pas être désactivés.", locked: true },
    mesure: { title: "Mesure d'audience", text: "Permettent de mesurer la fréquentation du site afin de l'améliorer." },
    medias: { title: "Contenus tiers", text: "Affichent des contenus hébergés par des services externes (carte, vidéos). Ces services peuvent déposer leurs propres traceurs." },
    marketing: { title: "Publicité et réseaux sociaux", text: "Permettent de mesurer l'efficacité de campagnes publicitaires ou de partager du contenu." }
  };

  /* Services déclarés + services implicites (carte intégrée) */
  var services = (Array.isArray(cfg.services) ? cfg.services : []).filter(function (s) { return s && s.category && CATEGORIES[s.category]; });
  if (CAP.get("dealer.map_embed_url")) {
    services.push({ id: "map", name: "Carte interactive", category: "medias", purpose: "Affichage du plan d'accès", provider: "" });
  }
  var usedCats = Object.keys(CATEGORIES).filter(function (k) { return k !== "necessaires" && services.some(function (s) { return s.category === k; }); });

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (d.v !== VERSION || !d.t || Date.now() - d.t > DURATION) return null;
      return d;
    } catch (e) { return null; }
  }
  function write(choices) {
    var d = { v: VERSION, t: Date.now(), c: choices };
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
    state = d;
    apply();
    listeners.forEach(function (fn) { try { fn(choices); } catch (e) {} });
  }
  var state = read();
  var listeners = [];

  function has(cat) {
    if (cat === "necessaires") return true;
    return !!(state && state.c && state.c[cat]);
  }

  /* Chargement des scripts autorisés (une seule fois) */
  var loaded = {};
  function apply() {
    services.forEach(function (s) {
      if (!has(s.category) || loaded[s.id] || !s.script_src) return;
      var src = CAP.safeUrl(s.script_src);
      if (!src) return;
      var el = document.createElement("script");
      el.src = src;
      el.async = true;
      document.head.appendChild(el);
      loaded[s.id] = true;
    });
    // Contenus intégrés bloqués
    document.querySelectorAll("[data-consent-embed]").forEach(renderEmbed);
  }

  function renderEmbed(box) {
    var cat = box.getAttribute("data-consent-embed");
    var src = CAP.safeUrl(box.getAttribute("data-src"));
    var title = box.getAttribute("data-title") || "Contenu externe";
    if (!src) return;
    if (has(cat)) {
      if (box.querySelector("iframe")) return;
      box.innerHTML = '<iframe src="' + CAP.esc(src) + '" title="' + CAP.esc(title) + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>';
    } else {
      box.innerHTML = '<div class="consent-embed">' + CAP.icon("cookie") +
        "<p>Ce contenu est fourni par un service tiers susceptible de déposer des traceurs. Il ne s'affiche qu'avec votre accord.</p>" +
        '<button type="button" class="btn btn--sm" data-accept-cat="' + CAP.esc(cat) + '">Autoriser et afficher</button></div>';
      box.querySelector("[data-accept-cat]").addEventListener("click", function () {
        var c = Object.assign({}, (state && state.c) || {});
        c[cat] = true;
        write(c);
        hideBanner();
      });
    }
  }

  /* ---------------- Bandeau ---------------- */
  var banner;
  function showBanner() {
    document.body.classList.add("cookie-open");
    if (banner) { banner.classList.add("is-visible"); return; }
    banner = document.createElement("section");
    banner.className = "cookie-banner";
    banner.setAttribute("aria-label", "Consentement aux cookies");
    banner.innerHTML =
      "<h2>Vos choix en matière de cookies</h2>" +
      "<p>Avec votre accord, nous utilisons des traceurs pour les finalités suivantes : " +
      usedCats.map(function (k) { return CATEGORIES[k].title.toLowerCase(); }).join(", ") +
      '. Vous pouvez accepter, refuser ou personnaliser vos choix à tout moment. <a href="cookies.html">En savoir plus</a></p>' +
      '<div class="cookie-actions">' +
      '<button type="button" class="btn btn--ghost" data-c-act="refuse">Tout refuser</button>' +
      '<button type="button" class="btn btn--ghost" data-c-act="custom">Personnaliser</button>' +
      '<button type="button" class="btn btn--ghost" data-c-act="accept">Tout accepter</button>' +
      "</div>";
    document.body.appendChild(banner);
    banner.addEventListener("click", function (e) {
      var b = e.target.closest("[data-c-act]");
      if (!b) return;
      var act = b.getAttribute("data-c-act");
      if (act === "accept") { write(all(true)); hideBanner(); }
      else if (act === "refuse") { write(all(false)); hideBanner(); }
      else openPanel();
    });
    requestAnimationFrame(function () { requestAnimationFrame(function () { banner.classList.add("is-visible"); }); });
  }
  function hideBanner() { document.body.classList.remove("cookie-open"); if (banner) banner.classList.remove("is-visible"); }
  function all(v) { var o = {}; usedCats.forEach(function (k) { o[k] = v; }); return o; }

  /* ---------------- Panneau de réglages ---------------- */
  var modal, lastFocus;
  function openPanel() {
    lastFocus = document.activeElement;
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal";
      modal.innerHTML = '<div class="modal__backdrop" data-close></div>' +
        '<div class="modal__dialog" role="dialog" aria-modal="true" aria-labelledby="consent-title"></div>';
      document.body.appendChild(modal);
      modal.addEventListener("click", function (e) { if (e.target.closest("[data-close]")) closePanel(); });
      modal.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closePanel();
        if (e.key === "Tab") CAP.trapFocus(modal, e);
      });
    }
    var dlg = modal.querySelector(".modal__dialog");
    var cats = ["necessaires"].concat(usedCats);
    dlg.innerHTML =
      '<div class="modal__head"><h2 id="consent-title">Réglages des cookies</h2>' +
      '<button type="button" class="icon-btn" data-close aria-label="Fermer">' + CAP.icon("close") + "</button></div>" +
      (usedCats.length
        ? "<p class=\"muted\">Choisissez les catégories que vous acceptez. Votre choix est conservé " + Math.round(DURATION / 864e5 / 30) + " mois au maximum, puis vous sera redemandé.</p>"
        : "<p class=\"muted\">Ce site n'utilise actuellement que des traceurs strictement nécessaires à son fonctionnement. Aucun consentement n'est requis.</p>") +
      cats.map(function (k) {
        var cat = CATEGORIES[k];
        var list = services.filter(function (s) { return s.category === k; });
        return '<div class="consent-cat"><div class="consent-cat__head"><h3 id="cc-' + k + '">' + cat.title + "</h3>" +
          '<label class="switch"><input type="checkbox" data-cat="' + k + '" aria-labelledby="cc-' + k + '"' +
          (cat.locked ? " checked disabled" : (has(k) ? " checked" : "")) + "><span></span></label></div>" +
          "<p>" + cat.text + "</p>" +
          (list.length ? "<ul>" + list.map(function (s) {
            return "<li>• " + CAP.esc(s.name || s.id) + (s.provider ? " — " + CAP.esc(s.provider) : "") + (s.purpose ? " : " + CAP.esc(s.purpose) : "") + (s.duration ? " (" + CAP.esc(s.duration) + ")" : "") + "</li>";
          }).join("") + "</ul>" : "") + "</div>";
      }).join("") +
      '<div class="modal__actions">' +
      (usedCats.length ? '<button type="button" class="btn btn--ghost btn--sm" data-act="refuse">Tout refuser</button>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-act="accept">Tout accepter</button>' +
        '<button type="button" class="btn btn--sm" data-act="save">Enregistrer mes choix</button>'
        : '<button type="button" class="btn btn--sm" data-close>Fermer</button>') + "</div>";

    dlg.querySelectorAll("[data-act]").forEach(function (b) {
      b.addEventListener("click", function () {
        var act = b.getAttribute("data-act");
        var prev = (state && state.c) || {};
        var choices;
        if (act === "accept") choices = all(true);
        else if (act === "refuse") choices = all(false);
        else {
          choices = {};
          dlg.querySelectorAll("input[data-cat]:not([disabled])").forEach(function (i) { choices[i.getAttribute("data-cat")] = i.checked; });
        }
        // Retrait d'un consentement déjà donné : rechargement pour décharger les scripts
        var revoked = Object.keys(prev).some(function (k) { return prev[k] && !choices[k] && services.some(function (s) { return s.category === k && s.script_src; }); });
        write(choices);
        hideBanner();
        closePanel();
        if (revoked) location.reload();
      });
    });
    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
    setTimeout(function () { var f = dlg.querySelector("button, input:not([disabled])"); if (f) f.focus(); }, 60);
  }
  function closePanel() {
    if (!modal) return;
    modal.classList.remove("is-open");
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-consent-open]")) { e.preventDefault(); openPanel(); }
  });

  window.CAPConsent = {
    has: has, open: openPanel, refresh: apply, categories: CATEGORIES, services: services, usedCategories: usedCats,
    onChange: function (fn) { listeners.push(fn); }
  };

  apply();
  if (usedCats.length && !state) {
    // Laisser l'intro vidéo se terminer avant d'afficher le bandeau
    if (document.body.classList.contains("intro-lock")) document.addEventListener("cap:intro-done", showBanner, { once: true });
    else setTimeout(showBanner, 600);
  }
})();
