"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import Shell from "./Shell";
import OrgChart from "./OrgChart";
import { BuildingCard, Card, Dashboard, Economy, Feed, ReplayBar, ResidentCard, Search } from "./Panels";
import { setState, useApp } from "@/lib/client/store";
import { useWorkSync } from "@/lib/client/useWork";

const CityCanvas = dynamic(() => import("./CityCanvas"), { ssr: false, loading: () => <div className="grid h-full place-items-center text-slate-500">Chargement de la ville…</div> });

type Tab = "map" | "feed" | "dash" | "org";

export default function CityView() {
  useWorkSync();
  const sel = useApp((s) => s.selected);
  const [tab, setTab] = useState<Tab>("map");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <Shell><div className="grid h-full place-items-center text-slate-500">Chargement de la ville…</div></Shell>;
  const zoom = (k: "zoomIn" | "zoomOut") => (window as unknown as { __city?: Record<string, () => void> }).__city?.[k]();

  const left = (
    <div className="flex flex-col gap-3">
      <Dashboard />
      <Card title="Organigramme" right={<span className="text-[10px] text-slate-500">Research → … → The loop</span>}><OrgChart /></Card>
      <Economy />
    </div>
  );

  return (
    <Shell>
      <div className="absolute inset-0 flex">
        <aside className="hidden w-[340px] shrink-0 overflow-y-auto border-r border-white/10 p-3 lg:block">{left}</aside>
        <div className="relative min-w-0 flex-1">
          <CityCanvas />
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-3"><div className="pointer-events-auto w-full max-w-md"><Search /></div></div>
          <div className="absolute right-3 top-16 flex flex-col gap-1 sm:top-3">
            <button aria-label="Zoomer" onClick={() => zoom("zoomIn")} className="h-8 w-8 rounded-lg border border-white/10 bg-[#0d1426]/90 text-lg">+</button>
            <button aria-label="Dézoomer" onClick={() => zoom("zoomOut")} className="h-8 w-8 rounded-lg border border-white/10 bg-[#0d1426]/90 text-lg">−</button>
          </div>
          <div className="absolute bottom-16 left-3 right-3 flex justify-center lg:bottom-3"><ReplayBar /></div>
          {sel && (
            <div className="absolute bottom-0 left-0 right-0 z-20 max-h-[70%] overflow-y-auto rounded-t-2xl border border-white/10 bg-[#0b1222]/95 p-4 shadow-2xl backdrop-blur sm:bottom-auto sm:left-3 sm:right-auto sm:top-16 sm:max-h-[calc(100%-130px)] sm:w-[380px] sm:rounded-2xl">
              <button aria-label="Fermer" onClick={() => setState({ selected: null, follow: false })} className="absolute right-3 top-3 text-slate-400 hover:text-white">✕</button>
              {sel.type === "resident" ? <ResidentCard id={sel.id} /> : <BuildingCard id={sel.id} />}
            </div>
          )}
          {/* mobile panels */}
          {tab !== "map" && (
            <div className="absolute inset-0 z-10 overflow-y-auto bg-[#070b16]/97 p-3 lg:hidden">
              {tab === "feed" && <div className="h-full"><Feed /></div>}
              {tab === "dash" && <div className="flex flex-col gap-3"><Dashboard /><Economy /></div>}
              {tab === "org" && <Card title="Organigramme"><OrgChart /></Card>}
            </div>
          )}
          <nav className="absolute inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-white/10 bg-[#0a0f1f] text-xs lg:hidden">
            {([["map", "Carte"], ["feed", "Fil"], ["dash", "Tableau"], ["org", "Organigramme"]] as [Tab, string][]).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`py-3 ${tab === k ? "text-orange-400" : "text-slate-400"}`}>{l}</button>
            ))}
          </nav>
        </div>
        <aside className="hidden w-[360px] shrink-0 flex-col border-l border-white/10 p-3 lg:flex">
          <h2 className="mb-2 font-display text-[13px] font-semibold text-white">Fil d&apos;activité en direct</h2>
          <div className="min-h-0 flex-1"><Feed /></div>
        </aside>
      </div>
    </Shell>
  );
}
