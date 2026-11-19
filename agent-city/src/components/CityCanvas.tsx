"use client";
// PixiJS isometric renderer for the 1 000 residents. Life layer is computed client-side (deterministic).
import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import { getWorld, N, BS, type Building } from "@/lib/sim/world";
import { stateAt } from "@/lib/sim/life";
import { parisClock } from "@/lib/sim/clock";
import { activeTaskMap, getState, setState, simNow } from "@/lib/client/store";
import { bubbleFor } from "@/lib/sim/dialogue";

const TW = 32, TH = 16;
const iso = (x: number, y: number) => ({ x: (x - y) * (TW / 2), y: (x + y) * (TH / 2) });
const unIso = (sx: number, sy: number) => ({ x: (sx / (TW / 2) + sy / (TH / 2)) / 2, y: (sy / (TH / 2) - sx / (TW / 2)) / 2 });
const hex = (c: string) => parseInt(c.slice(1), 16);
const shade = (c: number, f: number) => {
  const r = Math.min(255, ((c >> 16) & 255) * f), g = Math.min(255, ((c >> 8) & 255) * f), b = Math.min(255, (c & 255) * f);
  return (r << 16) | (g << 8) | b;
};

export function darkness(hour: number) {
  // 0 = full day, 1 = deep night
  if (hour >= 8 && hour <= 17.5) return 0;
  if (hour > 17.5 && hour < 21.5) return (hour - 17.5) / 4;
  if (hour >= 21.5 || hour < 5.5) return 1;
  return 1 - (hour - 5.5) / 2.5;
}

export default function CityCanvas() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current!;
    const app = new Application();
    let destroyed = false;
    let cleanup = () => {};

    (async () => {
      await app.init({ resizeTo: el, background: "#0a1020", antialias: true, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true });
      if (destroyed) { app.destroy(true); return; }
      el.appendChild(app.canvas);
      const w = getWorld();

      const world = new Container();
      app.stage.addChild(world);
      const ground = new Graphics();
      const scene = new Container();
      scene.sortableChildren = true;
      const lights = new Graphics();
      lights.blendMode = "add";
      const labels = new Container();
      const bubbles = new Container();
      const night = new Graphics().rect(-6000, -3000, 12000, 8000).fill(0x040817);
      world.addChild(ground, scene, night, lights, labels, bubbles);

      // ---------- ground
      const corners = [iso(0, 0), iso(N, 0), iso(N, N), iso(0, N)];
      ground.poly(corners.flatMap((p) => [p.x, p.y])).fill(0x3b4252);
      const blockColor = (b: Building | undefined) => {
        if (!b) return 0x4d7c3a;
        if (b.kind === "park") return 0x2f7d32;
        if (b.kind === "home") return 0x4d7c3a;
        if (b.kind === "office") return 0x64748b;
        return 0x6b7280;
      };
      const byBlock = new Map<string, Building>();
      for (const b of w.buildings) if (b.kind !== "home") byBlock.set(`${Math.floor(b.x / BS)},${Math.floor(b.y / BS)}`, b);
      for (let by = 0; by < (N - 1) / BS; by++)
        for (let bx = 0; bx < (N - 1) / BS; bx++) {
          const x0 = bx * BS + 1, y0 = by * BS + 1, s = BS - 1;
          const pts = [iso(x0, y0), iso(x0 + s, y0), iso(x0 + s, y0 + s), iso(x0, y0 + s)];
          ground.poly(pts.flatMap((p) => [p.x, p.y])).fill(blockColor(byBlock.get(`${bx},${by}`)));
        }
      // road dashes
      for (let i = 0; i <= N - 1; i += BS)
        for (let j = 0; j < N - 1; j += 2) {
          const a = iso(i + 0.5, j + 0.3), b = iso(i + 0.5, j + 1.0);
          ground.moveTo(a.x, a.y).lineTo(b.x, b.y);
          const c = iso(j + 0.3, i + 0.5), d = iso(j + 1.0, i + 0.5);
          ground.moveTo(c.x, c.y).lineTo(d.x, d.y);
        }
      ground.stroke({ width: 1, color: 0x9ca3af, alpha: 0.35 });
      // park trees & paths
      const trees = new Graphics();
      for (const pid of w.park) {
        const b = w.buildings[pid];
        for (let i = 0; i < 26; i++) {
          const tx = b.x + 0.5 + ((i * 37) % 61) / 61 * (b.w - 1), ty = b.y + 0.5 + ((i * 53) % 67) / 67 * (b.h - 1);
          const p = iso(tx, ty);
          trees.circle(p.x, p.y - 9, 6).fill(0x166534).circle(p.x - 2, p.y - 11, 3).fill(0x22c55e);
        }
      }
      for (const b of w.buildings.filter((b) => b.kind === "home")) {
        // tiny garden tree near each house
        const p = iso(b.x + b.w + 0.5, b.y + 0.4);
        trees.circle(p.x, p.y - 6, 4).fill(0x15803d);
      }
      ground.addChild(trees);

      // ---------- buildings
      const buildingGfx: Graphics[] = [];
      for (const b of w.buildings) {
        if (b.kind === "park") continue;
        const g = new Graphics();
        const col = hex(b.color);
        const H = b.height;
        const A = iso(b.x, b.y), B = iso(b.x + b.w, b.y), C = iso(b.x + b.w, b.y + b.h), D = iso(b.x, b.y + b.h);
        if (b.kind === "office") {
          // open-plan floor, low walls at the back, desks visible
          g.poly([A.x, A.y, B.x, B.y, C.x, C.y, D.x, D.y]).fill(0xe2e8f0);
          g.poly([A.x, A.y, B.x, B.y, B.x, B.y - H, A.x, A.y - H]).fill(shade(col, 0.75));
          g.poly([A.x, A.y, D.x, D.y, D.x, D.y - H, A.x, A.y - H]).fill(shade(col, 0.55));
          for (let i = 0; i < 56; i++) {
            const dx = b.x + 0.45 + (i % 8) * 0.85, dy = b.y + 0.45 + Math.floor(i / 8) * 0.85;
            const p = iso(dx + 0.18, dy - 0.18);
            g.poly([p.x - 6, p.y, p.x, p.y - 3, p.x + 6, p.y, p.x, p.y + 3]).fill(0x94a3b8);
          }
          // department sign
          const sign = new Text({ text: b.name.replace("Bureaux ", ""), style: { fontFamily: "Inter, system-ui", fontSize: 13, fontWeight: "700", fill: 0xffffff } });
          sign.anchor.set(0.5);
          sign.position.set((A.x + B.x) / 2 + 20, (A.y + B.y) / 2 - H - 10);
          const pill = new Graphics().roundRect(sign.x - sign.width / 2 - 6, sign.y - 10, sign.width + 12, 20, 10).fill(col);
          labels.addChild(pill, sign);
        } else {
          const top = (p: { x: number; y: number }) => [p.x, p.y - H];
          g.poly([D.x, D.y, C.x, C.y, ...top(C), ...top(D)]).fill(shade(col, 0.72)); // front-left face
          g.poly([C.x, C.y, B.x, B.y, ...top(B), ...top(C)]).fill(shade(col, 0.55)); // front-right face
          g.poly([...top(A), ...top(B), ...top(C), ...top(D)]).fill(b.kind === "home" ? shade(col, 0.9) : shade(col, 1.08));
          if (b.kind === "home") {
            // pitched roof hint
            const mid = iso(b.x + b.w / 2, b.y + b.h / 2);
            g.poly([...top(A), ...top(B), mid.x, mid.y - H - 10]).fill(shade(0xb45309, 0.9));
            g.poly([...top(B), ...top(C), mid.x, mid.y - H - 10]).fill(shade(0xb45309, 0.7));
            g.poly([...top(C), ...top(D), mid.x, mid.y - H - 10]).fill(shade(0xb45309, 0.8));
            g.poly([...top(D), ...top(A), mid.x, mid.y - H - 10]).fill(shade(0xb45309, 1));
          }
          // windows (dark by day)
          const rows = Math.max(1, Math.floor(H / 14));
          for (let rI = 0; rI < rows; rI++)
            for (let k = 1; k < b.w * 2; k += 2) {
              const f = k / (b.w * 2);
              const px = D.x + (C.x - D.x) * f, py = D.y + (C.y - D.y) * f - 8 - rI * 14;
              g.rect(px - 2, py - 4, 4, 5).fill({ color: 0x0f172a, alpha: 0.55 });
            }
          if (b.kind !== "home") {
            const t = new Text({ text: b.name, style: { fontFamily: "Inter, system-ui", fontSize: 11, fontWeight: "600", fill: 0xffffff, stroke: { color: 0x0b1020, width: 3 } } });
            t.anchor.set(0.5);
            const c = iso(b.x + b.w / 2, b.y + b.h / 2);
            t.position.set(c.x, c.y - H - 14);
            labels.addChild(t);
          }
        }
        g.zIndex = b.x + b.w + b.y + b.h - 0.5;
        scene.addChild(g);
        buildingGfx[b.id] = g;
      }

      // ---------- resident sprites
      const body = new Graphics().roundRect(-3, -9, 6, 9, 3).fill(0xffffff).circle(0, -12, 3).fill(0xffffff);
      const tex: Texture = app.renderer.generateTexture({ target: body, resolution: 3 });
      const sprites: Sprite[] = [];
      for (const r of w.residents) {
        const s = new Sprite(tex);
        s.anchor.set(0.5, 1);
        s.tint = hex(r.dept ? r.color : ["#e2e8f0", "#cbd5e1", "#fde68a", "#fecdd3"][r.id % 4]);
        s.eventMode = "none";
        scene.addChild(s);
        sprites.push(s);
      }
      const ring = new Graphics().ellipse(0, 0, 9, 4.5).stroke({ width: 2, color: 0xffffff });
      ring.visible = false;
      world.addChild(ring);
      const taskDot = new Graphics();
      world.addChild(taskDot);

      // ---------- camera
      let scale = Math.max(0.6, Math.min(el.clientWidth / (N * TW) * 2.4, 1.3));
      const center = iso(N / 2, N / 2);
      world.scale.set(scale);
      world.position.set(el.clientWidth / 2 - center.x * scale, el.clientHeight / 2 - center.y * scale);
      const clampScale = (s: number) => Math.max(0.25, Math.min(4, s));
      const zoomAt = (sx: number, sy: number, f: number) => {
        const ns = clampScale(scale * f);
        const wx = (sx - world.x) / scale, wy = (sy - world.y) / scale;
        scale = ns;
        world.scale.set(scale);
        world.position.set(sx - wx * scale, sy - wy * scale);
      };
      const centerOn = (x: number, y: number, s?: number) => {
        if (s) { scale = s; world.scale.set(s); }
        const p = iso(x, y);
        world.position.set(el.clientWidth / 2 - p.x * scale, el.clientHeight / 2 - p.y * scale);
      };
      (window as unknown as { __city: unknown }).__city = { zoomIn: () => zoomAt(el.clientWidth / 2, el.clientHeight / 2, 1.3), zoomOut: () => zoomAt(el.clientWidth / 2, el.clientHeight / 2, 1 / 1.3), centerOn };

      const pointers = new Map<number, { x: number; y: number }>();
      let dragDist = 0;
      let pinch = 0;
      const canvas = app.canvas;
      canvas.style.touchAction = "none";
      const onDown = (e: PointerEvent) => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY }); dragDist = 0; pinch = 0; };
      const onMove = (e: PointerEvent) => {
        const p = pointers.get(e.pointerId);
        if (!p) return;
        if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          const d0 = Math.hypot(a.x - b.x, a.y - b.y);
          pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
          const [c, d] = [...pointers.values()];
          const d1 = Math.hypot(c.x - d.x, c.y - d.y);
          if (pinch && d0 > 0) zoomAt((c.x + d.x) / 2, (c.y + d.y) / 2, d1 / d0);
          pinch++;
          dragDist += 10;
          return;
        }
        const dx = e.offsetX - p.x, dy = e.offsetY - p.y;
        dragDist += Math.abs(dx) + Math.abs(dy);
        world.position.set(world.x + dx, world.y + dy);
        if (dragDist > 6 && getState().follow) setState({ follow: false });
        pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      };
      const onUp = (e: PointerEvent) => {
        pointers.delete(e.pointerId);
        if (dragDist < 6 && pointers.size === 0) pick(e.offsetX, e.offsetY);
      };
      const onWheel = (e: WheelEvent) => { e.preventDefault(); zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015)); };
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
      canvas.addEventListener("wheel", onWheel, { passive: false });

      const lastPos: { x: number; y: number; vis: boolean }[] = w.residents.map(() => ({ x: 0, y: 0, vis: false }));
      function pick(sx: number, sy: number) {
        const wx = (sx - world.x) / scale, wy = (sy - world.y) / scale;
        let best = -1, bd = 14;
        for (let i = 0; i < sprites.length; i++) {
          const s = sprites[i];
          if (!s.visible) continue;
          const d = Math.hypot(s.x - wx, s.y - 6 - wy);
          if (d < bd) { bd = d; best = i; }
        }
        if (best >= 0) { setState({ selected: { type: "resident", id: best } }); return; }
        // buildings: test footprint at several heights (tall faces)
        for (let h = 0; h <= 70; h += 6) {
          const t = unIso(wx, wy + h);
          const b = w.buildings.find((b) => b.kind !== "home" && t.x >= b.x && t.x <= b.x + b.w && t.y >= b.y && t.y <= b.y + b.h && h <= Math.max(b.height, 8));
          if (b) { setState({ selected: { type: "building", id: b.id } }); return; }
        }
        const t = unIso(wx, wy);
        const home = w.buildings.find((b) => b.kind === "home" && t.x >= b.x && t.x <= b.x + b.w && t.y >= b.y && t.y <= b.y + b.h);
        if (home) setState({ selected: { type: "building", id: home.id } });
        else setState({ selected: null });
      }

      // ---------- frame loop
      let lastLights = 0, lastBubbles = 0, taskMapAt = 0;
      let tasks = activeTaskMap([], 0);
      const bubbleTexts: Container[] = [];
      app.ticker.add(() => {
        const now = simNow();
        const c = parisClock(now);
        const st = getState();
        if (now - taskMapAt > 1000 || now < taskMapAt) { tasks = activeTaskMap(st.tasks, now); taskMapAt = now; }
        const occ = new Map<number, number>();
        const dayStart = now - c.minute * 60000;
        for (let i = 0; i < w.residents.length; i++) {
          const r = w.residents[i];
          const t = tasks.get(r.id);
          const ov = t && r.workplace !== undefined ? { building: r.workplace, since: Math.max(0, (t.start - dayStart) / 60000) } : undefined;
          const s = stateAt(r, c.day, c.dow, c.minute, ov, false);
          const p = iso(s.pos.x, s.pos.y);
          const sp = sprites[i];
          sp.visible = s.visible;
          sp.position.set(p.x, p.y);
          sp.zIndex = s.pos.x + s.pos.y;
          lastPos[i] = { x: p.x, y: p.y, vis: s.visible };
          if (!s.traveling && !s.activity.startsWith("dort")) occ.set(s.place, (occ.get(s.place) ?? 0) + 1);
        }
        // selection ring / follow
        const sel = st.selected;
        if (sel?.type === "resident") {
          const lp = lastPos[sel.id];
          ring.visible = true;
          ring.position.set(lp.x, lp.y);
          ring.alpha = lp.vis ? 1 : 0.4;
          if (st.follow) {
            const tx = el.clientWidth / 2 - lp.x * scale, ty = el.clientHeight / 2 - lp.y * scale;
            world.position.set(world.x + (tx - world.x) * 0.12, world.y + (ty - world.y) * 0.12);
          }
        } else ring.visible = false;
        if (st.focus) { centerOn(st.focus.x, st.focus.y, Math.max(scale, 1.4)); setState({ focus: null }); }

        // working residents get a small glowing dot
        taskDot.clear();
        for (const [rid] of tasks) {
          const lp = lastPos[rid];
          if (lp?.vis) taskDot.circle(lp.x, lp.y - 18, 2.2).fill({ color: 0xfbbf24 });
        }

        const dk = darkness(c.hour);
        night.alpha = dk * 0.62;
        night.visible = dk > 0.01;

        if (performance.now() - lastLights > 1500) {
          lastLights = performance.now();
          lights.clear();
          if (dk > 0.05) {
            for (const b of w.buildings) {
              if (b.kind === "park") continue;
              const n = occ.get(b.id) ?? 0;
              const C = iso(b.x + b.w, b.y + b.h), D = iso(b.x, b.y + b.h);
              const open = b.kind !== "home" && b.kind !== "office" && n > 0;
              if (b.kind === "office") {
                                continue;
              }
              const rows = Math.max(1, Math.floor(b.height / 14));
              for (let rI = 0; rI < rows; rI++)
                for (let k = 1; k < b.w * 2; k += 2) {
                  const lit = open || (n > 0 && ((b.id * 7 + k * 3 + rI) % 5) < Math.min(5, n + 1));
                  if (!lit) continue;
                  const f = k / (b.w * 2);
                  const px = D.x + (C.x - D.x) * f, py = D.y + (C.y - D.y) * f - 8 - rI * 14;
                  lights.rect(px - 2, py - 4, 4, 5).fill({ color: 0xffd36b, alpha: 0.95 * dk });
                }
            }
            // street lamps at intersections
            for (let i = 0; i < N; i += BS) for (let j = 0; j < N; j += BS) { const p = iso(i + 0.5, j + 0.5); lights.circle(p.x, p.y, 10).fill({ color: 0xffc56b, alpha: 0.18 * dk }); }
          }
        }
        labels.visible = scale > 0.45;

        // dialogue bubbles (templates — no AI)
        if (performance.now() - lastBubbles > 4500) {
          lastBubbles = performance.now();
          bubbleTexts.forEach((b) => b.destroy({ children: true }));
          bubbleTexts.length = 0;
          if (scale > 0.7) {
            const vx0 = -world.x / scale, vy0 = -world.y / scale, vx1 = vx0 + el.clientWidth / scale, vy1 = vy0 + el.clientHeight / scale;
            const cands: number[] = [];
            for (let i = 0; i < lastPos.length; i++) { const p = lastPos[i]; if (p.vis && p.x > vx0 && p.x < vx1 && p.y > vy0 && p.y < vy1) cands.push(i); }
            const seed = Math.floor(now / 4500);
            for (let k = 0; k < Math.min(5, cands.length); k++) {
              const id = cands[(seed * 31 + k * 97) % cands.length];
              const r = w.residents[id];
              const s = stateAt(r, c.day, c.dow, c.minute, undefined, false);
              const txt = bubbleFor(r, s.activity, tasks.get(id)?.title, seed + k);
              const cont = new Container();
              const t = new Text({ text: txt, style: { fontFamily: "Inter, system-ui", fontSize: 10, fill: 0x0f172a, wordWrap: true, wordWrapWidth: 140 } });
              const bg = new Graphics().roundRect(-6, -4, t.width + 12, t.height + 8, 8).fill({ color: 0xffffff, alpha: 0.95 });
              cont.addChild(bg, t);
              const p = lastPos[id];
              cont.position.set(p.x - 10, p.y - 30 - t.height);
              bubbles.addChild(cont);
              bubbleTexts.push(cont);
            }
          }
        }
        for (const b of bubbleTexts) b.alpha = Math.max(0, 1 - (performance.now() - lastBubbles) / 4500 + 0.2);
      });

      cleanup = () => {
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("wheel", onWheel);
      };
      (window as unknown as { __cityReady: boolean }).__cityReady = true;
    })();

    return () => {
      destroyed = true;
      cleanup();
      try { app.destroy(true, { children: true }); } catch {}
    };
  }, []);

  return <div ref={host} className="absolute inset-0" data-testid="city-canvas" />;
}
