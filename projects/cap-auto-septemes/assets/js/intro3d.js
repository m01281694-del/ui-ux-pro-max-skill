/* =====================================================================
   CAP AUTO — Introduction cinématique 3D (Three.js / WebGL)
   ---------------------------------------------------------------------
   Chargé à la demande par intro.js (jamais sur les autres pages).
   - Coupé sportif générique modélisé en code (aucune marque, aucun fichier
     3D à télécharger) : peinture métallisée vernie, vitrages, jantes,
     étriers, signatures lumineuses.
   - Reflets réels : une caméra cubique suit la voiture et capte les rampes
     lumineuses du décor → les reflets glissent sur la carrosserie.
   - Sol miroir, brouillard, poussière, bloom, format cinéma.
   - 4 plans : gros plan phares → travelling latéral → passage caméra →
     disparition dans l'obscurité, puis révélation du nom.
   - Mode allégé automatique (appareils modestes / images lentes).
   Durée : ~7 s + 0,9 s de transition. Aucun changement d'URL.
   ===================================================================== */
import * as THREE from "../vendor/three/three.module.min.js";
import { EffectComposer } from "../vendor/three/postprocessing/EffectComposer.js";
import { RenderPass } from "../vendor/three/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "../vendor/three/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "../vendor/three/postprocessing/OutputPass.js";
import { Reflector } from "../vendor/three/objects/Reflector.js";

const DURATION = 6.9;          // fin de la séquence filmée
const CUTS = [1.7, 3.5, 5.2];  // changements de plan
const smooth = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, t) => a + (b - a) * t;
const range = (t, a, b) => clamp01((t - a) / (b - a));

/* Position de la voiture (m) : à l'arrêt, accélération, puis vitesse de croisière */
function carX(t) {
  if (t < 1.4) return 0;
  const a = 10, vmax = 28, t0 = 1.4, tv = vmax / a;
  const dt = t - t0;
  if (dt < tv) return 0.5 * a * dt * dt;
  return 0.5 * a * tv * tv + vmax * (dt - tv);
}

/* Texture de halo (dégradé radial) pour les feux et l'ombre de contact */
function radialTexture(inner, outer, size = 128) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ */
/* Modélisation de la voiture                                          */
/* ------------------------------------------------------------------ */
function buildCar(envMap, lite) {
  const car = new THREE.Group();
  const curveSeg = lite ? 32 : 56;

  const paint = new THREE.MeshPhysicalMaterial({
    color: 0x6e0a12, metalness: 0.55, roughness: 0.32,
    clearcoat: 1, clearcoatRoughness: 0.04, envMap, envMapIntensity: 1.8
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x04060a, metalness: 0.3, roughness: 0.16, clearcoat: 1, specularIntensity: 0.35, envMap, envMapIntensity: 0.6
  });
  const black = new THREE.MeshStandardMaterial({ color: 0x07080a, roughness: 0.45, metalness: 0.3, envMap, envMapIntensity: 0.6 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 1, roughness: 0.22, envMap, envMapIntensity: 1.4 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.85, metalness: 0 });
  const caliper = new THREE.MeshStandardMaterial({ color: 0xc8141f, roughness: 0.4, metalness: 0.2 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xe8f1ff, emissiveIntensity: 0 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff1020, emissiveIntensity: 0.6 });

  // Carrosserie : profil latéral extrudé (arches de roues comprises)
  const s = new THREE.Shape();
  s.moveTo(-2.25, 0.27);
  s.lineTo(-1.9, 0.27);
  s.absarc(-1.42, 0.36, 0.47, Math.PI, 0, true);
  s.lineTo(-0.95, 0.27);
  s.lineTo(0.93, 0.27);
  s.absarc(1.4, 0.36, 0.47, Math.PI, 0, true);
  s.lineTo(1.87, 0.27);
  s.lineTo(2.2, 0.29);
  s.bezierCurveTo(2.35, 0.33, 2.39, 0.48, 2.31, 0.57);
  s.bezierCurveTo(2.15, 0.67, 1.6, 0.76, 0.85, 0.83);
  s.lineTo(0.6, 0.85);
  s.bezierCurveTo(-0.4, 0.89, -1.4, 0.93, -1.95, 0.9);
  s.bezierCurveTo(-2.2, 0.89, -2.33, 0.84, -2.35, 0.73);
  s.bezierCurveTo(-2.37, 0.58, -2.34, 0.4, -2.25, 0.27);
  const bodyDepth = 1.7;
  const bodyGeo = new THREE.ExtrudeGeometry(s, {
    depth: bodyDepth, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.07,
    bevelSegments: lite ? 5 : 8, curveSegments: curveSeg
  });
  bodyGeo.translate(0, 0, -bodyDepth / 2);
  bodyGeo.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeo, paint);
  car.add(body);

  // Habitacle vitré (bulle)
  const c = new THREE.Shape();
  c.moveTo(0.8, 0.8);
  c.bezierCurveTo(0.36, 0.98, 0.02, 1.15, -0.36, 1.18);
  c.bezierCurveTo(-0.85, 1.2, -1.35, 1.07, -1.98, 0.86);
  c.lineTo(-1.95, 0.8);
  c.lineTo(0.8, 0.8);
  const cabDepth = 1.26;
  const cabGeo = new THREE.ExtrudeGeometry(c, {
    depth: cabDepth, bevelEnabled: true, bevelThickness: 0.13, bevelSize: 0.05,
    bevelSegments: lite ? 5 : 8, curveSegments: curveSeg
  });
  cabGeo.translate(0, 0, -cabDepth / 2);
  car.add(new THREE.Mesh(cabGeo, glass));

  // Bas de caisse, diffuseur, entrée d'air
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.09, 1.86), black);
  skirt.position.set(0, 0.26, 0);
  car.add(skirt);
  const intake = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 1.1), black);
  intake.position.set(2.33, 0.4, 0);
  car.add(intake);
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 1.4), black);
  diffuser.position.set(-2.33, 0.36, 0);
  car.add(diffuser);

  // Signatures lumineuses
  const glowTex = radialTexture("rgba(255,255,255,1)", "rgba(255,255,255,0)");
  const heads = [], headGlows = [];
  [-1, 1].forEach((side) => {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.46), headMat);
    strip.position.set(2.29, 0.59, side * 0.6);
    strip.rotation.y = side * 0.32;
    car.add(strip);
    heads.push(strip);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xdfeaff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.position.set(2.42, 0.59, side * 0.6);
    sp.scale.set(0.55, 0.26, 1);
    car.add(sp);
    headGlows.push(sp);
  });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.045, 1.72), tailMat);
  tail.position.set(-2.36, 0.77, 0);
  car.add(tail);
  const tailGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff2030, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  tailGlow.position.set(-2.5, 0.77, 0);
  tailGlow.scale.set(2.6, 0.5, 1);
  car.add(tailGlow);

  // Phares : projecteurs qui éclairent la route
  const headSpots = [];
  [-1, 1].forEach((side) => {
    const spot = new THREE.SpotLight(0xe6efff, 0, 40, 0.42, 0.7, 1.4);
    spot.position.set(2.3, 0.6, side * 0.6);
    spot.target.position.set(14, 0, side * 1.2);
    car.add(spot, spot.target);
    headSpots.push(spot);
  });

  // Roues
  const wheels = [];
  const tyreGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.27, lite ? 24 : 48, 1);
  tyreGeo.rotateX(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.28, lite ? 20 : 40, 1);
  rimGeo.rotateX(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(0.05, 0.25, 0.03);
  const discGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.02, 24);
  discGeo.rotateX(Math.PI / 2);
  [[-1.42, 1], [-1.42, -1], [1.4, 1], [1.4, -1]].forEach(([x, side]) => {
    const holder = new THREE.Group();
    holder.position.set(x, 0.36, side * 0.86);
    const spin = new THREE.Group();
    spin.add(new THREE.Mesh(tyreGeo, tyre));
    const rim = new THREE.Mesh(rimGeo, black);
    spin.add(rim);
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Mesh(spokeGeo, rimMat);
      sp.position.z = side * 0.14;
      sp.rotation.z = (i / 5) * Math.PI * 2;
      sp.translateY(0.125);
      spin.add(sp);
    }
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.012, 8, lite ? 24 : 48), rimMat);
    lip.position.z = side * 0.14;
    spin.add(lip);
    holder.add(spin);
    const disc = new THREE.Mesh(discGeo, rimMat);
    disc.position.z = side * 0.06;
    holder.add(disc);
    const cal = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.06), caliper);
    cal.position.set(0.12, 0.14, side * 0.09);
    holder.add(cal);
    car.add(holder);
    wheels.push(spin);
  });

  car.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return { car, wheels, headMat, tailMat, headGlows, tailGlow, headSpots };
}

/* ------------------------------------------------------------------ */
/* Scène                                                               */
/* ------------------------------------------------------------------ */
export async function play({ mount, brand, lite: forceLite, onProgress, onTitle }) {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 8;
  const coarse = matchMedia("(pointer: coarse)").matches;
  let lite = window.__capIntroQuality === "full" ? false : !!forceLite || cores <= 4 || mem <= 4 || (navigator.connection && navigator.connection.saveData);

  const canvas = document.createElement("canvas");
  canvas.className = "intro3d__canvas";
  canvas.setAttribute("aria-hidden", "true");
  mount.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lite, powerPreference: "high-performance", alpha: false });
  const maxDpr = lite ? 1 : coarse ? 1.5 : 1.75;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.setSize(mount.clientWidth, mount.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0;
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, 0.034);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 400);

  // Reflets dynamiques : caméra cubique qui suit la voiture
  const cubeRT = new THREE.WebGLCubeRenderTarget(lite ? 64 : 128, { type: THREE.HalfFloatType, generateMipmaps: false, minFilter: THREE.LinearFilter });
  const cubeCam = new THREE.CubeCamera(0.1, 120, cubeRT);
  cubeCam.children.forEach((c) => c.layers.enable(1));
  scene.add(cubeCam);

  const { car, wheels, headMat, tailMat, headGlows, tailGlow, headSpots } = buildCar(cubeRT.texture, lite);
  scene.add(car);

  // Lumières
  scene.add(new THREE.HemisphereLight(0x8090a8, 0x050505, 0.22));
  const top = new THREE.SpotLight(0xdfe6f2, 0, 30, 0.75, 1, 1.2);
  top.position.set(0, 7, 0);
  scene.add(top, top.target);
  // Lumière principale douce, côté caméra (sculpte les flancs)
  const key = new THREE.SpotLight(0xfff1e6, 0, 40, 0.7, 1, 1.1);
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x9fb4ff, 0);
  rim.position.set(-6, 3, -4);
  scene.add(rim, rim.target);

  // Sol : miroir atténué (mode complet) + revêtement sombre
  let reflector = null;
  if (!lite) {
    reflector = new Reflector(new THREE.PlaneGeometry(600, 60), {
      textureWidth: Math.round(mount.clientWidth * 0.5), textureHeight: Math.round(mount.clientHeight * 0.5), color: 0x8a8a8a, clipBias: 0.003
    });
    reflector.rotation.x = -Math.PI / 2;
    reflector.position.set(150, -0.002, 0);
    scene.add(reflector);
  }
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 60),
    new THREE.MeshStandardMaterial({ color: 0x08090b, roughness: 0.62, metalness: 0.15, transparent: !lite, opacity: lite ? 1 : 0.86 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(150, 0, 0);
  scene.add(ground);

  // Ombre de contact
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 2.6),
    new THREE.MeshBasicMaterial({ map: radialTexture("rgba(0,0,0,0.95)", "rgba(0,0,0,0)"), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.004;
  scene.add(shadow);

  // Marquages au sol (instanciés)
  const dashGeo = new THREE.PlaneGeometry(2.2, 0.08);
  dashGeo.rotateX(-Math.PI / 2);
  const dashCount = 2 * 60;
  const dashes = new THREE.InstancedMesh(dashGeo, new THREE.MeshBasicMaterial({ color: 0x3a3d42 }), dashCount);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 60; i++) {
    m4.makeTranslation(-20 + i * 6, 0.006, 2.1); dashes.setMatrixAt(i * 2, m4);
    m4.makeTranslation(-20 + i * 6, 0.006, -2.1); dashes.setMatrixAt(i * 2 + 1, m4);
  }
  scene.add(dashes);

  // Rampes lumineuses au plafond (visibles + reflétées)
  const barMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  barMat.color.multiplyScalar(lite ? 1.4 : 2.4);
  const barGeo = new THREE.BoxGeometry(0.12, 0.04, 6);
  for (let i = 0; i < 18; i++) {
    const b = new THREE.Mesh(barGeo, barMat);
    b.position.set(-12 + i * 9, 4.4, 0);
    scene.add(b);
  }
  // Panneaux réservés aux reflets (calque 1 : invisibles à l'écran)
  const softMat = new THREE.MeshBasicMaterial({ color: 0x2c323c, side: THREE.DoubleSide });
  const softbox = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), softMat);
  softbox.rotation.x = Math.PI / 2;
  softbox.layers.set(1);
  scene.add(softbox);
  const postMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  postMat.color.multiplyScalar(0.5);
  const postGeo = new THREE.BoxGeometry(0.15, 2.6, 0.15);
  for (let i = 0; i < 40; i++) {
    [-1, 1].forEach((side) => {
      const p = new THREE.Mesh(postGeo, postMat);
      p.position.set(-15 + i * 4.5, 1.3, side * 5.5);
      p.layers.set(1);
      scene.add(p);
    });
  }
  // Rampe de balayage du gros plan initial
  const sweep = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 5), postMat);
  sweep.layers.set(1);
  scene.add(sweep);

  // Poussière en suspension
  const pCount = lite ? 120 : 420;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    pPos[i * 3] = -8 + Math.random() * 130;
    pPos[i * 3 + 1] = Math.random() * 3.5;
    pPos[i * 3 + 2] = -5 + Math.random() * 10;
  }
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  const dust = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 0.035, map: radialTexture("rgba(255,255,255,1)", "rgba(255,255,255,0)", 32), transparent: true,
    opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xc9d6ff
  }));
  scene.add(dust);

  // Post-traitement
  let composer = null, bloom = null;
  function setupComposer() {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(mount.clientWidth, mount.clientHeight), 0.7, 0.5, 0.9);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }
  if (!lite) setupComposer();

  function resize() {
    const w = mount.clientWidth, h = mount.clientHeight;
    renderer.setSize(w, h, false);
    if (composer) composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  // Compilation des shaders avant le premier plan (évite les saccades)
  renderer.compile(scene, camera);
  if (window.__capIntroQuality) window.__capIntroScene = { scene, car };
  if (onProgress) onProgress(1);

  /* --------------------------- Plans de caméra --------------------------- */
  // Champ horizontal constant : le cadrage tient en portrait comme en paysage
  function setFov(hfovDeg) {
    const a = camera.aspect;
    if (a < 0.9) hfovDeg *= 0.8;               // portrait : cadrage plus serré sur la voiture
    let v = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(hfovDeg) / 2) / a);
    v = Math.min(THREE.MathUtils.radToDeg(v), 78);
    if (Math.abs(camera.fov - v) > 0.01) { camera.fov = v; camera.updateProjectionMatrix(); }
  }
  const look = new THREE.Vector3();
  const S3X = carX(4.8), S4X = carX(5.2) - 1.6;
  function shot(t, cx) {
    const portrait = camera.aspect < 0.9;
    if (t < CUTS[0]) {                          // 1. gros plan phare
      const u = smooth(range(t, 0, CUTS[0]));
      camera.position.set(cx + lerp(5.0, 4.3, u) * (portrait ? 0.8 : 1), lerp(0.7, 0.5, u) + (portrait ? 0.35 : 0), lerp(2.9, 2.1, u) * (portrait ? 1.7 : 1));
      look.set(cx + lerp(1.7, 2.0, u), 0.55, lerp(0.15, 0.35, u));
      setFov(lerp(46, 38, u));
    } else if (t < CUTS[1]) {                   // 2. travelling latéral
      const u = smooth(range(t, CUTS[0], CUTS[1]));
      camera.position.set(cx + lerp(2.4, -1.3, u), 0.7 + Math.sin(t * 2.2) * 0.03, 4.4 * (portrait ? 1.2 : 1));
      look.set(cx + lerp(0.9, -0.2, u), portrait ? 0.75 : 0.55, 0);
      setFov(52);
    } else if (t < CUTS[2]) {                   // 3. la voiture fonce sur la caméra et la frôle
      camera.position.set(S3X, 0.34, 2.35);
      look.set(cx + 0.3, 0.55, 0);
      const d = Math.abs(cx - S3X);
      setFov(lerp(30, 64, clamp01(1 - d / 30)));
    } else {                                    // 4. elle disparaît dans l'obscurité
      const u = range(t, CUTS[2], DURATION);
      camera.position.set(S4X + u * 3, 1.05 + u * 0.25, 0.55);
      look.set(cx, 0.6, 0);
      setFov(lerp(58, 44, smooth(u)));
    }
    camera.lookAt(look);
  }

  /* ------------------------------ Boucle ------------------------------ */
  let titled = false, t = 0, last = performance.now(), raf = 0, frames = 0, slowSum = 0, stopped = false, cubeTick = 0;
  let resolveEnd;
  const ended = new Promise((r) => (resolveEnd = r));
  const dip = mount.querySelector(".intro3d__dip");

  function degrade() {
    // Matériel trop lent : on allège sans interrompre le film
    lite = true;
    renderer.setPixelRatio(1);
    if (reflector) { reflector.visible = false; ground.material.transparent = false; ground.material.opacity = 1; }
    composer = null;
    resize();
  }

  function frame(now) {
    if (stopped) return;
    let dt = (now - last) / 1000;
    const rawDt = dt;
    last = now;
    if (document.hidden) dt = 0;
    dt = Math.min(dt, 1 / 10);
    t += dt;
    // Débogage uniquement : window.__capIntroTime fige le film à un instant donné
    const dbg = typeof window.__capIntroTime === "number";
    if (dbg) { t = window.__capIntroTime; dt = 1 / 60; frames = 99; }

    // Contrôle de fluidité : allègement à < 30 i/s, abandon propre si toujours < 15 i/s
    if (frames < 40 && t > 0.2) {
      slowSum += rawDt; frames++;
      if (frames === 40 || slowSum > 1) {
        const avg = slowSum / frames;
        frames = 40;
        if (avg > 0.034 && !lite) { degrade(); frames = 0; slowSum = 0; }
        else if (avg > 0.066) { resolveEnd(); return; }
      }
    }

    const cx = carX(t);
    car.position.x = cx;
    shadow.position.x = cx;
    const speed = (carX(t + 0.01) - cx) / 0.01;
    wheels.forEach((w) => { w.rotation.z -= (speed * dt) / 0.36; });
    car.rotation.z = -Math.min(speed, 12) * 0.0025 * (t < 3 ? 1 : 0.3);   // léger cabrage au démarrage

    // Allumage des phares (avec scintillement LED)
    const ign = range(t, 0.45, 0.85);
    const flick = t > 0.45 && t < 0.7 ? (Math.sin(t * 90) > 0 ? 1 : 0.25) : 1;
    const hi = ign * flick;
    headMat.emissiveIntensity = hi * (lite ? 5 : 9);
    headGlows.forEach((g) => (g.material.opacity = hi * (lite ? 0.45 : 0.25)));
    headSpots.forEach((s) => (s.intensity = hi * 30));
    tailMat.emissiveIntensity = 0.8 + range(t, 1.2, 1.6) * 3;
    tailGlow.material.opacity = 0.35 + range(t, 1.2, 1.6) * 0.45;

    // Éclairages d'ambiance
    renderer.toneMappingExposure = lerp(0, 1.05, smooth(range(t, 0, 0.9))) * (1 - smooth(range(t, DURATION - 0.35, DURATION)) * 0.6);
    top.position.set(cx, 7, 0); top.target.position.set(cx, 0, 0);
    top.intensity = 11 * smooth(range(t, 0.2, 1.4));
    rim.intensity = 0.9 * smooth(range(t, 0, 1.2));
    rim.position.set(cx - 8, 1.4, -1.5); rim.target.position.set(cx, 0.6, 0);
    softbox.position.set(cx, 5.2, 0);
    key.position.set(cx + 1.5, 3.2, 7); key.target.position.set(cx, 0.5, 0);
    key.intensity = 20 * smooth(range(t, 0.6, 1.8));
    sweep.position.set(cx + lerp(-5, 7, smooth(range(t, 0.1, 1.7))), 4.2, 0);

    // Poussière qui flotte
    dust.rotation.y = Math.sin(t * 0.1) * 0.02;
    dust.position.y = Math.sin(t * 0.6) * 0.05;

    shot(t, cx);

    // Halos orientés : visibles seulement quand on regarde les feux de face
    const fdx = camera.position.x - (cx + 2.3), bdx = (cx - 2.3) - camera.position.x, dz = Math.abs(camera.position.z) + 0.001;
    const front = clamp01((fdx / Math.hypot(fdx, dz) - 0.45) * 2.2);
    const back = clamp01((bdx / Math.hypot(bdx, dz) - 0.45) * 2.2);
    headGlows.forEach((g) => (g.material.opacity *= front));
    tailGlow.material.opacity *= 0.25 + 0.75 * back;

    // Fondu de coupe entre les plans
    let d = 0;
    CUTS.forEach((c) => { d = Math.max(d, 1 - Math.abs(t - c) / 0.09); });
    if (dip) dip.style.opacity = String(clamp01(d));

    // Reflets : mise à jour de la caméra cubique (1 image sur 2 en mode allégé)
    if (!lite || (cubeTick++ % 3 === 0)) {
      car.visible = false;
      if (reflector) reflector.visible = false;
      cubeCam.position.set(cx, 0.8, 0);
      cubeCam.update(renderer, scene);
      car.visible = true;
      if (reflector && !lite) reflector.visible = true;
    }

    if (composer) composer.render(dt); else renderer.render(scene, camera);

    if (!titled && t >= 5.35) { titled = true; if (onTitle) onTitle(); }
    if (t >= DURATION && !dbg) { resolveEnd(); return; }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame((n) => { last = n; frame(n); });

  function dispose() {
    stopped = true;
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    });
    cubeRT.dispose();
    if (reflector) reflector.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return { ended, dispose, get lite() { return lite; } };
}
