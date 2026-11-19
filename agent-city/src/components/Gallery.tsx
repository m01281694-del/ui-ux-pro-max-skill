"use client";
import { useEffect, useState } from "react";
import Shell from "./Shell";
import { Demo } from "./Panels";
import { simNow, useApp } from "@/lib/client/store";
import { useTick, useWorkSync } from "@/lib/client/useWork";
import { fmtTime } from "@/lib/sim/clock";
import type { Content } from "@/lib/work/types";

const FLOW = ["brouillon", "validé", "programmé", "publié", "analysé"] as const;
function statusOf(c: Content, now: number): (typeof FLOW)[number] {
  const done = c.stages.filter((s) => s.at <= now).map((s) => s.stage);
  if (done.includes("analysé") || done.includes("leçon")) return "analysé";
  if (done.includes("publié")) return "publié";
  if (done.includes("programmé")) return "programmé";
  if (done.includes("approbation")) return "validé";
  return "brouillon";
}

export default function Gallery() {
  useWorkSync();
  useTick(5000);
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  const contents = useApp((s) => s.contents);
  const now = simNow();
  const list = contents.filter((c) => c.created <= now);
  return (
    <Shell>
      <div className="absolute inset-0 overflow-y-auto p-4">
        <div className="mx-auto max-w-6xl">
          <h1 className="font-display text-xl font-semibold text-white">Galerie de production</h1>
          <p className="mt-1 text-sm text-slate-400">Vidéos, carrousels et newsletters, du brouillon à l&apos;analyse. Les éléments <b className="text-amber-300">DÉMO</b> seront remplacés par les vraies productions dès la Phase 2.</p>
          {m && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="gallery">
              {list.map((c) => {
                const st = statusOf(c, now);
                const idx = FLOW.indexOf(st);
                return (
                  <article key={c.id} className="overflow-hidden rounded-xl border border-white/10 bg-[#0d1426]">
                    <div className={`relative grid place-items-center bg-gradient-to-br from-indigo-900 via-slate-900 to-orange-900/60 ${c.kind === "video" ? "aspect-[9/12]" : "aspect-[4/3]"}`}>
                      {c.media ? <video src={c.media.video} poster={c.media.cover} controls playsInline preload="none" className="absolute inset-0 h-full w-full bg-black object-contain" /> : <div className="px-6 text-center font-display text-lg font-bold leading-tight text-white">{c.hook}</div>}
                      <span className="absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] uppercase text-white">{c.kind} #{c.number}</span>
                      {c.demo ? <span className="absolute right-2 top-2"><Demo /></span> : <span className="absolute right-2 top-2 rounded bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white">RÉEL</span>}
                    </div>
                    <div className="space-y-2 p-3">
                      <div className="text-sm font-semibold text-white">{c.title}</div>
                      {c.caption && <div className="text-[11px] text-slate-300">{c.caption}</div>}
                      <div className="text-[11px] text-slate-400">Tendance : {c.trend} · {c.publishAt > 4e12 ? "non programmée" : `publication ${fmtTime(c.publishAt)}`}{c.brandScore ? ` · Brand Check ${c.brandScore}/100` : ""}</div>
                      <ol className="flex gap-1 text-[10px]">
                        {FLOW.map((f, i) => <li key={f} className={`flex-1 rounded px-1 py-0.5 text-center ${i <= idx ? "bg-orange-500/80 text-white" : "bg-white/5 text-slate-500"}`}>{f}</li>)}
                      </ol>
                      {c.stats && idx >= 3 && (
                        <div className="grid grid-cols-4 gap-1 text-center text-[11px]">
                          {[["vues", c.stats.views], ["likes", c.stats.likes], ["partages", c.stats.shares], ["rétention", c.stats.retention + " %"]].map(([k, v]) => (
                            <div key={k as string} className="rounded bg-white/5 py-1"><div className="text-slate-500">{k}</div><div className="text-white tabular-nums">{typeof v === "number" ? v.toLocaleString("fr-FR") : v}</div></div>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
