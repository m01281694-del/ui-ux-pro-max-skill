/* =====================================================================
   CAP AUTO SEPTÈMES — Contrôles avant publication
   Utilisé par : `npm run check`, `npm run build` (Node) et /admin/ (navigateur).
   errors   → bloquent la publication (publication.ready = true)
   warnings → à examiner, non bloquants
   ===================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CAPChecks = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var ENUMS = {
    status: ["disponible", "reserve", "vendu"],
    fuel: ["essence", "diesel", "hybride", "hybride-rechargeable", "electrique", "gpl", "ethanol", "autre"],
    transmission: ["manuelle", "automatique"],
    body: ["citadine", "berline", "break", "suv", "monospace", "coupe", "cabriolet", "utilitaire", "4x4", "autre"]
  };

  function get(o, path) {
    return String(path).split(".").reduce(function (c, k) { return c == null ? undefined : c[k]; }, o);
  }
  function empty(v) {
    if (v == null) return true;
    if (typeof v === "string") return v.trim() === "";
    if (Array.isArray(v)) return v.length === 0;
    return false;
  }

  var REQUIRED = [
    ["site.name", "Nom du site"],
    ["site.url", "Adresse définitive du site (URL)"],
    ["dealer.address.street", "Adresse : rue"],
    ["dealer.address.postal_code", "Adresse : code postal"],
    ["dealer.address.city", "Adresse : ville"],
    ["home.hero.title", "Titre principal de l'accueil"],
    ["seo.default_description", "Description SEO par défaut"],
    ["forms.endpoint", "Service d'envoi des formulaires"],
    ["forms.retention_notice", "Information RGPD sous les formulaires"],
    ["legal.company_name", "Dénomination sociale"],
    ["legal.legal_form", "Forme juridique"],
    ["legal.share_capital", "Capital social"],
    ["legal.head_office", "Siège social"],
    ["legal.siren", "SIREN"],
    ["legal.rcs", "Immatriculation RCS"],
    ["legal.publication_director", "Directeur de la publication"],
    ["legal.contact_email", "E-mail juridique / RGPD"],
    ["legal.mediator.name", "Médiateur de la consommation"],
    ["legal.mediator.url", "Site du médiateur"],
    ["legal.host.name", "Hébergeur"],
    ["legal.host.address", "Adresse de l'hébergeur"],
    ["legal.last_update", "Date de mise à jour des pages juridiques"]
  ];

  var RECOMMENDED = [
    ["site.logo", "Logo"],
    ["seo.og_image", "Image de partage (réseaux sociaux)"],
    ["legal.vat_number", "N° de TVA intracommunautaire"],
    ["home.hero.subtitle", "Sous-titre de l'accueil"],
    ["home.hero.cta_primary.label", "Bouton principal de l'accueil"],
    ["home.featured.title", "Titre de la sélection de véhicules"],
    ["home.featured.cta_label", "Bouton vers le catalogue"],
    ["home.about.title", "Titre « à propos » (accueil)"],
    ["home.cta_band.title", "Titre du bandeau d'appel à l'action"],
    ["catalogue.title", "Titre de la page catalogue"],
    ["contact_page.title", "Titre de la page contact"],
    ["about_page.title", "Titre de la page à propos"],
    ["seo.pages.home.title", "Titre SEO de l'accueil"],
    ["seo.pages.vehicles.description", "Description SEO du catalogue"],
    ["seo.pages.contact.description", "Description SEO de la page contact"]
  ];

  function checkContent(C) {
    var errors = [], warnings = [];
    C = C || {};
    REQUIRED.forEach(function (r) { if (empty(get(C, r[0]))) errors.push(r[1] + " (" + r[0] + ")"); });
    RECOMMENDED.forEach(function (r) { if (empty(get(C, r[0]))) warnings.push(r[1] + " (" + r[0] + ")"); });

    if (empty(get(C, "dealer.phone")) && empty(get(C, "dealer.email"))) errors.push("Au moins un téléphone ou un e-mail de contact (dealer.phone / dealer.email)");
    if (!empty(get(C, "dealer.phone")) && empty(get(C, "dealer.phone_display"))) warnings.push("Format d'affichage du téléphone (dealer.phone_display)");

    var hours = get(C, "dealer.hours") || [];
    var missingDays = hours.filter(function (h) { return !Array.isArray(h.slots); }).map(function (h) { return h.day; });
    if (missingDays.length) errors.push("Horaires non renseignés : " + missingDays.join(", ") + " (dealer.hours — [] = fermé)");
    hours.forEach(function (h) {
      (Array.isArray(h.slots) ? h.slots : []).forEach(function (s) {
        if (!Array.isArray(s) || !/^\d{1,2}:\d{2}$/.test(s[0]) || !/^\d{1,2}:\d{2}$/.test(s[1])) errors.push("Créneau horaire invalide pour " + h.day + " (format [\"09:00\",\"12:00\"])");
      });
    });

    var url = get(C, "site.url");
    if (!empty(url) && !/^https:\/\/[^\s/]+[^\s]*[^/]$/.test(url)) errors.push("site.url doit commencer par https:// et ne pas finir par /");

    var social = get(C, "social") || {};
    if (!Object.keys(social).some(function (k) { return !empty(social[k]); })) warnings.push("Aucun réseau social renseigné (les icônes seront masquées)");

    if (get(C, "intro.enabled") !== false && empty(get(C, "intro.video_mp4")) && empty(get(C, "intro.video_webm"))) warnings.push("Vidéo d'introduction activée mais aucun fichier (intro.video_mp4) — l'intro sera ignorée");
    if (empty(get(C, "home.hero.background_video_mp4")) && empty(get(C, "home.hero.background_image"))) warnings.push("Pas de vidéo ni de photo de fond pour le héro (décor graphique utilisé)");

    (get(C, "home.testimonials.items") || []).forEach(function (t, i) {
      if (empty(t.author) || empty(t.text)) errors.push("Avis n°" + (i + 1) + " incomplet (auteur et texte obligatoires)");
    });
    (get(C, "cookies.services") || []).forEach(function (s, i) {
      if (["mesure", "medias", "marketing"].indexOf(s.category) < 0) errors.push("Traceur n°" + (i + 1) + " : catégorie invalide (mesure | medias | marketing)");
      if (empty(s.name)) errors.push("Traceur n°" + (i + 1) + " : nom manquant");
    });
    return { errors: errors, warnings: warnings };
  }

  function checkVehicles(list) {
    var errors = [], warnings = [];
    if (!Array.isArray(list)) return { errors: ["content/vehicles.js : CAP_VEHICLES doit être une liste [ ]"], warnings: [] };
    if (!list.length) warnings.push("Aucun véhicule dans le catalogue");
    var ids = {};
    list.forEach(function (v, i) {
      var n = "Véhicule n°" + (i + 1) + (v && v.brand ? " (" + [v.brand, v.model].filter(Boolean).join(" ") + ")" : "");
      if (!v || typeof v !== "object") { errors.push(n + " : fiche invalide"); return; }
      if (empty(v.id)) errors.push(n + " : identifiant (id) manquant");
      else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v.id)) errors.push(n + " : id « " + v.id + " » invalide (minuscules, chiffres et tirets)");
      else if (ids[v.id]) errors.push(n + " : id « " + v.id + " » en double");
      ids[v.id] = true;
      if (empty(v.brand)) errors.push(n + " : marque manquante");
      if (empty(v.model)) errors.push(n + " : modèle manquant");
      Object.keys(ENUMS).forEach(function (k) {
        if (!empty(v[k]) && ENUMS[k].indexOf(v[k]) < 0) errors.push(n + " : valeur « " + v[k] + " » non reconnue pour " + k + " (" + ENUMS[k].join(", ") + ")");
      });
      ["year", "mileage", "price", "power_hp", "fiscal_hp", "doors", "seats", "co2", "owners"].forEach(function (k) {
        if (v[k] != null && v[k] !== "" && (typeof v[k] !== "number" || isNaN(v[k]))) errors.push(n + " : " + k + " doit être un nombre sans guillemets ni espaces");
      });
      if (v.date_added && isNaN(Date.parse(v.date_added))) errors.push(n + " : date_added invalide (AAAA-MM-JJ)");
      if (!Array.isArray(v.photos) || !v.photos.length) warnings.push(n + " : aucune photo");
      else v.photos.forEach(function (p, j) {
        var src = typeof p === "string" ? p : p && p.src;
        if (empty(src)) errors.push(n + " : photo " + (j + 1) + " sans chemin (src)");
        if (typeof p === "object" && empty(p.alt)) warnings.push(n + " : photo " + (j + 1) + " sans texte alternatif (alt)");
      });
      if (v.price == null && (v.status || "disponible") !== "vendu") warnings.push(n + " : pas de prix (« Prix sur demande » affiché)");
      ["year", "mileage", "fuel", "transmission"].forEach(function (k) { if (empty(v[k]) && v[k] !== 0) warnings.push(n + " : " + k + " non renseigné"); });
    });
    return { errors: errors, warnings: warnings, enums: ENUMS };
  }

  return { checkContent: checkContent, checkVehicles: checkVehicles, ENUMS: ENUMS };
});
