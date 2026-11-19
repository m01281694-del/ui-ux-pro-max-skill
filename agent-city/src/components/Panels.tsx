"use client";
import { useMemo, useState } from "react";
import { DEPARTMENTS, DEPT_BY_ID, SHOPS } from "@/lib/sim/data";
import { getWorld } from "@/lib/sim/world";
import { parisClock, fmtTime, tsOf } from "@/lib/sim/clock";
import { scheduleFor, stateAt, needsAt } from "@/lib/sim/life";
import { economyAt, balanceOf } from "@/lib/sim/economy";
import { goLive, setState, simNow, startReplay, useApp } from "@/lib/client/store";
import { useTick } from "@/lib/client/useWork";
import type { Task } from "@/lib/work/types";
import { ago, useStats } from "@/lib/client/useStats";

const deptColor = (d?: string) => (d ? DEPT_BY_ID[d as keyof typeof DEPT_BY_ID]?.color : undefined) ?? "#94a3b8";
const eur = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";
export const Demo = () => <span className="ml-1 rounded bg-amber-400/15 px-1 text-[9px] font-bold text-amber-300">DÉMO</span>;

export function Card({ title, right, children, className = "" }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-white/10 bg-[#0d1426]/85 p-3 backdrop-blur ${className}`}>
      <div className="mb-2 flex items-center justify-between"><h3 className="font-display text-[13px] font-semibold text-white">{title}</h3>{right}</div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- Feed
export function Feed() {
  const feed = useApp((s) => s.feed);
  const f = useApp((s) => s.feedFilter);
  const w = getWorld();
  const items = feed.filter((i) => (!f.dept || i.dept === f.dept) && (!f.platform || i.platform === f.platform) && (f.residentId === null || i.residentId === f.residentId));
  const setF = (p: Partial<typeof f>) => setState((s) => ({ feedFilter: { ...s.feedFilter, ...p } }));
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap gap-1.5 pb-2">
        <select aria-label="Filtrer par département" value={f.dept} onChange={(e) => setF({ dept: e.target.value })} className="rounded-md border border-white/10 bg-slate-900 px-1.5 py-1 text-xs">
          <option value="">Tous départements</option>
          {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select aria-label="Filtrer par plateforme" value={f.platform} onChange={(e) => setF({ platform: e.target.value })} className="rounded-md border border-white/10 bg-slate-900 px-1.5 py-1 text-xs">
          <option value="">Toutes plateformes</option>
          {["tiktok", "instagram", "youtube", "x", "email"].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        {f.residentId !== null && <button onClick={() => setF({ residentId: null })} className="rounded-md bg-white/10 px-2 text-xs">{w.residents[f.residentId].first} ✕</button>}
      </div>
      <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 text-[12.5px]" data-testid="feed">
        {items.map((i) => (
          <li key={`${i.taskId ?? i.text}-${i.kind}-${i.ts}`} className="group flex gap-2 rounded-md px-1.5 py-1 hover:bg-white/5">
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-slate-500">{fmtTime(i.ts)}</span>
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: i.kind === "life" ? "#fff" : deptColor(i.dept) }} />
            <button className="text-left leading-snug text-slate-300 group-hover:text-white" onClick={() => i.residentId !== undefined && setState({ selected: { type: "resident", id: i.residentId }, follow: true })}>
              {i.kind === "done" && <span className="text-emerald-400">✓ </span>}
              {i.text}{i.demo && <Demo />}
            </button>
          </li>
        ))}
        {!items.length && <li className="text-slate-500">Aucune activité pour ce filtre.</li>}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------- Dashboard (REAL data: Metricool + Gmail/Beacons)
export function Dashboard() {
  useTick(5000);
  const stats = useStats();
  const tasks = useApp((s) => s.tasks);
  const contents = useApp((s) => s.contents);
  const now = simNow();
  const c = parisClock(now);
  const dayStart = tsOf(c.day, 0);
  const doneToday = tasks.filter((t) => !t.demo && t.end <= now && t.end >= dayStart).length;
  const p = stats?.platforms ?? {};
  const followers = Object.values(p).reduce((a, x) => a + (x.followers ?? 0), 0);
  const views = Object.values(p).reduce((a, x) => a + (x.views ?? 0), 0);
  const scheduled = (stats?.scheduled ?? []).filter((x) => Date.parse(x.at) > Date.now()).length;
  const kpis: [string, string][] = [
    ["Vues (30 j)", views.toLocaleString("fr-FR")],
    ["Abonnés", followers.toLocaleString("fr-FR")],
    ["Revenus", eur(stats?.revenue.total ?? 0)],
    ["Ventes", String(stats?.revenue.sales.length ?? 0)],
    ["TikTok vues", (p.tiktok?.views ?? 0).toLocaleString("fr-FR")],
    ["Insta vues", (p.instagram?.views ?? 0).toLocaleString("fr-FR")],
    ["Programmés", String(scheduled || contents.filter((x) => x.publishAt > Date.now() && x.publishAt < 4e12).length)],
    ["Tâches auj.", String(doneToday)],
  ];
  return (
    <Card title="Tableau de bord" right={<span className="text-[10px] text-emerald-400">● réel · {stats ? ago(stats.updatedAt) : "…"}</span>}>
      <div className="grid grid-cols-4 gap-1.5" data-testid="dashboard">
        {kpis.map(([k, v]) => (
          <div key={k} className="rounded-lg bg-white/[0.04] px-2 py-1.5">
            <div className="truncate text-[10px] text-slate-400">{k}</div>
            <div className="font-display text-[15px] font-semibold tabular-nums text-white">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-[11px] text-slate-400">Sources : {stats?.source ?? "…"} · coût IA : 0 € (abonnement Claude)</div>
    </Card>
  );
}

// ---------------------------------------------------------------- Economy
export function Economy() {
  useTick(10000);
  const c = parisClock(simNow());
  const e = useMemo(() => economyAt(c.day, c.dow, c.minute), [c.day, Math.floor(c.minute / 5)]); // eslint-disable-line react-hooks/exhaustive-deps
  const max = Math.max(1, ...e.shops.map((s) => s.revenue));
  return (
    <Card title="Économie de la ville" right={<span className="text-[10px] text-slate-500">simulation</span>}>
      <div className="mb-2 grid grid-cols-2 gap-1.5">
        <div className="rounded-lg bg-white/[0.04] px-2 py-1.5"><div className="text-[10px] text-slate-400">PIB du jour</div><div className="font-display text-[15px] font-semibold text-white">{eur(e.gdpToday)}</div></div>
        <div className="rounded-lg bg-white/[0.04] px-2 py-1.5"><div className="text-[10px] text-slate-400">Argent en circulation</div><div className="font-display text-[15px] font-semibold text-white">{eur(e.moneySupply)}</div></div>
      </div>
      <ul className="space-y-1" data-testid="shops">
        {e.shops.map((s) => (
          <li key={s.name} className="text-[11.5px]">
            <div className="flex justify-between"><span className="text-slate-300">{s.name}</span><span className="tabular-nums text-slate-400">{eur(s.revenue)} · {s.price.toFixed(2)} € <span className={s.trend > 0 ? "text-rose-400" : s.trend < 0 ? "text-emerald-400" : "text-slate-500"}>{s.trend > 0 ? "▲" : s.trend < 0 ? "▼" : "•"}{Math.abs(s.trend)}%</span></span></div>
            <div className="mt-0.5 h-1 rounded bg-white/5"><div className="h-1 rounded" style={{ width: `${(s.revenue / max) * 100}%`, background: s.color }} /></div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------- Search
export function Search() {
  const [q, setQ] = useState("");
  const contents = useApp((s) => s.contents);
  const tasks = useApp((s) => s.tasks);
  const w = getWorld();
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    const out: { label: string; sub: string; act: () => void }[] = [];
    const now = simNow();
    const vid = s.match(/#?(\d{2,4})/);
    if (vid) {
      const id = `v${vid[1]}`;
      const ts = tasks.filter((t) => t.contentId === id || t.contentId === `c${vid[1]}`);
      for (const t of ts.slice(-6).reverse()) {
        const r = w.residents[t.residentId];
        out.push({ label: `${r.first} ${r.last} — ${t.job}`, sub: `${t.title} · ${t.end <= now ? "terminé" : t.start <= now ? "en cours" : "prévu"}`, act: () => setState({ selected: { type: "resident", id: r.id }, follow: true }) });
      }
      for (const c of contents.filter((c) => String(c.number) === vid[1])) out.push({ label: `#${c.number} ${c.title}`, sub: "contenu", act: () => (location.href = "/gallery") });
    }
    for (const d of DEPARTMENTS) for (const j of d.jobs) if (j.toLowerCase().includes(s)) {
      const team = w.teams[j];
      const busy = tasks.find((t) => t.job === j && t.start <= now && now < t.end);
      out.push({ label: `${j} (${d.name})`, sub: busy ? `${w.residents[busy.residentId].first} : ${busy.title}` : `${team.length} personnes · chef : ${w.residents[team[0]].first}`, act: () => setState({ selected: { type: "resident", id: busy?.residentId ?? team[0] }, follow: true }) });
    }
    for (const r of w.residents) {
      if (`${r.first} ${r.last}`.toLowerCase().includes(s) || r.job.toLowerCase().includes(s)) out.push({ label: `${r.first} ${r.last}`, sub: r.job, act: () => setState({ selected: { type: "resident", id: r.id }, follow: true }) });
      if (out.length > 30) break;
    }
    for (const b of w.buildings) if (b.kind !== "home" && b.name.toLowerCase().includes(s)) out.push({ label: b.name, sub: "lieu", act: () => setState({ selected: { type: "building", id: b.id }, focus: { x: b.x + b.w / 2, y: b.y + b.h / 2 } }) });
    return out.slice(0, 12);
  }, [q, contents, tasks, w]);
  return (
    <div className="relative w-full max-w-md">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Qui fait quoi ? métier, nom, vidéo #142…" aria-label="Recherche" data-testid="search"
        className="w-full rounded-xl border border-white/15 bg-[#0d1426]/90 px-3 py-2 text-sm text-white placeholder:text-slate-500 shadow-lg outline-none backdrop-blur focus:border-orange-400/60" />
      {results.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-white/10 bg-[#0d1426] p-1 shadow-2xl">
          {results.map((r, i) => (
            <li key={i}><button onClick={() => { r.act(); setQ(""); }} className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-white/5"><div className="text-sm text-white">{r.label}</div><div className="truncate text-xs text-slate-400">{r.sub}</div></button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Replay
export function ReplayBar() {
  useTick(500);
  const live = useApp((s) => s.live);
  const speed = useApp((s) => s.speed);
  const c = parisClock(simNow());
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-[#0d1426]/90 px-2.5 py-1.5 text-xs backdrop-blur" data-testid="replay">
      <button onClick={goLive} className={`rounded-md px-2 py-1 font-semibold ${live ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 hover:bg-white/15"}`}>● Direct</button>
      <button onClick={() => startReplay(tsOf(parisClock(Date.now()).day, 0), 120)} className="rounded-md bg-white/10 px-2 py-1 hover:bg-white/15">Rejouer aujourd&apos;hui</button>
      <button onClick={() => startReplay(tsOf(parisClock(Date.now()).day - 1, 0), 240)} className="rounded-md bg-white/10 px-2 py-1 hover:bg-white/15">Hier</button>
      <label className="flex items-center gap-1 text-slate-400">vitesse
        <select value={speed} onChange={(e) => startReplay(simNow(), Number(e.target.value))} className="rounded bg-slate-900 px-1 py-0.5 text-white">
          {[1, 30, 60, 120, 240, 600].map((s) => <option key={s} value={s}>×{s}</option>)}
        </select>
      </label>
      <input type="range" min={0} max={1439} value={Math.floor(c.minute)} aria-label="Heure"
        onChange={(e) => startReplay(tsOf(c.day, Number(e.target.value)), live ? 60 : speed)} className="w-28 accent-orange-500 sm:w-40" />
    </div>
  );
}

// ---------------------------------------------------------------- Resident card
function Bar({ label, v, color }: { label: string; v: number; color: string }) {
  return (
    <div className="text-[11px]"><div className="flex justify-between text-slate-400"><span>{label}</span><span className="tabular-nums">{v}</span></div>
      <div className="h-1.5 rounded bg-white/5"><div className="h-1.5 rounded" style={{ width: `${v}%`, background: color }} /></div></div>
  );
}

export function ResidentCard({ id }: { id: number }) {
  useTick(1000);
  const tasks = useApp((s) => s.tasks);
  const follow = useApp((s) => s.follow);
  const w = getWorld();
  const r = w.residents[id];
  const now = simNow();
  const c = parisClock(now);
  const cur = tasks.find((t) => t.residentId === id && t.start <= now && now < t.end);
  const s = stateAt(r, c.day, c.dow, c.minute, cur && r.workplace !== undefined ? { building: r.workplace, since: Math.max(0, (cur.start - (now - c.minute * 60000)) / 60000) } : undefined);
  const sched = scheduleFor(r, c.day, c.dow);
  const hist = tasks.filter((t) => t.residentId === id && t.end <= now).slice(-8).reverse();
  const dept = r.dept ? DEPT_BY_ID[r.dept] : undefined;
  const team = r.job && w.teams[r.job];
  const lead = team ? w.residents[team[0]] : undefined;
  const money = balanceOf(r.salary, r.initialMoney, c.day - 20393) - sched.filter((e) => e.spend && e.start <= c.minute).reduce((a, e) => a + e.spend!.amount, 0);
  const pct = cur ? Math.round(((now - cur.start) / (cur.end - cur.start)) * 100) : 0;
  return (
    <div className="space-y-3 text-sm" data-testid="resident-card">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-base font-bold text-slate-900" style={{ background: r.color }}>{r.first[0]}{r.last[0]}</div>
        <div className="min-w-0">
          <div className="font-display text-base font-semibold text-white">{r.first} {r.last} <span className="text-xs font-normal text-slate-400">{r.age} ans</span></div>
          <div className="text-xs" style={{ color: dept?.color ?? "#cbd5e1" }}>{r.job}{dept ? ` · ${dept.name}` : ""}{r.lead ? " · chef d'équipe" : ""}{r.nightShift ? " · équipe de nuit" : ""}</div>
          <div className="text-xs text-slate-400">{s.activity} · {w.buildings[s.place].name}</div>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setState({ follow: !follow })} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${follow ? "bg-orange-500 text-white" : "bg-white/10"}`}>{follow ? "◉ Caméra suivie" : "Suivre la caméra"}</button>
        <button onClick={() => setState((st) => ({ feedFilter: { ...st.feedFilter, residentId: id } }))} className="rounded-lg bg-white/10 px-2.5 py-1 text-xs">Son activité</button>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5" data-testid="current-task">
        <div className="text-[11px] uppercase tracking-wider text-slate-500">Tâche en cours</div>
        {cur ? (<>
          <div className="mt-0.5 text-white">{r.first} — {cur.job} — {cur.title}, {pct} %{cur.demo && <Demo />}</div>
          <div className="mt-1 h-1.5 rounded bg-white/10"><div className="h-1.5 rounded bg-orange-400 transition-all" style={{ width: `${pct}%` }} /></div>
        </>) : <div className="mt-0.5 text-slate-400">{r.dept ? "Aucune tâche assignée pour l'instant." : "Pas de rôle dans le pipeline (métier de la ville)."}</div>}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <Bar label="Faim (satiété)" v={s.needs.faim} color="#f59e0b" />
        <Bar label="Énergie" v={s.needs.énergie} color="#22c55e" />
        <Bar label="Social" v={s.needs.social} color="#38bdf8" />
        <Bar label="Fun" v={s.needs.fun} color="#a78bfa" />
        <Bar label="Humeur" v={s.needs.humeur} color="#f472b6" />
        <div className="text-[11px] text-slate-400">Compte<div className="font-display text-sm text-white">{eur(money)}</div></div>
      </div>
      <details open className="group">
        <summary className="cursor-pointer text-[11px] uppercase tracking-wider text-slate-500">Emploi du temps du jour</summary>
        <ol className="mt-1 space-y-0.5 text-[12px]">
          {sched.map((e, i) => {
            const active = e.start <= c.minute && (sched[i + 1]?.start ?? 1440) > c.minute;
            return <li key={i} className={`flex gap-2 ${active ? "text-orange-300" : "text-slate-400"}`}><span className="w-10 font-mono tabular-nums">{String(Math.floor(e.start / 60)).padStart(2, "0")}:{String(Math.floor(e.start % 60)).padStart(2, "0")}</span><span>{e.activity}{e.spend ? ` (−${e.spend.amount.toFixed(2)} € · ${SHOPS[e.spend.shop].name})` : ""}</span></li>;
          })}
        </ol>
      </details>
      {r.dept && (
        <details open>
          <summary className="cursor-pointer text-[11px] uppercase tracking-wider text-slate-500">Historique & productions</summary>
          <ul className="mt-1 space-y-1 text-[12px]">
            {hist.map((t) => <li key={t.id} className="text-slate-300"><span className="font-mono text-slate-500">{fmtTime(t.end)}</span> {t.title}{t.output && <span className="ml-1 rounded bg-white/10 px-1 text-[10px]">{t.output.label}</span>}{t.demo && <Demo />}</li>)}
            {!hist.length && <li className="text-slate-500">Rien de terminé dans les 10 dernières heures.</li>}
          </ul>
        </details>
      )}
      <div className="text-[12px]">
        <div className="text-[11px] uppercase tracking-wider text-slate-500">Relations</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {lead && lead.id !== r.id && <button onClick={() => setState({ selected: { type: "resident", id: lead.id } })} className="rounded bg-white/10 px-1.5 py-0.5">chef : {lead.first}</button>}
          {r.friends.map((f) => <button key={f} onClick={() => setState({ selected: { type: "resident", id: f } })} className="rounded bg-white/5 px-1.5 py-0.5 text-slate-300 hover:bg-white/10">{w.residents[f].first}</button>)}
        </div>
      </div>
      <div className="text-[12px] text-slate-400">Personnalité : {Object.entries(r.traits).map(([k, v]) => `${k} ${Math.round(v * 100)}`).join(" · ")}</div>
      <Chat id={id} />
    </div>
  );
}

function Chat({ id }: { id: number }) {
  const [msgs, setMsgs] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!q.trim()) return;
    const next = [...msgs, { role: "user" as const, content: q }];
    setMsgs(next); setQ(""); setBusy(true);
    try {
      const now = simNow();
      const c = parisClock(now);
      const r = getWorld().residents[id];
      const s = stateAt(r, c.day, c.dow, c.minute);
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ residentId: id, activity: s.activity, messages: next }) });
      const j = await res.json();
      setMsgs([...next, { role: "assistant", content: j.text }]);
    } finally { setBusy(false); }
  };
  return (
    <div className="rounded-lg border border-white/10 p-2">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">Parler à cet habitant</div>
      <div className="mt-1 max-h-40 space-y-1 overflow-y-auto text-[12.5px]">
        {msgs.map((m, i) => <div key={i} className={m.role === "user" ? "text-orange-200" : "text-slate-200"}>{m.role === "user" ? "Vous : " : ""}{m.content}</div>)}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="mt-1 flex gap-1">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Dis bonjour…" className="min-w-0 flex-1 rounded-md bg-slate-900 px-2 py-1 text-xs outline-none" />
        <button disabled={busy} className="rounded-md bg-orange-500 px-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? "…" : "Envoyer"}</button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- Building card
export function BuildingCard({ id }: { id: number }) {
  useTick(2000);
  const tasks = useApp((s) => s.tasks);
  const w = getWorld();
  const b = w.buildings[id];
  const now = simNow();
  const c = parisClock(now);
  const inside = w.residents.filter((r) => { const s = stateAt(r, c.day, c.dow, c.minute, undefined, false); return s.place === id && !s.traveling; });
  const deptTasks: Task[] = b.dept ? tasks.filter((t) => t.dept === b.dept) : [];
  const active = deptTasks.filter((t) => t.start <= now && now < t.end);
  const queue = deptTasks.filter((t) => t.start > now).slice(0, 8);
  const doneToday = deptTasks.filter((t) => t.end <= now && t.end >= tsOf(c.day, 0)).length;
  const shop = b.shopIndex !== undefined ? economyAt(c.day, c.dow, c.minute).shops.find((s) => s.name === b.name) : undefined;
  return (
    <div className="space-y-3 text-sm" data-testid="building-card">
      <div>
        <div className="font-display text-base font-semibold text-white">{b.name}</div>
        <div className="text-xs text-slate-400">{inside.length} personne(s) à l&apos;intérieur</div>
      </div>
      {b.dept && (
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="rounded-lg bg-white/5 p-1.5"><div className="text-[10px] text-slate-400">En cours</div><div className="font-display text-white">{active.length}</div></div>
          <div className="rounded-lg bg-white/5 p-1.5"><div className="text-[10px] text-slate-400">En file</div><div className="font-display text-white">{queue.length}</div></div>
          <div className="rounded-lg bg-white/5 p-1.5"><div className="text-[10px] text-slate-400">Finies auj.</div><div className="font-display text-white">{doneToday}</div></div>
        </div>
      )}
      {shop && <div className="rounded-lg bg-white/5 p-2 text-xs text-slate-300">Chiffre d&apos;affaires du jour : <b className="text-white">{eur(shop.revenue)}</b> · {shop.visits} ventes · prix {shop.price.toFixed(2)} €</div>}
      {active.length > 0 && (
        <div><div className="text-[11px] uppercase tracking-wider text-slate-500">Ce qu&apos;ils font</div>
          <ul className="mt-1 space-y-1 text-[12px]">{active.map((t) => <li key={t.id}><button className="text-left text-slate-200 hover:text-white" onClick={() => setState({ selected: { type: "resident", id: t.residentId }, follow: true })}><b>{w.residents[t.residentId].first}</b> ({t.job}) — {t.title}{t.demo && <Demo />}</button></li>)}</ul>
        </div>
      )}
      {queue.length > 0 && (
        <div><div className="text-[11px] uppercase tracking-wider text-slate-500">File d&apos;attente</div>
          <ul className="mt-1 space-y-0.5 text-[12px] text-slate-400">{queue.map((t) => <li key={t.id}><span className="font-mono">{fmtTime(t.start)}</span> {t.job} — {t.title}</li>)}</ul>
        </div>
      )}
      <div><div className="text-[11px] uppercase tracking-wider text-slate-500">Présents</div>
        <div className="mt-1 flex flex-wrap gap-1">{inside.slice(0, 60).map((r) => <button key={r.id} onClick={() => setState({ selected: { type: "resident", id: r.id } })} className="rounded px-1.5 py-0.5 text-[11px] text-slate-900" style={{ background: r.color }}>{r.first}</button>)}{inside.length > 60 && <span className="text-xs text-slate-500">+{inside.length - 60}</span>}</div>
      </div>
    </div>
  );
}

export { needsAt };
