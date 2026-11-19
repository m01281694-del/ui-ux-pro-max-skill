"use client";
import { useEffect, useState } from "react";
import Shell from "./Shell";
import { Card } from "./Panels";

type Sys = {
  demoMode: boolean; hasClaudeKey: boolean; passwordProtected: boolean;
  control: { publishingPaused: boolean; approvalMode: string };
  ai: { total: number; cap: number; byJob: Record<string, { eur: number; calls: number; inTok: number; outTok: number }> };
  workers: { name: string; status: string; detail: string }[];
  queues: { dept: string; color: string; active: number; pending: number }[];
  connectors: { name: string; status: string; phase: number }[];
};
const dot: Record<string, string> = { ok: "bg-emerald-400", demo: "bg-amber-400", pending: "bg-slate-500", error: "bg-rose-500" };

export default function SystemView() {
  const [s, setS] = useState<Sys | null>(null);
  const load = () => fetch("/api/system", { cache: "no-store" }).then((r) => r.json()).then(setS);
  useEffect(() => { load(); const i = setInterval(load, 10000); return () => clearInterval(i); }, []);
  const control = async (p: Record<string, unknown>) => { await fetch("/api/control", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p) }); load(); };
  return (
    <Shell>
      <div className="absolute inset-0 overflow-y-auto p-4">
        <div className="mx-auto grid max-w-6xl gap-3 md:grid-cols-2">
          <Card title="Contrôle" className="md:col-span-2">
            {s && (
              <div className="flex flex-wrap items-center gap-3">
                <button data-testid="kill-switch" onClick={() => control({ publishingPaused: !s.control.publishingPaused })}
                  className={`rounded-xl px-5 py-3 font-display text-base font-bold ${s.control.publishingPaused ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}>
                  {s.control.publishingPaused ? "▶ Reprendre les publications" : "⏸ Pause toute publication"}
                </button>
                <label className="text-sm text-slate-300">Approval Desk :
                  <select value={s.control.approvalMode} onChange={(e) => control({ approvalMode: e.target.value })} className="ml-2 rounded-md bg-slate-900 px-2 py-1">
                    <option value="manuel">manuel</option><option value="semi-auto">semi-auto</option><option value="full-auto">full-auto</option>
                  </select>
                </label>
                <span className="text-xs text-slate-400">Mode {s.demoMode ? "DÉMO actif" : "réel"} · site {s.passwordProtected ? "protégé par mot de passe" : "NON protégé (définir SITE_PASSWORD)"}</span>
              </div>
            )}
          </Card>
          <Card title="Santé des workers">
            <ul className="space-y-1.5 text-sm" data-testid="workers">
              {s?.workers.map((w) => <li key={w.name} className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${dot[w.status] ?? "bg-slate-500"}`} /><span className="text-white">{w.name}</span><span className="ml-auto text-xs text-slate-400">{w.detail}</span></li>)}
            </ul>
          </Card>
          <Card title="Coût IA du jour">
            {s && (<>
              <div className="font-display text-2xl text-white">{s.ai.total.toFixed(3)} € <span className="text-sm text-slate-400">/ plafond {s.ai.cap} €</span></div>
              <div className="mt-1 h-2 rounded bg-white/5"><div className="h-2 rounded bg-orange-500" style={{ width: `${Math.min(100, (s.ai.total / s.ai.cap) * 100)}%` }} /></div>
              <table className="mt-2 w-full text-xs"><tbody>
                {Object.entries(s.ai.byJob).map(([j, u]) => <tr key={j} className="border-t border-white/5"><td className="py-1 text-slate-300">{j}</td><td className="text-right text-slate-400">{u.calls} appels</td><td className="text-right text-slate-400">{u.inTok + u.outTok} tok</td><td className="text-right text-white">{u.eur.toFixed(4)} €</td></tr>)}
                {!Object.keys(s.ai.byJob).length && <tr><td className="py-1 text-slate-500">Aucun appel IA aujourd&apos;hui{s.hasClaudeKey ? "" : " (clé Claude pas encore configurée)"}.</td></tr>}
              </tbody></table>
            </>)}
          </Card>
          <Card title="Files de tâches (±1 h)">
            <ul className="space-y-1 text-sm">{s?.queues.map((q) => <li key={q.dept} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: q.color }} />{q.dept}<span className="ml-auto text-xs text-slate-400">{q.active} en cours · {q.pending} en attente</span></li>)}</ul>
          </Card>
          <Card title="Connecteurs & quotas">
            <ul className="space-y-1 text-sm">{s?.connectors.map((c) => <li key={c.name} className="flex gap-2"><span className="text-white">{c.name}</span><span className="ml-auto text-xs text-slate-400">{c.status} · phase {c.phase}</span></li>)}</ul>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
