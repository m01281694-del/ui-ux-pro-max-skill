/* =====================================================================
   CAP AUTO SEPTÈMES — Cœur du site
   - lecture du contenu (content/site.js, content/vehicles.js)
   - repères « À PERSONNALISER » en prévisualisation
   - en-tête, pied de page, menu mobile
   - balises SEO + données structurées (uniquement avec des données réelles)
   Vous n'avez normalement PAS besoin de modifier ce fichier.
   ===================================================================== */
(function () {
  "use strict";

  document.documentElement.classList.add("js");

  var C = window.CAP_CONTENT || {};
  var VEHICLES = Array.isArray(window.CAP_VEHICLES) ? window.CAP_VEHICLES : [];
  var READY = !!(C.publication && C.publication.ready === true);
  /* Mode démonstration : rendu propre (aucun repère « À PERSONNALISER »),
     mais toujours non indexé et signalé comme proposition de site. */
  var DEMO = !READY && !!(C.publication && C.publication.demo === true);
  var PREVIEW = !READY && !DEMO;
  var PAGE = document.body.getAttribute("data-page") || "";

  /* ------------------------------------------------------------------ */
  /* Utilitaires                                                         */
  /* ------------------------------------------------------------------ */
  function get(path, obj) {
    var cur = obj || C;
    var parts = String(path).split(".");
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }
  function isEmpty(v) {
    if (v == null) return true;
    if (typeof v === "string") return v.trim() === "";
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === "number") return isNaN(v);
    return false;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  /* N'accepte que des URL sûres (http, https, mailto, tel, relatives) */
  function safeUrl(u) {
    u = String(u || "").trim();
    if (!u) return "";
    if (/^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(u)) return u;
    if (/^[a-z0-9][\w\-\/.]*(\?[^\s]*)?(#[^\s]*)?$/i.test(u) && !/^[a-z]+:/i.test(u)) return u;
    return "";
  }
  function paragraphs(text) {
    return String(text || "").split(/\n\s*\n/).map(function (p) {
      return "<p>" + esc(p.trim()).replace(/\n/g, "<br>") + "</p>";
    }).join("");
  }
  function todo(path, label, block) {
    if (!PREVIEW) return "";
    return '<span class="todo' + (block ? " todo--block" : "") + '">À PERSONNALISER' +
      (label ? " · " + esc(label) : "") + (path ? " <small>" + esc(path) + "</small>" : "") + "</span>";
  }
  var nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
  function formatPrice(n) {
    if (n == null || n === "" || isNaN(Number(n))) return "";
    return nf0.format(Number(n)) + " €";
  }
  function formatKm(n) {
    if (n == null || n === "" || isNaN(Number(n))) return "";
    return nf0.format(Number(n)) + " km";
  }
  function formatDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  function slugify(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  var LABELS = {
    fuel: { essence: "Essence", diesel: "Diesel", hybride: "Hybride", "hybride-rechargeable": "Hybride rechargeable", electrique: "Électrique", gpl: "GPL", ethanol: "Éthanol", autre: "Autre" },
    transmission: { manuelle: "Manuelle", automatique: "Automatique" },
    body: { citadine: "Citadine", berline: "Berline", break: "Break", suv: "SUV", monospace: "Monospace", coupe: "Coupé", cabriolet: "Cabriolet", utilitaire: "Utilitaire", "4x4": "4x4", autre: "Autre" },
    status: { disponible: "Disponible", reserve: "Réservé", vendu: "Vendu" }
  };
  function label(group, key) {
    if (!key) return "";
    return (LABELS[group] && LABELS[group][key]) || String(key);
  }

  /* ------------------------------------------------------------------ */
  /* Icônes (SVG en ligne, style trait — aucune dépendance externe)      */
  /* ------------------------------------------------------------------ */
  var ICON_PATHS = {
    arrow: '<path d="M5 12h14M13 5l7 7-7 7"/>',
    "arrow-left": '<path d="M19 12H5M11 19l-7-7 7-7"/>',
    "arrow-up-right": '<path d="M7 17 17 7M8 7h9v9"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18 10l-2.7-3.6A2 2 0 0 0 13.7 6H8.3a2 2 0 0 0-1.6.8L4 10l-1.5.6C1.7 10.9 1 11.6 1 12.5V16c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M9 17h6"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8Z"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    swap: '<path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>',
    truck: '<path d="M10 17h4V5H2v12h3M14 9h4l4 4v4h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2Z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    gauge: '<path d="m12 14 4-4"/><path d="M3.3 19a10 10 0 1 1 17.4 0"/>',
    fuel: '<path d="M3 22h12M4 9h10M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V9.8a2 2 0 0 0-.6-1.4L18 5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/>',
    palette: '<circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 2a10 10 0 0 0 0 20c.9 0 1.7-.8 1.7-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.8-1.7 1.7-1.7h2A5.6 5.6 0 0 0 22 11c0-5-4.5-9-10-9Z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    door: '<path d="M13 4h3a2 2 0 0 1 2 2v14M2 20h3M13 20h9M10 12v.01M13 4.6v16.8a1 1 0 0 1-1.2 1L5 21V5.6a2 2 0 0 1 1.6-2l4-.9A2 2 0 0 1 13 4.6Z"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z"/><path d="M2 21c0-3 1.9-5.4 5.2-6"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    video: '<path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    play: '<path d="M6 4l14 8-14 8V4Z"/>',
    pause: '<path d="M7 4h3v16H7zM14 4h3v16h-3z"/>',
    volume: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
    mute: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m22 9-6 6M16 9l6 6"/>',
    filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3Z"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    zoom: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    "chevron-left": '<path d="m15 18-6-6 6-6"/>',
    whatsapp: '<path d="M3 21l1.7-5A9 9 0 1 1 8 19.3L3 21Z"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"/>',
    facebook: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3Z"/>',
    instagram: '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
    tiktok: '<path d="M9 12a4 4 0 1 0 4 4V2a5 5 0 0 0 5 5"/>',
    youtube: '<path d="M2.5 17a24 24 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.6 49.6 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24 24 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.6 49.6 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/>',
    linkedin: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/>',
    google: '<path d="M21.8 10H12v4h5.6A6 6 0 1 1 16 7.6l2.9-2.8A10 10 0 1 0 22 12c0-.7 0-1.3-.2-2Z"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    cookie: '<path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01M16 15.5v.01M12 12v.01M11 17v.01M7 14v.01"/>'
  };
  function icon(name, cls) {
    var p = ICON_PATHS[name] || ICON_PATHS.info;
    return '<svg class="' + (cls || "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + p + "</svg>";
  }

  /* Emplacement image : image réelle si renseignée, sinon repère */
  function imageSlot(src, alt, path, opts) {
    opts = opts || {};
    var s = safeUrl(src);
    if (s) {
      return '<img src="' + esc(s) + '" alt="' + esc(alt || "") + '"' +
        (opts.eager ? ' fetchpriority="high"' : ' loading="lazy" decoding="async"') +
        (opts.width ? ' width="' + opts.width + '" height="' + opts.height + '"' : "") + ">";
    }
    if (!PREVIEW) return opts.keepFrame ? '<div class="slot slot--neutral" aria-hidden="true">' + icon(opts.icon || "image") + "</div>" : "";
    return '<div class="slot" role="img" aria-label="Emplacement photo à fournir">' + icon(opts.icon || "image") +
      "<strong>EMPLACEMENT PHOTO</strong>" +
      (opts.hint ? "<span>" + esc(opts.hint) + "</span>" : "") +
      (path ? "<code>" + esc(path) + "</code>" : "") + "</div>";
  }

  /* ------------------------------------------------------------------ */
  /* Liaison déclarative : data-c, data-c-href, data-c-src…              */
  /* ------------------------------------------------------------------ */
  function bindAll(root) {
    root = root || document;

    // Texte simple
    root.querySelectorAll("[data-c]").forEach(function (el) {
      var path = el.getAttribute("data-c");
      var val = get(path);
      var optional = el.hasAttribute("data-optional");
      var opt = el.getAttribute("data-optional");
      var target = opt ? el.closest(opt) || el : el;
      if (!isEmpty(val)) {
        if (el.hasAttribute("data-paragraphs")) el.innerHTML = paragraphs(val);
        else el.textContent = String(val);
        el.classList.remove("is-todo");
      } else if (PREVIEW && !el.hasAttribute("data-no-todo")) {
        el.innerHTML = todo(path, el.getAttribute("data-todo-label") || "");
        el.classList.add("is-todo");
      } else if (optional || el.hasAttribute("data-no-todo")) {
        if (PREVIEW && el.hasAttribute("data-no-todo")) return;
        target.remove();
      } else {
        el.textContent = "";
      }
    });

    // Liens
    root.querySelectorAll("[data-c-href]").forEach(function (el) {
      var href = safeUrl(get(el.getAttribute("data-c-href")));
      if (href) el.setAttribute("href", href);
    });

    // Boutons/liens { label, href } : data-c-link="home.hero.cta_primary"
    root.querySelectorAll("[data-c-link]").forEach(function (el) {
      var path = el.getAttribute("data-c-link");
      var obj = get(path) || {};
      var lab = el.querySelector("[data-link-label]") || el;
      var href = safeUrl(obj.href);
      if (href) el.setAttribute("href", href);
      if (!isEmpty(obj.label)) {
        lab.textContent = obj.label;
      } else if (PREVIEW) {
        lab.innerHTML = "Bouton · À PERSONNALISER";
        el.title = path + ".label";
        el.classList.add("is-todo-btn");
      } else {
        el.remove();
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Navigation                                                          */
  /* ------------------------------------------------------------------ */
  var NAV = [
    { href: "index.html", label: "Accueil", page: "home" },
    { href: "vehicules.html", label: "Véhicules", page: "vehicles" },
    { href: "a-propos.html", label: "À propos", page: "about" },
    { href: "contact.html", label: "Contact", page: "contact" }
  ];
  function currentNav(item) {
    return item.page === PAGE || (PAGE === "vehicle" && item.page === "vehicles");
  }

  function siteName() { return get("site.name") || ""; }

  function brandHtml(extraCls) {
    var logo = safeUrl(get("site.logo"));
    var name = siteName();
    var inner = logo
      ? '<img src="' + esc(logo) + '" alt="' + esc(get("site.logo_alt") || name) + '">'
      : '<span class="brand__mark" aria-hidden="true"></span><span class="brand__name">' + (name ? esc(name) : todo("site.name")) + "</span>";
    return '<a class="brand ' + (extraCls || "") + '" href="index.html" aria-label="' + esc(name || "Accueil") + ' — accueil">' + inner + "</a>";
  }

  function phoneHref() {
    var p = String(get("dealer.phone") || "").replace(/[^\d+]/g, "");
    return p ? "tel:" + p : "";
  }
  function phoneLabel() { return get("dealer.phone_display") || get("dealer.phone") || ""; }

  function renderHeader() {
    var el = document.getElementById("site-header");
    if (!el) return;
    var tel = phoneHref();
    var links = NAV.map(function (n) {
      return '<li><a class="nav__link" href="' + n.href + '"' + (currentNav(n) ? ' aria-current="page"' : "") + ">" + n.label + "</a></li>";
    }).join("");
    el.className = "site-header";
    el.innerHTML =
      '<div class="container">' + brandHtml() +
      '<nav class="nav" aria-label="Navigation principale"><ul class="nav__list">' + links + "</ul></nav>" +
      '<div class="header-actions">' +
      (tel ? '<a class="btn btn--ghost btn--sm" href="' + esc(tel) + '">' + icon("phone") + "<span>" + esc(phoneLabel()) + "</span></a>" : "") +
      '<a class="btn btn--sm" href="vehicules.html"><span>Nos véhicules</span>' + icon("arrow", "arrow") + "</a>" +
      '<button class="icon-btn nav-toggle" type="button" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="mobile-menu">' + icon("menu") + "</button>" +
      "</div></div>";

    // Menu mobile
    var mm = document.createElement("div");
    mm.className = "mobile-menu";
    mm.id = "mobile-menu";
    mm.setAttribute("role", "dialog");
    mm.setAttribute("aria-modal", "true");
    mm.setAttribute("aria-label", "Menu");
    mm.innerHTML =
      '<button class="icon-btn mobile-menu__close" type="button" aria-label="Fermer le menu">' + icon("close") + "</button>" +
      "<ul>" + NAV.map(function (n, i) {
        return '<li><a class="mm-link" style="transition-delay:' + (120 + i * 60) + 'ms" href="' + n.href + '"' + (currentNav(n) ? ' aria-current="page"' : "") + ">" + n.label + "</a></li>";
      }).join("") + "</ul>" +
      '<div class="mobile-menu__footer">' +
      (tel ? '<a class="btn btn--block" href="' + esc(tel) + '">' + icon("phone") + "<span>" + esc(phoneLabel()) + "</span></a>" : "") +
      '<a class="btn btn--ghost btn--block" href="contact.html">Nous contacter</a></div>';
    document.body.appendChild(mm);

    var toggle = el.querySelector(".nav-toggle");
    var closeBtn = mm.querySelector(".mobile-menu__close");
    function open() {
      mm.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
      setTimeout(function () { closeBtn.focus(); }, 50);
    }
    function close() {
      mm.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
      toggle.focus();
    }
    toggle.addEventListener("click", open);
    closeBtn.addEventListener("click", close);
    mm.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
      if (e.key === "Tab") trapFocus(mm, e);
    });

    // Bouton d'appel flottant (mobile)
    if (tel) {
      var fab = document.createElement("a");
      fab.className = "fab-call is-active";
      fab.href = tel;
      fab.setAttribute("aria-label", "Appeler " + phoneLabel());
      fab.innerHTML = icon("phone");
      document.body.appendChild(fab);
    }
  }

  function trapFocus(container, e) {
    var f = container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])');
    f = Array.prototype.filter.call(f, function (n) { return n.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function socialLinks() {
    var s = C.social || {};
    var map = [
      ["facebook", "Facebook", "facebook"], ["instagram", "Instagram", "instagram"], ["tiktok", "TikTok", "tiktok"],
      ["youtube", "YouTube", "youtube"], ["linkedin", "LinkedIn", "linkedin"], ["google_business", "Google", "google"]
    ];
    var items = map.filter(function (m) { return safeUrl(s[m[0]]); }).map(function (m) {
      return '<li><a class="icon-btn" href="' + esc(safeUrl(s[m[0]])) + '" target="_blank" rel="noopener noreferrer" aria-label="' + m[1] + ' (nouvel onglet)">' + icon(m[2]) + "</a></li>";
    });
    if (!items.length) return PREVIEW ? todo("social.*", "réseaux sociaux") : "";
    return '<ul class="social">' + items.join("") + "</ul>";
  }

  function addressLines() {
    var a = get("dealer.address") || {};
    var l1 = a.street || "";
    var l2 = [a.postal_code, a.city].filter(Boolean).join(" ");
    return [l1, l2].filter(Boolean);
  }

  function renderFooter() {
    var el = document.getElementById("site-footer");
    if (!el) return;
    var tel = phoneHref();
    var email = get("dealer.email");
    var addr = addressLines();
    var name = siteName();
    var year = new Date().getFullYear();

    var contact = [];
    contact.push(tel ? '<li><a href="' + esc(tel) + '">' + esc(phoneLabel()) + "</a></li>" : (PREVIEW ? "<li>" + todo("dealer.phone", "téléphone") + "</li>" : ""));
    contact.push(email ? '<li><a href="mailto:' + esc(email) + '">' + esc(email) + "</a></li>" : (PREVIEW ? "<li>" + todo("dealer.email", "e-mail") + "</li>" : ""));
    contact.push(addr.length ? "<li><span>" + addr.map(esc).join("<br>") + "</span></li>" : (PREVIEW ? "<li>" + todo("dealer.address", "adresse") + "</li>" : ""));

    el.className = "site-footer";
    el.innerHTML =
      '<div class="container">' +
      '<div class="footer-grid">' +
      "<div>" + brandHtml() + '<div class="mt-5">' + socialLinks() + "</div></div>" +
      '<div><p class="footer-title">Navigation</p><ul class="footer-links">' +
      NAV.map(function (n) { return '<li><a href="' + n.href + '">' + n.label + "</a></li>"; }).join("") + "</ul></div>" +
      '<div><p class="footer-title">Contact</p><ul class="footer-links">' + contact.join("") + "</ul></div>" +
      '<div><p class="footer-title">Horaires</p><div data-hours-compact></div></div>' +
      "</div>" +
      '<div class="footer-giant" aria-hidden="true">' + esc(name) + "</div>" +
      '<div class="footer-bottom"><p>© ' + year + " " + esc(get("legal.company_name") || name) +
      (DEMO ? ' · <span class="demo-note">Proposition de site — version de démonstration</span>' : "") + "</p>" +
      '<ul><li><a href="mentions-legales.html">Mentions légales</a></li>' +
      '<li><a href="confidentialite.html">Confidentialité</a></li>' +
      '<li><a href="cookies.html">Cookies</a></li>' +
      '<li><button type="button" data-consent-open>Gérer mes cookies</button></li></ul></div>' +
      "</div>";
    renderHoursCompact(el.querySelector("[data-hours-compact]"));
  }

  /* ------------------------------------------------------------------ */
  /* Horaires                                                            */
  /* ------------------------------------------------------------------ */
  var DAY_INDEX = { dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6 };
  function hoursList() { return Array.isArray(get("dealer.hours")) ? get("dealer.hours") : []; }
  function hoursFilled() { return hoursList().some(function (h) { return Array.isArray(h.slots); }); }
  function slotsText(slots) {
    if (slots == null) return null;
    if (!slots.length) return "Fermé";
    return slots.map(function (s) { return String(s[0]).replace(":", "h") + " – " + String(s[1]).replace(":", "h"); }).join(" / ");
  }
  function parisNow() {
    var parts = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
    var o = {};
    parts.forEach(function (p) { o[p.type] = p.value; });
    return { day: DAY_INDEX[String(o.weekday).toLowerCase()], minutes: parseInt(o.hour, 10) * 60 + parseInt(o.minute, 10) };
  }
  function toMin(t) { var p = String(t).split(":"); return parseInt(p[0], 10) * 60 + parseInt(p[1] || 0, 10); }
  function openStatus() {
    if (!hoursFilled()) return null;
    var now = parisNow();
    var today = hoursList().filter(function (h) { return DAY_INDEX[String(h.day).toLowerCase()] === now.day; })[0];
    if (!today || !Array.isArray(today.slots)) return null;
    var open = today.slots.some(function (s) { return now.minutes >= toMin(s[0]) && now.minutes < toMin(s[1]); });
    return open;
  }
  function renderHoursTable(el) {
    if (!el) return;
    if (!hoursFilled()) { el.innerHTML = PREVIEW ? todo("dealer.hours", "horaires d'ouverture", true) : ""; return; }
    var now = parisNow();
    var rows = hoursList().map(function (h) {
      var txt = slotsText(h.slots);
      var isToday = DAY_INDEX[String(h.day).toLowerCase()] === now.day;
      return "<tr" + (isToday ? ' class="is-today"' : "") + '><th scope="row">' + esc(h.day) + "</th><td>" +
        (txt == null ? (PREVIEW ? todo("", "") : "—") : esc(txt)) + "</td></tr>";
    }).join("");
    var st = openStatus();
    var status = st == null ? "" : '<p class="open-status ' + (st ? "open-status--open" : "open-status--closed") + '">' + (st ? "Ouvert actuellement" : "Fermé actuellement") + "</p>";
    var note = get("dealer.hours_note");
    el.innerHTML = status + '<table class="hours mt-4"><caption class="sr-only">Horaires d\'ouverture</caption><tbody>' + rows + "</tbody></table>" +
      (note ? '<p class="muted mt-4">' + esc(note) + "</p>" : "");
  }
  function renderHoursCompact(el) {
    if (!el) return;
    if (!hoursFilled()) { el.innerHTML = PREVIEW ? todo("dealer.hours", "horaires") : ""; return; }
    // Regroupe les jours consécutifs aux horaires identiques : « Mar. – Sam. »
    var groups = [];
    hoursList().forEach(function (h) {
      var t = slotsText(h.slots);
      var last = groups[groups.length - 1];
      if (last && last.t === t) last.to = h.day; else groups.push({ from: h.day, to: h.day, t: t });
    });
    function ab(d) { return d.slice(0, 3) + "."; }
    el.innerHTML = '<ul class="footer-links">' + groups.map(function (g) {
      var days = g.from === g.to ? ab(g.from) : ab(g.from) + " – " + ab(g.to);
      return '<li><span><strong>' + esc(days) + "</strong><br>" + (g.t == null ? "—" : esc(g.t)) + "</span></li>";
    }).join("") + "</ul>";
  }

  /* Bloc coordonnées réutilisable */
  function contactListHtml() {
    var tel = phoneHref(), email = get("dealer.email"), addr = addressLines(), wa = String(get("dealer.whatsapp") || "").replace(/\D/g, "");
    var mapLink = safeUrl(get("dealer.map_link"));
    function item(ic, lab, body) {
      return '<li class="info-item"><span class="info-item__icon">' + icon(ic) + '</span><div><span class="info-item__label">' + lab + "</span>" + body + "</div></li>";
    }
    var out = [];
    function push(has, ic, lab, body, path) {
      if (has) out.push(item(ic, lab, body));
      else if (PREVIEW) out.push(item(ic, lab, todo(path)));
    }
    push(!!tel, "phone", "Téléphone", '<a href="' + esc(tel) + '">' + esc(phoneLabel()) + "</a>", "dealer.phone");
    push(!!email, "mail", "E-mail", '<a href="mailto:' + esc(email) + '">' + esc(email) + "</a>", "dealer.email");
    push(addr.length > 0, "pin", "Adresse",
      '<address style="font-style:normal">' + addr.map(esc).join("<br>") + "</address>" +
      (mapLink ? '<a class="link-arrow mt-4" href="' + esc(mapLink) + '" target="_blank" rel="noopener noreferrer">Itinéraire ' + icon("arrow-up-right") + "</a>" : ""),
      "dealer.address");
    if (wa) push(true, "whatsapp", "WhatsApp", '<a href="https://wa.me/' + esc(wa) + '" target="_blank" rel="noopener noreferrer">Écrire sur WhatsApp</a>');
    if (!out.length) return "";
    return '<ul class="info-list">' + out.join("") + "</ul>";
  }

  /* ------------------------------------------------------------------ */
  /* SEO : titre, description, canonical, Open Graph, JSON-LD            */
  /* ------------------------------------------------------------------ */
  function setMeta(attr, key, content) {
    var sel = "meta[" + attr + '="' + key + '"]';
    var m = document.head.querySelector(sel);
    if (!content) { if (m) m.remove(); return; }
    if (!m) { m = document.createElement("meta"); m.setAttribute(attr, key); document.head.appendChild(m); }
    m.setAttribute("content", content);
  }
  function setLink(rel, href) {
    var l = document.head.querySelector('link[rel="' + rel + '"]');
    if (!href) { if (l) l.remove(); return; }
    if (!l) { l = document.createElement("link"); l.rel = rel; document.head.appendChild(l); }
    l.href = href;
  }
  function absUrl(path) {
    var base = String(get("site.url") || "").replace(/\/+$/, "");
    if (!base) return "";
    if (/^https?:/i.test(path)) return path;
    path = String(path || "").replace(/^\.?\//, "");
    if (path === "index.html") path = "";
    path = path.replace(/\.html(?=$|\?)/, "");
    return base + "/" + path;
  }
  function applySeo(opts) {
    opts = opts || {};
    var key = opts.key || document.body.getAttribute("data-seo") || "";
    var pageSeo = get("seo.pages." + key) || {};
    var name = siteName();
    var sep = get("seo.title_separator") || " | ";
    var t = opts.title || pageSeo.title || "";
    var title = t && name && t !== name ? t + sep + name : (t || name);
    if (title) document.title = title;
    var desc = opts.description || pageSeo.description || get("seo.default_description") || "";
    setMeta("name", "description", desc);
    setMeta("name", "robots", !READY || opts.noindex ? "noindex, nofollow" : "index, follow");
    setMeta("name", "google-site-verification", get("seo.google_site_verification"));
    setMeta("name", "theme-color", get("site.theme_color") || "#0B0D10");

    var file = location.pathname.split("/").pop() || "index.html";
    var canonical = opts.canonical || absUrl(file + (opts.query || ""));
    setLink("canonical", canonical);

    setMeta("property", "og:type", opts.ogType || "website");
    setMeta("property", "og:locale", "fr_FR");
    setMeta("property", "og:site_name", name);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:url", canonical);
    var img = opts.image || get("seo.og_image");
    setMeta("property", "og:image", img ? (absUrl(img) || img) : "");
    setMeta("name", "twitter:card", img ? "summary_large_image" : "summary");

    var fav = safeUrl(get("site.favicon"));
    if (fav) setLink("icon", fav);
  }

  function addJsonLd(id, data) {
    if (!data) return;
    var s = document.getElementById(id) || document.createElement("script");
    s.type = "application/ld+json";
    s.id = id;
    s.textContent = JSON.stringify(data);
    if (!s.parentNode) document.head.appendChild(s);
  }
  /* Données structurées de l'entreprise — seulement les champs réellement remplis */
  function dealerJsonLd() {
    var name = siteName();
    if (!name || !READY) return null; // rien de publié tant que le contenu n'est pas validé
    var a = get("dealer.address") || {};
    var d = { "@context": "https://schema.org", "@type": "AutoDealer", name: name };
    var url = get("site.url"); if (url) d.url = url;
    var logo = get("site.logo"); if (logo && url) d.logo = absUrl(logo);
    if (get("dealer.phone")) d.telephone = get("dealer.phone");
    if (get("dealer.email")) d.email = get("dealer.email");
    if (a.street || a.city) {
      d.address = { "@type": "PostalAddress" };
      if (a.street) d.address.streetAddress = a.street;
      if (a.postal_code) d.address.postalCode = a.postal_code;
      if (a.city) d.address.addressLocality = a.city;
      if (a.country) d.address.addressCountry = a.country === "France" ? "FR" : a.country;
    }
    var map = { lundi: "Monday", mardi: "Tuesday", mercredi: "Wednesday", jeudi: "Thursday", vendredi: "Friday", samedi: "Saturday", dimanche: "Sunday" };
    var spec = [];
    hoursList().forEach(function (h) {
      (h.slots || []).forEach(function (s) {
        spec.push({ "@type": "OpeningHoursSpecification", dayOfWeek: map[String(h.day).toLowerCase()], opens: s[0], closes: s[1] });
      });
    });
    if (spec.length) d.openingHoursSpecification = spec;
    var same = Object.keys(C.social || {}).map(function (k) { return C.social[k]; }).filter(Boolean);
    if (same.length) d.sameAs = same;
    return d;
  }

  /* ------------------------------------------------------------------ */
  /* Bandeau de prévisualisation                                         */
  /* ------------------------------------------------------------------ */
  function previewBanner() {
    if (!PREVIEW) return;
    try { if (sessionStorage.getItem("cap_preview_hidden") === "1") return; } catch (e) {}
    var b = document.createElement("div");
    b.className = "preview-banner";
    b.setAttribute("role", "status");
    b.innerHTML = "<span>Prévisualisation · contenu à personnaliser · non indexé</span>" +
      '<button type="button" aria-label="Masquer ce bandeau">' + icon("close") + "</button>";
    b.querySelector("button").addEventListener("click", function () {
      b.hidden = true;
      try { sessionStorage.setItem("cap_preview_hidden", "1"); } catch (e) {}
    });
    document.body.appendChild(b);
  }

  function skipLink() {
    var a = document.createElement("a");
    a.className = "skip-link";
    a.href = "#main";
    a.textContent = "Aller au contenu";
    document.body.insertBefore(a, document.body.firstChild);
  }

  /* ------------------------------------------------------------------ */
  /* Initialisation                                                      */
  /* ------------------------------------------------------------------ */
  window.CAP = {
    content: C, vehicles: VEHICLES, preview: PREVIEW, demo: DEMO, ready: READY, page: PAGE,
    get: get, isEmpty: isEmpty, esc: esc, safeUrl: safeUrl, paragraphs: paragraphs, todo: todo,
    icon: icon, imageSlot: imageSlot, formatPrice: formatPrice, formatKm: formatKm, formatDate: formatDate,
    slugify: slugify, label: label, LABELS: LABELS, bindAll: bindAll, applySeo: applySeo, addJsonLd: addJsonLd,
    absUrl: absUrl, phoneHref: phoneHref, phoneLabel: phoneLabel, addressLines: addressLines,
    renderHoursTable: renderHoursTable, contactListHtml: contactListHtml, socialLinks: socialLinks,
    openStatus: openStatus, trapFocus: trapFocus, siteName: siteName
  };

  skipLink();
  renderHeader();
  renderFooter();
  bindAll(document);
  applySeo();
  addJsonLd("ld-dealer", dealerJsonLd());
  previewBanner();
})();
