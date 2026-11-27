/* =====================================================================
   Noyau du site : données, utilitaires, en-tête, pied, dock mobile,
   animations (apparitions, lettres, parallaxe, magnétisme, lumière),
   transitions de page, carte véhicule.
   ===================================================================== */
(function () {
  "use strict";
  var SITE = window.SITE || {};
  var root = document.documentElement;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Utilitaires ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function nf(n) { return new Intl.NumberFormat("fr-FR").format(n); }
  function price(v) { return v.price != null ? nf(v.price) + " €" : "Prix sur demande"; }
  function km(n) { return n != null ? nf(n) + " km" : ""; }
  function icon(id, cls) { return '<svg class="i' + (cls ? " " + cls : "") + '" aria-hidden="true"><use href="#i-' + id + '"/></svg>'; }
  function safeUrl(u) { u = String(u || "").trim(); return /^(https?:\/\/|\/|assets\/|mailto:|tel:)/i.test(u) && !/^javascript:/i.test(u) ? u : ""; }

  var LABELS = {
    fuel: { essence: "Essence", diesel: "Diesel", hybride: "Hybride", "hybride-rechargeable": "Hybride rechargeable", electrique: "Électrique", gpl: "GPL" },
    transmission: { manuelle: "Manuelle", automatique: "Automatique" },
    body: { citadine: "Citadine", compacte: "Compacte", berline: "Berline", break: "Break", suv: "SUV", monospace: "Monospace", coupe: "Coupé", cabriolet: "Cabriolet", utilitaire: "Utilitaire" }
  };
  function label(k, v) { return (LABELS[k] && LABELS[k][v]) || v || ""; }

  /* ---------- Véhicules ---------- */
  var real = window.VEHICLES || [];
  var usingExamples = !real.length && SITE.demo;
  var source = usingExamples ? (window.VEHICLES_EXAMPLE || []) : real;
  var vehicles = source.map(function (v, i) {
    var o = Object.assign({ status: "disponible", photos: [], equipment: [] }, v);
    o.example = usingExamples;
    o.photos = (o.photos || []).map(function (p) { return typeof p === "string" ? { src: p, alt: "" } : p; }).filter(function (p) { return safeUrl(p && p.src); });
    o.title = [o.brand, o.model].filter(Boolean).join(" ");
    o.label = [o.brand, o.model, o.version, o.year].filter(Boolean).join(" ");
    o._i = i;
    return o;
  });
  function vurl(v) { return "/vehicule?id=" + encodeURIComponent(v.id); }
  function silhouette(v) {
    var s = { suv: "suv", monospace: "suv", berline: "sedan", break: "sedan", coupe: "sedan", cabriolet: "sedan", utilitaire: "van" }[v.body] || "hatch";
    return '<div class="carviz" aria-hidden="true"><svg viewBox="0 0 400 150"><use href="#car-' + s + '"/></svg><span class="carviz__floor"></span></div>';
  }
  function media(v, eager) {
    var p = v.photos[0];
    return p ? '<img src="' + esc(p.src) + '" alt="' + esc(p.alt || v.label) + '"' + (eager ? "" : ' loading="lazy"') + ' decoding="async">' : silhouette(v);
  }
  function badges(v) {
    var b = "";
    if (v.example) b += '<span class="badge badge--ghost">Exemple</span>';
    if (v.status === "reserve") b += '<span class="badge badge--warn">Réservé</span>';
    if (v.status === "vendu") b += '<span class="badge badge--muted">Vendu</span>';
    return b;
  }
  function card(v) {
    var specs = [];
    if (v.year) specs.push(icon("cal") + v.year);
    if (v.mileage != null) specs.push(icon("gauge") + esc(km(v.mileage)));
    if (v.fuel) specs.push(icon("fuel") + esc(label("fuel", v.fuel)));
    if (v.transmission) specs.push(icon("gear") + esc(label("transmission", v.transmission)));
    return '<article class="vcard' + (v.status === "vendu" ? " is-sold" : "") + '" data-glow data-tilt>' +
      '<div class="vcard__media">' + media(v) + '<div class="vcard__badges">' + badges(v) + "</div></div>" +
      '<div class="vcard__body">' +
      '<p class="vcard__kicker">' + esc(label("body", v.body)) + "</p>" +
      '<h3 class="vcard__title"><a href="' + vurl(v) + '">' + esc(v.title) + "</a></h3>" +
      (v.version ? '<p class="vcard__version">' + esc(v.version) + "</p>" : "") +
      '<ul class="vcard__specs">' + specs.map(function (s) { return "<li>" + s + "</li>"; }).join("") + "</ul>" +
      '<div class="vcard__foot"><span class="vcard__price' + (v.price == null ? " is-por" : "") + '">' + esc(price(v)) + '</span><span class="vcard__go">' + icon("arrow") + "</span></div>" +
      "</div></article>";
  }

  /* ---------- Contact ---------- */
  var C = SITE.contact || {};
  var tel = C.phone ? "tel:" + String(C.phone).replace(/[^\d+]/g, "") : "";
  var wa = String(C.whatsapp || "").replace(/\D/g, "");
  function waLink(text) { return wa ? "https://wa.me/" + wa + (text ? "?text=" + encodeURIComponent(text) : "") : ""; }

  /* ---------- En-tête ---------- */
  function initHeader() {
    var nav = $("[data-nav]");
    if (SITE.demo) { var bar = $("[data-demo-bar]"); if (bar) bar.hidden = false; root.classList.add("has-demo"); }
    var onScroll = function () { nav && nav.classList.toggle("is-scrolled", scrollY > 24); };
    addEventListener("scroll", onScroll, { passive: true }); onScroll();

    $$("[data-call]").forEach(function (a) {
      if (!tel) return;
      a.href = tel; a.hidden = false;
      var l = $("[data-phone-label]", a); if (l && C.phone_display) l.textContent = C.phone_display;
    });

    var page = document.body.getAttribute("data-page");
    $$("[data-nav-link]").forEach(function (a) { if (a.getAttribute("data-nav-link") === page) a.setAttribute("aria-current", "page"); });

    var burger = $("[data-burger]"), menu = $("[data-menu]");
    if (burger && menu) {
      function setOpen(open) {
        burger.setAttribute("aria-expanded", String(open));
        root.classList.toggle("menu-open", open);
        if (open) { menu.hidden = false; requestAnimationFrame(function () { menu.classList.add("is-open"); }); $("a", menu).focus(); }
        else { menu.classList.remove("is-open"); setTimeout(function () { if (!menu.classList.contains("is-open")) menu.hidden = true; }, 400); }
      }
      burger.addEventListener("click", function () { setOpen(burger.getAttribute("aria-expanded") !== "true"); });
      addEventListener("keydown", function (e) { if (e.key === "Escape" && burger.getAttribute("aria-expanded") === "true") { setOpen(false); burger.focus(); } });
    }
  }

  /* ---------- Pied + dock mobile ---------- */
  function initFooter() {
    var L = SITE.legal || {};
    $$("[data-legal-owner]").forEach(function (e) { e.textContent = L.owner ? L.owner + " EI · SIREN " + L.siren : ""; });
    var list = $("[data-footer-contact]");
    if (list) {
      var items = [];
      if (tel) items.push('<li><a href="' + esc(tel) + '">' + esc(C.phone_display || C.phone) + "</a></li>");
      if (wa) items.push('<li><a href="' + esc(waLink()) + '" target="_blank" rel="noopener">WhatsApp</a></li>');
      if (C.email) items.push('<li><a href="mailto:' + esc(C.email) + '">' + esc(C.email) + "</a></li>");
      items.push("<li>" + esc(C.showroom_address || C.district || "Marseille") + "</li>");
      items.push('<li><a href="/contact">Formulaire de contact</a></li>');
      list.innerHTML = items.join("");
    }
    var dock = $("[data-dock]");
    if (dock) {
      var b = [];
      if (tel) b.push('<a href="' + esc(tel) + '">' + icon("phone") + "<span>Appeler</span></a>");
      if (wa) b.push('<a href="' + esc(waLink("Bonjour, je vous contacte depuis votre site.")) + '" target="_blank" rel="noopener">' + icon("wa") + "<span>WhatsApp</span></a>");
      if (document.body.getAttribute("data-page") !== "vehicules") b.push('<a href="/vehicules">' + icon("search") + "<span>Véhicules</span></a>");
      b.push('<a href="/contact" class="is-primary">' + icon("mail") + "<span>Écrire</span></a>");
      dock.innerHTML = b.join("");
      var showDock = function () { dock.classList.toggle("is-visible", scrollY > 280); };
      addEventListener("scroll", showDock, { passive: true }); showDock();
    }
  }

  /* ---------- Animations ---------- */
  function split(el) {
    if (el.getAttribute("data-split-done")) return;
    var text = el.textContent.trim();
    el.setAttribute("aria-label", text);
    el.innerHTML = text.split(" ").map(function (w) {
      return '<span class="w" aria-hidden="true">' + Array.prototype.map.call(w, function (ch) {
        return '<span class="ch">' + esc(ch) + "</span>";
      }).join("") + "</span>";
    }).join(" ");
    $$(".ch", el).forEach(function (c, i) { c.style.setProperty("--i", i); });
    el.setAttribute("data-split-done", "1");
  }

  function initReveal() {
    var els = $$("[data-reveal]");
    if (reduce || !("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("is-in"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target, sib = el.parentElement ? $$(":scope > [data-reveal]", el.parentElement) : [];
        el.style.setProperty("--d", Math.max(0, sib.indexOf(el)) * 70 + "ms");
        el.classList.add("is-in");
        io.unobserve(el);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    els.forEach(function (e) { io.observe(e); });
    window.__observeReveal = function (scope) { $$("[data-reveal]:not(.is-in)", scope).forEach(function (e) { io.observe(e); }); };
  }

  function initPointerFx() {
    if (reduce || !matchMedia("(hover: hover)").matches) return;
    document.addEventListener("pointermove", function (e) {
      var g = e.target.closest && e.target.closest("[data-glow]");
      if (g) {
        var r = g.getBoundingClientRect();
        g.style.setProperty("--mx", (e.clientX - r.left) + "px");
        g.style.setProperty("--my", (e.clientY - r.top) + "px");
        if (g.hasAttribute("data-tilt")) {
          g.style.setProperty("--rx", ((e.clientY - r.top) / r.height - 0.5) * -5 + "deg");
          g.style.setProperty("--ry", ((e.clientX - r.left) / r.width - 0.5) * 6 + "deg");
        }
      }
    }, { passive: true });
    document.addEventListener("pointerout", function (e) {
      var g = e.target.closest && e.target.closest("[data-tilt]");
      if (g && !g.contains(e.relatedTarget)) { g.style.setProperty("--rx", "0deg"); g.style.setProperty("--ry", "0deg"); }
    });
    $$("[data-magnetic]").forEach(function (b) {
      b.addEventListener("pointermove", function (e) {
        var r = b.getBoundingClientRect();
        b.style.transform = "translate(" + (e.clientX - r.left - r.width / 2) * 0.18 + "px," + (e.clientY - r.top - r.height / 2) * 0.3 + "px)";
      });
      b.addEventListener("pointerleave", function () { b.style.transform = ""; });
    });
  }

  function initParallax() {
    var els = $$("[data-parallax]");
    if (reduce || !els.length) return;
    var tick = false;
    function run() {
      tick = false;
      els.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return;
        var p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
        el.style.setProperty("--py", (p * Number(el.getAttribute("data-parallax")) * -100).toFixed(2) + "%");
      });
    }
    addEventListener("scroll", function () { if (!tick) { tick = true; requestAnimationFrame(run); } }, { passive: true });
    run();
  }

  /* ---------- Transitions de page ---------- */
  function initTransitions() {
    requestAnimationFrame(function () { root.classList.add("is-loaded"); });
    addEventListener("pageshow", function (e) { if (e.persisted) root.classList.remove("is-leaving"); });
    if (reduce) return;
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target === "_blank" || a.hasAttribute("download") || a.hasAttribute("data-no-transition")) return;
      var url = new URL(a.href, location.href);
      if (url.origin !== location.origin || /^(mailto|tel):/.test(a.href)) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      e.preventDefault();
      root.classList.add("is-leaving");
      setTimeout(function () { location.href = url.href; }, 520);
    });
  }

  window.DZ = {
    SITE: SITE, vehicles: vehicles, usingExamples: usingExamples, reduce: reduce,
    esc: esc, $: $, $$: $$, nf: nf, price: price, km: km, icon: icon, label: label, LABELS: LABELS,
    card: card, media: media, badges: badges, silhouette: silhouette, vurl: vurl, split: split, safeUrl: safeUrl,
    tel: tel, wa: wa, waLink: waLink,
    observe: function (scope) { if (window.__observeReveal) window.__observeReveal(scope); else $$("[data-reveal]", scope).forEach(function (e) { e.classList.add("is-in"); }); }
  };

  $$("[data-split]").forEach(split);
  initHeader(); initFooter(); initReveal(); initPointerFx(); initParallax(); initTransitions();
})();
