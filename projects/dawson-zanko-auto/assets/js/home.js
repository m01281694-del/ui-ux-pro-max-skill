/* Accueil : intro cinématique, scène héro pilotée au défilement, vitrine, avis. */
(function () {
  "use strict";
  var DZ = window.DZ, $ = DZ.$, $$ = DZ.$$, root = document.documentElement;

  /* ---------- Intro ---------- */
  var intro = $("[data-intro]");
  function heroIn() {
    root.classList.add("hero-in");
    // Après l'entrée « caméra », le défilement pilote l'image sans inertie CSS.
    setTimeout(function () { root.classList.add("is-scrolling-hero"); }, 2700);
  }
  if (intro && root.classList.contains("intro-on")) {
    var done = false;
    var end = function () {
      if (done) return; done = true;
      try { sessionStorage.setItem("dz_intro", "1"); } catch (e) {}
      root.classList.add("intro-out");
      setTimeout(heroIn, 250);
      setTimeout(function () { root.classList.remove("intro-on", "intro-out"); intro.remove(); }, 1100);
      removeEventListener("keydown", onKey); removeEventListener("wheel", end); removeEventListener("touchmove", end);
    };
    var onKey = function (e) { if (["Escape", "Enter", " ", "ArrowDown", "PageDown"].indexOf(e.key) > -1) end(); };
    $("[data-intro-skip]", intro).addEventListener("click", end);
    addEventListener("keydown", onKey); addEventListener("wheel", end, { passive: true }); addEventListener("touchmove", end, { passive: true });
    setTimeout(end, 3000);
  } else {
    if (intro) intro.remove();
    requestAnimationFrame(heroIn);
  }

  /* ---------- Titre ajusté à la largeur (quel que soit le nom de marque) ---------- */
  var title = $(".hero__title");
  function fit() {
    if (!title) return;
    title.style.setProperty("--fit", "");
    var max = title.parentElement.clientWidth - 2 * parseFloat(getComputedStyle(title.parentElement).paddingLeft), widest = 0;
    $$(".w", title).forEach(function (w) { widest = Math.max(widest, w.getBoundingClientRect().width); });
    if (widest > max) title.style.setProperty("--fit", (parseFloat(getComputedStyle(title).fontSize) * (max / widest) * 0.97).toFixed(1) + "px");
  }
  fit();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  addEventListener("resize", fit);

  /* ---------- Scène héro ---------- */
  var hero = $("[data-hero]"), stage = hero && $(".hero__stage", hero), statements = $$("[data-statement]");
  if (hero && !DZ.reduce) {
    var ticking = false;
    var clamp = function (v) { return Math.max(0, Math.min(1, v)); };
    var render = function () {
      ticking = false;
      var r = hero.getBoundingClientRect();
      var p = clamp(-r.top / Math.max(1, r.height - innerHeight));
      stage.style.setProperty("--p", p.toFixed(4));
      statements.forEach(function (s, i) {
        var a = 0.3 + i * 0.2, o = clamp((p - a) / 0.06) * clamp((a + 0.2 - p) / 0.06);
        if (i === statements.length - 1) o = clamp((p - a) / 0.06) * clamp((1 - p) / 0.08);
        s.style.opacity = o.toFixed(3);
        s.style.transform = "translateY(" + ((1 - o) * (p < a + 0.1 ? 24 : -24)).toFixed(1) + "px)";
      });
    };
    addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(render); } }, { passive: true });
    addEventListener("resize", render);
    render();
  } else if (hero) hero.classList.add("is-static");

  /* ---------- Recherche héro ---------- */
  var form = $("[data-hero-search]");
  if (form) {
    $$("[data-q]", form).forEach(function (b) {
      b.addEventListener("click", function () { form.q.value = b.getAttribute("data-q"); form.requestSubmit ? form.requestSubmit() : form.submit(); });
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = form.q.value.trim();
      location.href = "/vehicules" + (q ? "?q=" + encodeURIComponent(q) : "") + "#recherche";
    });
  }

  /* ---------- Vitrine ---------- */
  var rail = $("[data-featured]");
  if (rail) {
    var list = DZ.vehicles.filter(function (v) { return v.status !== "vendu"; });
    var feat = list.filter(function (v) { return v.featured; });
    list = (feat.length >= 3 ? feat : list).slice(0, 8);
    if (!list.length) {
      rail.innerHTML = '<div class="wrap"><div class="empty glass"><h3>Nouveaux arrivages en préparation</h3><p class="muted">Décrivez-nous la voiture que vous cherchez, nous revenons vers vous.</p><a class="btn btn--light" href="/contact?sujet=recherche">Recherche personnalisée</a></div></div>';
      $("[data-rail-ctrl]").hidden = true;
    } else {
      rail.innerHTML = '<div class="rail__track">' + list.map(DZ.card).join("") + "</div>";
      var bar = $("[data-rail-progress]");
      var upd = function () {
        var max = rail.scrollWidth - rail.clientWidth;
        bar.style.transform = "scaleX(" + (max > 0 ? Math.max(0.08, rail.scrollLeft / max) : 1) + ")";
      };
      rail.addEventListener("scroll", upd, { passive: true }); upd();
      $$("[data-rail]").forEach(function (b) {
        b.addEventListener("click", function () {
          var c = $(".vcard", rail);
          rail.scrollBy({ left: Number(b.getAttribute("data-rail")) * (c ? c.offsetWidth + 24 : 320) * 1.5, behavior: DZ.reduce ? "auto" : "smooth" });
        });
      });
    }
  }

  /* ---------- Avis (réels uniquement) ---------- */
  var R = DZ.SITE.reviews || {}, items = (R.items || []).filter(function (r) { return r && r.text && r.author; });
  var sec = $("[data-reviews]");
  if (sec && (items.length || R.google_rating)) {
    sec.hidden = false;
    var html = "";
    if (R.google_rating) {
      html += '<div class="review review--score glass" data-reveal><p class="review__score">' + DZ.esc(R.google_rating) + "<small>/5</small></p><p class=\"muted\">Note Google" + (R.google_count ? " · " + DZ.esc(R.google_count) : "") + "</p>" +
        (DZ.safeUrl(R.google_url) ? '<a class="link-arrow" href="' + DZ.esc(R.google_url) + '" target="_blank" rel="noopener">Voir les avis ' + DZ.icon("arrow") + "</a>" : "") + "</div>";
    }
    html += items.map(function (r) {
      var n = Math.max(0, Math.min(5, Number(r.rating) || 0));
      return '<figure class="review glass" data-reveal><div class="stars" aria-label="' + n + ' sur 5">' + new Array(n + 1).join(DZ.icon("star")) + "</div><blockquote>" + DZ.esc(r.text) + "</blockquote><figcaption>" + DZ.esc(r.author) + (r.date ? " · " + DZ.esc(r.date) : "") + "</figcaption></figure>";
    }).join("");
    $("[data-reviews-list]").innerHTML = html;
  }
  DZ.observe(document);
})();
