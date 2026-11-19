// npm run dev      → sert le dossier du projet (modifications visibles en rechargeant la page)
// npm run preview  → sert dist/ (après npm run build)
// Serveur statique minimal, sans dépendance. Usage : node scripts/serve.mjs [dossier] [port]
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/load-content.mjs";

const dir = path.resolve(ROOT, process.argv[2] || ".");
const port = Number(process.argv[3] || process.env.PORT || 3000);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".gif": "image/gif",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".mp4": "video/mp4", ".webm": "video/webm", ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  let file = path.join(dir, p);
  if (!file.startsWith(dir)) { res.writeHead(403); return res.end(); }
  if (!existsSync(file) && existsSync(file + ".html")) file += ".html"; // URL propres comme sur Vercel
  if (!existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404, { "Content-Type": TYPES[".html"] });
    return createReadStream(path.join(dir, "404.html")).pipe(res);
  }
  const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
  const size = statSync(file).size;
  const range = req.headers.range;
  if (range && /^bytes=/.test(range)) { // nécessaire pour la lecture vidéo (Safari)
    const [s, e] = range.replace("bytes=", "").split("-");
    const start = Number(s), end = e ? Number(e) : size - 1;
    res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${size}`, "Accept-Ranges": "bytes", "Content-Length": end - start + 1 });
    return createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { "Content-Type": type, "Content-Length": size, "Cache-Control": "no-cache" });
  createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`\nSite servi sur http://localhost:${port}  (dossier : ${path.relative(ROOT, dir) || "."})`);
  if (dir === ROOT) console.log(`Outil de gestion des véhicules : http://localhost:${port}/admin/\n`);
});
