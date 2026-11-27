// Génère dist/ : pages assemblées (SEO + JSON-LD), assets, contenu, sitemap.xml, robots.txt.
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ROOT, PAGES, loadContent, renderPage } from "./lib/render.mjs";

const content = loadContent();
const { site, realVehicles } = content;
const out = path.join(ROOT, "dist");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

if (!site.demo) {
  const missing = [];
  if (!site.url) missing.push("url");
  if (!site.contact.phone && !site.contact.email) missing.push("contact.phone ou contact.email");
  if (!site.forms.endpoint) missing.push("forms.endpoint");
  if (!site.legal.mediator.name) missing.push("legal.mediator");
  if (missing.length) { console.error("Mise en ligne refusée, à compléter dans content/site.js : " + missing.join(", ")); process.exit(1); }
}

for (const f of readdirSync(ROOT).filter((f) => f.endsWith(".html"))) {
  writeFileSync(path.join(out, f), renderPage(f, readFileSync(path.join(ROOT, f), "utf8"), content));
}
cpSync(path.join(ROOT, "assets"), path.join(out, "assets"), { recursive: true });
mkdirSync(path.join(out, "content"));
for (const f of ["site.js", "vehicles.js"]) cpSync(path.join(ROOT, "content", f), path.join(out, "content", f));
// Les exemples ne sont publiés qu'en mode démonstration ; sinon un fichier vide les neutralise.
writeFileSync(path.join(out, "content/vehicles.example.js"), site.demo ? readFileSync(path.join(ROOT, "content/vehicles.example.js"), "utf8") : "window.VEHICLES_EXAMPLE=[];\n");

const indexable = !site.demo && site.url;
writeFileSync(path.join(out, "robots.txt"), indexable ? `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n` : "User-agent: *\nDisallow: /\n");
if (indexable) {
  const urls = Object.entries(PAGES).filter(([f]) => !["404.html", "vehicule.html"].includes(f)).map(([, m]) => site.url + (m.path === "/" ? "/" : m.path))
    .concat(realVehicles.filter((v) => v.status !== "vendu").map((v) => `${site.url}/vehicule?id=${encodeURIComponent(v.id)}`));
  writeFileSync(path.join(out, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u.replace(/&/g, "&amp;")}</loc></url>`).join("\n")}\n</urlset>\n`);
}
console.log(`dist/ généré — ${site.demo ? "MODE DÉMONSTRATION (non indexé)" : "production"} — ${realVehicles.length} véhicule(s) réel(s).`);
