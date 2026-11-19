"use client";
import dynamic from "next/dynamic";
import Shell from "./Shell";
const BrainView = dynamic(() => import("./BrainView"), { ssr: false, loading: () => <div className="grid h-full place-items-center bg-[#050816] text-sky-200/60">Le cerveau se réveille…</div> });
export default function BrainPage() { return <Shell><BrainView /></Shell>; }
