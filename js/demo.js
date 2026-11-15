// Demo mode: an in-memory stand-in for Supabase with sample data, so the app can be
// tried without any setup. Nothing is saved — refreshing resets the demo.
// Only used when CONFIG.DEMO is true.

const TRAINER = "t0000000-0000-0000-0000-000000000001";
const CLIENT = "c0000000-0000-0000-0000-000000000001";
const CLIENT2 = "c0000000-0000-0000-0000-000000000002";
const PENDING = "c0000000-0000-0000-0000-000000000003";

let n = 0;
const uid = () => "d" + (++n).toString(16).padStart(7, "0") + "-0000-4000-8000-" + Date.now().toString(16).slice(-12).padStart(12, "0");
const localIso = (d) => new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return localIso(d); };
const at = (offset, hour = 7) => `${day(offset)}T${String(hour).padStart(2, "0")}:15:00`;

function seed() {
  const db = {
    profiles: [
      { id: TRAINER, full_name: "Your coach", email: "coach@demo", role: "trainer", trainer_id: null, equipment: [], tracks: [], library_free: false, plan: "free", created_at: at(-90) },
      { id: CLIENT, full_name: "Thandi Mokoena", email: "thandi@demo", role: "client", trainer_id: TRAINER, goal: "Lose 6 kg and deadlift my body weight",
        equipment: ["Dumbbells", "Resistance bands", "Yoga mat"], tracks: ["exercise", "nutrition"], daily_points: 32, goal_weight_kg: 78,
        plan: "library", access_until: day(11), popia_consent_at: at(-40), created_at: at(-40) },
      { id: CLIENT2, full_name: "Jess van Wyk", email: "jess@demo", role: "client", trainer_id: TRAINER, goal: "Run 10 km", equipment: ["Full gym"],
        tracks: ["exercise"], plan: "pt", access_until: day(20), popia_consent_at: at(-20), created_at: at(-20) },
      { id: PENDING, full_name: "Sipho Dlamini", email: "sipho@demo", role: "client", trainer_id: null, equipment: [], tracks: ["exercise"],
        plan: "free", popia_consent_at: at(-1), created_at: at(-1) },
    ],
    exercises: [], workouts: [], workout_items: [], set_logs: [], activities: [], body_metrics: [],
    food_logs: [], custom_foods: [], messages: [], challenge_completions: [], checkins: [],
  };
  const ex = (name, muscle_group, equipment, cues, instructions) => { const e = { id: uid(), trainer_id: TRAINER, name, muscle_group, equipment, cues, instructions, video_path: null, categories: [], created_at: at(-60) }; db.exercises.push(e); return e; };
  const squat = ex("Goblet squat", "Legs", ["Kettlebell"], ["Chest up, elbows inside knees", "Sit between your heels", "Drive through the middle of your foot", "Breathe out as you stand"], "Hold the bell at your chest. Feet just wider than hips, toes slightly out.");
  const rdl = ex("Dumbbell Romanian deadlift", "Glutes", ["Dumbbells"], ["Soft knees, push your hips back", "Keep the weights close to your legs", "Flat back, chest proud", "Squeeze your glutes to stand"], "Hinge at the hips until you feel your hamstrings stretch.");
  const lunge = ex("Reverse lunge", "Legs", [], ["Step back long enough for two right angles", "Front knee tracks over your toes", "Push through the front heel"], "Alternate legs, or finish one side first.");
  const bridge = ex("Banded glute bridge", "Glutes", ["Resistance bands", "Yoga mat"], ["Press knees out against the band", "Ribs down, squeeze at the top", "Pause for one second"], "Band just above the knees, heels close to your bum.");
  const row = ex("Single-arm dumbbell row", "Back", ["Dumbbells", "Bench"], ["Pull your elbow to your hip", "Keep your shoulders square", "Control the weight down"], "One hand and knee on the bench, back flat.");
  const press = ex("Dumbbell shoulder press", "Shoulders", ["Dumbbells"], ["Brace your core, don't arch", "Press up and slightly back", "Lower to ear height"], "Seated or standing.");
  const pushup = ex("Push-up", "Chest", [], ["Hands under shoulders", "Body in one straight line", "Lower your chest, not your hips"], "Drop to your knees to finish a set with good form.");
  const plank = ex("Plank shoulder taps", "Core", ["Yoga mat"], ["Feet wide for balance", "Hips stay still", "Tap slowly, breathe steadily"], "From a high plank, tap the opposite shoulder.");
  ex("Deadbug", "Core", ["Yoga mat"], ["Low back pressed into the floor", "Move slowly, breathe out as you extend"], "Opposite arm and leg lower together.");
  ex("Kettlebell swing", "Full body", ["Kettlebell"], ["Hinge, don't squat", "Snap the hips", "Bell floats to chest height"], "Power comes from your hips, not your arms.");
  ex("Skater hops", "Cardio", [], ["Land softly on the ball of your foot", "Swing your arms for rhythm"], "Bound side to side.");
  ex("World's greatest stretch", "Mobility", ["Yoga mat"], ["Long lunge, elbow to instep", "Rotate and reach to the ceiling", "Breathe into each position"], "Five slow reps a side.").reward_streak = 7;
  ex("Band pull-apart", "Shoulders", ["Resistance bands"], ["Arms straight, shoulders down", "Squeeze between your shoulder blades"], "Hold the band at shoulder height.");
  ex("Bulgarian split squat", "Legs", ["Bench", "Dumbbells"], ["Most weight on the front leg", "Drop straight down", "Tall torso"], "Back foot on a bench.").reward_streak = 30;

  const tag = (n, cats) => { const e = db.exercises.find((x) => x.name === n); if (e) e.categories = cats; };
  tag("World's greatest stretch", ["Warm-up", "Mobility"]); tag("Band pull-apart", ["Warm-up"]); tag("Deadbug", ["Warm-up", "Chill set"]);
  tag("Goblet squat", ["Main set"]); tag("Dumbbell Romanian deadlift", ["Main set"]); tag("Single-arm dumbbell row", ["Main set"]);
  tag("Kettlebell swing", ["Finisher"]); tag("Skater hops", ["Finisher"]); tag("Banded glute bridge", ["Chill set", "Glute focus"]);
  tag("Reverse lunge", ["Glute focus"]); tag("Plank shoulder taps", ["Chill set"]); tag("Bulgarian split squat", ["Glute focus"]);

  // Past sessions: progressive weights, so personal bests show up.
  const pastPlans = [
    [-27, "Lower body A", [[squat, 3, 10, 10], [rdl, 3, 10, 8], [bridge, 3, 15, null]]],
    [-24, "Upper body A", [[row, 3, 10, 8], [press, 3, 10, 5], [pushup, 3, 8, null]]],
    [-20, "Lower body A", [[squat, 3, 10, 12], [rdl, 3, 10, 10], [lunge, 3, 10, null]]],
    [-17, "Upper body A", [[row, 3, 10, 10], [press, 3, 10, 6], [pushup, 3, 10, null]]],
    [-13, "Lower body B", [[squat, 3, 10, 12], [rdl, 3, 10, 12], [bridge, 3, 15, null]]],
    [-9,  "Upper body A", [[row, 3, 12, 10], [press, 3, 10, 7], [plank, 3, 20, null]]],
    [-6,  "Lower body A", [[squat, 3, 10, 14], [rdl, 3, 10, 12], [lunge, 3, 12, null]]],
    [-2,  "Full body",    [[squat, 3, 12, 14], [row, 3, 12, 12], [pushup, 3, 12, null]]],
  ];
  for (const [off, name, items] of pastPlans) {
    const w = { id: uid(), trainer_id: TRAINER, client_id: CLIENT, name, scheduled_date: day(off), notes: null, completed_at: at(off, 8), created_at: at(off - 3) };
    db.workouts.push(w);
    items.forEach(([e, sets, reps, kg], i) => {
      const it = { id: uid(), workout_id: w.id, exercise_id: e.id, position: i, target_sets: sets, target_reps: reps, target_weight_kg: kg, target_seconds: null, rest_seconds: 60, notes: null };
      db.workout_items.push(it);
      for (let k = 1; k <= sets; k++) db.set_logs.push({ id: uid(), workout_item_id: it.id, client_id: CLIENT, set_number: k, reps: reps + (k === 1 ? 1 : 0), weight_kg: kg, seconds: null, logged_at: at(off, 7) });
    });
  }
  // Today's session
  const today = { id: uid(), trainer_id: TRAINER, client_id: CLIENT, name: "Lower body B", scheduled_date: day(0), notes: "Five minutes on the bike first. Go a little heavier on the deadlifts if last week felt easy.", completed_at: null, created_at: at(-1) };
  db.workouts.push(today);
  [[squat, 4, 10, 14, 60], [rdl, 3, 10, 14, 75], [lunge, 3, 12, null, 45], [bridge, 3, 15, null, 45], [plank, 3, null, null, 30]].forEach(([e, s, r, kg, rest], i) =>
    db.workout_items.push({ id: uid(), workout_id: today.id, exercise_id: e.id, position: i, target_sets: s, target_reps: r, target_weight_kg: kg, target_seconds: r ? null : 40, rest_seconds: rest, notes: i === 1 ? "Slow on the way down" : null }));
  db.workouts.push({ id: uid(), trainer_id: TRAINER, client_id: CLIENT, name: "Upper body B", scheduled_date: day(2), notes: null, completed_at: null, created_at: at(-1) });

  // Activities, including two roulette spins (one more earns a badge)
  [[-26, "Walk", 35, 3.2], [-22, "Class", 45], [-19, "Walk", 30, 2.8], [-15, "Run", 28, 4.1], [-11, "Hike", 95, 7.5], [-8, "Walk", 40, 3.6],
   [-5, "Roulette", 5], [-4, "Run", 32, 4.8], [-3, "Roulette", 5], [-1, "Walk", 45, 4.2]]
    .forEach(([off, type, minutes, km]) => db.activities.push({ id: uid(), client_id: CLIENT, activity_date: day(off), type, minutes, distance_km: km || null, notes: type === "Roulette" ? "Kettlebell swing" : null, created_at: at(off, 18) }));
  // Nine daily challenges done (today's earns a badge)
  [-14, -12, -10, -8, -7, -5, -4, -3, -1].forEach((off) => db.challenge_completions.push({ id: uid(), client_id: CLIENT, challenge_date: day(off), challenge: "Daily challenge", created_at: at(off, 12) }));
  // Check-ins (yesterday's was rough, so the coach view shows a flag)
  [[-6, 4, 4, 2], [-5, 3, 3, 3], [-4, 4, 4, 2], [-3, 5, 4, 1], [-2, 4, 3, 3], [-1, 2, 2, 4, "Bad night, legs heavy from Friday"]]
    .forEach(([off, energy, sleep, soreness, note]) => db.checkins.push({ id: uid(), client_id: CLIENT, checkin_date: day(off), energy, sleep, soreness, note: note || null, created_at: at(off, 6) }));
  // Weigh-ins
  [[-35, 85.6], [-28, 85.0], [-21, 84.3], [-14, 83.9], [-7, 83.4], [-1, 82.9]].forEach(([off, kg]) => db.body_metrics.push({ id: uid(), client_id: CLIENT, metric_date: day(off), weight_kg: kg, waist_cm: null, body_fat_pct: null, created_at: at(off) }));
  // Food
  for (let off = -8; off <= 0; off++) {
    if (off === -6) continue;
    const meals = off === 0 ? [["Breakfast", "Overnight oats with amasi and berries", 6]] : [["Breakfast", "Oats", 3], ["Lunch", "Chakalaka shakshuka", 5], ["Dinner", "Peri-peri chicken and butternut traybake", 5], ["Snack", "Biltong", 1]];
    meals.forEach(([meal, food_name, points]) => db.food_logs.push({ id: uid(), client_id: CLIENT, log_date: day(off), meal, food_name, servings: 1, points, created_at: at(off, 9) }));
  }
  // Chat
  [[CLIENT, -2, 9, "Finished the full body session. Squats felt strong today!"], [TRAINER, -2, 10, "Love that. 14 kg for 12 reps is a big jump from where you started. Let's push the deadlifts next."],
   [TRAINER, -1, 17, "New workout is ready for tomorrow: Lower body B."], [CLIENT, -1, 18, "Thanks coach, I'll do it before work."]]
    .forEach(([sender_id, off, h, body]) => db.messages.push({ id: uid(), client_id: CLIENT, sender_id, body, read_at: sender_id === CLIENT ? at(off, h + 1) : null, created_at: at(off, h) }));
  db.messages.push({ id: uid(), client_id: CLIENT2, sender_id: CLIENT2, body: "Can we move Thursday's session to 6pm?", read_at: null, created_at: at(0, 7) });
  return db;
}

const db = seed();
const DEFAULTS = {
  set_logs: () => ({ logged_at: new Date().toISOString() }),
  messages: () => ({ created_at: new Date().toISOString(), read_at: null }),
  activities: () => ({ activity_date: localIso(new Date()), created_at: new Date().toISOString() }),
  food_logs: () => ({ log_date: localIso(new Date()), created_at: new Date().toISOString() }),
  body_metrics: () => ({ metric_date: localIso(new Date()), created_at: new Date().toISOString() }),
  challenge_completions: () => ({ created_at: new Date().toISOString() }),
  workouts: () => ({ created_at: new Date().toISOString(), completed_at: null }),
  exercises: () => ({ created_at: new Date().toISOString(), cues: [], equipment: [] }),
};

// Attach related rows the way Supabase's nested selects do.
function expand(table, row, sel) {
  const r = { ...row };
  if (table === "workouts" && sel.includes("workout_items")) {
    const items = db.workout_items.filter((i) => i.workout_id === row.id);
    r.workout_items = sel.includes("workout_items(count)") ? [{ count: items.length }]
      : items.map((i) => ({ ...i, ...(sel.includes("exercises(") ? { exercises: db.exercises.find((e) => e.id === i.exercise_id) } : {}) }));
  }
  if (table === "set_logs" && sel.includes("workout_items")) {
    const it = db.workout_items.find((i) => i.id === row.workout_item_id);
    const e = it && db.exercises.find((x) => x.id === it.exercise_id);
    r.workout_items = it ? { exercise_id: it.exercise_id, target_reps: it.target_reps, target_weight_kg: it.target_weight_kg, target_seconds: it.target_seconds, exercises: { name: e?.name } } : null;
  }
  return r;
}

class Query {
  constructor(table) { this.t = table; this.f = []; this.op = "select"; this.sel = "*"; this.ret = false; }
  select(sel = "*", opts = {}) { if (this.op === "select") this.sel = sel; else this.ret = true; this.count = opts.count; this.head = opts.head; return this; }
  insert(rows) { this.op = "insert"; this.rows = [].concat(rows); return this; }
  upsert(rows, opts = {}) { this.op = "upsert"; this.rows = [].concat(rows); this.conflict = opts.onConflict; this.skipDup = opts.ignoreDuplicates; return this; }
  update(vals) { this.op = "update"; this.vals = vals; return this; }
  delete() { this.op = "delete"; return this; }
  eq(c, v) { this.f.push((r) => r[c] === v); return this; }
  neq(c, v) { this.f.push((r) => r[c] !== v); return this; }
  is(c, v) { this.f.push((r) => (r[c] ?? null) === v); return this; }
  not(c, _op, v) { this.f.push((r) => (r[c] ?? null) !== v); return this; }
  gte(c, v) { this.f.push((r) => r[c] != null && String(r[c]) >= String(v)); return this; }
  in(c, arr) { this.f.push((r) => arr.includes(r[c])); return this; }
  order(c, o = {}) { this.ord = [c, o.ascending !== false, o.nullsFirst]; return this; }
  limit(k) { this.lim = k; return this; }
  single() { this.one = true; return this; }
  then(res, rej) { return Promise.resolve().then(() => { try { return this.run(); } catch (e) { return { data: null, error: e }; } }).then(res, rej); }
  run() {
    const T = db[this.t] || (db[this.t] = []);
    const match = (r) => this.f.every((fn) => fn(r));
    let out;
    if (this.op === "insert" || this.op === "upsert") {
      out = this.rows.map((row) => {
        const keys = this.conflict ? this.conflict.split(",") : ["id"];
        const existing = this.op === "upsert" && T.find((r) => keys.every((k) => row[k] !== undefined && r[k] === row[k]));
        if (existing) return this.skipDup ? existing : Object.assign(existing, row);
        if (this.t === "challenge_completions" && T.some((r) => r.client_id === row.client_id && r.challenge_date === (row.challenge_date || localIso(new Date()))))
          throw { message: "Already done today" };
        const full = { id: uid(), ...(DEFAULTS[this.t]?.() || {}), ...row }; T.push(full); return full;
      });
    } else if (this.op === "update") {
      out = T.filter(match); out.forEach((r) => Object.assign(r, this.vals));
    } else if (this.op === "delete") {
      out = T.filter(match); db[this.t] = T.filter((r) => !match(r));
    } else {
      out = T.filter(match);
      if (this.ord) {
        const [c, asc, nf] = this.ord;
        out = [...out].sort((a, b) => {
          const x = a[c] ?? null, y = b[c] ?? null;
          if (x === y) return 0; if (x === null) return nf ? -1 : 1; if (y === null) return nf ? 1 : -1;
          return (x < y ? -1 : 1) * (asc ? 1 : -1);
        });
      }
      if (this.lim) out = out.slice(0, this.lim);
      if (this.head) return { data: null, count: out.length, error: null };
      out = out.map((r) => expand(this.t, r, this.sel));
    }
    out = JSON.parse(JSON.stringify(out));
    if (this.one) return out[0] ? { data: out[0], error: null } : { data: null, error: { message: "Not found" } };
    return { data: out, error: null, count: out.length };
  }
}

export function createDemoClient() {
  let session = null; const listeners = [];
  const userFor = (id) => ({ id, email: db.profiles.find((p) => p.id === id)?.email });
  const emit = (ev) => listeners.forEach((cb) => cb(ev, session));
  return {
    from: (t) => new Query(t),
    rpc: async (name) => name === "reward_milestones"
      ? { data: [...new Set(db.exercises.filter((e) => e.reward_streak).map((e) => e.reward_streak))].sort((a, b) => a - b), error: null }
      : { data: null, error: { message: "Not available in the demo" } },
    auth: {
      onAuthStateChange(cb) { listeners.push(cb); setTimeout(() => cb("INITIAL_SESSION", session), 0); return { data: { subscription: { unsubscribe() {} } } }; },
      async getSession() { return { data: { session } }; },
      async signInWithPassword({ email }) {
        const id = email === "coach@demo" ? TRAINER : CLIENT;
        session = { user: userFor(id), access_token: "demo" }; emit("SIGNED_IN"); return { data: { session }, error: null };
      },
      async signUp() { return { data: {}, error: { message: "This is a demo. Use the buttons to look around." } }; },
      async signOut() { session = null; emit("SIGNED_OUT"); return { error: null }; },
      async resetPasswordForEmail() { return { error: { message: "Not available in the demo" } }; },
    },
    storage: { from: () => ({
      createSignedUrl: async () => ({ data: { signedUrl: null } }),
      createSignedUrls: async () => ({ data: [] }),
      upload: async () => ({ error: { message: "Video uploads are switched off in the demo" } }),
      remove: async () => ({}),
    }) },
    functions: { invoke: async (_n, { body }) => ({ data: { cues: [`Set up tall for the ${body.name.toLowerCase()}`, "Brace your core before you move", "Control the lowering for three seconds", "Breathe out on the hardest part", "Stop the set when your form slips"] } }) },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: () => {},
  };
}
