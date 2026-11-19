// Task store: merges REAL tasks (data/work.json, written by workers in Phase 2+) with DEMO tasks.
import fs from "node:fs";
import path from "node:path";
import { parisClock } from "../sim/clock";
import { getWorld } from "../sim/world";
import { DEPT_BY_ID } from "../sim/data";
import { demoDay } from "./demo";
import { ContentSchema, TaskSchema, type Content, type FeedItem, type Task } from "./types";
import { z } from "zod";

const FILE = path.join(process.cwd(), "data", "work.json");
export const DEMO_MODE = process.env.DEMO_MODE === "on"; // real data only by default

function readReal(): { tasks: Task[]; contents: Content[] } {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return { tasks: z.array(TaskSchema).parse(raw.tasks ?? []), contents: z.array(ContentSchema).parse(raw.contents ?? []) };
  } catch {
    return { tasks: [], contents: [] };
  }
}

export function workBetween(from: number, to: number) {
  const real = readReal();
  const d0 = parisClock(from).day, d1 = parisClock(to).day;
  const tasks: Task[] = real.tasks.filter((t) => t.end >= from && t.start <= to);
  const contents: Content[] = [...real.contents];
  if (DEMO_MODE)
    for (let d = d0 - 1; d <= d1; d++) {
      const dd = demoDay(d);
      tasks.push(...dd.tasks.filter((t) => t.end >= from && t.start <= to));
      contents.push(...dd.contents);
    }
  tasks.sort((a, b) => a.start - b.start);
  return { tasks, contents: contents.filter((c) => c.created <= to).sort((a, b) => b.created - a.created).slice(0, 60) };
}

export function feedFrom(tasks: Task[], now: number, limit = 120): FeedItem[] {
  const w = getWorld();
  const items: FeedItem[] = [];
  for (const t of tasks) {
    const res = w.residents[t.residentId];
    const who = `${res.first} (${t.job})`;
    if (t.end <= now) items.push({ ts: t.end, kind: "done", text: `${who} a terminé : ${t.title}`, dept: t.dept, job: t.job, residentId: t.residentId, platform: t.platform, demo: t.demo, taskId: t.id });
    else if (t.start <= now) items.push({ ts: t.start, kind: "start", text: `${who} ${t.title}`, dept: t.dept, job: t.job, residentId: t.residentId, platform: t.platform, demo: t.demo, taskId: t.id });
  }
  // life events: birthdays at 08:00
  const c = parisClock(now);
  const doy = Math.floor((c.day * 86400000 - Date.UTC(new Date(c.day * 86400000).getUTCFullYear(), 0, 1)) / 86400000);
  if (c.minute > 480)
    for (const r of w.residents.filter((r) => r.birthday === doy).slice(0, 4))
      items.push({ ts: now - (c.minute - 480) * 60000, kind: "life", text: `🎂 C'est l'anniversaire de ${r.first} ${r.last} (${r.age} ans) — ${r.job}`, residentId: r.id, demo: false });
  return items.sort((a, b) => b.ts - a.ts).slice(0, limit);
}

export const deptName = (id: string) => DEPT_BY_ID[id as keyof typeof DEPT_BY_ID]?.name ?? id;
