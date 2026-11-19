// Daily AI spend cap (€) with per-job counters. In-memory for Phase 1; persisted in the DB from Phase 2.
const PRICES: Record<string, [number, number]> = { // $ per 1M tokens (input, output)
  "claude-opus-5-5": [4, 20], "claude-sonnet-5-5": [2, 10], "claude-haiku-5-5": [0.1, 0.5],
};
const USD_EUR = 0.92;
export const DAILY_CAP_EUR = Number(process.env.AI_DAILY_CAP_EUR ?? 10);

type Usage = { day: string; total: number; byJob: Record<string, { eur: number; calls: number; inTok: number; outTok: number }> };
const g = globalThis as unknown as { __aiUsage?: Usage };
const today = () => new Date().toISOString().slice(0, 10);

function usage(): Usage {
  if (!g.__aiUsage || g.__aiUsage.day !== today()) g.__aiUsage = { day: today(), total: 0, byJob: {} };
  return g.__aiUsage;
}
export function recordUsage(job: string, model: string, inTok: number, outTok: number) {
  const [pi, po] = PRICES[model] ?? [4, 20];
  const eur = ((inTok * pi + outTok * po) / 1e6) * USD_EUR;
  const u = usage();
  u.total += eur;
  const j = (u.byJob[job] ??= { eur: 0, calls: 0, inTok: 0, outTok: 0 });
  j.eur += eur; j.calls++; j.inTok += inTok; j.outTok += outTok;
}
export const budgetLeft = () => DAILY_CAP_EUR - usage().total;
export const usageSnapshot = () => ({ ...usage(), cap: DAILY_CAP_EUR });
/** graceful degradation: pick a smaller model as we approach the cap */
export function modelFor(tier: "opus" | "sonnet" | "haiku"): string {
  const left = budgetLeft() / DAILY_CAP_EUR;
  if (tier === "opus" && left < 0.3) return "claude-sonnet-5-5";
  if (tier !== "haiku" && left < 0.1) return "claude-haiku-5-5";
  return { opus: "claude-opus-5-5", sonnet: "claude-sonnet-5-5", haiku: "claude-haiku-5-5" }[tier];
}
