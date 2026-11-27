/* =====================================================================
   Formulaires : contact · renseignement · essai · vente · recherche.
   Validation accessible, anti-spam (champ piège + délai), envoi JSON vers
   SITE.forms.endpoint. Sans service d'envoi configuré, RIEN n'est envoyé
   et le visiteur en est informé (aucun faux message de réussite).
   ===================================================================== */
(function () {
  "use strict";
  var DZ = window.DZ, esc = DZ.esc, $ = DZ.$, $$ = DZ.$$;
  var endpoint = DZ.safeUrl((DZ.SITE.forms || {}).endpoint);
  var uid = 0;

  var SUBJECTS = [["achat", "Achat d'un véhicule"], ["vente", "Vendre mon véhicule"], ["recherche", "Recherche personnalisée"], ["autre", "Autre demande"]];

  function field(id, name, lab, type, opts) {
    opts = opts || {};
    var req = opts.required ? ' required aria-required="true"' : "";
    var star = opts.required ? ' <span aria-hidden="true">*</span>' : "";
    var input = type === "textarea"
      ? '<textarea class="textarea" id="' + id + '" name="' + name + '"' + req + ' maxlength="3000"' + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : "") + "></textarea>"
      : type === "select"
        ? '<select class="select" id="' + id + '" name="' + name + '"' + req + ">" + opts.options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === opts.value ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>"
        : '<input class="input" id="' + id + '" name="' + name + '" type="' + type + '"' + req + (opts.ac ? ' autocomplete="' + opts.ac + '"' : "") + (opts.min ? ' min="' + opts.min + '"' : "") + (opts.im ? ' inputmode="' + opts.im + '"' : "") + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : "") + ' maxlength="200">';
    return '<div class="field' + (opts.cls ? " " + opts.cls : "") + '"' + (opts.attr || "") + '><label for="' + id + '">' + lab + star + "</label>" + input + "</div>";
  }

  function markup(kind, opts) {
    opts = opts || {};
    var p = "f" + (++uid) + "-", h = "";
    if (opts.vehicle) h += '<input type="hidden" name="vehicle" value="' + esc(opts.vehicle.label) + '"><input type="hidden" name="vehicle_id" value="' + esc(opts.vehicle.id) + '">';
    h += '<input type="hidden" name="kind" value="' + kind + '">';
    if (kind === "contact") h += field(p + "subj", "subject", "Votre demande", "select", { options: SUBJECTS, value: opts.subject || "achat" });
    h += '<div class="form__row">' + field(p + "ln", "last_name", "Nom", "text", { required: true, ac: "family-name" }) + field(p + "fn", "first_name", "Prénom", "text", { ac: "given-name" }) + "</div>";
    h += '<div class="form__row">' + field(p + "ph", "phone", "Téléphone", "tel", { ac: "tel", im: "tel" }) + field(p + "em", "email", "E-mail", "email", { ac: "email", im: "email" }) + "</div>";
    if (kind === "essai") {
      var t = new Date(); t.setDate(t.getDate() + 1);
      h += '<div class="form__row">' + field(p + "date", "date", "Date souhaitée", "date", { required: true, min: t.toISOString().slice(0, 10) }) +
        field(p + "slot", "slot", "Créneau", "select", { options: [["matin", "Matin"], ["apres-midi", "Après-midi"], ["fin-de-journee", "Fin de journée"]] }) + "</div>";
      h += '<label class="check"><input type="checkbox" name="licence" value="oui" required aria-required="true"><span>Je suis titulaire d\'un permis de conduire valide. <span aria-hidden="true">*</span></span></label>';
    }
    if (kind === "contact") {
      h += '<div class="form__row" data-when="vente">' + field(p + "car", "my_car", "Votre véhicule", "text", { ph: "Marque, modèle, version" }) + field(p + "km", "my_km", "Kilométrage / année", "text", { ph: "ex. 85 000 km · 2018" }) + "</div>";
      h += '<div class="form__row" data-when="recherche">' + field(p + "want", "wanted", "Véhicule recherché", "text", { ph: "ex. SUV hybride automatique" }) + field(p + "bud", "budget", "Budget maximum", "text", { ph: "ex. 20 000 €", im: "numeric" }) + "</div>";
    }
    h += field(p + "msg", "message", kind === "essai" ? "Précisions (facultatif)" : "Message", "textarea", {
      required: kind !== "essai",
      ph: kind === "info" ? "Votre question sur ce véhicule…" : kind === "essai" ? "Disponibilités, questions…" : "Votre message…"
    });
    h += '<div class="hp" aria-hidden="true"><label for="' + p + 'web">Site web</label><input id="' + p + 'web" name="website" tabindex="-1" autocomplete="off"></div>';
    h += '<label class="check"><input type="checkbox" name="consent" value="oui" required aria-required="true"><span>J\'accepte que mes données soient utilisées pour traiter ma demande, conformément à la <a href="/confidentialite">politique de confidentialité</a>. <span aria-hidden="true">*</span></span></label>';
    h += '<p class="form-note">* obligatoire · indiquez au moins un téléphone ou un e-mail.</p>';
    h += '<div class="form-status" role="status" aria-live="polite" tabindex="-1"></div>';
    var cta = { contact: "Envoyer ma demande", info: "Demander des renseignements", essai: "Demander un essai" }[kind];
    h += '<div><button class="btn btn--light" type="submit"><span>' + cta + "</span>" + DZ.icon("arrow") + "</button></div>";
    return '<form class="form" novalidate data-form="' + kind + '" aria-label="' + esc(cta) + '">' + h + "</form>";
  }

  function setErr(input, msg) {
    var f = input.closest(".field") || input.closest(".check");
    if (!f) return;
    var e = $(".field__err", f);
    if (!msg) { f.classList.remove("field--err"); input.removeAttribute("aria-invalid"); if (e) e.remove(); return; }
    if (!e) { e = document.createElement("p"); e.className = "field__err"; e.id = (input.id || input.name + uid++) + "-err"; f.appendChild(e); }
    e.textContent = msg; f.classList.add("field--err");
    input.setAttribute("aria-invalid", "true"); input.setAttribute("aria-describedby", e.id);
  }
  function check(input) {
    if (input.closest(".hp") || input.type === "hidden" || input.closest("[hidden]")) return "";
    var v = input.type === "checkbox" ? input.checked : input.value.trim();
    if (input.required && !v) return input.type === "checkbox" ? "Cette case est obligatoire." : "Ce champ est obligatoire.";
    if (input.type === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return "Adresse e-mail invalide (ex. nom@domaine.fr).";
    if (input.type === "tel" && v && !/^[+\d][\d\s().-]{8,}$/.test(v)) return "Numéro de téléphone invalide.";
    if (input.type === "date" && v && input.min && v < input.min) return "Choisissez une date à partir de demain.";
    return "";
  }

  function summary(data) {
    var l = [];
    if (data.kind === "essai") l.push("Demande d'essai" + (data.vehicle ? " : " + data.vehicle : "") + (data.date ? " le " + data.date + " (" + data.slot + ")" : ""));
    else if (data.vehicle) l.push("Renseignements : " + data.vehicle);
    else if (data.subject) l.push("Demande : " + (SUBJECTS.filter(function (s) { return s[0] === data.subject; })[0] || [, data.subject])[1]);
    if (data.my_car) l.push("Mon véhicule : " + data.my_car + " " + (data.my_km || ""));
    if (data.wanted) l.push("Recherche : " + data.wanted + (data.budget ? ", budget " + data.budget : ""));
    if (data.message) l.push(data.message);
    l.push("— " + [data.first_name, data.last_name].filter(Boolean).join(" ") + (data.phone ? " · " + data.phone : ""));
    return l.join("\n");
  }

  function alternatives(data) {
    var a = [], txt = summary(data);
    if (DZ.wa) a.push('<a href="' + esc(DZ.waLink(txt)) + '" target="_blank" rel="noopener">l\'envoyer sur WhatsApp</a>');
    if (DZ.SITE.contact.email) a.push('<a href="mailto:' + esc(DZ.SITE.contact.email) + "?subject=" + encodeURIComponent("Demande depuis le site") + "&body=" + encodeURIComponent(txt) + '">l\'envoyer par e-mail</a>');
    if (DZ.tel) a.push('<a href="' + esc(DZ.tel) + '">nous appeler</a>');
    return a.length ? " Vous pouvez " + a.join(", ") + "." : "";
  }

  function status(form, type, html) {
    var s = $(".form-status", form);
    s.className = "form-status form-status--" + type + " is-visible";
    s.innerHTML = html;
    s.focus();
  }

  function init(form) {
    var started = Date.now();
    var subj = $('[name="subject"]', form);
    function syncSubject() { $$("[data-when]", form).forEach(function (r) { r.hidden = !subj || r.getAttribute("data-when") !== subj.value; }); }
    if (subj) subj.addEventListener("change", syncSubject);
    syncSubject();

    $$("input, select, textarea", form).forEach(function (i) {
      i.addEventListener("blur", function () { if (i.value || i.type === "checkbox") setErr(i, check(i)); });
      i.addEventListener("input", function () { if (i.getAttribute("aria-invalid")) setErr(i, check(i)); });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var first = null;
      $$("input, select, textarea", form).forEach(function (i) { var m = check(i); setErr(i, m); if (m && !first) first = i; });
      var em = $('[name="email"]', form), ph = $('[name="phone"]', form);
      if (!em.value.trim() && !ph.value.trim()) { setErr(ph, "Indiquez un téléphone ou un e-mail pour être recontacté."); first = first || ph; }
      if (first) { first.focus(); return; }

      var hp = $(".hp input", form);
      if ((hp && hp.value) || Date.now() - started < 2500) { status(form, "err", "Envoi trop rapide. Merci de réessayer dans quelques secondes."); return; }

      var data = {};
      new FormData(form).forEach(function (v, k) { if (k !== "website" && !(form.elements[k] && form.elements[k].closest && form.elements[k].closest("[hidden]"))) data[k] = String(v).slice(0, 3000); });
      data.page = location.pathname + location.search;

      if (!endpoint) {
        status(form, "warn", "<strong>" + (DZ.SITE.demo ? "Démonstration : votre demande est valide mais n'a pas été envoyée." : "Votre demande n'a pas été envoyée.") + "</strong> L'envoi en ligne n'est pas encore activé." + alternatives(data));
        return;
      }
      var btn = $('[type="submit"]', form);
      btn.classList.add("is-loading"); btn.disabled = true;
      fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json().catch(function () { return {}; }); })
        .then(function () {
          status(form, "ok", "<strong>Merci, votre demande a bien été transmise.</strong> Nous revenons vers vous rapidement.");
          form.reset(); syncSubject(); started = Date.now();
        })
        .catch(function () { status(form, "err", "<strong>L'envoi a échoué.</strong> Votre demande n'a pas été transmise." + alternatives(data)); })
        .then(function () { btn.classList.remove("is-loading"); btn.disabled = false; });
    });
  }

  function mount(el, kind, opts) { el.innerHTML = markup(kind, opts); init($("form", el)); return $("form", el); }
  window.DZForms = { mount: mount };

  $$("[data-form-mount]").forEach(function (el) {
    var s = new URLSearchParams(location.search).get("sujet");
    mount(el, "contact", { subject: SUBJECTS.some(function (x) { return x[0] === s; }) ? s : "achat" });
  });
})();
