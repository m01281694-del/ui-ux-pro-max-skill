"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { parisClock } from "@/lib/sim/clock";
import { simNow, useApp } from "@/lib/client/store";
import { useTick } from "@/lib/client/useWork";

const NAV = [
  { href: "/city", label: "Ville" },
  { href: "/brain", label: "Cerveau" },
  { href: "/gallery", label: "Galerie" },
  { href: "/messages", label: "Messages" },
  { href: "/system", label: "Système" },
];

export function Clock() {
  useTick(1000);
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  const live = useApp((s) => s.live);
  const speed = useApp((s) => s.speed);
  if (!m) return <div className="w-12 sm:w-40" />;
  const c = parisClock(simNow());
  const d = new Date(c.day * 86400000).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return (
    <div className="flex items-center gap-2 font-mono text-sm tabular-nums" data-testid="clock">
      <span className="hidden text-slate-400 md:inline">{d}</span>
      <span className="text-white">{c.label}</span>
      {live ? <span className="flex items-center gap-1 text-xs text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /><span className="hidden sm:inline">DIRECT</span></span>
        : <span className="text-xs text-amber-400">REPLAY ×{speed}</span>}
    </div>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="flex h-dvh flex-col bg-[var(--bg)] text-slate-200">
      <header className="flex h-12 shrink-0 items-center gap-2 sm:gap-3 border-b border-white/10 bg-[#0a0f1f]/90 px-3 backdrop-blur">
        <Link href="/city" className="flex items-center gap-2 font-display text-[15px] font-bold tracking-tight text-white">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-orange-500 text-[11px] text-white">AC</span>
          <span className="hidden sm:inline">Agent City</span>
        </Link>
        <nav className="flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none]">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`rounded-md px-1.5 py-1 text-[13px] sm:px-2.5 sm:text-sm transition-colors ${path?.startsWith(n.href) ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}>{n.label}</Link>
          ))}
        </nav>
        <div className="ml-auto hidden shrink-0 items-center gap-2 sm:flex sm:gap-3">
          <Clock />
        </div>
      </header>
      <main className="relative min-h-0 flex-1">{children}</main>
    </div>
  );
}
