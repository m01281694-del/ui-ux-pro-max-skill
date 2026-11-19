// World generation: map, buildings and the 1 000 residents. Pure & deterministic (seed).
import { CIVIC, DEPARTMENTS, FIRST_NAMES, JOB_LOAD, JOB_TO_DEPT, LAST_NAMES, SHOPS, SKILLS, TRAITS, type DeptId, type PlaceKind } from "./data";
import { irange, mulberry32, pick, range } from "./rng";

export const SEED = 20261119;
export const BLOCKS = 10;
export const BS = 8; // block stride (road on local 0)
export const N = BLOCKS * BS + 1; // tiles per side
export const POPULATION = 1000;

export interface Pt { x: number; y: number }

export interface Building {
  id: number;
  kind: PlaceKind;
  name: string;
  x: number; y: number; w: number; h: number; // footprint in tiles
  door: Pt; // on a road
  height: number; // visual height (px units)
  color: string;
  dept?: DeptId;
  shopIndex?: number;
  /** people inside are visible (offices = open floor with desks, park) */
  open: boolean;
}

export type Role = "dept" | "shop" | "civic" | "student" | "retired" | "freelance";

export interface Resident {
  id: number;
  first: string; last: string; age: number;
  role: Role;
  job: string; // exact job label
  dept?: DeptId;
  lead: boolean;
  nightShift: boolean;
  workplace?: number; // building id
  desk?: Pt; // world position of desk (offices)
  home: number;
  traits: Record<(typeof TRAITS)[number], number>; // 0..1
  skills: Record<(typeof SKILLS)[number], number>; // 0..100
  salary: number; // monthly €
  initialMoney: number;
  color: string;
  birthday: number; // day of year 0..364
  restDay: number; // 0..6 (shop staff)
  lane: number; // sidewalk offset
  friends: number[];
}

export interface World {
  buildings: Building[];
  residents: Resident[];
  teams: Record<string, number[]>; // job -> resident ids (lead first)
  offices: Record<DeptId, number>;
  shops: number[]; // building ids by SHOPS index
  park: number[];
  townhall: number;
  isRoad: (x: number, y: number) => boolean;
}

const isRoad = (x: number, y: number) => x % BS === 0 || y % BS === 0;

// Block plan (bx, by) -> facility. 3 offices left, 3 right, like the org chart.
const OFFICE_BLOCKS: [DeptId, number, number][] = [
  ["research", 3, 3], ["content", 3, 4], ["publish", 3, 5],
  ["loop", 6, 3], ["sales", 6, 4], ["community", 6, 5],
];
const FACILITY_BLOCKS: [PlaceKind, number, number][] = [
  ["townhall", 4, 4], ["park", 4, 5], ["park", 5, 5], ["cafe", 4, 3], ["bakery", 5, 3], ["restaurant", 5, 4],
  ["grocery", 4, 6], ["cinema", 5, 6], ["gym", 3, 6], ["arcade", 6, 6], ["clothes", 3, 2],
  ["school", 6, 2], ["clinic", 2, 4], ["workshop", 7, 7], ["depot", 2, 7],
];

let cached: World | null = null;

export function getWorld(): World {
  if (cached) return cached;
  const r = mulberry32(SEED);
  const buildings: Building[] = [];
  const offices = {} as Record<DeptId, number>;
  const shops: number[] = [];
  const park: number[] = [];
  let townhall = -1;
  const used = new Set<string>();

  const fullBlock = (bx: number, by: number, kind: PlaceKind, name: string, color: string, height: number, open: boolean, extra: Partial<Building> = {}) => {
    const x0 = bx * BS, y0 = by * BS;
    const b: Building = {
      id: buildings.length, kind, name, x: x0 + 1, y: y0 + 1, w: BS - 1, h: BS - 1,
      door: { x: x0 + BS / 2, y: y0 + BS }, height, color, open, ...extra,
    };
    buildings.push(b);
    used.add(`${bx},${by}`);
    return b;
  };

  for (const [dept, bx, by] of OFFICE_BLOCKS) {
    const d = DEPARTMENTS.find((x) => x.id === dept)!;
    const b = fullBlock(bx, by, "office", `Bureaux ${d.name}`, d.color, 10, true, { dept });
    offices[dept] = b.id;
  }
  for (const [kind, bx, by] of FACILITY_BLOCKS) {
    if (kind === "park") {
      park.push(fullBlock(bx, by, "park", "Parc Central", "#166534", 0, true).id);
      continue;
    }
    const si = SHOPS.findIndex((s) => s.kind === kind);
    if (si >= 0) {
      const s = SHOPS[si];
      const b = fullBlock(bx, by, kind, s.name, s.color, 34, false, { shopIndex: si });
      shops[si] = b.id;
      continue;
    }
    const c = CIVIC.find((c) => c.kind === kind)!;
    const b = fullBlock(bx, by, kind, c.name, c.color, kind === "townhall" ? 70 : 44, false);
    if (kind === "townhall") townhall = b.id;
  }

  // Residential blocks: 4 houses each.
  const homes: number[] = [];
  const houseColors = ["#cbd5e1", "#fde68a", "#fecaca", "#bfdbfe", "#d9f99d", "#e9d5ff", "#fed7aa"];
  for (let by = 0; by < BLOCKS; by++)
    for (let bx = 0; bx < BLOCKS; bx++) {
      if (used.has(`${bx},${by}`)) continue;
      const x0 = bx * BS, y0 = by * BS;
      for (const [dx, dy] of [[1, 1], [5, 1], [1, 5], [5, 5]]) {
        const top = dy === 1;
        const b: Building = {
          id: buildings.length, kind: "home", name: `Maison ${buildings.length}`,
          x: x0 + dx, y: y0 + dy, w: 3, h: 3,
          door: { x: x0 + dx + 1, y: top ? y0 : y0 + BS },
          height: irange(r, 18, 40), color: pick(r, houseColors), open: false,
        };
        buildings.push(b);
        homes.push(b.id);
      }
    }

  // ---- residents
  const residents: Resident[] = [];
  const teams: Record<string, number[]> = {};
  const mk = (role: Role, job: string, workplace: number | undefined, dept?: DeptId): Resident => {
    const id = residents.length;
    const traits = Object.fromEntries(TRAITS.map((t) => [t, r()])) as Resident["traits"];
    const skills = Object.fromEntries(SKILLS.map((s) => [s, Math.round(range(r, 15, 95))])) as Resident["skills"];
    const age = role === "student" ? irange(r, 15, 23) : role === "retired" ? irange(r, 63, 88) : irange(r, 21, 62);
    const salary = role === "retired" ? irange(r, 1100, 2200) : role === "student" ? irange(r, 0, 600) : role === "dept" ? irange(r, 2300, 4800) : irange(r, 1700, 3200);
    const res: Resident = {
      id, first: pick(r, FIRST_NAMES), last: pick(r, LAST_NAMES), age, role, job, dept, lead: false, nightShift: false,
      workplace, home: homes[id % homes.length], traits, skills, salary,
      initialMoney: irange(r, 300, 9000), color: dept ? DEPARTMENTS.find((d) => d.id === dept)!.color : "#e2e8f0",
      birthday: irange(r, 0, 364), restDay: irange(r, 0, 6), lane: range(r, -0.32, 0.32), friends: [],
    };
    residents.push(res);
    return res;
  };

  // Department workers (~300), teams of 4-14 with a lead and one night-shift member.
  const totalLoad = Object.values(JOB_LOAD).reduce((a, b) => a + b, 0);
  for (const d of DEPARTMENTS) {
    const office = buildings[offices[d.id]];
    let deskIdx = 0;
    for (const job of d.jobs) {
      const n = Math.max(4, Math.round((JOB_LOAD[job] / totalLoad) * 300));
      teams[job] = [];
      for (let i = 0; i < n; i++) {
        const res = mk("dept", job, office.id, d.id);
        res.lead = i === 0;
        res.nightShift = i === 1;
        // desks: 8 x 7 grid with 0.85 tile spacing inside the 7x7 floor
        const col = deskIdx % 8, row = Math.floor(deskIdx / 8);
        res.desk = { x: office.x + 0.45 + col * 0.85, y: office.y + 0.45 + row * 0.85 };
        deskIdx++;
        teams[job].push(res.id);
      }
    }
  }
  // Shop staff
  SHOPS.forEach((s, si) => { for (let i = 0; i < s.staff; i++) mk("shop", s.cityJob, shops[si]); });
  // Civic staff
  for (const c of CIVIC) {
    const b = buildings.find((x) => x.kind === c.kind)!;
    for (let i = 0; i < c.staff; i++) mk("civic", c.cityJob, b.id);
  }
  const school = buildings.find((b) => b.kind === "school")!.id;
  while (residents.length < POPULATION) {
    const k = residents.length % 3;
    if (k === 0) mk("student", "Étudiant·e", school);
    else if (k === 1) mk("retired", "Retraité·e", undefined);
    else mk("freelance", "Créateur·rice indépendant·e", undefined);
  }
  // Friendships: coworkers + neighbours.
  for (const res of residents) {
    const set = new Set<number>();
    for (let i = 0; i < 4; i++) {
      const other = (res.id + 1 + Math.floor(r() * (POPULATION - 1))) % POPULATION;
      set.add(other);
    }
    if (res.job && teams[res.job]) for (const t of teams[res.job].slice(0, 3)) if (t !== res.id) set.add(t);
    res.friends = [...set].slice(0, 6);
  }

  cached = { buildings, residents, teams, offices, shops, park, townhall, isRoad };
  return cached;
}

export const deptOfJob = (job: string): DeptId | undefined => JOB_TO_DEPT[job];
