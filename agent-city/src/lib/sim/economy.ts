// City economy — deterministic: purchases come from schedules, prices follow demand.
import { SHOPS } from "./data";
import { scheduleFor, setPriceFactorFn } from "./life";
import { getWorld } from "./world";

const visitsCache = new Map<number, number[]>();
const RAW = new Set<number>(); // guard against recursion while computing visits

function dowOf(day: number) { return new Date(day * 86400000).getUTCDay(); }

/** number of purchases per shop on a day (computed with neutral prices) */
export function visits(day: number): number[] {
  const c = visitsCache.get(day);
  if (c) return c;
  RAW.add(day);
  const v = SHOPS.map(() => 0);
  const dow = dowOf(day);
  for (const res of getWorld().residents) for (const e of scheduleFor(res, day, dow)) if (e.spend) v[e.spend.shop]++;
  RAW.delete(day);
  visitsCache.set(day, v);
  return v;
}

export function priceFactor(si: number, day: number): number {
  if (RAW.size) return 1;
  const a = visits(day - 1)[si], b = visits(day - 2)[si];
  const f = 1 + 0.15 * ((a - b) / Math.max(b, 1));
  return Math.max(0.88, Math.min(1.15, f));
}
setPriceFactorFn(priceFactor);

export interface EconomySnapshot {
  gdpToday: number;
  moneySupply: number;
  shops: { name: string; revenue: number; visits: number; price: number; trend: number; color: string }[];
}

export function economyAt(day: number, dow: number, minute: number): EconomySnapshot {
  visits(day - 1); visits(day - 2); // warm caches so prices are demand-based
  const w = getWorld();
  const rev = SHOPS.map(() => 0), cnt = SHOPS.map(() => 0);
  let spentToday = 0;
  for (const res of w.residents) {
    for (const e of scheduleFor(res, day, dow)) {
      if (e.spend && e.start <= minute) { rev[e.spend.shop] += e.spend.amount; cnt[e.spend.shop]++; spentToday += e.spend.amount; }
    }
  }
  const daysSince = day - 20393; // since 2025-11-01
  let money = 0;
  for (const res of w.residents) money += balanceOf(res.salary, res.initialMoney, daysSince);
  money -= spentToday;
  return {
    gdpToday: Math.round(spentToday),
    moneySupply: Math.round(money),
    shops: SHOPS.map((s, i) => ({
      name: s.name, revenue: Math.round(rev[i]), visits: cnt[i], color: s.color,
      price: Math.round(s.price * priceFactor(i, day) * 100) / 100,
      trend: Math.round((priceFactor(i, day) - 1) * 1000) / 10,
    })).sort((a, b) => b.revenue - a.revenue),
  };
}

/** savings model: 12% of salary saved each month on top of an initial balance */
export function balanceOf(salary: number, initial: number, daysSince: number) {
  return initial + (salary * 0.12 * daysSince) / 30;
}
