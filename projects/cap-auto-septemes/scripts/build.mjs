// npm run build — prépare le dossier dist/ pour Vercel.
//  - copie le site (sans l'outil /admin/, les scripts ni la fonction api/) ;
//  - inscrit en dur les balises SEO de chaque page (titre, description,
//    canonical, Open Graph, robots) depuis content/site.js ;
//  - génère robots.txt et sitemap.xml ;
//  - REFUSE de compiler si publication.ready = true alors que des
//    informations obligatoires manquent (aucune publication incomplète).
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/load-content.mjs";
import { runChecks } from "./check.mjs";

const DIST = path.join(ROOT, "dist");
const { content: C, vehicles, errors, warnings } = runChecks();
const ready = C.publication?.ready === true;

if (ready && errors.length) {
  console.error("\n✖ Compilation refusée : publication.ready = true mais il manque :\n" + errors.map((e) => "  - " + e).join("\n"));
  console.error("\n→ Complétez content/site.js (voir `npm run check`) ou repassez publication.ready à false.\n");
  process.exit(1);
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
const SKIP = new Set(["dist", "node_modules", "admin", "scripts", "api", ".vercel", "package.json", "package-lock.json", "vercel.json", "README.md", ".gitignore", ".vercelignore"]);
for (const entry of readdirSync(ROOT)) {
  if (SKIP.has(entry) || entry.startsWith(".")) continue;
  cpSync(path.join(ROOT, entry), path.join(DIST, entry), { recursive: true, filter: (src) => !src.endsWith("README.md") });
}

// ---------- Balises SEO statiques ----------
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const base = (C.site?.url || "").replace(/\/+$/, "");
const abs = (p) => (!base || !p ? "" : /^https?:/i.test(p) ? p : `${base}/${String(p).replace(/^\.?\//, "")}`);
const name = C.site?.name || "";
const sep = C.seo?.title_separator || " | ";
const PAGES = {
  "index.html": "home", "vehicules.html": "vehicles", "vehicule.html": "vehicles", "a-propos.html": "about",
  "contact.html": "contact", "mentions-legales.html": "legal", "confidentialite.html": "privacy", "cookies.html": "cookies", "404.html": "notfound",
};
const cleanPath = (f) => (f === "index.html" ? "" : f.replace(/\.html$/, ""));

for (const [file, key] of Object.entries(PAGES)) {
  const p = path.join(DIST, file);
  let html = readFileSync(p, "utf8");
  const s = C.seo?.pages?.[key] || {};
  const title = s.title && name && s.title !== name ? s.title + sep + name : s.title || name;
  const desc = s.description || C.seo?.default_description || "";
  const noindex = !ready || file === "404.html";
  const canonical = file === "vehicule.html" || file === "404.html" ? "" : abs(cleanPath(file));
  const og = C.seo?.og_image ? abs(C.seo.og_image) : "";
  const tags = [
    `<title>${esc(title)}</title>`,
    desc && `<meta name="description" content="${esc(desc)}">`,
    `<meta name="robots" content="${noindex ? "noindex, nofollow" : "index, follow"}">`,
    canonical && `<link rel="canonical" href="${esc(canonical)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:locale" content="fr_FR">`,
    name && `<meta property="og:site_name" content="${esc(name)}">`,
    title && `<meta property="og:title" content="${esc(title)}">`,
    desc && `<meta property="og:description" content="${esc(desc)}">`,
    canonical && `<meta property="og:url" content="${esc(canonical)}">`,
    og && `<meta property="og:image" content="${esc(og)}">`,
    `<meta name="twitter:card" content="${og ? "summary_large_image" : "summary"}">`,
    C.seo?.google_site_verification && `<meta name="google-site-verification" content="${esc(C.seo.google_site_verification)}">`,
    C.site?.favicon && `<link rel="icon" href="${esc(C.site.favicon)}">`,
  ].filter(Boolean).join("\n");
  html = html.replace(/<!-- SEO:START[\s\S]*?<!-- SEO:END -->/, `<!-- SEO:START -->\n${tags}\n<!-- SEO:END -->`);
  writeFileSync(p, html);
}

// ---------- robots.txt & sitemap.xml ----------
if (ready && base) {
  writeFileSync(path.join(DIST, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${base}/sitemap.xml\n`);
  const today = new Date().toISOString().slice(0, 10);
  const urls = ["", "vehicules", "a-propos", "contact", "mentions-legales", "confidentialite", "cookies"].map((p) => ({ loc: `${base}/${p}`, lastmod: today }));
  for (const v of vehicles) {
    if (v && v.id && v.status !== "vendu") urls.push({ loc: `${base}/vehicule?id=${encodeURIComponent(v.id)}`, lastmod: v.date_added || today });
  }
  writeFileSync(path.join(DIST, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${esc(u.lastmod)}</lastmod></url>`).join("\n") + "\n</urlset>\n");
} else {
  // Prévisualisation : aucune indexation
  writeFileSync(path.join(DIST, "robots.txt"), "User-agent: *\nDisallow: /\n");
}

console.log(`\n✔ dist/ généré — mode ${ready ? "PUBLICATION" : "PRÉVISUALISATION (non indexé)"} — ${vehicles.length} véhicule(s)`);
if (!ready && errors.length) console.log(`  ${errors.length} élément(s) à compléter avant publication (npm run check).`);
if (warnings.length) console.log(`  ${warnings.length} recommandation(s) (npm run check).`);
console.log("");
