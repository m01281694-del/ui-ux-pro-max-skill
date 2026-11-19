/* =====================================================================
   CAP AUTO SEPTÈMES — Vidéo d'introduction (page d'accueil)
   Réglages : content/site.js → intro
   - lecture muette automatique (exigence des navigateurs), son activable ;
   - boutons Passer / Pause / Son, barre de progression ;
   - sortie en « double rideau » puis révélation du héro ;
   - une seule fois par visite (option), ignorée si l'utilisateur
     a demandé à réduire les animations ;
   - ?intro=1 dans l'adresse force la relecture (pratique pour tester).
   Émet l'événement document « cap:intro-done » à la fin.
   ===================================================================== */
(function () {
  "use strict";
  var CAP = window.CAP;
  var cfg = CAP.content.intro || {};
  var done = false;

  function finish() {
    if (done) return;
    done = true;
    document.body.classList.remove("intro-lock");
    document.dispatchEvent(new CustomEvent("cap:intro-done"));
  }

  var mp4 = CAP.safeUrl(cfg.video_mp4), webm = CAP.safeUrl(cfg.video_webm);
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var force = /[?&]intro=1\b/.test(location.search);
  var seen = false;
  try { seen = sessionStorage.getItem("cap_intro_seen") === "1"; } catch (e) {}

  window.CAPIntro = { configured: !!(mp4 || webm), enabled: cfg.enabled !== false };

  if (cfg.enabled === false || !(mp4 || webm) || (reduce && !force) || (cfg.once_per_session !== false && seen && !force)) {
    // Pas d'intro : on libère immédiatement l'animation du héro
    document.addEventListener("DOMContentLoaded", finish);
    if (document.readyState !== "loading") setTimeout(finish, 0);
    return;
  }

  document.body.classList.add("intro-lock");
  try { sessionStorage.setItem("cap_intro_seen", "1"); } catch (e) {}

  var logo = CAP.safeUrl(CAP.get("site.logo"));
  var name = CAP.siteName();
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

  // Sécurité : si la vidéo ne démarre pas, on n'enferme pas le visiteur
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
})();
