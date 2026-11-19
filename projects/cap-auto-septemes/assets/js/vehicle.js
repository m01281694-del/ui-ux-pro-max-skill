/* =====================================================================
   CAP AUTO SEPTÈMES — Fiche véhicule (vehicule.html?id=...)
   Galerie + visionneuse, caractéristiques, équipements, formulaire de
   demande pré-rempli, véhicules similaires, données structurées.
   Seuls les champs renseignés sont affichés.
   ===================================================================== */
(function () {
  "use strict";
  var CAP = window.CAP, V = window.CAPVehicles;
  var mount = document.querySelector("[data-vehicle]");
  if (!mount) return;

  var id = new URLSearchParams(location.search).get("id") || "";
  var v = V.byId(id);

  if (!v) {
    document.querySelector("[data-vehicle-title]").textContent = "Véhicule introuvable";
    mount.innerHTML = '<div class="empty-state">' + CAP.icon("car") +
      "<h2>Ce véhicule n'est plus disponible ou l'adresse est incorrecte.</h2>" +
      '<a class="btn" href="vehicules.html">Voir le catalogue ' + CAP.icon("arrow", "arrow") + "</a></div>";
    CAP.applySeo({ key: "notfound", noindex: true });
    return;
  }

  /* ---------- En-tête ---------- */
  document.querySelector("[data-vehicle-title]").textContent = v.title;
  document.querySelector("[data-vehicle-crumb]").textContent = v.title;
  var sub = document.querySelector("[data-vehicle-sub]");
  sub.textContent = [v.version, v.year].filter(Boolean).join(" · ");
  if (!sub.textContent) sub.remove();

  /* ---------- Galerie ---------- */
  var photos = v.photos;
  function galleryHtml() {
    if (!photos.length) {
      return '<div class="gallery__main">' + (CAP.preview
        ? '<div class="slot">' + CAP.icon("image") + "<strong>PHOTOS DU VÉHICULE À AJOUTER</strong><code>photos: [{ src, alt }]</code></div>"
        : '<div class="slot slot--neutral" aria-hidden="true">' + CAP.icon("car") + "</div>") + "</div>";
    }
    return '<div class="gallery__main">' +
      '<button type="button" class="gallery__zoom" aria-label="Agrandir la photo"><img src="' + CAP.esc(photos[0].src) + '" alt="' + CAP.esc(photos[0].alt || v.label) + '" fetchpriority="high"></button>' +
      (photos.length > 1
        ? '<button type="button" class="icon-btn gallery__nav gallery__nav--prev" aria-label="Photo précédente">' + CAP.icon("chevron-left") + "</button>" +
          '<button type="button" class="icon-btn gallery__nav gallery__nav--next" aria-label="Photo suivante">' + CAP.icon("chevron") + "</button>" +
          '<span class="badge gallery__counter" aria-live="polite">1 / ' + photos.length + "</span>"
        : "") +
      "</div>" +
      (photos.length > 1 ? '<div class="gallery__thumbs" role="list">' + photos.map(function (p, i) {
        return '<button type="button" class="gallery__thumb" role="listitem" data-i="' + i + '"' + (i === 0 ? ' aria-current="true"' : "") + ' aria-label="Photo ' + (i + 1) + '"><img src="' + CAP.esc(p.src) + '" alt="" loading="lazy"></button>';
      }).join("") + "</div>" : "");
  }

  /* ---------- Caractéristiques ---------- */
  var keySpecs = [
    ["calendar", "Année", v.year],
    ["gauge", "Kilométrage", v.mileage != null ? CAP.formatKm(v.mileage) : ""],
    ["fuel", "Énergie", CAP.label("fuel", v.fuel)],
    ["gear", "Boîte", CAP.label("transmission", v.transmission)],
    ["bolt", "Puissance", v.power_hp ? v.power_hp + " ch" : ""],
    ["car", "Carrosserie", CAP.label("body", v.body)]
  ].filter(function (s) { return s[2] !== "" && s[2] != null; });

  var details = [
    ["Marque", v.brand], ["Modèle", v.model], ["Version", v.version],
    ["1re mise en circulation", CAP.formatDate(v.first_registration)],
    ["Puissance fiscale", v.fiscal_hp ? v.fiscal_hp + " CV" : ""],
    ["Portes", v.doors], ["Places", v.seats], ["Couleur", v.color],
    ["Crit'Air", v.critair], ["Émissions de CO₂", v.co2 ? v.co2 + " g/km" : ""],
    ["Propriétaires précédents", v.owners], ["Garantie", v.warranty],
    ["Référence", v.id]
  ].filter(function (d) { return d[1] !== "" && d[1] != null; });

  var tel = CAP.phoneHref();
  var priceNote = v.price_note || "";
  var legalNote = CAP.get("catalogue.legal_note");

  mount.innerHTML =
    '<div class="vehicle">' +
    "<div>" +
    '<div class="gallery" data-reveal="fade">' + galleryHtml() + "</div>" +
    (keySpecs.length ? '<ul class="key-specs mt-6" data-stagger="60">' + keySpecs.map(function (s) {
      return '<li class="key-spec">' + CAP.icon(s[0]) + '<span class="k">' + s[1] + "</span><strong>" + CAP.esc(s[2]) + "</strong></li>";
    }).join("") + "</ul>" : "") +

    (v.description ? '<section class="v-section mt-7" data-reveal><h2 class="v-section__title">Description</h2><div class="prose">' + CAP.paragraphs(v.description) + "</div></section>"
      : (CAP.preview ? '<section class="v-section mt-7"><h2 class="v-section__title">Description</h2>' + CAP.todo("description", "texte de la fiche", true) + "</section>" : "")) +

    (v.equipment.length ? '<section class="v-section" data-reveal><h2 class="v-section__title">Équipements</h2><ul class="equipment">' +
      v.equipment.map(function (e) { return "<li>" + CAP.icon("check") + "<span>" + CAP.esc(e) + "</span></li>"; }).join("") + "</ul></section>" : "") +

    (details.length ? '<section class="v-section" data-reveal><h2 class="v-section__title">Caractéristiques</h2><table class="spec-table"><tbody>' +
      details.map(function (d) { return '<tr><th scope="row">' + d[0] + "</th><td>" + CAP.esc(d[1]) + "</td></tr>"; }).join("") + "</tbody></table></section>" : "") +

    (CAP.safeUrl(v.video) ? '<section class="v-section" data-reveal><h2 class="v-section__title">Vidéo</h2><div class="media-frame media-frame--wide"><video controls preload="metadata" playsinline src="' + CAP.esc(CAP.safeUrl(v.video)) + '"' + (photos[0] ? ' poster="' + CAP.esc(photos[0].src) + '"' : "") + "></video></div></section>" : "") +

    '<section class="v-section" id="demande" data-reveal><h2 class="v-section__title">Demande d\'information</h2><div class="panel" data-vehicle-form></div></section>' +
    "</div>" +

    '<aside class="vehicle-aside" aria-label="Prix et contact">' +
    '<div class="panel price-box" data-reveal="right">' +
    '<div class="flex flex-wrap gap-3 items-center">' + V.statusBadge(v) + "</div>" +
    '<p class="price-box__price mt-4">' + CAP.esc(V.priceText(v)) + "</p>" +
    (priceNote ? '<p class="price-box__note">' + CAP.esc(priceNote) + "</p>" : "") +
    (legalNote ? '<p class="price-box__note">' + CAP.esc(legalNote) + "</p>" : "") +
    '<div class="price-box__actions">' +
    (tel ? '<a class="btn btn--block" href="' + CAP.esc(tel) + '">' + CAP.icon("phone") + "<span>Appeler</span></a>" : "") +
    '<a class="btn btn--ghost btn--block" href="#demande" data-no-transition>' + CAP.icon("mail") + "<span>Demander des informations</span></a>" +
    "</div></div>" +
    '<div class="panel" data-reveal="right"><p class="panel__title">Nous trouver</p>' + CAP.contactListHtml() + "</div>" +
    "</aside></div>";

  /* Formulaire pré-rempli */
  var formBox = mount.querySelector("[data-vehicle-form]");
  formBox.innerHTML = window.CAPForms.markup({ vehicle: { id: v.id, label: v.label }, label: "Demande d'information sur ce véhicule" });
  window.CAPForms.init(formBox.querySelector("form"));

  /* ---------- Galerie interactive + visionneuse ---------- */
  if (photos.length) {
    var idx = 0;
    var main = mount.querySelector(".gallery__main");
    var img = main.querySelector("img");
    var counter = main.querySelector(".gallery__counter");
    var thumbs = mount.querySelectorAll(".gallery__thumb");
    function show(i) {
      idx = (i + photos.length) % photos.length;
      main.classList.add("is-switching");
      setTimeout(function () {
        img.src = photos[idx].src;
        img.alt = photos[idx].alt || v.label;
        main.classList.remove("is-switching");
      }, 180);
      if (counter) counter.textContent = (idx + 1) + " / " + photos.length;
      thumbs.forEach(function (t, j) { t.setAttribute("aria-current", j === idx ? "true" : "false"); });
      if (thumbs[idx]) thumbs[idx].scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    }
    thumbs.forEach(function (t) { t.addEventListener("click", function () { show(Number(t.getAttribute("data-i"))); }); });
    var prev = main.querySelector(".gallery__nav--prev"), next = main.querySelector(".gallery__nav--next");
    if (prev) prev.addEventListener("click", function () { show(idx - 1); });
    if (next) next.addEventListener("click", function () { show(idx + 1); });
    swipe(main, function () { show(idx + 1); }, function () { show(idx - 1); });

    // Visionneuse plein écran
    var lb = document.createElement("div");
    lb.className = "lightbox";
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.setAttribute("aria-label", "Photos — " + v.label);
    lb.innerHTML = '<div class="lightbox__bar"><span data-lb-count></span><button type="button" class="icon-btn" data-lb-close aria-label="Fermer">' + CAP.icon("close") + "</button></div>" +
      '<div class="lightbox__stage">' +
      (photos.length > 1 ? '<button type="button" class="icon-btn gallery__nav gallery__nav--prev" data-lb-prev aria-label="Photo précédente">' + CAP.icon("chevron-left") + "</button>" : "") +
      '<img alt="">' +
      (photos.length > 1 ? '<button type="button" class="icon-btn gallery__nav gallery__nav--next" data-lb-next aria-label="Photo suivante">' + CAP.icon("chevron") + "</button>" : "") +
      '</div><p class="lightbox__caption" data-lb-cap></p>';
    document.body.appendChild(lb);
    var lbImg = lb.querySelector("img"), lastFocus;
    function lbShow(i) {
      show(i);
      lbImg.src = photos[idx].src;
      lbImg.alt = photos[idx].alt || v.label;
      lb.querySelector("[data-lb-count]").textContent = (idx + 1) + " / " + photos.length;
      lb.querySelector("[data-lb-cap]").textContent = photos[idx].alt || "";
    }
    function lbOpen() { lastFocus = document.activeElement; lbShow(idx); lb.classList.add("is-open"); document.body.style.overflow = "hidden"; lb.querySelector("[data-lb-close]").focus(); }
    function lbClose() { lb.classList.remove("is-open"); document.body.style.overflow = ""; if (lastFocus) lastFocus.focus(); }
    main.querySelector(".gallery__zoom").addEventListener("click", lbOpen);
    lb.querySelector("[data-lb-close]").addEventListener("click", lbClose);
    if (photos.length > 1) {
      lb.querySelector("[data-lb-prev]").addEventListener("click", function () { lbShow(idx - 1); });
      lb.querySelector("[data-lb-next]").addEventListener("click", function () { lbShow(idx + 1); });
    }
    swipe(lb.querySelector(".lightbox__stage"), function () { lbShow(idx + 1); }, function () { lbShow(idx - 1); });
    lb.addEventListener("keydown", function (e) {
      if (e.key === "Escape") lbClose();
      if (e.key === "ArrowRight") lbShow(idx + 1);
      if (e.key === "ArrowLeft") lbShow(idx - 1);
      if (e.key === "Tab") CAP.trapFocus(lb, e);
    });
  }

  function swipe(el, onLeft, onRight) {
    var x0 = null;
    el.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    el.addEventListener("touchend", function (e) {
      if (x0 == null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) (dx < 0 ? onLeft : onRight)();
      x0 = null;
    });
  }

  /* ---------- Véhicules similaires ---------- */
  var similar = V.all.filter(function (o) { return o.id !== v.id && o.status !== "vendu" && (o.body === v.body || o.brand === v.brand); }).slice(0, 3);
  var simBox = document.querySelector("[data-similar]");
  if (simBox) {
    if (similar.length) simBox.querySelector("[data-similar-grid]").innerHTML = similar.map(function (o) { return V.card(o); }).join("");
    else simBox.remove();
  }

  /* ---------- SEO + données structurées (uniquement les données réelles) ---------- */
  var desc = v.description ? String(v.description).replace(/\s+/g, " ").slice(0, 155) : "";
  CAP.applySeo({ key: "vehicles", title: v.label, description: desc, query: "?id=" + encodeURIComponent(v.id), image: photos[0] && photos[0].src, ogType: "product", noindex: v.status === "vendu" });
  if (!CAP.preview) {
    var ld = { "@context": "https://schema.org", "@type": "Car", name: v.label };
    if (v.brand) ld.brand = { "@type": "Brand", name: v.brand };
    if (v.model) ld.model = v.model;
    if (v.year) ld.vehicleModelDate = String(v.year);
    if (v.mileage != null) ld.mileageFromOdometer = { "@type": "QuantitativeValue", value: v.mileage, unitCode: "KMT" };
    if (v.fuel) ld.fuelType = CAP.label("fuel", v.fuel);
    if (v.transmission) ld.vehicleTransmission = CAP.label("transmission", v.transmission);
    if (v.color) ld.color = v.color;
    if (v.body) ld.bodyType = CAP.label("body", v.body);
    if (photos.length) ld.image = photos.map(function (p) { return CAP.absUrl(p.src) || p.src; });
    if (desc) ld.description = desc;
    ld.itemCondition = "https://schema.org/UsedCondition";
    if (v.price != null) {
      ld.offers = { "@type": "Offer", price: v.price, priceCurrency: "EUR",
        availability: v.status === "vendu" ? "https://schema.org/SoldOut" : "https://schema.org/InStock" };
      if (CAP.siteName()) ld.offers.seller = { "@type": "AutoDealer", name: CAP.siteName() };
    }
    CAP.addJsonLd("ld-vehicle", ld);
  }
})();
