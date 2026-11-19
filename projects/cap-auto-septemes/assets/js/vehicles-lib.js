/* =====================================================================
   CAP AUTO SEPTÈMES — Fonctions communes aux véhicules
   (carte véhicule, libellés, tri) — utilisées par l'accueil,
   le catalogue et la fiche véhicule.
   ===================================================================== */
(function () {
  "use strict";
  var CAP = window.CAP;

  function num(v) { return v === null || v === undefined || v === "" || isNaN(Number(v)) ? null : Number(v); }

  /* Normalise une fiche (tolère les champs manquants) */
  function normalize(v, i) {
    v = v || {};
    var out = Object.assign({}, v);
    out.id = String(v.id || CAP.slugify([v.brand, v.model, v.version, v.year].filter(Boolean).join(" ")) || "vehicule-" + (i + 1));
    out.status = v.status || "disponible";
    out.year = num(v.year);
    out.mileage = num(v.mileage);
    out.price = num(v.price);
    out.power_hp = num(v.power_hp);
    out.fiscal_hp = num(v.fiscal_hp);
    out.photos = Array.isArray(v.photos) ? v.photos.map(function (p) { return typeof p === "string" ? { src: p, alt: "" } : (p || {}); }).filter(function (p) { return CAP.safeUrl(p.src); }) : [];
    out.equipment = Array.isArray(v.equipment) ? v.equipment.filter(Boolean) : [];
    out.title = [v.brand, v.model].filter(Boolean).join(" ") || "Véhicule";
    out.label = [v.brand, v.model, v.version, v.year].filter(Boolean).join(" ");
    out._t = v.date_added ? Date.parse(v.date_added) || 0 : 0;
    out._i = i;
    return out;
  }

  var all = (CAP.vehicles || []).map(normalize);
  // Identifiants en double : suffixe automatique pour garder des URL uniques
  var seen = {};
  all.forEach(function (v) { if (seen[v.id]) v.id = v.id + "-" + (++seen[v.id]); else seen[v.id] = 1; });

  function priceText(v) {
    if (v.price != null) return CAP.formatPrice(v.price);
    return CAP.get("catalogue.price_on_request_label") || "Prix sur demande";
  }
  function url(v) { return "vehicule.html?id=" + encodeURIComponent(v.id); }

  function statusBadge(v) {
    if (v.status === "vendu") return '<span class="badge badge--muted">Vendu</span>';
    if (v.status === "reserve") return '<span class="badge badge--warning">Réservé</span>';
    return "";
  }

  function card(v, opts) {
    opts = opts || {};
    var photo = v.photos[0];
    var specs = [];
    if (v.year) specs.push("<li>" + CAP.icon("calendar") + v.year + "</li>");
    if (v.mileage != null) specs.push("<li>" + CAP.icon("gauge") + CAP.esc(CAP.formatKm(v.mileage)) + "</li>");
    if (v.fuel) specs.push("<li>" + CAP.icon("fuel") + CAP.esc(CAP.label("fuel", v.fuel)) + "</li>");
    if (v.transmission) specs.push("<li>" + CAP.icon("gear") + CAP.esc(CAP.label("transmission", v.transmission)) + "</li>");
    var media = photo
      ? '<img src="' + CAP.esc(photo.src) + '" alt="' + CAP.esc(photo.alt || v.label) + '" loading="lazy" decoding="async">'
      : '<div class="slot slot--neutral" aria-hidden="true">' + CAP.icon("car") + (CAP.preview ? "<strong>PHOTO À AJOUTER</strong>" : "") + "</div>";
    return '<article class="card vcard' + (v.status === "vendu" ? " vcard--sold" : "") + '"' + (opts.tilt !== false ? ' data-tilt="4"' : "") + ">" +
      '<div class="vcard__media">' + media +
      '<div class="vcard__badges">' + statusBadge(v) + (v.featured && v.status === "disponible" ? '<span class="badge badge--accent">' + CAP.icon("star") + "Sélection</span>" : "") + "</div>" +
      (v.photos.length > 1 ? '<span class="badge vcard__photos">' + CAP.icon("image") + v.photos.length + "</span>" : "") +
      "</div>" +
      '<div class="vcard__body">' +
      (v.body ? '<span class="vcard__brand">' + CAP.esc(CAP.label("body", v.body)) + "</span>" : "") +
      '<h3 class="vcard__title"><a class="vcard__link" href="' + url(v) + '">' + CAP.esc(v.title) + "</a></h3>" +
      (v.version ? '<p class="vcard__version">' + CAP.esc(v.version) + "</p>" : "") +
      (specs.length ? '<ul class="vcard__specs">' + specs.join("") + "</ul>" : "") +
      '<div class="vcard__foot"><span class="vcard__price">' + CAP.esc(priceText(v)) + '</span><span class="vcard__go" aria-hidden="true">' + CAP.icon("arrow") + "</span></div>" +
      "</div></article>";
  }

  /* Emplacements vides (prévisualisation uniquement) */
  function slotCards(n) {
    if (!CAP.preview) return "";
    var out = "";
    for (var i = 0; i < n; i++) {
      out += '<article class="card vcard vcard--slot" aria-hidden="true"><div class="vcard__media"><div class="slot">' + CAP.icon("car") +
        "<strong>EMPLACEMENT VÉHICULE</strong><span>Ajoutez vos véhicules dans content/vehicles.js ou via /admin/</span></div></div>" +
        '<div class="vcard__body"><span class="todo">Fiche véhicule · À PERSONNALISER</span></div></article>';
    }
    return out;
  }

  var SORTS = {
    recent: function (a, b) { return (b._t - a._t) || (a._i - b._i); },
    "price-asc": function (a, b) { return nullLast(a.price, b.price, 1); },
    "price-desc": function (a, b) { return nullLast(a.price, b.price, -1); },
    "km-asc": function (a, b) { return nullLast(a.mileage, b.mileage, 1); },
    "year-desc": function (a, b) { return nullLast(a.year, b.year, -1); }
  };
  function nullLast(x, y, dir) {
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return (x - y) * dir;
  }

  window.CAPVehicles = {
    all: all, normalize: normalize, card: card, slotCards: slotCards, priceText: priceText, url: url,
    SORTS: SORTS, statusBadge: statusBadge,
    byId: function (id) { return all.filter(function (v) { return v.id === id; })[0] || null; }
  };
})();
