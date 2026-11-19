/* =====================================================================
   CAP AUTO SEPTÈMES — Catalogue : filtres, tri, pagination
   Les options de filtre (marques, carrosseries, énergies…) sont
   générées AUTOMATIQUEMENT à partir des véhicules saisis.
   Les filtres sont reflétés dans l'adresse (partage / retour arrière).
   ===================================================================== */
(function () {
  "use strict";
  var CAP = window.CAP, V = window.CAPVehicles;
  var root = document.querySelector("[data-catalogue]");
  if (!root) return;

  var PAGE_SIZE = 12;
  var all = V.all;
  var state = readUrl();
  var shown = PAGE_SIZE;

  var els = {
    filters: root.querySelector(".filters"),
    grid: root.querySelector("[data-results]"),
    count: root.querySelector("[data-count]"),
    sort: root.querySelector("[data-sort]"),
    active: root.querySelector("[data-active]"),
    more: root.querySelector("[data-more]"),
    open: root.querySelector("[data-filters-open]"),
    backdrop: document.querySelector("[data-filters-backdrop]")
  };

  /* ---------- Options dérivées des données ---------- */
  function uniq(key, labelGroup) {
    var map = {};
    all.forEach(function (v) { if (v[key]) map[v[key]] = (map[v[key]] || 0) + 1; });
    return Object.keys(map).sort(function (a, b) { return a.localeCompare(b, "fr"); }).map(function (k) {
      return { value: k, label: labelGroup ? CAP.label(labelGroup, k) : k, count: map[k] };
    });
  }
  function range(key) {
    var vals = all.map(function (v) { return v[key]; }).filter(function (x) { return x != null; });
    return vals.length ? { min: Math.min.apply(null, vals), max: Math.max.apply(null, vals) } : null;
  }

  function chipsHtml(name, options) {
    if (!options.length) return '<p class="filters__empty">Aucune option pour le moment.</p>';
    return '<div class="chips">' + options.map(function (o) {
      var checked = (state[name] || []).indexOf(o.value) > -1;
      return '<label class="chip"><input type="checkbox" name="' + name + '" value="' + CAP.esc(o.value) + '"' + (checked ? " checked" : "") + "><span>" + CAP.esc(o.label) + " (" + o.count + ")</span></label>";
    }).join("") + "</div>";
  }

  function buildFilters() {
    var brands = uniq("brand");
    var price = range("price"), km = range("mileage"), year = range("year");
    var years = [];
    if (year) for (var y = year.max; y >= year.min; y--) years.push(y);

    els.filters.innerHTML =
      '<div class="filters__head"><h2 class="filters__title">Filtres</h2>' +
      '<button type="button" class="filters__reset" data-reset>Réinitialiser</button></div>' +
      '<div class="field"><label for="f-q">Recherche</label><input class="input" id="f-q" name="q" type="search" placeholder="Marque, modèle, version…" value="' + CAP.esc(state.q || "") + '"></div>' +
      '<div class="field"><label for="f-brand">Marque</label><select class="select" id="f-brand" name="brand"><option value="">Toutes les marques</option>' +
      brands.map(function (b) { return '<option value="' + CAP.esc(b.value) + '"' + (state.brand === b.value ? " selected" : "") + ">" + CAP.esc(b.label) + " (" + b.count + ")</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label for="f-model">Modèle</label><select class="select" id="f-model" name="model"><option value="">Tous les modèles</option></select></div>' +
      "<fieldset><legend>Carrosserie</legend>" + chipsHtml("body", uniq("body", "body")) + "</fieldset>" +
      "<fieldset><legend>Énergie</legend>" + chipsHtml("fuel", uniq("fuel", "fuel")) + "</fieldset>" +
      "<fieldset><legend>Boîte de vitesses</legend>" + chipsHtml("transmission", uniq("transmission", "transmission")) + "</fieldset>" +
      "<fieldset><legend>Prix (€)</legend><div class=\"range-pair\">" +
      '<input class="input" name="pmin" type="number" inputmode="numeric" min="0" step="500" aria-label="Prix minimum" placeholder="Min" value="' + CAP.esc(state.pmin || "") + '">' +
      '<input class="input" name="pmax" type="number" inputmode="numeric" min="0" step="500" aria-label="Prix maximum" placeholder="Max" value="' + CAP.esc(state.pmax || "") + '">' +
      "</div></fieldset>" +
      '<div class="field"><label for="f-km">Kilométrage maximum</label><input class="input" id="f-km" name="kmax" type="number" inputmode="numeric" min="0" step="5000" placeholder="' + (km ? "Jusqu'à " + km.max : "km") + '" value="' + CAP.esc(state.kmax || "") + '"></div>' +
      '<div class="field"><label for="f-year">Année minimum</label><select class="select" id="f-year" name="ymin"><option value="">Toutes</option>' +
      years.map(function (y) { return '<option value="' + y + '"' + (String(state.ymin) === String(y) ? " selected" : "") + ">" + y + "</option>"; }).join("") + "</select></div>" +
      '<label class="check"><input type="checkbox" name="sold" value="1"' + (state.sold ? " checked" : "") + "><span>Afficher aussi les véhicules vendus</span></label>" +
      '<button type="button" class="btn btn--block filters__apply" data-filters-close>Voir les résultats</button>';
    fillModels();
  }

  function fillModels() {
    var sel = els.filters.querySelector('[name="model"]');
    var src = state.brand ? all.filter(function (v) { return v.brand === state.brand; }) : all;
    var map = {};
    src.forEach(function (v) { if (v.model) map[v.model] = (map[v.model] || 0) + 1; });
    var models = Object.keys(map).sort(function (a, b) { return a.localeCompare(b, "fr"); });
    if (state.model && !map[state.model]) state.model = "";
    sel.innerHTML = '<option value="">Tous les modèles</option>' + models.map(function (m) {
      return '<option value="' + CAP.esc(m) + '"' + (state.model === m ? " selected" : "") + ">" + CAP.esc(m) + " (" + map[m] + ")</option>";
    }).join("");
    sel.disabled = !models.length;
  }

  /* ---------- État <-> adresse ---------- */
  function readUrl() {
    var p = new URLSearchParams(location.search);
    function list(k) { var v = p.get(k); return v ? v.split(",").filter(Boolean) : []; }
    return {
      q: p.get("q") || "", brand: p.get("brand") || "", model: p.get("model") || "",
      body: list("body"), fuel: list("fuel"), transmission: list("transmission"),
      pmin: p.get("pmin") || "", pmax: p.get("pmax") || "", kmax: p.get("kmax") || "", ymin: p.get("ymin") || "",
      sold: p.get("sold") === "1", sort: p.get("sort") || "recent"
    };
  }
  function writeUrl() {
    var p = new URLSearchParams();
    Object.keys(state).forEach(function (k) {
      var v = state[k];
      if (Array.isArray(v)) { if (v.length) p.set(k, v.join(",")); }
      else if (k === "sold") { if (v) p.set(k, "1"); }
      else if (k === "sort") { if (v && v !== "recent") p.set(k, v); }
      else if (v) p.set(k, v);
    });
    var qs = p.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
  }

  function readForm() {
    var f = els.filters;
    function checked(name) { return Array.prototype.map.call(f.querySelectorAll('[name="' + name + '"]:checked'), function (i) { return i.value; }); }
    state.q = f.querySelector('[name="q"]').value.trim();
    var prevBrand = state.brand;
    state.brand = f.querySelector('[name="brand"]').value;
    if (prevBrand !== state.brand) { state.model = ""; fillModels(); }
    else state.model = f.querySelector('[name="model"]').value;
    state.body = checked("body"); state.fuel = checked("fuel"); state.transmission = checked("transmission");
    state.pmin = f.querySelector('[name="pmin"]').value; state.pmax = f.querySelector('[name="pmax"]').value;
    state.kmax = f.querySelector('[name="kmax"]').value; state.ymin = f.querySelector('[name="ymin"]').value;
    state.sold = f.querySelector('[name="sold"]').checked;
  }

  /* ---------- Filtrage ---------- */
  function norm(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function filtered() {
    var terms = norm(state.q).split(/\s+/).filter(Boolean);
    var res = all.filter(function (v) {
      if (!state.sold && v.status === "vendu") return false;
      if (state.brand && v.brand !== state.brand) return false;
      if (state.model && v.model !== state.model) return false;
      if (state.body.length && state.body.indexOf(v.body) < 0) return false;
      if (state.fuel.length && state.fuel.indexOf(v.fuel) < 0) return false;
      if (state.transmission.length && state.transmission.indexOf(v.transmission) < 0) return false;
      if (state.pmin && (v.price == null || v.price < Number(state.pmin))) return false;
      if (state.pmax && (v.price == null || v.price > Number(state.pmax))) return false;
      if (state.kmax && (v.mileage == null || v.mileage > Number(state.kmax))) return false;
      if (state.ymin && (v.year == null || v.year < Number(state.ymin))) return false;
      if (terms.length) {
        var hay = norm([v.brand, v.model, v.version, v.color, CAP.label("fuel", v.fuel), CAP.label("body", v.body)].join(" "));
        if (!terms.every(function (t) { return hay.indexOf(t) > -1; })) return false;
      }
      return true;
    });
    // Vendus toujours en fin de liste
    var sorter = V.SORTS[state.sort] || V.SORTS.recent;
    return res.sort(function (a, b) { return ((a.status === "vendu") - (b.status === "vendu")) || sorter(a, b); });
  }

  function activeChips() {
    var chips = [];
    function add(lab, clear) { chips.push({ lab: lab, clear: clear }); }
    if (state.q) add("« " + state.q + " »", function () { state.q = ""; });
    if (state.brand) add(state.brand, function () { state.brand = ""; state.model = ""; });
    if (state.model) add(state.model, function () { state.model = ""; });
    ["body", "fuel", "transmission"].forEach(function (k) {
      state[k].forEach(function (val) { add(CAP.label(k, val), function () { state[k] = state[k].filter(function (x) { return x !== val; }); }); });
    });
    if (state.pmin) add("Prix ≥ " + CAP.formatPrice(state.pmin), function () { state.pmin = ""; });
    if (state.pmax) add("Prix ≤ " + CAP.formatPrice(state.pmax), function () { state.pmax = ""; });
    if (state.kmax) add("≤ " + CAP.formatKm(state.kmax), function () { state.kmax = ""; });
    if (state.ymin) add("Depuis " + state.ymin, function () { state.ymin = ""; });
    if (state.sold) add("Vendus inclus", function () { state.sold = false; });
    els.active.innerHTML = chips.map(function (c, i) {
      return '<span class="active-filter">' + CAP.esc(c.lab) + '<button type="button" data-chip="' + i + '" aria-label="Retirer le filtre ' + CAP.esc(c.lab) + '">' + CAP.icon("close") + "</button></span>";
    }).join("");
    els.active.onclick = function (e) {
      var b = e.target.closest("[data-chip]");
      if (!b) return;
      chips[Number(b.getAttribute("data-chip"))].clear();
      buildFilters(); render(true);
    };
  }

  function render(resetPaging) {
    if (resetPaging) shown = PAGE_SIZE;
    var res = filtered();
    els.count.innerHTML = "<span>" + res.length + "</span> véhicule" + (res.length > 1 ? "s" : "");
    activeChips();
    writeUrl();

    if (!all.length) {
      var msg = CAP.get("catalogue.empty_message") || "Aucun véhicule n'est en ligne pour le moment.";
      els.grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">' + CAP.icon("car") + "<h2>" + CAP.esc(msg) + "</h2>" +
        (CAP.preview ? "<p>Le catalogue est vide. Ajoutez vos véhicules dans <code>content/vehicles.js</code> ou avec l'outil <code>/admin/</code>.</p>" : "") +
        '<a class="btn btn--ghost" href="contact.html">Nous contacter</a></div>' + V.slotCards(3);
      els.more.hidden = true;
      return;
    }
    if (!res.length) {
      els.grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">' + CAP.icon("search") +
        "<h2>Aucun véhicule ne correspond à votre recherche</h2><p>Essayez d'élargir vos critères.</p>" +
        '<button type="button" class="btn btn--ghost" data-reset>Réinitialiser les filtres</button></div>';
      els.more.hidden = true;
      return;
    }
    els.grid.innerHTML = res.slice(0, shown).map(function (v) { return V.card(v); }).join("");
    els.more.hidden = res.length <= shown;
    if (window.CAPAnim) window.CAPAnim.refresh(els.grid);
  }

  /* ---------- Événements ---------- */
  var debounce;
  function onChange(e) {
    readForm();
    clearTimeout(debounce);
    debounce = setTimeout(function () { render(true); }, e && e.type === "input" ? 220 : 0);
  }
  function reset() {
    state = { q: "", brand: "", model: "", body: [], fuel: [], transmission: [], pmin: "", pmax: "", kmax: "", ymin: "", sold: false, sort: state.sort };
    buildFilters(); render(true);
  }
  function openFilters() { els.filters.classList.add("is-open"); els.backdrop.classList.add("is-visible"); document.body.style.overflow = "hidden"; var f = els.filters.querySelector("input, select"); if (f) f.focus(); }
  function closeFilters() { els.filters.classList.remove("is-open"); els.backdrop.classList.remove("is-visible"); document.body.style.overflow = ""; els.open.focus(); }

  buildFilters();
  els.sort.value = state.sort;
  els.filters.addEventListener("input", onChange);
  els.filters.addEventListener("change", onChange);
  els.filters.addEventListener("submit", function (e) { e.preventDefault(); });
  root.addEventListener("click", function (e) {
    if (e.target.closest("[data-reset]")) reset();
    if (e.target.closest("[data-filters-close]")) closeFilters();
  });
  els.sort.addEventListener("change", function () { state.sort = els.sort.value; render(true); });
  els.more.querySelector("button").addEventListener("click", function () { shown += PAGE_SIZE; render(false); });
  els.open.addEventListener("click", openFilters);
  els.backdrop.addEventListener("click", closeFilters);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && els.filters.classList.contains("is-open")) closeFilters(); });

  render(false);
})();
