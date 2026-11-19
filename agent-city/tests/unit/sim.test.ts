import { describe, expect, it } from "vitest";
import { getWorld, POPULATION } from "@/lib/sim/world";
import { DEPARTMENTS } from "@/lib/sim/data";
import { scheduleFor, stateAt } from "@/lib/sim/life";
import { economyAt } from "@/lib/sim/economy";
import { parisClock, tsOf } from "@/lib/sim/clock";
import { demoDay } from "@/lib/work/demo";
import { TaskSchema, ContentSchema } from "@/lib/work/types";
import { readBrain } from "@/lib/brain/graph";

const DAY = 20776; // a Thursday
const w = getWorld();

describe("world", () => {
  it("has 1000 residents, 6 departments and 36 exact jobs with teams of ≥4", () => {
    expect(w.residents).toHaveLength(POPULATION);
    expect(DEPARTMENTS.flatMap((d) => d.jobs)).toHaveLength(36);
    for (const d of DEPARTMENTS) for (const j of d.jobs) expect(w.teams[j].length).toBeGreaterThanOrEqual(4);
    const deptWorkers = w.residents.filter((r) => r.dept).length;
    expect(deptWorkers).toBeGreaterThan(280);
    expect(deptWorkers).toBeLessThan(320);
  });
  it("is reproducible (fixed seed)", () => {
    expect(w.residents[142].first).toBe(getWorld().residents[142].first);
  });
  it("each job has a lead and a night-shift member", () => {
    for (const ids of Object.values(w.teams)) {
      expect(w.residents[ids[0]].lead).toBe(true);
      expect(ids.some((id) => w.residents[id].nightShift)).toBe(true);
    }
  });
});

describe("life layer", () => {
  it("schedules are sorted and deterministic", () => {
    for (const r of w.residents.slice(0, 200)) {
      const s = scheduleFor(r, DAY, 4);
      for (let i = 1; i < s.length; i++) expect(s[i].start).toBeGreaterThan(s[i - 1].start);
      expect(scheduleFor(r, DAY, 4)).toBe(s);
    }
  });
  it("streets are empty at 3am and busy at noon", () => {
    const at = (m: number) => w.residents.filter((r) => stateAt(r, DAY, 4, m, undefined, false).traveling).length;
    const sleeping = w.residents.filter((r) => stateAt(r, DAY, 4, 180, undefined, false).activity.startsWith("dort")).length;
    expect(sleeping).toBeGreaterThan(900);
    expect(at(180)).toBeLessThan(10);
    expect(at(12.5 * 60) + at(8.5 * 60)).toBeGreaterThan(60);
  });
  it("needs stay within 0..100", () => {
    for (const r of w.residents.slice(0, 50)) for (const m of [100, 600, 1300]) {
      const n = stateAt(r, DAY, 4, m).needs;
      for (const v of Object.values(n)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); }
    }
  });
  it("economy produces revenue and prices stay within ±15%", () => {
    const e = economyAt(DAY, 4, 1400);
    expect(e.gdpToday).toBeGreaterThan(5000);
    for (const s of e.shops) expect(Math.abs(s.trend)).toBeLessThanOrEqual(15);
  });
});

describe("clock", () => {
  it("tsOf/parisClock round-trip", () => {
    const ts = tsOf(DAY, 615);
    const c = parisClock(ts);
    expect(c.day).toBe(DAY);
    expect(Math.round(c.minute)).toBe(615);
  });
});

describe("work layer (demo)", () => {
  it("tasks and contents validate against schemas and are flagged demo", () => {
    const d = demoDay(DAY);
    expect(d.tasks.length).toBeGreaterThan(100);
    for (const t of d.tasks) { TaskSchema.parse(t); expect(t.demo).toBe(true); expect(w.residents[t.residentId].job).toBe(t.job); }
    for (const c of d.contents) ContentSchema.parse(c);
    expect(d.contents.filter((c) => c.kind === "video")).toHaveLength(3);
  });
});

describe("brain", () => {
  it("reads Obsidian notes with wikilinks", () => {
    const g = readBrain();
    expect(g.nodes.length).toBeGreaterThan(50);
    expect(g.links.length).toBeGreaterThan(50);
    expect(g.nodes.find((n) => n.id === "Playbook")).toBeTruthy();
  });
});
