"use client";
// « Cerveau » — Obsidian-like 3D knowledge galaxy (3d-force-graph + bloom).
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { marked } from "marked";
import { CLUSTERS, demoNotes, demoNoteText, type GNode } from "@/lib/brain/demo";
import { simNow, useApp } from "@/lib/client/store";
import { useTick, useWorkSync } from "@/lib/client/useWork";
import { getWorld } from "@/lib/sim/world";
import { fmtTime } from "@/lib/sim/clock";

type Link = { source: string | GNode; target: string | GNode };
const COLORS: Record<string, string> = {
  Tendances: "#7dd3fc", Hooks: "#c4b5fd", Concurrents: "#fda4af", Audience: "#86efac", Vidéos: "#fde68a", Leçons: "#ffffff",
  Ventes: "#fcd34d", Formats: "#a5b4fc", Système: "#93c5fd", Incidents: "#fb7185", Plateformes: "#67e8f9", "Agent City": "#ffffff",
};
const LEARNING_JOBS = new Set(["Loop Feeder", "Trend Scout", "Competitor Watch", "Comment Miner", "Audience Listener", "Post Analyst", "FAQ Builder", "Weekly Report"]);

function labelSprite(text: string, color: string) {
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  const fs = 64;
  ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`;
  c.width = Math.ceil(ctx.measureText(text).width) + 40; c.height = fs + 30;
  ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = color; ctx.textBaseline = "middle";
  ctx.shadowColor = "#000"; ctx.shadowBlur = 12;
  ctx.fillText(text, 20, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(c.width / 5, c.height / 5, 1);
  return s;
}

export default function BrainView() {
  useWorkSync();
  useTick(2000);
  const host = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [real, setReal] = useState<{ nodes: GNode[]; links: Link[] } | null>(null);
  const [showDemo] = useState(false); // real notes only
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [atTime, setAtTime] = useState<number | null>(null); // timeline cursor (null = now)
  const [sel, setSel] = useState<GNode | null>(null);
  const [note, setNote] = useState<{ html: string; links: string[]; fm: Record<string, unknown> } | null>(null);
  const [q, setQ] = useState("");
  const [stats, setStats] = useState({ notes: 0, links: 0, lessons: 0, exps: 0 });
  const tasks = useApp((s) => s.tasks);

  useEffect(() => { fetch("/api/brain").then((r) => r.json()).then(setReal); }, []);

  // build data for the current cursor
  const data = useMemo(() => {
    if (!real) return null;
    const t = atTime ?? Date.now();
    const d = showDemo ? demoNotes(t) : { nodes: [], links: [] };
    const nodes = [...real.nodes.map((n) => ({ ...n })), ...d.nodes].filter((n) => n.created <= t || n.type === "hub");
    const ids = new Set(nodes.map((n) => n.id));
    const links = [...real.links.map((l) => ({ ...l })), ...d.links].filter((l) => ids.has(l.source as string) && ids.has(l.target as string));
    const deg = new Map<string, number>();
    for (const l of links) for (const k of [l.source as string, l.target as string]) deg.set(k, (deg.get(k) ?? 0) + 1);
    for (const n of nodes) n.degree = deg.get(n.id) ?? 0;
    return { nodes, links };
  }, [real, showDemo, atTime]);

  // init graph once
  useEffect(() => {
    if (!data || graphRef.current || !host.current) return;
    let disposed = false;
    (async () => {
      const ForceGraph3D = (await import("3d-force-graph")).default;
      if (disposed) return;
      const el = host.current!;
      const geo = new THREE.SphereGeometry(1, 10, 10);
      const mats = new Map<string, THREE.MeshBasicMaterial>();
      const mat = (cluster: string, dim: boolean) => {
        const k = cluster + dim;
        if (!mats.has(k)) mats.set(k, new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS[cluster] ?? "#bfdbfe").multiplyScalar(dim ? 0.35 : 0.62), transparent: true, opacity: dim ? 0.5 : 0.9 }));
        return mats.get(k)!;
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const G: any = (new ForceGraph3D(el, { controlType: "orbit" }) as any)
        .backgroundColor("#050816")
        .showNavInfo(false)
        .nodeId("id")
        .nodeLabel((n: GNode) => `${n.demo ? "[DÉMO] " + demoNoteText(n) : n.id}`)
        .nodeThreeObject((n: GNode) => {
          const hub = n.type === "hub";
          const size = hub ? (n.id === "Agent City" ? 9 : 6.5) : 0.55 + Math.min(2.4, Math.log2(1 + n.degree) * 0.55);
          const m = new THREE.Mesh(geo, hub ? new THREE.MeshBasicMaterial({ color: COLORS[n.id] ?? "#e0f2fe" }) : mat(n.cluster, n.confidence < 0.35));
          m.scale.setScalar(size);
          m.userData.base = size;
          if (hub) {
            const s = labelSprite(n.id, COLORS[n.id] ?? "#e0f2fe");
            s.position.set(0, 2.6, 0);
            s.scale.multiplyScalar(1 / size);
            m.add(s);
          }
          return m;
        })
        .linkColor(() => "#5b7fd6")
        .linkOpacity(0.07)
        .linkWidth(0)
        .linkDirectionalParticleColor(() => "#e0f2fe")
        .linkDirectionalParticleWidth(1.6)
        .linkDirectionalParticleSpeed(0.012)
        .onNodeClick((n: GNode) => setSel(n))
        .cooldownTicks(220)
        .warmupTicks(40);
      G.d3Force("charge")?.strength(-18);
      G.d3Force("link")?.distance((l: { target: GNode; source: GNode }) => (l.target.type === "hub" || l.source.type === "hub" ? 38 : 14));

      // stars background
      const starGeo = new THREE.BufferGeometry();
      const pos = new Float32Array(6000 * 3);
      for (let i = 0; i < 6000; i++) { const r = 1400 + Math.random() * 1600, t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1); pos.set([r * Math.sin(p) * Math.cos(t), r * Math.sin(p) * Math.sin(t), r * Math.cos(p)], i * 3); }
      starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      G.scene().add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9cc7ff, size: 2.2, sizeAttenuation: true, transparent: true, opacity: 0.6 })));
      G.scene().fog = new THREE.FogExp2(0x050816, 0.00055);
      G.scene().background = new THREE.Color("#050816");

      const bloom = new UnrealBloomPass(new THREE.Vector2(el.clientWidth, el.clientHeight), 0.95, 0.4, 0.18);
      G.postProcessingComposer().addPass(bloom);
      G.postProcessingComposer().addPass(new OutputPass());
      G.width(el.clientWidth).height(el.clientHeight);
      const onResize = () => G.width(el.clientWidth).height(el.clientHeight);
      window.addEventListener("resize", onResize);

      // pin hubs on a sphere → galaxies
      const placeHubs = (nodes: GNode[]) => {
        CLUSTERS.forEach((c, i) => {
          const n = nodes.find((x) => x.id === c);
          if (!n) return;
          const phi = Math.acos(1 - (2 * (i + 0.5)) / CLUSTERS.length), th = Math.PI * (1 + Math.sqrt(5)) * i;
          const R = 260;
          n.fx = R * Math.sin(phi) * Math.cos(th); n.fy = R * Math.sin(phi) * Math.sin(th) * 0.7; n.fz = R * Math.cos(phi);
        });
        const root = nodes.find((x) => x.id === "Agent City");
        if (root) { root.fx = 0; root.fy = 0; root.fz = 0; }
      };
      placeHubs(data.nodes);
      // spawn non-hub nodes near their hub so galaxies form fast
      const hubPos = new Map(data.nodes.filter((n) => n.type === "hub").map((n) => [n.id, n]));
      for (const n of data.nodes) if (n.type !== "hub") { const h = hubPos.get(n.cluster); if (h) { n.x = (h.fx ?? 0) + (Math.random() - 0.5) * 60; n.y = (h.fy ?? 0) + (Math.random() - 0.5) * 60; n.z = (h.fz ?? 0) + (Math.random() - 0.5) * 60; } }
      G.graphData(data);
      G.cameraPosition({ x: 0, y: 160, z: 1250 });

      // slow auto-rotation + birth flashes + particles on "used" knowledge
      let angle = 0, raf = 0, lastPulse = 0;
      const controls = G.controls() as { addEventListener: (e: string, f: () => void) => void };
      let userActive = 0;
      controls.addEventListener("start", () => { userActive = performance.now(); });
      const loop = () => {
        raf = requestAnimationFrame(loop);
        const now = performance.now();
        if (now - userActive > 6000) {
          angle += 0.0009;
          const cam = G.camera().position;
          const d = Math.hypot(cam.x, cam.z);
          G.camera().position.set(d * Math.sin(angle), cam.y, d * Math.cos(angle));
          G.camera().lookAt(0, 0, 0);
        } else angle = Math.atan2(G.camera().position.x, G.camera().position.z);
        for (const n of G.graphData().nodes as GNode[]) {
          if (!n.__born) continue;
          const t = (now - n.__born) / 1000;
          const o = (n as unknown as { __threeObj?: THREE.Object3D }).__threeObj;
          if (o) o.scale.setScalar(((o.userData.base as number) ?? 1) * (1 + 5 * Math.exp(-t * 1.6)));
          if (t > 4) delete n.__born;
        }
        if (now - lastPulse > 700) {
          lastPulse = now;
          const ls = G.graphData().links as Link[];
          for (let k = 0; k < 4 && ls.length; k++) G.emitParticle(ls[Math.floor(Math.random() * ls.length)]);
        }
      };
      loop();
      graphRef.current = G;
      (window as unknown as { __brainReady: boolean }).__brainReady = true;
      graphRef.current.__cleanup = () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
    })();
    return () => { disposed = true; };
  }, [data]);

  // incremental updates: births & timeline
  useEffect(() => {
    const G = graphRef.current;
    if (!G || !data) return;
    const cur = G.graphData() as { nodes: GNode[]; links: Link[] };
    const curIds = new Set(cur.nodes.map((n) => n.id));
    const nextIds = new Set(data.nodes.map((n) => n.id));
    const added = data.nodes.filter((n) => !curIds.has(n.id));
    const removed = cur.nodes.some((n) => !nextIds.has(n.id));
    if (!added.length && !removed) return;
    if (removed || added.length > 400) {
      const hubs = new Map(cur.nodes.filter((n) => n.type === "hub").map((n) => [n.id, n]));
      for (const n of data.nodes) { const h = hubs.get(n.type === "hub" ? n.id : n.cluster); if (n.type === "hub" && h) { n.fx = h.fx; n.fy = h.fy; n.fz = h.fz; } else if (h) { n.x = (h.fx ?? 0) + (Math.random() - 0.5) * 50; n.y = (h.fy ?? 0) + (Math.random() - 0.5) * 50; n.z = (h.fz ?? 0) + (Math.random() - 0.5) * 50; } }
      G.graphData(data);
      return;
    }
    const byId = new Map(cur.nodes.map((n) => [n.id, n]));
    for (const n of added) { const h = byId.get(n.cluster); n.x = h?.fx ?? 0; n.y = h?.fy ?? 0; n.z = h?.fz ?? 0; n.__born = performance.now(); }
    const links = data.links.filter((l) => added.some((a) => a.id === l.source || a.id === l.target)).map((l) => ({ source: l.source, target: l.target }));
    G.graphData({ nodes: [...cur.nodes, ...added], links: [...cur.links, ...links] });
  }, [data]);

  useEffect(() => () => { graphRef.current?.__cleanup?.(); graphRef.current?._destructor?.(); }, []);

  // filters
  useEffect(() => { graphRef.current?.nodeVisibility((n: GNode) => !hidden.has(n.cluster)); }, [hidden]);

  // counters
  useEffect(() => {
    if (!data) return;
    setStats({ notes: data.nodes.length, links: data.links.length, lessons: data.nodes.filter((n) => n.cluster === "Leçons" && n.type !== "hub" && n.confidence >= 0.7).length, exps: Math.max(0, Math.floor(data.nodes.length / 900)) });
  }, [data]);

  // note panel
  useEffect(() => {
    if (!sel) { setNote(null); return; }
    if (sel.demo) { setNote({ html: `<h1>${demoNoteText(sel)}</h1><p><em>Note de démonstration — sera remplacée par de vraies notes écrites par les agents.</em></p>`, links: [sel.cluster], fm: { type: sel.type, confiance: sel.confidence, auteur: sel.author } }); return; }
    fetch(`/api/brain?id=${encodeURIComponent(sel.id)}`).then((r) => r.json()).then((j) => {
      const md = String(j.content).replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (_: string, a: string, __: string, b: string) => `<a data-wiki="${a}" class="wiki">${b ?? a}</a>`);
      setNote({ html: marked.parse(md, { async: false }) as string, links: j.links, fm: j.frontmatter });
    });
  }, [sel]);

  const focusNode = (id: string) => {
    const G = graphRef.current;
    const n = (G?.graphData().nodes as GNode[] | undefined)?.find((x) => x.id === id || x.id.toLowerCase().includes(id.toLowerCase()));
    if (!n || n.x === undefined) return;
    const d = 70, r = 1 + d / Math.hypot(n.x!, n.y!, n.z!);
    G.cameraPosition({ x: n.x! * r, y: n.y! * r, z: n.z! * r }, n, 1400);
    setSel(n);
  };

  const now = simNow();
  const learning = tasks.filter((t) => LEARNING_JOBS.has(t.job));
  const running = learning.filter((t) => t.start <= now && now < t.end);
  const finished = learning.filter((t) => t.end <= now);
  const w = getWorld();
  const minT = Date.UTC(2026, 10, 5);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(ellipse_at_center,#0b1a3a_0%,#050816_70%)]">
      <div ref={host} className="absolute inset-0" data-testid="brain-canvas" />
      {/* top-left: counters & filters */}
      <div className="absolute left-3 top-3 w-[260px] space-y-2 text-xs">
        <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-white/10 bg-[#081028]/80 p-2 backdrop-blur" data-testid="brain-stats">
          {[["Notes", stats.notes], ["Liens", stats.links], ["Leçons validées", stats.lessons], ["Expériences", stats.exps]].map(([k, v]) => (
            <div key={k as string}><div className="text-[10px] text-sky-200/60">{k}</div><div className="font-display text-lg text-white tabular-nums">{(v as number).toLocaleString("fr-FR")}</div></div>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && focusNode(q)} placeholder="Chercher une note… (Entrée)" className="w-full rounded-lg border border-white/10 bg-[#081028]/80 px-2.5 py-1.5 text-white outline-none placeholder:text-sky-200/40" />
        <div className="hidden flex-wrap gap-1 rounded-xl border border-white/10 bg-[#081028]/80 p-2 backdrop-blur sm:flex">
          {CLUSTERS.map((c) => (
            <button key={c} onClick={() => setHidden((h) => { const n = new Set(h); n.has(c) ? n.delete(c) : n.add(c); return n; })}
              className={`rounded-full border px-2 py-0.5 ${hidden.has(c) ? "border-white/10 text-white/30" : "border-white/20 text-white"}`} style={{ boxShadow: hidden.has(c) ? undefined : `inset 0 0 0 1px ${COLORS[c]}33` }}>
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: COLORS[c] }} />{c}
            </button>
          ))}
        </div>
      </div>
      {/* timeline */}
      <div className="absolute bottom-[86px] left-1/2 w-[min(560px,92%)] -translate-x-1/2 rounded-xl border border-white/10 bg-[#081028]/80 px-3 py-2 text-xs text-sky-100/80 backdrop-blur">
        <div className="flex justify-between"><span>Comment le cerveau a grandi</span><span className="font-mono">{atTime ? new Date(atTime).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" }) : "maintenant"}</span></div>
        <input type="range" min={minT} max={Date.now()} step={3600000} value={atTime ?? Date.now()} aria-label="Timeline du cerveau"
          onChange={(e) => { const v = Number(e.target.value); setAtTime(v >= Date.now() - 3600000 ? null : v); }} className="w-full accent-sky-400" />
      </div>
      {/* bottom band: learning tasks */}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 overflow-x-auto border-t border-white/10 bg-[#050a1c]/90 px-3 py-2 text-xs backdrop-blur" data-testid="learning-band">
        <span className="shrink-0 font-semibold text-sky-200">Apprentissage</span>
        {running.slice(0, 4).map((t) => (
          <span key={t.id} className="shrink-0 rounded-lg border border-sky-400/30 bg-sky-400/10 px-2 py-1 text-sky-100">
            <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sky-300" />{w.residents[t.residentId].first} · {t.title.slice(0, 48)} — {Math.round((t.end - now) / 60000)} min{t.demo && <span className="ml-1 text-amber-300">DÉMO</span>}
          </span>
        ))}
        {!running.length && <span className="text-sky-100/50">aucune tâche d&apos;apprentissage en cours</span>}
        <span className="ml-auto shrink-0 text-sky-100/70">Terminées : <b className="text-white">{finished.length}</b> {finished[0] && <span className="text-sky-100/40">· dernière {fmtTime(finished[finished.length - 1].end)}</span>}</span>
      </div>
      {/* note panel (Obsidian-like) */}
      {sel && (
        <aside className="absolute bottom-[140px] right-3 top-3 w-[min(380px,calc(100%-24px))] overflow-y-auto rounded-2xl border border-white/10 bg-[#0a1124]/95 p-4 text-sm shadow-2xl backdrop-blur" data-testid="note-panel">
          <button aria-label="Fermer" onClick={() => setSel(null)} className="float-right text-slate-400 hover:text-white">✕</button>
          <div className="mb-1 flex items-center gap-2 text-[11px] text-sky-200/70">
            <span className="rounded-full px-2 py-0.5" style={{ background: `${COLORS[sel.cluster] ?? "#93c5fd"}22`, color: COLORS[sel.cluster] }}>{sel.cluster}</span>
            {sel.demo && <span className="rounded bg-amber-400/15 px-1 font-bold text-amber-300">DÉMO</span>}
          </div>
          <div className="prose-brain" onClick={(e) => { const a = (e.target as HTMLElement).closest("[data-wiki]"); if (a) focusNode(a.getAttribute("data-wiki")!); }} dangerouslySetInnerHTML={{ __html: note?.html ?? "…" }} />
          <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 border-t border-white/10 pt-2 text-[12px]">
            <dt className="text-slate-500">Écrite par</dt><dd className="text-slate-200">{String(note?.fm.auteur ?? sel.author)}</dd>
            <dt className="text-slate-500">Date</dt><dd className="text-slate-200">{new Date(sel.created).toLocaleDateString("fr-FR")}</dd>
            <dt className="text-slate-500">Confiance</dt><dd className="text-slate-200">{Math.round(sel.confidence * 100)} %</dd>
            <dt className="text-slate-500">Source</dt><dd className="truncate text-slate-200">{sel.source.startsWith("http") ? <a href={sel.source} target="_blank" rel="noreferrer" className="text-sky-300 underline">{new URL(sel.source).hostname}</a> : sel.source}</dd>
          </dl>
          {note && note.links.length > 0 && (
            <div className="mt-3"><div className="text-[11px] uppercase tracking-wider text-slate-500">Liens & backlinks</div>
              <div className="mt-1 flex flex-wrap gap-1">{note.links.map((l) => <button key={l} onClick={() => focusNode(l)} className="rounded bg-white/5 px-1.5 py-0.5 text-[12px] text-sky-200 hover:bg-white/10">{l}</button>)}</div>
            </div>
          )}
          <div className="mt-3 text-[11px] text-slate-500">Vidéos ayant utilisé cette connaissance : apparaîtront ici dès la Phase 2.</div>
        </aside>
      )}
    </div>
  );
}
