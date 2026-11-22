// Muscles worked: a primary/secondary list per animation, a fallback from the exercise's muscle group,
// and an original front/back body map that lights up the muscles in use.

export const NAMES = {
  chest: "Chest", delts: "Front shoulders", sidedelts: "Side shoulders", reardelts: "Rear shoulders",
  biceps: "Biceps", triceps: "Triceps", forearms: "Forearms", abs: "Abs", obliques: "Obliques",
  hipflexors: "Hip flexors", quads: "Quads", adductors: "Inner thighs", abductors: "Outer hips",
  hamstrings: "Hamstrings", glutes: "Glutes", calves: "Calves", shins: "Shins", lats: "Lats",
  traps: "Upper back", lowerback: "Lower back",
};

// [primary, secondary]
const M = (p, s = "") => [p.split(" ").filter(Boolean), s.split(" ").filter(Boolean)];
const LEGS = M("quads glutes", "hamstrings adductors calves abs");
const HINGE = M("hamstrings glutes", "lowerback forearms traps");
const LUNGE = M("quads glutes", "hamstrings adductors calves");
const BRIDGE = M("glutes", "hamstrings lowerback abs");
const PUSH = M("chest triceps delts", "abs");
const ROW = M("lats traps", "reardelts biceps forearms");
const CORE = M("abs", "obliques hipflexors");
const CARDIO = M("quads calves", "glutes hamstrings abs");

export const MUSCLES = {
  squat: LEGS, bwsquat: LEGS, sumo: M("quads glutes adductors", "hamstrings calves"), backsquat: M("quads glutes", "hamstrings lowerback abs adductors"),
  sitstand: M("quads glutes", "hamstrings calves"), wallsit: M("quads", "glutes calves"), jumpsquat: M("quads glutes calves", "hamstrings abs"),
  thruster: M("quads glutes delts", "triceps abs traps"), hinge: HINGE, slrdl: M("hamstrings glutes", "lowerback abductors calves"),
  rdlbar: HINGE, deadlift: M("glutes hamstrings lowerback", "quads traps forearms lats"), kbdead: HINGE, swing: M("glutes hamstrings", "lowerback delts abs forearms"),
  lunge: LUNGE, bulgarian: LUNGE, laterallunge: M("adductors glutes quads", "hamstrings"), stepup: LUNGE, stepknee: M("quads glutes", "hipflexors calves abs"),
  calf: M("calves"), seatcalf: M("calves"), legpress: M("quads glutes", "hamstrings adductors"), legext: M("quads"), seatext: M("quads", "hipflexors"),
  legcurl: M("hamstrings", "calves"), lateralwalk: M("abductors glutes", "quads"), abductor: M("abductors glutes"), cablekick: M("glutes", "hamstrings lowerback"),
  bridge: BRIDGE, slbridge: BRIDGE, bridgemarch: M("glutes", "hamstrings abs hipflexors"), hipthrust: M("glutes", "hamstrings quads"), barthrust: M("glutes", "hamstrings quads"),
  clamshell: M("abductors glutes"), donkey: M("glutes", "hamstrings abs"), hydrant: M("abductors glutes", "abs"), birddog: M("lowerback glutes abs", "reardelts hamstrings"),
  catcow: M("lowerback abs"), thread: M("traps reardelts", "obliques"), child: M("lats lowerback", "glutes"), bearplank: M("abs delts", "quads triceps"),
  pushup: PUSH, kneepush: PUSH, wallpush: PUSH, inclinepush: PUSH, pike: M("delts triceps", "chest traps"), downdog: M("hamstrings calves delts", "lats lowerback"),
  plank: M("abs delts", "obliques triceps"), plankhold: M("abs", "delts obliques glutes"), sideplank: M("obliques", "abs abductors sidedelts"), mountain: M("abs hipflexors", "delts quads"),
  renegade: M("lats abs", "biceps obliques triceps"), press: M("delts triceps", "sidedelts traps abs"), seatpress: M("delts triceps", "sidedelts traps"), reach: M("delts lats", "abs"),
  latraise: M("sidedelts", "traps delts"), frontraise: M("delts", "sidedelts chest"), reardelt: M("reardelts", "traps"), pullapart: M("reardelts traps"), facepull: M("reardelts traps", "biceps"),
  pushdown: M("triceps", "forearms"), ohext: M("triceps"), curl: M("biceps", "forearms"), cablecurl: M("biceps", "forearms"), dip: M("triceps", "chest delts"),
  bench: M("chest triceps", "delts"), barbench: M("chest triceps", "delts"), floorpress: M("chest triceps", "delts"), fly: M("chest", "delts"), chestpress: M("chest triceps", "delts"), bandpress: M("chest triceps", "delts abs"),
  shadowbox: M("delts", "abs obliques triceps calves"), row: ROW, bandrow: ROW, cablerow: ROW, seatbandrow: ROW, latpull: M("lats", "biceps reardelts traps"), pullup: M("lats biceps", "traps forearms abs"),
  trxrow: ROW, facedown: M("lowerback glutes", "hamstrings traps reardelts"), backext: M("lowerback glutes", "hamstrings"),
  deadbug: CORE, hollow: CORE, crunch: M("abs", "obliques"), revcrunch: M("abs", "hipflexors"), bicycle: M("obliques abs", "hipflexors"), heeltap: M("obliques", "abs"),
  legraise: M("abs hipflexors"), flutter: M("abs hipflexors"), russian: M("obliques", "abs"), pallof: M("obliques abs", "delts"), seattuck: M("abs hipflexors"),
  highknees: M("hipflexors quads calves", "abs glutes"), march: M("hipflexors", "abs calves"), buttkick: M("hamstrings calves", "quads"), walk: CARDIO, carry: M("forearms traps abs", "obliques glutes"), suitcase: M("obliques forearms", "traps abs"),
  heeltoe: M("calves", "abs abductors"), treadmill: CARDIO, bike: M("quads", "hamstrings calves glutes"), rower: M("lats quads", "hamstrings glutes biceps"),
  jacks: M("calves abductors delts", "quads glutes"), stepjack: M("abductors calves delts", "quads"), shuffle: M("abductors quads", "calves glutes"), skater: M("glutes quads abductors", "calves"), skip: M("calves", "quads forearms delts"),
  burpee: M("quads chest delts", "triceps abs glutes"), squatthrust: M("quads abs", "delts chest"), slam: M("lats abs delts", "glutes triceps"),
  stretch: M("hipflexors", "quads obliques"), kneelhip: M("hipflexors", "quads"), calfstretch: M("calves"), hamstring: M("hamstrings", "lowerback calves"), quadstretch: M("quads", "hipflexors"),
  doorway: M("chest", "delts"), crossbody: M("reardelts", "traps"), figure4: M("glutes", "abductors"), pigeon: M("glutes", "hipflexors abductors"), hip9090: M("glutes abductors adductors"),
  armcircles: M("delts sidedelts reardelts"), legswing: M("hipflexors hamstrings", "glutes adductors"), ankle: M("calves shins"), slstand: M("calves abductors", "abs glutes"), seatmarch: M("hipflexors", "abs"),
};

// Free-text muscle groups (custom exercises) fall back to keyword matching.
const WORDS = [
  [/glute|butt/, "glutes"], [/hamstring/, "hamstrings"], [/quad|thigh/, "quads"], [/calf|calves/, "calves"], [/inner thigh|adduct/, "adductors"],
  [/outer hip|abduct|hip/, "abductors"], [/chest|pec/, "chest"], [/rear delt/, "reardelts"], [/side delt|lateral delt/, "sidedelts"], [/shoulder|delt/, "delts"],
  [/bicep/, "biceps"], [/tricep/, "triceps"], [/forearm|grip/, "forearms"], [/oblique/, "obliques"], [/core|abs|abdom/, "abs"], [/lower back/, "lowerback"],
  [/lat|back/, "lats"], [/trap|upper back/, "traps"], [/legs?|lower body/, "quads"], [/arm/, "biceps"], [/full body/, "quads"], [/shin|ankle/, "shins"],
];

export function musclesFor(ex, moveKey) {
  if (Array.isArray(ex?.muscles) && ex.muscles.length) return [ex.muscles, []];
  if (moveKey && MUSCLES[moveKey]) return MUSCLES[moveKey];
  const txt = `${ex?.muscle_group || ""}`.toLowerCase(); const found = [];
  for (const [re, m] of WORDS) if (re.test(txt) && !found.includes(m)) found.push(m);
  if (/full body/.test(txt)) return [["quads", "glutes", "chest", "abs"], ["delts", "lats"]];
  return [found, []];
}

export const muscleNames = (ids) => ids.map((m) => NAMES[m] || m).filter((v, i, a) => a.indexOf(v) === i);

// ---------- body map (front and back, 100 x 210 each), left halves mirrored to the right
const FRONT = {
  delts: '<ellipse cx="29.5" cy="43" rx="6.8" ry="7.6" transform="rotate(18 29.5 43)"/>',
  traps: '<path d="M45 30 Q39 33 34.5 36.5 L44 38 Z"/>',
  chest: '<path d="M49.6 37 L37.5 37.5 Q31.5 41 32.8 50 Q39 57.5 49.6 55.5 Z"/>',
  biceps: '<ellipse cx="26.6" cy="59" rx="4.4" ry="9.6" transform="rotate(10 26.6 59)"/>',
  forearms: '<path d="M27.5 70 Q20 73 19.5 86 Q20.5 92 22 94 L25.5 94 Q28.5 82 28.8 72 Z"/>',
  abs: '<path d="M49.6 58.5 L43.5 58.5 Q42.6 75 43.8 92 L49.6 94 Z"/>',
  obliques: '<path d="M42.2 59 Q35.8 67 37 80 Q38.2 88 42.6 91 Q41.4 74 42.2 59 Z"/>',
  hipflexors: '<path d="M48.6 95.5 L41 93.5 Q38.5 99 40.6 104 Q45 102 48.6 99.5 Z"/>',
  abductors: '<path d="M38.8 92.5 Q33.4 97 33.6 108 L38.8 104 Q37.5 98 38.8 92.5 Z"/>',
  quads: '<path d="M40.4 105.5 Q34.3 109 34.6 122 Q35.6 139 40.2 150 L45.4 150.5 Q47.6 136 47.4 120 Q46.4 109 40.4 105.5 Z"/>',
  adductors: '<path d="M49.2 101 Q47 104 47.8 116 Q48.6 126 49.2 130 Z"/>',
  shins: '<path d="M40.3 158 Q37.8 172 39.6 192 L43.4 192 Q45.6 173 44.8 158 Z"/>',
};
const BACK = {
  traps: '<path d="M50 27 Q43 31 36 37.5 L43.5 42 L50 60 Z"/>',
  reardelts: '<ellipse cx="29.5" cy="43" rx="6.8" ry="7.6" transform="rotate(18 29.5 43)"/>',
  triceps: '<ellipse cx="26.6" cy="59" rx="4.4" ry="9.6" transform="rotate(10 26.6 59)"/>',
  forearms: FRONT.forearms,
  lats: '<path d="M42.5 44 Q35 49 35.6 63 Q39 74 47.8 80 L48.6 62 Z"/>',
  lowerback: '<path d="M49.6 80.5 L43 77.5 Q41.2 86 42.4 93 L49.6 95 Z"/>',
  glutes: '<path d="M49.6 96 Q40 94 36.4 100 Q35.6 109 40.4 112 Q46 113.5 49.6 111 Z"/>',
  hamstrings: '<path d="M47.6 114.5 Q38.6 113.5 35.6 120 Q35.6 139 40.4 150 L45.6 150.5 Q48.6 133 47.6 114.5 Z"/>',
  calves: '<path d="M40.6 158 Q35.6 165 36.6 177 Q38.6 186 41.6 188 Q45.6 182 45.6 170 Q45.6 161 43.6 158 Z"/>',
  abductors: '<path d="M38.4 92.5 Q34 96 34.8 100 L38.4 98 Z"/>',
};
// shared silhouette (one half, mirrored)
const BODY = '<circle cx="50" cy="15" r="10.5"/><path d="M50 25.5 L45 26.5 L45 31 Q36 33.5 30 36.5 Q22.5 40 22.4 50 Q21.5 62 22 70 Q17.6 80 17.8 92 Q18.4 98 20.6 100 L26 99.4 Q29.2 86 30.4 73 Q32.2 62 33.4 56 Q35.6 66 36.4 76 Q36.6 86 34.2 95 Q31.6 104 33 122 Q34.4 140 38.4 154 Q35.4 168 37 184 Q37.6 192 36.4 198 L44.6 199 Q45.2 192 45 184 Q47.4 168 46.6 154 Q49.2 138 49.6 118 L50 108 Z"/>';

function half(parts, sel) {
  return Object.entries(parts).map(([k, d]) => `<g class="mm-r ${sel.p.has(k) ? "p" : sel.s.has(k) ? "s" : ""}" data-m="${k}">${d}</g>`).join("");
}
function view(parts, sel, label, x) {
  const h = half(parts, sel);
  return `<g transform="translate(${x} 0)"><g class="mm-body">${BODY}<g transform="matrix(-1 0 0 1 100 0)">${BODY}</g></g>${h}<g transform="matrix(-1 0 0 1 100 0)">${h}</g><text x="50" y="208" text-anchor="middle" class="mm-lab">${label}</text></g>`;
}
export function muscleMapSvg([primary, secondary], { compact = false } = {}) {
  const sel = { p: new Set(primary), s: new Set(secondary.filter((m) => !primary.includes(m))) };
  const names = muscleNames(primary), sec = muscleNames([...sel.s]);
  return `<div class="mmap ${compact ? "compact" : ""}">
    <svg viewBox="0 0 210 212" role="img" aria-label="Muscles worked: ${names.join(", ") || "not set"}">${view(FRONT, sel, "Front", 0)}${view(BACK, sel, "Back", 110)}</svg>
    ${compact ? "" : `<div class="mm-key">${names.length ? `<p><span class="mm-dot p"></span><b>Main:</b> ${names.join(", ")}</p>` : `<p class="muted">Muscles not set for this exercise.</p>`}${sec.length ? `<p><span class="mm-dot s"></span><b>Also:</b> ${sec.join(", ")}</p>` : ""}</div>`}
  </div>`;
}
