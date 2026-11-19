"use client";
// « Organigramme » — 6 cards around an oval track; glowing dots = content moving between departments.
import { DEPARTMENTS, type DeptId } from "@/lib/sim/data";
import { getWorld } from "@/lib/sim/world";
import { simNow, useApp } from "@/lib/client/store";
import { useTick } from "@/lib/client/useWork";

const CX = 230, CY = 175, RX = 62, RY = 118;
const ANG: Record<DeptId, number> = { research: 215, content: 180, publish: 145, community: 35, sales: 0, loop: -35 };
const PREV: Record<DeptId, DeptId> = { research: "loop", content: "research", publish: "content", community: "publish", sales: "community", loop: "sales" };
const pt = (deg: number) => ({ x: CX + RX * Math.cos((deg * Math.PI) / 180), y: CY + RY * Math.sin((deg * Math.PI) / 180) });
const CARD: Record<DeptId, { x: number; y: number }> = {
  research: { x: 2, y: 18 }, content: { x: 2, y: 140 }, publish: { x: 2, y: 262 },
  loop: { x: 308, y: 18 }, sales: { x: 308, y: 140 }, community: { x: 308, y: 262 },
};

export default function OrgChart({ compact = false }: { compact?: boolean }) {
  useTick(250);
  const tasks = useApp((s) => s.tasks);
  const now = simNow();
  const w = getWorld();
  const active = tasks.filter((t) => t.start <= now && now < t.end);
  const byDept = Object.fromEntries(DEPARTMENTS.map((d) => [d.id, active.filter((t) => t.dept === d.id).length]));

  // dots: content tasks travel from previous dept to current during their first 25% (min 20 s)
  const dots = active.filter((t) => t.contentId).map((t) => {
    let a = ANG[PREV[t.dept]], b = ANG[t.dept];
    while (b > a) b -= 360;
    const f = Math.min(1, (now - t.start) / Math.max(20000, (t.end - t.start) * 0.25));
    const e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
    return { id: t.id, ...pt(a + (b - a) * e), color: DEPARTMENTS.find((d) => d.id === t.dept)!.color };
  });
  // ambient particles always circulating (the loop)
  const amb = Array.from({ length: 10 }, (_, i) => pt(((now / 90) + i * 36) % 360 * -1));

  return (
    <svg viewBox="0 0 460 360" className={`w-full ${compact ? "max-h-[260px]" : ""}`} role="img" aria-label="Organigramme de la boucle">
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill="none" stroke="#f97316" strokeOpacity="0.25" strokeWidth="14" />
      <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill="none" stroke="#f97316" strokeWidth="1.5" strokeDasharray="4 6" />
      {amb.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="1.6" fill="#fdba74" opacity="0.7" />)}
      {/* centre: Mairie + You */}
      <g>
        <rect x={CX - 46} y={CY - 44} width="92" height="36" rx="10" fill="#fff" />
        <text x={CX} y={CY - 29} textAnchor="middle" fontSize="8" fill="#9a3412" fontWeight="700">MAIRIE</text>
        <text x={CX} y={CY - 16} textAnchor="middle" fontSize="11" fill="#0f172a" fontWeight="700">Claude Code</text>
        <rect x={CX - 30} y={CY + 6} width="60" height="30" rx="15" fill="#f97316" />
        <text x={CX} y={CY + 25} textAnchor="middle" fontSize="12" fill="#fff" fontWeight="700">You</text>
      </g>
      {DEPARTMENTS.map((d) => {
        const c = CARD[d.id];
        const a = pt(ANG[d.id]);
        const n = byDept[d.id];
        const staff = d.jobs.reduce((s, j) => s + w.teams[j].length, 0);
        return (
          <g key={d.id}>
            <line x1={c.x < 100 ? c.x + 150 : c.x} y1={c.y + 40} x2={a.x} y2={a.y} stroke="#f97316" strokeOpacity="0.35" strokeWidth="1" />
            <rect x={c.x} y={c.y} width="150" height="82" rx="12" fill="#fff" />
            <rect x={c.x} y={c.y} width="5" height="82" rx="2" fill={d.color} />
            <text x={c.x + 12} y={c.y + 15} fontSize="10.5" fontWeight="700" fill="#0f172a">{d.name}</text>
            <text x={c.x + 142} y={c.y + 15} textAnchor="end" fontSize="8" fill={n ? "#ea580c" : "#94a3b8"} fontWeight="700">{n ? `● ${n} actives` : `${staff} pers.`}</text>
            {d.jobs.map((j, i) => (
              <text key={j} x={c.x + 12 + (i % 2) * 68} y={c.y + 32 + Math.floor(i / 2) * 16} fontSize="8" fill="#334155">{j}</text>
            ))}
            <circle cx={a.x} cy={a.y} r={n ? 5 : 3.5} fill={d.color} filter={n ? "url(#glow)" : undefined} />
          </g>
        );
      })}
      {dots.map((p) => <circle key={p.id} cx={p.x} cy={p.y} r="4.5" fill={p.color} stroke="#fff" strokeWidth="1.2" filter="url(#glow)" />)}
    </svg>
  );
}
