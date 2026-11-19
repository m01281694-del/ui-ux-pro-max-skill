// LIFE LAYER — deterministic simulation (no AI). Schedules, positions, needs, economy.
import { SHOPS, type PlaceKind } from "./data";
import { hash, irange, mulberry32, pick, range, type Rng } from "./rng";
import { getWorld, type Building, type Pt, type Resident } from "./world";

export interface Entry {
  start: number; // minute of day
  place: number; // building id
  activity: string;
  spend?: { shop: number; amount: number }; // shop = SHOPS index
}

export interface ResidentState {
  pos: Pt;
  visible: boolean;
  traveling: boolean;
  activity: string;
  place: number;
  entry: Entry;
  needs: { faim: number; énergie: number; social: number; fun: number; humeur: number };
}

const SPEED = 7.5; // tiles / minute

const LEISURE: { kind: PlaceKind; label: string; dur: [number, number] }[] = [
  { kind: "park", label: "se promène au parc", dur: [40, 110] },
  { kind: "cinema", label: "regarde un film au cinéma", dur: [110, 150] },
  { kind: "gym", label: "fait du sport à la salle", dur: [50, 90] },
  { kind: "arcade", label: "joue à la salle de jeux", dur: [45, 120] },
  { kind: "cafe", label: "boit un verre au café", dur: [40, 90] },
];

function shopBuilding(kind: PlaceKind): { b: number; si: number } | null {
  const w = getWorld();
  const si = SHOPS.findIndex((s) => s.kind === kind);
  if (si >= 0) return { b: w.shops[si], si };
  if (kind === "park") return { b: w.park[0], si: -1 };
  return null;
}

/** price multiplier from demand (filled by economy, defaults 1) */
let priceFactorFn: (si: number, day: number) => number = () => 1;
export const setPriceFactorFn = (fn: typeof priceFactorFn) => { priceFactorFn = fn; };

function spendAt(r: Rng, kind: PlaceKind, day: number) {
  const s = shopBuilding(kind);
  if (!s || s.si < 0) return undefined;
  return { shop: s.si, amount: Math.round(SHOPS[s.si].price * priceFactorFn(s.si, day) * range(r, 0.7, 1.3) * 100) / 100 };
}

const schedCache = new Map<string, Entry[]>();

export function isWorkday(res: Resident, dow: number): boolean {
  if (res.role === "retired") return false;
  if (res.role === "shop") return dow !== res.restDay;
  if (res.nightShift) return true;
  return dow >= 1 && dow <= 5;
}

export function scheduleFor(res: Resident, day: number, dow: number): Entry[] {
  const key = `${res.id}:${day}`;
  const c = schedCache.get(key);
  if (c) return c;
  if (schedCache.size > 12000) schedCache.clear();
  const r = mulberry32(hash("sched", res.id, day));
  const w = getWorld();
  const H = res.home;
  const e: Entry[] = [];
  const add = (start: number, place: number, activity: string, spend?: Entry["spend"]) => e.push({ start, place, activity, spend });
  const t = res.traits;

  if (res.nightShift && res.workplace !== undefined) {
    add(0, res.workplace, "travaille (équipe de nuit)");
    add(360 + irange(r, 0, 20), H, "rentre et prend son petit-déj");
    add(450, H, "dort");
    add(930 + irange(r, 0, 30), H, "se réveille, temps libre");
    const l = pick(r, LEISURE);
    const lb = shopBuilding(l.kind)!;
    const ls = 1000 + irange(r, 0, 60);
    add(ls, lb.b, l.label, spendAt(r, l.kind, day));
    add(ls + irange(r, ...l.dur), H, "dîne à la maison");
    add(1310, res.workplace, "travaille (équipe de nuit)");
  } else {
    const wake = Math.round(375 + (1 - t.conscience) * 70 + range(r, -15, 15) + (res.role === "retired" ? 40 : 0));
    const sleep = Math.min(1435, Math.round(1350 + t.extraversion * 60 + range(r, -25, 25)));
    add(0, H, "dort");
    add(wake, H, "se réveille");
    let cursor = wake + 25;
    if (r() < 0.25) {
      const b = shopBuilding("bakery")!;
      add(cursor, b.b, "achète des croissants", spendAt(r, "bakery", day));
      cursor += 20;
      add(cursor, H, "petit-déj à la maison");
      cursor += 15;
    } else add(cursor - 10, H, "prend son petit-déj");

    const work = isWorkday(res, dow) && res.workplace !== undefined;
    if (work) {
      const ws = Math.max(cursor + 20, Math.round(510 + range(r, -30, 40)));
      const lunch = Math.round(720 + (t.névrosisme - 0.5) * 50 + range(r, -20, 20)); // hungry/anxious people eat earlier
      const we = Math.round(1050 + t.conscience * 60 + range(r, -30, 30));
      add(ws, res.workplace!, res.role === "student" ? "en cours" : "travaille");
      if (r() < 0.7) {
        const kind = pick(r, ["cafe", "restaurant", "bakery", "park"] as PlaceKind[]);
        const b = shopBuilding(kind)!;
        add(lunch, b.b, kind === "park" ? "pique-nique au parc" : "déjeune dehors", spendAt(r, kind === "park" ? "bakery" : kind, day));
      } else add(lunch, res.workplace!, "déjeune sur place");
      add(lunch + irange(r, 45, 70), res.workplace!, res.role === "student" ? "en cours" : "travaille");
      cursor = we;
    } else {
      // free day: morning errands or stroll
      cursor = Math.max(cursor + 30, 600 + irange(r, 0, 90));
      const l = pick(r, LEISURE);
      const lb = shopBuilding(l.kind)!;
      add(cursor, lb.b, l.label, spendAt(r, l.kind, day));
      cursor += irange(r, ...l.dur);
      const kind = pick(r, ["cafe", "restaurant", "bakery"] as PlaceKind[]);
      const b = shopBuilding(kind)!;
      cursor = Math.max(cursor, 735);
      add(cursor, b.b, "déjeune", spendAt(r, kind, day));
      cursor += irange(r, 50, 80);
      add(cursor, H, "fait une sieste / se repose");
      cursor += irange(r, 60, 150);
    }
    // evening: shopping, leisure
    if (r() < 0.35) {
      const b = shopBuilding("grocery")!;
      add(cursor, b.b, "fait les courses", spendAt(r, "grocery", day));
      cursor += irange(r, 25, 40);
    }
    if (r() < 0.06) {
      const b = shopBuilding("clothes")!;
      add(cursor, b.b, "achète des vêtements", spendAt(r, "clothes", day));
      cursor += irange(r, 25, 45);
    }
    if (r() < 0.25 + t.extraversion * 0.5) {
      const l = pick(r, LEISURE);
      const lb = shopBuilding(l.kind)!;
      add(cursor, lb.b, l.label, spendAt(r, l.kind, day));
      cursor += irange(r, ...l.dur);
    }
    const dinner = Math.max(cursor, 1170 + irange(r, 0, 60));
    if (r() < 0.1) {
      const b = shopBuilding("restaurant")!;
      add(dinner, b.b, "dîne au bistrot", spendAt(r, "restaurant", day));
      add(dinner + irange(r, 60, 90), H, "rentre se détendre");
    } else {
      add(dinner, H, "dîne à la maison");
      add(dinner + 50, H, "se détend à la maison");
    }
    add(Math.max(sleep, e[e.length - 1].start + 10), H, "dort");
  }
  // sanitize ordering
  e.sort((a, b) => a.start - b.start);
  for (let i = 1; i < e.length; i++) if (e[i].start <= e[i - 1].start) e[i].start = e[i - 1].start + 5;
  schedCache.set(key, e);
  return e;
}

// ---------- positions
function insidePoint(res: Resident, b: Building, salt: number): Pt {
  if (b.kind === "office" && res.desk && res.workplace === b.id) return res.desk;
  const r = mulberry32(hash("in", res.id, b.id, salt));
  return { x: b.x + 0.4 + r() * (b.w - 0.8), y: b.y + 0.4 + r() * (b.h - 0.8) };
}

export function path(a: Pt, doorA: Pt, doorB: Pt, b: Pt, lane: number): Pt[] {
  const vx = Math.round(doorA.x / 8) * 8;
  return [a, doorA, { x: vx + lane, y: doorA.y + lane }, { x: vx + lane, y: doorB.y + lane }, doorB, b];
}

const len = (p: Pt[]) => { let s = 0; for (let i = 1; i < p.length; i++) s += Math.abs(p[i].x - p[i - 1].x) + Math.abs(p[i].y - p[i - 1].y); return s; };

function along(p: Pt[], d: number): Pt {
  for (let i = 1; i < p.length; i++) {
    const seg = Math.abs(p[i].x - p[i - 1].x) + Math.abs(p[i].y - p[i - 1].y);
    if (d <= seg || i === p.length - 1) {
      const f = seg === 0 ? 1 : Math.min(1, d / seg);
      return { x: p[i - 1].x + (p[i].x - p[i - 1].x) * f, y: p[i - 1].y + (p[i].y - p[i - 1].y) * f };
    }
    d -= seg;
  }
  return p[p.length - 1];
}

export interface WorkOverride { building: number; since: number } // minute when task started

export function stateAt(res: Resident, day: number, dow: number, minute: number, override?: WorkOverride, withNeeds = true): ResidentState {
  const w = getWorld();
  const sched = scheduleFor(res, day, dow);
  let i = 0;
  while (i + 1 < sched.length && sched[i + 1].start <= minute) i++;
  let entry = sched[i];
  let prevPlace = i > 0 ? sched[i - 1].place : sched[sched.length - 1].place;
  let enterMinute = entry.start;
  let entryIdx = i;
  if (override && entry.place !== override.building) {
    // a real task pulls the resident to the office
    prevPlace = entry.place;
    entry = { start: override.since, place: override.building, activity: "travaille sur une tâche" };
    enterMinute = override.since;
    entryIdx = 99;
  }
  const B = w.buildings[entry.place];
  const target = insidePoint(res, B, entryIdx);
  const needs = withNeeds ? needsAt(sched, minute, res) : NO_NEEDS;
  const base = { activity: entry.activity, place: entry.place, entry, needs };
  if (prevPlace !== entry.place) {
    const A = w.buildings[prevPlace];
    const from = insidePoint(res, A, entryIdx - 1);
    const p = path(from, A.door, B.door, target, res.lane);
    const L = len(p);
    const elapsed = (minute - enterMinute) * SPEED;
    if (elapsed < L && elapsed >= 0) {
      return { ...base, pos: along(p, elapsed), visible: true, traveling: true, activity: `en route vers ${B.name}` };
    }
  }
  // idle wobble for visible residents
  const wob = B.kind === "park" ? 0.35 : 0.04;
  const ph = res.id * 1.7;
  const pos = { x: target.x + Math.sin(minute * 0.35 + ph) * wob, y: target.y + Math.cos(minute * 0.27 + ph) * wob };
  return { ...base, pos, visible: B.open, traveling: false };
}

const NO_NEEDS = { faim: 0, énergie: 0, social: 0, fun: 0, humeur: 0 };
export function needsAt(sched: Entry[], minute: number, res: Resident) {
  let faim = 55, énergie = 35, social = 50, fun = 50;
  for (let i = 0; i < sched.length; i++) {
    const a = sched[i].start, b = Math.min(minute, sched[i + 1]?.start ?? 1440);
    if (b <= a) break;
    const h = (b - a) / 60;
    const act = sched[i].activity;
    if (act.startsWith("dort")) { énergie += 11 * h; faim -= 2 * h; }
    else {
      faim -= 8 * h;
      énergie -= (act.startsWith("travaille") || act === "en cours" ? 6.5 : act.includes("sport") ? 14 : 4.5) * h;
      if (/déj|dîne|croissants|pique/.test(act)) faim = 100;
      if (/parc|café|cinéma|jeux|bistrot|dehors|sport/.test(act)) { social += 18 * h; fun += 22 * h; }
      else if (act.startsWith("travaille")) { social += 2 * h; fun -= 4 * h; }
      else { social -= 3 * h; fun += 3 * h; }
    }
    faim = clamp(faim); énergie = clamp(énergie); social = clamp(social); fun = clamp(fun);
  }
  const humeur = clamp(0.3 * faim + 0.25 * énergie + 0.2 * social + 0.25 * fun - res.traits.névrosisme * 15 + 8);
  return { faim: Math.round(faim), énergie: Math.round(énergie), social: Math.round(social), fun: Math.round(fun), humeur: Math.round(humeur) };
}
const clamp = (v: number) => Math.max(0, Math.min(100, v));
