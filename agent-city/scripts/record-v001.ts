// Records the REAL work done for video v001 into data/work.json (tasks assigned to residents of the right jobs).
import fs from "node:fs";
import { getWorld } from "../src/lib/sim/world";
import { JOB_TO_DEPT } from "../src/lib/sim/data";
import type { Content, Task } from "../src/lib/work/types";

const w = getWorld();
const at = (hhmm: string) => Date.parse(`2026-11-19T${hhmm}:00Z`);
const who = (job: string) => w.teams[job][1]; // night-shift member: the work happened in the evening
const tasks: Task[] = [];
const T = (job: string, s: string, e: string, title: string, output?: Task["output"], stage?: Task["stage"]) =>
  tasks.push({ id: `r-v001-${tasks.length}`, demo: false, dept: JOB_TO_DEPT[job] as Task["dept"], job, title, start: at(s), end: at(e), residentId: who(job), contentId: "v001", stage, output });

T("Audience Listener", "18:31", "18:32", "identifie les comptes : Instagram @manu.digi0, TikTok @manu_digi0, YouTube (via Metricool + Windsor.ai)");
T("Trend Scout", "18:32", "18:33", "choisit l'angle « rétention : la première seconde décide de tout » (marketing digital)", { kind: "tendance", label: "Angle rétention" });
T("Voiceover", "18:33", "18:34", "teste 4 voix ElevenLabs sur le même hook (Eric, Will, Sarah, Laura — eleven_v4)", { kind: "audio", label: "4 essais de voix", url: "/media/voix/eric.mp3" });
T("Post Writer", "18:34", "18:35", "écrit le script #001 — 10 hooks notés, garde « Ta vidéo est morte en une seconde » (92/100)", { kind: "script", label: "Script #001" }, "script");
T("Voiceover", "18:35", "18:36", "génère la voix de la vidéo #001 avec timestamps mot à mot (31,1 s, 96 mots)", { kind: "audio", label: "Voix #001" }, "voix");
T("Visual Designer", "18:36", "18:37", "génère les SFX (whoosh, impact, riser) et compose la musique libre de droits", { kind: "audio", label: "SFX + musique" }, "visuels");
T("Video Editor", "18:38", "18:44", "monte et rend la vidéo #001 en 3D (Remotion + Three.js, 1080×1920, 30 fps, sous-titres karaoké)", { kind: "video", label: "Vidéo #001 (32 s)", url: "/media/videos/v001.mp4" }, "montage");
T("Brand Check", "18:45", "18:46", "contrôle qualité de la vidéo #001 — score 100/100 (−14,9 LUFS, 0 écran noir, 0 frame figée)", { kind: "qa", label: "QA 100/100" }, "brand_check");
T("Loop Feeder", "18:46", "18:47", "écrit 6 notes dans le Cerveau (vidéo, hooks, 3 incidents API, persona)", { kind: "note", label: "6 notes" });

const content: Content = {
  id: "v001", demo: false, kind: "video", number: 1, title: "Ta vidéo est morte en 1 seconde", hook: "Ta vidéo est morte en une seconde.",
  trend: "rétention / hook", created: at("18:34"), publishAt: Date.parse("2099-01-01T00:00:00Z"),
  stages: [{ stage: "idée", at: at("18:33") }, { stage: "script", at: at("18:35") }, { stage: "voix", at: at("18:36") }, { stage: "visuels", at: at("18:37") }, { stage: "montage", at: at("18:44") }, { stage: "brand_check", at: at("18:46") }],
  brandScore: 100, media: { video: "/media/videos/v001.mp4", cover: "/media/videos/v001-cover.jpg", brainNote: "Vidéo 001 — Morte en 1 seconde" },
  caption: "En attente de ta validation (Approval Desk) — non publiée.",
};
fs.writeFileSync("data/work.json", JSON.stringify({ tasks, contents: [content] }, null, 1));
console.log(tasks.length, "real tasks recorded");
