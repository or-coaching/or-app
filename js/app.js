import { CONFIG, BRAND } from "./config.js";
import { FOODS, WEEKLY_BUFFER, RECIPES, calcPoints, dailyBudget } from "./nutrition.js";
import { CHALLENGES, TIPS, BADGES, badgeStats, medal, pickForDate, ROULETTE_UNLOCK_DAYS } from "./engage.js";

// ---------------------------------------------------------------- setup
const SUPABASE_ESM = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
const sb = CONFIG.DEMO ? (await import("./demo.js")).createDemoClient()
  : (await import(SUPABASE_ESM)).createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
document.documentElement.style.setProperty("--primary", BRAND.primary);
document.documentElement.style.setProperty("--bg", BRAND.ink);
document.title = CONFIG.APP_NAME;
$("#brandName").textContent = CONFIG.APP_NAME;
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

const EQUIPMENT = [
  "Full gym", "Dumbbells", "Barbell", "Kettlebell", "Resistance bands", "Bench", "Pull-up bar",
  "Cable machine", "Machines", "Medicine ball", "Step/box", "Yoga mat", "TRX/suspension",
  "Skipping rope", "Treadmill", "Bike",
];
const MUSCLES = ["Legs", "Glutes", "Chest", "Back", "Shoulders", "Arms", "Core", "Full body", "Cardio", "Mobility"];
const ACTIVITY_TYPES = ["Walk", "Run", "Cycle", "Swim", "Class", "Sport", "Hike", "Yoga", "Other"];
// Simple, safe fallbacks when the library has no direct match
const SWAP_HINTS = {
  "Barbell": "use dumbbells or a loaded backpack",
  "Bench": "use the floor, a sturdy step or a couch",
  "Cable machine": "use resistance bands anchored to a door",
  "Machines": "use dumbbells or resistance bands",
  "Kettlebell": "use a single dumbbell held by the end",
  "Pull-up bar": "do band pull-downs or table rows",
  "Dumbbells": "use filled water bottles or a backpack",
  "Medicine ball": "use a dumbbell or a filled backpack",
  "Step/box": "use a sturdy stair",
  "TRX/suspension": "use a sturdy table edge for rows",
  "Treadmill": "walk or run outside",
  "Bike": "brisk walk or skipping instead",
  "Skipping rope": "do jumping jacks or high knees",
};

let session = null;
let me = null;
let myTrainer = null;
let visitLogged = null;
let chatChannel = null;
let charts = [];

// ---------------------------------------------------------------- helpers
function $(s, root = document) { return root.querySelector(s); }
function $$(s, root = document) { return [...root.querySelectorAll(s)]; }
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2600);
}
function render(html) {
  charts.forEach((c) => c.destroy()); charts = [];
  $("#view").innerHTML = html; window.scrollTo(0, 0);
}
function go(path) { location.hash = "#/" + path; }
function initials(name) { return (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(); }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short" }) : ""; }
function fmtTime(d) { return new Date(d).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
const tracksEx = () => (me?.tracks || ["exercise"]).includes("exercise");
const tracksNut = () => (me?.tracks || []).includes("nutrition");
function weekStart(d = new Date()) { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x.toISOString().slice(0, 10); }
function hasLibrary() {
  if (myTrainer?.library_free) return true;
  return ["library", "pt"].includes(me?.plan) && (!me.access_until || me.access_until >= today());
}
const I = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  home: I('<path d="M4 11 12 4l8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>'),
  train: I('<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>'),
  food: I('<path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14zM5 19l7-7"/>'),
  library: I('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9.5 5 2.5-5 2.5z" fill="currentColor"/>'),
  progress: I('<path d="M4 19V5M4 19h16M8 15l4-4 3 3 5-6"/>'),
  chat: I('<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  clients: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.2 2.2 3.5 5"/>'),
  settings: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  scale: I('<rect x="3" y="4" width="18" height="16" rx="4"/><path d="M8.5 10a5 5 0 0 1 7 0M12 10.5l1.5-2"/>'),
  walk: I('<circle cx="13" cy="4.5" r="1.8"/><path d="m9 21 2.5-6 3 2.5V21M8 12l2-4h4l2 4 2.5 1M11.5 15l1-7"/>'),
  ticket: I('<path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v1a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-1a2 2 0 0 1 0-4 2 2 0 0 1 0-4V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1zM14 6v12" stroke-dasharray="0"/>'),
  calendar: I('<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  flame: I('<path d="M12 21c-3.9 0-6.5-2.6-6.5-6 0-3.6 3-5.6 3.6-9 1.8 1.2 3 3 3.2 5 .9-.7 1.5-1.8 1.7-3.2 2.3 1.9 4.5 4.6 4.5 7.6 0 3.2-2.6 5.6-6.5 5.6z"/>'),
  dice: I('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>'),
  medal: I('<circle cx="12" cy="14" r="6"/><path d="M8.5 9 6 3h4l2 4 2-4h4l-2.5 6"/>'),
  check: I('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  close: I('<path d="M6 6l12 12M18 6 6 18"/>'),
  up: I('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  ig: I('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor"/>'),
};
// Brand forms: the O of the logo as a heavy ring, a hatched arc, and the full stop as a solid dot.
// Arranged from a seed so each screen gets its own composition.
function seedOf(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function forms(seed, { w = 400, h = 330, scale = 1 } = {}) {
  const r = (n) => { seed = (Math.imul(seed ^ (seed >>> 15), 2246822507) + n) >>> 0; return (seed % 1000) / 1000; };
  const R = (118 + r(1) * 46) * scale, cx = w * (0.7 + r(2) * 0.18), cy = h * (0.18 + r(3) * 0.2);
  const rot = Math.round(-30 + r(4) * 60), dotR = (14 + r(5) * 8) * scale;
  const ang = (100 + r(6) * 50) * Math.PI / 180, far = R + 30 * scale;
  const dx = Math.min(w - dotR - 12, Math.max(dotR + 12, cx + Math.cos(ang) * far)), dy = Math.min(h * 0.62, Math.max(dotR + 12, cy + Math.sin(ang) * far));
  const id = "f" + (seed % 100000);
  const lines = Array.from({ length: 22 }, (_, i) => `<line x1="${-w}" y1="${i * 14 - 40}" x2="${w * 2}" y2="${i * 14 - 40 + w * 0.5}"/>`).join("");
  return `<svg class="forms" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMaxYMin slice" aria-hidden="true">
    <defs><clipPath id="${id}"><circle cx="${cx - R * 0.55}" cy="${cy + R * 0.5}" r="${R * 0.92}"/></clipPath></defs>
    <circle class="f-thin" cx="${cx - R * 0.55}" cy="${cy + R * 0.5}" r="${R * 0.92}"/>
    <g class="f-hatch" clip-path="url(#${id})" transform="rotate(${rot} ${cx} ${cy})">${lines}</g>
    <circle class="f-ring" cx="${cx}" cy="${cy}" r="${R}" stroke-width="${26 * scale}"/>
    <circle class="f-dot" cx="${dx}" cy="${dy}" r="${dotR}"/></svg>`;
}
function heroHtml({ photo, tag, title, sub, actions = "" }) {
  return `<section class="hero">${photo ? `<img class="photo" src="${esc(photo)}" alt="">` : forms(seedOf(title))}
    ${tag ? `<span class="tag">${esc(tag)}</span>` : ""}
    <h1>${esc(title)}</h1>${sub ? `<p class="muted" style="margin:0">${esc(sub)}</p>` : ""}
    ${actions ? `<div class="actions">${actions}</div>` : ""}</section>`;
}
// Five weeks, Monday first, ending this week. Days with any training light up.
function monthGrid(dates) {
  const set = new Set(dates); const now = new Date(); const t = today();
  const start = new Date(weekStart(now)); start.setDate(start.getDate() - 28);
  let cells = "", n = 0;
  for (let w = 0; w < 5; w++) {
    cells += `<span class="wl">W${w + 1}</span>`;
    for (let d = 0; d < 7; d++) {
      const day = new Date(start); day.setDate(start.getDate() + w * 7 + d); const iso = day.toISOString().slice(0, 10);
      const lit = set.has(iso);
      cells += `<i class="${lit ? "lit" : ""} ${iso === t ? "today" : ""} ${iso > t ? "future" : ""}" style="--n:${lit ? n++ : 0}" title="${fmtDate(iso)}"></i>`;
    }
  }
  return `<div class="month"><span></span>${["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => `<span class="dl">${d}</span>`).join("")}${cells}</div>`;
}
function passDaysLeft() {
  if (!me?.access_until || me.plan === "free") return null;
  return Math.ceil((new Date(me.access_until) - new Date(today())) / 864e5) + 1;
}
function igLink(label = "Follow on Instagram") {
  return CONFIG.INSTAGRAM_URL ? `<a class="btn secondary" href="${esc(CONFIG.INSTAGRAM_URL)}" target="_blank" rel="noopener">${ICON.ig} ${label}</a>` : "";
}
function offersHtml(keys) {
  const offers = CONFIG.OFFERS.filter((o) => o.url && (!keys || keys.includes(o.key)));
  if (!offers.length && !CONFIG.BOOKING_URL) return "";
  return `<div class="card">
    ${offers.map((o) => `<div class="offer"><div style="flex:1"><b>${esc(o.title)}</b><div class="muted">${esc(o.detail || "")}</div></div>
      <span class="price">${esc(o.price)}</span>
      <a class="btn small" href="${esc(o.url)}" target="_blank" rel="noopener" data-pay="${esc(o.title)}">Buy</a></div>`).join("")}
    ${CONFIG.BOOKING_URL ? `<a class="btn secondary block" style="margin-top:12px" href="${esc(CONFIG.BOOKING_URL)}" target="_blank" rel="noopener">${ICON.calendar} Book a session time</a>` : ""}
    <p class="muted" style="margin:12px 0 0">Your coach switches your access on once payment comes through, usually the same day.</p></div>`;
}
function bindPay() {
  $$("[data-pay]").forEach((a) => a.addEventListener("click", () => {
    if (me?.trainer_id) sb.from("messages").insert({ client_id: me.id, sender_id: me.id, body: `Payment started: ${a.dataset.pay}` });
  }));
}
function today() { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
function num(v) { return v === "" || v == null ? null : Number(v); }
function fail(error) { if (error) { console.error(error); toast(error.message || "Something went wrong"); return true; } return false; }
function targetText(it) {
  const parts = [];
  if (it.target_sets) parts.push(`${it.target_sets} sets`);
  if (it.target_reps) parts.push(`${it.target_reps} reps`);
  if (it.target_seconds) parts.push(`${it.target_seconds}s`);
  if (it.target_weight_kg) parts.push(`@ ${it.target_weight_kg} kg`);
  if (it.rest_seconds) parts.push(`rest ${it.rest_seconds}s`);
  return parts.join(", ") || "As prescribed";
}
function missingEquipment(exercise, owned) {
  if (!owned || owned.includes("Full gym")) return [];
  return (exercise.equipment || []).filter((e) => !owned.includes(e));
}
function swapSuggestions(exercise, library, owned) {
  const missing = missingEquipment(exercise, owned);
  if (!missing.length) return null;
  const alts = library.filter((x) => x.id !== exercise.id && x.muscle_group === exercise.muscle_group && missingEquipment(x, owned).length === 0)
    .slice(0, 3).map((x) => x.name);
  const cap = (t) => t[0].toUpperCase() + t.slice(1);
  const hints = missing.map((m) => SWAP_HINTS[m] ? `No ${m.toLowerCase()}? ${cap(SWAP_HINTS[m])}.` : `No ${m.toLowerCase()}? Ask your coach.`);
  return { missing, alts, hints };
}
function swapHtml(s) {
  if (!s) return "";
  return `<div class="swap"><span class="chip warn">Needs ${esc(s.missing.join(", "))}</span>
    ${s.alts.length ? `<div>Try instead: <b>${s.alts.map(esc).join("</b>, <b>")}</b></div>` : ""}
    ${s.hints.map((h) => `<div class="muted">${esc(h)}</div>`).join("")}</div>`;
}
function chart(canvasId, labels, datasets, opts = {}) {
  const el = document.getElementById(canvasId);
  if (!el || !window.Chart) return;
  const css = getComputedStyle(document.documentElement);
  charts.push(new Chart(el, {
    type: "line",
    data: { labels, datasets: datasets.map((d) => ({ borderColor: css.getPropertyValue("--primary").trim(), backgroundColor: "transparent", tension: .3, pointRadius: 3, ...d })) },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: datasets.length > 1 } },
      scales: { y: { beginAtZero: false, grid: { color: css.getPropertyValue("--line") } }, x: { grid: { display: false } } }, ...opts },
  }));
}
async function videoUrl(path) {
  if (!path) return null;
  const { data } = await sb.storage.from("exercise-videos").createSignedUrl(path, 60 * 60 * 6);
  return data?.signedUrl || null;
}
// All of a client's logged sets, with the exercise and the prescribed target attached
async function loadLogs(clientId) {
  const { data, error } = await sb.from("set_logs")
    .select("*, workout_items(exercise_id, target_reps, target_weight_kg, target_seconds, exercises(name))")
    .eq("client_id", clientId).order("logged_at");
  fail(error);
  return data || [];
}
function personalBests(logs) {
  const by = {};
  for (const l of logs) {
    const ex = l.workout_items?.exercise_id; if (!ex) continue;
    const name = l.workout_items.exercises?.name || "Exercise";
    by[ex] ??= { name, first: l, best: l, sets: 0, history: [] };
    const b = by[ex]; b.sets++;
    const score = (x) => (x.weight_kg || 0) * 1000 + (x.reps || 0) * 10 + (x.seconds || 0);
    if (score(l) > score(b.best)) b.best = l;
    b.history.push(l);
  }
  return by;
}

// ---------------------------------------------------------------- auth
// Supabase calls must not run inside this callback (it can deadlock), so defer them.
sb.auth.onAuthStateChange((event, s) => {
  const changedUser = s?.user?.id !== session?.user?.id;
  session = s;
  if (event === "TOKEN_REFRESHED" && !changedUser) return;
  setTimeout(async () => {
    if (!s) { me = null; myTrainer = null; return route(); }
    if (changedUser || !me) await loadMe();
    route();
  }, 0);
});

async function loadMe() {
  const { data } = await sb.from("profiles").select("*").eq("id", session.user.id).single();
  me = data;
  myTrainer = null;
  if (me?.trainer_id) ({ data: myTrainer } = await sb.from("profiles").select("id, full_name, library_free").eq("id", me.trainer_id).single());
}

$("#meBtn").onclick = () => go("me");
$("#signOut").onclick = async () => { await sb.auth.signOut(); go(""); };

function authView(mode = "in") {
  $("#topbar").hidden = true; $("#tabbar").hidden = true;
  render(`<div class="auth-hero">${CONFIG.PHOTOS.welcome ? `<img class="photo" src="${esc(CONFIG.PHOTOS.welcome)}" alt="">` : forms(7, { w: 400, h: 380, scale: 1.15 })}
    <div><img src="icons/logo.png" class="logo-big" alt="${esc(CONFIG.APP_NAME)}">
    <p class="muted" style="margin:0;color:#C9C6BC">Your programme, your progress, your coach.</p></div></div>
    <div class="auth">
    ${CONFIG.DEMO ? `<div class="card" style="margin-top:18px"><h3>Take a look around</h3><p class="muted">This is a demo with sample data. Changes reset when you refresh.</p>
      <div class="grid2"><button id="demoClient">I'm a client</button><button class="secondary" id="demoCoach">I'm the coach</button></div></div>` : ""}
    <div class="tabs"><button data-m="in" class="${mode === "in" ? "active" : ""}">Sign in</button><button data-m="up" class="${mode === "up" ? "active" : ""}">Create account</button></div>
    <form id="authForm" class="card">
      ${mode === "up" ? `<label>Full name</label><input name="name" required autocomplete="name">` : ""}
      <label>Email</label><input name="email" type="email" required autocomplete="email">
      <label>Password</label><input name="password" type="password" minlength="8" required autocomplete="${mode === "up" ? "new-password" : "current-password"}">
      ${mode === "up" ? `<label class="check"><input type="checkbox" name="consent" required>
        <span>I consent to my coach collecting and storing my health and fitness information (such as body weight and workouts) to coach me, as set out in the <a href="${esc(CONFIG.PRIVACY_URL)}" target="_blank">privacy notice</a>. I can ask for it to be deleted at any time.</span></label>` : ""}
      <button class="block" style="margin-top:16px">${mode === "up" ? "Create account" : "Sign in"}</button>
      ${mode === "in" ? `<p style="text-align:center;margin:12px 0 0"><a href="#" id="forgot">Forgot password?</a></p>` : ""}
    </form>
    ${CONFIG.INSTAGRAM_URL ? `<p style="text-align:center"><a href="${esc(CONFIG.INSTAGRAM_URL)}" target="_blank" rel="noopener" class="btn secondary small">${ICON.ig} Follow on Instagram</a></p>` : ""}</div>`);
  $$(".tabs button").forEach((b) => (b.onclick = () => authView(b.dataset.m)));
  $("#demoClient")?.addEventListener("click", () => sb.auth.signInWithPassword({ email: "thandi@demo" }));
  $("#demoCoach")?.addEventListener("click", () => sb.auth.signInWithPassword({ email: "coach@demo" }));
  $("#forgot")?.addEventListener("click", async (e) => {
    e.preventDefault();
    const email = $("#authForm").email.value;
    if (!email) return toast("Type your email first");
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (!fail(error)) toast("Reset link sent — check your email");
  });
  $("#authForm").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target; const btn = f.querySelector("button.block"); btn.disabled = true;
    if (mode === "up") {
      const { data, error } = await sb.auth.signUp({
        email: f.email.value, password: f.password.value,
        options: { data: { full_name: f.name.value, popia_consent: "true" }, emailRedirectTo: location.origin + location.pathname },
      });
      btn.disabled = false;
      if (fail(error)) return;
      if (!data.session) render(`<div class="auth card"><h2>Check your email</h2><p>We sent a confirmation link to <b>${esc(f.email.value)}</b>. Tap it, then come back and sign in.</p><button class="block" onclick="location.reload()">Back to sign in</button></div>`);
    } else {
      const { error } = await sb.auth.signInWithPassword({ email: f.email.value, password: f.password.value });
      btn.disabled = false; fail(error);
    }
  };
}

// ---------------------------------------------------------------- shell & routing
function tabs(items, fab = false) {
  const cur = location.hash.split("/")[1] || items[0][0];
  $("#tabbar").innerHTML = `<div class="pill">${items.map(([path, ico, label, dot]) =>
    `<a href="#/${path}" class="${cur === path ? "active" : ""}" ${cur === path ? 'aria-current="page"' : ""}>${ICON[ico]}<span>${label}</span>${dot ? `<span class="dot" aria-label="unread"></span>` : ""}</a>`).join("")}</div>
    ${fab ? `<button class="fab" id="fab" aria-label="Quick log" aria-expanded="false">${ICON.plus}</button>` : ""}`;
  $("#tabbar").hidden = false; $("#topbar").hidden = false;
  $("#sheet")?.remove();
  $("#fab")?.addEventListener("click", (e) => {
    const open = $("#sheet");
    if (open) { open.remove(); e.currentTarget.setAttribute("aria-expanded", "false"); return; }
    e.currentTarget.setAttribute("aria-expanded", "true");
    document.body.insertAdjacentHTML("beforeend", `<div class="sheet" id="sheet">
      <a href="#/log/weigh">${ICON.scale} Weigh-in</a><a href="#/log/activity">${ICON.walk} Activity</a>
      ${tracksNut() ? `<a href="#/food">${ICON.food} Food</a>` : ""}<a href="#/roulette">${ICON.dice} Exercise roulette</a><a href="#/passes">${ICON.ticket} Passes</a></div>`);
  });
  $("#meBtn").hidden = !(me?.role === "client" && me.trainer_id);
}

async function unreadCount() {
  const q = sb.from("messages").select("id", { count: "exact", head: true }).is("read_at", null).neq("sender_id", me.id);
  const { count } = me.role === "client" ? await q.eq("client_id", me.id) : await q;
  return count || 0;
}

async function route() {
  if (chatChannel) { sb.removeChannel(chatChannel); chatChannel = null; }
  if (!session) return authView();
  if (!me) { await loadMe(); if (!me) return render(`<div class="empty">Setting up your profile… refresh in a moment.</div>`); }

  const [page, a, b] = location.hash.replace(/^#\/?/, "").split("/");
  if (me.role === "client" && me.trainer_id && visitLogged !== today()) {
    visitLogged = today();
    await sb.from("checkins").upsert({ client_id: me.id, checkin_date: today() }, { onConflict: "client_id,checkin_date", ignoreDuplicates: true });
  }
  const unread = await unreadCount();
  const badge = unread > 0;

  if (me.role === "trainer") {
    tabs([["clients", "clients", "Clients"], ["library", "library", "Library"], ["inbox", "chat", "Chat", badge], ["me", "settings", "Settings"]]);
    const views = { clients: trainerClients, client: () => trainerClient(a), builder: () => workoutBuilder(a, b),
      library: trainerLibrary, exercise: () => exerciseEditor(a), inbox: trainerInbox, chat: () => chatView(a), me: profileView };
    return (views[page] || trainerClients)();
  }

  if (!me.trainer_id) {
    tabs([["home", "home", "Home"], ...(tracksNut() ? [["food", "food", "Food"]] : []), ["me", "settings", "Profile"]]);
    if (page === "me") return profileView();
    if (page === "food" && tracksNut()) return foodView(a);
    return render(`${heroHtml({ photo: CONFIG.PHOTOS.today, tag: "Almost there", title: `Welcome, ${me.full_name?.split(" ")[0] || ""}`,
        sub: "Your coach will accept your account shortly. Your programme, chat and tracking appear here once she does." })}
      <div class="card"><h3>While you wait</h3><p class="muted">Tell your coach what equipment you have, so workouts fit your space.</p>
      <button onclick="location.hash='#/me'">Set up my equipment</button></div>
      ${offersHtml()}<div style="text-align:center">${igLink()}</div>`); bindPay();
  }

  tabs([["home", "home", "Today"], ...(tracksEx() ? [["workouts", "train", "Train"]] : []), ...(tracksNut() ? [["food", "food", "Food"]] : []),
    ["library", "library", "Library"], ["chat", "chat", "Coach", badge]], true);
  const views = { home: clientHome, food: () => foodView(a), log: () => logView(a), passes: passesView,
    roulette: rouletteView, badges: badgesView, recipe: () => recipeView(a), workouts: clientWorkouts, workout: () => workoutView(a), progress: () => progressView(me.id),
    library: clientLibrary, ex: () => clientExercise(a), chat: () => chatView(me.id), me: profileView };
  return (views[page] || clientHome)();
}
window.addEventListener("hashchange", route);

// ================================================================ CLIENT
// Everything that counts as "showing up": sets, activities, finished workouts, daily challenges.
async function loadEngagement() {
  const [logs, { data: acts }, { data: done }, { data: ch }, { data: metrics }, { data: cks }, food] = await Promise.all([
    loadLogs(me.id),
    sb.from("activities").select("*").eq("client_id", me.id),
    sb.from("workouts").select("completed_at").eq("client_id", me.id).not("completed_at", "is", null),
    sb.from("challenge_completions").select("*").eq("client_id", me.id),
    sb.from("body_metrics").select("*").eq("client_id", me.id).order("metric_date"),
    sb.from("checkins").select("*").eq("client_id", me.id).order("checkin_date"),
    tracksNut() ? sb.from("food_logs").select("log_date").eq("client_id", me.id) : Promise.resolve({ data: [] }),
  ]);
  const doneW = (done || []).filter((w) => w.completed_at);
  const activeDays = [...logs.map((l) => l.logged_at.slice(0, 10)), ...(acts || []).map((a) => a.activity_date),
    ...doneW.map((w) => w.completed_at.slice(0, 10)), ...(ch || []).map((c) => c.challenge_date), ...(cks || []).map((c) => c.checkin_date)];
  const foodDays = new Set((food.data || []).map((f) => f.log_date)).size;
  const stats = badgeStats({ logs, workoutsDone: doneW.length, activities: acts || [], challenges: ch || [], metrics: metrics || [], foodDays, activeDays, todayIso: today() });
  return { logs, acts: acts || [], ch: ch || [], metrics: metrics || [], checkins: cks || [], activeDays, stats, earned: BADGES.filter((b) => b.test(stats)) };
}

// Show a medal moment the first time a badge is earned on this device.
function celebrate(earned) {
  const key = "or-badges-" + me.id; let seen = null;
  try { seen = JSON.parse(localStorage.getItem(key)); } catch {}
  const ids = earned.map((b) => b.id);
  try { localStorage.setItem(key, JSON.stringify(ids)); } catch {}
  if (!seen) return;
  const fresh = earned.find((b) => !seen.includes(b.id));
  if (!fresh) return;
  document.body.insertAdjacentHTML("beforeend", `<div class="celebrate" id="cel" role="dialog" aria-label="New badge"><div class="box">
    ${medal(fresh, true, 140)}<h2>${esc(fresh.title)}</h2><p class="muted">${esc(fresh.desc)}. That's one for the collection.</p>
    <button class="block" id="celOk">Keep going</button></div></div>`);
  $("#celOk").onclick = () => $("#cel").remove();
}

const CHECKIN = [
  { key: "energy", label: "Energy", low: "Flat", high: "Buzzing" },
  { key: "sleep", label: "Sleep", low: "Poor", high: "Great" },
  { key: "soreness", label: "Soreness", low: "None", high: "Very sore" },
];
function checkinCard(done) {
  if (done) return `<div class="card checkin done"><div class="row between"><h3>Today's check-in</h3><button class="small secondary" id="ckEdit">Edit</button></div>
    <div class="ck-summary">${CHECKIN.map((q) => `<div><span class="stat">${done[q.key] ?? "–"}</span><span class="stat-label">${q.label}</span></div>`).join("")}</div>
    ${done.note ? `<p class="muted" style="margin:10px 0 0">${esc(done.note)}</p>` : ""}</div>`;
  return `<form class="card checkin" id="ckForm"><h3>How are you today?</h3><p class="muted" style="margin:0 0 4px">Optional. Opening the app already counts towards your streak; three taps here help your coach adjust your training.</p>
    ${CHECKIN.map((q) => `<fieldset class="ck-q"><legend>${q.label}</legend><div class="ck-scale">${[1, 2, 3, 4, 5].map((n) =>
      `<label><input type="radio" name="${q.key}" value="${n}" required><span>${n}</span></label>`).join("")}</div>
      <div class="ck-ends"><span>${q.low}</span><span>${q.high}</span></div></fieldset>`).join("")}
    <label for="ckNote">Anything your coach should know?</label><input id="ckNote" name="note" maxlength="500" placeholder="Optional, e.g. stiff lower back">
    <button class="block" style="margin-top:14px">Save check-in</button></form>`;
}
function bindCheckin(after) {
  $("#ckEdit")?.addEventListener("click", () => {
    const card = $("#ckEdit").closest(".card"); card.outerHTML = checkinCard(null); bindCheckin(after);
  });
  $("#ckForm")?.addEventListener("submit", async (e) => {
    e.preventDefault(); const f = e.target;
    const row = { client_id: me.id, checkin_date: today(), energy: +f.energy.value, sleep: +f.sleep.value, soreness: +f.soreness.value, note: f.note.value.trim() || null };
    const { error } = await sb.from("checkins").upsert(row, { onConflict: "client_id,checkin_date" });
    if (!fail(error)) { toast("Check-in saved"); after(); }
  });
}

function celebrateRewards(unlocked) {
  const key = "or-rewards-" + me.id; let seen = null;
  try { seen = JSON.parse(localStorage.getItem(key)); } catch {}
  try { localStorage.setItem(key, JSON.stringify(unlocked.map((x) => x.id))); } catch {}
  if (!seen) return;
  const fresh = unlocked.find((x) => !seen.includes(x.id));
  if (!fresh || $("#cel")) return;
  document.body.insertAdjacentHTML("beforeend", `<div class="celebrate" id="cel" role="dialog" aria-label="Bonus video unlocked"><div class="box">
    ${medal({ glyph: String(fresh.reward_streak) }, true, 140)}<h2>Bonus video unlocked</h2>
    <p class="muted">Your ${fresh.reward_streak}-day streak earned you <b>${esc(fresh.name)}</b>.</p>
    <button class="block" id="celGo">Watch it now</button><button class="block secondary" id="celOk" style="margin-top:8px">Later</button></div></div>`);
  $("#celGo").onclick = () => { $("#cel").remove(); go("ex/" + fresh.id); };
  $("#celOk").onclick = () => $("#cel").remove();
}

async function clientHome() {
  const [eng, { data: milestones }, { data: rewardRows }, { data: wos }] = await Promise.all([
    loadEngagement(),
    sb.rpc("reward_milestones"),
    sb.from("exercises").select("id, name, reward_streak").not("reward_streak", "is", null).order("reward_streak"),
    sb.from("workouts").select("*").eq("client_id", me.id).is("completed_at", null).order("scheduled_date", { nullsFirst: false }).limit(3),
  ]);
  const food = tracksNut() ? await foodSummary() : null;
  const next = wos?.[0];
  const first = me.full_name?.split(" ")[0] || "";
  const { stats, activeDays } = eng; const st = stats.streak;
  const monthStart = today().slice(0, 8) + "01";
  const activeThisMonth = new Set(activeDays.filter((d) => d >= monthStart)).size;
  const goal = 20;
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const weekSets = eng.logs.filter((l) => l.logged_at.slice(0, 10) > weekAgo).length;
  const actMins = eng.acts.filter((a) => a.activity_date > weekAgo).reduce((s, a) => s + (a.minutes || 0), 0);
  const ws = eng.metrics.filter((m) => m.weight_kg); const w = ws[ws.length - 1], prevW = ws[ws.length - 2];
  const wDelta = w && prevW ? +(w.weight_kg - prevW.weight_kg).toFixed(1) : null;
  const left = passDaysLeft();
  const hasPasses = CONFIG.OFFERS.some((o) => o.url && o.days);
  const challenge = pickForDate(CHALLENGES, today());
  const chDone = eng.ch.some((c) => c.challenge_date === today());
  const tip = pickForDate(TIPS, today(), 5);
  const nextBadge = BADGES.find((b) => !eng.earned.includes(b));
  const strip = [...eng.earned.slice(-3).reverse(), ...(nextBadge ? [nextBadge] : [])];
  const activeTotal = new Set(activeDays).size;
  const rouletteOpen = activeTotal >= ROULETTE_UNLOCK_DAYS;
  const rewards = (rewardRows || []).filter((x) => st.best >= x.reward_streak);
  const nextReward = (milestones || []).find((m) => m > st.best);
  const rewardCard = (milestones || []).length ? `<div class="card reward">
      <div class="row between"><h3>Bonus videos</h3><span class="muted">Best streak ${st.best} ${st.best === 1 ? "day" : "days"}</span></div>
      ${rewards.map((x) => `<a class="list-item" href="#/ex/${x.id}"><span class="avatar">${ICON.library}</span><div class="grow"><b>${esc(x.name)}</b><div class="muted">Unlocked at a ${x.reward_streak}-day streak</div></div></a>`).join("")}
      ${nextReward ? `<p class="${rewards.length ? "muted" : ""}" style="margin:${rewards.length ? "10px" : "6px"} 0 8px">Next bonus video unlocks at a <b>${nextReward}-day streak</b>. ${nextReward - st.current} ${nextReward - st.current === 1 ? "day" : "days"} to go if you keep it going.</p>
        <div class="progress"><div style="width:${Math.min(100, (st.current / nextReward) * 100)}%"></div></div>` : `<p class="muted" style="margin:8px 0 0">You've unlocked every bonus video.</p>`}
    </div>` : "";

  const heroBlock = tracksEx()
    ? heroHtml({ photo: CONFIG.PHOTOS.today, tag: next ? (next.scheduled_date && next.scheduled_date !== today() ? fmtDate(next.scheduled_date) : "Today") : "Rest day",
        title: next ? next.name : `Recover well, ${first}`,
        sub: next ? (next.notes || "Your coach set this one for you.") : rouletteOpen ? "Nothing scheduled. Try the daily challenge or spin the roulette." : "Nothing scheduled. Try today's challenge or log a walk with +.",
        actions: next ? `<button onclick="location.hash='#/workout/${next.id}'">Start workout</button><button class="ghost" onclick="location.hash='#/workouts'">Weekly plan</button>`
          : rouletteOpen ? `<button onclick="location.hash='#/roulette'">${ICON.dice} Spin the roulette</button>` : "" })
    : heroHtml({ photo: CONFIG.PHOTOS.today, tag: "Today", title: `Morning, ${first}`, sub: "Log your meals and movement as you go." });

  render(`${heroBlock}
    <nav class="chips" aria-label="Shortcuts">
      <a href="#/badges" class="streak">${ICON.flame} ${st.current ? `${st.current}-day streak` : "Start a streak today"}</a>
      ${left ? `<span class="pass">${ICON.ticket} ${left} ${left === 1 ? "day" : "days"} left on your pass</span>` : hasPasses ? `<a href="#/passes">${ICON.ticket} Get a pass</a>` : ""}
      <a href="#/roulette">${ICON.dice} ${rouletteOpen ? "Roulette" : `Roulette unlocks in ${ROULETTE_UNLOCK_DAYS - activeTotal} days`}</a>
      <a href="#/progress">${ICON.progress} Progress</a>
      ${CONFIG.INSTAGRAM_URL ? `<a href="${esc(CONFIG.INSTAGRAM_URL)}" target="_blank" rel="noopener">${ICON.ig} Instagram</a>` : ""}
    </nav>
    ${rewardCard}
    ${checkinCard(eng.checkins.find((c) => c.checkin_date === today() && c.energy != null))}
    <div class="card"><p class="muted" style="margin:0 0 6px">Today's challenge</p>
      <div class="challenge"><span class="q">${esc(challenge)}</span>
      ${chDone ? `<button class="small done" disabled>Done</button>` : `<button class="small" id="chDone">Done it</button>`}</div></div>
    ${food ? foodCard(food) : ""}
    <div class="sec"><h2>Your month</h2><a href="#/progress">See progress</a></div>
    <div class="card">
      <div style="margin-bottom:8px"><b class="stat" style="font-size:1.5rem">${activeThisMonth}</b> <span class="muted">of ${goal} active days this month</span></div>
      <div class="progress" style="margin-bottom:16px"><div style="width:${Math.min(100, (activeThisMonth / goal) * 100)}%"></div></div>
      ${monthGrid(activeDays)}
    </div>
    <div class="sec"><h2>Badges</h2><a href="#/badges">${eng.earned.length} of ${BADGES.length}</a></div>
    <a class="card badge-strip" href="#/badges" style="text-decoration:none;color:inherit">
      ${strip.map((b) => medal(b, eng.earned.includes(b), 56)).join("")}
      <div style="flex:1;min-width:0">${nextBadge ? `<b>Next: ${esc(nextBadge.title)}</b><div class="muted">${esc(nextBadge.desc)}</div>` : `<b>Every badge earned</b>`}</div></a>
    <div class="grid3">
      <div class="card"><div class="stat">${weekSets}</div><div class="stat-label">Sets this week</div></div>
      <div class="card"><div class="stat">${actMins}</div><div class="stat-label">Active minutes</div></div>
      <div class="card"><div class="stat">${w?.weight_kg ?? "–"}</div><div class="stat-label">kg${wDelta ? ` <span class="vs ${wDelta <= 0 ? "up" : "down"}">${wDelta > 0 ? "+" : ""}${wDelta}</span>` : ""}</div></div>
    </div>
    <div class="card tip"><p class="muted" style="margin:0 0 4px">Coach's tip</p><p style="margin:0">${esc(tip)}</p></div>`);
  bindCheckin(clientHome);
  celebrateRewards(rewards);
  $("#chDone")?.addEventListener("click", async () => {
    const { error } = await sb.from("challenge_completions").insert({ client_id: me.id, challenge_date: today(), challenge });
    if (!fail(error)) { toast("Challenge done. That counts towards your streak."); clientHome(); }
  });
  celebrate(eng.earned);
}

async function badgesView() {
  const eng = await loadEngagement(); const st = eng.stats.streak;
  render(`<button class="back" onclick="history.back()">Back</button><h1>Streaks and badges</h1>
    <div class="grid3" style="margin:14px 0">
      <div class="card"><div class="stat">${st.current}</div><div class="stat-label">Day streak</div></div>
      <div class="card"><div class="stat">${st.best}</div><div class="stat-label">Best streak</div></div>
      <div class="card"><div class="stat">${eng.earned.length}</div><div class="stat-label">of ${BADGES.length} badges</div></div></div>
    <p class="muted">${st.today ? "You've shown up today. Open the app again tomorrow to keep the streak alive." : "Open the app each day to keep your streak going."}</p>
    <div class="card"><div class="badges">${BADGES.map((b) => { const got = eng.earned.includes(b);
      return `<div class="badge ${got ? "" : "locked"}">${medal(b, got, 68)}<b>${esc(b.title)}</b><span>${esc(b.desc)}</span></div>`; }).join("")}</div></div>`);
  celebrate(eng.earned);
}

async function rouletteView() {
  const [eng, { data }] = await Promise.all([loadEngagement(), sb.from("exercises").select("*").order("name")]);
  const activeTotal = new Set(eng.activeDays).size;
  if (activeTotal < ROULETTE_UNLOCK_DAYS) {
    return render(`<button class="back" onclick="history.back()">Back</button>
      ${heroHtml({ tag: "Locked", title: "Exercise roulette", sub: `A random move from your coach's library, for days you want something different. It unlocks after ${ROULETTE_UNLOCK_DAYS} active days. Any day you open the app counts, and gaps are fine.` })}
      <div class="card"><div class="row between"><span><b class="stat" style="font-size:1.5rem">${activeTotal}</b> <span class="muted">of ${ROULETTE_UNLOCK_DAYS} active days</span></span><span class="muted">${ROULETTE_UNLOCK_DAYS - activeTotal} to go</span></div>
        <div class="progress" style="margin-top:10px"><div style="width:${(activeTotal / ROULETTE_UNLOCK_DAYS) * 100}%"></div></div></div>`);
  }
  const best = eng.stats.streak.best;
  const pool = (data || []).filter((x) => x.reward_streak == null || best >= x.reward_streak);
  const groups = [...new Set(pool.map((x) => x.muscle_group))];
  render(`<button class="back" onclick="history.back()">Back</button>
    <h1>Exercise roulette</h1><p class="muted">In the mood for something new? Spin for a move from your coach's library.</p>
    <div class="chips" id="rf">${["Anything", "Fits my kit", ...groups].map((m, i) => `<a href="#" class="${i ? "" : "pass"}" data-m="${esc(m)}">${esc(m)}</a>`).join("")}</div>
    <div class="reel" aria-live="polite"><div class="win"></div><ul id="reel"></ul></div>
    <button class="block" id="spin">${ICON.dice} Spin</button>
    <div id="result" style="margin-top:14px"></div>
    ${!hasLibrary() ? `<p class="muted" style="margin-top:14px">You're spinning the exercises from your own workouts. <a href="#/passes">Get a pass</a> to spin the full library.</p>` : ""}`);
  let filter = "Anything";
  const reel = $("#reel");
  const show = (names) => { reel.style.transition = "none"; reel.style.transform = "translateY(0)"; reel.innerHTML = names.map((n) => `<li>${esc(n)}</li>`).join(""); };
  show(["", "Ready when you are", ""]);
  $$("#rf a").forEach((c) => (c.onclick = (e) => { e.preventDefault(); $$("#rf a").forEach((x) => x.classList.remove("pass")); c.classList.add("pass"); filter = c.dataset.m; }));
  $("#spin").onclick = () => {
    const opts = pool.filter((x) => filter === "Anything" || (filter === "Fits my kit" ? !missingEquipment(x, me.equipment).length : x.muscle_group === filter));
    if (!opts.length) return toast("Nothing matches that filter yet. Try Anything.");
    const pick = opts[Math.floor(Math.random() * opts.length)];
    const filler = Array.from({ length: 28 }, () => opts[Math.floor(Math.random() * opts.length)].name);
    const names = ["", ...filler, pick.name, ""]; const k = names.length - 2;
    show(names); reel.getBoundingClientRect();
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    reel.style.transition = reduce ? "none" : "transform 2.6s cubic-bezier(.12,.72,.08,1)";
    reel.style.transform = `translateY(${-(k - 1) * 56}px)`;
    $("#spin").disabled = true; $("#result").innerHTML = "";
    setTimeout(async () => {
      reel.children[k].classList.add("hit"); $("#spin").disabled = false; $("#spin").innerHTML = `${ICON.dice} Spin again`;
      const url = await videoUrl(pick.video_path);
      const presc = pick.muscle_group === "Cardio" ? "3 rounds of 40 seconds on, 20 off" : pick.muscle_group === "Mobility" ? "2 rounds of 60 seconds" : pick.equipment?.length ? "3 sets of 10–12 at a weight you could lift 2 more times" : "3 sets of 12–15";
      $("#result").innerHTML = `<div class="card ex-card"><h2>${esc(pick.name)}</h2><span class="chip">${esc(pick.muscle_group)}</span>
        ${url ? `<video src="${esc(url)}" controls playsinline muted loop preload="metadata"></video>` : ""}
        <div class="target">Try: <b>${esc(presc)}</b></div>
        ${pick.cues?.length ? `<div class="cues"><b>Form cues</b><ul>${pick.cues.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>` : ""}
        ${swapHtml(swapSuggestions(pick, pool, me.equipment))}
        <button class="block" id="didIt" style="margin-top:14px">I did it</button></div>`;
      $("#didIt").onclick = async () => {
        const { error } = await sb.from("activities").insert({ client_id: me.id, type: "Roulette", minutes: 5, activity_date: today(), notes: pick.name });
        if (fail(error)) return;
        toast(`${pick.name} logged. Nice one.`); $("#didIt").disabled = true; $("#didIt").textContent = "Logged";
        celebrate((await loadEngagement()).earned);
      };
    }, reduce ? 50 : 2700);
  };
}

async function recipeView(i) {
  const r = RECIPES[Number(i)]; if (!r) return go("food");
  render(`<button class="back" onclick="history.back()">Back</button>
    <h1>${esc(r.name)}</h1>
    <p><span class="chip on">${r.points} points a serving</span> <span class="chip">${r.minutes} min</span> <span class="chip">Serves ${r.serves}</span></p>
    <div class="card"><h3>You'll need</h3><ul style="padding-left:20px;margin:6px 0 0">${r.ingredients.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
    <div class="card"><h3>Method</h3><ol class="steps">${r.steps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div>
    ${tracksNut() && me.daily_points ? `<button class="block" id="logR">Log one serving</button>` : ""}`);
  $("#logR")?.addEventListener("click", async () => {
    const { error } = await sb.from("food_logs").insert({ client_id: me.id, log_date: today(), meal: defaultMeal(), food_name: r.name, servings: 1, points: r.points });
    if (!fail(error)) { toast("Logged to today's food"); go("food"); }
  });
}

async function logView(kind) {
  render(`<button class="back" onclick="history.back()">Back</button><div id="quick"></div>`);
  const done = () => go("home");
  if (kind === "activity") activityForm($("#quick"), done); else weighInForm($("#quick"), done);
}

async function passesView() {
  const left = passDaysLeft();
  render(`${heroHtml({ photo: CONFIG.PHOTOS.passes, tag: left ? `${left} days left` : "", title: "Passes and sessions",
      sub: "Unlock the full video library and tracking for as long as you need, or book time with your coach." })}
    ${offersHtml() || `<div class="card"><p>Ask your coach about passes and sessions.</p><button onclick="location.hash='#/chat'">Message coach</button></div>`}`);
  bindPay();
}

function weighInForm(el, after) {
  el.innerHTML = `<form class="card"><h2>Weigh-in</h2>
    <div class="grid3"><div><label>Weight (kg)</label><input name="w" type="number" step="0.1" inputmode="decimal"></div>
    <div><label>Waist (cm)</label><input name="waist" type="number" step="0.1" inputmode="decimal"></div>
    <div><label>Body fat %</label><input name="bf" type="number" step="0.1" inputmode="decimal"></div></div>
    <label>Date</label><input name="d" type="date" value="${today()}">
    <button class="block" style="margin-top:12px">Save</button></form>`;
  el.querySelector("form").onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    if (!f.w.value && !f.waist.value && !f.bf.value) return toast("Add at least one measurement");
    const { error } = await sb.from("body_metrics").insert({ client_id: me.id, metric_date: f.d.value, weight_kg: num(f.w.value), waist_cm: num(f.waist.value), body_fat_pct: num(f.bf.value) });
    if (!fail(error)) { toast("Saved"); after(); }
  };
}

function activityForm(el, after) {
  el.innerHTML = `<form class="card"><h2>Activity</h2><p class="muted">Walks, runs, classes, sport — anything outside your programme.</p>
    <label>Type</label><select name="t">${ACTIVITY_TYPES.map((t) => `<option>${t}</option>`).join("")}</select>
    <div class="grid2"><div><label>Minutes</label><input name="m" type="number" inputmode="numeric" required></div>
    <div><label>Distance (km)</label><input name="km" type="number" step="0.1" inputmode="decimal"></div></div>
    <label>Date</label><input name="d" type="date" value="${today()}">
    <label>Notes</label><input name="n" placeholder="Optional">
    <button class="block" style="margin-top:12px">Save</button></form>`;
  el.querySelector("form").onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    const { error } = await sb.from("activities").insert({ client_id: me.id, type: f.t.value, minutes: num(f.m.value), distance_km: num(f.km.value), activity_date: f.d.value, notes: f.n.value || null });
    if (!fail(error)) { toast("Activity logged"); after(); }
  };
}

async function clientWorkouts() {
  const { data } = await sb.from("workouts").select("*, workout_items(count)").eq("client_id", me.id).order("scheduled_date", { ascending: false, nullsFirst: true });
  const open = (data || []).filter((w) => !w.completed_at); const done = (data || []).filter((w) => w.completed_at);
  const item = (w) => `<a class="list-item" href="#/workout/${w.id}"><div class="grow"><b>${esc(w.name)}</b>
    <div class="muted">${w.workout_items?.[0]?.count || 0} exercises${w.scheduled_date ? ", " + fmtDate(w.scheduled_date) : ""}</div></div>
    ${w.completed_at ? `<span class="chip good">Done</span>` : `<span class="chip on">To do</span>`}</a>`;
  render(`<h1>Workouts</h1>
    <div class="card"><h3>Up next</h3>${open.map(item).join("") || `<div class="empty">Nothing scheduled yet.</div>`}</div>
    <div class="card"><h3>Completed</h3>${done.map(item).join("") || `<div class="empty">Your finished sessions will show here.</div>`}</div>`);
}

async function workoutView(id) {
  const [{ data: w, error }, logs, { data: library }] = await Promise.all([
    sb.from("workouts").select("*, workout_items(*, exercises(*))").eq("id", id).single(),
    loadLogs(me.id),
    sb.from("exercises").select("id,name,muscle_group,equipment"),
  ]);
  if (fail(error) || !w) return render(`<div class="empty">Workout not found.</div>`);
  const items = (w.workout_items || []).sort((a, b) => a.position - b.position);
  const thisLogs = logs.filter((l) => items.some((i) => i.id === l.workout_item_id));

  const cards = await Promise.all(items.map(async (it) => {
    const ex = it.exercises; const url = await videoUrl(ex.video_path);
    const prev = logs.filter((l) => l.workout_items?.exercise_id === ex.id && l.workout_item_id !== it.id);
    const last = prev[prev.length - 1];
    const done = thisLogs.filter((l) => l.workout_item_id === it.id);
    const nSets = Math.max(it.target_sets || 3, done.length);
    const timed = !!it.target_seconds && !it.target_reps;
    const rows = Array.from({ length: nSets }, (_, i) => {
      const d = done.find((l) => l.set_number === i + 1);
      return `<div class="set-row ${d ? "done" : ""}" data-item="${it.id}" data-set="${i + 1}" data-log="${d?.id || ""}">
        <span class="n">${i + 1}</span>
        ${timed ? `<input type="number" inputmode="numeric" placeholder="sec" value="${d?.seconds ?? it.target_seconds ?? ""}" data-f="seconds">`
          : `<input type="number" inputmode="numeric" placeholder="reps" value="${d?.reps ?? it.target_reps ?? ""}" data-f="reps">`}
        <input type="number" inputmode="decimal" step="0.5" placeholder="kg" value="${d?.weight_kg ?? it.target_weight_kg ?? ""}" data-f="weight_kg">
        <button class="${d ? "" : "secondary"} small" title="Log set" aria-label="${d ? "Logged" : "Log set"}">${d ? ICON.check : "Log"}</button></div>`;
    }).join("");
    return `<div class="card ex-card">
      <div class="row between"><h2>${esc(ex.name)}</h2><span class="chip">${esc(ex.muscle_group)}</span></div>
      ${url ? `<video src="${esc(url)}" controls playsinline preload="metadata" loop muted></video>` : ""}
      <div class="target">Coach's target: <b>${esc(targetText(it))}</b>${it.notes ? `<div class="muted">${esc(it.notes)}</div>` : ""}
        ${last ? `<div class="muted">Last time: ${last.reps ?? last.seconds + "s"}${last.weight_kg ? " @ " + last.weight_kg + " kg" : ""}</div>` : ""}</div>
      ${ex.cues?.length ? `<div class="cues"><b>Form cues</b><ul>${ex.cues.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>` : ""}
      ${swapHtml(swapSuggestions(ex, library || [], me.equipment))}
      <div class="set-row muted" style="margin-top:12px"><span class="n">Set</span><span>${timed ? "Seconds" : "Reps"}</span><span>kg</span><span></span></div>
      ${rows}
      <button class="ghost small" data-add="${it.id}" style="margin-top:10px">+ Add set</button>
      ${ex.instructions ? `<details style="margin-top:8px"><summary>How to</summary><p class="muted">${esc(ex.instructions)}</p></details>` : ""}
    </div>`;
  }));

  render(`<button class="back" onclick="history.back()">← Back</button>
    <h1>${esc(w.name)}</h1>${w.notes ? `<p class="muted">${esc(w.notes)}</p>` : ""}
    ${cards.join("") || `<div class="empty">No exercises yet.</div>`}
    ${w.completed_at ? `<div class="card" style="text-align:center"><span class="chip good">Completed ${fmtDate(w.completed_at)}</span></div>`
      : `<button class="block" id="finish">Finish workout</button>`}`);

  const logSet = async (btn) => {
    const row = btn.closest(".set-row");
    const vals = Object.fromEntries($$("input", row).map((i) => [i.dataset.f, num(i.value)]));
    const rec = { workout_item_id: row.dataset.item, client_id: me.id, set_number: Number(row.dataset.set), ...vals };
    btn.disabled = true;
    const q = row.dataset.log ? sb.from("set_logs").update(vals).eq("id", row.dataset.log).select().single()
      : sb.from("set_logs").insert(rec).select().single();
    const { data, error } = await q; btn.disabled = false;
    if (fail(error)) return;
    row.dataset.log = data.id; row.classList.add("done"); btn.innerHTML = ICON.check; btn.classList.remove("secondary");
    const it = items.find((i) => i.id === row.dataset.item);
    if (it.target_weight_kg && vals.weight_kg > it.target_weight_kg) toast("Heavier than target — strong!");
    else if (it.target_reps && vals.reps > it.target_reps) toast("Extra reps — nice work!");
    else toast(`Set ${row.dataset.set} logged`);
  };
  $$(".set-row[data-item] button").forEach((btn) => (btn.onclick = () => logSet(btn)));
  $$("[data-add]").forEach((b) => (b.onclick = () => {
    const rows = $$(`.set-row[data-item="${b.dataset.add}"]`); const lastRow = rows[rows.length - 1];
    const clone = lastRow.cloneNode(true); clone.dataset.set = rows.length + 1; clone.dataset.log = ""; clone.classList.remove("done");
    clone.querySelector(".n").textContent = rows.length + 1;
    const btn = clone.querySelector("button"); btn.textContent = "Log"; btn.classList.add("secondary");
    lastRow.after(clone); btn.onclick = () => logSet(btn);
  }));
  $("#finish")?.addEventListener("click", async () => {
    const { error } = await sb.from("workouts").update({ completed_at: new Date().toISOString() }).eq("id", w.id);
    if (fail(error)) return;
    await sb.from("messages").insert({ client_id: me.id, sender_id: me.id, body: `Finished "${w.name}"` });
    toast("Workout complete! Your coach has been notified"); go("home");
  });
}

// ---------------------------------------------------------------- client exercise library
async function signedMap(rows) {
  const paths = rows.map((r) => r.video_path).filter(Boolean);
  if (!paths.length) return {};
  const { data } = await sb.storage.from("exercise-videos").createSignedUrls(paths, 60 * 60 * 6);
  return Object.fromEntries((data || []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
}
function tileHtml(x, urls, href) {
  const u = urls[x.video_path];
  return `<a class="tile" href="${href}">${u ? `<video src="${esc(u)}#t=0.8" muted playsinline preload="metadata"></video>` : `<span class="ph" aria-hidden="true">${forms(seedOf(x.name), { w: 200, h: 250, scale: 0.55 })}</span>`}
    <b>${esc(x.name)}</b><span>${esc(x.muscle_group)}${missingEquipment(x, me.equipment).length ? ", needs kit" : ""}</span></a>`;
}
async function clientLibrary() {
  const [{ data }, eng] = await Promise.all([sb.from("exercises").select("*").order("name"), loadEngagement()]);
  const best = eng.stats.streak.best;
  const bonus = (data || []).filter((x) => x.reward_streak != null && best >= x.reward_streak);
  const all = (data || []).filter((x) => x.reward_streak == null); const urls = await signedMap([...all, ...bonus]);
  const bonusHtml = bonus.length ? `<div class="sec"><h2>Bonus videos</h2><span class="muted">Earned with your streak</span></div>
    <div class="tiles" style="margin-bottom:6px">${bonus.map((x) => tileHtml(x, urls, `#/ex/${x.id}`)).join("")}</div>` : "";
  if (!hasLibrary()) {
    render(`${heroHtml({ photo: CONFIG.PHOTOS.passes, tag: "Library", title: "Every move, on demand",
        sub: "Get a pass to unlock all of your coach's demos and form cues. The exercises in your own workouts stay open." ,
        actions: `<button onclick="location.hash='#/passes'">See passes</button>` })}
      ${bonusHtml}
      ${all.length ? `<div class="sec"><h2>In your workouts</h2></div><div class="tiles">${all.map((x) => tileHtml(x, urls, `#/ex/${x.id}`)).join("")}</div>` : ""}`);
    return;
  }
  render(`<h1>Library</h1><p class="muted">Demos and form cues from your coach, for extra sessions or a refresher.</p>
    ${bonusHtml}
    <input id="q" placeholder="Search exercises" style="margin-bottom:10px" aria-label="Search exercises">
    <div class="chips" id="mg">${["All", "Fits my kit", ...MUSCLES].map((m, i) => `<a href="#" class="${i ? "" : "pass"}" data-m="${m}">${m}</a>`).join("")}</div>
    <div class="tiles" id="list"></div>`);
  let mg = "All";
  const draw = () => {
    const q = $("#q").value.toLowerCase();
    const rows = all.filter((x) => (mg === "All" || (mg === "Fits my kit" ? !missingEquipment(x, me.equipment).length : x.muscle_group === mg)) && x.name.toLowerCase().includes(q));
    $("#list").innerHTML = rows.map((x) => tileHtml(x, urls, `#/ex/${x.id}`)).join("")
      || `<div class="empty" style="grid-column:1/-1">${all.length ? "No exercises match. Try another filter." : "Your coach hasn't added exercises yet."}</div>`;
  };
  $("#q").oninput = draw;
  $$("#mg a").forEach((c) => (c.onclick = (e) => { e.preventDefault(); $$("#mg a").forEach((x) => x.classList.remove("pass")); c.classList.add("pass"); mg = c.dataset.m; draw(); }));
  draw();
}

async function clientExercise(id) {
  const [{ data: ex }, { data: lib }] = await Promise.all([
    sb.from("exercises").select("*").eq("id", id).single(), sb.from("exercises").select("id,name,muscle_group,equipment")]);
  if (!ex) return render(`<div class="empty">Exercise not found.</div>`);
  const url = await videoUrl(ex.video_path);
  render(`<button class="back" onclick="history.back()">← Library</button>
    <div class="card ex-card"><div class="row between"><h1>${esc(ex.name)}</h1><span class="chip">${esc(ex.muscle_group)}</span></div>
      ${url ? `<video src="${esc(url)}" controls playsinline preload="metadata" loop muted></video>` : `<div class="empty">No demo video yet.</div>`}
      <p class="muted">Equipment: ${(ex.equipment || []).map(esc).join(", ") || "Bodyweight"}</p>
      ${ex.cues?.length ? `<div class="cues"><b>Form cues</b><ul>${ex.cues.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>` : ""}
      ${swapHtml(swapSuggestions(ex, lib || [], me.equipment))}
      ${ex.instructions ? `<h3 style="margin-top:14px">How to</h3><p>${esc(ex.instructions)}</p>` : ""}</div>`);
}

// ================================================================ FOOD (points tracking)
async function foodSummary(date = today()) {
  const ws = weekStart(new Date(date));
  const { data } = await sb.from("food_logs").select("*").eq("client_id", me.id).gte("log_date", ws).order("created_at");
  const rows = data || []; const budget = me.daily_points || 0;
  const dayRows = rows.filter((r) => r.log_date === date);
  const used = dayRows.reduce((s, r) => s + Number(r.points), 0);
  const byDay = {}; rows.forEach((r) => (byDay[r.log_date] = (byDay[r.log_date] || 0) + Number(r.points)));
  const over = Object.entries(byDay).filter(([d]) => d <= date).reduce((s, [, v]) => s + Math.max(0, v - budget), 0);
  return { date, budget, used, left: budget - used, buffer: Math.max(0, WEEKLY_BUFFER - over), dayRows };
}
function foodCard(f) {
  if (!f.budget) return `<div class="card"><h3>Nutrition</h3><p class="muted">Set your daily points to start tracking food.</p><button onclick="location.hash='#/food'">Set up</button></div>`;
  const pct = Math.min(100, Math.round((f.used / f.budget) * 100));
  return `<a class="card" href="#/food" style="display:block;color:inherit;text-decoration:none">
    <div class="row between"><h3>Points today</h3><span class="muted">Weekly buffer ${f.buffer}</span></div>
    <div class="row" style="align-items:baseline;gap:6px"><span class="stat">${f.left < 0 ? 0 : f.left}</span><span class="muted">of ${f.budget} left${f.left < 0 ? `, ${-f.left} from weekly buffer` : ""}</span></div>
    <div class="progress" style="margin-top:10px"><div style="width:${pct}%"></div></div></a>`;
}

async function foodSetup() {
  const { data: m } = await sb.from("body_metrics").select("weight_kg").eq("client_id", me.id).not("weight_kg", "is", null).order("metric_date", { ascending: false }).limit(1);
  render(`<h1>Set your daily points</h1>
    <p class="muted">We use these to work out a safe daily budget. Only the result is saved — your age, sex and height are not stored.</p>
    <form id="fs" class="card">
      <div class="grid2"><div><label>Current weight (kg)</label><input name="w" type="number" step="0.1" required value="${m?.[0]?.weight_kg ?? ""}"></div>
      <div><label>Goal weight (kg)</label><input name="g" type="number" step="0.1" value="${me.goal_weight_kg ?? ""}"></div>
      <div><label>Height (cm)</label><input name="h" type="number" required></div><div><label>Age</label><input name="a" type="number" required></div></div>
      <label>Sex (for the calorie formula)</label><select name="s"><option value="f">Female</option><option value="m">Male</option></select>
      <label>Activity level</label><select name="act"><option value="1.2">Mostly sitting</option><option value="1.375" selected>Light exercise 1–3×/week</option><option value="1.55">Moderate 3–5×/week</option><option value="1.725">Very active</option></select>
      <div id="res" class="target" hidden></div>
      <button class="block" style="margin-top:12px">Calculate & save</button>
      <p class="muted" style="margin-top:10px">Prefer a number from your coach or dietitian? <a href="#" id="manual">Enter it yourself</a>.</p></form>
    <p class="muted">This is a tracking tool, not medical advice. If you have a lot to lose or a health condition, check in with your doctor or a registered dietitian first.</p>`);
  $("#manual").onclick = async (e) => {
    e.preventDefault(); const v = Number(prompt("Daily points budget:")); if (!v || v < 15 || v > 80) return toast("Enter a number between 15 and 80");
    const { error } = await sb.from("profiles").update({ daily_points: v }).eq("id", me.id); if (!fail(error)) { me.daily_points = v; foodView(); }
  };
  $("#fs").onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    const w = num(f.w.value), g = num(f.g.value);
    const pts = dailyBudget({ weight: w, height: num(f.h.value), age: num(f.a.value), sex: f.s.value, activity: f.act.value, losing: g == null || g < w });
    const upd = { daily_points: pts, goal_weight_kg: g };
    const { error } = await sb.from("profiles").update(upd).eq("id", me.id); if (fail(error)) return;
    Object.assign(me, upd);
    const { data: hasW } = await sb.from("body_metrics").select("id").eq("client_id", me.id).limit(1);
    if (!hasW?.length) await sb.from("body_metrics").insert({ client_id: me.id, weight_kg: w });
    toast(`Your budget: ${pts} points a day`); foodView();
  };
}

async function foodView(date) {
  if (!me.daily_points) return foodSetup();
  date = date || today();
  const [f, { data: custom }] = await Promise.all([foodSummary(date), sb.from("custom_foods").select("*").eq("client_id", me.id).order("name")]);
  const shift = (n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const meals = ["Breakfast", "Lunch", "Dinner", "Snack"];
  const all = [...(custom || []).map((c) => ({ name: c.name, serving: c.serving || "1 serving", points: Number(c.points), mine: true })), ...FOODS];
  render(`<div class="row between"><button class="small secondary" onclick="location.hash='#/food/${shift(-1)}'">‹</button>
      <h2 style="margin:0">${date === today() ? "Today" : fmtDate(date)}</h2>
      <button class="small secondary" ${date >= today() ? "disabled" : ""} onclick="location.hash='#/food/${shift(1)}'" aria-label="Next day">›</button></div>
    <div style="margin-top:12px">${foodCard(f)}</div>
    ${meals.map((m) => { const rs = f.dayRows.filter((r) => r.meal === m); return `<div class="card"><div class="row between"><h3>${m}</h3><span class="muted">${rs.reduce((s, r) => s + Number(r.points), 0)} pts</span></div>
      ${rs.map((r) => `<div class="list-item" style="cursor:default"><div class="grow">${esc(r.food_name)} <span class="muted">× ${r.servings}</span></div><b>${r.points}</b>
        <button class="small secondary" data-del="${r.id}" aria-label="Remove">${ICON.close}</button></div>`).join("") || `<p class="muted" style="margin:4px 0 0">Nothing yet</p>`}</div>`; }).join("")}
    <div class="card" id="add"><h3>Add food</h3>
      <input id="fq" placeholder="Search: pap, biltong, rusk…">
      <div class="grid2" style="margin-top:8px"><select id="meal">${meals.map((m) => `<option ${m === defaultMeal() ? "selected" : ""}>${m}</option>`).join("")}</select>
        <div class="row"><button type="button" class="small secondary" id="sMinus">−</button><b id="sv" style="min-width:34px;text-align:center">1</b><button type="button" class="small secondary" id="sPlus">+</button><span class="muted">serv.</span></div></div>
      <div id="fres" style="max-height:300px;overflow-y:auto;margin-top:8px"></div></div>
    <div class="card"><div class="row between"><h3>Recipes</h3><span class="muted">Points a serving</span></div>
      ${RECIPES.map((r, i) => `<a class="recipe-card" href="#/recipe/${i}"><span class="pts">${r.points}</span><div style="flex:1"><b>${esc(r.name)}</b><div class="muted">${r.minutes} min, serves ${r.serves}</div></div></a>`).join("")}</div>
    <details class="card"><summary>Not listed? Use the label calculator</summary>
      <form id="lab"><label>Name</label><input name="n" required placeholder="e.g. Woolies protein bar">
      <label>Serving</label><input name="sv" placeholder="e.g. 1 bar (45 g)">
      <div class="grid3"><div><label>kcal</label><input name="k" type="number" step="any" required></div><div><label>Sat. fat g</label><input name="sat" type="number" step="any" value="0"></div>
      <div><label>Sugar g</label><input name="su" type="number" step="any" value="0"></div><div><label>Protein g</label><input name="p" type="number" step="any" value="0"></div>
      <div><label>Fibre g</label><input name="fi" type="number" step="any" value="0"></div><div><label>Points</label><div class="stat" id="lp">0</div></div></div>
      <button class="block" style="margin-top:10px">Save to my foods</button></form></details>
    <p class="muted">Free foods are 0 points so hunger is never the reason you stop — portions still count. Your weekly buffer of ${WEEKLY_BUFFER} covers braais and birthdays.</p>`);
  let serv = 1;
  const setServ = (v) => { serv = Math.max(0.5, Math.round(v * 2) / 2); $("#sv").textContent = serv; };
  $("#sMinus").onclick = () => setServ(serv - 0.5); $("#sPlus").onclick = () => setServ(serv + 0.5);
  const drawRes = () => {
    const q = $("#fq").value.toLowerCase();
    const rows = all.filter((x) => x.name.toLowerCase().includes(q)).slice(0, q ? 30 : 12);
    $("#fres").innerHTML = rows.map((x, i) => `<button type="button" class="list-item" data-f="${all.indexOf(x)}" style="width:100%;background:none;color:inherit;border-radius:0;text-align:left">
      <div class="grow"><b>${esc(x.name)}</b> <span class="muted">${esc(x.serving)}</span>${x.mine ? ` <span class="chip">mine</span>` : ""}</div>
      ${x.free ? `<span class="chip good">Free</span>` : `<b>${x.points}</b>`}</button>`).join("") || `<p class="muted">No match — try the label calculator below.</p>`;
    $$("[data-f]").forEach((b) => (b.onclick = async () => {
      const x = all[b.dataset.f];
      const { error } = await sb.from("food_logs").insert({ client_id: me.id, log_date: date, meal: $("#meal").value, food_name: x.name, servings: serv, points: Math.round(x.points * serv) });
      if (!fail(error)) { toast(`Added ${x.name}`); foodView(date); }
    }));
  };
  $("#fq").oninput = drawRes; drawRes();
  $$("[data-del]").forEach((b) => (b.onclick = async () => { const { error } = await sb.from("food_logs").delete().eq("id", b.dataset.del); if (!fail(error)) foodView(date); }));
  const lab = $("#lab"); const lp = () => calcPoints({ kcal: num(lab.k.value) || 0, sat: num(lab.sat.value) || 0, sugar: num(lab.su.value) || 0, protein: num(lab.p.value) || 0, fibre: num(lab.fi.value) || 0 });
  lab.oninput = () => ($("#lp").textContent = lp());
  lab.onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await sb.from("custom_foods").insert({ client_id: me.id, name: lab.n.value.trim(), serving: lab.sv.value || null, points: lp() });
    if (!fail(error)) { toast("Saved to your foods"); foodView(date); }
  };
}
function defaultMeal() { const h = new Date().getHours(); return h < 10 ? "Breakfast" : h < 15 ? "Lunch" : h < 20 ? "Dinner" : "Snack"; }

// ================================================================ PROGRESS (shared)
async function progressView(clientId, embedded = false) {
  const [{ data: metrics }, logs, { data: acts }, { data: wos }] = await Promise.all([
    sb.from("body_metrics").select("*").eq("client_id", clientId).order("metric_date"),
    loadLogs(clientId),
    sb.from("activities").select("*").eq("client_id", clientId).order("activity_date", { ascending: false }).limit(20),
    sb.from("workouts").select("id,completed_at").eq("client_id", clientId),
  ]);
  const pbs = personalBests(logs);
  const pbRows = Object.entries(pbs).map(([id, p]) => {
    const f = p.first, b = p.best;
    const dW = (b.weight_kg || 0) - (f.weight_kg || 0); const dR = (b.reps || 0) - (f.reps || 0); const dS = (b.seconds || 0) - (f.seconds || 0);
    const change = [dW ? `${dW > 0 ? "+" : ""}${dW} kg` : "", dR ? `${dR > 0 ? "+" : ""}${dR} reps` : "", dS ? `${dS > 0 ? "+" : ""}${dS}s` : ""].filter(Boolean).join(", ");
    return `<div class="list-item" data-ex="${id}"><div class="grow"><b>${esc(p.name)}</b><div class="muted">${p.sets} sets logged, best ${b.reps ?? b.seconds + "s"}${b.weight_kg ? " @ " + b.weight_kg + " kg" : ""}</div></div>
      ${change ? `<span class="vs up">${esc(change)}</span>` : `<span class="muted">—</span>`}</div>`;
  }).join("");
  const firstW = metrics?.find((m) => m.weight_kg); const lastW = [...(metrics || [])].reverse().find((m) => m.weight_kg);
  const totalChange = firstW && lastW && firstW !== lastW ? (lastW.weight_kg - firstW.weight_kg).toFixed(1) : null;
  const completed = (wos || []).filter((w) => w.completed_at).length;

  const html = `${embedded ? "" : "<h1>Progress</h1>"}
    <div class="grid3">
      <div class="card"><div class="stat">${completed}</div><div class="stat-label">Workouts done</div></div>
      <div class="card"><div class="stat">${logs.length}</div><div class="stat-label">Sets logged</div></div>
      <div class="card"><div class="stat">${totalChange ?? "–"}</div><div class="stat-label">kg change</div></div>
    </div>
    <div class="card"><div class="row between"><h3>Body weight</h3>${embedded ? "" : `<button class="small secondary" id="addW">+ Weigh-in</button>`}</div>
      <div id="wForm"></div>
      ${(metrics || []).some((m) => m.weight_kg) ? `<div class="chart-wrap"><canvas id="wChart"></canvas></div>` : `<div class="empty">No weigh-ins yet.</div>`}</div>
    <div class="card"><h3>Strength & endurance</h3><p class="muted">First logged vs best set. Tap an exercise for its trend.</p>
      ${pbRows || `<div class="empty">Log sets in a workout to see progress.</div>`}
      <div class="chart-wrap" id="exWrap" hidden><canvas id="exChart"></canvas></div></div>
    <div class="card"><div class="row between"><h3>Other activity</h3>${embedded ? "" : `<button class="small secondary" id="addA">+ Activity</button>`}</div>
      <div id="aForm"></div>
      ${(acts || []).map((a) => `<div class="list-item"><div class="grow"><b>${esc(a.type)}</b> <span class="muted">${a.minutes || 0} min${a.distance_km ? ", " + a.distance_km + " km" : ""}</span>
        ${a.notes ? `<div class="muted">${esc(a.notes)}</div>` : ""}</div><span class="muted">${fmtDate(a.activity_date)}</span></div>`).join("") || `<div class="empty">No activities logged.</div>`}</div>`;

  if (embedded) return { html, after: () => drawProgress(metrics, pbs) };
  const d7 = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10), d14 = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
  const { data: recent } = await sb.from("activities").select("activity_date, minutes").eq("client_id", clientId).gte("activity_date", d14);
  const wk = (from, to) => {
    const ls = logs.filter((l) => { const d = l.logged_at.slice(0, 10); return d > from && d <= to; });
    const as = (recent || []).filter((a) => a.activity_date > from && a.activity_date <= to);
    return { days: new Set([...ls.map((l) => l.logged_at.slice(0, 10)), ...as.map((a) => a.activity_date)]).size, sets: ls.length, mins: as.reduce((s, a) => s + (a.minutes || 0), 0) };
  };
  const tw = wk(d7, today()), lw = wk(d14, d7);
  const cmp = (a, b) => (a === b ? `<span class="muted">same as last week</span>` : `<span class="vs ${a > b ? "up" : "down"}">${a > b ? "+" : ""}${a - b} on last week</span>`);
  const reportHtml = `<div class="card"><h3>Your week</h3><div class="report" style="margin-top:10px">
    <div><div class="stat">${tw.days}</div><div class="stat-label">Active days</div>${cmp(tw.days, lw.days)}</div>
    <div><div class="stat">${tw.sets}</div><div class="stat-label">Sets</div>${cmp(tw.sets, lw.sets)}</div>
    <div><div class="stat">${tw.mins}</div><div class="stat-label">Activity min</div>${cmp(tw.mins, lw.mins)}</div></div></div>`;
  let nutHtml = "";
  if (tracksNut() && me.daily_points) {
    const from = new Date(Date.now() - 27 * 864e5).toISOString().slice(0, 10);
    const { data: fl } = await sb.from("food_logs").select("log_date, points").eq("client_id", me.id).gte("log_date", from);
    const byDay = {}; (fl || []).forEach((r) => (byDay[r.log_date] = (byDay[r.log_date] || 0) + Number(r.points)));
    const days = Object.keys(byDay).sort(); const onBudget = days.filter((d) => byDay[d] <= me.daily_points).length;
    nutHtml = `<div class="card"><h3>Nutrition (last 4 weeks)</h3><p class="muted">${days.length} days tracked, ${onBudget} on budget</p>
      ${days.length ? `<div class="chart-wrap"><canvas id="nChart"></canvas></div>` : `<div class="empty">Log food to see your trend.</div>`}</div>`;
    progressView._n = { days, byDay };
  }
  render(html.replace("<h1>Progress</h1>", `<h1>Progress</h1>${reportHtml}<a class="btn secondary block" href="#/badges" style="margin-bottom:12px">${ICON.medal} Streaks and badges</a>`) + nutHtml); drawProgress(metrics, pbs);
  if (progressView._n?.days.length) {
    const { days, byDay } = progressView._n;
    chart("nChart", days.map(fmtDate), [{ label: "Points", data: days.map((d) => byDay[d]) }, { label: "Budget", data: days.map(() => me.daily_points), borderDash: [6, 4], pointRadius: 0, borderColor: "#999" }]);
  }
  $("#addW").onclick = () => weighInForm($("#wForm"), () => progressView(clientId));
  $("#addA").onclick = () => activityForm($("#aForm"), () => progressView(clientId));
}
function drawProgress(metrics, pbs) {
  const wm = (metrics || []).filter((m) => m.weight_kg);
  if (wm.length) chart("wChart", wm.map((m) => fmtDate(m.metric_date)), [{ label: "kg", data: wm.map((m) => m.weight_kg) }]);
  $$("[data-ex]").forEach((row) => (row.onclick = () => {
    const p = pbs[row.dataset.ex]; $("#exWrap").hidden = false;
    charts.filter((c) => c.canvas.id === "exChart").forEach((c) => c.destroy());
    charts = charts.filter((c) => c.canvas.id !== "exChart");
    const h = p.history; const hasW = h.some((x) => x.weight_kg);
    chart("exChart", h.map((x) => fmtDate(x.logged_at)), [
      hasW ? { label: `${p.name} (kg)`, data: h.map((x) => x.weight_kg) } : { label: `${p.name} (${h.some((x) => x.seconds) ? "sec" : "reps"})`, data: h.map((x) => x.reps ?? x.seconds) },
    ]);
    $("#exWrap").scrollIntoView({ behavior: "smooth", block: "center" });
  }));
}

// ================================================================ CHAT (shared)
async function chatView(clientId) {
  if (!clientId) return go(me.role === "trainer" ? "inbox" : "home");
  let other = null;
  if (me.role === "trainer") ({ data: other } = await sb.from("profiles").select("full_name").eq("id", clientId).single());
  else ({ data: other } = await sb.from("profiles").select("full_name").eq("id", me.trainer_id).single());

  const { data: msgs } = await sb.from("messages").select("*").eq("client_id", clientId).order("created_at").limit(300);
  render(`${me.role === "trainer" ? `<button class="back" onclick="location.hash='#/inbox'">← Inbox</button>` : ""}
    <div class="row" style="margin-bottom:8px"><div class="avatar">${esc(initials(other?.full_name))}</div><h2 style="margin:0">${esc(other?.full_name || "Coach")}</h2></div>
    <div class="chat"><div class="chat-log" id="log"></div>
    <form class="chat-input" id="send"><textarea name="m" placeholder="Message…" required></textarea><button>Send</button></form></div>`);
  const log = $("#log");
  const add = (m) => {
    log.insertAdjacentHTML("beforeend", `<div class="bubble ${m.sender_id === me.id ? "me" : "them"}">${esc(m.body)}<time>${fmtTime(m.created_at)}</time></div>`);
    log.scrollTop = log.scrollHeight;
  };
  (msgs || []).forEach(add);
  await sb.from("messages").update({ read_at: new Date().toISOString() }).eq("client_id", clientId).neq("sender_id", me.id).is("read_at", null);

  chatChannel = sb.channel("chat-" + clientId)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `client_id=eq.${clientId}` }, (p) => {
      if (p.new.sender_id !== me.id) { add(p.new); sb.from("messages").update({ read_at: new Date().toISOString() }).eq("id", p.new.id); }
    }).subscribe();

  const form = $("#send");
  form.m.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  form.onsubmit = async (e) => {
    e.preventDefault(); const body = form.m.value.trim(); if (!body) return;
    form.m.value = "";
    const { data, error } = await sb.from("messages").insert({ client_id: clientId, sender_id: me.id, body }).select().single();
    if (!fail(error)) add(data);
  };
}

// ================================================================ PROFILE (shared)
async function profileView() {
  const owned = me.equipment || [];
  render(`<h1>${me.role === "trainer" ? "Settings" : "My profile"}</h1>
    <form class="card" id="pf">
      <label>Full name</label><input name="name" value="${esc(me.full_name)}">
      ${me.role === "client" ? `<label>What do I want to track?</label>
      <div id="tr">${[["exercise", "Exercise"], ["nutrition", "Nutrition"]].map(([k, l]) => `<span class="chip ${(me.tracks || ["exercise"]).includes(k) ? "on" : ""}" data-t="${k}" role="button">${l}</span>`).join("")}</div>
      <label>My goal</label><input name="goal" value="${esc(me.goal)}" placeholder="e.g. Lose 5 kg, run 5 km, get stronger">
      <label>Equipment I have</label><p class="muted">Your coach uses this to fit workouts to your space.</p>
      <div id="eq">${EQUIPMENT.map((e) => `<span class="chip ${owned.includes(e) ? "on" : ""}" data-e="${esc(e)}" role="button">${esc(e)}</span>`).join("")}</div>` : ""}
      <button class="block" style="margin-top:14px">Save</button></form>
    ${me.role === "client" && me.trainer_id ? `<div class="card"><h3>My plan</h3><p><span class="chip on">${{ free: "Workouts only", library: "Library", pt: "PT client" }[me.plan] || me.plan}</span>
      ${me.access_until ? `<span class="muted">until ${fmtDate(me.access_until)}</span>` : ""}</p>${igLink()}</div>` : ""}
    ${me.role === "trainer" ? `<div class="card"><h3>Library access</h3><label class="check"><input type="checkbox" id="libFree" ${me.library_free ? "checked" : ""}>
      <span>Full library is free for all accepted clients. Untick to make it a paid extra (clients still see exercises in their own workouts).</span></label></div>` : ""}
    ${me.role === "client" ? `<div class="card"><h3>Your data</h3><p class="muted">Under POPIA you can see, correct or delete your information.</p>
      <div class="grid2"><button class="secondary" id="export">Download my data</button><button class="secondary" id="delReq">Request deletion</button></div></div>`
      : `<div class="card"><h3>Install on your phone</h3><p class="muted">iPhone: Safari → Share → Add to Home Screen. Android: Chrome menu → Install app. Share this same tip with clients.</p></div>`}
    <p class="muted" style="text-align:center">${esc(session.user.email)}</p>`);
  $$("#eq .chip, #tr .chip").forEach((c) => (c.onclick = () => c.classList.toggle("on")));
  $("#pf").onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    const upd = { full_name: f.name.value };
    if (me.role === "client") {
      upd.goal = f.goal.value; upd.equipment = $$("#eq .chip.on").map((c) => c.dataset.e);
      upd.tracks = $$("#tr .chip.on").map((c) => c.dataset.t);
      if (!upd.tracks.length) return toast("Pick exercise, nutrition or both");
    }
    const { error } = await sb.from("profiles").update(upd).eq("id", me.id);
    if (!fail(error)) { Object.assign(me, upd); toast("Saved"); route(); }
  };
  $("#libFree")?.addEventListener("change", async (e) => {
    const { error } = await sb.from("profiles").update({ library_free: e.target.checked }).eq("id", me.id);
    if (!fail(error)) { me.library_free = e.target.checked; toast(e.target.checked ? "Library is free" : "Library is now a paid extra"); }
  });
  $("#export")?.addEventListener("click", async () => {
    const [p, m, a, l, msg, fl, ck] = await Promise.all([
      sb.from("profiles").select("*").eq("id", me.id).single(), sb.from("body_metrics").select("*").eq("client_id", me.id),
      sb.from("activities").select("*").eq("client_id", me.id), sb.from("set_logs").select("*").eq("client_id", me.id),
      sb.from("messages").select("*").eq("client_id", me.id), sb.from("food_logs").select("*").eq("client_id", me.id), sb.from("checkins").select("*").eq("client_id", me.id)]);
    const blob = new Blob([JSON.stringify({ profile: p.data, body_metrics: m.data, activities: a.data, sets: l.data, messages: msg.data, food: fl.data, checkins: ck.data }, null, 2)], { type: "application/json" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "my-training-data.json"; link.click();
  });
  $("#delReq")?.addEventListener("click", async () => {
    if (!confirm("Send your coach a request to delete your account and data?")) return;
    const { error } = await sb.from("messages").insert({ client_id: me.id, sender_id: me.id, body: "Please delete my account and all my data (POPIA request)." });
    if (!fail(error)) toast("Request sent to your coach");
  });
}

// ================================================================ TRAINER
async function trainerClients() {
  const { data: people } = await sb.from("profiles").select("*").eq("role", "client").order("full_name");
  const pending = (people || []).filter((p) => !p.trainer_id); const mine = (people || []).filter((p) => p.trainer_id === me.id);
  const { data: recent } = await sb.from("set_logs").select("client_id, logged_at").order("logged_at", { ascending: false }).limit(500);
  const lastSeen = {}; (recent || []).forEach((r) => (lastSeen[r.client_id] ??= r.logged_at));
  render(`<h1>Clients</h1>
    ${pending.length ? `<div class="card"><h3>New sign-ups (${pending.length})</h3>${pending.map((p) => `<div class="list-item"><div class="avatar">${esc(initials(p.full_name))}</div>
      <div class="grow"><b>${esc(p.full_name)}</b><div class="muted">${esc(p.email)}, joined ${fmtDate(p.created_at)}${p.popia_consent_at ? "" : ", no consent recorded"}</div></div>
      <button class="small" data-accept="${p.id}">Accept</button></div>`).join("")}</div>` : ""}
    <div class="card">${mine.map((p) => `<a class="list-item" href="#/client/${p.id}"><div class="avatar">${esc(initials(p.full_name))}</div>
      <div class="grow"><b>${esc(p.full_name)}</b> ${p.plan !== "free" ? `<span class="chip ${p.access_until && p.access_until < today() ? "warn" : "good"}">${p.plan === "pt" ? "PT" : "Library"}</span>` : ""}<div class="muted">${esc(p.goal || "No goal set")}</div></div>
      <span class="muted">${lastSeen[p.id] ? "Trained " + fmtDate(lastSeen[p.id]) : "No sets yet"}</span></a>`).join("")
      || `<div class="empty">No clients yet. Share the app link — new sign-ups appear here for you to accept.</div>`}</div>`);
  $$("[data-accept]").forEach((b) => (b.onclick = async () => {
    const { error } = await sb.from("profiles").update({ trainer_id: me.id }).eq("id", b.dataset.accept);
    if (!fail(error)) { toast("Client accepted"); trainerClients(); }
  }));
}

function checkinHistory(rows) {
  const flag = (k, v) => (k === "soreness" ? v >= 4 : v <= 2);
  return `<div class="card"><div class="row between"><h3>Check-ins</h3><span class="muted">Last 14 days</span></div>
    ${rows.length ? `<div class="ck-table"><span></span>${CHECKIN.map((q) => `<span class="muted">${q.label}</span>`).join("")}
      ${rows.map((r) => `<span>${fmtDate(r.checkin_date)}</span>${CHECKIN.map((q) => `<span class="${flag(q.key, r[q.key]) ? "chip warn" : ""}">${r[q.key] ?? "–"}</span>`).join("")}
        ${r.note ? `<span class="ck-note">${esc(r.note)}</span>` : ""}`).join("")}</div>
      <p class="muted" style="margin:10px 0 0">Highlighted: energy or sleep of 2 or less, soreness of 4 or more.</p>`
      : `<p class="muted" style="margin:0">No check-ins yet. Clients see the check-in on their Today screen.</p>`}</div>`;
}

async function trainerClient(id) {
  const [{ data: c }, { data: wos }, { data: cks }] = await Promise.all([
    sb.from("profiles").select("*").eq("id", id).single(),
    sb.from("workouts").select("*, workout_items(count)").eq("client_id", id).order("created_at", { ascending: false }),
    sb.from("checkins").select("*").eq("client_id", id).gte("checkin_date", new Date(Date.now() - 13 * 864e5).toISOString().slice(0, 10)).order("checkin_date", { ascending: false }),
  ]);
  if (!c) return render(`<div class="empty">Client not found.</div>`);
  const prog = await progressView(id, true);
  render(`<button class="back" onclick="location.hash='#/clients'">← Clients</button>
    <div class="card"><div class="row"><div class="avatar">${esc(initials(c.full_name))}</div><div class="grow"><h2 style="margin:0">${esc(c.full_name)}</h2>
      <div class="muted">${esc(c.goal || "No goal set")}</div></div><button class="small" onclick="location.hash='#/chat/${c.id}'">${ICON.chat} Chat</button></div>
      <div style="margin-top:10px">${(c.equipment || []).map((e) => `<span class="chip">${esc(e)}</span>`).join("") || `<span class="muted">Bodyweight only / not set</span>`}</div></div>
    <form class="card" id="acc"><h3>Access & payment</h3><div class="grid2">
      <div><label>Plan</label><select name="plan">${[["free", "Workouts only"], ["library", "Library subscriber"], ["pt", "PT client"]].map(([k, l]) => `<option value="${k}" ${c.plan === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <div><label>Paid until</label><input name="until" type="date" value="${c.access_until || ""}"></div></div>
      <div style="margin-top:10px">${CONFIG.OFFERS.filter((o) => o.days).map((o) => `<button type="button" class="small secondary" data-pass="${o.days}" data-plan="${o.key === "package" ? "pt" : "library"}" style="margin:0 6px 6px 0">${esc(o.title)}</button>`).join("")}</div>
      <p class="muted" style="margin:4px 0 0">A pass sets the plan and adds its days from today, or from the end of their current pass.</p>
      <button class="small" style="margin-top:10px">Update access</button>
      ${c.access_until && c.access_until < today() ? `<span class="chip warn">Expired ${fmtDate(c.access_until)}</span>` : ""}</form>
    ${checkinHistory((cks || []).filter((r) => r.energy != null))}
    <div class="card"><div class="row between"><h3>Workouts</h3><button class="small" onclick="location.hash='#/builder/${c.id}'">+ New workout</button></div>
      ${(wos || []).map((w) => `<a class="list-item" href="#/builder/${c.id}/${w.id}"><div class="grow"><b>${esc(w.name)}</b>
        <div class="muted">${w.workout_items?.[0]?.count || 0} exercises${w.scheduled_date ? ", " + fmtDate(w.scheduled_date) : ""}</div></div>
        ${w.completed_at ? `<span class="chip good">Done ${fmtDate(w.completed_at)}</span>` : `<span class="chip">Open</span>`}</a>`).join("")
        || `<div class="empty">No workouts yet.</div>`}</div>
    ${prog.html}`);
  prog.after();
  $$("[data-pass]").forEach((b) => (b.onclick = () => {
    const f = $("#acc"); const base = f.until.value && f.until.value >= today() ? new Date(f.until.value) : new Date(Date.now() - 864e5);
    base.setDate(base.getDate() + Number(b.dataset.pass)); f.until.value = base.toISOString().slice(0, 10);
    if (f.plan.value !== "pt") f.plan.value = b.dataset.plan;
    toast(`${b.textContent} set to ${fmtDate(f.until.value)}. Tap Update access to save.`);
  }));
  $("#acc").onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    const { error } = await sb.from("profiles").update({ plan: f.plan.value, access_until: f.until.value || null }).eq("id", c.id);
    if (!fail(error)) { toast("Access updated"); await sb.from("messages").insert({ client_id: c.id, sender_id: me.id, body: `Your access is active${f.until.value ? " until " + fmtDate(f.until.value) : ""}. Enjoy!` }); }
  };
}

async function workoutBuilder(clientId, workoutId) {
  const [{ data: c }, { data: library }, wRes] = await Promise.all([
    sb.from("profiles").select("*").eq("id", clientId).single(),
    sb.from("exercises").select("*").eq("trainer_id", me.id).order("name"),
    workoutId ? sb.from("workouts").select("*, workout_items(*)").eq("id", workoutId).single() : Promise.resolve({ data: null }),
  ]);
  const w = wRes.data;
  let items = (w?.workout_items || []).sort((a, b) => a.position - b.position).map((i) => ({ ...i }));
  const lib = library || [];
  if (!lib.length) return render(`<button class="back" onclick="history.back()">← Back</button><div class="card"><h2>Add exercises first</h2>
    <p>Your library is empty. Add exercises (with videos) to the library, then build workouts from them.</p><button onclick="location.hash='#/exercise/new'">Add an exercise</button></div>`);

  const draw = () => {
    $("#items").innerHTML = items.map((it, i) => {
      const ex = lib.find((x) => x.id === it.exercise_id) || {};
      return `<div class="card" data-i="${i}"><div class="row between"><b>${i + 1}. ${esc(ex.name)}</b>
        <span><button type="button" class="small secondary" data-up="${i}" aria-label="Move up">${ICON.up}</button> <button type="button" class="small secondary" data-rm="${i}" aria-label="Remove">${ICON.close}</button></span></div>
        ${swapHtml(swapSuggestions(ex, lib, c.equipment))}
        <div class="grid3"><div><label>Sets</label><input data-k="target_sets" type="number" value="${it.target_sets ?? ""}"></div>
        <div><label>Reps</label><input data-k="target_reps" type="number" value="${it.target_reps ?? ""}"></div>
        <div><label>kg</label><input data-k="target_weight_kg" type="number" step="0.5" value="${it.target_weight_kg ?? ""}"></div>
        <div><label>Seconds</label><input data-k="target_seconds" type="number" value="${it.target_seconds ?? ""}"></div>
        <div><label>Rest (s)</label><input data-k="rest_seconds" type="number" value="${it.rest_seconds ?? ""}"></div></div>
        <label>Note for client</label><input data-k="notes" value="${esc(it.notes)}"></div>`;
    }).join("") || `<div class="empty">Add exercises from the library below.</div>`;
    $$("#items [data-k]").forEach((inp) => (inp.oninput = () => {
      const i = inp.closest("[data-i]").dataset.i; const k = inp.dataset.k;
      items[i][k] = k === "notes" ? inp.value : num(inp.value);
    }));
    $$("[data-rm]").forEach((b) => (b.onclick = () => { items.splice(b.dataset.rm, 1); draw(); }));
    $$("[data-up]").forEach((b) => (b.onclick = () => { const i = +b.dataset.up; if (i > 0) { [items[i - 1], items[i]] = [items[i], items[i - 1]]; draw(); } }));
  };

  render(`<button class="back" onclick="location.hash='#/client/${clientId}'">← ${esc(c.full_name)}</button>
    <h1>${w ? "Edit workout" : "New workout"}</h1>
    <form id="wf"><div class="card"><label>Workout name</label><input name="name" required value="${esc(w?.name || "")}" placeholder="e.g. Lower body A">
      <div class="grid2"><div><label>Date</label><input name="date" type="date" value="${w?.scheduled_date || today()}"></div><div></div></div>
      <label>Notes</label><textarea name="notes" placeholder="Warm-up, focus for today…">${esc(w?.notes || "")}</textarea>
      <p class="muted" style="margin-top:8px">Client equipment: ${(c.equipment || []).map(esc).join(", ") || "not set"}</p></div>
    <div id="items"></div>
    <div class="card"><label>Add exercise from library</label><div class="row"><select id="pick">${lib.map((x) => `<option value="${x.id}">${esc(x.name)} — ${esc(x.muscle_group)}${missingEquipment(x, c.equipment).length ? " (needs kit)" : ""}</option>`).join("")}</select>
      <button type="button" id="addEx">Add</button></div><p class="muted">Marked "needs kit": the client doesn't own that equipment, so swap suggestions are shown.</p></div>
    <div class="grid2"><button class="block">Save workout</button>${w ? `<button type="button" class="danger" id="del">Delete</button>` : ""}</div></form>`);
  draw();
  $("#addEx").onclick = () => { items.push({ exercise_id: $("#pick").value, target_sets: 3, target_reps: 10 }); draw(); };
  $("#del")?.addEventListener("click", async () => {
    if (!confirm("Delete this workout and its logged sets?")) return;
    const { error } = await sb.from("workouts").delete().eq("id", w.id); if (!fail(error)) go("client/" + clientId);
  });
  $("#wf").onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    if (!items.length) return toast("Add at least one exercise");
    const row = { trainer_id: me.id, client_id: clientId, name: f.name.value, scheduled_date: f.date.value || null, notes: f.notes.value || null };
    const { data: saved, error } = w ? await sb.from("workouts").update(row).eq("id", w.id).select().single()
      : await sb.from("workouts").insert(row).select().single();
    if (fail(error)) return;
    // Keep existing items (so logged sets stay linked), update/insert the rest, remove dropped ones
    const keepIds = items.filter((i) => i.id).map((i) => i.id);
    const dropped = (w?.workout_items || []).filter((i) => !keepIds.includes(i.id)).map((i) => i.id);
    if (dropped.length) { const { error: de } = await sb.from("workout_items").delete().in("id", dropped); if (fail(de)) return; }
    const payload = items.map((i, pos) => {
      const r = { workout_id: saved.id, exercise_id: i.exercise_id, position: pos, target_sets: i.target_sets ?? null, target_reps: i.target_reps ?? null,
        target_weight_kg: i.target_weight_kg ?? null, target_seconds: i.target_seconds ?? null, rest_seconds: i.rest_seconds ?? null, notes: i.notes || null };
      if (i.id) r.id = i.id; return r;
    });
    const existing = payload.filter((p) => p.id); const fresh = payload.filter((p) => !p.id);
    if (existing.length) { const { error: ue } = await sb.from("workout_items").upsert(existing); if (fail(ue)) return; }
    if (fresh.length) { const { error: ie } = await sb.from("workout_items").insert(fresh); if (fail(ie)) return; }
    if (!w) await sb.from("messages").insert({ client_id: clientId, sender_id: me.id, body: `New workout ready: "${saved.name}"` });
    toast("Workout saved"); go("client/" + clientId);
  };
}

async function trainerLibrary() {
  const { data } = await sb.from("exercises").select("*").eq("trainer_id", me.id).order("name");
  const all = data || [];
  render(`<div class="row between"><h1>Library</h1><button class="small" onclick="location.hash='#/exercise/new'">+ Exercise</button></div>
    <p class="muted">Every exercise you add is saved here and reusable for any client. Mark some as bonus videos to reward 7, 14 and 30-day streaks.</p>
    <input id="q" placeholder="Search exercises…" style="margin-bottom:8px">
    <div id="mg">${["All", ...MUSCLES].map((m, i) => `<span class="chip ${i ? "" : "on"}" data-m="${m}" role="button">${m}</span>`).join("")}</div>
    <div class="card" id="list" style="margin-top:10px"></div>`);
  let mg = "All";
  const draw = () => {
    const q = $("#q").value.toLowerCase();
    const rows = all.filter((x) => (mg === "All" || x.muscle_group === mg) && x.name.toLowerCase().includes(q));
    $("#list").innerHTML = rows.map((x) => `<a class="list-item" href="#/exercise/${x.id}"><div class="grow"><b>${esc(x.name)}</b>
      <div class="muted">${esc(x.muscle_group)}, ${(x.equipment || []).map(esc).join(", ") || "Bodyweight"}</div></div>
      ${x.reward_streak ? `<span class="chip good">Bonus ${x.reward_streak}d</span>` : ""} ${x.video_path ? "Video" : `<span class="chip warn">No video</span>`} ${x.cues?.length ? "" : `<span class="chip warn">No cues</span>`}</a>`).join("")
      || `<div class="empty">${all.length ? "No matches." : "Start your library — add your first exercise."}</div>`;
  };
  $("#q").oninput = draw;
  $$("#mg .chip").forEach((c) => (c.onclick = () => { $$("#mg .chip").forEach((x) => x.classList.remove("on")); c.classList.add("on"); mg = c.dataset.m; draw(); }));
  draw();
}

async function exerciseEditor(id) {
  const isNew = id === "new";
  const ex = isNew ? { name: "", muscle_group: "Full body", equipment: [], cues: [], instructions: "" }
    : (await sb.from("exercises").select("*").eq("id", id).single()).data;
  if (!ex) return render(`<div class="empty">Exercise not found.</div>`);
  const url = await videoUrl(ex.video_path);
  render(`<button class="back" onclick="location.hash='#/library'">← Library</button>
    <h1>${isNew ? "New exercise" : esc(ex.name)}</h1>
    <form id="ef" class="card">
      <label>Name</label><input name="name" required value="${esc(ex.name)}" placeholder="e.g. Goblet squat">
      <label>Muscle group</label><select name="mg">${MUSCLES.map((m) => `<option ${m === ex.muscle_group ? "selected" : ""}>${m}</option>`).join("")}</select>
      <label>Equipment needed <span class="muted">(none = bodyweight)</span></label>
      <div id="eq">${EQUIPMENT.filter((e) => e !== "Full gym").map((e) => `<span class="chip ${ex.equipment.includes(e) ? "on" : ""}" data-e="${esc(e)}" role="button">${esc(e)}</span>`).join("")}</div>
      <label for="rw">Bonus video for streaks</label>
      <select name="rw" id="rw">${[["", "No, part of the normal library"], ["7", "Unlocks at a 7-day streak"], ["14", "Unlocks at a 14-day streak"], ["30", "Unlocks at a 30-day streak"]]
        .map(([v, l]) => `<option value="${v}" ${String(ex.reward_streak ?? "") === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      <p class="muted">Bonus videos are free rewards. Clients can't see them until their streak gets there.</p>
      <label>Demo video</label>
      ${url ? `<video src="${esc(url)}" controls playsinline style="width:100%;border-radius:10px;max-height:260px"></video>` : ""}
      <input type="file" name="video" accept="video/*">
      <p class="muted">Tip: film landscape or square, 10–20 seconds, side-on angle, max 100 MB.</p>
      <label>How to (setup & steps)</label><textarea name="ins">${esc(ex.instructions)}</textarea>
      <div class="row between" style="margin-top:10px"><label style="margin:0">Coaching cues <span class="muted">(one per line)</span></label>
        <button type="button" class="small secondary" id="ai">Draft with AI</button></div>
      <textarea name="cues" style="min-height:120px" placeholder="Keep your back flat&#10;Drive through your heels">${esc((ex.cues || []).join("\n"))}</textarea>
      <p class="muted">AI drafts are a starting point — check and edit before saving. Clients only see what you save.</p>
      <button class="block" style="margin-top:12px" id="save">Save to library</button>
      ${isNew ? "" : `<button type="button" class="block danger" style="margin-top:8px" id="del">Delete exercise</button>`}
    </form>`);
  $$("#eq .chip").forEach((c) => (c.onclick = () => c.classList.toggle("on")));
  $("#ai").onclick = async () => {
    const f = $("#ef"); if (!f.name.value) return toast("Add the exercise name first");
    const b = $("#ai"); b.disabled = true; b.textContent = "Thinking…";
    const { data, error } = await sb.functions.invoke("coach-cues", {
      body: { name: f.name.value, muscle_group: f.mg.value, equipment: $$("#eq .chip.on").map((c) => c.dataset.e), instructions: f.ins.value },
    });
    b.disabled = false; b.textContent = "Draft with AI";
    if (error || data?.error) return toast("AI cues not available — check setup step 6");
    f.cues.value = data.cues.join("\n"); toast("Draft ready — review and edit");
  };
  $("#del")?.addEventListener("click", async () => {
    if (!confirm("Delete this exercise? It can't be deleted while it's used in a workout.")) return;
    const { error } = await sb.from("exercises").delete().eq("id", id);
    if (error) return toast("It's used in a workout — remove it there first");
    if (ex.video_path) await sb.storage.from("exercise-videos").remove([ex.video_path]);
    go("library");
  });
  $("#ef").onsubmit = async (e) => {
    e.preventDefault(); const f = e.target; const btn = $("#save"); btn.disabled = true;
    let video_path = ex.video_path || null;
    const file = f.video.files[0];
    if (file) {
      if (file.size > 100 * 1024 * 1024) { btn.disabled = false; return toast("Video is over 100 MB — trim it first"); }
      btn.textContent = "Uploading video…";
      const path = `${me.id}/${crypto.randomUUID()}.${(file.name.split(".").pop() || "mp4").toLowerCase()}`;
      const { error: ue } = await sb.storage.from("exercise-videos").upload(path, file, { contentType: file.type });
      if (fail(ue)) { btn.disabled = false; btn.textContent = "Save to library"; return; }
      if (ex.video_path) await sb.storage.from("exercise-videos").remove([ex.video_path]);
      video_path = path;
    }
    const row = { trainer_id: me.id, name: f.name.value.trim(), muscle_group: f.mg.value, equipment: $$("#eq .chip.on").map((c) => c.dataset.e),
      instructions: f.ins.value || null, cues: f.cues.value.split("\n").map((s) => s.trim()).filter(Boolean), video_path,
      reward_streak: f.rw.value ? Number(f.rw.value) : null };
    const { error } = isNew ? await sb.from("exercises").insert(row) : await sb.from("exercises").update(row).eq("id", id);
    btn.disabled = false; btn.textContent = "Save to library";
    if (!fail(error)) { toast("Saved to library"); go("library"); }
  };
}

async function trainerInbox() {
  const [{ data: clients }, { data: msgs }] = await Promise.all([
    sb.from("profiles").select("id, full_name").eq("trainer_id", me.id).order("full_name"),
    sb.from("messages").select("*").order("created_at", { ascending: false }).limit(500),
  ]);
  const last = {}; const unread = {};
  (msgs || []).forEach((m) => { last[m.client_id] ??= m; if (!m.read_at && m.sender_id !== me.id) unread[m.client_id] = (unread[m.client_id] || 0) + 1; });
  const sorted = (clients || []).sort((a, b) => (last[b.id]?.created_at || "").localeCompare(last[a.id]?.created_at || ""));
  render(`<h1>Chat</h1><div class="card">${sorted.map((c) => `<a class="list-item" href="#/chat/${c.id}"><div class="avatar">${esc(initials(c.full_name))}</div>
    <div class="grow"><b>${esc(c.full_name)}</b><div class="muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(last[c.id]?.body || "No messages yet")}</div></div>
    ${unread[c.id] ? `<span class="chip on">${unread[c.id]}</span>` : `<span class="muted">${last[c.id] ? fmtDate(last[c.id].created_at) : ""}</span>`}</a>`).join("")
    || `<div class="empty">Accept a client to start chatting.</div>`}</div>`);
}

// Boot: onAuthStateChange fires INITIAL_SESSION on load and starts the app.
