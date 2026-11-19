import { NextResponse } from "next/server";
import { usageSnapshot } from "@/lib/ai/budget";
import { getControl } from "@/lib/control";
import { readBrain } from "@/lib/brain/graph";
import { workBetween, DEMO_MODE } from "@/lib/work/store";
import { DEPARTMENTS } from "@/lib/sim/data";

export const dynamic = "force-dynamic";

export function GET() {
  const now = Date.now();
  const t0 = performance.now();
  const { tasks } = workBetween(now - 3600000, now + 3600000);
  const workMs = performance.now() - t0;
  const brain = readBrain();
  return NextResponse.json({
    now,
    demoMode: DEMO_MODE,
    control: getControl(),
    ai: usageSnapshot(),
    hasClaudeKey: !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
    passwordProtected: !!process.env.SITE_PASSWORD,
    workers: [
      { name: "Simulation (couche vie)", status: "ok", detail: "déterministe, calculée dans le navigateur" },
      { name: "File de tâches", status: "ok", detail: `${tasks.length} tâches sur ±1 h · lecture ${workMs.toFixed(0)} ms` },
      { name: "Orchestrateur (Mairie)", status: DEMO_MODE ? "demo" : "ok", detail: "Phase 2 : cron + pg-boss" },
      { name: "Rendu vidéo (Remotion)", status: "pending", detail: "Phase 2" },
      { name: "Publication (Metricool)", status: "pending", detail: "Phase 3" },
      { name: "Cerveau", status: "ok", detail: `${brain.nodes.length} notes réelles · ${brain.links.length} liens` },
    ],
    queues: DEPARTMENTS.map((d) => ({ dept: d.name, color: d.color, active: tasks.filter((t) => t.dept === d.id && t.start <= now && now < t.end).length, pending: tasks.filter((t) => t.dept === d.id && t.start > now).length })),
    connectors: [
      { name: "ElevenLabs", status: "connecté (proxy)", phase: 2 },
      { name: "Metricool", status: "disponible dans la session Claude", phase: 3 },
      { name: "Windsor.ai", status: "disponible dans la session Claude", phase: 4 },
      { name: "TikTok for Business", status: "disponible dans la session Claude", phase: 3 },
      { name: "Canva", status: "disponible dans la session Claude", phase: 2 },
      { name: "Vercel", status: "connecté (proxy)", phase: 1 },
      { name: "Firecrawl", status: "disponible dans la session Claude", phase: 2 },
      { name: "Claude API", status: process.env.ANTHROPIC_API_KEY ? "clé présente" : "clé à ajouter", phase: 2 },
    ],
    errors: [],
  });
}
