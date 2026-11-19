/* =====================================================================
   Outil local de gestion des véhicules
   Aucune donnée n'est envoyée sur Internet : tout reste dans ce
   navigateur jusqu'à l'export du fichier vehicles.js.
   ===================================================================== */
(function () {
  "use strict";
  var KEY = "cap_admin_draft";
  var ENUMS = window.CAPChecks.ENUMS;
  var LABELS = {
    status: { disponible: "Disponible", reserve: "Réservé", vendu: "Vendu" },
    fuel: { essence: "Essence", diesel: "Diesel", hybride: "Hybride", "hybride-rechargeable": "Hybride rechargeable", electrique: "Électrique", gpl: "GPL", ethanol: "Éthanol", autre: "Autre" },
    transmission: { manuelle: "Manuelle", automatique: "Automatique" },
    body: { citadine: "Citadine", berline: "Berline", "break": "Break", suv: "SUV", monospace: "Monospace", coupe: "Coupé", cabriolet: "Cabriolet", utilitaire: "Utilitaire", "4x4": "4x4", autre: "Autre" }
  };
  var FIELDS = [
    // [clé, libellé, type, groupe]
    ["brand", "Marque *", "text", "Identification"], ["model", "Modèle *", "text", "Identification"], ["version", "Version / finition", "text", "Identification"],
    ["id", "Identifiant (URL) *", "text", "Identification"], ["status", "Statut", "status", "Identification"], ["featured", "Mis en avant sur l'accueil", "bool", "Identification"],
    ["date_added", "Date d'ajout", "date", "Identification"],
    ["body", "Carrosserie", "body", "Caractéristiques"], ["year", "Année", "number", "Caractéristiques"], ["first_registration", "1re mise en circulation", "date", "Caractéristiques"],
    ["mileage", "Kilométrage", "number", "Caractéristiques"], ["fuel", "Énergie", "fuel", "Caractéristiques"], ["transmission", "Boîte", "transmission", "Caractéristiques"],
    ["power_hp", "Puissance (ch)", "number", "Caractéristiques"], ["fiscal_hp", "Puissance fiscale (CV)", "number", "Caractéristiques"],
    ["doors", "Portes", "number", "Caractéristiques"], ["seats", "Places", "number", "Caractéristiques"], ["color", "Couleur", "text", "Caractéristiques"],
    ["critair", "Crit'Air", "text", "Caractéristiques"], ["co2", "CO₂ (g/km)", "number", "Caractéristiques"], ["owners", "Propriétaires", "number", "Caractéristiques"],
    ["price", "Prix TTC (€) — vide = sur demande", "number", "Prix"], ["price_note", "Précision sous le prix", "text", "Prix"], ["warranty", "Garantie", "text", "Prix"],
    ["description", "Description (ligne vide = nouveau paragraphe)", "textarea", "Présentation"],
    ["equipment", "Équipements (un par ligne)", "lines", "Présentation"],
    ["photos", "Photos — une par ligne : chemin | texte alternatif", "photos", "Médias"],
    ["video", "Vidéo (chemin, facultatif)", "text", "Médias"]
  ];

  var list, current = -1, fromDraft = false;
  try { var d = localStorage.getItem(KEY); if (d) { list = JSON.parse(d); fromDraft = true; } } catch (e) {}
  if (!Array.isArray(list)) list = JSON.parse(JSON.stringify(window.CAP_VEHICLES || []));

  var $ = function (s) { return document.querySelector(s); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function slug(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
    $("#draft-flag").hidden = false;
  }
  function msg(text, type) { var m = $("#msg"); m.className = "form-status mt-4 is-visible form-status--" + (type || "success"); m.textContent = text; }

  /* ---------- Liste ---------- */
  function renderList() {
    $("#count").textContent = list.length + " véhicule(s)";
    $("#vlist").innerHTML = list.map(function (v, i) {
      var p = (v.photos || [])[0];
      var src = p && (typeof p === "string" ? p : p.src);
      return '<li><button class="vitem" data-i="' + i + '"' + (i === current ? ' aria-current="true"' : "") + ">" +
        (src ? '<img src="../' + esc(src) + '" alt="">' : '<span class="ph"></span>') +
        "<span><strong>" + esc([v.brand, v.model].filter(Boolean).join(" ") || "(sans nom)") + "</strong><small>" + esc([v.version, v.year].filter(Boolean).join(" · ")) + "</small></span>" +
        '<span class="st">' + esc(LABELS.status[v.status] || v.status || "") + "</span></button></li>";
    }).join("") || '<li class="muted">Aucun véhicule. Cliquez sur « + Nouveau véhicule ».</li>';
  }
  $("#vlist").addEventListener("click", function (e) {
    var b = e.target.closest("[data-i]");
    if (b) { current = Number(b.getAttribute("data-i")); renderList(); renderEditor(); }
  });

  /* ---------- Éditeur ---------- */
  function input(f, v) {
    var k = f[0], t = f[2], val = v[k];
    var id = "fld-" + k;
    var lab = '<label for="' + id + '">' + esc(f[1]) + "</label>";
    if (ENUMS[t]) {
      return '<div class="field">' + lab + '<select class="select" id="' + id + '" data-k="' + k + '"><option value="">—</option>' +
        ENUMS[t].map(function (o) { return '<option value="' + o + '"' + (val === o ? " selected" : "") + ">" + esc(LABELS[t][o] || o) + "</option>"; }).join("") + "</select></div>";
    }
    if (t === "bool") return '<label class="check"><input type="checkbox" id="' + id + '" data-k="' + k + '"' + (val ? " checked" : "") + "><span>" + esc(f[1]) + "</span></label>";
    if (t === "textarea") return '<div class="field">' + lab + '<textarea class="textarea" id="' + id + '" data-k="' + k + '">' + esc(val || "") + "</textarea></div>";
    if (t === "lines") return '<div class="field">' + lab + '<textarea class="textarea" id="' + id + '" data-k="' + k + '">' + esc((val || []).join("\n")) + "</textarea></div>";
    if (t === "photos") {
      var txt = (val || []).map(function (p) { return typeof p === "string" ? p : (p.src || "") + (p.alt ? " | " + p.alt : ""); }).join("\n");
      return '<div class="field">' + lab + '<textarea class="textarea" id="' + id + '" data-k="' + k + '" placeholder="assets/images/vehicules/mon-id/1.jpg | Vue avant">' + esc(txt) + '</textarea><div class="thumbs" id="thumbs"></div></div>';
    }
    return '<div class="field">' + lab + '<input class="input" id="' + id + '" data-k="' + k + '" type="' + (t === "number" ? "number" : t === "date" ? "date" : "text") + '" value="' + esc(val == null ? "" : val) + '"' + (k === "id" ? ' pattern="[a-z0-9]+(-[a-z0-9]+)*"' : "") + "></div>";
  }

  function renderEditor() {
    var box = $("#editor-box");
    if (current < 0 || !list[current]) { box.innerHTML = '<div class="empty-state"><h2>Sélectionnez ou créez un véhicule</h2></div>'; return; }
    var v = list[current];
    var groups = {};
    FIELDS.forEach(function (f) { (groups[f[3]] = groups[f[3]] || []).push(f); });
    box.innerHTML = '<form class="editor" id="editor" novalidate>' +
      Object.keys(groups).map(function (g) {
        var wide = g === "Présentation" || g === "Médias";
        return "<fieldset><legend>" + g + "</legend>" + (wide ? "" : '<div class="grid-3">') + groups[g].map(function (f) { return input(f, v); }).join("") + (wide ? "" : "</div>") + "</fieldset>";
      }).join("") +
      '<div class="bar"><button type="button" class="btn btn--ghost btn--sm" id="gen-id">Générer l\'identifiant</button>' +
      '<button type="button" class="btn btn--ghost btn--sm" id="up">↑ Monter</button><button type="button" class="btn btn--ghost btn--sm" id="down">↓ Descendre</button>' +
      '<button type="button" class="btn btn--ghost btn--sm" id="dup">Dupliquer</button><button type="button" class="btn btn--ghost btn--sm" id="del" style="color:var(--danger)">Supprimer</button>' +
      '<a class="btn btn--sm" id="see" target="_blank" rel="noopener">Aperçu sur le site</a></div>' +
      '<p class="field__hint">L\'aperçu sur le site utilise le fichier <code>content/vehicles.js</code> : exportez puis remplacez-le pour voir vos changements.</p>' +
      '<div id="v-issues"></div></form>';
    var form = $("#editor");
    form.addEventListener("input", function (e) { var k = e.target.getAttribute("data-k"); if (k) { read(e.target, k); save(); renderList(); thumbs(); issues(); } });
    form.addEventListener("change", function (e) { var k = e.target.getAttribute("data-k"); if (k) { read(e.target, k); save(); renderList(); issues(); } });
    $("#gen-id").addEventListener("click", function () {
      var base = slug([v.brand, v.model, v.version, v.year].filter(Boolean).join(" ")) || "vehicule";
      var id = base, n = 2;
      while (list.some(function (o, j) { return j !== current && o.id === id; })) id = base + "-" + n++;
      v.id = id; $("#fld-id").value = id; save(); issues(); updateSee();
    });
    $("#up").addEventListener("click", function () { move(-1); });
    $("#down").addEventListener("click", function () { move(1); });
    $("#dup").addEventListener("click", function () {
      var c = JSON.parse(JSON.stringify(v)); c.id = ""; list.splice(current + 1, 0, c); current++; save(); renderList(); renderEditor(); msg("Véhicule dupliqué — pensez à générer un nouvel identifiant.", "warning");
    });
    $("#del").addEventListener("click", function () {
      if (!confirm("Supprimer définitivement cette fiche du brouillon ?")) return;
      list.splice(current, 1); current = -1; save(); renderList(); renderEditor();
    });
    thumbs(); issues(); updateSee();
  }
  function updateSee() { var v = list[current]; var a = $("#see"); if (a) a.href = "../vehicule.html?id=" + encodeURIComponent(v.id || ""); }
  function move(d) {
    var j = current + d;
    if (j < 0 || j >= list.length) return;
    var t = list[current]; list[current] = list[j]; list[j] = t; current = j; save(); renderList(); renderEditor();
  }
  function read(el, k) {
    var v = list[current];
    var f = FIELDS.filter(function (x) { return x[0] === k; })[0];
    var t = f[2];
    if (t === "bool") v[k] = el.checked;
    else if (t === "number") v[k] = el.value === "" ? null : Number(el.value);
    else if (t === "lines") v[k] = el.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
    else if (t === "photos") v[k] = el.value.split("\n").map(function (s) { var p = s.split("|"); return { src: (p[0] || "").trim(), alt: (p.slice(1).join("|") || "").trim() }; }).filter(function (p) { return p.src; });
    else v[k] = el.value;
    if (k === "id") updateSee();
  }
  function thumbs() {
    var t = $("#thumbs"); if (!t) return;
    t.innerHTML = (list[current].photos || []).map(function (p) {
      var src = typeof p === "string" ? p : p.src;
      return '<figure><img src="../' + esc(src) + '" alt="" onerror="this.style.outline=\'2px solid #F87171\'"><figcaption>' + esc(src) + "</figcaption></figure>";
    }).join("");
  }
  function issues() {
    var box = $("#v-issues"); if (!box) return;
    var r = window.CAPChecks.checkVehicles(list);
    var v = list[current], n = "Véhicule n°" + (current + 1);
    var mine = function (s) { return s.indexOf(n + " ") === 0 || s.indexOf(n + ":") === 0; };
    var e = r.errors.filter(mine), w = r.warnings.filter(mine);
    box.innerHTML = (e.length ? '<p class="mt-4"><strong>À corriger</strong></p><ul class="issues">' + e.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "") +
      (w.length ? '<p class="mt-4"><strong>Recommandations</strong></p><ul class="issues warn">' + w.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "") +
      (!e.length && !w.length ? '<p class="form-status form-status--success is-visible mt-4">Fiche complète.</p>' : "");
    void v;
  }

  /* ---------- Actions ---------- */
  $("#add").addEventListener("click", function () {
    list.unshift({ id: "", status: "disponible", featured: false, date_added: new Date().toISOString().slice(0, 10), brand: "", model: "", version: "", body: "", year: null, mileage: null, fuel: "", transmission: "", price: null, description: "", equipment: [], photos: [] });
    current = 0; save(); renderList(); renderEditor();
    $("#fld-brand").focus();
  });

  function fileText() {
    var errs = window.CAPChecks.checkVehicles(list).errors;
    var head = "/* =====================================================================\n" +
      "   CAP AUTO SEPTÈMES — CATALOGUE DES VÉHICULES\n" +
      "   Fichier généré par l'outil /admin/ le " + new Date().toLocaleString("fr-FR") + "\n" +
      "   Modèle de fiche et explications : voir le README du projet.\n" +
      "   ===================================================================== */\n\n";
    return { text: head + "window.CAP_VEHICLES = " + JSON.stringify(list, null, 2) + ";\n", errors: errs };
  }
  $("#export").addEventListener("click", function () {
    var f = fileText();
    if (f.errors.length && !confirm(f.errors.length + " erreur(s) détectée(s) (voir chaque fiche). Exporter quand même ?")) return;
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([f.text], { type: "text/javascript" }));
    a.download = "vehicles.js";
    document.body.appendChild(a); a.click(); a.remove();
    msg("Fichier vehicles.js téléchargé. Remplacez content/vehicles.js par ce fichier, puis publiez.");
  });
  $("#copy").addEventListener("click", function () {
    navigator.clipboard.writeText(fileText().text).then(function () { msg("Code copié. Collez-le dans content/vehicles.js à la place de l'ancien contenu."); }, function () { msg("Copie impossible dans ce navigateur : utilisez « Exporter ».", "error"); });
  });
  $("#reset").addEventListener("click", function () {
    if (!confirm("Abandonner toutes les modifications non exportées et recharger content/vehicles.js ?")) return;
    try { localStorage.removeItem(KEY); } catch (e) {}
    list = JSON.parse(JSON.stringify(window.CAP_VEHICLES || [])); current = -1;
    $("#draft-flag").hidden = true; renderList(); renderEditor(); msg("Brouillon abandonné.");
  });
  $("#import").addEventListener("change", function (e) {
    var file = e.target.files[0]; if (!file) return;
    file.text().then(function (txt) {
      var json = txt.trim();
      var m = json.match(/CAP_VEHICLES\s*=\s*([\s\S]*?);?\s*$/);
      if (m) json = m[1];
      var data = JSON.parse(json);
      if (!Array.isArray(data)) throw new Error("liste attendue");
      list = data; current = -1; save(); renderList(); renderEditor(); msg(data.length + " véhicule(s) importé(s).");
    }).catch(function (err) { msg("Import impossible : " + err.message + ". Le fichier doit avoir été exporté par cet outil.", "error"); });
    e.target.value = "";
  });

  /* ---------- Onglets ---------- */
  document.querySelectorAll(".tab").forEach(function (t) {
    t.addEventListener("click", function () {
      document.querySelectorAll(".tab").forEach(function (o) { o.setAttribute("aria-selected", String(o === t)); document.getElementById(o.getAttribute("aria-controls")).hidden = o !== t; });
      if (t.id === "t-check") renderCheck();
    });
  });
  function renderCheck() {
    var C = window.CAP_CONTENT || {};
    var c = window.CAPChecks.checkContent(C), v = window.CAPChecks.checkVehicles(list);
    var errors = c.errors.concat(v.errors), warnings = c.warnings.concat(v.warnings);
    var ready = C.publication && C.publication.ready === true;
    $("#check-box").innerHTML = "<h2 class=\"h3\">Contrôle avant publication</h2>" +
      '<p class="mt-4">Mode actuel : <strong>' + (ready ? "PUBLICATION" : "prévisualisation (non indexé)") + "</strong> — <code>publication.ready</code> dans <code>content/site.js</code>.</p>" +
      '<p class="muted">Ce contrôle porte sur le contenu de content/site.js et sur le brouillon de véhicules. La commande <code>npm run check</code> vérifie en plus l\'existence des fichiers photo/vidéo et les pages juridiques.</p>' +
      (errors.length ? '<h3 class="h4 mt-6">Bloquant pour la publication (' + errors.length + ")</h3><ul class=\"issues mt-4\">" + errors.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : '<p class="form-status form-status--success is-visible mt-6">Aucun élément bloquant.</p>') +
      (warnings.length ? '<h3 class="h4 mt-6">Recommandations (' + warnings.length + ")</h3><ul class=\"issues warn mt-4\">" + warnings.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "");
  }

  if (fromDraft) $("#draft-flag").hidden = false;
  renderList();
})();
