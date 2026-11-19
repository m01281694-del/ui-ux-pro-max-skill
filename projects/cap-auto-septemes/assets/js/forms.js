/* =====================================================================
   CAP AUTO SEPTÈMES — Formulaires
   - validation accessible (messages liés aux champs) ;
   - anti-spam (champ piège invisible + délai minimal) ;
   - envoi vers content/site.js → forms.endpoint
   TANT QU'AUCUN SERVICE D'ENVOI N'EST CONFIGURÉ, RIEN N'EST ENVOYÉ et le
   visiteur en est clairement informé. Aucun faux message de réussite.
   ===================================================================== */
(function () {
  "use strict";
  var CAP = window.CAP;
  var cfg = CAP.content.forms || {};
  var endpoint = CAP.safeUrl(cfg.endpoint);

  var MESSAGES = {
    required: "Ce champ est obligatoire.",
    email: "Saisissez une adresse e-mail valide (ex. nom@domaine.fr).",
    tel: "Saisissez un numéro de téléphone valide.",
    consent: "Votre accord est nécessaire pour traiter votre demande.",
    contactOne: "Indiquez au moins un e-mail ou un téléphone pour être recontacté."
  };

  function fieldOf(input) { return input.closest(".field") || input.closest(".check"); }
  function setError(input, msg) {
    var f = fieldOf(input);
    if (!f) return;
    var err = f.querySelector(".field__error");
    if (!err) {
      err = document.createElement("p");
      err.className = "field__error";
      err.id = (input.id || input.name) + "-error";
      f.appendChild(err);
    }
    if (msg) {
      f.classList.add("has-error");
      err.textContent = msg;
      input.setAttribute("aria-invalid", "true");
      var d = (input.getAttribute("aria-describedby") || "").split(" ").filter(Boolean);
      if (d.indexOf(err.id) < 0) d.push(err.id);
      input.setAttribute("aria-describedby", d.join(" "));
    } else {
      f.classList.remove("has-error");
      err.textContent = "";
      input.removeAttribute("aria-invalid");
    }
  }
  function validateInput(input) {
    var v = (input.type === "checkbox") ? input.checked : String(input.value || "").trim();
    if (input.required && !v) return input.type === "checkbox" ? MESSAGES.consent : MESSAGES.required;
    if (input.type === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return MESSAGES.email;
    if (input.type === "tel" && v && !/^[+\d][\d\s().-]{7,}$/.test(v)) return MESSAGES.tel;
    return "";
  }

  function status(form, type, html) {
    var s = form.querySelector('.form-status[role="status"]');
    s.className = "form-status form-status--" + type + " is-visible";
    s.innerHTML = html;
    s.setAttribute("tabindex", "-1");
    s.focus({ preventScroll: false });
  }

  function altContact() {
    var tel = CAP.phoneHref(), email = CAP.get("dealer.email");
    var parts = [];
    if (tel) parts.push('par téléphone au <a href="' + CAP.esc(tel) + '">' + CAP.esc(CAP.phoneLabel()) + "</a>");
    if (email) parts.push('par e-mail à <a href="mailto:' + CAP.esc(email) + '">' + CAP.esc(email) + "</a>");
    return parts.length ? " Vous pouvez nous joindre " + parts.join(" ou ") + "." : "";
  }

  function initForm(form) {
    var started = Date.now();
    form.setAttribute("novalidate", "");

    // Sujets configurables
    var subj = form.querySelector('select[name="subject"]');
    if (subj) {
      var list = Array.isArray(cfg.subjects) ? cfg.subjects.filter(Boolean) : [];
      if (!list.length) {
        var f = subj.closest(".field");
        if (CAP.preview) { f.insertAdjacentHTML("beforeend", CAP.todo("forms.subjects", "sujets proposés")); subj.disabled = true; }
        else f.remove();
      } else {
        list.forEach(function (s) { var o = document.createElement("option"); o.value = s; o.textContent = s; subj.appendChild(o); });
      }
    }

    // Mention RGPD configurable
    var notice = form.querySelector("[data-retention]");
    if (notice) {
      if (cfg.retention_notice) notice.textContent = cfg.retention_notice;
      else if (CAP.preview) notice.innerHTML = CAP.todo("forms.retention_notice", "information RGPD à faire valider");
      else notice.remove();
    }

    // Avertissement en prévisualisation si l'envoi n'est pas relié
    if (!endpoint && CAP.preview) {
      var warn = document.createElement("p");
      warn.className = "form-status form-status--warning is-visible";
      warn.innerHTML = "<strong>Formulaire non relié</strong> — aucun service d'envoi n'est configuré (<code>forms.endpoint</code>). Les messages ne peuvent pas encore être transmis.";
      form.insertBefore(warn, form.firstChild);
    }

    form.querySelectorAll("input, select, textarea").forEach(function (input) {
      input.addEventListener("blur", function () { if (input.value || input.type === "checkbox") setError(input, validateInput(input)); });
      input.addEventListener("input", function () { if (fieldOf(input) && fieldOf(input).classList.contains("has-error")) setError(input, validateInput(input)); });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var first = null;
      form.querySelectorAll("input, select, textarea").forEach(function (input) {
        if (input.closest(".hp") || input.disabled) return;
        var msg = validateInput(input);
        setError(input, msg);
        if (msg && !first) first = input;
      });
      // Au moins un moyen de recontact
      var em = form.querySelector('[name="email"]'), ph = form.querySelector('[name="phone"]');
      if (em && ph && !em.value.trim() && !ph.value.trim()) {
        setError(em, MESSAGES.contactOne);
        if (!first) first = em;
      }
      if (first) { first.focus(); return; }

      // Anti-spam : champ piège rempli ou envoi en moins de 3 s → ignoré silencieusement
      var hp = form.querySelector('.hp input');
      if ((hp && hp.value) || Date.now() - started < 3000) {
        status(form, "error", "Votre envoi n'a pas pu être traité. Merci de réessayer dans quelques secondes.");
        return;
      }

      if (!endpoint) {
        status(form, "warning", "<strong>Votre message n'a pas été envoyé.</strong> L'envoi en ligne n'est pas encore disponible sur ce site." + altContact());
        return;
      }

      var data = {};
      new FormData(form).forEach(function (v, k) { if (k !== "website") data[k] = v; });
      data.page = location.href;
      data.form = form.getAttribute("data-form") || "contact";

      var btn = form.querySelector('[type="submit"]');
      btn.classList.add("is-loading");
      btn.disabled = true;

      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data)
      }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        status(form, "success", CAP.esc(cfg.success_message || "Votre message a bien été transmis."));
        form.reset();
        started = Date.now();
      }).catch(function () {
        status(form, "error", "<strong>L'envoi a échoué.</strong> Votre message n'a pas été transmis, merci de réessayer." + altContact());
      }).then(function () {
        btn.classList.remove("is-loading");
        btn.disabled = false;
      });
    });
  }

  /* Gabarit du formulaire (contact général ou demande sur un véhicule) */
  var uid = 0;
  function markup(opts) {
    opts = opts || {};
    var p = "f" + (++uid) + "-";
    var vehicleRef = opts.vehicle
      ? '<input type="hidden" name="vehicle_id" value="' + CAP.esc(opts.vehicle.id) + '">' +
        '<input type="hidden" name="vehicle_label" value="' + CAP.esc(opts.vehicle.label) + '">' +
        '<p class="field__hint">Demande concernant : <strong>' + CAP.esc(opts.vehicle.label) + "</strong></p>"
      : "";
    return '<form class="form" data-form="' + (opts.vehicle ? "vehicle" : "contact") + '" aria-label="' + CAP.esc(opts.label || "Formulaire de contact") + '">' +
      vehicleRef +
      '<div class="form__row">' +
      '<div class="field"><label for="' + p + 'last">Nom <span class="req" aria-hidden="true">*</span></label><input class="input" id="' + p + 'last" name="last_name" autocomplete="family-name" required></div>' +
      '<div class="field"><label for="' + p + 'first">Prénom</label><input class="input" id="' + p + 'first" name="first_name" autocomplete="given-name"></div>' +
      "</div>" +
      '<div class="form__row">' +
      '<div class="field"><label for="' + p + 'email">E-mail</label><input class="input" id="' + p + 'email" name="email" type="email" autocomplete="email" inputmode="email"></div>' +
      '<div class="field"><label for="' + p + 'phone">Téléphone</label><input class="input" id="' + p + 'phone" name="phone" type="tel" autocomplete="tel" inputmode="tel"></div>' +
      "</div>" +
      (opts.vehicle ? "" : '<div class="field"><label for="' + p + 'subject">Sujet</label><select class="select" id="' + p + 'subject" name="subject"><option value="">Choisir un sujet</option></select></div>') +
      '<div class="field"><label for="' + p + 'msg">Message <span class="req" aria-hidden="true">*</span></label><textarea class="textarea" id="' + p + 'msg" name="message" required></textarea></div>' +
      '<div class="hp" aria-hidden="true"><label for="' + p + 'web">Site web</label><input id="' + p + 'web" name="website" tabindex="-1" autocomplete="off"></div>' +
      '<label class="check"><input type="checkbox" name="consent" value="oui" required><span>J\'accepte que mes données soient utilisées pour traiter ma demande, conformément à la <a href="confidentialite.html">politique de confidentialité</a>. <span class="req" aria-hidden="true">*</span></span></label>' +
      '<p class="form-legal" data-retention></p>' +
      '<p class="form-legal">Les champs marqués <span class="req">*</span> sont obligatoires. Indiquez au moins un e-mail ou un téléphone.</p>' +
      '<div class="form-status" role="status" aria-live="polite"></div>' +
      '<div><button type="submit" class="btn" data-magnetic="0.15"><span>Envoyer</span>' + CAP.icon("arrow", "arrow") + "</button></div>" +
      "</form>";
  }

  document.querySelectorAll("[data-form-mount]").forEach(function (m) {
    m.innerHTML = markup({ label: m.getAttribute("data-form-label") || "" });
  });
  document.querySelectorAll("form[data-form]").forEach(initForm);
  window.CAPForms = { init: initForm, markup: markup, configured: !!endpoint };
})();
