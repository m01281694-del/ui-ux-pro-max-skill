/* =====================================================================
   CAP AUTO — Introduction cinématique (page d'accueil uniquement)
   Réglages : content/site.js → intro
   Le film est une vidéo pré-rendue en haute qualité (rendu 3D image par
   image) : il est parfaitement fluide sur tous les appareils, car aucun
   calcul 3D n'est fait chez le visiteur.
   - lancement automatique à l'arrivée, une fois par visite ;
   - version légère (720p) sur mobile / connexion économique ;
   - « Passer », Échap, molette, glissé ou touche de défilement l'interrompent ;
   - ignorée si « réduire les animations » est demandé ;
   - la page d'accueil est déjà chargée dessous : aucun rechargement,
     aucune redirection, l'URL ne change jamais ;
   - si la vidéo tarde à démarrer, on n'attend pas : le site s'affiche.
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

  var small = window.matchMedia("(max-width: 900px)").matches ||
    !!(navigator.connection && (navigator.connection.saveData || /2g/.test(navigator.connection.effectiveType || "")));
  var mp4 = CAP.safeUrl(small && cfg.video_mp4_mobile ? cfg.video_mp4_mobile : cfg.video_mp4);
  var webm = CAP.safeUrl(small && cfg.video_webm_mobile ? cfg.video_webm_mobile : cfg.video_webm);
  var poster = CAP.safeUrl(cfg.poster);
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var force = /[?&]intro=1\b/.test(location.search);
  var seen = false;
  try { seen = sessionStorage.getItem("cap_intro_seen") === "1"; } catch (e) {}

  window.CAPIntro = { configured: !!(mp4 || webm), enabled: cfg.enabled !== false };

  if (cfg.enabled === false || !(mp4 || webm) || (reduce && !force) || (cfg.once_per_session !== false && seen && !force)) {
    return skipNow();
  }

  document.body.classList.add("intro-lock");
  try { sessionStorage.setItem("cap_intro_seen", "1"); } catch (e) {}

  var logo = CAP.safeUrl(CAP.get("site.logo"));
  var name = CAP.siteName();
  var titleAt = typeof cfg.title_at === "number" ? cfg.title_at : 5.6;   // seconde d'apparition du nom
  var words = String(name || "").split(/\s+/).filter(Boolean);

  var el = document.createElement("div");
  el.className = "intro3d";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Introduction vidéo");
  el.innerHTML =
    '<div class="intro3d__stage"><video class="intro3d__video" playsinline muted preload="auto" disablepictureinpicture' +
    (poster ? ' poster="' + CAP.esc(poster) + '"' : "") + ">" +
    (webm ? '<source src="' + CAP.esc(webm) + '" type="video/webm">' : "") +
    (mp4 ? '<source src="' + CAP.esc(mp4) + '" type="video/mp4">' : "") +
    "</video></div>" +
    '<div class="intro3d__grade" aria-hidden="true"></div>' +
    '<div class="intro3d__grain" aria-hidden="true"></div>' +
    '<div class="intro3d__title" aria-hidden="true">' +
    (logo ? '<img src="' + CAP.esc(logo) + '" alt="">' :
      words.map(function (w, i) { return '<span style="--d:' + (i * 140) + 'ms">' + CAP.esc(w) + "</span>"; }).join(" ")) +
    '<i class="intro3d__line"></i></div>' +
    '<div class="intro3d__loader" aria-hidden="true"><span></span></div>' +
    '<div class="intro3d__progress" aria-hidden="true"></div>' +
    '<button type="button" class="btn btn--ghost btn--sm intro3d__skip">' + CAP.esc(cfg.skip_label || "Passer l'intro") + CAP.icon("arrow", "arrow") + "</button>";
  document.body.appendChild(el);
  root.classList.remove("intro-pending");
  requestAnimationFrame(function () { el.classList.add("is-on"); });

  var video = el.querySelector("video");
  var skip = el.querySelector(".intro3d__skip");
  var bar = el.querySelector(".intro3d__progress");
  var closing = false, timers = [], titled = false;
  setTimeout(function () { skip.focus({ preventScroll: true }); }, 120);

  function close(fast) {
    if (closing) return;
    closing = true;
    timers.forEach(clearTimeout);
    detach();
    el.classList.add("is-leaving");
    if (fast) el.classList.add("is-fast");
    finish();                                   // l'accueil se révèle pendant le fondu
    setTimeout(function () {
      try { video.pause(); video.removeAttribute("src"); video.load(); } catch (e) {}
      el.remove();
    }, fast ? 450 : 1000);
  }

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

  video.addEventListener("playing", function () { el.classList.add("is-playing"); });
  video.addEventListener("timeupdate", function () {
    if (video.duration) bar.style.transform = "scaleX(" + video.currentTime / video.duration + ")";
    if (!titled && video.currentTime >= titleAt) { titled = true; el.classList.add("show-title"); }
  });
  video.addEventListener("ended", function () { timers.push(setTimeout(function () { close(false); }, 350)); });
  video.addEventListener("error", function () { close(true); }, true);
  var srcs = video.querySelectorAll("source");
  if (srcs.length) srcs[srcs.length - 1].addEventListener("error", function () { close(true); });

  // Le site ne reste jamais bloqué : démarrage trop lent → on passe ; durée plafonnée
  timers.push(setTimeout(function () { if (!el.classList.contains("is-playing")) close(true); }, 4500));
  timers.push(setTimeout(function () { close(false); }, 14000));
  var p = video.play();
  if (p && p.catch) p.catch(function () { close(true); });
})();
