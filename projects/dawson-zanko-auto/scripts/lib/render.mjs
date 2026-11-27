// Assemblage des pages : en-tête / pied communs, balises SEO, données structurées.
// Utilisé à l'identique par le serveur de dev et par le build (aucune dépendance).
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function loadContent() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  for (const f of ["content/site.js", "content/vehicles.js", "content/vehicles.example.js"]) {
    vm.runInContext(readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
  }
  const site = ctx.window.SITE;
  const real = ctx.window.VEHICLES || [];
  const vehicles = real.length || !site.demo ? real : (ctx.window.VEHICLES_EXAMPLE || []);
  return { site, vehicles, realVehicles: real };
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const PAGES = {
  "index.html":            { path: "/",                    title: (b) => `${b} — Voitures d'occasion à Marseille`, desc: "Achat et vente de voitures d'occasion à Marseille. Recherche intelligente, fiches détaillées, demande d'essai et de renseignements en ligne.", ld: true },
  "vehicules.html":        { path: "/vehicules",           title: (b) => `Véhicules d'occasion en stock à Marseille | ${b}`, desc: "Toutes nos voitures d'occasion à Marseille : filtres par marque, modèle, prix, kilométrage et motorisation, recherche en langage naturel." },
  "vehicule.html":         { path: "/vehicule",            title: (b) => `Fiche véhicule | ${b}`, desc: "Caractéristiques, équipements, photos, demande de renseignements et demande d'essai." },
  "entreprise.html":       { path: "/entreprise",          title: (b) => `L'entreprise | ${b}, Marseille 11e`, desc: "Commerce de voitures d'occasion à Marseille (11e) : achat et revente de véhicules automobiles." },
  "contact.html":          { path: "/contact",             title: (b) => `Contact | ${b} Marseille`, desc: "Contactez-nous pour un véhicule, un essai, la vente de votre voiture ou une recherche personnalisée à Marseille.", ld: true },
  "mentions-legales.html": { path: "/mentions-legales",    title: (b) => `Mentions légales | ${b}`, desc: "Mentions légales du site." },
  "confidentialite.html":  { path: "/confidentialite",     title: (b) => `Politique de confidentialité | ${b}`, desc: "Traitement des données personnelles collectées par les formulaires du site." },
  "404.html":              { path: "/404",                 title: (b) => `Page introuvable | ${b}`, desc: "Cette page n'existe pas." },
};

function dealerLd(site) {
  const c = site.contact, l = site.legal;
  const ld = {
    "@context": "https://schema.org", "@type": "AutoDealer",
    name: site.brand.name, description: PAGES["index.html"].desc,
    address: { "@type": "PostalAddress", streetAddress: (c.showroom_address || l.address).split(",")[0], postalCode: "13011", addressLocality: "Marseille", addressRegion: "Provence-Alpes-Côte d'Azur", addressCountry: "FR" },
    areaServed: { "@type": "City", name: "Marseille" },
    legalName: `${l.owner} (EI)`, taxID: l.siren.replace(/\s/g, ""),
  };
  if (site.url) { ld.url = site.url; ld.image = site.url + "/assets/img/og-cover.jpg"; }
  if (c.phone) ld.telephone = c.phone;
  if (c.email) ld.email = c.email;
  if (site.reviews.google_rating && site.reviews.google_count) {
    ld.aggregateRating = { "@type": "AggregateRating", ratingValue: site.reviews.google_rating.replace(",", "."), reviewCount: String(site.reviews.google_count).replace(/\D/g, "") };
  }
  return ld;
}

export function renderPage(file, html, { site }) {
  const meta = PAGES[file] || PAGES["404.html"];
  const brand = site.brand.name;
  const title = meta.title(brand), desc = meta.desc;
  const canonical = site.url ? site.url + meta.path.replace(/^\/$/, "/") : "";
  const indexable = !site.demo && site.url && file !== "404.html";
  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    `<meta name="robots" content="${indexable ? "index, follow" : "noindex, nofollow"}">`,
    canonical && `<link rel="canonical" href="${esc(canonical)}">`,
    `<meta property="og:type" content="website"><meta property="og:locale" content="fr_FR">`,
    `<meta property="og:site_name" content="${esc(brand)}">`,
    `<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">`,
    site.url && `<meta property="og:image" content="${esc(site.url)}/assets/img/og-cover.jpg">`,
    canonical && `<meta property="og:url" content="${esc(canonical)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="geo.region" content="FR-13"><meta name="geo.placename" content="Marseille">`,
    meta.ld && `<script type="application/ld+json">${JSON.stringify(dealerLd(site)).replace(/</g, "\\u003c")}</script>`,
  ].filter(Boolean).join("\n");

  const partial = (n) => readFileSync(path.join(ROOT, "partials", n), "utf8");
  return html
    .replace("<!--@head-->", head)
    .replace("<!--@header-->", partial("header.html"))
    .replace("<!--@footer-->", partial("footer.html"))
    .replace(/\{\{BRAND\}\}/g, esc(brand))
    .replace(/\{\{BRAND_SHORT\}\}/g, esc(site.brand.short))
    .replace(/\{\{YEAR\}\}/g, String(new Date().getFullYear()));
}
