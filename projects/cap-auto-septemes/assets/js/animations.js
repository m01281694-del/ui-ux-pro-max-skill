/* =====================================================================
   CAP AUTO SEPTÈMES — Animations & micro-interactions
   (sans bibliothèque externe, désactivées si « réduire les animations »)
   - apparition au défilement      [data-reveal], [data-stagger]
   - titres mot par mot            [data-split]
   - parallaxe                     [data-parallax="0.15"]
   - boutons magnétiques           [data-magnetic]
   - inclinaison 3D des cartes     [data-tilt]
   - en-tête dynamique, barre de progression, transitions de page
   Appeler CAPAnim.refresh(root) après avoir inséré du contenu dynamique.
   ===================================================================== */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---------------- Découpage des titres ---------------- */
  function split(el) {
    if (el.dataset.splitDone || el.querySelector(".todo")) return;
    var text = el.textContent.trim();
    if (!text) return;
    el.setAttribute("aria-label", text);
    el.innerHTML = text.split(/\s+/).map(function (w, i) {
      return '<span class="split-word" aria-hidden="true"><span style="--i:' + i + '">' + w.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</span></span>";
    }).join(" ");
    el.dataset.splitDone = "1";
  }

  /* ---------------- Apparition au défilement ---------------- */
  var io = ("IntersectionObserver" in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add("is-in");
      io.unobserve(en.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }) : null;

  function refresh(root) {
    root = root || document;
    root.querySelectorAll("[data-split]").forEach(function (el) {
      split(el);
      if (!el.hasAttribute("data-reveal") && !el.closest("[data-reveal]")) el.setAttribute("data-reveal", "fade");
    });
    root.querySelectorAll("[data-stagger]").forEach(function (group) {
      var step = parseInt(group.getAttribute("data-stagger"), 10) || 90;
      Array.prototype.forEach.call(group.children, function (child, i) {
        if (!child.hasAttribute("data-reveal")) child.setAttribute("data-reveal", "");
        child.style.setProperty("--reveal-delay", (i % 8) * step + "ms");
      });
    });
    root.querySelectorAll("[data-reveal]:not(.is-in)").forEach(function (el) {
      if (reduce || !io || el.hasAttribute("data-reveal-manual")) { if (!el.hasAttribute("data-reveal-manual") || reduce) el.classList.add("is-in"); return; }
      io.observe(el);
    });
    if (!reduce && finePointer) {
      root.querySelectorAll("[data-tilt]:not([data-tilt-bound])").forEach(bindTilt);
      root.querySelectorAll("[data-magnetic]:not([data-mag-bound])").forEach(bindMagnetic);
    }
  }

  /* ---------------- Inclinaison 3D ---------------- */
  function bindTilt(el) {
    el.setAttribute("data-tilt-bound", "");
    var max = parseFloat(el.getAttribute("data-tilt")) || 5;
    var raf;
    el.addEventListener("pointermove", function (e) {
      var r = el.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        el.style.transform = "perspective(900px) rotateX(" + (-y * max) + "deg) rotateY(" + (x * max) + "deg) translateY(-4px)";
      });
    });
    el.addEventListener("pointerleave", function () { cancelAnimationFrame(raf); el.style.transform = ""; });
  }

  /* ---------------- Boutons magnétiques ---------------- */
  function bindMagnetic(el) {
    el.setAttribute("data-mag-bound", "");
    var strength = parseFloat(el.getAttribute("data-magnetic")) || 0.25;
    el.addEventListener("pointermove", function (e) {
      var r = el.getBoundingClientRect();
      var x = e.clientX - r.left - r.width / 2;
      var y = e.clientY - r.top - r.height / 2;
      el.style.transform = "translate(" + x * strength + "px," + y * strength + "px)";
    });
    el.addEventListener("pointerleave", function () { el.style.transform = ""; });
  }

  /* ---------------- Défilement : en-tête, progression, parallaxe ---------------- */
  var header = document.getElementById("site-header");
  var progress = document.createElement("div");
  progress.className = "scroll-progress";
  progress.setAttribute("aria-hidden", "true");
  document.body.appendChild(progress);
  var parallax = [];
  function collectParallax() { parallax = Array.prototype.slice.call(document.querySelectorAll("[data-parallax]")); }
  var lastY = window.scrollY, ticking = false;
  function onScroll() {
    var y = window.scrollY;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = "scaleX(" + (max > 0 ? y / max : 0) + ")";
    if (header) {
      header.classList.toggle("is-scrolled", y > 30);
      var menuOpen = document.querySelector(".mobile-menu.is-open");
      header.classList.toggle("is-hidden", !menuOpen && y > 400 && y > lastY + 4);
      if (y < lastY - 4) header.classList.remove("is-hidden");
    }
    if (!reduce) {
      parallax.forEach(function (el) {
        var speed = parseFloat(el.getAttribute("data-parallax")) || 0.15;
        var r = el.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        var offset = (r.top + r.height / 2 - window.innerHeight / 2) * -speed;
        el.style.transform = "translate3d(0," + offset.toFixed(1) + "px,0)";
      });
    }
    lastY = y;
    ticking = false;
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });

  /* ---------------- Transitions de page ---------------- */
  var curtain = document.createElement("div");
  curtain.className = "page-transition";
  curtain.setAttribute("aria-hidden", "true");
  curtain.innerHTML = "<span></span><span></span><span></span><span></span>";
  document.body.appendChild(curtain);

  var cameFromInternal = false;
  try { cameFromInternal = sessionStorage.getItem("cap_nav") === "1"; sessionStorage.removeItem("cap_nav"); } catch (e) {}
  if (!reduce && cameFromInternal) {
    curtain.classList.add("is-enter");
    requestAnimationFrame(function () { requestAnimationFrame(function () { curtain.classList.add("is-reveal"); }); });
    setTimeout(function () { curtain.classList.remove("is-enter", "is-reveal"); }, 1000);
  }

  document.addEventListener("click", function (e) {
    if (reduce || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest("a[href]");
    if (!a || a.target === "_blank" || a.hasAttribute("download") || a.hasAttribute("data-no-transition")) return;
    var url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return;
    if (url.pathname === location.pathname && url.search === location.search) return; // ancre interne
    e.preventDefault();
    try { sessionStorage.setItem("cap_nav", "1"); } catch (err) {}
    curtain.classList.add("is-active");
    setTimeout(function () { location.href = url.href; }, 600);
  });
  // Retour arrière (bfcache) : retirer le rideau
  window.addEventListener("pageshow", function (e) { if (e.persisted) curtain.classList.remove("is-active", "is-enter", "is-reveal"); });

  window.CAPAnim = {
    refresh: function (root) { refresh(root); collectParallax(); onScroll(); },
    reduce: reduce
  };

  refresh(document);
  collectParallax();
  onScroll();
})();
