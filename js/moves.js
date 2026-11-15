// =============================================================
// Animated line-figure demos, used until Tanya uploads her own video.
// The figure is a side view facing right. Every pose is a set of absolute
// segment angles in degrees (0 = forward/right, 90 = up, 270 = down).
// The figure is always grounded at its lowest point; one joint is pinned
// horizontally so feet (or hands) do not slide.
// =============================================================

const K = 0.78;
const L = { torso: 50 * K, neck: 7 * K, head: 8.5 * K, uarm: 27 * K, farm: 25 * K, thigh: 39 * K, shin: 38 * K, foot: 11 * K };

const STAND = { torso: 90, head: 90, ua: [266, 270], fa: [268, 272], th: [270, 270], sh: [270, 270], ft: [0, 0] };
const P = (o) => ({ ...STAND, ...o });

// Each move: label, keyframes [pose, holdSeconds], cycle seconds, what stays pinned, optional prop.
export const MOVES = {
  squat: {
    label: "Squat", pin: "ankle", prop: "goblet", secs: 3.2,
    frames: [P({ torso: 88, ua: [282, 282], fa: [84, 84] }), P({ torso: 58, head: 70, ua: [296, 296], fa: [74, 74], th: [352, 350], sh: [248, 250] })],
  },
  hinge: {
    label: "Hip hinge", pin: "ankle", prop: "dumbbells", secs: 3.4,
    frames: [P({ torso: 88 }), P({ torso: 20, head: 30, th: [284, 284], sh: [262, 262], ua: [268, 270], fa: [270, 272] })],
  },
  swing: {
    label: "Kettlebell swing", pin: "ankle", prop: "kettlebell", secs: 1.8,
    frames: [P({ torso: 28, head: 38, th: [292, 292], sh: [258, 258], ua: [246, 246], fa: [244, 244] }), P({ torso: 92, ua: [358, 358], fa: [2, 2] })],
  },
  lunge: {
    mat: true, label: "Reverse lunge", pin: "ankle", x: 128, secs: 3.4,
    frames: [P({ ua: [268, 272], fa: [270, 274] }), P({ ua: [268, 272], fa: [270, 274], th: [352, 246], sh: [272, 190], ft: [0, 212] })],
  },
  bridge: {
    mat: true, label: "Glute bridge", pin: "ankle", x: 140, secs: 3,
    frames: [P({ torso: 181, head: 180, th: [52, 52], sh: [292, 292], ua: [358, 358], fa: [0, 0] }), P({ torso: 202, head: 186, th: [22, 22], sh: [284, 284], ua: [352, 352], fa: [356, 356] })],
  },
  pushup: {
    mat: true, label: "Push-up", pin: "toe", secs: 2.8,
    frames: [P({ torso: 12, head: 14, th: [192, 192], sh: [192, 192], ft: [296, 296], ua: [272, 272], fa: [272, 272] }), P({ torso: 1, head: 4, th: [186, 186], sh: [186, 186], ft: [292, 292], ua: [150, 150], fa: [288, 288] })],
  },
  plank: {
    mat: true, label: "Plank", pin: "toe", secs: 2.6,
    frames: [P({ torso: 10, head: 12, th: [190, 190], sh: [190, 190], ft: [296, 296], ua: [272, 272], fa: [272, 272] }), P({ torso: 10, head: 12, th: [190, 190], sh: [190, 190], ft: [296, 296], ua: [272, 30], fa: [272, 120] })],
  },
  row: {
    label: "Bent-over row", pin: "ankle", prop: "dumbbells", secs: 2.6,
    frames: [P({ torso: 24, head: 34, th: [282, 282], sh: [262, 262], ua: [270, 270], fa: [272, 272] }), P({ torso: 24, head: 34, th: [282, 282], sh: [262, 262], ua: [198, 270], fa: [284, 272] })],
  },
  press: {
    label: "Overhead press", pin: "ankle", prop: "dumbbells", secs: 2.6,
    frames: [P({ ua: [252, 256], fa: [86, 88] }), P({ ua: [94, 94], fa: [92, 92] })],
  },
  deadbug: {
    mat: true, label: "Dead bug", pin: "hip", secs: 3.2,
    frames: [P({ torso: 180, head: 180, th: [90, 90], sh: [0, 0], ft: [90, 90], ua: [90, 90], fa: [90, 90] }), P({ torso: 180, head: 180, th: [8, 90], sh: [4, 0], ft: [60, 90], ua: [90, 172], fa: [90, 174] })],
  },
  calf: {
    label: "Calf raise", pin: "ankle", secs: 2.2,
    frames: [P({}), P({ ft: [312, 312], ua: [268, 272], fa: [270, 274] })],
  },
  curl: {
    label: "Biceps curl", pin: "ankle", prop: "dumbbells", secs: 2.4,
    frames: [P({ ua: [268, 270], fa: [268, 270] }), P({ ua: [262, 264], fa: [96, 100] })],
  },
  mountain: {
    mat: true, label: "Mountain climber", pin: "hip", x: 96, secs: 1.2,
    frames: [P({ torso: 12, head: 14, th: [190, 190], sh: [190, 190], ft: [296, 296], ua: [272, 272], fa: [272, 272] }),
      P({ torso: 12, head: 14, th: [300, 190], sh: [208, 190], ft: [270, 296], ua: [272, 272], fa: [272, 272] })],
  },
  crunch: {
    mat: true, label: "Crunch", pin: "ankle", x: 140, secs: 2.6,
    frames: [P({ torso: 181, head: 180, th: [52, 52], sh: [292, 292], ua: [120, 120], fa: [330, 330] }), P({ torso: 148, head: 132, th: [52, 52], sh: [292, 292], ua: [100, 100], fa: [330, 330] })],
  },
  highknees: {
    label: "High knees", pin: "hip", x: 100, secs: 0.9,
    frames: [P({ th: [352, 272], sh: [272, 270], ua: [300, 236], fa: [40, 268] }), P({ th: [272, 352], sh: [270, 272], ua: [236, 300], fa: [268, 40] })],
  },
  stretch: {
    mat: true, label: "Lunge and reach", pin: "ankle", x: 128, secs: 4,
    frames: [P({ th: [330, 230], sh: [262, 188], ft: [0, 206], torso: 60, head: 60, ua: [274, 276], fa: [274, 276] }), P({ th: [330, 230], sh: [262, 188], ft: [0, 206], torso: 64, head: 80, ua: [96, 276], fa: [96, 276] })],
  },
};

// Pick a move from the exercise name when Tanya hasn't chosen one.
const KEYWORDS = [
  [/calf/i, "calf"], [/curl/i, "curl"], [/mountain/i, "mountain"], [/crunch|sit[\s-]?up/i, "crunch"], [/high knee|skip|jog|march/i, "highknees"],
  [/swing/i, "swing"], [/dead\s?bug/i, "deadbug"], [/bridge|thrust/i, "bridge"], [/push[\s-]?up|press[\s-]?up/i, "pushup"],
  [/plank|shoulder tap/i, "plank"], [/row/i, "row"], [/overhead|shoulder press|military|press/i, "press"],
  [/lunge|split squat|step[\s-]?up/i, "lunge"], [/squat|sit to stand/i, "squat"], [/deadlift|rdl|hinge|good morning/i, "hinge"],
  [/stretch|greatest|reach|mobility/i, "stretch"],
];
export function moveFor(ex) {
  if (ex?.demo_move === "none") return null;
  if (ex?.demo_move && MOVES[ex.demo_move]) return ex.demo_move;
  const hit = KEYWORDS.find(([re]) => re.test(ex?.name || ""));
  return hit ? hit[1] : null;
}

const rad = (d) => (d * Math.PI) / 180;
const step = (p, a, len) => [p[0] + Math.cos(rad(a)) * len, p[1] + Math.sin(rad(a)) * len];
function lerpAngle(a, b, t) { let d = ((b - a + 540) % 360) - 180; return a + d * t; }
function blend(p, q, t) {
  const o = {};
  for (const k of Object.keys(p)) o[k] = Array.isArray(p[k]) ? p[k].map((v, i) => lerpAngle(v, q[k][i], t)) : lerpAngle(p[k], q[k], t);
  return o;
}

// Joint positions in figure space (y up), hip at origin.
function joints(pose) {
  const hip = [0, 0];
  const sh = step(hip, pose.torso, L.torso);
  const neck = step(sh, pose.head, L.neck);
  const head = step(neck, pose.head, L.head);
  const legs = [0, 1].map((i) => { const k = step(hip, pose.th[i], L.thigh); const a = step(k, pose.sh[i], L.shin); const t = step(a, pose.ft[i], L.foot); return { k, a, t }; });
  const arms = [0, 1].map((i) => { const e = step(sh, pose.ua[i], L.uarm); const h = step(e, pose.fa[i], L.farm); return { e, h }; });
  return { hip, sh, neck, head, legs, arms };
}

function place(j, pinName, pinX) {
  const pts = [j.hip, j.sh, ...j.legs.flatMap((l) => [l.k, l.a, l.t]), ...j.arms.flatMap((a) => [a.e, a.h]), [j.head[0], j.head[1] - L.head]];
  const minY = Math.min(...pts.map((p) => p[1]));
  const pin = pinName === "toe" ? j.legs[0].t : pinName === "hip" ? j.hip : j.legs[0].a;
  return { dx: pinX - pin[0], dy: -minY };
}

const W = 200, H = 162, GROUND = 150, HEAD_R = 8.4;
function svgPoint(p, off) { return [(p[0] + off.dx).toFixed(1), (GROUND - (p[1] + off.dy)).toFixed(1)]; }

function drawPose(svg, move, pose) {
  const showProps = svg.closest(".move")?.dataset.props !== "0";
  const j = joints(pose);
  const pinX = move.x ?? (move.pin === "toe" ? 50 : move.pin === "hip" ? 92 : 104);
  const off = place(j, move.pin, pinX);
  const S = (p) => svgPoint(p, off);
  const seg = (a, b) => { const [x1, y1] = S(a), [x2, y2] = S(b); return `M${x1} ${y1}L${x2} ${y2}`; };
  const limb = (pts) => pts.slice(1).map((p, i) => seg(pts[i], p)).join("");
  const set = (cls, d) => { svg.querySelector("." + cls).setAttribute("d", d); };
  const near = 0, far = 1;
  const legD = (i) => [seg(j.hip, j.legs[i].k), seg(j.legs[i].k, j.legs[i].a), seg(j.legs[i].a, j.legs[i].t)];
  const armD = (i) => [seg(j.sh, j.arms[i].e), seg(j.arms[i].e, j.arms[i].h)];
  const [fT, fS, fF] = legD(far), [nT, nS, nF] = legD(near), [fU, fL] = armD(far), [nU, nL] = armD(near);
  set("m-thigh-f", fT); set("m-shin-f", fS); set("m-shoe-f", fF); set("m-uarm-f", fU); set("m-farm-f", fL);
  set("m-thigh-n", nT); set("m-shin-n", nS); set("m-shoe-n", nF); set("m-uarm-n", nU); set("m-farm-n", nL);
  // crop top over the chest, leggings waistband at the hips
  const waist = [j.hip[0] + (j.sh[0] - j.hip[0]) * 0.32, j.hip[1] + (j.sh[1] - j.hip[1]) * 0.32];
  set("m-top", seg(waist, j.sh)); set("m-waist", seg(j.hip, waist)); set("m-neck", seg(j.sh, j.neck));
  const [hx, hy] = S(j.head);
  const back = ((pose.head + 90) * Math.PI) / 180, bun = ((pose.head + 40) * Math.PI) / 180, r = HEAD_R;
  const hair = svg.querySelector(".m-hair"); hair.setAttribute("cx", (+hx + Math.cos(back) * 2.4).toFixed(1)); hair.setAttribute("cy", (+hy - Math.sin(back) * 2.4).toFixed(1));
  const bn = svg.querySelector(".m-bun"); bn.setAttribute("cx", (+hx + Math.cos(bun) * r * 1.25).toFixed(1)); bn.setAttribute("cy", (+hy - Math.sin(bun) * r * 1.25).toFixed(1));
  const c = svg.querySelector(".m-head"); c.setAttribute("cx", hx); c.setAttribute("cy", hy);
  const props = svg.querySelector(".m-props");
  if (move.prop && showProps) {
    const hands = [S(j.arms[0].h), S(j.arms[1].h)];
    if (move.prop === "goblet") {
      const mx = (hands[0][0] * 1 + hands[1][0] * 1) / 2, my = (hands[0][1] * 1 + hands[1][1] * 1) / 2;
      props.innerHTML = `<circle cx="${mx}" cy="${(my - 3).toFixed(1)}" r="6"/>`;
    } else if (move.prop === "kettlebell") {
      props.innerHTML = `<circle cx="${hands[0][0]}" cy="${(hands[0][1] * 1 + 6).toFixed(1)}" r="6"/>`;
    } else {
      props.innerHTML = hands.map(([x, y], i) => `<rect x="${(x - 7).toFixed(1)}" y="${(y - 3).toFixed(1)}" width="13" height="5" rx="2.5" class="${i ? "far" : ""}"/>`).join("");
    }
  } else props.innerHTML = "";
}

// Public: markup for a demo. Animated ones are picked up by startMoves().
export function moveSvg(key, { animate = true, label = true, props = true } = {}) {
  const m = MOVES[key]; if (!m) return "";
  return `<figure class="move ${animate ? "anim" : ""}" data-move="${key}" data-props="${props ? 1 : 0}">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${m.label} demonstration">
      <circle class="m-ring" cx="${W - 34}" cy="40" r="46"/>
      <line class="m-ground" x1="14" y1="${GROUND + 1.5}" x2="${W - 14}" y2="${GROUND + 1.5}"/>
      ${m.mat ? `<rect class="m-mat" x="10" y="${GROUND - 2}" width="${W - 20}" height="6" rx="3"/>` : ""}
      <path class="m-uarm-f m-skin-f"/><path class="m-farm-f m-skin-f"/>
      <path class="m-thigh-f m-legs-f"/><path class="m-shin-f m-legs-f"/><path class="m-shoe-f"/>
      <g class="m-props"></g>
      <path class="m-waist"/><path class="m-top"/><path class="m-neck m-skin"/>
      <circle class="m-bun" r="${(HEAD_R * 0.62).toFixed(1)}"/><circle class="m-hair" r="${(HEAD_R + 1).toFixed(1)}"/><circle class="m-head" r="${HEAD_R}"/>
      <path class="m-thigh-n m-legs"/><path class="m-shin-n m-legs"/><path class="m-shoe-n"/>
      <path class="m-uarm-n m-skin"/><path class="m-farm-n m-skin"/>
    </svg>${label ? `<figcaption>Animated demo of the movement pattern. Your coach's video will replace it.</figcaption>` : ""}</figure>`;
}

function poseAt(m, t) {
  // ping-pong between the two frames with a short hold at each end and eased motion
  const hold = 0.18, x = t % 1;
  let u;
  if (x < hold) u = 0; else if (x < 0.5) u = (x - hold) / (0.5 - hold);
  else if (x < 0.5 + hold) u = 1; else u = 1 - (x - 0.5 - hold) / (0.5 - hold);
  const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
  return blend(m.frames[0], m.frames[1], e);
}

const live = new Set(); let running = false, t0 = 0;
export function startMoves(root = document) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.querySelectorAll(".move").forEach((f) => {
    const m = MOVES[f.dataset.move]; if (!m) return;
    const anim = f.classList.contains("anim") && !reduce;
    drawPose(f.querySelector("svg"), m, poseAt(m, anim ? 0 : 0.5));
    if (anim) live.add(f);
  });
  if (running || !live.size) return;
  running = true; t0 = performance.now();
  const tick = (now) => {
    for (const f of live) if (!f.isConnected) live.delete(f);
    if (!live.size) { running = false; return; }
    live.forEach((f) => { const m = MOVES[f.dataset.move]; drawPose(f.querySelector("svg"), m, poseAt(m, (now - t0) / 1000 / m.secs)); });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// For tests and previews: draw a fixed point in the cycle (0 = start pose, 0.5 = end pose).
export function drawAt(fig, t) { const m = MOVES[fig.dataset.move]; drawPose(fig.querySelector("svg"), m, poseAt(m, t)); }
