/* =====================================================================
   CAP AUTO — Introduction (page d'accueil uniquement)
   Réglages : content/site.js → intro
     mode: "3d"     → film 3D temps réel (assets/js/intro3d.js, Three.js)
     mode: "video"  → votre fichier vidéo (intro.video_mp4)
   Règles communes :
   - se lance automatiquement à l'arrivée, une fois par visite ;
   - ne change jamais l'URL, ne recharge rien : la page d'accueil est déjà
     chargée dessous et se révèle à la fin ;
   - « Passer », Échap, molette, glissé ou touche de défilement l'interrompent ;
   - ignorée si « réduire les animations » est demandé ou si WebGL manque ;
   - si le chargement est trop lent, on n'attend pas : le site s'affiche.
   - ?intro=1 dans l'adresse force la relecture (pratique pour tester).
   Émet l'événement document « cap:intro-done » à la fin.
   ===================================================================== */
(function () {
  "use strict";
  var CAP = window.CAP;
  var cfg = CAP.content.intro || {};
  var root = document.documentElement;
  var done = false;

  function finish() {
    if (done) return;
    done = true;
    root.classList.remove("intro-pending");
    document.body.classList.remove("intro-lock");
    document.dispatchEvent(new CustomEvent("cap:intro-done"));
  }
  function skipNow() {
    root.classList.remove("intro-pending");
    if (document.readyState !== "loading") setTimeout(finish, 0);
    else document.addEventListener("DOMContentLoaded", finish);
  }

  var mp4 = CAP.safeUrl(cfg.video_mp4), webm = CAP.safeUrl(cfg.video_webm);
  var mode = cfg.mode === "video" && (mp4 || webm) ? "video" : (cfg.mode === "video" ? "none" : "3d");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var force = /[?&]intro=1\b/.test(location.search);
  var seen = false;
  try { seen = sessionStorage.getItem("cap_intro_seen") === "1"; } catch (e) {}

  function webglOk() {
    try {
      var c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
    } catch (e) { return false; }
  }

  window.CAPIntro = { configured: mode !== "none", enabled: cfg.enabled !== false, mode: mode };

  if (cfg.enabled === false || mode === "none" || (reduce && !force) ||
      (cfg.once_per_session !== false && seen && !force) || (mode === "3d" && !webglOk())) {
    return skipNow();
  }

  document.body.classList.add("intro-lock");
  try { sessionStorage.setItem("cap_intro_seen", "1"); } catch (e) {}

  var logo = CAP.safeUrl(CAP.get("site.logo"));
  var name = CAP.siteName();

  if (mode === "3d") return run3d();
  return runVideo();

  /* ================================================================== */
  /* FILM 3D                                                             */
  /* ================================================================== */
  function run3d() {
    var el = document.createElement("div");
    el.className = "intro3d";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Introduction animée");
    var words = String(name || "").split(/\s+/).filter(Boolean);
    el.innerHTML =
      '<div class="intro3d__stage"></div>' +
      '<div class="intro3d__dip" aria-hidden="true"></div>' +
      '<div class="intro3d__grade" aria-hidden="true"></div>' +
      '<div class="intro3d__grain" aria-hidden="true"></div>' +
      '<div class="intro3d__bar intro3d__bar--top" aria-hidden="true"></div>' +
      '<div class="intro3d__bar intro3d__bar--bottom" aria-hidden="true"></div>' +
      '<div class="intro3d__title" aria-hidden="true">' +
      (logo ? '<img src="' + CAP.esc(logo) + '" alt="">' :
        words.map(function (w, i) { return '<span style="--d:' + (i * 140) + 'ms">' + CAP.esc(w) + "</span>"; }).join(" ")) +
      '<i class="intro3d__line"></i></div>' +
      '<div class="intro3d__loader" aria-hidden="true"><span></span></div>' +
      '<button type="button" class="btn btn--ghost btn--sm intro3d__skip">' + CAP.esc(cfg.skip_label || "Passer l'intro") + CAP.icon("arrow", "arrow") + "</button>";
    document.body.appendChild(el);
    root.classList.remove("intro-pending");
    requestAnimationFrame(function () { el.classList.add("is-on"); });

    var stage = el.querySelector(".intro3d__stage");
    var skip = el.querySelector(".intro3d__skip");
    var film = null, closing = false, timers = [];
    setTimeout(function () { skip.focus({ preventScroll: true }); }, 120);

    function close(fast) {
      if (closing) return;
      closing = true;
      timers.forEach(clearTimeout);
      detach();
      el.classList.add("is-leaving");
      if (fast) el.classList.add("is-fast");
      finish();                                   // la page d'accueil se révèle pendant le fondu
      setTimeout(function () {
        if (film) film.dispose();
        el.remove();
      }, fast ? 450 : 1000);
    }

    // Toute intention de naviguer interrompt l'intro
    function onKey(e) {
      if (e.key === "Escape" || e.key === " " || e.key === "PageDown" || e.key === "ArrowDown" || e.key === "End") { e.preventDefault(); close(true); }
      if (e.key === "Tab") CAP.trapFocus(el, e);
    }
    function onIntent() { close(true); }
    el.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onIntent, { passive: true });
    window.addEventListener("touchmove", onIntent, { passive: true });
    skip.addEventListener("click", function () { close(true); });
    function detach() {
      el.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onIntent);
      window.removeEventListener("touchmove", onIntent);
    }

    // Le site ne reste jamais bloqué : si le moteur 3D n'est pas prêt à temps, on passe
    timers.push(setTimeout(function () { if (!film) close(true); }, 5000));

    var url = new URL("assets/js/intro3d.js", document.baseURI).href;
    import(url).then(function (mod) {
      if (closing) return null;
      return mod.play({ mount: stage, brand: name, onTitle: function () { el.classList.add("show-title"); } });
    }).then(function (f) {
      if (!f) return;
      if (closing) { f.dispose(); return; }
      film = f;
      el.classList.add("is-playing");
      if (!window.__noCap) timers.push(setTimeout(function () { close(false); }, 9500));   // jamais plus de ~9,5 s
      return f.ended.then(function () { timers.push(setTimeout(function () { close(false); }, 250)); });
    }).catch(function () { close(true); });
  }

  /* ================================================================== */
  /* VIDÉO (mode: "video")                                               */
  /* ================================================================== */
  function runVideo() {
    var el = document.createElement("div");
    el.className = "intro";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Vidéo d'introduction");
    el.innerHTML =
      '<div class="intro__loader" aria-hidden="true"><span></span>Chargement</div>' +
      '<video playsinline muted preload="auto"' + (cfg.poster ? ' poster="' + CAP.esc(CAP.safeUrl(cfg.poster)) + '"' : "") + ">" +
      (webm ? '<source src="' + CAP.esc(webm) + '" type="video/webm">' : "") +
      (mp4 ? '<source src="' + CAP.esc(mp4) + '" type="video/mp4">' : "") +
      "</video>" +
      '<div class="intro__vignette"></div>' +
      (cfg.logo_reveal !== false && (logo || name)
        ? '<div class="intro__brand" aria-hidden="true">' + (logo ? '<img src="' + CAP.esc(logo) + '" alt="">' : CAP.esc(name)) + "</div>" : "") +
      '<div class="intro__ui">' +
      '<div class="intro__ui-group">' +
      '<button type="button" class="icon-btn" data-intro="pause" aria-label="Mettre en pause">' + CAP.icon("pause") + "</button>" +
      '<button type="button" class="icon-btn" data-intro="sound" aria-label="Activer le son" aria-pressed="false">' + CAP.icon("mute") + "</button>" +
      "</div>" +
      '<button type="button" class="btn btn--ghost btn--sm intro__skip" data-intro="skip">' + CAP.esc(cfg.skip_label || "Passer l'intro") + CAP.icon("arrow", "arrow") + "</button>" +
      "</div>" +
      '<div class="intro__progress" aria-hidden="true"></div>' +
      '<div class="intro__curtain intro__curtain--top"></div><div class="intro__curtain intro__curtain--bottom"></div>';
    document.body.appendChild(el);
    root.classList.remove("intro-pending");

    var video = el.querySelector("video");
    var bar = el.querySelector(".intro__progress");
    var btnPause = el.querySelector('[data-intro="pause"]');
    var btnSound = el.querySelector('[data-intro="sound"]');
    var skip = el.querySelector('[data-intro="skip"]');
    var closing = false;
    setTimeout(function () { skip.focus({ preventScroll: true }); }, 100);

    function close() {
      if (closing) return;
      closing = true;
      el.classList.add("show-brand");
      var hold = cfg.logo_reveal !== false && (logo || name) ? 900 : 0;
      setTimeout(function () {
        el.classList.add("is-closing");
        setTimeout(function () {
          try { video.pause(); } catch (e) {}
          el.classList.add("is-leaving");
          finish();
          setTimeout(function () { el.remove(); }, 600);
        }, 700);
      }, hold);
    }

    video.addEventListener("playing", function () { el.classList.add("is-playing"); });
    video.addEventListener("timeupdate", function () {
      if (video.duration) bar.style.transform = "scaleX(" + video.currentTime / video.duration + ")";
    });
    video.addEventListener("ended", close);
    video.addEventListener("error", close, true);
    var src = video.querySelectorAll("source");
    if (src.length) src[src.length - 1].addEventListener("error", close);
    var startTimeout = setTimeout(function () { if (!el.classList.contains("is-playing")) close(); }, 6000);
    video.addEventListener("playing", function () { clearTimeout(startTimeout); }, { once: true });
    var p = video.play();
    if (p && p.catch) p.catch(function () { close(); });

    btnPause.addEventListener("click", function () {
      if (video.paused) { video.play(); btnPause.innerHTML = CAP.icon("pause"); btnPause.setAttribute("aria-label", "Mettre en pause"); }
      else { video.pause(); btnPause.innerHTML = CAP.icon("play"); btnPause.setAttribute("aria-label", "Lire"); }
    });
    btnSound.addEventListener("click", function () {
      video.muted = !video.muted;
      btnSound.innerHTML = CAP.icon(video.muted ? "mute" : "volume");
      btnSound.setAttribute("aria-pressed", String(!video.muted));
      btnSound.setAttribute("aria-label", video.muted ? "Activer le son" : "Couper le son");
    });
    skip.addEventListener("click", close);
    el.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
      if (e.key === "Tab") CAP.trapFocus(el, e);
    });
  }
})();
