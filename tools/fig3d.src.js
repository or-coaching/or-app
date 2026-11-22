// 3D exercise figure. Built from the same movement data as the 2D demos (moves.js), so every exercise
// gets a 3D version. Loaded only when a large demo is on screen; thumbnails stay 2D.
// Bundle: see tools/README (esbuild, three.js kept inside the bundle, moves.js/muscles.js external).
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MOVES, ZONES, TOP_COLOURS, GROUND, joints, place, poseAt } from "./moves.js";
import { MUSCLES } from "./muscles.js";

const U = 1 / 50;
const PROF = {
  thigh: [[0, 6.6, 7.4], [0.25, 7, 6.8], [0.7, 5.4, 5.2], [1, 4.3, 4.1]],
  shin: [[0, 4.3, 4.2], [0.25, 4.1, 5.8], [0.65, 3.2, 3.4], [1, 2.5, 2.6]],
  uarm: [[0, 4.8, 4.8], [0.4, 4.4, 4.3], [1, 3.1, 3.1]],
  farm: [[0, 3.2, 3.2], [0.3, 3.3, 3.1], [0.9, 2.1, 2.1], [1, 2.1, 2.1]],
  torso: [[0, 7.2, 9.6], [0.15, 7, 9], [0.42, 5.8, 6.2], [0.68, 8.4, 7], [0.88, 7.2, 7.4], [1, 4.6, 5]],
};
const TW = [[0, 10.8], [0.35, 8.4], [0.72, 10.6], [0.9, 12.2], [1, 6]];
const wAt = (p, t, i) => { for (let k = 1; k < p.length; k++) if (t <= p[k][0]) { const u = (t - p[k - 1][0]) / (p[k][0] - p[k - 1][0] || 1); return p[k - 1][i] + (p[k][i] - p[k - 1][i]) * u; } return p[p.length - 1][i]; };

// A shell along +Y (0..1), wider at the front (+Z) or back (-Z); lateral width optional (torso).
function shell(prof, { t0 = 0, t1 = 1, side = "all", lateral = null, grow = 1, rings = 24, seg = 32 } = {}) {
  const [p0, p1] = side === "f" ? [-Math.PI / 2, Math.PI / 2] : side === "b" ? [Math.PI / 2, Math.PI * 1.5] : [0, Math.PI * 2];
  const pos = [], idx = [], uv = [];
  for (let i = 0; i <= rings; i++) {
    const t = t0 + (t1 - t0) * (i / rings);
    const cap = side === "all" && !lateral ? Math.sin(Math.min(1, Math.min(t, 1 - t) * 14 + 0.25) * Math.PI / 2) : 1;
    const f = wAt(prof, t, 1) * grow, b = wAt(prof, t, 2) * grow, w = lateral ? wAt(lateral, t, 1) * grow : (f + b) / 2;
    for (let j = 0; j <= seg; j++) {
      const ph = p0 + (p1 - p0) * (j / seg); const c = Math.cos(ph), s = Math.sin(ph); const d = c >= 0 ? f : b;
      pos.push(w * s * U * cap, t, d * c * U * cap); uv.push(j / seg, i / rings);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j, b2 = a + seg + 1; idx.push(a, a + 1, b2, b2, a + 1, b2 + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
const MAT = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.05, ...o });
function logoTex(ink) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 256; const x = c.getContext("2d");
  x.fillStyle = ink; x.font = "bold 132px Georgia, 'Times New Roman', serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("Or.", 256, 132);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function supported() {
  try { const c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"))); } catch { return false; }
}

// Mount a 3D figure for `key` into `host` (an element sized by CSS). Returns a stop() function.
export function mount(host, key, { props = true } = {}) {
  const move = MOVES[key]; if (!move) return () => {};
  const front = move.view === "front";
  const [prim, sec] = MUSCLES[key] || [[], []];
  const col = TOP_COLOURS[move.top || "sage"];
  const canvas = document.createElement("canvas"); canvas.className = "m3d"; host.appendChild(canvas);
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  scene.add(new THREE.HemisphereLight(0xdfe8e0, 0x2a302b, 1.1));
  const key1 = new THREE.DirectionalLight(0xffffff, 2.4); key1.position.set(3, 5, 4); key1.castShadow = true; key1.shadow.mapSize.set(1024, 1024);
  Object.assign(key1.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5 }); key1.shadow.radius = 6; scene.add(key1);
  const rim = new THREE.DirectionalLight(0x9cc0ff, 1.3); rim.position.set(-4, 3, -3); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(3, 64), new THREE.ShadowMaterial({ opacity: 0.35 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.25, 80), new THREE.MeshBasicMaterial({ color: 0x3d4740 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.002; scene.add(ring);

  const SKIN = MAT(0xc68b63, { roughness: 0.62 }), TOP = MAT(new THREE.Color(col.top), { roughness: 0.85 }), LEGS = MAT(0x1f2023, { roughness: 0.62 }),
    SHOE = MAT(0xefe8dc), HAIR = MAT(0x2a1f1a, { roughness: 0.9 }), IRON = MAT(0x3a3f44, { metalness: 0.6, roughness: 0.35 }),
    KIT = MAT(0x4a554c, { roughness: 0.8 }), CABLE = MAT(0x9aa39c, { metalness: 0.4, roughness: 0.4 }), BAND = MAT(0xe0a95a, { roughness: 0.7 }), SAGE = MAT(0x9cb59a);
  const GLOW = () => MAT(0xff5a36, { emissive: 0xff3a10, emissiveIntensity: 0.4, roughness: 0.45, transparent: true, opacity: 0.92 });

  // V: figure point -> world. Side view: x along world x, depth z. Front view: x becomes world z (viewer on +x).
  const V = (p, off, z = 0) => front ? new THREE.Vector3(0, (p[1] + off.dy) * U, -(p[0] + off.dx - 100) * U) : new THREE.Vector3((p[0] + off.dx - 100) * U, (p[1] + off.dy) * U, z);
  const S2W = (X, Y) => front ? new THREE.Vector3(0, (GROUND - Y) * U, -(X - 100) * U) : new THREE.Vector3((X - 100) * U, (GROUND - Y) * U, 0);
  const fwd = (n2) => front ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(n2[0], n2[1], 0);
  const limbN = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; };
  const orient = (g, a, b, f3, scaleY = true) => {
    const Y = b.clone().sub(a); const len = Y.length() || 1e-4; Y.normalize();
    const Z = f3.clone(); Z.sub(Y.clone().multiplyScalar(Z.dot(Y))); if (Z.lengthSq() < 1e-6) Z.set(0, 0, 1); Z.normalize();
    const X = new THREE.Vector3().crossVectors(Y, Z).normalize();
    g.matrix.makeBasis(X, Y.clone().multiplyScalar(scaleY ? len : 1), Z).setPosition(a); g.matrixWorldNeedsUpdate = true;
  };
  const rod = (mat, r0 = 0.01) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r0, 1, 8), mat); m.castShadow = true; return m; };
  const between = (m, a, b) => { const d = b.clone().sub(a); const len = d.length() || 1e-4; m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); m.scale.set(1, len, 1); };

  const world = new THREE.Group(); scene.add(world);
  const fig = new THREE.Group(); world.add(fig);
  if (move.mat) { const m = new THREE.Mesh(new THREE.BoxGeometry(front ? 1.1 : 3.6, 0.03, front ? 3.6 : 1.1), MAT(0x5a6b5c, { roughness: 0.9 })); m.position.y = 0.015; m.receiveShadow = true; world.add(m); }

  const glows = [];
  const part = (prof, mat, opts = {}) => { const g = new THREE.Group(); const m = new THREE.Mesh(shell(prof, opts), mat); m.castShadow = true; g.add(m); g.matrixAutoUpdate = false; fig.add(g); return g; };
  const addZones = (g, segName, prof, lateral) => {
    for (const [list, strong] of [[prim, true], [sec.filter((m) => !prim.includes(m)), false]]) for (const mu of list) for (const [s, side, a, b] of ZONES[mu] || []) {
      if (s !== segName) continue; const mat = GLOW(); if (!strong) { mat.opacity = 0.55; mat.emissiveIntensity = 0.1; }
      const grow = segName === "uarm" ? 1.15 : segName === "torso" ? 1.075 : 1.035;
      g.add(new THREE.Mesh(shell(prof, { t0: a, t1: b, side: side === "x" ? "all" : side, lateral, grow }), mat)); glows.push({ mat, strong });
    }
  };
  const Lg = [0, 1].map(() => { const th = part(PROF.thigh, LEGS); addZones(th, "thigh", PROF.thigh); const sh = part(PROF.shin, LEGS); addZones(sh, "shin", PROF.shin);
    const shoe = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.13, 6, 14), SHOE); shoe.castShadow = true; const sg = new THREE.Group(); sg.add(shoe); shoe.rotation.z = Math.PI / 2; shoe.position.x = 0.07; sg.matrixAutoUpdate = false; fig.add(sg);
    return { th, sh, sg }; });
  const Ar = [0, 1].map(() => { const ua = part(PROF.uarm, SKIN); const sl = new THREE.Mesh(shell(PROF.uarm, { t0: 0, t1: 0.4, grow: 1.12 }), TOP); sl.castShadow = true; ua.add(sl); addZones(ua, "uarm", PROF.uarm);
    const fa = part(PROF.farm, SKIN); addZones(fa, "farm", PROF.farm);
    const hand = new THREE.Group(); hand.matrixAutoUpdate = false; fig.add(hand);
    const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.04, 6, 14), SKIN); palm.scale.set(0.62, 1, 1.15); palm.position.y = 0.038; palm.castShadow = true; hand.add(palm);
    const fing = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.03, 6, 14), SKIN); fing.scale.set(0.55, 1, 1.1); fing.position.set(-0.006, 0.09, 0); fing.rotation.z = 0.25; hand.add(fing);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.03, 5, 10), SKIN); thumb.position.set(0, 0.045, 0.036); thumb.rotation.x = -0.55; hand.add(thumb);
    return { ua, fa, hand, pos: new THREE.Vector3(), dir: new THREE.Vector3(0, -1, 0) }; });
  const torso = new THREE.Group(); torso.matrixAutoUpdate = false; fig.add(torso);
  for (const [t0, t1, mat, grow] of [[0, 0.3, LEGS, 1], [0.27, 1, TOP, 1.045]]) { const m = new THREE.Mesh(shell(PROF.torso, { t0, t1, lateral: TW, grow }), mat); m.castShadow = true; torso.add(m); }
  const LOGO = new THREE.MeshStandardMaterial({ map: logoTex(col.ink), transparent: true, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2 });
  torso.add(new THREE.Mesh(shell(PROF.torso, { t0: 0.56, t1: 0.88, side: "f", lateral: TW, grow: 1.05 }), LOGO));
  addZones(torso, "torso", PROF.torso, TW);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1, 16), SKIN); neck.matrixAutoUpdate = false; fig.add(neck);
  const head = new THREE.Group(); fig.add(head);
  const hm = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 24), SKIN); hm.scale.set(0.92, 1.08, 0.9); hm.castShadow = true; head.add(hm);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.185, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.5), HAIR); hair.scale.set(0.97, 1.12, 0.96); hair.rotation.z = 0.75; head.add(hair);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), HAIR); knot.position.set(-0.17, 0.1, 0); head.add(knot);
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.011, 8, 18), SAGE); tie.position.set(-0.165, 0.1, 0); tie.rotation.set(0, Math.PI / 2, 0.9); head.add(tie);
  const tail = new THREE.Group(); tail.position.set(-0.19, 0.09, 0); head.add(tail);
  let seg = tail; const tailSegs = [];
  for (let k = 0; k < 9; k++) {
    const len = 0.06, rr = 0.046 - k * 0.0026; const g = new THREE.Group(); if (k) g.position.y = -tailSegs[k - 1].len; seg.add(g);
    const lobe = new THREE.Mesh(new THREE.SphereGeometry(rr, 14, 10), HAIR); lobe.scale.set(1, 1.2, 0.9); lobe.position.set(0, -len / 2, (k % 2 ? 1 : -1) * rr * 0.35); lobe.rotation.x = (k % 2 ? 1 : -1) * 0.5; lobe.castShadow = true; g.add(lobe);
    tailSegs.push({ g, len }); seg = g;
  }
  const end = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.006, 6, 12), SAGE); end.rotation.x = Math.PI / 2; end.position.y = -0.06; seg.add(end);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07, 10), HAIR); tip.rotation.x = Math.PI; tip.position.y = -0.1; seg.add(tip);
  const swing = { a: -0.5, v: 0, last: null, lastT: 0 };

  // ---------- equipment held in the hands
  const kit = new THREE.Group(); fig.add(kit);
  const dumb = () => { const g = new THREE.Group(); const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.26, 10), IRON); bar.rotation.x = Math.PI / 2; g.add(bar);
    for (const z of [-0.11, 0.11]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 6), IRON); w.rotation.x = Math.PI / 2; w.position.z = z; w.castShadow = true; g.add(w); } return g; };
  const barbell = () => { const g = new THREE.Group(); const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.6, 10), CABLE); bar.rotation.x = Math.PI / 2; g.add(bar);
    for (const z of [-0.62, 0.62]) { const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.05, 28), IRON); pl.rotation.x = Math.PI / 2; pl.position.z = z; pl.castShadow = true; g.add(pl); } return g; };
  const kb = () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), IRON); b.position.y = -0.13; b.castShadow = true; g.add(b);
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 16, Math.PI), IRON); h.rotation.y = Math.PI / 2; h.position.y = -0.05; g.add(h); return g; };
  const held = props ? ({ dumbbells: () => [dumb(), dumb()], goblet: () => [new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), IRON)], kettlebell: () => [kb()],
    db1: () => { const d = dumb(); d.rotation.x = Math.PI / 2; return [d]; }, ball: () => [new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 16), MAT(0x7a5c48, { roughness: 0.8 }))],
    barbell: () => [barbell()], barback: () => [barbell()], barhip: () => [barbell()] }[move.prop]?.() || []) : [];
  held.forEach((m) => { m.traverse((o) => (o.castShadow = true)); kit.add(m); });

  // ---------- static equipment from the first keyframe (bench, wall, bar, posts, machines)
  const p0 = move.frames[0], j0 = joints(p0, front), o0 = place(move, j0, p0);
  const at0 = (name) => { const m = { hip: j0.hip, sh: j0.sh, hand: j0.arms[0].h, hand1: j0.arms[1].h, ankle: j0.legs[0].a, ankle1: j0.legs[1].a, toe: j0.legs[0].t, toe1: j0.legs[1].t, knee: j0.legs[0].k, elbow: j0.arms[0].e, head: j0.head }[name] || j0.hip;
    return [m[0] + o0.dx, GROUND - (m[1] + o0.dy)]; };
  const box = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), KIT); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; world.add(m); return m; };
  for (const s of move.scene || []) {
    if (!props && s.type !== "bench" && s.type !== "wall") continue;
    const [x, y] = at0(s.at || "hip"); const X = x + (s.dx || 0), Y = y + (s.dy || 0); const P = S2W(X, Y);
    const hgt = Math.max(0.02, (GROUND - Y) * U);
    if (s.type === "bench") { const w = (s.w || 34) * U; front ? box(0.5, hgt, w, 0, hgt / 2, P.z) : box(w, hgt, 0.5, P.x, hgt / 2, 0); }
    if (s.type === "wall") { const h2 = (GROUND - 8) * U; front ? box(0.12, h2, 1.6, P.x - 0.4, h2 / 2, 0) : box(0.12, h2, 1.6, (X + 3.5 - 100) * U, h2 / 2, 0); }
    if (s.type === "bar") { const b = rod(CABLE, 0.022); b.rotation.x = Math.PI / 2; b.scale.y = 1.6; b.position.copy(P); world.add(b);
      for (const z of [-0.8, 0.8]) box(0.06, P.y, 0.06, P.x, P.y / 2, z); }
    if (s.type === "anchor") box(0.1, 0.1, 0.1, P.x, P.y, P.z);
    if (s.type === "post") { const pst = rod(KIT, 0.04); between(pst, P, new THREE.Vector3(P.x, 0, P.z)); world.add(pst); }
    if (s.type === "wheel") { const w = new THREE.Mesh(new THREE.TorusGeometry((s.r || 14) * U, 0.03, 10, 32), KIT); w.position.copy(P); world.add(w); box(0.1, P.y, 0.1, P.x, P.y / 2, 0.15); }
    if (s.type === "belt") box((s.w || 90) * U, 7 * U, 0.7, P.x, 3.5 * U, 0);
  }
  // moving lines: cables, bands, ropes, handles
  const lines = (move.lines || []).filter(() => props).map((l) => {
    const m = l.type === "band" ? rod(BAND, 0.012) : l.type === "handbar" ? rod(IRON, 0.02) : l.type === "plate" ? rod(IRON, 0.05) : rod(CABLE, l.type === "rope" ? 0.016 : 0.007); world.add(m); return { l, m };
  });
  const anchorOf = (l) => { const [x, y] = at0(l.at || "sh"); return S2W(x + (l.dx || 0), y + (l.dy || 0)); };

  // ---------- pose one moment of the rep
  let cur = { pts: {} };
  function pose(t) {
    const p = poseAt(move, t); const j = joints(p, front); const off = place(move, j, p);
    const hipZ = front ? 0 : 0.13, shZ = front ? 0 : 0.21;
    const pts = {};
    [0, 1].forEach((i) => {
      const z = i ? -hipZ : hipZ, lg = j.legs[i];
      const h = V(lg.h, off, z), k = V(lg.k, off, z), an = V(lg.a, off, z), to = V(lg.t, off, z);
      orient(Lg[i].th, h, k, fwd(limbN(lg.h, lg.k))); orient(Lg[i].sh, k, an, fwd(limbN(lg.k, lg.a)));
      if (front) Lg[i].sg.matrix.makeRotationZ(-0.15).setPosition(an.x, an.y + 0.02, an.z);
      else { const d = to.clone().sub(an); Lg[i].sg.matrix.makeRotationZ(Math.atan2(d.y, d.x)).setPosition(an.x, an.y + 0.02, an.z); }
      const zs = i ? -shZ : shZ, ar = j.arms[i];
      const s = V(ar.s, off, zs), e = V(ar.e, off, zs * 1.05), hd = V(ar.h, off, zs * 1.05);
      orient(Ar[i].ua, s, e, fwd(limbN(ar.s, ar.e))); orient(Ar[i].fa, e, hd, fwd(limbN(ar.e, ar.h)));
      Ar[i].pos.copy(hd); Ar[i].dir.copy(hd.clone().sub(e).normalize()); orient(Ar[i].hand, hd, hd.clone().add(Ar[i].dir), fwd(limbN(ar.e, ar.h)), false);
      pts[i ? "hand1" : "hand"] = hd.clone().add(Ar[i].dir.clone().multiplyScalar(0.06)); pts[i ? "ankle1" : "ankle"] = an; pts[i ? "toe1" : "toe"] = to; pts[i ? "knee1" : "knee"] = k;
    });
    const hip = V(j.hip, off), sh = V(j.sh, off), nk = V(j.neck, off), hd = V(j.head, off); pts.hip = hip; pts.sh = sh;
    const tdx = j.sh[0] - j.hip[0], tdy = j.sh[1] - j.hip[1], tl = Math.hypot(tdx, tdy) || 1;
    orient(torso, hip, sh, fwd([tdy / tl, -tdx / tl])); orient(neck, sh, nk.clone().lerp(hd, 0.25), new THREE.Vector3(1, 0, 0));
    neck.matrix.multiply(new THREE.Matrix4().makeTranslation(0, 0.5, 0));
    head.position.copy(hd); head.rotation.set(front ? ((p.head - 90) * Math.PI) / 180 : 0, 0, front ? 0 : ((p.head - 90) * Math.PI) / 180);
    // plait: a damped spring that hangs with gravity and swings when she moves
    const now = performance.now();
    if (swing.last) { const dt = Math.min(0.05, (now - swing.lastT) / 1000) || 0.016; const vx = (hd.x - swing.last.x) / dt, vy = (hd.y - swing.last.y) / dt;
      swing.v += ((-0.28 - vx * 0.35 - swing.a) * 40 - swing.v * 6 + vy * 1.2) * dt; swing.a += swing.v * dt; }
    swing.last = hd.clone(); swing.lastT = now;
    const hz = front ? 0 : head.rotation.z; let rel = swing.a - hz; rel = Math.max(-2.7, Math.min(-0.15, ((rel + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI));
    // lying down: the plait rests on the mat, pointing away from her body, instead of hanging through the floor
    if (!front && hd.y < 0.32) { const faceUp = -tdx / tl > 0; const away = sh.x < hip.x ? -1 : 1; rel = (faceUp ? away : -away) * Math.PI * 0.46 - hz; }
    tail.rotation.z = rel; tailSegs.forEach((s2, k) => { if (k) s2.g.rotation.z = swing.v * 0.012 * k; });
    // held equipment
    const mid = pts.hand.clone().lerp(pts.hand1, 0.5);
    if (move.prop === "dumbbells") held.forEach((m, i) => m.position.copy(i ? pts.hand1 : pts.hand));
    else if (move.prop === "goblet" || move.prop === "ball") held[0]?.position.copy(mid).add(new THREE.Vector3(front ? 0.08 : 0.05, 0.05, 0));
    else if (move.prop === "kettlebell" || move.prop === "db1") held[0]?.position.copy(mid);
    else if (move.prop === "barbell") held[0]?.position.copy(mid);
    else if (move.prop === "barback") held[0]?.position.copy(sh).add(new THREE.Vector3(-0.07, 0.03, 0));
    else if (move.prop === "barhip") held[0]?.position.copy(hip).add(new THREE.Vector3(0.12, 0.08, 0));
    // cables and bands
    lines.forEach(({ l, m }) => {
      if (l.type === "cable") between(m, l.both ? mid : pts[l.from || "hand"] || pts.hand, anchorOf(l));
      else if (l.type === "band") between(m, pts[l.from] || pts.hand, pts[l.to] || pts.hand1);
      else if (l.type === "handbar") { const d = pts.hand1.clone().sub(pts.hand).normalize().multiplyScalar(0.1); between(m, pts.hand.clone().sub(d), pts.hand1.clone().add(d)); }
      else if (l.type === "plate") between(m, pts.ankle.clone().add(new THREE.Vector3(0, 0, 0.25)), pts.ankle.clone().add(new THREE.Vector3(0, 0, -0.25)));
      else if (l.type === "rope") between(m, mid, new THREE.Vector3(mid.x + 1.6, 0.05, mid.z));
    });
    cur = { pts };
    return p;
  }

  // ---------- camera: frame the whole rep, view from the side for side-on moves and from the front for front-on moves
  const ctl = new OrbitControls(cam, canvas); ctl.enablePan = false; ctl.enableZoom = false; ctl.enableDamping = true; ctl.dampingFactor = 0.12;
  const bb = new THREE.Box3(); for (const tt of [0, 0.2, 0.4, 0.6, 0.8]) { pose(tt); world.updateMatrixWorld(true); bb.expandByObject(fig); }
  const ctr = bb.getCenter(new THREE.Vector3()), size = bb.getSize(new THREE.Vector3());
  const rad = Math.max(size.y * 0.62, Math.hypot(size.x, size.z) * 0.52, 0.75);
  const dist = (rad / Math.tan((cam.fov * Math.PI) / 360)) * 0.98;
  ctl.target.copy(ctr); // a wall she faces would block a three-quarter view, so look from the side for those
  const wallAhead = (move.scene || []).some((s) => s.type === "wall" && at0(s.at || "hip")[0] + (s.dx || 0) > at0("hip")[0]);
  const dir = (front ? new THREE.Vector3(0.88, 0.2, 0.42) : wallAhead ? new THREE.Vector3(0.16, 0.2, 0.97) : new THREE.Vector3(0.5, 0.22, 0.84)).normalize();
  cam.position.copy(ctr).addScaledVector(dir, dist); ctl.update();
  const polar = ctl.getPolarAngle(); ctl.minPolarAngle = polar - 0.35; ctl.maxPolarAngle = Math.min(1.62, polar + 0.35);
  canvas.style.touchAction = "pan-y"; // vertical swipes still scroll the page; sideways drags turn her round

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let visible = true, stopped = false, raf = 0; const t0 = performance.now();
  const io = "IntersectionObserver" in window ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf && !stopped) raf = requestAnimationFrame(tick); }) : null; io?.observe(canvas);
  const fit = () => { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; if (canvas.width !== Math.round(w * r.getPixelRatio()) || canvas.height !== Math.round(h * r.getPixelRatio())) { r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); } };
  let restart = 0;
  function tick(now) {
    raf = 0; if (stopped) return; if (!canvas.isConnected) return stop();
    fit(); const t = window.__or3dT != null ? window.__or3dT : reduce ? move.still ?? 0.5 : (now - t0 - restart) / 1000 / move.secs; pose(t);
    const x = ((t % 1) + 1) % 1; const work = 0.5 - 0.5 * Math.cos(x * Math.PI * 2);
    glows.forEach((g) => (g.mat.emissiveIntensity = g.strong ? 0.25 + 0.75 * work : 0.08 + 0.2 * work));
    ctl.update(); r.render(scene, cam);
    if (visible && (!reduce || ctl.enableDamping)) raf = requestAnimationFrame(tick);
  }
  function stop() {
    if (stopped) return; stopped = true; cancelAnimationFrame(raf); io?.disconnect(); ctl.dispose();
    scene.traverse((o) => { o.geometry?.dispose(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => { x.map?.dispose(); x.dispose(); }); });
    r.dispose(); r.forceContextLoss?.(); canvas.remove();
  }
  raf = requestAnimationFrame(tick);
  stop.replay = () => { restart = performance.now() - t0; };
  return stop;
}
