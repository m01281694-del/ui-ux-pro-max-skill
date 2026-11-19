/* =====================================================================
   CAP AUTO SEPTÈMES — Rendu des sections de pages
   Chaque section lit content/site.js. Listes vides :
     - prévisualisation → emplacements « À PERSONNALISER » ;
     - publication      → section masquée.
   ===================================================================== */
(function () {
  "use strict";
  var CAP = window.CAP;
  var P = CAP.preview;

  function list(path) { var v = CAP.get(path); return Array.isArray(v) ? v.filter(Boolean) : []; }
  function removeSection(el) { var s = el.closest("[data-section]") || el; s.remove(); }

  /* Une section avec titre/texte vides ET liste vide disparaît en publication */
  function sectionEmpty(paths, items) {
    return !items.length && paths.every(function (p) { return CAP.isEmpty(CAP.get(p)); });
  }

  /* ---------------- HÉRO ---------------- */
  function hero() {
    var h = document.querySelector("[data-hero]");
    if (!h) return;
    var cfg = CAP.get("home.hero") || {};
    var media = h.querySelector(".hero__media");
    var mp4 = CAP.safeUrl(cfg.background_video_mp4), webm = CAP.safeUrl(cfg.background_video_webm), img = CAP.safeUrl(cfg.background_image);
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if ((mp4 || webm) && !reduce) {
      media.innerHTML = '<video autoplay muted loop playsinline preload="metadata"' + (img ? ' poster="' + CAP.esc(img) + '"' : "") + ' aria-hidden="true">' +
        (webm ? '<source src="' + CAP.esc(webm) + '" type="video/webm">' : "") + (mp4 ? '<source src="' + CAP.esc(mp4) + '" type="video/mp4">' : "") + "</video>";
      h.classList.add("has-media");
      var video = media.querySelector("video");
      // Contrôle pause/lecture (WCAG 2.2.2) + pause hors écran
      var ctrl = document.createElement("button");
      ctrl.type = "button";
      ctrl.className = "icon-btn hero__media-ctrl";
      ctrl.setAttribute("aria-label", "Mettre la vidéo d'arrière-plan en pause");
      ctrl.innerHTML = CAP.icon("pause");
      var userPaused = false;
      ctrl.addEventListener("click", function () {
        userPaused = !video.paused;
        if (video.paused) video.play(); else video.pause();
        ctrl.innerHTML = CAP.icon(video.paused ? "play" : "pause");
        ctrl.setAttribute("aria-label", video.paused ? "Lire la vidéo d'arrière-plan" : "Mettre la vidéo d'arrière-plan en pause");
      });
      h.appendChild(ctrl);
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (en) {
          if (userPaused) return;
          if (en[0].isIntersecting) { var p = video.play(); if (p && p.catch) p.catch(function () {}); } else video.pause();
        }).observe(h);
      }
    } else if (img) {
      media.innerHTML = '<img src="' + CAP.esc(img) + '" alt="' + CAP.esc(cfg.background_alt || "") + '" fetchpriority="high">';
      h.classList.add("has-media");
    }

    if (P) {
      var notes = [];
      if (!mp4 && !webm && !img) notes.push(CAP.todo("home.hero.background_video_mp4 / background_image", "vidéo ou photo de fond du héro", true));
      if (window.CAPIntro && window.CAPIntro.enabled && !window.CAPIntro.configured) notes.push(CAP.todo("intro.video_mp4", "vidéo d'introduction (emplacement prêt)", true));
      if (notes.length) {
        var n = document.createElement("div");
        n.className = "hero__slot-note stack";
        n.innerHTML = notes.join("");
        var hc = h.querySelector(".hero__content");
        hc.insertBefore(n, hc.firstChild);
      }
    }

    // Entrée du héro après l'intro
    var targets = h.querySelectorAll("[data-reveal-manual]");
    function go() {
      targets.forEach(function (t, i) { setTimeout(function () { t.classList.add("is-in"); }, 120 + i * 140); });
    }
    if (document.body.classList.contains("intro-lock")) document.addEventListener("cap:intro-done", go, { once: true });
    else go();
  }

  /* ---------------- ATOUTS (bandeau défilant) ---------------- */
  function highlights() {
    var el = document.querySelector("[data-highlights]");
    if (!el) return;
    var items = list("home.highlights");
    if (!items.length) {
      if (!P) return removeSection(el);
      items = ["Atout 1 · À PERSONNALISER", "Atout 2 · À PERSONNALISER", "Atout 3 · À PERSONNALISER", "Atout 4 · À PERSONNALISER"];
      el.classList.add("is-todo");
      el.style.color = "var(--todo)";
    }
    var group = '<ul class="marquee__group">' + items.map(function (t) { return '<li class="marquee__item">' + CAP.esc(t) + "</li>"; }).join("") + "</ul>";
    el.innerHTML = '<div class="marquee__track">' + group + group.replace('class="marquee__group"', 'class="marquee__group" aria-hidden="true"') + "</div>";
  }

  /* ---------------- SÉLECTION DE VÉHICULES ---------------- */
  function featured() {
    var el = document.querySelector("[data-featured]");
    if (!el || !window.CAPVehicles) return;
    var V = window.CAPVehicles;
    var avail = V.all.filter(function (v) { return v.status !== "vendu"; });
    var pick = avail.filter(function (v) { return v.featured; });
    if (pick.length < 3) pick = pick.concat(avail.filter(function (v) { return !v.featured; }).sort(V.SORTS.recent)).slice(0, 6);
    pick = pick.slice(0, 6);
    if (!pick.length) {
      if (!P) {
        // Catalogue vide en production : on garde la section avec un message neutre et un lien
        el.innerHTML = '<div class="empty-state" style="grid-column:1/-1">' + CAP.icon("car") + "<h2>" + CAP.esc(CAP.get("catalogue.empty_message") || "Aucun véhicule n'est en ligne pour le moment.") + "</h2></div>";
        return;
      }
      el.innerHTML = V.slotCards(3);
      return;
    }
    el.innerHTML = pick.map(function (v) { return V.card(v); }).join("");
  }

  /* ---------------- SERVICES ---------------- */
  function services() {
    var el = document.querySelector("[data-services]");
    if (!el) return;
    var items = list("home.services.items");
    if (!items.length) {
      if (!P) {
        if (sectionEmpty(["home.services.title", "home.services.subtitle"], items)) return removeSection(el);
        return el.remove();
      }
      el.innerHTML = [1, 2, 3].map(function (i) {
        return '<article class="card service-card service-card--slot"><span class="service-card__num">0' + i + '</span><div class="service-card__icon">' + CAP.icon("info") + "</div>" +
          CAP.todo("home.services.items[" + (i - 1) + "]", "service " + i, true) + '<p class="muted">Titre, texte, icône et lien du service.</p></article>';
      }).join("");
      return;
    }
    el.innerHTML = items.map(function (s, i) {
      var href = CAP.safeUrl(s.href);
      return '<article class="card service-card" data-tilt="3"><span class="service-card__num">' + String(i + 1).padStart(2, "0") + "</span>" +
        '<div class="service-card__icon">' + CAP.icon(s.icon || "check") + "</div>" +
        (s.title ? '<h3>' + CAP.esc(s.title) + "</h3>" : "") +
        (s.text ? "<p>" + CAP.esc(s.text) + "</p>" : "") +
        (href ? '<a class="link-arrow mt-4" href="' + CAP.esc(href) + '">En savoir plus ' + CAP.icon("arrow") + '<span class="sr-only"> : ' + CAP.esc(s.title || "") + "</span></a>" : "") +
        "</article>";
    }).join("");
  }

  /* ---------------- À PROPOS (accueil) ---------------- */
  function aboutTeaser() {
    var el = document.querySelector("[data-about-media]");
    if (!el) return;
    var a = CAP.get("home.about") || {};
    var html = CAP.imageSlot(a.image, a.image_alt, "home.about.image", { hint: "Photo du concessionnaire (portrait 4:5)", icon: "image" });
    if (!html) {
      if (!P && sectionEmpty(["home.about.title", "home.about.text"], [])) return removeSection(el);
      el.closest(".media-frame") && el.closest(".media-frame").remove();
      return;
    }
    el.innerHTML = html;
  }

  /* ---------------- CHIFFRES CLÉS ---------------- */
  function figures() {
    var el = document.querySelector("[data-figures]");
    if (!el) return;
    var items = list("home.figures");
    if (!items.length) {
      if (!P) return el.remove();
      el.innerHTML = [1, 2, 3].map(function (i) { return '<div class="figure"><div class="figure__value">—</div>' + CAP.todo("home.figures[" + (i - 1) + "]", "chiffre réel") + "</div>"; }).join("");
      return;
    }
    el.innerHTML = items.map(function (f) {
      return '<div class="figure"><div class="figure__value">' + CAP.esc(f.value) + '</div><div class="figure__label">' + CAP.esc(f.label) + "</div></div>";
    }).join("");
  }

  /* ---------------- AVIS ---------------- */
  function testimonials() {
    var el = document.querySelector("[data-testimonials]");
    if (!el) return;
    var items = list("home.testimonials.items");
    var g = CAP.get("home.testimonials.google") || {};
    var gUrl = CAP.safeUrl(g.url), gWrite = CAP.safeUrl(g.write_url);
    if (!items.length && (gUrl || gWrite)) {
      // Résumé des avis Google : note + accès aux avis + bouton pour en laisser un
      var stars5 = "";
      for (var k = 0; k < 5; k++) stars5 += CAP.icon("star");
      el.innerHTML = '<div class="card review-summary" style="grid-column:1/-1">' +
        '<div class="review-summary__score"><span class="review-summary__rating">' + CAP.esc(g.rating || "") + '</span><span class="review-summary__max">/5</span></div>' +
        '<div class="review-summary__body"><div class="stars review-summary__stars" role="img" aria-label="Note de ' + CAP.esc(g.rating || "") + ' sur 5">' + stars5 + "</div>" +
        "<p><strong>" + CAP.esc(g.count_label || "Avis clients") + '</strong> sur Google</p>' +
        '<p class="muted">Votre avis compte : partagez votre expérience avec nous.</p></div>' +
        '<div class="review-summary__actions">' +
        (gWrite ? '<a class="btn" data-magnetic href="' + CAP.esc(gWrite) + '" target="_blank" rel="noopener noreferrer">' + CAP.icon("star") + "<span>Laisser un avis</span></a>" : "") +
        (gUrl ? '<a class="btn btn--ghost" href="' + CAP.esc(gUrl) + '" target="_blank" rel="noopener noreferrer"><span>Voir tous les avis</span>' + CAP.icon("arrow-up-right") + "</a>" : "") +
        "</div></div>";
      return;
    }
    if (!items.length) {
      if (!P) return removeSection(el);
      el.innerHTML = [1, 2, 3].map(function (i) {
        return '<figure class="card testimonial"><div class="stars" aria-hidden="true">' + CAP.icon("star") + "</div>" +
          CAP.todo("home.testimonials.items[" + (i - 1) + "]", "avis client réel", true) + "</figure>";
      }).join("");
      return;
    }
    el.innerHTML = items.map(function (t) {
      var r = Math.max(0, Math.min(5, parseInt(t.rating, 10) || 0));
      var stars = "";
      for (var i = 0; i < r; i++) stars += CAP.icon("star");
      return '<figure class="card testimonial">' + (r ? '<div class="stars" role="img" aria-label="Note : ' + r + ' sur 5">' + stars + "</div>" : "") +
        "<blockquote><p>" + CAP.esc(t.text) + "</p></blockquote>" +
        "<figcaption><strong>" + CAP.esc(t.author) + "</strong>" + [t.source, t.date].filter(Boolean).map(CAP.esc).join(" · ") + "</figcaption></figure>";
    }).join("");
  }

  /* ---------------- CTA ---------------- */
  function ctaBand() {
    var el = document.querySelector("[data-cta-band]");
    if (!el) return;
    if (!P && sectionEmpty(["home.cta_band.title", "home.cta_band.text", "home.cta_band.button.label"], [])) removeSection(el);
  }

  /* ---------------- COORDONNÉES / HORAIRES ---------------- */
  function contactBlocks() {
    document.querySelectorAll("[data-contact-list]").forEach(function (el) {
      var html = CAP.contactListHtml();
      if (html) el.innerHTML = html; else el.closest(".panel") ? el.closest(".panel").remove() : el.remove();
    });
    document.querySelectorAll("[data-hours]").forEach(function (el) {
      CAP.renderHoursTable(el);
      if (!el.innerHTML && el.closest(".panel")) el.closest(".panel").remove();
    });
    document.querySelectorAll("[data-social]").forEach(function (el) {
      var html = CAP.socialLinks();
      if (html) el.innerHTML = html; else el.remove();
    });
    document.querySelectorAll("[data-map]").forEach(function (el) {
      var src = CAP.safeUrl(CAP.get("dealer.map_embed_url"));
      if (src) {
        el.innerHTML = '<div class="map-frame" data-consent-embed="medias" data-src="' + CAP.esc(src) + '" data-title="Plan d\'accès"></div>';
      } else if (P) {
        el.innerHTML = '<div class="map-frame"><div class="slot">' + CAP.icon("pin") + "<strong>EMPLACEMENT CARTE</strong><span>Chargée uniquement après consentement</span><code>dealer.map_embed_url</code></div></div>";
      } else {
        el.remove();
      }
    });
  }

  /* ---------------- PAGE À PROPOS ---------------- */
  function aboutPage() {
    var el = document.querySelector("[data-about-page]");
    if (!el) return;
    var a = CAP.get("about_page") || {};
    var main = el.querySelector("[data-about-main-media]");
    if (main) {
      var h = CAP.imageSlot(a.image, a.image_alt, "about_page.image", { hint: "Photo principale (16:10)" });
      if (h) main.innerHTML = h; else main.closest(".media-frame").remove();
    }
    var secBox = el.querySelector("[data-about-sections]");
    var secs = list("about_page.sections");
    if (!secs.length) {
      secBox.innerHTML = P ? [1, 2].map(function (i) {
        return '<div class="grid grid--2" data-reveal><div>' + CAP.todo("about_page.sections[" + (i - 1) + "]", "bloc " + i + " : titre + texte + photo", true) +
          '</div><div class="media-frame media-frame--wide">' + CAP.imageSlot("", "", "about_page.sections[" + (i - 1) + "].image", { hint: "Photo (16:10)" }) + "</div></div>";
      }).join('<div class="mt-7"></div>') : "";
    } else {
      secBox.innerHTML = secs.map(function (s, i) {
        var img = CAP.imageSlot(s.image, s.image_alt, "", {});
        return '<div class="grid grid--2' + (i ? " mt-7" : "") + '" data-reveal>' +
          '<div style="order:' + (i % 2) + '">' + (s.title ? '<h2 class="display h3">' + CAP.esc(s.title) + "</h2>" : "") +
          (s.text ? '<div class="prose mt-5">' + CAP.paragraphs(s.text) + "</div>" : "") + "</div>" +
          (img ? '<div class="media-frame media-frame--wide">' + img + "</div>" : "<div></div>") + "</div>";
      }).join("");
    }
    var gal = el.querySelector("[data-about-gallery]");
    var photos = list("about_page.gallery").filter(function (p) { return CAP.safeUrl(p.src); });
    if (!photos.length) {
      if (!P) return removeSection(gal);
      gal.innerHTML = [1, 2, 3, 4].map(function (i) { return '<div class="media-frame">' + CAP.imageSlot("", "", "about_page.gallery[" + (i - 1) + "]", { hint: "Photo " + i }) + "</div>"; }).join("");
      return;
    }
    gal.innerHTML = photos.map(function (p) { return '<div class="media-frame" data-reveal="scale">' + CAP.imageSlot(p.src, p.alt, "", {}) + "</div>"; }).join("");
  }

  /* ---------------- PAGES JURIDIQUES ---------------- */
  function legal() {
    // Valeurs juridiques : data-legal="legal.siren" → valeur ou repère « à compléter »
    document.querySelectorAll("[data-legal]").forEach(function (el) {
      var path = el.getAttribute("data-legal");
      var v = CAP.get(path);
      if (!CAP.isEmpty(v)) {
        if (el.hasAttribute("data-legal-link")) {
          var u = CAP.safeUrl(v);
          el.innerHTML = u ? '<a href="' + CAP.esc(u) + '" target="_blank" rel="noopener noreferrer">' + CAP.esc(v) + "</a>" : CAP.esc(v);
        } else if (el.hasAttribute("data-legal-tel") && CAP.phoneHref()) {
          el.innerHTML = '<a href="' + CAP.esc(CAP.phoneHref()) + '">' + CAP.esc(v) + "</a>";
        } else if (el.hasAttribute("data-legal-mail")) {
          el.innerHTML = '<a href="mailto:' + CAP.esc(v) + '">' + CAP.esc(v) + "</a>";
        } else el.textContent = v;
      } else {
        // Les informations légales manquantes restent visibles comme « à compléter » même hors prévisualisation :
        // le build refuse de toute façon la publication tant qu'elles sont vides.
        el.innerHTML = CAP.demo
          ? '<span class="muted">À compléter par l\'entreprise</span>'
          : '<span class="todo">À COMPLÉTER ET À VÉRIFIER <small>' + CAP.esc(path) + "</small></span>";
      }
    });
    if (!P && !CAP.demo) document.querySelectorAll("[data-legal-review]").forEach(function (n) { n.remove(); });
    // Lignes facultatives (ex. ORIAS) : masquées en publication si vides
    document.querySelectorAll("[data-legal-optional]").forEach(function (row) {
      if (!P && CAP.isEmpty(CAP.get(row.getAttribute("data-legal-optional")))) row.remove();
    });
    // Liste des traceurs déclarés
    var tbl = document.querySelector("[data-cookie-table]");
    if (tbl && window.CAPConsent) {
      var s = window.CAPConsent.services;
      tbl.innerHTML = s.length
        ? '<table class="spec-table"><thead><tr><th scope="col">Service</th><th scope="col">Finalité</th><th scope="col">Durée</th></tr></thead><tbody>' +
          s.map(function (x) {
            return "<tr><td>" + CAP.esc(x.name || x.id) + (x.provider ? "<br><small class=\"muted\">" + CAP.esc(x.provider) + "</small>" : "") + "</td><td>" +
              CAP.esc((window.CAPConsent.categories[x.category] || {}).title || x.category) + (x.purpose ? " — " + CAP.esc(x.purpose) : "") + "</td><td>" + CAP.esc(x.duration || "—") + "</td></tr>";
          }).join("") + "</tbody></table>"
        : "<p>À ce jour, aucun traceur soumis à consentement n'est utilisé sur ce site. Seul un stockage local strictement nécessaire mémorise vos choix de consentement (clé <code>cap_consent</code>, " +
          Math.round((CAP.get("cookies.consent_duration_days") || 180) / 30) + " mois maximum).</p>";
    }
  }

  /* ---------------- Liens d'appel conditionnels ---------------- */
  function phoneButtons() {
    document.querySelectorAll("[data-phone-btn]").forEach(function (a) {
      var tel = CAP.phoneHref();
      if (tel) { a.href = tel; var l = a.querySelector("[data-phone-label]"); if (l) l.textContent = CAP.phoneLabel(); }
      else a.remove();
    });
  }

  hero();
  highlights();
  featured();
  services();
  aboutTeaser();
  figures();
  testimonials();
  ctaBand();
  contactBlocks();
  if (window.CAPConsent) window.CAPConsent.refresh();
  aboutPage();
  legal();
  phoneButtons();
})();
