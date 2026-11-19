// Reads the Obsidian-compatible brain/ folder into a graph (nodes + wikilinks).
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export interface BrainNode {
  id: string; // basename
  path: string;
  type: string;
  cluster: string;
  created: number;
  confidence: number;
  source: string;
  author: string;
  demo: boolean;
  degree: number;
}
export interface BrainGraph { nodes: BrainNode[]; links: { source: string; target: string }[] }

export const CLUSTER_OF: Record<string, string> = {
  tendance: "Tendances", hook: "Hooks", concurrent: "Concurrents", persona: "Audience", sujet: "Audience", "vidéo": "Vidéos",
  "leçon": "Leçons", rapport: "Leçons", offre: "Ventes", lead: "Ventes", format: "Formats", "département": "Système",
  "métier": "Système", "système": "Système", playbook: "Système", incident: "Incidents", "expérience": "Leçons",
};

export const BRAIN_DIR = path.join(process.cwd(), "brain");
const WIKI = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.name.startsWith(".") ? [] : e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith(".md") ? [path.join(dir, e.name)] : []));
}

export function readBrain(): BrainGraph {
  const files = walk(BRAIN_DIR);
  const nodes: BrainNode[] = [];
  const raw: { id: string; links: string[] }[] = [];
  for (const f of files) {
    const { data, content } = matter(fs.readFileSync(f, "utf8"));
    const id = path.basename(f, ".md");
    const rel = path.relative(BRAIN_DIR, f);
    const type = String(data.type ?? "note");
    const cluster = type === "hub" ? id : rel.startsWith("Plateformes") ? "Plateformes" : CLUSTER_OF[type] ?? "Système";
    nodes.push({
      id, path: rel, type, cluster, created: Date.parse(String(data.date ?? "")) || fs.statSync(f).mtimeMs,
      confidence: Number(data.confiance ?? 0.5), source: String(data.source ?? ""), author: String(data.auteur ?? ""), demo: !!data.demo, degree: 0,
    });
    raw.push({ id, links: [...content.matchAll(WIKI)].map((m) => m[1].trim().split("/").pop()!) });
  }
  const ids = new Set(nodes.map((n) => n.id));
  const links: BrainGraph["links"] = [];
  const seen = new Set<string>();
  for (const r of raw) for (const t of r.links) {
    if (!ids.has(t) || t === r.id) continue;
    const k = [r.id, t].sort().join("→");
    if (seen.has(k)) continue;
    seen.add(k);
    links.push({ source: r.id, target: t });
  }
  const deg = new Map<string, number>();
  for (const l of links) { deg.set(l.source, (deg.get(l.source) ?? 0) + 1); deg.set(l.target, (deg.get(l.target) ?? 0) + 1); }
  for (const n of nodes) n.degree = deg.get(n.id) ?? 0;
  return { nodes, links };
}

export function readNote(id: string) {
  const f = walk(BRAIN_DIR).find((p) => path.basename(p, ".md") === id);
  if (!f) return null;
  const { data, content } = matter(fs.readFileSync(f, "utf8"));
  const g = readBrain();
  const backlinks = g.links.filter((l) => l.target === id).map((l) => l.source).concat(g.links.filter((l) => l.source === id).map((l) => l.target));
  return { id, frontmatter: data, content, links: [...new Set(backlinks)] };
}
