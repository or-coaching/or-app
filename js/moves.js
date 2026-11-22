import { MUSCLES } from "./muscles.js";
// =============================================================
// Animated exercise demos, used until the coach adds her own video.
// A figure is drawn from segment angles in degrees (0 = right, 90 = up, 270 = down).
// Side view faces right; front view faces the viewer. The lowest point sits on the
// ground (or a pinned joint sits at pinY), and one joint is pinned so feet don't slide.
// Extra pose values: tl/al/ll shorten torso/arms/legs for foreshortening, tb bends the
// spine, lift raises the whole figure (jumps), dx shifts it sideways, rp moves a rope.
// =============================================================

const K = 0.78;
const L = { torso: 50 * K, neck: 7 * K, head: 8.5 * K, uarm: 27 * K, farm: 25 * K, thigh: 39 * K, shin: 38 * K, foot: 11 * K };
const W = 200, H = 162, GROUND = 150, HEAD_R = 8.4;

const STAND = { torso: 90, head: 90, ua: [266, 270], fa: [268, 272], th: [270, 270], sh: [270, 270], ft: [0, 0] };
const P = (o) => ({ ...STAND, ...o });
// front view: arms just off the sides, feet turned slightly out
const STANDF = { torso: 90, head: 90, ua: [282, 258], fa: [278, 262], th: [272, 268], sh: [270, 270], ft: [330, 210] };
const F = (o) => ({ ...STANDF, ...o });
// hands and knees, facing right
const QUAD = P({ torso: 0, head: 8, ua: [270, 270], fa: [270, 270], th: [270, 270], sh: [180, 180], ft: [180, 180] });
const Q = (o) => ({ ...QUAD, ...o });
// lying on the back, head to the left, knees bent
const SUPINE = P({ torso: 180, head: 180, ua: [355, 355], fa: [0, 0], th: [55, 55], sh: [290, 290], ft: [0, 0] });
const SU = (o) => ({ ...SUPINE, ...o });
// sitting on a bench or chair
const SEAT = P({ torso: 90, head: 90, th: [0, 0], sh: [270, 270], ft: [0, 0], ua: [275, 275], fa: [300, 300] });
const SE = (o) => ({ ...SEAT, ...o });
// sitting on the floor, legs long
const FLOOR = P({ torso: 90, head: 90, th: [0, 0], sh: [0, 0], ft: [90, 90], ua: [275, 275], fa: [275, 275] });
const FL = (o) => ({ ...FLOOR, ...o });
const PLANK = P({ torso: 10, head: 12, th: [190, 190], sh: [190, 190], ft: [296, 296], ua: [272, 272], fa: [272, 272] });
const PL = (o) => ({ ...PLANK, ...o });
const benchAtHip = (o = {}) => ({ type: "bench", at: "hip", dy: 6, w: 34, ...o });

export const MOVES = {
  // ---------- squats and lower body
  squat: { label: "Squat", pin: "ankle", prop: "goblet", secs: 3.2,
    frames: [P({ torso: 88, ua: [282, 282], fa: [84, 84] }), P({ torso: 58, head: 70, ua: [296, 296], fa: [74, 74], th: [352, 350], sh: [248, 250] })] },
  bwsquat: { label: "Bodyweight squat", pin: "ankle", secs: 3.2,
    frames: [P({}), P({ torso: 60, head: 72, ua: [2, 6], fa: [4, 8], th: [352, 350], sh: [248, 250] })] },
  sumo: { label: "Sumo squat", view: "front", pin: "feet", prop: "db1", secs: 3.2,
    frames: [F({ th: [292, 248], sh: [272, 268], ua: [262, 278], fa: [265, 275] }), F({ th: [338, 202], sh: [278, 262], ua: [262, 278], fa: [265, 275], torso: 90 })] },
  backsquat: { label: "Barbell back squat", pin: "ankle", prop: "barback", secs: 3.4,
    frames: [P({ ua: [222, 222], fa: [92, 92] }), P({ torso: 56, head: 70, ua: [190, 190], fa: [58, 58], th: [352, 350], sh: [248, 250] })] },
  sitstand: { label: "Sit to stand", pin: "ankle", secs: 3.6, scene: [benchAtHip()],
    frames: [P({ torso: 74, head: 80, th: [2, 2], sh: [272, 272], ua: [330, 330], fa: [0, 0] }), P({ ua: [300, 300], fa: [0, 0] })] },
  wallsit: { label: "Wall sit", pin: "ankle", secs: 3, scene: [{ type: "wall", at: "sh", dx: -12 }],
    frames: [P({ torso: 92, th: [2, 2], sh: [270, 270], ua: [272, 272], fa: [300, 300] }), P({ torso: 92, head: 96, th: [2, 2], sh: [270, 270], ua: [272, 272], fa: [300, 300] })] },
  jumpsquat: { label: "Jump squat", pin: "ankle", secs: 1.4,
    frames: [P({ torso: 60, head: 72, ua: [250, 250], fa: [250, 250], th: [352, 350], sh: [248, 250] }), P({ ua: [80, 84], fa: [84, 88], ft: [300, 300], lift: 16 })] },
  thruster: { label: "Dumbbell thruster", pin: "ankle", prop: "dumbbells", secs: 2.6,
    frames: [P({ torso: 60, head: 72, ua: [215, 215], fa: [70, 70], th: [352, 350], sh: [248, 250] }), P({ ua: [88, 92], fa: [88, 92] })] },
  hinge: { label: "Hip hinge", pin: "ankle", prop: "dumbbells", secs: 3.4,
    frames: [P({ torso: 88 }), P({ torso: 20, head: 30, th: [284, 284], sh: [262, 262], ua: [268, 270], fa: [270, 272] })] },
  slrdl: { label: "Single-leg Romanian deadlift", pin: "ankle", prop: "dumbbells", secs: 3.6,
    frames: [P({ ua: [268, 272], fa: [270, 274], th: [270, 268], sh: [270, 266] }), P({ torso: 8, head: 16, th: [276, 186], sh: [266, 186], ft: [0, 276], ua: [272, 272], fa: [272, 272] })] },
  rdlbar: { label: "Barbell Romanian deadlift", pin: "ankle", prop: "barbell", secs: 3.4,
    frames: [P({ torso: 88, ua: [272, 272], fa: [272, 272] }), P({ torso: 22, head: 32, th: [284, 284], sh: [262, 262], ua: [272, 272], fa: [272, 272] })] },
  deadlift: { label: "Deadlift", pin: "ankle", prop: "barbell", secs: 3.4,
    frames: [P({ torso: 30, head: 42, th: [304, 304], sh: [252, 252], ua: [272, 272], fa: [272, 272] }), P({ ua: [270, 270], fa: [270, 270] })] },
  kbdead: { label: "Kettlebell deadlift", pin: "ankle", prop: "goblet", secs: 3.2,
    frames: [P({ torso: 32, head: 44, th: [306, 306], sh: [252, 252], ua: [272, 272], fa: [272, 272] }), P({ ua: [272, 272], fa: [272, 272] })] },
  swing: { label: "Kettlebell swing", pin: "ankle", prop: "kettlebell", secs: 1.8,
    frames: [P({ torso: 28, head: 38, th: [292, 292], sh: [258, 258], ua: [246, 246], fa: [244, 244] }), P({ torso: 92, ua: [358, 358], fa: [2, 2] })] },
  lunge: { label: "Lunge", pin: "ankle", x: 128, secs: 3.4,
    frames: [P({ ua: [268, 272], fa: [270, 274] }), P({ ua: [268, 272], fa: [270, 274], th: [352, 246], sh: [272, 190], ft: [0, 212] })] },
  bulgarian: { label: "Bulgarian split squat", pin: "ankle", x: 128, prop: "dumbbells", secs: 3.4, scene: [{ type: "bench", at: "toe1", dy: 4, w: 30, dx: -4 }],
    frames: [P({ th: [290, 252], sh: [272, 160], ft: [0, 190] }), P({ th: [350, 236], sh: [272, 172], ft: [0, 196] })] },
  laterallunge: { label: "Lateral lunge", view: "front", pin: "ankle1", x: 72, secs: 3.4,
    frames: [F({ th: [296, 244], sh: [270, 270], ua: [300, 240], fa: [330, 210] }), F({ torso: 82, head: 84, th: [338, 214], sh: [258, 214], ua: [330, 280], fa: [0, 330] })] },
  stepup: { label: "Step-up", pin: "ankle", pinY: GROUND - 20, x: 116, secs: 3.2, scene: [{ type: "bench", at: "ankle", dy: 4, w: 36, dx: 4 }],
    frames: [P({ torso: 80, head: 84, th: [334, 264], sh: [256, 266], ft: [0, 0] }), P({ th: [272, 266], sh: [270, 276], ft: [0, 340] })] },
  stepknee: { label: "Step-up with knee drive", pin: "ankle", pinY: GROUND - 20, x: 116, secs: 3.2, scene: [{ type: "bench", at: "ankle", dy: 4, w: 36, dx: 4 }],
    frames: [P({ torso: 80, head: 84, th: [334, 264], sh: [256, 266], ft: [0, 0], ua: [250, 290], fa: [270, 300] }), P({ th: [272, 2], sh: [270, 270], ft: [0, 340], ua: [300, 230], fa: [60, 250] })] },
  calf: { label: "Calf raise", pin: "ankle", secs: 2.2,
    frames: [P({}), P({ ft: [312, 312], ua: [268, 272], fa: [270, 274] })] },
  seatcalf: { label: "Seated calf raise", pin: "ankle", secs: 2.2, scene: [benchAtHip()], prop: "dumbbells",
    frames: [SE({ ua: [300, 300], fa: [350, 350] }), SE({ ft: [325, 325], ua: [300, 300], fa: [350, 350] })] },
  legpress: { label: "Leg press", pin: "hip", pinY: GROUND - 34, x: 84, secs: 3.2, scene: [{ type: "bench", at: "hip", dy: 6, w: 40, dx: -6 }],
    lines: [{ type: "plate" }],
    frames: [P({ torso: 128, head: 118, th: [64, 64], sh: [348, 348], ft: [78, 78], ua: [330, 330], fa: [0, 0] }), P({ torso: 128, head: 118, th: [34, 34], sh: [34, 34], ft: [124, 124], ua: [330, 330], fa: [0, 0] })] },
  legext: { label: "Leg extension", pin: "hip", pinY: GROUND - 40, secs: 3, scene: [benchAtHip()],
    frames: [SE({ ua: [262, 262], fa: [262, 262] }), SE({ sh: [4, 4], ft: [92, 92], ua: [262, 262], fa: [262, 262] })] },
  seatext: { label: "Seated knee extension", pin: "hip", pinY: GROUND - 40, secs: 3, scene: [benchAtHip()],
    frames: [SE({ ua: [262, 262], fa: [262, 262] }), SE({ sh: [4, 270], ft: [92, 0], ua: [262, 262], fa: [262, 262] })] },
  legcurl: { label: "Seated leg curl", pin: "hip", pinY: GROUND - 40, secs: 3, scene: [benchAtHip()],
    frames: [SE({ sh: [352, 352], ft: [84, 84], ua: [300, 300], fa: [340, 340] }), SE({ sh: [252, 252], ft: [342, 342], ua: [300, 300], fa: [340, 340] })] },
  lateralwalk: { label: "Banded lateral walk", view: "front", pin: "hip", secs: 1.8, lines: [{ type: "band", from: "knee", to: "knee1" }],
    frames: [F({ torso: 84, th: [282, 258], sh: [266, 274], ua: [300, 240], fa: [20, 160] }), F({ torso: 84, th: [298, 248], sh: [270, 270], ua: [300, 240], fa: [20, 160], dx: 10 })] },
  abductor: { label: "Hip abduction", view: "front", pin: "hip", pinY: GROUND - 42, secs: 2.8, scene: [{ type: "bench", at: "hip", dy: 2, w: 44 }],
    frames: [F({ ll: 0.75, th: [292, 248], sh: [270, 270], ua: [250, 290], fa: [270, 270] }), F({ ll: 0.75, th: [330, 210], sh: [278, 262], ua: [250, 290], fa: [270, 270] })] },
  cablekick: { label: "Cable glute kickback", pin: "ankle1", x: 104, secs: 2.6, lines: [{ type: "cable", from: "ankle", at: "ankle", dx: 70, dy: -4 }], scene: [{ type: "anchor", at: "ankle", dx: 70, dy: -4 }],
    frames: [P({ torso: 78, head: 82, ua: [330, 330], fa: [345, 345] }), P({ torso: 74, head: 80, th: [226, 270], sh: [216, 270], ft: [300, 0], ua: [330, 330], fa: [345, 345] })] },

  // ---------- bridges, hips and glutes on the floor
  bridge: { label: "Glute bridge", mat: true, pin: "ankle", x: 140, secs: 3,
    frames: [P({ torso: 181, head: 180, th: [52, 52], sh: [292, 292], ua: [358, 358], fa: [0, 0] }), P({ torso: 202, head: 186, th: [22, 22], sh: [284, 284], ua: [352, 352], fa: [356, 356] })] },
  slbridge: { label: "Single-leg glute bridge", mat: true, pin: "ankle", x: 140, secs: 3,
    frames: [P({ torso: 181, head: 180, th: [52, 40], sh: [292, 40], ft: [0, 120], ua: [358, 358], fa: [0, 0] }), P({ torso: 202, head: 186, th: [22, 22], sh: [284, 22], ft: [0, 110], ua: [352, 352], fa: [356, 356] })] },
  bridgemarch: { label: "Glute bridge march", mat: true, pin: "ankle1", x: 140, secs: 2.4,
    frames: [P({ torso: 202, head: 186, th: [22, 22], sh: [284, 284], ua: [352, 352], fa: [356, 356] }), P({ torso: 202, head: 186, th: [80, 22], sh: [330, 284], ft: [40, 0], ua: [352, 352], fa: [356, 356] })] },
  hipthrust: { label: "Hip thrust", pin: "ankle", x: 140, secs: 3, scene: [{ type: "bench", at: "sh", dy: 6, w: 30, dx: -8 }],
    frames: [P({ torso: 140, head: 150, th: [62, 62], sh: [286, 286], ua: [180, 180], fa: [180, 180] }), P({ torso: 180, head: 178, th: [2, 2], sh: [272, 272], ua: [180, 180], fa: [180, 180] })] },
  barthrust: { label: "Barbell hip thrust", pin: "ankle", x: 140, prop: "barhip", secs: 3, scene: [{ type: "bench", at: "sh", dy: 6, w: 30, dx: -8 }],
    frames: [P({ torso: 140, head: 150, th: [62, 62], sh: [286, 286], ua: [330, 330], fa: [10, 10] }), P({ torso: 180, head: 178, th: [2, 2], sh: [272, 272], ua: [310, 310], fa: [0, 0] })] },
  clamshell: { label: "Clamshell", mat: true, pin: "hip", x: 96, secs: 2.6, lines: [{ type: "band", from: "knee", to: "knee1" }],
    frames: [P({ torso: 180, head: 172, ll: 0.8, th: [358, 358], sh: [354, 354], ft: [80, 80], ua: [350, 186], fa: [0, 100] }), P({ torso: 180, head: 172, ll: 0.8, th: [34, 358], sh: [326, 354], ft: [60, 80], ua: [350, 186], fa: [0, 100] })] },
  donkey: { label: "Donkey kick", mat: true, pin: "hand", x: 140, secs: 2.4,
    frames: [Q({}), Q({ th: [152, 270], sh: [70, 180], ft: [160, 180] })] },
  hydrant: { label: "Fire hydrant", mat: true, pin: "hand", x: 140, secs: 2.4,
    frames: [Q({}), Q({ th: [228, 270], sh: [160, 180], ft: [180, 180], tb: 2 })] },
  birddog: { label: "Bird dog", mat: true, pin: "hand1", x: 140, secs: 3.2,
    frames: [Q({}), Q({ ua: [0, 270], fa: [0, 270], th: [270, 180], sh: [180, 180], ft: [180, 180] })] },
  catcow: { label: "Cat-cow", mat: true, pin: "hand", x: 140, secs: 4,
    frames: [Q({ tb: 9, head: 300 }), Q({ tb: -7, head: 30 })] },
  thread: { label: "Thread the needle", mat: true, pin: "hand1", x: 140, secs: 4,
    frames: [Q({ ua: [80, 270], fa: [86, 270] }), Q({ torso: 352, head: 330, ua: [196, 270], fa: [186, 270], tb: 3 })] },
  child: { label: "Child's pose", mat: true, pin: "hand", x: 150, secs: 4.4,
    frames: [Q({ ua: [8, 8], fa: [0, 0], head: 0 }), P({ torso: 356, head: 340, th: [300, 300], sh: [180, 180], ft: [180, 180], ua: [4, 4], fa: [0, 0] })] },
  bearplank: { label: "Bear plank", mat: true, pin: "hand", x: 140, secs: 2.6,
    frames: [Q({ th: [266, 266], sh: [196, 196], ft: [250, 250] }), Q({ th: [262, 262], sh: [194, 194], ft: [250, 250], tb: 1.5 })] },

  // ---------- push-ups, planks and presses
  pushup: { label: "Push-up", mat: true, pin: "toe", secs: 2.8,
    frames: [PL({ torso: 12, head: 14, th: [192, 192], sh: [192, 192] }), PL({ torso: 1, head: 4, th: [186, 186], sh: [186, 186], ft: [292, 292], ua: [150, 150], fa: [288, 288] })] },
  kneepush: { label: "Knee push-up", mat: true, pin: "knee", x: 70, secs: 2.8,
    frames: [P({ torso: 26, head: 28, th: [206, 206], sh: [180, 180], ft: [180, 180], ua: [272, 272], fa: [272, 272] }), P({ torso: 10, head: 12, th: [190, 190], sh: [176, 176], ft: [176, 176], ua: [150, 150], fa: [292, 292] })] },
  wallpush: { label: "Wall push-up", pin: "toe", x: 50, secs: 2.8, scene: [{ type: "wall", at: "hand", dx: 2 }],
    frames: [P({ torso: 64, head: 64, th: [244, 244], sh: [244, 244], ft: [334, 334], ua: [16, 16], fa: [16, 16] }), P({ torso: 58, head: 58, th: [238, 238], sh: [238, 238], ft: [328, 328], ua: [300, 300], fa: [54, 54] })] },
  inclinepush: { label: "Incline push-up", pin: "toe", x: 40, secs: 2.8, scene: [{ type: "bench", at: "hand", dy: 2, w: 30 }],
    frames: [P({ torso: 30, head: 32, th: [210, 210], sh: [210, 210], ft: [300, 300], ua: [272, 272], fa: [272, 272] }), P({ torso: 22, head: 24, th: [202, 202], sh: [202, 202], ft: [292, 292], ua: [158, 158], fa: [292, 292] })] },
  pike: { label: "Pike push-up", mat: true, pin: "toe", x: 40, secs: 3,
    frames: [P({ torso: 304, head: 300, th: [236, 236], sh: [236, 236], ft: [326, 326], ua: [270, 270], fa: [270, 270] }), P({ torso: 316, head: 300, th: [242, 242], sh: [242, 242], ft: [332, 332], ua: [206, 206], fa: [300, 300] })] },
  downdog: { label: "Downward dog", mat: true, pin: "toe", x: 40, secs: 4,
    frames: [P({ torso: 304, head: 300, th: [236, 236], sh: [236, 236], ft: [326, 326], ua: [270, 270], fa: [270, 270] }), P({ torso: 306, head: 296, th: [238, 238], sh: [238, 238], ft: [342, 342], ua: [268, 268], fa: [268, 268] })] },
  plank: { label: "Plank shoulder tap", mat: true, pin: "toe", secs: 2.6,
    frames: [PL({}), PL({ ua: [272, 30], fa: [272, 120] })] },
  plankhold: { label: "Plank", mat: true, pin: "toe", secs: 3.6, still: 0,
    frames: [PL({ ua: [270, 270], fa: [0, 0] }), PL({ ua: [270, 270], fa: [0, 0], torso: 11, th: [191, 191] })] },
  sideplank: { label: "Side plank", view: "front", mat: true, pin: "toe", x: 40, secs: 3,
    frames: [F({ torso: 14, head: 16, th: [196, 196], sh: [196, 196], ft: [286, 286], ua: [270, 120], fa: [0, 60] }), F({ torso: 22, head: 24, th: [204, 204], sh: [198, 198], ft: [288, 288], ua: [262, 92], fa: [350, 92] })] },
  mountain: { label: "Mountain climber", mat: true, pin: "hand", x: 140, secs: 1.2,
    frames: [PL({ torso: 12, head: 14 }), PL({ torso: 12, head: 14, th: [300, 190], sh: [208, 190], ft: [270, 296] })] },
  renegade: { label: "Renegade row", mat: true, pin: "toe", prop: "dumbbells", secs: 2.6,
    frames: [PL({}), PL({ ua: [128, 272], fa: [268, 272] })] },
  press: { label: "Overhead press", pin: "ankle", prop: "dumbbells", secs: 2.6,
    frames: [P({ ua: [252, 256], fa: [86, 88] }), P({ ua: [94, 94], fa: [92, 92] })] },
  seatpress: { label: "Seated shoulder press", pin: "hip", pinY: GROUND - 40, prop: "dumbbells", secs: 2.6, scene: [benchAtHip()],
    frames: [SE({ ua: [252, 256], fa: [86, 88] }), SE({ ua: [94, 94], fa: [92, 92] })] },
  reach: { label: "Overhead reach", pin: "ankle", secs: 3.6,
    frames: [P({}), P({ ua: [88, 92], fa: [90, 94], head: 94 })] },
  latraise: { label: "Lateral raise", view: "front", pin: "feet", prop: "dumbbells", secs: 2.6,
    frames: [F({ ua: [276, 264], fa: [274, 266] }), F({ ua: [6, 174], fa: [4, 176] })] },
  frontraise: { label: "Front raise", pin: "ankle", prop: "dumbbells", secs: 2.6,
    frames: [P({ ua: [272, 272], fa: [272, 272] }), P({ ua: [2, 4], fa: [2, 4] })] },
  reardelt: { label: "Rear delt fly", view: "front", pin: "feet", prop: "dumbbells", secs: 2.6,
    frames: [F({ tl: 0.55, head: 270, th: [276, 264], sh: [266, 274], ua: [282, 258], fa: [276, 264] }), F({ tl: 0.55, head: 270, th: [276, 264], sh: [266, 274], ua: [356, 184], fa: [350, 190] })] },
  pullapart: { label: "Band pull-apart", view: "front", pin: "feet", secs: 2.6, lines: [{ type: "band", from: "hand", to: "hand1" }],
    frames: [F({ al: 0.42, ua: [330, 210], fa: [350, 190] }), F({ ua: [2, 178], fa: [0, 180] })] },
  facepull: { label: "Face pull", pin: "ankle", secs: 2.6, lines: [{ type: "cable", from: "hand", at: "sh", dx: 74, dy: -6 }], scene: [{ type: "anchor", at: "sh", dx: 74, dy: -6 }],
    frames: [P({ ua: [4, 4], fa: [4, 4] }), P({ ua: [168, 168], fa: [64, 64] })] },
  pushdown: { label: "Triceps pushdown", pin: "ankle", secs: 2.4, lines: [{ type: "cable", from: "hand", at: "sh", dx: 30, dy: -56 }], scene: [{ type: "anchor", at: "sh", dx: 30, dy: -56 }],
    frames: [P({ torso: 86, ua: [276, 276], fa: [40, 40] }), P({ torso: 86, ua: [276, 276], fa: [282, 282] })] },
  ohext: { label: "Overhead triceps extension", pin: "ankle", prop: "db1", secs: 2.6,
    frames: [P({ ua: [92, 96], fa: [92, 96] }), P({ ua: [98, 102], fa: [238, 242] })] },
  curl: { label: "Biceps curl", pin: "ankle", prop: "dumbbells", secs: 2.4,
    frames: [P({ ua: [268, 270], fa: [268, 270] }), P({ ua: [262, 264], fa: [96, 100] })] },
  cablecurl: { label: "Cable curl", pin: "ankle", secs: 2.4, lines: [{ type: "cable", from: "hand", at: "ankle", dx: 40, dy: -2 }], scene: [{ type: "anchor", at: "ankle", dx: 40, dy: -2 }],
    frames: [P({ ua: [272, 274], fa: [300, 300] }), P({ ua: [266, 268], fa: [100, 100] })] },
  dip: { label: "Bench dip", pin: "hand", pinY: GROUND - 38, x: 70, secs: 2.6, scene: [{ type: "bench", at: "hand", dy: 2, w: 36, dx: -10 }],
    frames: [P({ torso: 86, head: 88, ua: [252, 252], fa: [264, 264], th: [356, 356], sh: [282, 282], ft: [0, 0] }), P({ torso: 84, head: 86, ua: [196, 196], fa: [284, 284], th: [10, 10], sh: [292, 292], ft: [10, 10] })] },
  bench: { label: "Bench press", pin: "hip", prop: "dumbbells", secs: 2.8, scene: [{ type: "bench", at: "hip", dy: 6, w: 64, dx: -16 }],
    frames: [P({ torso: 180, head: 180, th: [340, 340], sh: [268, 268], ft: [0, 0], ua: [90, 90], fa: [90, 90] }), P({ torso: 180, head: 180, th: [340, 340], sh: [268, 268], ft: [0, 0], ua: [242, 242], fa: [86, 86] })] },
  barbench: { label: "Barbell bench press", pin: "hip", prop: "barbell", secs: 2.8, scene: [{ type: "bench", at: "hip", dy: 6, w: 64, dx: -16 }],
    frames: [P({ torso: 180, head: 180, th: [340, 340], sh: [268, 268], ft: [0, 0], ua: [90, 90], fa: [90, 90] }), P({ torso: 180, head: 180, th: [340, 340], sh: [268, 268], ft: [0, 0], ua: [242, 242], fa: [86, 86] })] },
  floorpress: { label: "Floor press", mat: true, pin: "hip", prop: "dumbbells", secs: 2.8,
    frames: [SU({ ua: [90, 90], fa: [90, 90] }), SU({ ua: [346, 346], fa: [90, 90] })] },
  fly: { label: "Chest fly", view: "front", pin: "feet", prop: "dumbbells", secs: 3,
    frames: [F({ ua: [70, 110], fa: [100, 80] }), F({ ua: [6, 174], fa: [20, 160] })] },
  chestpress: { label: "Chest press", pin: "hip", pinY: GROUND - 40, secs: 2.6, scene: [benchAtHip()], lines: [{ type: "handbar" }],
    frames: [SE({ ua: [212, 212], fa: [8, 8] }), SE({ ua: [0, 0], fa: [0, 0] })] },
  bandpress: { label: "Band chest press", pin: "ankle", secs: 2.6,
    frames: [P({ ua: [214, 214], fa: [2, 2] }), P({ ua: [2, 2], fa: [2, 2] })] },
  shadowbox: { label: "Shadow boxing", pin: "ankle", secs: 1.6,
    frames: [P({ torso: 86, ua: [296, 290], fa: [80, 84], th: [280, 262], sh: [268, 262] }), P({ torso: 84, ua: [4, 290], fa: [4, 84], th: [280, 262], sh: [268, 262] }),
      P({ torso: 86, ua: [296, 290], fa: [80, 84], th: [280, 262], sh: [268, 262] }), P({ torso: 82, ua: [296, 2], fa: [80, 2], th: [280, 262], sh: [268, 262] })], loop: true },

  // ---------- pulls and rows
  row: { label: "Bent-over row", pin: "ankle", prop: "dumbbells", secs: 2.6,
    frames: [P({ torso: 24, head: 34, th: [282, 282], sh: [262, 262], ua: [270, 270], fa: [272, 272] }), P({ torso: 24, head: 34, th: [282, 282], sh: [262, 262], ua: [198, 270], fa: [284, 272] })] },
  bandrow: { label: "Band row", pin: "ankle", secs: 2.6, lines: [{ type: "cable", from: "hand", at: "sh", dx: 76, dy: 12 }], scene: [{ type: "anchor", at: "sh", dx: 76, dy: 12 }],
    frames: [P({ torso: 88, ua: [354, 354], fa: [356, 356], th: [276, 264] }), P({ torso: 90, ua: [214, 214], fa: [6, 6], th: [276, 264] })] },
  cablerow: { label: "Seated cable row", pin: "hip", x: 70, secs: 2.8, lines: [{ type: "cable", from: "hand", at: "ankle", dx: 34, dy: -14 }], scene: [{ type: "anchor", at: "ankle", dx: 34, dy: -14 }],
    frames: [FL({ torso: 80, head: 84, th: [10, 10], sh: [350, 350], ua: [356, 356], fa: [358, 358] }), FL({ torso: 96, head: 92, th: [10, 10], sh: [350, 350], ua: [206, 206], fa: [6, 6] })] },
  seatbandrow: { label: "Seated band row", mat: true, pin: "hip", x: 70, secs: 2.8, lines: [{ type: "band", from: "hand", to: "toe" }],
    frames: [FL({ torso: 82, head: 86, ua: [354, 354], fa: [356, 356] }), FL({ torso: 94, head: 92, ua: [206, 206], fa: [6, 6] })] },
  latpull: { label: "Lat pulldown", view: "front", pin: "hip", pinY: GROUND - 40, secs: 2.8, scene: [{ type: "bench", at: "hip", dy: 2, w: 44 }],
    lines: [{ type: "handbar" }, { type: "cable", both: true, at: "head", dx: 0, dy: -80 }],
    frames: [F({ ll: 0.75, th: [292, 248], ua: [64, 116], fa: [86, 94] }), F({ ll: 0.75, th: [292, 248], ua: [320, 220], fa: [84, 96] })] },
  pullup: { label: "Pull-up", view: "front", pin: "hand", pinY: 18, x: 120, secs: 3, scene: [{ type: "bar", at: "hand", dx: -10, w: 120 }],
    frames: [F({ ua: [64, 116], fa: [72, 108], th: [276, 264], sh: [268, 272], ft: [280, 260] }), F({ ua: [326, 214], fa: [76, 104], th: [280, 260], sh: [262, 278], ft: [280, 260] })] },
  trxrow: { label: "TRX row", pin: "toe", x: 150, secs: 2.8, lines: [{ type: "cable", from: "hand", at: "hand", dx: 34, dy: -80 }],
    frames: [P({ torso: 116, head: 108, th: [296, 296], sh: [296, 296], ft: [26, 26], ua: [48, 48], fa: [48, 48] }), P({ torso: 108, head: 102, th: [288, 288], sh: [288, 288], ft: [18, 18], ua: [210, 210], fa: [66, 66] })] },
  facedown: { label: "Superman", mat: true, pin: "hip", x: 96, secs: 3,
    frames: [P({ torso: 0, head: 2, th: [180, 180], sh: [180, 180], ft: [180, 180], ua: [0, 0], fa: [0, 0] }), P({ torso: 12, head: 20, th: [170, 170], sh: [172, 172], ft: [180, 180], ua: [14, 14], fa: [16, 16] })] },
  backext: { label: "Back extension", pin: "hip", pinY: GROUND - 54, x: 90, secs: 3, scene: [{ type: "post", at: "hip", dy: 6 }],
    frames: [P({ torso: 300, head: 300, th: [232, 232], sh: [232, 232], ft: [322, 322], ua: [240, 240], fa: [10, 10] }), P({ torso: 46, head: 52, th: [232, 232], sh: [232, 232], ft: [322, 322], ua: [256, 256], fa: [56, 56] })] },

  // ---------- core on the floor
  deadbug: { label: "Dead bug", mat: true, pin: "hip", secs: 3.2,
    frames: [P({ torso: 180, head: 180, th: [90, 90], sh: [0, 0], ft: [90, 90], ua: [90, 90], fa: [90, 90] }), P({ torso: 180, head: 180, th: [8, 90], sh: [4, 0], ft: [60, 90], ua: [90, 172], fa: [90, 174] })] },
  hollow: { label: "Hollow hold", mat: true, pin: "hip", secs: 3,
    frames: [P({ torso: 170, head: 160, th: [16, 16], sh: [16, 16], ft: [100, 100], ua: [166, 166], fa: [166, 166] }), P({ torso: 166, head: 156, th: [20, 20], sh: [20, 20], ft: [104, 104], ua: [162, 162], fa: [162, 162] })] },
  crunch: { label: "Crunch", mat: true, pin: "ankle", x: 140, secs: 2.6,
    frames: [P({ torso: 181, head: 180, th: [52, 52], sh: [292, 292], ua: [120, 120], fa: [330, 330] }), P({ torso: 148, head: 132, th: [52, 52], sh: [292, 292], ua: [100, 100], fa: [330, 330] })] },
  revcrunch: { label: "Reverse crunch", mat: true, pin: "sh", x: 60, secs: 2.6,
    frames: [P({ torso: 180, head: 180, th: [92, 92], sh: [2, 2], ft: [90, 90], ua: [356, 356], fa: [0, 0] }), P({ torso: 196, head: 182, th: [126, 126], sh: [40, 40], ft: [130, 130], ua: [356, 356], fa: [0, 0] })] },
  bicycle: { label: "Bicycle crunch", mat: true, pin: "hip", secs: 2.2,
    frames: [P({ torso: 158, head: 146, ua: [110, 110], fa: [340, 340], th: [104, 24], sh: [12, 24], ft: [100, 114] }), P({ torso: 158, head: 146, ua: [110, 110], fa: [340, 340], th: [24, 104], sh: [24, 12], ft: [114, 100] })] },
  heeltap: { label: "Heel taps", mat: true, pin: "ankle", x: 140, secs: 2.2,
    frames: [SU({ torso: 166, head: 152, ua: [340, 352], fa: [348, 356] }), SU({ torso: 166, head: 152, ua: [352, 340], fa: [356, 348] })] },
  legraise: { label: "Lying leg raise", mat: true, pin: "hip", secs: 3,
    frames: [P({ torso: 180, head: 180, th: [90, 90], sh: [90, 90], ft: [180, 180], ua: [356, 356], fa: [0, 0] }), P({ torso: 180, head: 180, th: [14, 14], sh: [14, 14], ft: [104, 104], ua: [356, 356], fa: [0, 0] })] },
  flutter: { label: "Flutter kicks", mat: true, pin: "hip", secs: 0.8,
    frames: [P({ torso: 176, head: 166, th: [24, 10], sh: [24, 10], ft: [114, 100], ua: [356, 356], fa: [0, 0] }), P({ torso: 176, head: 166, th: [10, 24], sh: [10, 24], ft: [100, 114], ua: [356, 356], fa: [0, 0] })] },
  russian: { label: "Russian twist", view: "front", mat: true, pin: "hip", prop: "ball", secs: 2,
    frames: [F({ torso: 96, ll: 0.55, th: [300, 240], sh: [250, 290], ft: [330, 210], ua: [300, 330], fa: [330, 340] }), F({ torso: 84, ll: 0.55, th: [300, 240], sh: [250, 290], ft: [330, 210], ua: [210, 240], fa: [200, 210] })] },
  pallof: { label: "Pallof press", pin: "ankle", secs: 3, lines: [{ type: "band", from: "hand", to: "sh" }],
    frames: [P({ ua: [236, 236], fa: [350, 350], th: [276, 264] }), P({ ua: [358, 358], fa: [0, 0], th: [276, 264] })] },
  seattuck: { label: "Seated knee tuck", pin: "hip", pinY: GROUND - 40, secs: 2.6, scene: [{ type: "bench", at: "hip", dy: 6, w: 40, dx: -10 }],
    frames: [P({ torso: 118, head: 106, ua: [230, 230], fa: [236, 236], th: [6, 6], sh: [6, 6], ft: [90, 90] }), P({ torso: 108, head: 100, ua: [230, 230], fa: [236, 236], th: [62, 62], sh: [300, 300], ft: [30, 30] })] },

  // ---------- cardio, conditioning, carries
  highknees: { label: "High knees", pin: "hip", x: 100, secs: 0.9,
    frames: [P({ th: [352, 272], sh: [272, 270], ua: [300, 236], fa: [40, 268] }), P({ th: [272, 352], sh: [270, 272], ua: [236, 300], fa: [268, 40] })] },
  march: { label: "March", pin: "hip", x: 100, secs: 1.6,
    frames: [P({ th: [326, 270], sh: [270, 270], ua: [290, 248], fa: [330, 256] }), P({ th: [270, 326], sh: [270, 270], ua: [248, 290], fa: [256, 330] })] },
  buttkick: { label: "Butt kicks", pin: "hip", x: 100, secs: 0.9,
    frames: [P({ th: [262, 272], sh: [118, 270], ft: [30, 0], ua: [300, 240], fa: [40, 268] }), P({ th: [272, 262], sh: [270, 118], ft: [0, 30], ua: [240, 300], fa: [268, 40] })] },
  walk: { label: "Walk", pin: "hip", x: 100, secs: 1.4,
    frames: [P({ th: [292, 248], sh: [276, 236], ft: [8, 330], ua: [252, 290], fa: [262, 300] }), P({ th: [248, 292], sh: [236, 276], ft: [330, 8], ua: [290, 252], fa: [300, 262] })] },
  carry: { label: "Farmer's carry", pin: "hip", x: 100, prop: "dumbbells", secs: 1.4,
    frames: [P({ th: [290, 250], sh: [274, 238], ft: [8, 330] }), P({ th: [250, 290], sh: [238, 274], ft: [330, 8] })] },
  suitcase: { label: "Suitcase carry", pin: "hip", x: 100, prop: "kettlebell", secs: 1.4,
    frames: [P({ th: [290, 250], sh: [274, 238], ft: [8, 330], ua: [270, 290], fa: [270, 300] }), P({ th: [250, 290], sh: [238, 274], ft: [330, 8], ua: [270, 252], fa: [270, 262] })] },
  heeltoe: { label: "Heel-to-toe walk", view: "front", pin: "hip", secs: 2,
    frames: [F({ ua: [2, 178], fa: [358, 182], th: [272, 270], sh: [270, 272] }), F({ ua: [6, 174], fa: [2, 178], th: [270, 272], sh: [272, 270], dx: 1 })] },
  treadmill: { label: "Treadmill walk", pin: "hip", x: 96, secs: 1.4, scene: [{ type: "belt", at: "hip", w: 120, dx: 8 }, { type: "post", at: "sh", dx: 62, dy: 6 }],
    frames: [P({ th: [292, 248], sh: [276, 236], ft: [8, 330], ua: [252, 290], fa: [262, 300], lift: 7 }), P({ th: [248, 292], sh: [236, 276], ft: [330, 8], ua: [290, 252], fa: [300, 262], lift: 7 })] },
  bike: { label: "Stationary bike", pin: "hip", pinY: GROUND - 62, x: 80, secs: 1.4, scene: [{ type: "post", at: "hip", dy: 4 }, { type: "wheel", at: "hip", dx: 28, dy: 48, r: 13 }, { type: "post", at: "hand", dy: 4 }],
    frames: [P({ torso: 66, head: 76, ua: [332, 332], fa: [344, 344], th: [300, 352], sh: [276, 262], ft: [350, 10] }), P({ torso: 66, head: 76, ua: [332, 332], fa: [344, 344], th: [352, 300], sh: [262, 276], ft: [10, 350] })] },
  rower: { label: "Rowing machine", pin: "hip", pinY: GROUND - 16, x: 70, secs: 2.4, scene: [{ type: "belt", at: "hip", w: 150, dx: 48 }, { type: "anchor", at: "hip", dx: 112, dy: 4 }],
    frames: [P({ torso: 66, head: 76, th: [58, 58], sh: [298, 298], ft: [40, 40], ua: [346, 346], fa: [350, 350] }), P({ torso: 110, head: 100, th: [4, 4], sh: [356, 356], ft: [90, 90], ua: [226, 226], fa: [8, 8] })] },
  jacks: { label: "Jumping jacks", view: "front", pin: "hip", secs: 1.1,
    frames: [F({ ua: [276, 264], fa: [274, 266] }), F({ ua: [70, 110], fa: [80, 100], th: [296, 244], sh: [292, 248], lift: 3 })] },
  stepjack: { label: "Step jacks", view: "front", pin: "hip", secs: 2.4,
    frames: [F({ ua: [276, 264], fa: [274, 266] }), F({ ua: [70, 110], fa: [80, 100], th: [300, 268], sh: [294, 270] }), F({ ua: [276, 264], fa: [274, 266] }), F({ ua: [70, 110], fa: [80, 100], th: [272, 240], sh: [270, 246] })], loop: true },
  shuffle: { label: "Lateral shuffle", view: "front", pin: "hip", secs: 1.2,
    frames: [F({ torso: 86, th: [300, 240], sh: [264, 276], ua: [300, 240], fa: [20, 160], dx: -10 }), F({ torso: 86, th: [284, 256], sh: [268, 272], ua: [300, 240], fa: [20, 160], dx: 10 })] },
  skater: { label: "Skater hops", view: "front", pin: "hip", secs: 1.4,
    frames: [F({ torso: 80, th: [284, 316], sh: [262, 230], ua: [190, 230], fa: [180, 240], dx: 22 }), F({ torso: 100, th: [224, 256], sh: [310, 278], ua: [310, 350], fa: [300, 0], dx: -22 })] },
  skip: { label: "Skipping", view: "front", pin: "hip", secs: 0.8, lines: [{ type: "rope" }],
    frames: [F({ ua: [292, 248], fa: [330, 210], ft: [300, 240], lift: 7, rp: 0 }), F({ ua: [288, 252], fa: [350, 190], rp: 1 })] },
  burpee: { label: "Burpee", mat: true, pin: "hand", x: 130, secs: 3.4, loop: true,
    frames: [P({ ua: [80, 84], fa: [84, 88], lift: 8 }), P({ torso: 48, head: 60, th: [356, 354], sh: [250, 252], ua: [278, 278], fa: [276, 276] }), PL({ torso: 10, head: 12 }),
      P({ torso: 48, head: 60, th: [356, 354], sh: [250, 252], ua: [278, 278], fa: [276, 276] })] },
  squatthrust: { label: "Squat thrust", mat: true, pin: "hand", x: 130, secs: 3, loop: true,
    frames: [P({ ua: [268, 272], fa: [270, 274] }), P({ torso: 48, head: 60, th: [356, 354], sh: [250, 252], ua: [278, 278], fa: [276, 276] }), PL({ torso: 10, head: 12 }),
      P({ torso: 48, head: 60, th: [356, 354], sh: [250, 252], ua: [278, 278], fa: [276, 276] })] },
  slam: { label: "Medicine ball slam", pin: "ankle", prop: "ball", secs: 1.8,
    frames: [P({ ua: [92, 92], fa: [90, 90], ft: [330, 330] }), P({ torso: 30, head: 40, th: [310, 310], sh: [254, 254], ua: [282, 282], fa: [282, 282] })] },

  // ---------- mobility, stretching and balance
  stretch: { label: "Lunge and reach", mat: true, pin: "ankle", x: 128, secs: 4,
    frames: [P({ th: [330, 230], sh: [262, 188], ft: [0, 206], torso: 60, head: 60, ua: [274, 276], fa: [274, 276] }), P({ th: [330, 230], sh: [262, 188], ft: [0, 206], torso: 64, head: 80, ua: [96, 276], fa: [96, 276] })] },
  kneelhip: { label: "Kneeling hip flexor stretch", mat: true, pin: "ankle", x: 140, secs: 4,
    frames: [P({ th: [2, 250], sh: [270, 180], ft: [0, 180], ua: [268, 272], fa: [270, 274] }), P({ torso: 94, head: 96, th: [338, 236], sh: [266, 180], ft: [0, 180], ua: [270, 92], fa: [272, 94] })] },
  calfstretch: { label: "Calf stretch", pin: "ankle", x: 120, secs: 4, scene: [{ type: "wall", at: "hand", dx: 2 }],
    frames: [P({ torso: 72, head: 74, th: [300, 240], sh: [264, 240], ft: [0, 0], ua: [20, 20], fa: [20, 20] }), P({ torso: 62, head: 64, th: [310, 232], sh: [258, 232], ft: [0, 0], ua: [14, 14], fa: [14, 14] })] },
  hamstring: { label: "Seated hamstring stretch", mat: true, pin: "hip", x: 60, secs: 4,
    frames: [FL({ ua: [300, 300], fa: [320, 320] }), FL({ torso: 38, head: 30, ua: [6, 6], fa: [4, 4] })] },
  quadstretch: { label: "Standing quad stretch", pin: "ankle1", x: 100, secs: 4,
    frames: [P({ th: [270, 270], sh: [104, 270], ft: [80, 0], ua: [242, 0], fa: [296, 4] }), P({ torso: 92, th: [262, 270], sh: [100, 270], ft: [76, 0], ua: [238, 4], fa: [294, 6] })] },
  doorway: { label: "Doorway chest stretch", pin: "ankle", secs: 4, scene: [{ type: "wall", at: "elbow", dx: -5 }],
    frames: [P({ ua: [180, 270], fa: [90, 270], th: [276, 264] }), P({ torso: 84, head: 86, ua: [182, 272], fa: [92, 272], th: [282, 262], sh: [266, 268] })] },
  crossbody: { label: "Cross-body shoulder stretch", view: "front", pin: "feet", secs: 4,
    frames: [F({ ua: [178, 258], fa: [178, 82], al: 0.95 }), F({ ua: [184, 256], fa: [182, 76], al: 0.95, head: 84 })] },
  figure4: { label: "Figure-four stretch", pin: "hip", pinY: GROUND - 40, secs: 4, scene: [benchAtHip()],
    frames: [SE({ th: [22, 0], sh: [320, 270], ft: [60, 0], ua: [300, 300], fa: [340, 340] }), SE({ torso: 66, head: 60, th: [22, 0], sh: [320, 270], ft: [60, 0], ua: [310, 310], fa: [330, 330] })] },
  pigeon: { label: "Pigeon stretch", mat: true, pin: "hip", x: 110, secs: 4,
    frames: [P({ torso: 80, head: 84, th: [330, 196], sh: [196, 184], ft: [190, 180], ua: [286, 286], fa: [280, 280] }), P({ torso: 32, head: 24, th: [330, 196], sh: [196, 184], ft: [190, 180], ua: [356, 356], fa: [356, 356] })] },
  hip9090: { label: "Hip 90/90 switch", view: "front", mat: true, pin: "hip", secs: 3.6,
    frames: [F({ ll: 0.8, th: [208, 230], sh: [300, 320], ft: [340, 340], ua: [240, 300], fa: [250, 290] }), F({ ll: 0.8, th: [310, 332], sh: [220, 240], ft: [200, 200], ua: [240, 300], fa: [250, 290] })] },
  armcircles: { label: "Arm circles", pin: "ankle", secs: 2.4, loop: true,
    frames: [P({ ua: [270, 270], fa: [270, 270] }), P({ ua: [0, 0], fa: [0, 0] }), P({ ua: [90, 90], fa: [90, 90] }), P({ ua: [180, 180], fa: [180, 180] })] },
  legswing: { label: "Leg swings", pin: "ankle1", x: 96, secs: 1.8, scene: [{ type: "wall", at: "hand", dx: 4 }],
    frames: [P({ th: [322, 270], sh: [322, 270], ft: [52, 0], ua: [4, 270], fa: [4, 270] }), P({ th: [228, 270], sh: [228, 270], ft: [318, 0], ua: [4, 270], fa: [4, 270] })] },
  ankle: { label: "Ankle circles", pin: "hip", pinY: GROUND - 40, secs: 2.4, loop: true, scene: [benchAtHip()],
    frames: [SE({ th: [10, 0], sh: [4, 270], ft: [96, 0] }), SE({ th: [10, 0], sh: [4, 270], ft: [46, 0] }), SE({ th: [10, 0], sh: [4, 270], ft: [356, 0] }), SE({ th: [10, 0], sh: [4, 270], ft: [46, 0] })] },
  slstand: { label: "Single-leg stand", pin: "ankle1", x: 100, secs: 3.6,
    frames: [P({ th: [334, 270], sh: [270, 270], ft: [340, 0], ua: [330, 210], fa: [330, 210] }), P({ torso: 92, th: [330, 270], sh: [266, 270], ft: [338, 0], ua: [334, 206], fa: [334, 206] })] },
  seatmarch: { label: "Seated march", pin: "hip", pinY: GROUND - 40, secs: 1.8, scene: [benchAtHip()],
    frames: [SE({ th: [36, 0], sh: [290, 270], ua: [290, 250], fa: [40, 270] }), SE({ th: [0, 36], sh: [270, 290], ua: [250, 290], fa: [270, 40] })] },
};

// Pick a move from the exercise name when the coach hasn't chosen one.
const KEYWORDS = [
  [/burpee/i, "burpee"], [/squat thrust/i, "squatthrust"], [/jumping jack/i, "jacks"], [/step jack/i, "stepjack"], [/skater/i, "skater"], [/shuffle/i, "shuffle"],
  [/skip/i, "skip"], [/butt kick/i, "buttkick"], [/high knee|jog/i, "highknees"], [/seated march/i, "seatmarch"], [/march/i, "march"], [/treadmill/i, "treadmill"],
  [/bike|cycle/i, "bike"], [/row(ing)? machine|rower/i, "rower"], [/shadow box/i, "shadowbox"], [/farmer/i, "carry"], [/suitcase/i, "suitcase"], [/heel.to.toe/i, "heeltoe"],
  [/calf stretch/i, "calfstretch"], [/seated calf/i, "seatcalf"], [/calf/i, "calf"], [/hammer curl|biceps curl|dumbbell curl|^curl/i, "curl"], [/cable.*curl|band.*curl/i, "cablecurl"],
  [/mountain/i, "mountain"], [/bicycle/i, "bicycle"], [/reverse crunch/i, "revcrunch"], [/crunch|sit[\s-]?up/i, "crunch"], [/swing/i, "swing"], [/dead\s?bug/i, "deadbug"],
  [/hollow/i, "hollow"], [/flutter/i, "flutter"], [/leg raise/i, "legraise"], [/heel tap/i, "heeltap"], [/russian/i, "russian"], [/pallof/i, "pallof"],
  [/march.*bridge|bridge march/i, "bridgemarch"], [/single.leg.*bridge/i, "slbridge"], [/single.leg.*(deadlift|rdl)/i, "slrdl"], [/barbell hip thrust/i, "barthrust"], [/thrust$|hip thrust/i, "hipthrust"], [/bridge/i, "bridge"],
  [/clam/i, "clamshell"], [/donkey/i, "donkey"], [/hydrant/i, "hydrant"], [/bird dog/i, "birddog"], [/cat.cow/i, "catcow"], [/thread the needle/i, "thread"], [/child/i, "child"],
  [/bear/i, "bearplank"], [/side plank/i, "sideplank"], [/plank hold|^plank$|forearm plank/i, "plankhold"], [/plank|shoulder tap/i, "plank"], [/renegade/i, "renegade"],
  [/knee push/i, "kneepush"], [/wall push/i, "wallpush"], [/incline push/i, "inclinepush"], [/pike/i, "pike"], [/downward dog/i, "downdog"], [/push[\s-]?up|press[\s-]?up/i, "pushup"],
  [/barbell bench/i, "barbench"], [/bench press|chest press.*dumbbell/i, "bench"], [/floor press/i, "floorpress"], [/fly/i, "fly"], [/chest press/i, "chestpress"], [/band chest/i, "bandpress"],
  [/seated.*shoulder press/i, "seatpress"], [/lateral raise/i, "latraise"], [/front raise/i, "frontraise"], [/rear delt/i, "reardelt"], [/pull.apart/i, "pullapart"], [/face pull/i, "facepull"],
  [/pushdown/i, "pushdown"], [/overhead tri|triceps ext/i, "ohext"], [/dip/i, "dip"], [/pulldown/i, "latpull"], [/pull[\s-]?up|chin[\s-]?up/i, "pullup"], [/trx|inverted row/i, "trxrow"],
  [/cable row|seated row/i, "cablerow"], [/seated band row/i, "seatbandrow"], [/band(ed)? row/i, "bandrow"], [/row/i, "row"], [/superman/i, "facedown"], [/back extension/i, "backext"],
  [/overhead reach/i, "reach"], [/overhead|shoulder press|military|arnold|press/i, "press"], [/thruster/i, "thruster"], [/slam/i, "slam"],
  [/lateral lunge|side lunge/i, "laterallunge"], [/bulgarian/i, "bulgarian"], [/knee drive/i, "stepknee"], [/step[\s-]?up/i, "stepup"], [/lunge|split squat/i, "lunge"],
  [/sit to stand|box squat/i, "sitstand"], [/wall sit/i, "wallsit"], [/jump squat/i, "jumpsquat"], [/sumo/i, "sumo"], [/back squat/i, "backsquat"], [/goblet/i, "squat"], [/squat/i, "bwsquat"],
  [/leg press/i, "legpress"], [/leg extension/i, "legext"], [/knee extension/i, "seatext"], [/leg curl/i, "legcurl"], [/lateral walk|monster walk/i, "lateralwalk"], [/abduct/i, "abductor"],
  [/kickback/i, "cablekick"], [/romanian.*barbell|barbell.*romanian/i, "rdlbar"], [/kettlebell deadlift/i, "kbdead"], [/^deadlift|barbell deadlift/i, "deadlift"], [/deadlift|rdl|hinge|good morning/i, "hinge"],
  [/hip flexor/i, "kneelhip"], [/hamstring stretch/i, "hamstring"], [/quad stretch/i, "quadstretch"], [/doorway|chest stretch/i, "doorway"], [/cross.body/i, "crossbody"], [/figure.four/i, "figure4"],
  [/pigeon/i, "pigeon"], [/90.90/i, "hip9090"], [/arm circle/i, "armcircles"], [/leg swing/i, "legswing"], [/ankle/i, "ankle"], [/single.leg stand|balance/i, "slstand"],
  [/stretch|greatest|reach|mobility/i, "stretch"],
];
for (const k in MOVES) MOVES[k].key = k;
export function moveFor(ex) {
  if (ex?.demo_move === "none") return null;
  if (ex?.demo_move && MOVES[ex.demo_move]) return ex.demo_move;
  const hit = KEYWORDS.find(([re]) => re.test(ex?.name || ""));
  return hit ? hit[1] : null;
}

// ---------------------------------------------------------------- engine
const rad = (d) => (d * Math.PI) / 180;
const step = (p, a, len) => [p[0] + Math.cos(rad(a)) * len, p[1] + Math.sin(rad(a)) * len];
const LINEAR = new Set(["tl", "al", "ll", "lift", "tb", "dx", "rp"]);
function lerpAngle(a, b, t) { const d = ((b - a + 540) % 360) - 180; return a + d * t; }
function blend(p, q, t) {
  const o = {};
  for (const k of new Set([...Object.keys(p), ...Object.keys(q)])) {
    const a = p[k] ?? DEF[k], b = q[k] ?? DEF[k];
    o[k] = Array.isArray(a) ? a.map((v, i) => lerpAngle(v, b[i], t)) : LINEAR.has(k) ? a + (b - a) * t : lerpAngle(a, b, t);
  }
  return o;
}
const DEF = { tl: 1, al: 1, ll: 1, lift: 0, tb: 0, dx: 0, rp: 0 };

// Joint positions in figure space (y up), hip at the origin.
// Side view: both legs share the hip. Front view: hips and shoulders sit apart.
function joints(pose, front) {
  const tl = pose.tl ?? 1, al = pose.al ?? 1, ll = pose.ll ?? 1;
  const hip = [0, 0];
  const sh = step(hip, pose.torso, L.torso * tl);
  const neck = step(sh, pose.head, L.neck);
  const head = step(neck, pose.head, L.head + (front ? 1.5 : 0));
  const hipW = front ? 6.5 : 0, shW = front ? 10.5 : 0;
  const perp = rad(pose.torso - 90);
  const side = (pt, w, s) => [pt[0] + Math.cos(perp) * w * s, pt[1] + Math.sin(perp) * w * s];
  const legs = [0, 1].map((i) => { const h = side(hip, hipW, i ? -1 : 1); const k = step(h, pose.th[i], L.thigh * ll); const a = step(k, pose.sh[i], L.shin * ll); const t = step(a, pose.ft[i], L.foot * (front ? 0.55 : 1)); return { h, k, a, t }; });
  const arms = [0, 1].map((i) => { const s = side(sh, shW, i ? -1 : 1); const e = step(s, pose.ua[i], L.uarm * al); const h = step(e, pose.fa[i], L.farm * al); return { s, e, h }; });
  return { hip, sh, neck, head, legs, arms };
}
function pinPoint(j, name) {
  switch (name) {
    case "toe": return j.legs[0].t; case "hip": return j.hip; case "knee": return j.legs[0].k; case "sh": return j.sh;
    case "hand": return j.arms[0].h; case "hand1": return j.arms[1].h; case "ankle1": return j.legs[1].a;
    case "feet": return [(j.legs[0].a[0] + j.legs[1].a[0]) / 2, (j.legs[0].a[1] + j.legs[1].a[1]) / 2];
    default: return j.legs[0].a;
  }
}
function allPts(j) { return [j.hip, j.sh, ...j.legs.flatMap((l) => [l.k, l.a, l.t]), ...j.arms.flatMap((a) => [a.e, a.h]), [j.head[0], j.head[1] - HEAD_R * 0.9]]; }
// Offsets that turn figure space into SVG space: the pin keeps its x; the lowest point sits on the ground (or the pin sits at pinY).
function place(move, j, pose) {
  const pin = pinPoint(j, move.pin);
  const pinX = move.x ?? (move.pin === "toe" ? 50 : move.pin === "hip" ? 92 : move.view === "front" ? 100 : 104);
  const dx = pinX - pin[0] + (pose.dx || 0);
  if (move.pinY != null) return { dx, dy: GROUND - move.pinY - pin[1] + (pose.lift || 0) };
  const minY = Math.min(...allPts(j).map((p) => p[1]));
  return { dx, dy: -minY + (pose.lift || 0) };
}


// Static equipment (bench, box, wall, bar, machines) is placed from the first keyframe so it never moves.
function sceneSvg(move) {
  if (!move.scene) return "";
  const p0 = move.frames[0]; const j = joints(p0, move.view === "front"); const off = place(move, j, p0);
  const S = (p) => [p[0] + off.dx, GROUND - (p[1] + off.dy)];
  const at = (name) => {
    const m = { hip: j.hip, sh: j.sh, hand: j.arms[0].h, hand1: j.arms[1].h, ankle: j.legs[0].a, ankle1: j.legs[1].a, toe: j.legs[0].t, toe1: j.legs[1].t, knee: j.legs[0].k, elbow: j.arms[0].e, head: j.head };
    return S(m[name] || j.hip);
  };
  return move.scene.map((s) => {
    const [x, y] = at(s.at || "hip"); const X = x + (s.dx || 0), Y = y + (s.dy || 0);
    switch (s.type) {
      case "bench": return `<rect class="m-eq" x="${(X - (s.w || 34) / 2).toFixed(1)}" y="${Y.toFixed(1)}" width="${s.w || 34}" height="${(GROUND - Y).toFixed(1)}" rx="3"/>`;
      case "wall": return `<rect class="m-eq" x="${X.toFixed(1)}" y="8" width="7" height="${GROUND - 8}" rx="2"/>`;
      case "bar": return `<rect class="m-eq" x="${(X - (s.w || 110) / 2).toFixed(1)}" y="${(Y - 2).toFixed(1)}" width="${s.w || 110}" height="4" rx="2"/>`;
      case "anchor": return `<rect class="m-eq" x="${(X - 4).toFixed(1)}" y="${(Y - 4).toFixed(1)}" width="8" height="8" rx="2"/>`;
      case "post": return `<rect class="m-eq" x="${(X - 3).toFixed(1)}" y="${Y.toFixed(1)}" width="6" height="${(GROUND - Y).toFixed(1)}" rx="2"/>`;
      case "wheel": return `<circle class="m-eq-line" cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="${s.r || 14}"/>`;
      case "belt": return `<rect class="m-eq" x="${(X - (s.w || 90) / 2).toFixed(1)}" y="${GROUND - 7}" width="${s.w || 90}" height="7" rx="3"/>`;
      default: return "";
    }
  }).join("");
}

// ---------- shaped body: tapered limbs and a torso with volume, plus muscle overlays
// Profiles: [t along the segment, half-width on the front side, half-width on the back side]
const PROF = {
  thigh: [[0, 6.6, 7.2], [0.3, 6.8, 6.6], [0.75, 5.2, 5], [1, 4.2, 4]],
  shin: [[0, 4.2, 4], [0.28, 4, 5.6], [0.7, 3, 3.2], [1, 2.5, 2.5]],
  foot: [[0, 3.2, 3.6], [0.6, 2.8, 3], [1, 2.2, 2.6]],
  uarm: [[0, 4.6, 4.6], [0.35, 4.3, 4.2], [1, 3, 3]],
  farm: [[0, 3, 3], [0.35, 3.1, 2.9], [0.85, 2, 2], [1, 2.6, 2.6]],
  torso: [[0, 7, 9.4], [0.18, 6.8, 8.4], [0.42, 5.8, 6.4], [0.68, 8.2, 7], [0.88, 7.2, 7.6], [1, 5.2, 6.2]],
  torsoF: [[0, 10.2, 10.2], [0.35, 7.8, 7.8], [0.72, 10.4, 10.4], [0.9, 12.4, 12.4], [1, 9, 9]],
};
// Where each muscle sits on the moving figure: segment, side (f front, b back, x both), from, to
const ZONES = {
  quads: [["thigh", "f", 0.08, 0.92]], hamstrings: [["thigh", "b", 0.1, 0.9]], glutes: [["torso", "b", 0, 0.24], ["thigh", "b", 0, 0.22]],
  hipflexors: [["thigh", "f", 0, 0.3], ["torso", "f", 0, 0.12]], abductors: [["thigh", "x", 0, 0.28]], adductors: [["thigh", "b", 0.05, 0.6]],
  calves: [["shin", "b", 0.08, 0.66]], shins: [["shin", "f", 0.1, 0.85]],
  biceps: [["uarm", "f", 0.25, 0.92]], triceps: [["uarm", "b", 0.2, 0.9]], delts: [["uarm", "f", 0, 0.32]], sidedelts: [["uarm", "x", 0, 0.3]], reardelts: [["uarm", "b", 0, 0.32]],
  forearms: [["farm", "x", 0.02, 0.72]], chest: [["torso", "f", 0.62, 0.9]], abs: [["torso", "f", 0.28, 0.62]], obliques: [["torso", "f", 0.3, 0.6]],
  lats: [["torso", "b", 0.5, 0.86]], traps: [["torso", "b", 0.84, 1]], lowerback: [["torso", "b", 0.26, 0.5]],
};
const BACK_ONLY = new Set(["hamstrings", "glutes", "triceps", "reardelts", "lats", "traps", "lowerback", "adductors"]);
function workOf(move) {
  if (move._w) return move._w;
  const [p, s] = MUSCLES[move.key] || [[], []]; const front = move.view === "front";
  const z = (list) => { const o = {}; list.forEach((m) => { if (front && BACK_ONLY.has(m)) return; (ZONES[m] || []).forEach(([seg, side, a, b]) => (o[seg] ||= []).push([front && side !== "x" ? "x" : side, a, b])); }); return o; };
  return (move._w = { p: z(p), s: z(s.filter((m) => !p.includes(m))) });
}
const wAt = (prof, t, i) => { for (let k = 1; k < prof.length; k++) if (t <= prof[k][0]) { const [t0] = prof[k - 1], [t1] = prof[k]; const u = (t - t0) / (t1 - t0 || 1); return prof[k - 1][i] + (prof[k][i] - prof[k - 1][i]) * u; } return prof[prof.length - 1][i]; };
const smooth = (pts, S) => { const P2 = pts.map(S).map(([x, y]) => [+x, +y]); const n = P2.length; const mid = (a, b) => [((a[0] + b[0]) / 2).toFixed(1), ((a[1] + b[1]) / 2).toFixed(1)];
  let d = `M${mid(P2[n - 1], P2[0]).join(" ")}`; for (let i = 0; i < n; i++) d += `Q${P2[i][0].toFixed(1)} ${P2[i][1].toFixed(1)} ${mid(P2[i], P2[(i + 1) % n]).join(" ")}`; return d + "Z"; };
// spine(t) -> { c: centre, u: unit tangent, n: unit normal towards the front }
function lineSpine(a, b, flip) { const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1; const u = [dx / len, dy / len]; const n = flip ? [u[1], -u[0]] : [-u[1], u[0]]; return (t) => ({ c: [a[0] + dx * t, a[1] + dy * t], u, n }); }
const at = (sp, t, w) => { const { c, n } = sp(t); return [c[0] + n[0] * w, c[1] + n[1] * w]; };
function outline(sp, prof) {
  const T = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]; const pts = T.map((t) => at(sp, t, wAt(prof, t, 1)));
  const cap = (t, sgn) => { const { c, u, n } = sp(t); const f = wAt(prof, t, 1), b = wAt(prof, t, 2), r = (f + b) / 2 * 0.9; const out = [];
    for (const deg of [30, 60, 90, 120, 150]) { const ph = deg * Math.PI / 180, cs = Math.cos(ph), w = cs > 0 ? f : b; const pp = sgn > 0 ? [cs, Math.sin(ph)] : [-cs, Math.sin(ph)];
      out.push([c[0] + n[0] * pp[0] * w + u[0] * sgn * pp[1] * r, c[1] + n[1] * pp[0] * w + u[1] * sgn * pp[1] * r]); } return out; };
  return [...pts, ...cap(1, 1), ...T.slice().reverse().map((t) => at(sp, t, -wAt(prof, t, 2))), ...cap(0, -1)];
}
function zone(sp, prof, [side, a, b], full = false) {
  const T = [0, 0.2, 0.4, 0.6, 0.8, 1].map((u) => a + (b - a) * u); const k = full ? 1.01 : 0.94;
  const edge = (t, s) => at(sp, t, s > 0 ? wAt(prof, t, 1) * k : -wAt(prof, t, 2) * k);
  if (side === "x") return [...T.map((t) => edge(t, 1)), ...T.slice().reverse().map((t) => edge(t, -1))];
  const s = side === "f" ? 1 : -1; const inner = (t) => at(sp, t, s * (s > 0 ? wAt(prof, t, 1) : wAt(prof, t, 2)) * (full ? 0 : 0.12));
  return [...T.map((t) => edge(t, s)), ...T.slice().reverse().map(inner)];
}

function drawPose(svg, move, pose) {
  const front = move.view === "front";
  const showProps = svg.closest(".move")?.dataset.props !== "0";
  const j = joints(pose, front);
  const off = place(move, j, pose);
  const S = (p) => [(p[0] + off.dx).toFixed(1), (GROUND - (p[1] + off.dy)).toFixed(1)];
  const seg = (a, b) => { const [x1, y1] = S(a), [x2, y2] = S(b); return `M${x1} ${y1}L${x2} ${y2}`; };
  const set = (cls, d) => { const el = svg.querySelector("." + cls); if (el) el.setAttribute("d", d); };
  const work = workOf(move);
  // one limb part: its shape plus primary/secondary muscle overlays
  const part = (name, segName, sp, prof) => {
    set(`m-${name}`, smooth(outline(sp, prof), S));
    set(`m-${name}-p`, (work.p[segName] || []).map((z) => smooth(zone(sp, prof, z), S)).join(""));
    set(`m-${name}-s`, (work.s[segName] || []).map((z) => smooth(zone(sp, prof, z), S)).join(""));
  };
  [["n", 0], ["f", 1]].forEach(([w, i]) => {
    const L2 = j.legs[i], A = j.arms[i];
    part(`thigh-${w}`, "thigh", lineSpine(L2.h, L2.k), PROF.thigh);
    part(`shin-${w}`, "shin", lineSpine(L2.k, L2.a), PROF.shin);
    set(`m-shoe-${w}`, smooth(outline(lineSpine(L2.a, L2.t), PROF.foot), S));
    part(`uarm-${w}`, "uarm", lineSpine(A.s, A.e), PROF.uarm);
    part(`farm-${w}`, "farm", lineSpine(A.e, A.h), PROF.farm);
  });
  // torso: follows the spine curve (tb rounds the back); shorts low, bare midriff, crop top over the chest
  const tb = pose.tb || 0; const mid = [(j.hip[0] + j.sh[0]) / 2, (j.hip[1] + j.sh[1]) / 2];
  const nn = rad(pose.torso + 90); const ctrl = [mid[0] + Math.cos(nn) * tb, mid[1] + Math.sin(nn) * tb];
  const tsp = (t) => { const c = [(1 - t) ** 2 * j.hip[0] + 2 * (1 - t) * t * ctrl[0] + t * t * j.sh[0], (1 - t) ** 2 * j.hip[1] + 2 * (1 - t) * t * ctrl[1] + t * t * j.sh[1]];
    const d = [2 * (1 - t) * (ctrl[0] - j.hip[0]) + 2 * t * (j.sh[0] - ctrl[0]), 2 * (1 - t) * (ctrl[1] - j.hip[1]) + 2 * t * (j.sh[1] - ctrl[1])]; const len = Math.hypot(d[0], d[1]) || 1; const u = [d[0] / len, d[1] / len];
    return { c, u, n: [u[1], -u[0]] }; };
  const tp = front ? PROF.torsoF : PROF.torso;
  set("m-torso", smooth(outline(tsp, tp), S));
  set("m-waist", smooth(zone(tsp, tp, ["x", 0, front ? 0.27 : 0.3], true), S));
  set("m-top", smooth(zone(tsp, tp, ["x", front ? 0.46 : 0.44, 0.97], true), S));
  set("m-torso-p", (work.p.torso || []).map((z) => smooth(zone(tsp, tp, z), S)).join(""));
  set("m-torso-s", (work.s.torso || []).map((z) => smooth(zone(tsp, tp, z), S)).join(""));
  set("m-neck", seg(j.sh, j.neck));
  const [hx, hy] = S(j.head);
  const hair = svg.querySelector(".m-hair"), bn = svg.querySelector(".m-bun"), hd = svg.querySelector(".m-head");
  if (front) {
    const up = rad(pose.head);
    hair.setAttribute("cx", (+hx + Math.cos(up) * 1.8).toFixed(1)); hair.setAttribute("cy", (+hy - Math.sin(up) * 1.8).toFixed(1));
    bn.setAttribute("cx", (+hx + Math.cos(up) * HEAD_R * 1.3).toFixed(1)); bn.setAttribute("cy", (+hy - Math.sin(up) * HEAD_R * 1.3).toFixed(1));
  } else {
    const back = rad(pose.head + 90), bun = rad(pose.head + 40);
    hair.setAttribute("cx", (+hx + Math.cos(back) * 2.4).toFixed(1)); hair.setAttribute("cy", (+hy - Math.sin(back) * 2.4).toFixed(1));
    bn.setAttribute("cx", (+hx + Math.cos(bun) * HEAD_R * 1.25).toFixed(1)); bn.setAttribute("cy", (+hy - Math.sin(bun) * HEAD_R * 1.25).toFixed(1));
  }
  hd.setAttribute("cx", hx); hd.setAttribute("cy", hy);

  // moving lines: cables, bands, ropes, machine bars
  const lines = svg.querySelector(".m-lines");
  if (lines) {
    const pt = (name) => S({ hand: j.arms[0].h, hand1: j.arms[1].h, toe: j.legs[0].t, toe1: j.legs[1].t, ankle: j.legs[0].a, knee: j.legs[0].k, knee1: j.legs[1].k, hip: j.hip, sh: j.sh }[name]);
    const mid2 = (a, b) => { const p = pt(a), r = pt(b); return [((+p[0] + +r[0]) / 2).toFixed(1), ((+p[1] + +r[1]) / 2).toFixed(1)]; };
    const anchor0 = (s) => { const j0 = joints(move.frames[0], front); const o0 = place(move, j0, move.frames[0]); const base = { hip: j0.hip, sh: j0.sh, hand: j0.arms[0].h, ankle: j0.legs[0].a, toe: j0.legs[0].t, head: j0.head }[s.at || "sh"];
      return [(base[0] + o0.dx + (s.dx || 0)).toFixed(1), (GROUND - (base[1] + o0.dy) + (s.dy || 0)).toFixed(1)]; };
    lines.innerHTML = (move.lines || []).map((l) => {
      if (l.type === "cable") { const a = l.both ? mid2("hand", "hand1") : pt(l.from || "hand"); const b = anchor0(l); return `<path class="m-cable" d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}"/>`; }
      if (l.type === "band") { const a = pt(l.from), b = pt(l.to); return `<path class="m-band" d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}"/>`; }
      if (l.type === "handbar") { const a = pt("hand"), b = pt("hand1"); return `<path class="m-cable thick" d="M${(+a[0] - 6).toFixed(1)} ${a[1]}L${(+b[0] + 6).toFixed(1)} ${b[1]}"/>`; }
      if (l.type === "rope") { const a = pt("hand"), b = pt("hand1"); const cy = GROUND + 6 - (pose.rp || 0) * (GROUND + 6 - (+hy - 24)); const cx = (+a[0] + +b[0]) / 2 + (front ? 0 : 6);
        return `<path class="m-rope" d="M${a[0]} ${a[1]}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b[0]} ${b[1]}"/>`; }
      if (l.type === "plate") { const a = pt("ankle"), b = pt("toe"); const dxp = +b[0] - +a[0], dyp = +b[1] - +a[1]; const len = Math.hypot(dxp, dyp) || 1; const ux = dxp / len, uy = dyp / len;
        return `<path class="m-cable thick" d="M${(+a[0] - ux * 10).toFixed(1)} ${(+a[1] - uy * 10).toFixed(1)}L${(+b[0] + ux * 10).toFixed(1)} ${(+b[1] + uy * 10).toFixed(1)}" transform="translate(${(-uy * -4).toFixed(1)} ${(ux * -4).toFixed(1)})"/>`; }
      return "";
    }).join("");
  }

  const props = svg.querySelector(".m-props");
  if (move.prop && showProps) {
    const hands = [S(j.arms[0].h), S(j.arms[1].h)]; const hm = [((+hands[0][0] + +hands[1][0]) / 2).toFixed(1), ((+hands[0][1] + +hands[1][1]) / 2).toFixed(1)];
    const db = ([x, y], cls = "") => `<rect x="${(x - 7).toFixed(1)}" y="${(y - 3).toFixed(1)}" width="13" height="5" rx="2.5" class="${cls}"/>`;
    const plate = ([x, y], r = 11) => `<circle cx="${x}" cy="${y}" r="${r}" class="plate"/><circle cx="${x}" cy="${y}" r="3"/>`;
    props.innerHTML = {
      goblet: `<circle cx="${hm[0]}" cy="${(hm[1] - 3).toFixed(1)}" r="6"/>`,
      kettlebell: `<circle cx="${hands[0][0]}" cy="${(+hands[0][1] + 6).toFixed(1)}" r="6"/>`,
      dumbbells: db(hands[0]) + db(hands[1], "far"),
      db1: db(hm), ball: `<circle cx="${hm[0]}" cy="${hm[1]}" r="8"/>`,
      barbell: plate(hm), barback: plate(S(j.sh)), barhip: plate(S(j.hip), 10),
    }[move.prop] || "";
  } else props.innerHTML = "";
}

// Public: markup for a demo. Animated ones are picked up by startMoves().
export function moveSvg(key, { animate = true, label = true, props = true } = {}) {
  const m = MOVES[key]; if (!m) return "";
  return `<figure class="move ${animate ? "anim" : ""} ${m.view === "front" ? "front" : ""}" data-move="${key}" data-props="${props ? 1 : 0}">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${m.label} demonstration">
      <circle class="m-ring" cx="${W - 34}" cy="40" r="46"/>
      <line class="m-ground" x1="14" y1="${GROUND + 1.5}" x2="${W - 14}" y2="${GROUND + 1.5}"/>
      ${m.mat ? `<rect class="m-mat" x="10" y="${GROUND - 2}" width="${W - 20}" height="6" rx="3"/>` : ""}
      <g class="m-scene">${sceneSvg(m)}</g>
      <path class="m-uarm-f m-skin-f"/><path class="m-uarm-f-s m-mus s"/><path class="m-uarm-f-p m-mus p"/><path class="m-farm-f m-skin-f"/><path class="m-farm-f-s m-mus s"/><path class="m-farm-f-p m-mus p"/>
      <path class="m-thigh-f m-legs-f"/><path class="m-thigh-f-s m-mus s"/><path class="m-thigh-f-p m-mus p"/><path class="m-shin-f m-legs-f"/><path class="m-shin-f-s m-mus s"/><path class="m-shin-f-p m-mus p"/><path class="m-shoe-f"/>
      <g class="m-lines"></g><g class="m-props"></g>
      <path class="m-torso m-skin"/><path class="m-waist"/><path class="m-top"/><path class="m-torso-s m-mus s"/><path class="m-torso-p m-mus p"/><path class="m-neck m-skin"/>
      <circle class="m-bun" r="${(HEAD_R * 0.62).toFixed(1)}"/><circle class="m-hair" r="${(HEAD_R + 1).toFixed(1)}"/><circle class="m-head" r="${HEAD_R}"/>
      <path class="m-thigh-n m-legs"/><path class="m-thigh-n-s m-mus s"/><path class="m-thigh-n-p m-mus p"/><path class="m-shin-n m-legs"/><path class="m-shin-n-s m-mus s"/><path class="m-shin-n-p m-mus p"/><path class="m-shoe-n"/>
      <path class="m-uarm-n m-skin"/><path class="m-uarm-n-s m-mus s"/><path class="m-uarm-n-p m-mus p"/><path class="m-farm-n m-skin"/><path class="m-farm-n-s m-mus s"/><path class="m-farm-n-p m-mus p"/>
    </svg>${label ? `<figcaption>${esc(m.label)}: animated demo. Your coach's video replaces it.</figcaption>` : ""}</figure>`;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Two keyframes ping-pong with a short hold at each end. More keyframes play in order (loop: true wraps round).
function poseAt(m, t) {
  const F = m.frames; const x = ((t % 1) + 1) % 1;
  const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
  if (F.length === 2 && !m.loop) {
    const hold = 0.18; let u;
    if (x < hold) u = 0; else if (x < 0.5) u = (x - hold) / (0.5 - hold);
    else if (x < 0.5 + hold) u = 1; else u = 1 - (x - 0.5 - hold) / (0.5 - hold);
    return blend(F[0], F[1], ease(u));
  }
  const seq = m.loop ? [...F, F[0]] : [...F, ...F.slice(0, -1).reverse()];
  const n = seq.length - 1; const p = x * n; const i = Math.min(n - 1, Math.floor(p)); const f = p - i;
  const hold = m.loop ? 0.12 : 0.2; const u = f < hold ? 0 : (f - hold) / (1 - hold);
  return blend(seq[i], seq[i + 1], m.loop ? u : ease(u));
}

const live = new Set(); let running = false, t0 = 0;
export function startMoves(root = document) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.querySelectorAll(".move").forEach((f) => {
    const m = MOVES[f.dataset.move]; if (!m) return;
    const anim = f.classList.contains("anim") && !reduce;
    drawPose(f.querySelector("svg"), m, poseAt(m, anim ? 0 : m.still ?? 0.5));
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
