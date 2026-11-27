/* =====================================================================
   Recherche intelligente — comprend des phrases naturelles :
     « suv diesel automatique moins de 20 000 € »
     « peugeot 3008 < 50000 km après 2019 »
     « citadine essence 12k max » · « hybride récente » · « électrique »
   Retourne des critères structurés + les mots restants (recherche libre).
   Module universel : navigateur (window.SmartSearch) et Node (tests).
   ===================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SmartSearch = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function norm(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/[’']/g, " ").replace(/\s+/g, " ").trim();
  }

  var FUEL = [
    ["hybride-rechargeable", /\b(hybride rechargeable|plug[- ]?in|phev)\b/],
    ["electrique", /\b(electriques?|elec|ev|100 ?% electrique|zero emission)\b/],
    ["hybride", /\b(hybrides?|hev|mhev)\b/],
    ["diesel", /\b(diesel|gasoil|gazole|hdi|bluehdi|dci|tdi|crdi|multijet|d4d)\b/],
    ["essence", /\b(essence|sans plomb|tce|tsi|puretech|vti)\b/],
    ["gpl", /\b(gpl|bicarburation)\b/]
  ];
  var TRANS = [
    ["automatique", /\b(automatiques?|auto|bva|boite auto|dsg|eat ?\d?|edc|dct|cvt)\b/],
    ["manuelle", /\b(manuelles?|bvm|boite manuelle)\b/]
  ];
  var BODY = [
    ["suv", /\b(suv|4x4|crossover|tout terrain)\b/],
    ["citadine", /\b(citadines?|petite voiture|petit budget ville)\b/],
    ["compacte", /\b(compactes?)\b/],
    ["berline", /\b(berlines?)\b/],
    ["break", /\b(breaks?|sw|touring|estate|familiale)\b/],
    ["monospace", /\b(monospaces?|7 places)\b/],
    ["coupe", /\b(coupes?|sportives?)\b/],
    ["cabriolet", /\b(cabriolets?|decapotables?|cabrio)\b/],
    ["utilitaire", /\b(utilitaires?|fourgon(nette)?|van|pro)\b/]
  ];

  // « 15 000 », « 15k », « 15 k€ », « 15.000 », « 1,5 k »
  var NUM = "(\\d{1,3}(?:[ .]\\d{3})+|\\d+(?:[.,]\\d+)?)\\s*(k|mille)?";
  function toNumber(n, k) {
    var v = Number(String(n).replace(/[ .](?=\d{3}\b)/g, "").replace(",", "."));
    if (k) v *= 1000;
    return Math.round(v);
  }

  function parse(input, opts) {
    opts = opts || {};
    var q = " " + norm(input) + " ";
    var out = {};
    function take(re) { var m = q.match(re); if (m) q = q.replace(m[0], " "); return m; }

    // Kilométrage : « moins de 80 000 km », « < 80k km », « 80000 km max »
    var m = take(new RegExp("(?:moins de|max(?:imum)?|<|jusqu a|sous)\\s*" + NUM + "\\s*(?:km|kms|kilometres?)\\b"))
         || take(new RegExp(NUM + "\\s*(?:km|kms|kilometres?)\\s*(?:max(?:imum)?|maxi)?\\b"));
    if (m) out.kmMax = toNumber(m[1], m[2]);
    if (take(/\b(faible kilometrage|peu de km|peu kilometree?)\b/)) out.kmMax = out.kmMax || 50000;

    // Année : « après 2019 », « depuis 2019 », « 2019+ », « 2019 ou plus récent », « récente »
    m = take(/(?:apres|depuis|a partir de|>=?|plus recente? que)\s*(19\d{2}|20\d{2})\b/) || take(/\b(19\d{2}|20\d{2})\s*(?:\+|et plus|ou plus recente?)/);
    if (m) out.yearMin = Number(m[1]);
    m = take(/(?:avant|<)\s*(19\d{2}|20\d{2})\b/);
    if (m) out.yearMax = Number(m[1]);
    if (!out.yearMin && take(/\b(recentes?|recents?)\b/)) out.yearMin = (opts.currentYear || new Date().getFullYear()) - 4;

    // Prix : « entre 10 et 15k », « moins de 15 000 € », « < 12k », « 12k max », « budget 15000 », « à partir de 10 000 »
    m = take(new RegExp("entre\\s*" + NUM + "\\s*(?:€|euros?)?\\s*et\\s*" + NUM + "\\s*(?:€|euros?)?"));
    if (m) {
      var hiK = m[4];
      out.priceMin = toNumber(m[1], m[2] || hiK);
      out.priceMax = toNumber(m[3], hiK);
    }
    m = take(new RegExp("(?:moins de|max(?:imum)?|<|jusqu a|budget(?: de| max)?|sous|pas plus de)\\s*" + NUM + "\\s*(?:€|euros?|eur)?"))
      || take(new RegExp(NUM + "\\s*(?:€|euros?|eur)\\s*(?:max(?:imum)?|maxi)?"))
      || take(new RegExp(NUM + "\\s*(?:max(?:imum)?|maxi)\\b"));
    if (m && !out.priceMax) {
      var v = toNumber(m[1], m[2]);
      if (v >= 500) out.priceMax = v;
    }
    m = take(new RegExp("(?:plus de|a partir de|min(?:imum)?|>)\\s*" + NUM + "\\s*(?:€|euros?)?"));
    if (m && !out.priceMin) { var w = toNumber(m[1], m[2]); if (w >= 500) out.priceMin = w; }
    if (take(/\b(pas cher|petit prix|petit budget|bon marche)\b/) && !out.priceMax) out.priceMax = 12000;

    function pick(list) { for (var i = 0; i < list.length; i++) if (take(list[i][1])) return list[i][0]; return ""; }
    var fuel = pick(FUEL); if (fuel) out.fuel = fuel;
    var tr = pick(TRANS); if (tr) out.transmission = tr;
    var body = pick(BODY); if (body) out.body = body;

    // Marques / modèles connus (fournis par le stock)
    (opts.brands || []).slice().sort(function (a, b) { return b.length - a.length; }).some(function (b) {
      var nb = norm(b), alt = nb.replace(/-benz$/, "");
      var re = new RegExp("\\b(" + nb.replace(/[-]/g, "[- ]?") + "|" + alt + ")\\b");
      if (re.test(q)) { out.brand = b; q = q.replace(re, " "); return true; }
      return false;
    });
    (opts.models || []).slice().sort(function (a, b) { return b.length - a.length; }).some(function (md) {
      var re = new RegExp("\\b" + norm(md).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b");
      if (re.test(q)) { out.model = md; q = q.replace(re, " "); return true; }
      return false;
    });

    q = q.replace(/\b(je|cherche|recherche|une?|des|de|du|la|le|les|voiture|vehicule|auto(mobile)?s?|avec|en|pour|et|a|moins|max|€|euros?)\b/g, " ");
    out.text = q.replace(/[^a-z0-9 -]/g, " ").replace(/\s+/g, " ").trim();
    return out;
  }

  function matches(v, c) {
    if (c.brand && v.brand !== c.brand) return false;
    if (c.model && v.model !== c.model) return false;
    if (c.fuel && v.fuel !== c.fuel && !(c.fuel === "hybride" && v.fuel === "hybride-rechargeable")) return false;
    if (c.transmission && v.transmission !== c.transmission) return false;
    if (c.body && v.body !== c.body) return false;
    if (c.priceMax && (v.price == null || v.price > c.priceMax)) return false;
    if (c.priceMin && (v.price == null || v.price < c.priceMin)) return false;
    if (c.kmMax && (v.mileage == null || v.mileage > c.kmMax)) return false;
    if (c.yearMin && (v.year == null || v.year < c.yearMin)) return false;
    if (c.yearMax && (v.year == null || v.year > c.yearMax)) return false;
    if (c.text) {
      var hay = norm([v.brand, v.model, v.version, v.color, v.body, v.fuel, v.year].join(" "));
      if (!c.text.split(" ").every(function (t) { return hay.indexOf(t) > -1; })) return false;
    }
    return true;
  }

  return { parse: parse, matches: matches, norm: norm };
});
