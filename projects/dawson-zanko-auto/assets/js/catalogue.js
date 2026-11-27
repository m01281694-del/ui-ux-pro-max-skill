/* Catalogue : recherche intelligente + filtres synchronisés + URL partageable. */
(function () {
  "use strict";
  var DZ = window.DZ, $ = DZ.$, $$ = DZ.$$, esc = DZ.esc, S = window.SmartSearch;
  var all = DZ.vehicles.filter(function (v) { return v.status !== "vendu"; });
  var F = $("[data-filters]"), grid = $("[data-grid]"), smart = $("[data-smart]");
  var KEYS = ["brand", "model", "priceMin", "priceMax", "kmMax", "yearMin", "fuel", "transmission", "body"];
  var state = { q: "", sort: "relevance" };

  function uniq(k) { var m = {}; all.forEach(function (v) { if (v[k]) m[v[k]] = (m[v[k]] || 0) + 1; }); return m; }
  var brands = Object.keys(uniq("brand")).sort(), models = Object.keys(uniq("model"));

  /* ---------- Construction des filtres ---------- */
  function options(sel, map, first) {
    sel.innerHTML = '<option value="">' + first + "</option>" + Object.keys(map).sort().map(function (k) { return '<option value="' + esc(k) + '">' + esc(k) + " (" + map[k] + ")</option>"; }).join("");
  }
  options(F.brand, uniq("brand"), "Toutes les marques");
  function fillModels() {
    var m = {}; all.forEach(function (v) { if (v.model && (!state.brand || v.brand === state.brand)) m[v.model] = (m[v.model] || 0) + 1; });
    options(F.model, m, "Tous les modèles");
    F.model.value = state.model || "";
  }
  var years = all.map(function (v) { return v.year; }).filter(Boolean);
  var y0 = years.length ? Math.min.apply(null, years) : 2015, y1 = new Date().getFullYear();
  F.yearMin.innerHTML = '<option value="">Indifférente</option>' + Array.from({ length: Math.max(0, y1 - y0 + 1) }, function (_, i) { return y1 - i; }).map(function (y) { return '<option value="' + y + '">' + y + "</option>"; }).join("");
  ["fuel", "transmission", "body"].forEach(function (k) {
    var present = uniq(k);
    $('[data-pills="' + k + '"]').innerHTML = Object.keys(DZ.LABELS[k]).filter(function (x) { return present[x]; }).map(function (x) {
      return '<label class="pill"><input type="radio" name="' + k + '" value="' + x + '"><span>' + esc(DZ.label(k, x)) + "</span></label>";
    }).join("") || '<span class="muted small">—</span>';
  });
  // Un clic sur une pastille déjà active la désactive
  $$(".pill input", F).forEach(function (r) {
    r.addEventListener("click", function () { if (state[r.name] === r.value) { r.checked = false; state[r.name] = ""; apply(); } });
  });

  /* ---------- État ---------- */
  function fromUrl() {
    var p = new URLSearchParams(location.search);
    state.q = p.get("q") || ""; state.sort = p.get("sort") || "relevance";
    KEYS.forEach(function (k) { state[k] = p.get(k) || ""; });
    if (state.q) absorbQuery(state.q);
  }
  function toUrl() {
    var p = new URLSearchParams();
    if (state.q) p.set("q", state.q);
    KEYS.forEach(function (k) { if (state[k]) p.set(k, state[k]); });
    if (state.sort !== "relevance") p.set("sort", state.sort);
    var qs = p.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
  }
  function toForm() {
    F.brand.value = state.brand || ""; fillModels();
    ["priceMin", "priceMax", "kmMax", "yearMin"].forEach(function (k) {
      var el = F[k]; el.value = state[k] || "";
      if (el.tagName === "SELECT" && state[k] && el.value !== String(state[k])) {
        var o = document.createElement("option"); o.value = state[k]; o.textContent = DZ.nf(state[k]) + (k === "kmMax" ? " km" : ""); el.appendChild(o); el.value = state[k];
      }
    });
    ["fuel", "transmission", "body"].forEach(function (k) { $$('[name="' + k + '"]', F).forEach(function (r) { r.checked = r.value === state[k]; }); });
    $("[data-sort]").value = state.sort;
    smart.q.value = state.q;
  }
  function fromForm() {
    var prevBrand = state.brand;
    state.brand = F.brand.value;
    state.model = prevBrand !== state.brand ? "" : F.model.value;
    ["priceMin", "priceMax", "kmMax", "yearMin"].forEach(function (k) { state[k] = F[k].value; });
    ["fuel", "transmission", "body"].forEach(function (k) { var c = $('[name="' + k + '"]:checked', F); state[k] = c ? c.value : ""; });
  }

  /* La phrase est traduite en filtres visibles ; seuls les mots non compris restent en texte libre. */
  var understood = [];
  function absorbQuery(q) {
    var c = S.parse(q, { brands: brands, models: models });
    understood = [];
    var map = { brand: "brand", model: "model", priceMin: "priceMin", priceMax: "priceMax", kmMax: "kmMax", yearMin: "yearMin", fuel: "fuel", transmission: "transmission", body: "body" };
    Object.keys(map).forEach(function (k) { if (c[k] != null && c[k] !== "") { state[map[k]] = String(c[k]); understood.push(k); } });
    state.text = c.text || "";
    state.yearMax = c.yearMax || "";
  }

  function chipLabel(k) {
    var v = state[k];
    return { brand: v, model: v, priceMin: "≥ " + DZ.nf(v) + " €", priceMax: "≤ " + DZ.nf(v) + " €", kmMax: "≤ " + DZ.nf(v) + " km", yearMin: "depuis " + v, fuel: DZ.label("fuel", v), transmission: DZ.label("transmission", v), body: DZ.label("body", v) }[k];
  }
  function renderUnderstood() {
    var box = $("[data-understood]"), active = KEYS.filter(function (k) { return state[k]; });
    if (!active.length && !state.text) { box.innerHTML = '<span>Essayez :</span>' + ["citadine essence moins de 15k", "SUV automatique récent", "diesel moins de 80 000 km"].map(function (s) { return '<button type="button" class="chip" data-try="' + esc(s) + '">' + esc(s) + "</button>"; }).join(""); return; }
    box.innerHTML = (understood.length ? "<span>Compris :</span>" : "<span>Filtres :</span>") +
      active.map(function (k) { return '<button type="button" class="chip" data-clear="' + k + '" aria-label="Retirer ' + esc(chipLabel(k)) + '">' + esc(chipLabel(k)) + DZ.icon("close") + "</button>"; }).join("") +
      (state.text ? '<button type="button" class="chip" data-clear="text">« ' + esc(state.text) + " »" + DZ.icon("close") + "</button>" : "");
  }

  /* ---------- Rendu ---------- */
  var SORTS = {
    "price-asc": function (a, b) { return (a.price == null) - (b.price == null) || a.price - b.price; },
    "price-desc": function (a, b) { return (a.price == null) - (b.price == null) || b.price - a.price; },
    "km-asc": function (a, b) { return (a.mileage == null) - (b.mileage == null) || a.mileage - b.mileage; },
    "year-desc": function (a, b) { return (b.year || 0) - (a.year || 0); },
    relevance: function (a, b) { return (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || a._i - b._i; }
  };
  function apply(skipForm) {
    if (!skipForm) fromForm();
    var crit = {};
    KEYS.forEach(function (k) { if (state[k]) crit[k] = /^(price|km|year)/.test(k) ? Number(state[k]) : state[k]; });
    crit.text = state.text || ""; if (state.yearMax) crit.yearMax = Number(state.yearMax);
    var res = all.filter(function (v) { return S.matches(v, crit); }).sort(SORTS[state.sort] || SORTS.relevance);
    $("[data-count]").innerHTML = "<strong>" + res.length + "</strong> véhicule" + (res.length > 1 ? "s" : "") + (DZ.usingExamples ? ' <span class="badge badge--ghost">Exemples</span>' : "");
    grid.innerHTML = res.length ? res.map(DZ.card).join("") :
      '<div class="empty glass" style="grid-column:1/-1"><h3>' + (all.length ? "Aucun véhicule ne correspond… pour l'instant." : "Nouveaux arrivages en préparation") + '</h3><p class="muted">Confiez-nous votre recherche : nous vous recontactons dès qu\'un véhicule correspond.</p><div class="row-btns" style="justify-content:center">' +
      (all.length ? '<button type="button" class="btn btn--ghost" data-reset>Effacer les filtres</button>' : "") + '<a class="btn btn--light" href="contact.html?sujet=recherche">Recherche personnalisée</a></div></div>';
    renderUnderstood(); toUrl();
  }

  /* ---------- Événements ---------- */
  F.addEventListener("change", function () { understood = []; apply(); });
  F.addEventListener("input", function (e) { if (e.target.type === "number") { clearTimeout(F._t); F._t = setTimeout(apply, 350); } });
  $("[data-sort]").addEventListener("change", function (e) { state.sort = e.target.value; apply(true); });
  smart.addEventListener("submit", function (e) {
    e.preventDefault();
    KEYS.forEach(function (k) { state[k] = ""; });
    state.q = smart.q.value.trim();
    absorbQuery(state.q); toForm(); apply(true);
    if (innerWidth < 1100) grid.scrollIntoView({ behavior: DZ.reduce ? "auto" : "smooth", block: "start" });
  });
  var live;
  smart.q.addEventListener("input", function () {
    clearTimeout(live);
    live = setTimeout(function () { KEYS.forEach(function (k) { state[k] = ""; }); state.q = smart.q.value.trim(); absorbQuery(state.q); toForm(); apply(true); }, 280);
  });
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-try],[data-clear],[data-reset]");
    if (!t) return;
    if (t.hasAttribute("data-try")) { smart.q.value = t.getAttribute("data-try"); smart.requestSubmit ? smart.requestSubmit() : smart.dispatchEvent(new Event("submit")); return; }
    if (t.hasAttribute("data-clear")) { var k = t.getAttribute("data-clear"); state[k] = ""; if (k === "brand") state.model = ""; }
    if (t.hasAttribute("data-reset")) { KEYS.forEach(function (k) { state[k] = ""; }); state.text = ""; }
    state.q = ""; understood = []; toForm(); apply(true);
  });
  var open = $("[data-filters-open]"), close = $("[data-filters-close]");
  function setOpen(o) { F.classList.toggle("is-open", o); document.documentElement.classList.toggle("menu-open", o); if (o) F.brand.focus(); else open.focus(); }
  open.addEventListener("click", function () { setOpen(true); });
  close.addEventListener("click", function () { setOpen(false); });
  addEventListener("keydown", function (e) { if (e.key === "Escape" && F.classList.contains("is-open")) setOpen(false); });

  fromUrl(); toForm(); apply(true);
})();
