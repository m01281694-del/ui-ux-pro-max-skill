// DEMO work generator (Phase 1). Every item here is flagged `demo: true` and shown with a « DÉMO » badge.
// Real tasks (Phase 2+) come from the task store and replace these progressively.
import { JOB_TO_DEPT, type DeptId } from "../sim/data";
import { tsOf } from "../sim/clock";
import { scheduleFor } from "../sim/life";
import { hash, mulberry32, pick, u } from "../sim/rng";
import { getWorld } from "../sim/world";
import type { Content, ContentStatus, Task } from "./types";

const TOPICS = [
  "3 erreurs qui tuent ta rétention", "Le hook en 1 seconde qui change tout", "Pourquoi tes vidéos plafonnent à 300 vues",
  "La méthode des 3 temps forts", "Ce que l'algo regarde vraiment", "Avant / après : même vidéo, autre hook",
  "J'ai testé 30 jours de posts quotidiens", "Le format liste qui explose en ce moment", "1 idée = 5 contenus",
  "Le compte à rebours qui garde les gens", "Comment trouver 50 idées en 10 minutes", "La boucle parfaite pour le rewatch",
];
const TRENDS = ["format liste 3D", "avant/après", "compte à rebours", "POV caméra", "question choc", "mythe vs réalité", "tutoriel express"];
const HOOKS = ["Arrête de faire ça.", "Personne ne te dit ça…", "J'ai perdu 6 mois avant de comprendre ça.", "Regarde jusqu'à la fin.", "Ça a doublé mes vues.", "Tu fais probablement cette erreur."];

const dowOf = (day: number) => new Date(day * 86400000).getUTCDay();

function assign(job: string, ts: number, day: number, minute: number, salt: string): number {
  const w = getWorld();
  const team = w.teams[job];
  const dow = dowOf(day);
  const atWork = team.filter((id) => {
    const res = w.residents[id];
    const s = scheduleFor(res, day, dow);
    let e = s[0];
    for (const x of s) if (x.start <= minute) e = x;
    return e.place === res.workplace && e.activity.startsWith("travaille");
  });
  const pool = atWork.length ? atWork : team.filter((id) => w.residents[id].nightShift);
  return pool[hash(salt, ts) % pool.length];
}

interface DayWork { tasks: Task[]; contents: Content[] }
const cache = new Map<number, DayWork>();

export function demoDay(day: number): DayWork {
  const c = cache.get(day);
  if (c) return c;
  if (cache.size > 10) cache.clear();
  const tasks: Task[] = [];
  const contents: Content[] = [];
  const r = mulberry32(hash("demo", day));
  const dow = dowOf(day);

  const mkTask = (job: string, minute: number, dur: number, title: string, extra: Partial<Task> = {}) => {
    const start = tsOf(day, minute);
    const id = `d${day}-${tasks.length}`;
    const dept = JOB_TO_DEPT[job] as DeptId;
    const t: Task = { id, demo: true, dept, job, title, start, end: start + dur * 60000, residentId: assign(job, start, day, minute, id), ...extra };
    tasks.push(t);
    return t;
  };

  // --- Videos: 3 per day
  const slots = [[360, 750], [600, 1110], [840, 1230]]; // production start, publish minute
  slots.forEach(([m0, pub], k) => {
    const number = 100 + (day - 20760) * 3 + k;
    const id = `v${number}`;
    const title = TOPICS[hash(id) % TOPICS.length];
    const trend = TRENDS[hash(id, "t") % TRENDS.length];
    const hook = HOOKS[hash(id, "h") % HOOKS.length];
    const stages: { stage: ContentStatus; at: number }[] = [];
    let m = m0;
    const step = (job: string, dur: number, stage: ContentStatus, t: string, out?: Task["output"], platform?: Task["platform"]) => {
      mkTask(job, m, dur, t, { contentId: id, stage, output: out, platform });
      m += dur + 2;
      stages.push({ stage, at: tsOf(day, m) });
    };
    stages.push({ stage: "idée", at: tsOf(day, m0) });
    mkTask("Trend Scout", m0 - 25, 20, `détecte la tendance « ${trend} » (score ${70 + (hash(id, "s") % 29)})`, { contentId: id, output: { kind: "tendance", label: trend } });
    step("Post Writer", 14, "script", `écrit le script de la vidéo #${number} — 10 hooks notés, garde « ${hook} »`, { kind: "script", label: `Script #${number}` });
    step("Voiceover", 6, "voix", `génère la voix ElevenLabs de la vidéo #${number}`, { kind: "audio", label: `Voix #${number} (42 s)` });
    step("Visual Designer", 16, "visuels", `crée les visuels 3D et la miniature de la vidéo #${number}`, { kind: "image", label: `Miniature #${number}` });
    step("Video Editor", 26, "montage", `monte et rend la vidéo #${number} (1080×1920, 30 fps)`, { kind: "video", label: `Vidéo #${number} (${38 + (number % 20)} s)` });
    const score = 72 + (hash(id, "bc") % 27);
    step("Brand Check", 5, "brand_check", `contrôle qualité de la vidéo #${number} — score ${score}/100`, { kind: "qa", label: `QA ${score}/100` });
    if (score < 80) {
      step("Video Editor", 12, "montage", `corrige la vidéo #${number} (retour Brand Check : sous-titres trop bas)`, { kind: "video", label: `Vidéo #${number} v2` });
      step("Brand Check", 5, "brand_check", `re-contrôle la vidéo #${number} — score 88/100`, { kind: "qa", label: "QA 88/100" });
    }
    step("Approval Desk", 8, "approbation", `valide la vidéo #${number} (mode semi-auto)`);
    step("Scheduler", 2, "programmé", `programme la vidéo #${number} à ${String(Math.floor(pub / 60)).padStart(2, "0")}:${String(pub % 60).padStart(2, "0")} (meilleur créneau)`);
    m = Math.max(m, pub);
    mkTask("TikTok Poster", pub, 1, `publie la vidéo #${number} sur TikTok`, { contentId: id, stage: "publié", platform: "tiktok" });
    mkTask("Reels Poster", pub, 1, `publie la vidéo #${number} en Reel Instagram`, { contentId: id, stage: "publié", platform: "instagram" });
    mkTask("Shorts Poster", pub + 1, 1, `publie la vidéo #${number} en YouTube Short`, { contentId: id, stage: "publié", platform: "youtube" });
    stages.push({ stage: "publié", at: tsOf(day, pub + 1) });
    if (pub + 60 < 1435) {
      mkTask("Post Analyst", pub + 60, 3, `récupère les stats H+1 de la vidéo #${number}`, { contentId: id, stage: "analysé" });
      stages.push({ stage: "analysé", at: tsOf(day, pub + 63) });
    }
    if (pub + 150 < 1435) {
      mkTask("Loop Feeder", pub + 150, 6, `écrit la leçon de la vidéo #${number} dans le Cerveau`, { contentId: id, stage: "leçon", output: { kind: "note", label: `Leçon #${number}` } });
      stages.push({ stage: "leçon", at: tsOf(day, pub + 156) });
    }
    const views = Math.round(800 + u(id, "v") * 24000);
    contents.push({
      id, demo: true, kind: "video", number, title, hook, trend, created: tsOf(day, m0), publishAt: tsOf(day, pub), stages,
      brandScore: score < 80 ? 88 : score,
      stats: { views, likes: Math.round(views * (0.04 + u(id, "l") * 0.06)), shares: Math.round(views * 0.006), saves: Math.round(views * 0.01), retention: Math.round(35 + u(id, "r") * 40) },
    });
  });

  // --- Carousels Mon/Wed/Fri
  if ([1, 3, 5].includes(dow)) {
    const number = 500 + (day - 20760);
    const id = `c${number}`;
    mkTask("Post Writer", 540, 10, `écrit le texte du carrousel #${number} (9 slides)`, { contentId: id });
    mkTask("Carousel Builder", 552, 18, `compose le carrousel #${number} (1080×1350)`, { contentId: id, output: { kind: "carousel", label: `Carrousel #${number}` } });
    mkTask("Brand Check", 572, 4, `vérifie la charte du carrousel #${number}`, { contentId: id });
    mkTask("Reels Poster", 1020, 1, `publie le carrousel #${number} sur Instagram`, { contentId: id, platform: "instagram" });
    contents.push({ id, demo: true, kind: "carousel", number, title: TOPICS[hash(id) % TOPICS.length], hook: "Swipe →", trend: "carrousel éducatif", created: tsOf(day, 540), publishAt: tsOf(day, 1020), stages: [{ stage: "idée", at: tsOf(day, 540) }, { stage: "visuels", at: tsOf(day, 570) }, { stage: "publié", at: tsOf(day, 1021) }] });
  }
  // --- Newsletter Thursday
  if (dow === 4) {
    const id = `n${day}`;
    mkTask("Email Writer", 600, 25, "écrit la newsletter de la semaine", { contentId: id, output: { kind: "email", label: "Newsletter" } });
    mkTask("Newsletter", 1080, 2, "envoie la newsletter", { contentId: id, platform: "email" });
    contents.push({ id, demo: true, kind: "newsletter", number: day - 20760, title: "Newsletter hebdo", hook: "Objet : ce qui a marché cette semaine", trend: "—", created: tsOf(day, 600), publishAt: tsOf(day, 1080), stages: [{ stage: "script", at: tsOf(day, 627) }, { stage: "publié", at: tsOf(day, 1082) }] });
  }

  // --- Recurring tasks
  const every = (job: string, stepMin: number, from: number, to: number, dur: number, text: (i: number) => string, extra: (i: number) => Partial<Task> = () => ({})) => {
    for (let m = from, i = 0; m < to; m += stepMin, i++) mkTask(job, m + Math.floor(r() * Math.min(10, stepMin / 3)), dur, text(i), extra(i));
  };
  every("Trend Scout", 60, 0, 1440, 6, (i) => `veille horaire : ${2 + (i % 5)} signaux tendances analysés`);
  every("Competitor Watch", 180, 60, 1440, 12, (i) => `analyse un post concurrent qui sur-performe (×${(2 + (i % 4) * 0.7).toFixed(1)})`);
  every("Comment Miner", 120, 30, 1440, 10, (i) => `extrait ${8 + (i % 9)} questions/objections des commentaires`);
  every("Audience Listener", 360, 200, 1440, 15, () => "met à jour le persona d'audience (heures actives, centres d'intérêt)");
  every("Comment Replier", 9, 420, 1410, 2, (i) => `répond à un commentaire ${["TikTok", "Instagram", "YouTube"][i % 3]}`, (i) => ({ platform: (["tiktok", "instagram", "youtube"] as const)[i % 3] }));
  every("DM Agent", 25, 480, 1380, 4, () => "répond à un DM et qualifie le prospect", () => ({ platform: "instagram" }));
  every("Lead Catcher", 55, 500, 1380, 3, () => "détecte une intention d'achat → crée un lead");
  every("Lead Scorer", 55, 506, 1380, 2, (i) => `note un lead : ${40 + ((i * 17) % 60)}/100`);
  every("Follow-up", 120, 560, 1200, 3, () => "envoie une relance polie (1/2)");
  every("Reminder", 240, 540, 1200, 2, () => "rappel de rendez-vous envoyé");
  every("Call Booker", 150, 600, 1200, 3, () => "envoie le lien de prise de RDV");
  every("CRM Sync", 60, 0, 1440, 1, () => "synchronise le mini-CRM");
  every("FAQ Builder", 480, 650, 1440, 12, () => "transforme 3 questions récurrentes en FAQ + idée de vidéo");
  every("Escalation", 600, 700, 1400, 3, () => "signale un commentaire sensible → mis en pause, notification envoyée");
  every("Review Asker", 720, 640, 1400, 3, () => "demande un témoignage à un client satisfait");
  every("Revenue Tracker", 240, 0, 1440, 2, () => "met à jour les revenus du jour");
  every("Call Tracker", 360, 100, 1440, 2, () => "calcule le taux de conversion des appels");
  every("Email Analyst", 720, 400, 1440, 4, () => "analyse ouvertures et clics des emails");
  every("Payment Link", 480, 610, 1300, 2, () => "génère un lien de paiement pour une offre");
  every("X Poster", 240, 520, 1400, 1, () => "publie un thread sur X", () => ({ platform: "x" }));
  every("Audience Listener", 1440, 1000, 1440, 8, () => "compare l'audience TikTok vs Reels");
  if (dow === 1) mkTask("Weekly Report", 480, 40, "rédige le rapport hebdo du lundi", { output: { kind: "report", label: "Rapport hebdo" } });
  every("Loop Feeder", 1440, 180, 1440, 30, () => "Nuit : consolide les leçons et met à jour le Playbook");

  tasks.sort((a, b) => a.start - b.start);
  const res = { tasks, contents };
  cache.set(day, res);
  return res;
}

export const DEMO_TOPICS = TOPICS;
export { pick };
