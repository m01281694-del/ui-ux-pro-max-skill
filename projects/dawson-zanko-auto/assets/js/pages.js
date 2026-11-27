/* Pages simples : remplissage depuis content/site.js, liste de contact, itinéraire. */
(function () {
  "use strict";
  var DZ = window.DZ, $ = DZ.$, $$ = DZ.$$, esc = DZ.esc, S = DZ.SITE, C = S.contact || {};
  function get(path) { return path.split(".").reduce(function (o, k) { return o && o[k] != null ? o[k] : ""; }, S); }
  $$("[data-bind]").forEach(function (el) {
    var v = get(el.getAttribute("data-bind"));
    if (v) el.textContent = v;
    else if (el.hasAttribute("data-empty")) { el.textContent = el.getAttribute("data-empty"); el.classList.add("todo"); }
  });
  var list = $("[data-contact-list]");
  if (list) {
    var it = [];
    if (DZ.tel) it.push('<li>' + DZ.icon("phone") + '<div><small>Téléphone</small><a href="' + esc(DZ.tel) + '">' + esc(C.phone_display || C.phone) + "</a></div></li>");
    if (DZ.wa) it.push('<li>' + DZ.icon("wa") + '<div><small>WhatsApp</small><a href="' + esc(DZ.waLink("Bonjour, je vous contacte depuis votre site.")) + '" target="_blank" rel="noopener">Écrire sur WhatsApp</a></div></li>');
    if (C.email) it.push('<li>' + DZ.icon("mail") + '<div><small>E-mail</small><a href="mailto:' + esc(C.email) + '">' + esc(C.email) + "</a></div></li>");
    it.push('<li>' + DZ.icon("pin") + '<div><small>Adresse</small>' + esc(C.showroom_address || S.legal.address) + "</div></li>");
    if ((C.hours || []).length) it.push('<li>' + DZ.icon("cal") + '<div><small>Horaires</small>' + C.hours.map(function (h) { return esc(h.days) + " : " + esc(h.time); }).join("<br>") + "</div></li>");
    if (S.demo && !DZ.tel && !C.email) it.push('<li>' + DZ.icon("phone") + '<div><small>Téléphone · WhatsApp · E-mail</small><span class="todo">Coordonnées à fournir par l\'entreprise</span></div></li>');
    list.innerHTML = it.join("");
  }
  var dir = $("[data-directions]");
  if (dir) dir.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(C.showroom_address || S.legal.address);
  DZ.observe(document);
})();
