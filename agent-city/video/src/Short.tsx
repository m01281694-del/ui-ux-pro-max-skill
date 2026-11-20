import React, { useMemo } from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { loadFont as loadGrotesk } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import * as THREE from "three";

const { fontFamily: DISPLAY } = loadGrotesk("normal", { weights: ["700"], subsets: ["latin"] });
const { fontFamily: BODY } = loadInter("normal", { weights: ["600", "800"], subsets: ["latin"] });

export type Word = { text: string; start: number; end: number; scene: number };
export type SceneT = { id: string; start: number; end: number };
export type ShortProps = {
  id: string;
  voiceSrc: string;
  handle: string;
  brand: { navy: string; navyDeep: string; orange: string; white: string };
  scenes: { id: string; screen: string; visual: string; sfx: string; phone?: string[] }[];
  timing: { duration: number; words: Word[]; scenes: SceneT[] };
};

// ---------------------------------------------------------------- 3D background
const Field: React.FC<{ t: number; sceneIdx: number; brand: ShortProps["brand"]; visual: string; local: number }> = ({ t, sceneIdx, brand, visual, local }) => {
  const cubes = useMemo(() => {
    const out: { p: [number, number, number]; s: number; r: number; o: boolean }[] = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 140; i++) out.push({ p: [(rnd() - 0.5) * 16, (rnd() - 0.5) * 28, -rnd() * 40], s: 0.15 + rnd() * 0.55, r: rnd() * 6, o: rnd() < 0.28 });
    return out;
  }, []);
  // camera: dolly forward continuously, with a different angle per scene (visual change every cut)
  const camZ = 12 - t * 0.9;
  const ang = [0, 0.35, -0.3, 0.25, -0.2, 0.15, 0][sceneIdx % 7];
  const punch = interpolate(local, [0, 0.25], [1.5, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const orange = new THREE.Color(brand.orange), white = new THREE.Color(brand.white), navy = new THREE.Color(brand.navy);
  const bars = visual === "chart-up";
  return (
    <>
      <ambientLight intensity={0.55} />
      <pointLight position={[4, 6, camZ + 2]} intensity={60} color={orange} />
      <pointLight position={[-5, -4, camZ - 6]} intensity={40} color={white} />
      <group position={[0, 0, 0]} rotation={[0, ang + t * 0.02, ang * 0.3]}>
        {cubes.map((c, i) => (
          <mesh key={i} position={[c.p[0], c.p[1] + Math.sin(t * 0.8 + i) * 0.3, c.p[2] + (camZ < c.p[2] ? 40 : 0)]} rotation={[t * 0.6 + c.r, t * 0.4 + c.r, 0]} scale={c.s * (1 + punch * 0.4)}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={c.o ? orange : navy.clone().lerp(white, 0.25)} emissive={c.o ? orange : navy} emissiveIntensity={c.o ? 0.9 : 0.25} roughness={0.35} metalness={0.4} />
          </mesh>
        ))}
      </group>
      {bars && (
        <group position={[0, -2.6, camZ - 14]} rotation={[0.25, -0.45 + local * 0.08, 0]} scale={0.8}>
          {[0.5, 0.8, 1.2, 1.9, 3.1].map((h, i) => {
            const grow = interpolate(local, [0.15 + i * 0.18, 0.6 + i * 0.18], [0.01, h * 1.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.6)) });
            return (
              <mesh key={i} position={[(i - 2) * 1.25, grow / 2, 0]}>
                <boxGeometry args={[0.9, grow, 0.9]} />
                <meshStandardMaterial color={i === 4 ? orange : white} emissive={i === 4 ? orange : navy} emissiveIntensity={i === 4 ? 1 : 0.2} />
              </mesh>
            );
          })}
        </group>
      )}
    </>
  );
};

const Camera: React.FC<{ t: number }> = ({ t }) => {
  // @remotion/three gives R3F's default camera; we move it via a tiny helper
  return <perspectiveCamera position={[0, 0, 12 - t * 0.9]} />;
};

// ---------------------------------------------------------------- foreground pieces
const Kinetic: React.FC<{ text: string; local: number; dur: number; brand: ShortProps["brand"]; explode?: boolean }> = ({ text, local, dur, brand, explode }) => {
  const { fps } = useVideoConfig();
  const f = local * fps;
  const words = text.split(" ");
  const out = explode ? interpolate(local, [dur - 0.25, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  return (
    <div style={{ position: "absolute", top: 360, left: 70, right: 70, perspective: 1200, textAlign: "center" }}>
      {words.map((w, i) => {
        const s = spring({ frame: f - i * 3, fps, config: { damping: 11, stiffness: 160, mass: 0.6 } });
        const isNum = !explode && (/^\d/.test(w) || w === "·");
        const hl = /SECONDE|SCROLLER|RÉSULTAT|TEMPS|TEXTE|PORTÉE|BIO|MILLIONS|REEL|MOT-CLÉ|CRÉNEAU|RÉSEAUX|GO|SEULEMENT|1|2|3/.test(w);
        const dir = (i % 2 ? 1 : -1) * (1 + i * 0.3);
        return (
          <span key={i} style={{
            display: "inline-block", margin: "0 14px", fontFamily: DISPLAY, fontWeight: 700, fontSize: isNum ? 150 : 118, lineHeight: 1.04, letterSpacing: -3,
            color: hl ? brand.orange : brand.white,
            textShadow: `0 10px 0 ${brand.navyDeep}, 0 0 50px ${hl ? brand.orange + "88" : "#ffffff44"}`,
            transform: `translate3d(${out * dir * 600}px, ${(1 - s) * 140 - out * 300 * Math.sin(i)}px, ${(1 - s) * -900 + out * 600}px) rotateX(${(1 - s) * 70}deg) rotateZ(${out * dir * 25}deg) scale(${0.6 + s * 0.4 + out * 0.6})`,
            opacity: Math.min(1, s * 1.4) * (1 - out),
          }}>{w}</span>
        );
      })}
    </div>
  );
};

const Phone: React.FC<{ local: number; brand: ShortProps["brand"]; labels?: string[] }> = ({ local, brand, labels }) => {
  const y = interpolate(local, [0.3, 1.2, 2.2, 3.1, 4.2, 5.2], [0, -400, -400, -800, -800, -1200], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const enter = interpolate(local, [0, 0.35], [600, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.4)) });
  const cards = ["#3b5998", brand.orange, "#2a9d8f", "#6d28d9", "#e11d48", brand.navy];
  return (
    <div style={{ position: "absolute", left: 370, top: 700, width: 340, height: 580, borderRadius: 52, background: "#0b0f1a", border: `10px solid ${brand.white}`, overflow: "hidden", transform: `translateY(${enter}px) rotateY(-14deg) rotateX(6deg)`, boxShadow: `0 40px 120px ${brand.orange}55` }}>
      <div style={{ transform: `translateY(${y}px)` }}>
        {cards.map((c, i) => (
          <div key={i} style={{ height: 400, margin: 0, background: `linear-gradient(160deg, ${c}, #0b0f1a)`, display: "flex", alignItems: "flex-end", padding: 30, fontFamily: BODY, fontWeight: 800, fontSize: 34, color: "#fff" }}>{labels?.[i] ?? (i === 0 ? "Salut tout le monde…" : i === 1 ? "Le résultat en 1 s ⚡" : "scroll")}</div>
        ))}
      </div>
    </div>
  );
};

const NumberBadge: React.FC<{ n: number; local: number; brand: ShortProps["brand"] }> = ({ n, local, brand }) => {
  const { fps } = useVideoConfig();
  const s = spring({ frame: local * fps, fps, config: { damping: 9, stiffness: 120 } });
  return (
    <div style={{ position: "absolute", left: 390, top: 820, width: 300, height: 300, perspective: 900 }}>
      <div style={{ width: "100%", height: "100%", borderRadius: 48, background: `linear-gradient(145deg, ${brand.orange}, #b4532f)`, display: "grid", placeItems: "center", fontFamily: DISPLAY, fontWeight: 700, fontSize: 220, color: brand.white, transform: `rotateY(${(1 - s) * 180 + Math.sin(local * 2) * 12}deg) rotateX(${Math.cos(local * 2) * 8}deg) scale(${s})`, boxShadow: `0 30px 90px ${brand.orange}99, inset 0 -18px 0 #0000002a` }}>{n}</div>
    </div>
  );
};

const Reveal: React.FC<{ local: number; dur: number; brand: ShortProps["brand"]; handle: string }> = ({ local, dur, brand, handle }) => {
  const r = interpolate(local, [0, 0.6], [0, 1300], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const flash = interpolate(local, [dur - 0.4, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <>
      <div style={{ position: "absolute", left: 540 - r / 2, top: 1050 - r / 2, width: r, height: r, borderRadius: "50%", border: `6px solid ${brand.orange}`, boxShadow: `0 0 80px ${brand.orange}`, opacity: 0.7 }} />
      <div style={{ position: "absolute", top: 900, width: "100%", textAlign: "center", fontFamily: BODY, fontWeight: 800, fontSize: 52, color: brand.white, opacity: interpolate(local, [0.4, 0.8], [0, 1], { extrapolateRight: "clamp" }) }}>Formation <span style={{ color: brand.orange }}>ELM</span> · @{handle}</div>
      <AbsoluteFill style={{ background: brand.white, opacity: flash * 0.9 }} />
    </>
  );
};

// ---------------------------------------------------------------- karaoke subtitles
const Captions: React.FC<{ t: number; words: Word[]; brand: ShortProps["brand"] }> = ({ t, words, brand }) => {
  const idx = words.findIndex((w) => t >= w.start && t < w.end + 0.08);
  const cur = idx >= 0 ? idx : words.findIndex((w) => w.start > t) - 1;
  if (cur < 0) return null;
  // groups of up to 4 words, same scene
  const g0 = cur - (cur % 4);
  const group = words.slice(g0, g0 + 4).filter((w) => w.scene === words[cur].scene);
  return (
    <div style={{ position: "absolute", top: 1330, left: 90, right: 150, textAlign: "center", fontFamily: BODY, fontWeight: 800, fontSize: 66, lineHeight: 1.15 }}>
      {group.map((w, i) => {
        const active = g0 + i === cur;
        const pop = active ? interpolate(t - w.start, [0, 0.08, 0.16], [0.9, 1.12, 1], { extrapolateRight: "clamp" }) : 1;
        return (
          <span key={i} style={{ display: "inline-block", margin: "0 10px", padding: "2px 12px", borderRadius: 14, color: active ? brand.navyDeep : brand.white, background: active ? brand.orange : "transparent", transform: `scale(${pop})`, WebkitTextStroke: active ? undefined : `2px ${brand.navyDeep}`, textShadow: active ? undefined : `0 6px 0 ${brand.navyDeep}` }}>
            {w.text}
          </span>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------- composition
export const Short: React.FC<ShortProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const { brand, timing } = p;
  // scene boundaries: each scene starts when its first word starts (hook at 0)
  const starts = timing.scenes.map((s, i) => (i === 0 ? 0 : s.start - 0.06));
  let si = 0;
  for (let i = 0; i < starts.length; i++) if (t >= starts[i]) si = i;
  const sceneStart = starts[si];
  const sceneEnd = si + 1 < starts.length ? starts[si + 1] : timing.duration + 0.6;
  const local = t - sceneStart;
  const dur = sceneEnd - sceneStart;
  const sc = p.scenes[si];
  const flash = interpolate(local, [0, 0.07], [0.55, 0], { extrapolateRight: "clamp" });
  const zoom = 1 + interpolate(local, [0, 0.3], [0.06, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const voiced = timing.words.some((w) => t >= w.start - 0.05 && t <= w.end + 0.1);
  const listN = sc.visual.startsWith("list-") ? Number(sc.visual.slice(5)) : 0;

  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 50% 30%, ${brand.navy} 0%, ${brand.navyDeep} 65%, #070f24 100%)` }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        <ThreeCanvas width={width} height={height} camera={{ fov: 55, position: [0, 0, 12] }}>
          <CameraRig t={t} />
          <Field t={t} sceneIdx={si} brand={brand} visual={sc.visual} local={local} />
        </ThreeCanvas>
        <AbsoluteFill style={{ background: "linear-gradient(180deg, #070f2466 0%, transparent 30%, transparent 60%, #070f24cc 100%)" }} />
        <Kinetic key={si} text={sc.screen} local={local} dur={dur} brand={brand} explode={sc.visual === "title-explode"} />
        {sc.visual === "phone-scroll" && <Phone local={local} brand={brand} labels={sc.phone} />}
        {listN > 0 && <NumberBadge n={listN} local={local} brand={brand} />}
        {sc.visual === "reveal-loop" && <Reveal local={local} dur={dur} brand={brand} handle={p.handle} />}
      </AbsoluteFill>
      <Captions t={t} words={timing.words} brand={brand} />
      {/* progress & handle (kept away from platform UI zones) */}
      <div style={{ position: "absolute", top: 150, left: 70, fontFamily: BODY, fontWeight: 600, fontSize: 30, color: "#ffffffcc" }}>@{p.handle}</div>
      <div style={{ position: "absolute", top: 196, left: 70, width: 300, height: 6, borderRadius: 3, background: "#ffffff22" }}>
        <div style={{ width: `${Math.min(1, t / timing.duration) * 100}%`, height: 6, borderRadius: 3, background: brand.orange }} />
      </div>
      <AbsoluteFill style={{ background: "#fff", opacity: flash }} />
      {/* audio */}
      <Audio src={staticFile(p.voiceSrc)} />
      <Audio src={staticFile("sfx/music.mp3")} volume={(f) => { const tt = f / fps; const sp = timing.words.some((w) => tt >= w.start - 0.05 && tt <= w.end + 0.15); return sp ? 0.16 : 0.42; }} />
      {starts.map((s, i) => (
        <Sequence key={i} from={Math.max(0, Math.round(s * fps) - (p.scenes[i].sfx === "whoosh" ? 4 : 0))} durationInFrames={Math.round(1.6 * fps)}>
          <Audio src={staticFile(`sfx/${p.scenes[i].sfx}.mp3`)} volume={p.scenes[i].sfx === "whoosh" ? 0.5 : 0.7} />
        </Sequence>
      ))}
      {voiced ? null : null}
    </AbsoluteFill>
  );
};

import { useThree } from "@react-three/fiber";
const CameraRig: React.FC<{ t: number }> = ({ t }) => {
  const cam = useThree((s) => s.camera);
  cam.position.set(Math.sin(t * 0.4) * 0.6, Math.cos(t * 0.3) * 0.4, 12 - t * 0.9);
  cam.lookAt(0, 0, -t * 0.9 - 10);
  return null;
};
void Camera;
