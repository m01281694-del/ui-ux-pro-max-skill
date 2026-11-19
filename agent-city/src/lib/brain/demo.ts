// DÉMO galaxy: synthetic notes so the graph shows its growth before the real pipeline writes notes.
// Every demo node has demo=true and is labeled « DÉMO » in the UI. Deterministic in time.
import { hash, mulberry32 } from "../sim/rng";

export interface GNode {
  id: string; type: string; cluster: string; created: number; confidence: number; source: string; author: string; demo: boolean; degree: number; path?: string;
  x?: number; y?: number; z?: number; fx?: number; fy?: number; fz?: number; __born?: number;
}
export interface GLink { source: string | GNode; target: string | GNode }

export const CLUSTERS = ["Tendances", "Hooks", "Concurrents", "Audience", "Vidéos", "Leçons", "Ventes", "Formats", "Système", "Incidents", "Plateformes"];
const WEIGHT: Record<string, number> = { Tendances: 1.4, Hooks: 1.2, Concurrents: 0.9, Audience: 1, Vidéos: 1.3, Leçons: 1, Ventes: 0.6, Formats: 0.5, Système: 0.15, Incidents: 0.25, Plateformes: 0.15 };
const TYPE: Record<string, string> = { Tendances: "tendance", Hooks: "hook", Concurrents: "concurrent", Audience: "persona", Vidéos: "vidéo", Leçons: "leçon", Ventes: "lead", Formats: "format", Système: "système", Incidents: "incident", Plateformes: "format" };
const AUTHORS: Record<string, string> = { Tendances: "Trend Scout", Hooks: "Post Writer", Concurrents: "Competitor Watch", Audience: "Audience Listener", Vidéos: "Post Analyst", Leçons: "Loop Feeder", Ventes: "Lead Catcher", Formats: "Video Editor", Système: "Mairie", Incidents: "Escalation", Plateformes: "Research" };

const EPOCH = Date.UTC(2026, 10, 5); // demo brain starts growing on Nov 5
const RATE = 1 / 330000; // ~ one note every 5.5 min on average (grows faster over time)

/** all demo notes born before `now` */
export function demoNotes(now: number, cap = 6000): { nodes: GNode[]; links: { source: string; target: string }[] } {
  const nodes: GNode[] = [];
  const links: { source: string; target: string }[] = [];
  const total = Math.min(cap, Math.floor(Math.max(0, now - EPOCH) * RATE * 1.0));
  const r = mulberry32(42);
  const wsum = Object.values(WEIGHT).reduce((a, b) => a + b, 0);
  const byCluster: Record<string, string[]> = {};
  for (let i = 0; i < total; i++) {
    // birth time: quadratic growth curve
    const f = Math.sqrt((i + 1) / Math.max(total, 1));
    const created = EPOCH + (now - EPOCH) * f;
    let x = r() * wsum, cluster = CLUSTERS[0];
    for (const c of CLUSTERS) { x -= WEIGHT[c]; if (x <= 0) { cluster = c; break; } }
    const id = `démo·${cluster.slice(0, 4)}·${i}`;
    const conf = Math.round((0.3 + r() * 0.7) * 100) / 100;
    nodes.push({ id, type: TYPE[cluster], cluster, created, confidence: conf, source: "DÉMO", author: AUTHORS[cluster], demo: true, degree: 1 });
    const list = (byCluster[cluster] ??= []);
    links.push({ source: id, target: list.length && r() < 0.55 ? list[Math.floor(r() * list.length)] : cluster });
    if (list.length > 3 && r() < 0.35) links.push({ source: id, target: list[Math.floor(r() * list.length)] });
    if (r() < 0.06) { const oc = CLUSTERS[Math.floor(r() * CLUSTERS.length)]; const ol = byCluster[oc]; if (ol?.length) links.push({ source: id, target: ol[Math.floor(r() * ol.length)] }); }
    list.push(id);
  }
  return { nodes, links };
}

export function demoNoteText(n: GNode): string {
  const h = hash(n.id);
  const T: Record<string, string[]> = {
    Tendances: ["Format « liste 3D » en hausse dans la niche", "Son tendance repéré sur 40 vidéos", "Hashtag montant : +210 % sur 7 jours"],
    Hooks: ["Hook question : rétention 3 s supérieure", "Hook « Arrête de… » : forte rétention", "Hook chiffre : bon taux de partage"],
    Concurrents: ["Post concurrent ×4 : hook visuel + 22 s", "Concurrent : série en 3 parties qui marche", "Concurrent : carrousel éducatif viral"],
    Audience: ["Persona : créateur débutant 18-24", "Pic d'activité 18h-21h", "Objection récurrente : « pas le temps »"],
    Vidéos: ["Vidéo : stats J+7", "Vidéo : rétention 61 % à 3 s", "Vidéo : 2,1 % de partages"],
    Leçons: ["Les vidéos < 30 s retiennent mieux", "Publier à 18h > 12h30 sur TikTok", "Le CTA en boucle augmente le rewatch"],
    Ventes: ["Lead anonymisé : score 78", "Appel réservé via lien", "Offre : taux de conversion"],
    Formats: ["Variante de la scène « portail »", "Template compte à rebours v2"],
    Système: ["Règle d'orchestration"], Incidents: ["Rendu échoué → relancé avec moins de particules", "Quota API atteint → report de 15 min"], Plateformes: ["Règle plateforme"],
  };
  const list = T[n.cluster] ?? ["Note"];
  return list[h % list.length];
}
