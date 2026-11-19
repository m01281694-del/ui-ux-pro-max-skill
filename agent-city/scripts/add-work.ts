// Append REAL work to data/work.json. The task is assigned to a resident of the right job who is at work at that time.
// Usage: npx tsx scripts/add-work.ts '<json>'  where json = { tasks:[{job,title,start,end,contentId?,stage?,platform?,output?}], content?: Content, contentPatch?: {id, ...fields} }
import fs from "node:fs";
import { getWorld } from "../src/lib/sim/world";
import { JOB_TO_DEPT } from "../src/lib/sim/data";
import { parisClock } from "../src/lib/sim/clock";
import { scheduleFor } from "../src/lib/sim/life";
import { TaskSchema, ContentSchema, type Task } from "../src/lib/work/types";

const input = JSON.parse(process.argv[2]);
const file = "data/work.json";
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const w = getWorld();
function pick(job: string, ts: number) {
  const team = w.teams[job];
  if (!team) throw new Error(`métier inconnu : ${job}`);
  const c = parisClock(ts);
  const atWork = team.filter((id) => { const s = scheduleFor(w.residents[id], c.day, c.dow); let e = s[0]; for (const x of s) if (x.start <= c.minute) e = x; return e.place === w.residents[id].workplace; });
  const pool = atWork.length ? atWork : team.filter((id) => w.residents[id].nightShift);
  return pool[Math.floor(ts / 60000) % pool.length];
}
for (const t of input.tasks ?? []) {
  const start = typeof t.start === "string" ? Date.parse(t.start) : t.start, end = typeof t.end === "string" ? Date.parse(t.end) : t.end;
  const task: Task = TaskSchema.parse({ id: `r-${start}-${data.tasks.length}`, demo: false, dept: JOB_TO_DEPT[t.job], residentId: pick(t.job, start), ...t, start, end });
  data.tasks.push(task);
}
if (input.content) data.contents.push(ContentSchema.parse(input.content));
if (input.contentPatch) { const c = data.contents.find((x: { id: string }) => x.id === input.contentPatch.id); if (c) Object.assign(c, input.contentPatch); }
// keep the file small: last 45 days
const cutoff = Date.now() - 45 * 86400000;
data.tasks = data.tasks.filter((t: Task) => t.end > cutoff);
fs.writeFileSync(file, JSON.stringify(data, null, 1));
console.log("work.json:", data.tasks.length, "tâches,", data.contents.length, "contenus");
