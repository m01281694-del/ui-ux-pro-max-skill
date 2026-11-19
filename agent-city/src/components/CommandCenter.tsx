"use client";
// « Centre de commande » — everything real in one glass dashboard (Metricool, Gmail/Beacons, the city, the brain).
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Shell from "./Shell";
import { useStats, ago, type Stats } from "@/lib/client/useStats";
import { useApp } from "@/lib/client/store";
import { useTick, useWorkSync } from "@/lib/client/useWork";
import { getWorld } from "@/lib/sim/world";
import { DEPT_BY_ID } from "@/lib/sim/data";

const MARK = "#D3704F"; // brand orange stepped to pass the dark-surface lightness band (dataviz validator)
const fmt = (n: number) => n.toLocaleString("fr-FR");
const eur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

type S = Stats & {
  daily?: { day: string; tiktokViews: number }[];
  quota?: { elevenlabs: { used: number; limit: number; resetAt: number } };
  goals?: { label: string; current: number; target: number }[];
  platforms: Record<string, { handle: string; followers: number; posts: number; views: number; likes?: number; comments?: number; shares?: number; profileViews?: number }>;
};

function Glass({ title, right, children, className = "", id }: { title?: string; right?: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section data-testid={id} className={`rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-[0_8px_40px_-12px_rgba(0,0,0,.6)] backdrop-blur-xl ${className}`}>
      {title && <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-display text-[13px] font-semibold uppercase tracking-wider text-slate-300">{title}</h2>{right}</div>}
      {children}
    </section>
  );
}

function Kpi({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-[12px] text-slate-400"><span aria-hidden className="grid h-7 w-7 place-items-center rounded-lg bg-orange-500/15 text-[14px]">{icon}</span>{label}</div>
      <div className="mt-2 font-display text-[26px] font-bold leading-none tabular-nums text-white">{value}</div>
      {sub && <div className="mt-1.5 text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

/** Single-series bar chart (TikTok views/day) with hover tooltip; title names the series, so no legend. */
function DailyBars({ data }: { data: { day: string; tiktokViews: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560, H = 190, P = { l: 40, r: 8, t: 14, b: 26 };
  const max = Math.max(1, ...data.map((d) => d.tiktokViews));
  const nice = Math.ceil(max / 1000) * 1000;
  const bw = (W - P.l - P.r) / data.length;
  const y = (v: number) => P.t + (H - P.t - P.b) * (1 - v / nice);
  const best = data.reduce((a, b, i) => (b.tiktokViews > data[a].tiktokViews ? i : a), 0);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Vues TikTok par jour">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={P.l} x2={W - P.r} y1={y(nice * f)} y2={y(nice * f)} stroke="#ffffff" strokeOpacity="0.08" />
            <text x={P.l - 6} y={y(nice * f) + 3} textAnchor="end" fontSize="10" fill="#94a3b8">{fmt(nice * f)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = P.l + i * bw + 3, w = bw - 6, top = y(d.tiktokViews), h = H - P.b - top;
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={P.l + i * bw} y={P.t} width={bw} height={H - P.t - P.b} fill="transparent" />
              <path d={`M${x},${H - P.b} V${top + 4} q0,-4 4,-4 h${w - 8} q4,0 4,4 V${H - P.b} Z`} fill={MARK} opacity={hover === null || hover === i ? 1 : 0.45} />
              {i === best && <text x={x + w / 2} y={top - 5} textAnchor="middle" fontSize="10.5" fill="#e2e8f0" fontWeight="600">{fmt(d.tiktokViews)}</text>}
              <text x={x + w / 2} y={H - 9} textAnchor="middle" fontSize="10" fill="#94a3b8">{d.day.slice(8)}/{d.day.slice(5, 7)}</text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute -translate-x-1/2 rounded-lg border border-white/10 bg-[#0b1530] px-2.5 py-1.5 text-xs shadow-xl" style={{ left: `${((P.l + (hover + 0.5) * bw) / W) * 100}%`, top: 0 }}>
          <div className="text-slate-400">{new Date(data[hover].day).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</div>
          <div className="font-semibold text-white">{fmt(data[hover].tiktokViews)} vues</div>
        </div>
      )}
    </div>
  );
}

function Progress({ label, current, target }: { label: string; current: number; target: number }) {
  const pct = Math.min(100, (current / target) * 100);
  return (
    <div>
      <div className="flex justify-between text-[12.5px]"><span className="text-slate-300">{label}</span><span className="tabular-nums text-white">{fmt(current)} / {fmt(target)}</span></div>
      <div className="mt-1.5 h-2 rounded-full bg-white/10"><div className="h-2 rounded-full" style={{ width: `${Math.max(pct, 1.5)}%`, background: MARK }} /></div>
    </div>
  );
}

function nextRun(now: Date, kind: "daily" | "every3h", hh: number, mm: number) {
  // computed in Europe/Paris wall time
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).map((p) => [p.type, p.value]));
  const cur = +parts.hour * 60 + +parts.minute;
  if (kind === "daily") { const t = hh * 60 + mm; const diff = (t - cur + 1440) % 1440 || 1440; return diff; }
  // every 3h at minute mm (UTC-anchored hours 0,3,6…) — approximate from UTC
  const u = now.getUTCHours() * 60 + now.getUTCMinutes();
  let best = 1e9; for (let h = 0; h < 24; h += 3) { const d = (h * 60 + mm - u + 1440) % 1440; if (d > 0 && d < best) best = d; }
  return best;
}
const inMin = (m: number) => (m < 60 ? `dans ${m} min` : `dans ${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`);

export default function CommandCenter() {
  useWorkSync();
  useTick(30000);
  const s = useStats() as S | null;
  const tasks = useApp((x) => x.tasks);
  const contents = useApp((x) => x.contents);
  const [lessons, setLessons] = useState<{ id: string; confidence: number }[]>([]);
  const [brainCount, setBrainCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    fetch("/api/brain").then((r) => r.json()).then((g: { nodes: { id: string; type: string; created: number; confidence: number }[] }) => {
      setBrainCount(g.nodes.length);
      setLessons(g.nodes.filter((n) => n.type === "leçon").sort((a, b) => b.created - a.created).slice(0, 4));
    });
  }, []);

  const w = getWorld();
  const now = new Date();
  const p = s?.platforms ?? {};
  const totals = useMemo(() => {
    const followers = Object.values(p).reduce((a, x) => a + (x.followers ?? 0), 0);
    const views = Object.values(p).reduce((a, x) => a + (x.views ?? 0), 0);
    const tk = p.tiktok;
    const eng = tk && tk.views ? ((tk.likes ?? 0) + (tk.comments ?? 0) + (tk.shares ?? 0)) / tk.views : 0;
    return { followers, views, eng };
  }, [p]);
  const top = [...(s?.posts ?? [])].sort((a, b) => b.views - a.views).slice(0, 3);
  const recent = [...(s?.posts ?? [])].sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 4);
  const realTasks = tasks.filter((t) => !t.demo);
  const today0 = new Date(); today0.setHours(0, 0, 0, 0);
  const doneToday = realTasks.filter((t) => t.end <= Date.now() && t.end >= today0.getTime());
  const q = s?.quota?.elevenlabs;
  const funnel = [
    { label: "Vues (30 j)", v: totals.views },
    { label: "Visites du profil TikTok", v: p.tiktok?.profileViews ?? 0 },
    { label: "Ventes ELM", v: s?.revenue.sales.length ?? 0 },
  ];
  const fMax = Math.max(1, funnel[0].v);
  const hour = Number(new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "numeric" }).format(now));
  const hello = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  if (!mounted) return <Shell><div className="grid h-full place-items-center text-slate-500">Chargement…</div></Shell>;

  return (
    <Shell>
      <div className="absolute inset-0 overflow-y-auto bg-[radial-gradient(90%_60%_at_10%_0%,#1F3B73_0%,transparent_60%),radial-gradient(60%_50%_at_100%_10%,rgba(217,119,87,.22)_0%,transparent_60%),linear-gradient(180deg,#0F2147_0%,#070f24_100%)]">
        <div className="mx-auto max-w-7xl space-y-4 p-4 pb-16">
          {/* header */}
          <Glass className="relative overflow-hidden">
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-[12px] uppercase tracking-[.2em] text-orange-300">Centre de commande · manu.digital</div>
                <h1 className="mt-1 font-display text-2xl font-bold text-white sm:text-3xl">{hello} Manu 👋</h1>
                <p className="mt-1 text-sm text-slate-300">Ta ville a fait <b className="text-white">{doneToday.length} tâche{doneToday.length > 1 ? "s" : ""}</b> aujourd&apos;hui. Données mises à jour {s ? ago(s.updatedAt) : "…"} (Metricool + Gmail).</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {[
                  ["TikTok", "https://www.tiktok.com/@manu_digi0"], ["Instagram", "https://www.instagram.com/manu.digi0"],
                  ["YouTube", "https://www.youtube.com/channel/UCC2akO2lNGQEjQ_nX3OgI-Q"], ["Beacons", s?.revenue.offer?.url ?? "https://beacons.ai/manu.digital"],
                  ["Metricool", "https://app.metricool.com/planner/calendar?blogId=8094155"],
                ].map(([l, u]) => <a key={l} href={u} target="_blank" rel="noreferrer" className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-slate-200 hover:border-orange-400/60 hover:text-white">{l} ↗</a>)}
                <Link href="/messages" className="rounded-full bg-orange-500 px-3 py-1.5 font-semibold text-white">Répondre aux messages</Link>
              </div>
            </div>
          </Glass>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="kpis">
            <Kpi icon="👥" label="Audience totale" value={fmt(totals.followers)} sub="abonnés TikTok + Insta + YouTube" />
            <Kpi icon="👁" label="Vues (30 j)" value={fmt(totals.views)} sub="toutes plateformes" />
            <Kpi icon="❤️" label="Engagement TikTok" value={`${(totals.eng * 100).toFixed(1)} %`} sub="(likes + comm. + partages) / vues" />
            <Kpi icon="💶" label="Revenus ELM" value={eur(s?.revenue.total ?? 0)} sub={`${s?.revenue.sales.length ?? 0} vente(s) · via Gmail`} />
            <div className="col-span-2 lg:col-span-1"><Kpi icon="🎬" label="Contenus programmés" value={String((s?.scheduled ?? []).filter((x) => Date.parse(x.at) > Date.now()).length)} sub="par la ville, via Metricool" /></div>
          </div>

          {/* platforms + chart */}
          <div className="grid gap-3 lg:grid-cols-5">
            <Glass title="Performance par plateforme" className="lg:col-span-2" id="platforms">
              <div className="grid gap-2.5">
                {[
                  { k: "tiktok", name: "TikTok", tint: "from-[#25F4EE]/20 to-[#FE2C55]/20" },
                  { k: "instagram", name: "Instagram", tint: "from-[#F58529]/20 to-[#DD2A7B]/25" },
                  { k: "youtube", name: "YouTube", tint: "from-[#FF0000]/25 to-[#7f1d1d]/20" },
                ].map(({ k, name, tint }) => {
                  const x = p[k];
                  return (
                    <div key={k} className={`rounded-xl border border-white/10 bg-gradient-to-br ${tint} p-3`}>
                      <div className="flex items-center justify-between"><span className="font-semibold text-white">{name}</span><span className="text-[11px] text-slate-300">{x?.handle}</span></div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                        <div><div className="font-display text-lg font-bold tabular-nums text-white">{fmt(x?.followers ?? 0)}</div><div className="text-[10.5px] text-slate-300">abonnés</div></div>
                        <div><div className="font-display text-lg font-bold tabular-nums text-white">{fmt(x?.views ?? 0)}</div><div className="text-[10.5px] text-slate-300">vues 30 j</div></div>
                        <div><div className="font-display text-lg font-bold tabular-nums text-white">{fmt(x?.posts ?? 0)}</div><div className="text-[10.5px] text-slate-300">publications</div></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Glass>
            <Glass title="Vues TikTok par jour" right={<span className="text-[11px] text-slate-400">survole une barre</span>} className="lg:col-span-3" id="daily">
              {s?.daily?.length ? <DailyBars data={s.daily} /> : <div className="text-sm text-slate-400">Pas encore de données.</div>}
              <details className="mt-2 text-xs text-slate-400"><summary className="cursor-pointer">Voir en tableau</summary>
                <table className="mt-1 w-full"><tbody>{s?.daily?.map((d) => <tr key={d.day} className="border-t border-white/5"><td className="py-0.5">{d.day}</td><td className="text-right tabular-nums text-slate-200">{fmt(d.tiktokViews)}</td></tr>)}</tbody></table>
              </details>
            </Glass>
          </div>

          {/* content row */}
          <div className="grid gap-3 lg:grid-cols-3">
            <Glass title="Contenus récents" right={<Link href="/gallery" className="text-[11px] text-orange-300">Tout voir →</Link>} id="recent">
              <ul className="space-y-2">
                {recent.map((x) => (
                  <li key={x.url}><a href={x.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-white/10 bg-white/[0.04] p-2.5 hover:border-orange-400/50">
                    <div className="truncate text-[13px] text-white">{x.title}</div>
                    <div className="mt-1 flex gap-3 text-[11.5px] text-slate-400"><span>{new Date(x.publishedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}</span><span>👁 {fmt(x.views)}</span><span>❤️ {x.likes}</span><span>💬 {x.comments}</span></div>
                  </a></li>
                ))}
              </ul>
            </Glass>
            <Glass title="Calendrier de la ville" id="calendar">
              <ul className="space-y-2 text-[13px]">
                {(s?.scheduled ?? []).filter((x) => Date.parse(x.at) > Date.now() - 3600000).map((x) => {
                  const c = contents.find((k) => k.id === x.contentId);
                  return (
                    <li key={x.contentId} className="rounded-xl border border-orange-400/30 bg-orange-500/10 p-2.5">
                      <div className="text-[11px] text-orange-200">{new Date(x.at).toLocaleString("fr-FR", { timeZone: "Europe/Paris", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                      <div className="text-white">Publication : {c?.title ?? x.contentId}</div>
                      <div className="text-[11px] text-slate-300">{x.networks.join(" · ")}</div>
                    </li>
                  );
                })}
                {[
                  { n: "Production vidéo", d: nextRun(now, "daily", 6, 47), what: "tendance → script → voix → 3D → contrôle → programmation" },
                  { n: "Stats & revenus", d: nextRun(now, "every3h", 0, 6), what: "Metricool + ventes Beacons (Gmail)" },
                  { n: "Nuit : cerveau", d: nextRun(now, "daily", 3, 17), what: "leçons, Playbook, rapport du lundi" },
                ].sort((a, b) => a.d - b.d).map((r) => (
                  <li key={r.n} className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
                    <div className="flex justify-between"><span className="text-white">{r.n}</span><span className="text-[11px] text-emerald-300">{inMin(r.d)}</span></div>
                    <div className="text-[11px] text-slate-400">{r.what}</div>
                  </li>
                ))}
              </ul>
            </Glass>
            <Glass title="Top contenus" id="top">
              <ol className="space-y-2">
                {top.map((x, i) => (
                  <li key={x.url} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-orange-500 font-display font-bold text-white">{i + 1}</span>
                    <a href={x.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1"><div className="truncate text-[13px] text-white">{x.title}</div><div className="text-[11.5px] text-slate-400">{fmt(x.views)} vues · {x.likes} likes</div></a>
                  </li>
                ))}
              </ol>
            </Glass>
          </div>

          {/* bottom row */}
          <div className="grid gap-3 lg:grid-cols-4">
            <Glass title="Objectifs" id="goals"><div className="space-y-3">{(s?.goals ?? []).map((g) => <Progress key={g.label} {...g} />)}</div></Glass>
            <Glass title="Entonnoir de vente" id="funnel">
              <div className="space-y-2.5">
                {funnel.map((f) => (
                  <div key={f.label}>
                    <div className="flex justify-between text-[12.5px]"><span className="text-slate-300">{f.label}</span><span className="tabular-nums text-white">{fmt(f.v)}</span></div>
                    <div className="mt-1 h-2 rounded-full bg-white/10"><div className="h-2 rounded-full" style={{ width: `${Math.max(1.5, Math.sqrt(f.v / fMax) * 100)}%`, background: MARK }} /></div>
                  </div>
                ))}
                <p className="text-[11px] text-slate-400">Échelle racine carrée pour voir les petites étapes. Les clics vers Beacons ne sont pas mesurés (pas d&apos;API).</p>
              </div>
            </Glass>
            <Glass title="État de la ville" id="city">
              <ul className="space-y-1.5 text-[12.5px]">
                <li className="flex justify-between"><span className="text-slate-300">Tâches réelles aujourd&apos;hui</span><b className="text-white">{doneToday.length}</b></li>
                <li className="flex justify-between"><span className="text-slate-300">Notes dans le cerveau</span><b className="text-white">{brainCount}</b></li>
                <li className="flex justify-between"><span className="text-slate-300">Coût IA</span><b className="text-white">0 €</b></li>
                {q && <li><div className="flex justify-between"><span className="text-slate-300">Voix ElevenLabs (mois)</span><b className="tabular-nums text-white">{fmt(q.limit - q.used)} car. restants</b></div><div className="mt-1 h-1.5 rounded-full bg-white/10"><div className="h-1.5 rounded-full bg-emerald-400" style={{ width: `${((q.limit - q.used) / q.limit) * 100}%` }} /></div><div className="mt-0.5 text-[10.5px] text-slate-400">≈ {Math.floor((q.limit - q.used) / 550)} vidéos possibles</div></li>}
              </ul>
              <div className="mt-3 space-y-1">
                {doneToday.slice(-3).reverse().map((t) => <div key={t.id} className="truncate text-[11.5px] text-slate-400"><span style={{ color: DEPT_BY_ID[t.dept].color }}>●</span> {w.residents[t.residentId].first} ({t.job}) — {t.title}</div>)}
              </div>
              <Link href="/city" className="mt-2 inline-block text-[11px] text-orange-300">Voir la ville →</Link>
            </Glass>
            <Glass title="Ce que la ville a appris" id="lessons">
              <ul className="space-y-2">
                {lessons.map((l) => <li key={l.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-[12.5px] text-slate-200">{l.id}<div className="mt-0.5 text-[10.5px] text-slate-400">confiance {Math.round(l.confidence * 100)} %</div></li>)}
                {!lessons.length && <li className="text-sm text-slate-400">…</li>}
              </ul>
              <Link href="/brain" className="mt-2 inline-block text-[11px] text-orange-300">Ouvrir le cerveau →</Link>
            </Glass>
          </div>
        </div>
      </div>
    </Shell>
  );
}
