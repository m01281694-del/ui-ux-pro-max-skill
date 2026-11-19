// npm run check — liste ce qu'il reste à compléter avant publication.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { loadContent, checks, ROOT } from "./lib/load-content.mjs";

export function runChecks() {
  const { content, vehicles } = loadContent();
  const c = checks.checkContent(content);
  const v = checks.checkVehicles(vehicles);
  const errors = [...c.errors, ...v.errors];
  const warnings = [...c.warnings, ...v.warnings];

  // Fichiers référencés (images, vidéos) : existent-ils ?
  const refs = [];
  const add = (p, label) => { if (p && !/^https?:/i.test(p)) refs.push([p, label]); };
  add(content.site?.logo, "site.logo");
  add(content.site?.favicon, "site.favicon");
  add(content.seo?.og_image, "seo.og_image");
  add(content.intro?.video_mp4, "intro.video_mp4");
  add(content.intro?.video_webm, "intro.video_webm");
  add(content.intro?.poster, "intro.poster");
  const h = content.home?.hero || {};
  add(h.background_video_mp4, "home.hero.background_video_mp4");
  add(h.background_video_webm, "home.hero.background_video_webm");
  add(h.background_image, "home.hero.background_image");
  add(content.home?.about?.image, "home.about.image");
  add(content.about_page?.image, "about_page.image");
  (content.about_page?.sections || []).forEach((s, i) => add(s.image, `about_page.sections[${i}].image`));
  (content.about_page?.gallery || []).forEach((g, i) => add(g.src, `about_page.gallery[${i}]`));
  vehicles.forEach((veh, i) => {
    (veh.photos || []).forEach((p, j) => add(typeof p === "string" ? p : p?.src, `véhicule ${veh.id || i + 1} photo ${j + 1}`));
    add(veh.video, `véhicule ${veh.id || i + 1} vidéo`);
  });
  for (const [p, label] of refs) {
    if (!existsSync(path.join(ROOT, p.split(/[?#]/)[0]))) errors.push(`Fichier introuvable : ${p} (${label})`);
  }

  // Pages juridiques : textes encore à rédiger
  for (const f of ["mentions-legales.html", "confidentialite.html", "cookies.html"]) {
    const html = readFileSync(path.join(ROOT, f), "utf8");
    const n = (html.match(/class="todo"/g) || []).length;
    if (n) errors.push(`${f} : ${n} paragraphe(s) « À RÉDIGER / À COMPLÉTER » à remplacer par un texte validé`);
  }

  return { content, vehicles, errors, warnings };
}

const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("check.mjs");
if (isMain) {
  let r;
  try { r = runChecks(); } catch (e) { console.error("\n✖ " + e.message + "\n"); process.exit(1); }
  const ready = r.content.publication?.ready === true;
  console.log(`\nCAP AUTO SEPTÈMES — contrôle du contenu (${ready ? "PUBLICATION" : "prévisualisation"})\n`);
  console.log(`Véhicules : ${r.vehicles.length}`);
  if (r.errors.length) {
    console.log(`\n✖ À compléter avant publication (${r.errors.length}) :`);
    r.errors.forEach((e) => console.log("  - " + e));
  }
  if (r.warnings.length) {
    console.log(`\n! Recommandations (${r.warnings.length}) :`);
    r.warnings.forEach((w) => console.log("  - " + w));
  }
  if (!r.errors.length) console.log("\n✔ Aucun élément bloquant.");
  console.log(ready
    ? (r.errors.length ? "\n→ publication.ready = true mais des éléments manquent : la compilation sera refusée.\n" : "\n→ Prêt pour la publication.\n")
    : "\n→ Mode prévisualisation : site non indexé, repères « À PERSONNALISER » visibles.\n");
  process.exit(ready && r.errors.length ? 1 : 0);
}
