// npm run dev → http://localhost:3000 (pages assemblées à la volée) · npm run preview → sert dist/
import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { ROOT, loadContent, renderPage } from "./lib/render.mjs";

const dir = path.resolve(ROOT, process.argv[2] || ".");
const port = Number(process.argv[3] || process.env.PORT || 3000);
const live = dir === ROOT;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml", ".mp4": "video/mp4" };
const BLOCK = /^\/(scripts|partials|tests|api|node_modules|package\.json|README)/;

createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (live && BLOCK.test(p)) { res.writeHead(404); return res.end(); }
  if (p.endsWith("/")) p += "index.html";
  let file = path.join(dir, p);
  if (!file.startsWith(dir)) { res.writeHead(403); return res.end(); }
  if (!existsSync(file) && existsSync(file + ".html")) file += ".html";
  let status = 200;
  if (!existsSync(file) || statSync(file).isDirectory()) { file = path.join(dir, "404.html"); status = 404; }
  const ext = path.extname(file).toLowerCase();
  const type = TYPES[ext] || "application/octet-stream";
  if (live && ext === ".html") {
    const html = renderPage(path.basename(file), readFileSync(file, "utf8"), loadContent());
    res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-cache" });
    return res.end(html);
  }
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-cache" });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Site : http://localhost:${port}  (${live ? "sources" : path.relative(ROOT, dir)})`));
