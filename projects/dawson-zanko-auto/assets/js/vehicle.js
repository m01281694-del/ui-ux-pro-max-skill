/* Fiche véhicule : galerie + visionneuse, caractéristiques, demandes, similaires, JSON-LD. */
(function () {
  "use strict";
  var DZ = window.DZ, $ = DZ.$, $$ = DZ.$$, esc = DZ.esc;
  var mount = $("[data-vehicle]");
  var id = new URLSearchParams(location.search).get("id") || decodeURIComponent(location.hash.slice(1)) || "";
  var v = DZ.vehicles.filter(function (x) { return x.id === id; })[0];

  if (!v) {
    document.title = "Véhicule introuvable | " + DZ.SITE.brand.name;
    mount.innerHTML = '<div class="empty glass" style="margin:40px 0 120px"><h1 class="display display--md">Véhicule introuvable</h1><p class="muted">Ce véhicule n\'est plus en ligne ou l\'adresse est incorrecte.</p><a class="btn btn--light" href="vehicules.html">Voir le stock</a></div>';
    return;
  }

  document.title = v.label + " — " + DZ.price(v) + " | " + DZ.SITE.brand.name;
  var md = $('meta[name="description"]');
  if (md) md.setAttribute("content", [v.label, DZ.km(v.mileage), DZ.label("fuel", v.fuel), DZ.label("transmission", v.transmission), DZ.price(v), "à Marseille"].filter(Boolean).join(" · "));

  function row(k, val) { return val || val === 0 ? '<tr><th scope="row">' + k + "</th><td>" + esc(val) + "</td></tr>" : ""; }
  var key = [
    ["cal", "Année", v.year], ["gauge", "Kilométrage", DZ.km(v.mileage)],
    ["fuel", "Énergie", DZ.label("fuel", v.fuel)], ["gear", "Boîte", DZ.label("transmission", v.transmission)]
  ].filter(function (k) { return k[2]; });
  var table = [
    row("Marque", v.brand), row("Modèle", v.model), row("Version", v.version), row("Carrosserie", DZ.label("body", v.body)),
    row("Année", v.year), row("1re mise en circulation", v.first_registration ? new Date(v.first_registration).toLocaleDateString("fr-FR") : ""),
    row("Kilométrage", DZ.km(v.mileage)), row("Énergie", DZ.label("fuel", v.fuel)), row("Boîte de vitesses", DZ.label("transmission", v.transmission)),
    row("Puissance", v.power_hp ? v.power_hp + " ch" : ""), row("Puissance fiscale", v.fiscal_hp ? v.fiscal_hp + " CV" : ""),
    row("Portes", v.doors), row("Places", v.seats), row("Couleur", v.color), row("Crit'Air", v.critair),
    row("Émissions CO₂", v.co2 ? v.co2 + " g/km" : ""), row("Propriétaires précédents", v.owners)
  ].join("");
  var photos = v.photos;

  var html =
    '<nav class="crumbs" aria-label="Fil d\'Ariane"><a href="index.html">Accueil</a><span aria-hidden="true">/</span><a href="vehicules.html">Véhicules</a><span aria-hidden="true">/</span><span aria-current="page">' + esc(v.title) + "</span></nav>" +
    (v.example ? '<p class="notice" style="margin-bottom:24px">Fiche d\'<strong>exemple</strong> (maquette) : ce véhicule n\'est pas à vendre.</p>' : "") +
    '<div class="vlayout"><div>' +
    '<div class="gallery" data-reveal><div class="gallery__main' + (photos.length ? "" : " no-photo") + '" data-main' + (photos.length ? ' role="button" tabindex="0" aria-label="Agrandir la photo"' : "") + ">" + DZ.media(v, true) +
    (photos.length > 1 ? '<span class="badge gallery__count" data-counter>1 / ' + photos.length + "</span>" : "") + "</div>" +
    (photos.length > 1 ? '<div class="gallery__thumbs">' + photos.map(function (p, i) { return '<button type="button" data-thumb="' + i + '" aria-label="Photo ' + (i + 1) + '"' + (i ? "" : ' aria-current="true"') + '><img src="' + esc(p.src) + '" alt="" loading="lazy"></button>'; }).join("") + "</div>" : "") +
    "</div>" +
    (key.length ? '<div class="keyspecs" data-reveal>' + key.map(function (k) { return '<div class="keyspec">' + DZ.icon(k[0]) + "<span>" + k[1] + "</span><strong>" + esc(k[2]) + "</strong></div>"; }).join("") + "</div>" : "") +
    (v.description ? '<section class="vsec" data-reveal><h2>Présentation</h2><div class="prose">' + String(v.description).split(/\n{2,}/).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + "</div></section>" : "") +
    (v.equipment.length ? '<section class="vsec" data-reveal><h2>Équipements</h2><ul class="equip">' + v.equipment.map(function (e) { return "<li>" + DZ.icon("check") + "<span>" + esc(e) + "</span></li>"; }).join("") + "</ul></section>" : "") +
    '<section class="vsec" data-reveal><h2>Caractéristiques</h2><table class="spec-table"><tbody>' + table + "</tbody></table></section>" +
    '<section class="vsec" id="demande" data-reveal><h2>Votre demande</h2>' +
    '<div class="tabs" role="tablist" aria-label="Type de demande"><button type="button" role="tab" id="t-info" aria-controls="p-info" aria-selected="true">Renseignements</button><button type="button" role="tab" id="t-essai" aria-controls="p-essai" aria-selected="false" tabindex="-1">Demande d\'essai</button></div>' +
    '<div class="panel" role="tabpanel" id="p-info" aria-labelledby="t-info" data-form-info></div><div class="panel" role="tabpanel" id="p-essai" aria-labelledby="t-essai" data-form-essai hidden></div></section>' +
    "</div>" +
    '<aside class="vaside"><div class="pricebox glass" data-reveal>' +
    '<div class="row-btns">' + DZ.badges(v) + "</div>" +
    '<p class="pricebox__kicker">' + esc(DZ.label("body", v.body) || "Véhicule d'occasion") + "</p>" +
    "<h1>" + esc(v.title) + "</h1>" + (v.version ? '<p class="pricebox__version">' + esc(v.version) + "</p>" : "") +
    '<p class="pricebox__price">' + esc(DZ.price(v)) + "</p>" + (v.price != null ? '<p class="pricebox__note">Prix TTC</p>' : "") +
    '<div class="pricebox__actions">' +
    '<a class="btn btn--light btn--block" href="#demande" data-tab="essai" data-no-transition>' + DZ.icon("key") + "<span>Demander un essai</span></a>" +
    '<a class="btn btn--ghost btn--block" href="#demande" data-tab="info" data-no-transition>' + DZ.icon("mail") + "<span>Demander des renseignements</span></a>" +
    (DZ.tel ? '<a class="btn btn--ghost btn--block" href="' + esc(DZ.tel) + '">' + DZ.icon("phone") + "<span>Appeler</span></a>" : "") +
    (DZ.wa ? '<a class="btn btn--ghost btn--block" target="_blank" rel="noopener" href="' + esc(DZ.waLink("Bonjour, je suis intéressé(e) par : " + v.label + " (" + DZ.price(v) + ")")) + '">' + DZ.icon("wa") + "<span>WhatsApp</span></a>" : "") +
    "</div>" +
    '<p class="pricebox__note">' + DZ.icon("pin") + " " + esc(DZ.SITE.contact.showroom_address || DZ.SITE.contact.district) + "</p>" +
    "</div></aside></div>";

  var similar = DZ.vehicles.filter(function (x) { return x.id !== v.id && x.status !== "vendu"; })
    .map(function (x) { return { x: x, s: (x.body === v.body ? 3 : 0) + (x.brand === v.brand ? 2 : 0) + (x.fuel === v.fuel ? 1 : 0) - (v.price && x.price ? Math.abs(x.price - v.price) / 10000 : 0) }; })
    .sort(function (a, b) { return b.s - a.s; }).slice(0, 3).map(function (o) { return o.x; });
  if (similar.length) html += '<section class="vsec" style="padding-bottom:120px"><h2>Vous aimerez aussi</h2><div class="grid">' + similar.map(DZ.card).join("") + "</div></section>";
  mount.innerHTML = html;

  /* Formulaires + onglets */
  window.DZForms.mount($("[data-form-info]"), "info", { vehicle: v });
  window.DZForms.mount($("[data-form-essai]"), "essai", { vehicle: v });
  var tabs = $$('[role="tab"]', mount);
  function select(name, focus) {
    tabs.forEach(function (t) {
      var on = t.id === "t-" + name;
      t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1;
      $("#" + t.getAttribute("aria-controls")).hidden = !on;
      if (on && focus) t.focus();
    });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { select(t.id.slice(2)); });
    t.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") { var n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]; select(n.id.slice(2), true); }
    });
  });
  $$("[data-tab]", mount).forEach(function (a) { a.addEventListener("click", function () { select(a.getAttribute("data-tab")); }); });
  if (location.hash === "#essai") select("essai");

  /* Galerie + visionneuse */
  if (photos.length) {
    var idx = 0, main = $("[data-main]", mount);
    function show(i) {
      idx = (i + photos.length) % photos.length;
      var img = $("img", main); img.src = photos[idx].src; img.alt = photos[idx].alt || v.label;
      var c = $("[data-counter]", mount); if (c) c.textContent = (idx + 1) + " / " + photos.length;
      $$("[data-thumb]", mount).forEach(function (b, j) { b.setAttribute("aria-current", String(j === idx)); });
    }
    $$("[data-thumb]", mount).forEach(function (b) { b.addEventListener("click", function () { show(Number(b.getAttribute("data-thumb"))); }); });
    function lightbox() {
      var lb = document.createElement("div");
      lb.className = "lightbox"; lb.setAttribute("role", "dialog"); lb.setAttribute("aria-modal", "true"); lb.setAttribute("aria-label", "Photos du véhicule");
      lb.innerHTML = '<img alt=""><button class="round" data-lb-close aria-label="Fermer">' + DZ.icon("close") + "</button>" +
        (photos.length > 1 ? '<button class="round" data-lb="-1" aria-label="Photo précédente"><svg class="i" style="transform:rotate(180deg)" aria-hidden="true"><use href="#i-arrow"/></svg></button><button class="round" data-lb="1" aria-label="Photo suivante">' + DZ.icon("arrow") + "</button>" : "");
      document.body.appendChild(lb);
      var img = $("img", lb), x0 = null;
      function draw() { img.src = photos[idx].src; img.alt = photos[idx].alt || v.label; }
      function close() { lb.remove(); removeEventListener("keydown", key); document.documentElement.classList.remove("menu-open"); show(idx); main.focus(); }
      function key(e) { if (e.key === "Escape") close(); if (e.key === "ArrowRight") { idx = (idx + 1) % photos.length; draw(); } if (e.key === "ArrowLeft") { idx = (idx - 1 + photos.length) % photos.length; draw(); } if (e.key === "Tab") { e.preventDefault(); $("[data-lb-close]", lb).focus(); } }
      lb.addEventListener("click", function (e) {
        var b = e.target.closest("[data-lb],[data-lb-close]");
        if (e.target === lb || (b && b.hasAttribute("data-lb-close"))) return close();
        if (b) { idx = (idx + Number(b.getAttribute("data-lb")) + photos.length) % photos.length; draw(); }
      });
      lb.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
      lb.addEventListener("touchend", function (e) { if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) { idx = (idx + (dx < 0 ? 1 : -1) + photos.length) % photos.length; draw(); } x0 = null; });
      addEventListener("keydown", key);
      document.documentElement.classList.add("menu-open");
      draw(); $("[data-lb-close]", lb).focus();
    }
    main.addEventListener("click", lightbox);
    main.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); lightbox(); } });
  }

  /* Données structurées (jamais pour les exemples) */
  if (!v.example) {
    var ld = {
      "@context": "https://schema.org", "@type": "Car", name: v.label, brand: { "@type": "Brand", name: v.brand }, model: v.model,
      vehicleConfiguration: v.version || undefined, bodyType: DZ.label("body", v.body) || undefined, productionDate: v.year ? String(v.year) : undefined,
      mileageFromOdometer: v.mileage != null ? { "@type": "QuantitativeValue", value: v.mileage, unitCode: "KMT" } : undefined,
      fuelType: DZ.label("fuel", v.fuel) || undefined, vehicleTransmission: DZ.label("transmission", v.transmission) || undefined,
      color: v.color || undefined, numberOfDoors: v.doors || undefined, seatingCapacity: v.seats || undefined, itemCondition: "https://schema.org/UsedCondition",
      image: photos.length ? photos.map(function (p) { return new URL(p.src, location.origin).href; }) : undefined,
      offers: v.price != null ? { "@type": "Offer", price: v.price, priceCurrency: "EUR", availability: v.status === "reserve" ? "https://schema.org/LimitedAvailability" : "https://schema.org/InStock", seller: { "@type": "AutoDealer", name: DZ.SITE.brand.name } } : undefined
    };
    var s = document.createElement("script"); s.type = "application/ld+json"; s.textContent = JSON.stringify(ld); document.head.appendChild(s);
  } else {
    var robots = $('meta[name="robots"]'); if (robots) robots.setAttribute("content", "noindex, nofollow");
  }
  DZ.observe(mount);
})();
