/* Exécuté dans <head> : évite tout flash avant l'intro et les animations. */
(function () {
  var d = document.documentElement, seen = false, reduce = false;
  d.classList.add("js");
  try { seen = sessionStorage.getItem("dz_intro") === "1"; } catch (e) {}
  try { reduce = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  if (/[?&]intro=1\b/.test(location.search)) seen = false;
  if (!seen && !reduce && d.hasAttribute("data-home")) d.classList.add("intro-on");
})();
