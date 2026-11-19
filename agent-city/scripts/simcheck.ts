import { getWorld } from "../src/lib/sim/world";
import { parisClock } from "../src/lib/sim/clock";
import { stateAt } from "../src/lib/sim/life";
import { economyAt } from "../src/lib/sim/economy";
import { demoDay } from "../src/lib/work/demo";
let t0 = performance.now();
const w = getWorld();
console.log("world", w.residents.length, "buildings", w.buildings.length, (performance.now()-t0).toFixed(1)+"ms");
const counts: Record<string, number> = {};
for (const r of w.residents) counts[r.role] = (counts[r.role]||0)+1;
console.log(counts, "teams", Object.keys(w.teams).length, Object.values(w.teams).reduce((a,b)=>a+b.length,0));
for (const h of [3, 8.5, 12.5, 18, 21]) {
  const c = parisClock(Date.now()); 
  t0 = performance.now();
  let vis = 0, trav = 0; const acts: Record<string, number> = {};
  for (const r of w.residents) { const s = stateAt(r, c.day, c.dow, h*60); if (s.visible) vis++; if (s.traveling) trav++; const k = s.activity.split(" ")[0]; acts[k]=(acts[k]||0)+1; }
  console.log(h, "visible", vis, "travel", trav, (performance.now()-t0).toFixed(1)+"ms", JSON.stringify(acts).slice(0,200));
}
const c = parisClock(Date.now());
t0 = performance.now();
console.log(economyAt(c.day, c.dow, 1000).gdpToday, (performance.now()-t0).toFixed(1)+"ms");
t0 = performance.now();
const d = demoDay(c.day); console.log("demo tasks", d.tasks.length, d.contents.length, (performance.now()-t0).toFixed(1)+"ms");
console.log(d.tasks.slice(0,3));
