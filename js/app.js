import { CONFIG, BRAND } from "./config.js";
import { FOODS, WEEKLY_BUFFER, RECIPES, calcPoints, dailyKcal, waterGoal, GLASS_ML, WATER_TIPS } from "./nutrition.js";
import { CHALLENGES, TIPS, BADGES, badgeStats, medal, pickForDate, ROULETTE_UNLOCK_DAYS } from "./engage.js";
import { MOVES, moveFor, moveSvg, startMoves } from "./moves.js";
import { NAMES as MUSCLE_NAMES, musclesFor, muscleMapSvg } from "./muscles.js";
import { STARTER } from "./starter.js";

// ---------------------------------------------------------------- setup
const SUPABASE_ESM = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
// ?demo opens a sample-data copy of the app, so anyone can look around both sides safely.
const DEMO = CONFIG.DEMO || new URLSearchParams(location.search).has("demo");
const sb = DEMO ? (await import("./demo.js")).createDemoClient()
  : (await import(SUPABASE_ESM)).createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
document.documentElement.style.setProperty("--primary", BRAND.primary);
document.documentElement.style.setProperty("--bg", BRAND.ink);
document.title = CONFIG.APP_NAME;
$("#brandName").textContent = CONFIG.APP_NAME;
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
if (DEMO && !CONFIG.DEMO) document.body.insertAdjacentHTML("afterbegin", `<div class="demo-bar">Sample data: nothing here is real or saved. <a href="${location.pathname}">Back to the real app</a></div>`);

const EQUIPMENT = [
  "Full gym", "Dumbbells", "Barbell", "Kettlebell", "Resistance bands", "Bench", "Pull-up bar",
  "Cable machine", "Machines", "Medicine ball", "Step/box", "Yoga mat", "TRX/suspension",
  "Skipping rope", "Treadmill", "Bike",
];
const MUSCLES = ["Legs", "Glutes", "Chest", "Back", "Shoulders", "Arms", "Core", "Full body", "Cardio", "Mobility"];
// Exercise types (sections). The coach can add her own as well; see the exercise editor.
const TYPES = CONFIG.EXERCISE_TYPES || ["Warm-up", "Main set", "Cool-down", "Chill set", "Mobility", "Stretch", "Finisher"];
const typesOf = (x) => x.categories || [];
function typeOrder(list) {
  const present = [...new Set(list.flatMap(typesOf))];
  return [...TYPES.filter((t) => present.includes(t)), ...present.filter((t) => !TYPES.includes(t)).sort()];
}
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
let myScreen = null;   // the client's health check
let restT = null;      // rest timer between sets
let activeSess = null; // guided workout in progress (paused automatically when you leave it)
// A coach can switch to "My training" and use the client side as her own client.
let viewAs = (() => { try { return localStorage.getItem("or-view") || "coach"; } catch { return "coach"; } })();
const isClientView = () => me?.role === "client" || (me?.role === "trainer" && viewAs === "client");
async function switchView() {
  const next = viewAs === "client" ? "coach" : "client";
  if (next === "client" && me.trainer_id !== me.id) {
    const upd = { trainer_id: me.id, tracks: me.tracks?.length ? me.tracks : ["exercise", "nutrition"] };
    const { error } = await sb.from("profiles").update(upd).eq("id", me.id); if (fail(error)) return;
    Object.assign(me, upd);
  }
  if (next === "client") myTrainer = me;
  viewAs = next; try { localStorage.setItem("or-view", next); } catch {}
  toast(next === "client" ? "My training: you're now seeing the client side" : "Coach view");
  if (location.hash === (next === "client" ? "#/home" : "#/dash")) route(); else location.hash = next === "client" ? "#/home" : "#/dash";
}
// Remember an invite code from a shared link (?ref=CODE) until sign-up.
try { const r = new URLSearchParams(location.search).get("ref"); if (r) localStorage.setItem("or-ref", r.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 12)); } catch {}
const refCode = () => { try { return localStorage.getItem("or-ref") || ""; } catch { return ""; } };
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
  startMoves($("#view")); hydrateAvatars($("#view"));
}
function go(path) { location.hash = "#/" + path; }
function initials(name) { return (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(); }
// Avatar: initials straight away, swapped for the photo once its private link arrives.
function avatar(p, cls = "") {
  return `<span class="avatar ${cls}" ${p?.avatar_path ? `data-av="${esc(p.avatar_path)}"` : ""} aria-hidden="true">${esc(initials(p?.full_name))}</span>`;
}
const avCache = {};
async function hydrateAvatars(root = document) {
  const els = [...root.querySelectorAll("[data-av]")]; if (!els.length) return;
  const need = [...new Set(els.map((e) => e.dataset.av))].filter((p) => !avCache[p]);
  if (need.length) {
    const { data } = await sb.storage.from("avatars").createSignedUrls(need, 60 * 60 * 12);
    (data || []).forEach((d) => { if (d.signedUrl) avCache[d.path] = d.signedUrl; });
  }
  els.forEach((e) => { const u = avCache[e.dataset.av]; if (u) { e.style.backgroundImage = `url("${u}")`; e.classList.add("has-photo"); } });
}
// Shrink a photo on the phone before upload. Re-encoding also drops location data.
async function shrinkImage(file, max = 1080, quality = 0.82) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  if (!bmp) throw new Error("That file isn't a photo the app can read. Try a JPG or PNG.");
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise((res) => c.toBlob(res, "image/jpeg", quality));
}
function fmtDate(d) { return d ? new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short" }) : ""; }
function fmtTime(d) { return new Date(d).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
const tracksEx = () => (me?.tracks || ["exercise"]).includes("exercise");
const tracksNut = () => (me?.tracks || []).includes("nutrition");
function weekStart(d = new Date()) { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x.toISOString().slice(0, 10); }
// Messaging the coach is part of a pass or the PT plan.
function canChat() {
  if (me?.role === "trainer") return true;
  return ["library", "pt"].includes(me?.plan) && (!me.access_until || me.access_until >= today());
}
function hasLibrary() {
  if (me?.role === "trainer") return true;
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
  grip: I('<circle cx="9" cy="6" r="1.3" fill="currentColor"/><circle cx="15" cy="6" r="1.3" fill="currentColor"/><circle cx="9" cy="12" r="1.3" fill="currentColor"/><circle cx="15" cy="12" r="1.3" fill="currentColor"/><circle cx="9" cy="18" r="1.3" fill="currentColor"/><circle cx="15" cy="18" r="1.3" fill="currentColor"/>'),
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
  if (it.target_sets) parts.push(`${it.target_sets} ${it.target_sets === 1 ? "set" : "sets"}`);
  if (it.target_reps) parts.push(`${it.target_reps} ${it.target_reps === 1 ? "rep" : "reps"}`);
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
  myTrainer = null; myScreen = null;
  if (me) { const { data: hs } = await sb.from("health_screens").select("*").eq("client_id", me.id); myScreen = hs?.[0] || null; }
  if (me?.trainer_id) ({ data: myTrainer } = await sb.from("profiles").select("id, full_name, library_free, avatar_path").eq("id", me.trainer_id).single());
}

$("#meBtn").onclick = () => go("me");
$("#signOut").onclick = async () => { await sb.auth.signOut(); go(""); };

function authView(mode = refCode() ? "up" : "in") {
  $("#topbar").hidden = true; $("#tabbar").hidden = true;
  render(`<div class="auth-hero">${CONFIG.PHOTOS.welcome ? `<img class="photo" src="${esc(CONFIG.PHOTOS.welcome)}" alt="">` : forms(7, { w: 400, h: 380, scale: 1.15 })}
    <div><img src="icons/logo.png" class="logo-big" alt="${esc(CONFIG.APP_NAME)}">
    <p class="muted" style="margin:0;color:#C9C6BC">Your programme, your progress, your coach.</p></div></div>
    <div class="auth">
    ${DEMO ? `<div class="card" style="margin-top:18px"><h3>Take a look around</h3><p class="muted">This is a demo with sample data. Changes reset when you refresh.</p>
      <div class="grid2"><button id="demoClient">I'm a client</button><button class="secondary" id="demoCoach">I'm the coach</button></div></div>` : ""}
    <div class="tabs"><button data-m="in" class="${mode === "in" ? "active" : ""}">Sign in</button><button data-m="up" class="${mode === "up" ? "active" : ""}">Create account</button></div>
    <form id="authForm" class="card">
      ${mode === "up" && refCode() ? `<p class="muted" style="margin:0 0 6px">A friend invited you. Welcome.</p>` : ""}
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
        options: { data: { full_name: f.name.value, popia_consent: "true", ref: refCode() }, emailRedirectTo: location.origin + location.pathname },
      });
      btn.disabled = false;
      if (fail(error)) return;
      try { localStorage.removeItem("or-ref"); } catch {}
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
  $("#meBtn").hidden = !((me?.role === "client" && me.trainer_id) || me?.role === "trainer");
  const mb = $("#modeBtn");
  if (mb) { mb.hidden = me?.role !== "trainer"; mb.textContent = viewAs === "client" ? "Coach view" : "My training"; mb.onclick = switchView; }
  if (me?.avatar_path) { $("#meBtn").innerHTML = avatar(me, "sm"); hydrateAvatars($("#topbar")); }
}

async function unreadCount() {
  const q = sb.from("messages").select("id", { count: "exact", head: true }).is("read_at", null).neq("sender_id", me.id);
  const { count } = isClientView() ? await q.eq("client_id", me.id) : await q;
  return count || 0;
}

async function route() {
  if (chatChannel) { sb.removeChannel(chatChannel); chatChannel = null; }
  clearInterval(restT); $("#rest")?.remove(); clearInterval(timerT);
  if (activeSess && !location.hash.startsWith("#/session/")) {
    const st = activeSess.st; st.elapsed = sessElapsed(st); st.runningSince = null; st.paused = true; writeSess(activeSess.id, st); activeSess = null;
  }
  if (!session) return authView();
  if (!me) { await loadMe(); if (!me) return render(`<div class="empty">Setting up your profile… refresh in a moment.</div>`); }

  const [page, a, b] = location.hash.replace(/^#\/?/, "").split("/");
  if (isClientView()) flushQ();
  if (isClientView() && me.trainer_id && visitLogged !== today()) {
    visitLogged = today();
    await sb.from("checkins").upsert({ client_id: me.id, checkin_date: today() }, { onConflict: "client_id,checkin_date", ignoreDuplicates: true });
  }
  const unread = await unreadCount();
  const badge = unread > 0;

  if (me.role === "trainer" && viewAs !== "client") {
    tabs([["dash", "home", "Today"], ["clients", "clients", "Clients"], ["library", "library", "Exercises"], ["workouts", "train", "Workouts"], ["inbox", "chat", "Chat", badge]]);
    const views = { dash: trainerDash, clients: trainerClients, client: () => trainerClient(a), photos: () => photosView(a),
      builder: () => builder({ kind: "client", clientId: a, id: b }), wb: () => builder({ kind: "template", id: a === "new" ? null : a }),
      workouts: () => workoutLibrary(), templates: () => workoutLibrary(), folder: () => workoutLibrary("folder", a), cfolder: () => workoutLibrary("cfolder", a), template: () => assignView(a), assign: () => assignView(a, b),
      library: trainerLibrary, exercise: () => exerciseEditor(a), inbox: trainerInbox, chat: () => chatView(a), me: profileView };
    return (views[page] || trainerDash)();
  }

  if (!myScreen || page === "health") return healthView();

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
    ["library", "library", "Library"], ...(me.role === "trainer" ? [["me", "settings", "Profile"]] : [["chat", "chat", "Coach", badge]])], true);
  const views = { home: clientHome, food: () => foodView(a), log: () => logView(a), passes: passesView,
    roulette: rouletteView, badges: badgesView, recipe: () => recipeView(a), photos: () => photosView(), water: waterView, workouts: clientWorkouts, workout: () => workoutView(a), session: () => sessionView(a, b), progress: () => progressView(me.id),
    library: clientLibrary, ex: () => clientExercise(a), chat: () => chatView(me.id), me: profileView };
  return (views[page] || clientHome)();
}
window.addEventListener("hashchange", route);

// ================================================================ CLIENT
// Health check before training. Wording is adapted from common pre-exercise screening questions.
const HEALTH_QS = [
  ["heart", "Has a doctor ever told you that you have a heart condition or high blood pressure?"],
  ["chest", "Do you get pain or pressure in your chest at rest, during daily activities or when you exercise?"],
  ["dizzy", "Do you lose your balance because of dizziness, or have you fainted in the last 12 months?"],
  ["chronic", "Do you have another ongoing medical condition, such as diabetes, asthma or epilepsy?"],
  ["meds", "Are you taking prescribed medication for an ongoing condition?"],
  ["joint", "Do you have a bone, joint or muscle problem (back, knee, hip, shoulder) that exercise could make worse?"],
  ["pregnant", "Are you pregnant, or have you had a baby in the last 6 months?"],
  ["supervised", "Has a doctor ever said you should only exercise under medical supervision?"],
];
const DEFAULT_WAIVER = "Exercise carries some risk of injury. By training with my coach I agree to: answer the health questions honestly and tell my coach if anything changes; stop and tell my coach if I feel pain, dizziness or chest discomfort, or feel unwell; train within my own limits and follow my coach's guidance on technique and load. Guidance in this app does not replace advice from my doctor.";
async function healthView() {
  const h = myScreen; const a = h?.answers || {};
  $("#topbar").hidden = false; $("#tabbar").hidden = !h;
  render(`${h ? `<button class="back" onclick="location.hash='#/me'">Back to profile</button>` : ""}
    <h1>${h ? "My health check" : "Before you start"}</h1>
    <p class="muted">${h ? "Update this whenever something changes, such as a new injury, medication or pregnancy." : "A one-minute health check so your coach can keep your training safe. Only you and your coach can see it."}</p>
    <form id="hs"><div class="card"><h3>Health questions</h3>
      ${HEALTH_QS.map(([k, q]) => `<fieldset class="yn"><legend>${q}</legend>
        <label><input type="radio" name="${k}" value="no" required ${a[k] === false ? "checked" : ""}><span>No</span></label>
        <label><input type="radio" name="${k}" value="yes" ${a[k] === true ? "checked" : ""}><span>Yes</span></label></fieldset>`).join("")}
      <label for="hsd">Anything else your coach should know?</label>
      <textarea id="hsd" name="details" maxlength="1000" placeholder="Optional: injuries, operations, conditions or medication">${esc(h?.details || "")}</textarea></div>
    <div class="card"><h3>Emergency contact</h3><div class="grid2">
      <div><label for="hen">Name</label><input id="hen" name="en" required maxlength="120" autocomplete="off" value="${esc(h?.emergency_name || "")}"></div>
      <div><label for="hep">Phone</label><input id="hep" name="ep" type="tel" required maxlength="40" autocomplete="off" value="${esc(h?.emergency_phone || "")}"></div></div>
      <p class="muted" style="margin:8px 0 0">Only your coach sees this. Let the person know you've listed them.</p></div>
    <div class="card"><h3>Agreement</h3><p class="waiver">${esc(CONFIG.WAIVER || DEFAULT_WAIVER)}</p>
      <label class="check"><input type="checkbox" name="w" required ${h ? "checked" : ""}><span>I've read and agree to the above.</span></label>
      <label class="check"><input type="checkbox" name="c" required ${h ? "checked" : ""}><span>I consent to my coach collecting and using my health information to plan safe training for me. Only my coach and I can see it, and I can ask for it to be deleted.</span></label></div>
    <button class="block">${h ? "Save changes" : "Save and continue"}</button></form>`);
  $("#hs").onsubmit = async (e) => {
    e.preventDefault(); const f = e.target; const now = new Date().toISOString();
    const answers = Object.fromEntries(HEALTH_QS.map(([k]) => [k, f[k].value === "yes"]));
    const row = { client_id: me.id, answers, details: f.details.value.trim() || null, emergency_name: f.en.value.trim(), emergency_phone: f.ep.value.trim(),
      waiver_accepted_at: h?.waiver_accepted_at || now, health_consent_at: h?.health_consent_at || now };
    const { data, error } = await sb.from("health_screens").upsert(row, { onConflict: "client_id" }).select().single();
    if (fail(error)) return;
    const yes = Object.values(answers).filter(Boolean).length;
    const changed = !h || JSON.stringify(h.answers) !== JSON.stringify(answers);
    myScreen = { ...row, ...data, flags: data?.flags ?? yes };
    if (me.trainer_id && changed) await sb.from("messages").insert({ client_id: me.id, sender_id: me.id,
      body: yes ? `I've ${h ? "updated" : "completed"} my health check and answered yes to ${yes} ${yes === 1 ? "question" : "questions"}.` : `I've ${h ? "updated" : "completed"} my health check. All clear.` });
    if (yes && changed) return render(`<div class="card"><h2>Thanks for being honest</h2>
      <p>You answered yes to ${yes} ${yes === 1 ? "question" : "questions"}. Please check with your doctor before you start training hard. Your coach can see your answers and will chat to you about what's safe in the meantime.</p>
      <button class="block" onclick="location.hash='#/home'">Continue</button></div>`);
    toast("Health check saved"); go("home");
  };
}
function clearanceBanner() {
  if (!myScreen?.flags || myScreen.cleared_at) return "";
  return `<div class="card banner"><b>Check with your doctor first</b><p class="muted" style="margin:4px 0 0">You answered yes on your health check. Take it easy until your coach confirms you're cleared to train. <a href="#/health">Review my answers</a></p></div>`;
}
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
  const [eng, { data: milestones }, { data: rewardRows }, { data: wos }, { data: phWeek }] = await Promise.all([
    loadEngagement(),
    sb.rpc("reward_milestones"),
    sb.from("exercises").select("id, name, reward_streak").not("reward_streak", "is", null).order("reward_streak"),
    sb.from("workouts").select("*").eq("client_id", me.id).is("completed_at", null).order("scheduled_date", { nullsFirst: false }).limit(3),
    me.photos_opt_in ? sb.from("progress_photos").select("id").eq("client_id", me.id).gte("taken_on", weekStart()) : Promise.resolve({ data: [] }),
  ]);
  const [food, water] = await Promise.all([tracksNut() ? foodSummary() : null, waterToday()]);
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
    ${clearanceBanner()}
    ${rewardCard}
    ${checkinCard(eng.checkins.find((c) => c.checkin_date === today() && c.energy != null))}
    <div class="card"><p class="muted" style="margin:0 0 6px">Today's challenge</p>
      <div class="challenge"><span class="q">${esc(challenge)}</span>
      ${chDone ? `<button class="small done" disabled>Done</button>` : `<button class="small" id="chDone">Done it</button>`}</div></div>
    ${waterCard(water)}
    ${food ? foodCard(food) : ""}
    ${(() => { const needW = !ws.some((m) => m.metric_date >= weekStart()); const needP = me.photos_opt_in && !(phWeek || []).length;
      return needW || needP ? `<div class="card weekly"><h3>Weekly progress</h3>
        <p class="muted" style="margin:0 0 10px">${needW ? (ws.length ? `Last weigh-in ${fmtDate(ws[ws.length - 1].metric_date)}. ` : "No weigh-ins yet. ") : ""}Log this week's so you and your coach can see the trend.</p>
        <div class="row" style="gap:8px">${needW ? `<button class="small" onclick="location.hash='#/log/weigh'">${ICON.scale} Weigh-in</button>` : ""}${needP ? `<button class="small secondary" onclick="location.hash='#/photos'">Progress photo</button>` : ""}</div></div>` : ""; })()}
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
  bindWater(water, clientHome);
  celebrateRewards(rewards);
  $("#chDone")?.addEventListener("click", async () => {
    const { error } = await sb.from("challenge_completions").insert({ client_id: me.id, challenge_date: today(), challenge });
    if (!fail(error)) { toast("Challenge done. That counts towards your streak."); clientHome(); }
  });
  celebrate(eng.earned);
}

// Build a branded 4:5 before-and-after image, with faces cropped off by default.
async function makePost(before, after, hideFaces) {
  const load = async (r) => { const { data, error } = await sb.storage.from("progress-photos").download(r.path); if (error) throw error; return createImageBitmap(data); };
  const [a, b] = await Promise.all([load(before), load(after)]);
  await document.fonts?.ready;
  const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
  g.fillStyle = "#171A18"; g.fillRect(0, 0, W, H);
  g.strokeStyle = "rgba(156,181,154,.16)"; g.lineWidth = 70; g.beginPath(); g.arc(W - 90, 150, 200, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#9CB59A"; g.beginPath(); g.arc(120, H - 120, 18, 0, Math.PI * 2); g.fill();
  const pw = 474, ph = 720, y = 250;
  const put = (img, x) => {
    const top = hideFaces ? img.height * 0.24 : 0; const sh = img.height - top, sw = img.width, ratio = pw / ph;
    let cw = sw, ch = sw / ratio; if (ch > sh) { ch = sh; cw = sh * ratio; }
    const cx = (img.width - cw) / 2, cy = hideFaces ? top : top + (sh - ch) / 2;
    g.save(); g.beginPath(); g.roundRect(x, y, pw, ph, 28); g.clip(); g.drawImage(img, cx, cy, cw, ch, x, y, pw, ph); g.restore();
  };
  put(a, 44); put(b, W - 44 - pw);
  g.fillStyle = "#EFE8DC"; g.font = "700 96px Fraunces, Georgia, serif"; g.fillText("Or", 44, 160);
  const ow = g.measureText("Or").width; g.fillStyle = "#9CB59A"; g.fillText(".", 44 + ow, 160);
  g.font = "600 30px 'Instrument Sans', system-ui, sans-serif"; g.fillStyle = "#9BA49A";
  g.fillText(`BEFORE  ${fmtDate(before.taken_on).toUpperCase()}`, 44, y + ph + 54);
  g.fillText(`AFTER  ${fmtDate(after.taken_on).toUpperCase()}`, W - 44 - pw, y + ph + 54);
  const weeks = Math.max(1, Math.round((new Date(after.taken_on) - new Date(before.taken_on)) / 6048e5));
  g.fillStyle = "#EFE8DC"; g.font = "700 76px Fraunces, Georgia, serif"; g.fillText(`${weeks} ${weeks === 1 ? "week" : "weeks"} of showing up.`, 44, y + ph + 170);
  g.font = "500 34px 'Instrument Sans', system-ui, sans-serif"; g.fillStyle = "#9BA49A";
  g.fillText((CONFIG.INSTAGRAM_URL.match(/instagram\.com\/([^/?]+)/)?.[1] ? "@" + CONFIG.INSTAGRAM_URL.match(/instagram\.com\/([^/?]+)/)[1] : CONFIG.APP_NAME), 160, H - 108);
  const blob = await new Promise((res) => c.toBlob(res, "image/png"));
  const file = new File([blob], "or-progress.png", { type: "image/png" });
  try { if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file] }); } catch { return; }
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = file.name; link.click();
}

async function photosView(clientId) {
  const own = !clientId || clientId === me.id; const cid = own ? me.id : clientId;
  const [{ data: who }, { data: rows }, { data: metrics }] = await Promise.all([
    own ? Promise.resolve({ data: me }) : sb.from("profiles").select("id, full_name, photos_opt_in, share_consent_at").eq("id", cid).single(),
    sb.from("progress_photos").select("*").eq("client_id", cid).order("taken_on"),
    sb.from("body_metrics").select("metric_date, weight_kg").eq("client_id", cid).order("metric_date"),
  ]);
  const back = own ? `<button class="back" onclick="location.hash='#/me'">Back to profile</button>` : `<button class="back" onclick="location.hash='#/client/${cid}'">Back to ${esc(who?.full_name || "client")}</button>`;
  if (own && !me.photos_opt_in) return render(`${back}<h1>Progress photos</h1><div class="card"><p>Switch on progress photos in your profile first. They're optional, and only you and your coach can see them.</p><button onclick="location.hash='#/me'">Go to profile</button></div>`);
  if (!own && !who?.photos_opt_in) return render(`${back}<h1>Progress photos</h1><div class="empty">${esc(who?.full_name || "This client")} hasn't switched on progress photos.</div>`);
  const list = rows || [];
  const paths = list.map((r) => r.path);
  const { data: signed } = paths.length ? await sb.storage.from("progress-photos").createSignedUrls(paths, 60 * 60) : { data: [] };
  const url = Object.fromEntries((signed || []).map((d) => [d.path, d.signedUrl]));
  const weightOn = (d) => { const m = (metrics || []).filter((x) => x.weight_kg && x.metric_date <= d).pop(); return m ? m.weight_kg : null; };
  const weeks = [...new Set(list.map((r) => weekStart(new Date(r.taken_on))))].sort();
  const thisWeek = list.some((r) => r.taken_on >= weekStart());
  let before = list[0], after = list[list.length - 1];
  const draw = () => {
    const cmp = list.length > 1 ? `<div class="card"><h3>Before and after</h3><div class="compare">
      ${[["Before", before], ["After", after]].map(([lab, r]) => `<figure><img src="${esc(url[r.path] || "")}" alt="${lab}: ${esc(r.angle)} photo from ${fmtDate(r.taken_on)}">
        <figcaption><b>${lab}</b> ${fmtDate(r.taken_on)}${weightOn(r.taken_on) ? `, ${weightOn(r.taken_on)} kg` : ""}</figcaption></figure>`).join("")}</div>
      ${weightOn(before.taken_on) && weightOn(after.taken_on) ? `<p class="muted" style="margin:10px 0 0">Change: <b class="${weightOn(after.taken_on) <= weightOn(before.taken_on) ? "vs up" : "vs down"}">${(weightOn(after.taken_on) - weightOn(before.taken_on)).toFixed(1)} kg</b> over ${Math.max(1, Math.round((new Date(after.taken_on) - new Date(before.taken_on)) / 6048e5))} weeks</p>` : ""}
      <p class="muted" style="margin:8px 0 0">Tap any photo below to set it as before or after.</p>
      ${own || who?.share_consent_at ? `<label class="check" style="margin-top:10px"><input type="checkbox" id="hideF" checked><span>Hide faces (crop the top of each photo)</span></label>
        <button type="button" class="secondary block" id="mkPost" style="margin-top:8px">${ICON.ig} Make an Instagram post</button>`
        : `<p class="muted" style="margin:10px 0 0">To post this on Instagram, ${esc(who.full_name.split(" ")[0])} needs to tick "OK to share" in their profile.</p>`}</div>` : "";
    $("#phMain").innerHTML = `${cmp}
      ${weeks.slice().reverse().map((wk) => `<div class="sec"><h2>Week of ${fmtDate(wk)}</h2></div><div class="ph-grid">${list.filter((r) => weekStart(new Date(r.taken_on)) === wk).map((r) =>
        `<div class="ph-item"><button type="button" class="ph-pick" data-ph="${r.id}"><img src="${esc(url[r.path] || "")}" alt="${esc(r.angle)} photo from ${fmtDate(r.taken_on)}" loading="lazy"></button>
          <div class="row between"><span class="muted">${esc(r.angle)}, ${fmtDate(r.taken_on)}</span>${own ? `<button type="button" class="small secondary" data-phdel="${r.id}" aria-label="Delete photo">${ICON.close}</button>` : ""}</div></div>`).join("")}</div>`).join("")
      || `<div class="empty">${own ? "No photos yet. Add your first one above. Same time of day, same spot and same angle each week gives the fairest comparison." : "No photos yet."}</div>`}`;
    $("#mkPost")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget; btn.disabled = true; toast("Making your post…");
      try { await makePost(before, after, $("#hideF").checked); } catch (err) { toast("Couldn't make the image. Try again."); console.error(err); }
      btn.disabled = false;
    });
    $$("[data-ph]").forEach((b) => (b.onclick = () => {
      const r = list.find((x) => x.id === b.dataset.ph);
      if (r.taken_on <= before.taken_on || r === before) before = r; else after = r;
      if (before.taken_on > after.taken_on) [before, after] = [after, before];
      draw(); window.scrollTo({ top: 0, behavior: "smooth" });
    }));
    $$("[data-phdel]").forEach((b) => (b.onclick = async () => {
      if (!confirm("Delete this photo? This can't be undone.")) return;
      const r = list.find((x) => x.id === b.dataset.phdel);
      await sb.storage.from("progress-photos").remove([r.path]);
      const { error } = await sb.from("progress_photos").delete().eq("id", r.id);
      if (!fail(error)) { toast("Photo deleted"); photosView(); }
    }));
  };
  render(`${back}<h1>${own ? "My progress photos" : `${esc(who.full_name.split(" ")[0])}'s progress photos`}</h1>
    ${own ? `<form class="card" id="phUp"><h3>${thisWeek ? "Add another photo this week" : "This week's photo"}</h3>
      <p class="muted" style="margin:0 0 6px">Optional. Only you and your coach can see these.</p>
      <div class="grid2"><div><label for="phAngle">Angle</label><select id="phAngle">${["Front", "Side", "Back"].map((a) => `<option>${a}</option>`).join("")}</select></div>
      <div><label for="phDate">Date</label><input id="phDate" type="date" value="${today()}" max="${today()}"></div></div>
      <label class="btn block" style="margin-top:12px;color:var(--on-primary)">${ICON.plus} Choose or take a photo<input type="file" id="phFile" accept="image/*" hidden></label></form>` : ""}
    <div id="phMain"></div>`);
  draw();
  $("#phFile")?.addEventListener("change", async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      toast("Uploading…");
      const blob = await shrinkImage(file);
      const path = `${me.id}/${Date.now()}.jpg`;
      const { error } = await sb.storage.from("progress-photos").upload(path, blob, { contentType: "image/jpeg" }); if (fail(error)) return;
      const { error: ie } = await sb.from("progress_photos").insert({ client_id: me.id, taken_on: $("#phDate").value || today(), angle: $("#phAngle").value, path });
      if (fail(ie)) { await sb.storage.from("progress-photos").remove([path]); return; }
      toast("Photo saved"); photosView();
    } catch (err) { toast(err.message); }
  });
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
  const groups = [...typeOrder(pool), ...new Set(pool.map((x) => x.muscle_group))];
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
    const opts = pool.filter((x) => filter === "Anything" || (filter === "Fits my kit" ? !missingEquipment(x, me.equipment).length : typesOf(x).includes(filter) || x.muscle_group === filter));
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
        ${demoHtml(pick, url)}${musclesHtml(pick)}
        <div class="target">Try: <b>${esc(presc)}</b></div>
        ${pick.cues?.length ? `<div class="cues"><b>Form cues</b><ul>${pick.cues.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>` : ""}
        ${swapHtml(swapSuggestions(pick, pool, me.equipment))}
        <button class="block" id="didIt" style="margin-top:14px">I did it</button></div>`;
      startMoves($("#result"));
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
    <p><span class="chip on">${kcalMode() ? `${r.kcal} kcal` : `${r.points} points`} a serving</span> <span class="chip">${r.minutes} min</span> <span class="chip">Serves ${r.serves}</span></p>
    <div class="card"><h3>You'll need</h3><ul style="padding-left:20px;margin:6px 0 0">${r.ingredients.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
    <div class="card"><h3>Method</h3><ol class="steps">${r.steps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div>
    ${tracksNut() && foodBudget() ? `<button class="block" id="logR">Log one serving</button>` : ""}`);
  $("#logR")?.addEventListener("click", async () => {
    const { error } = await sb.from("food_logs").insert({ client_id: me.id, log_date: today(), meal: defaultMeal(), food_name: r.name, servings: 1, points: r.points, kcal: r.kcal });
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

// ---------------------------------------------------------------- offline sets
// Gyms often have poor signal: sets logged offline wait on the phone and sync later.
const qKey = () => "or-q-" + me.id;
function readQ() { try { return JSON.parse(localStorage.getItem(qKey())) || []; } catch { return []; } }
function writeQ(q) { try { localStorage.setItem(qKey(), JSON.stringify(q)); } catch {} }
const isNetErr = (e) => !navigator.onLine || /fetch|network|load failed/i.test(e?.message || "");
async function flushQ() {
  if (!me || !navigator.onLine) return; const q = readQ(); if (!q.length) return;
  const left = [];
  for (const rec of q) { const { error } = await sb.from("set_logs").insert(rec); if (error && isNetErr(error)) left.push(rec); }
  writeQ(left);
  const n = q.length - left.length; if (n) toast(`${n} ${n === 1 ? "set" : "sets"} saved offline ${n === 1 ? "has" : "have"} synced`);
}
window.addEventListener("online", () => flushQ());

function startRest(sec, label) {
  clearInterval(restT); $("#rest")?.remove();
  const fmt = (x) => `${Math.floor(x / 60)}:${String(x % 60).padStart(2, "0")}`;
  let left = sec;
  document.body.insertAdjacentHTML("beforeend", `<div class="rest" id="rest" role="timer" aria-live="off">
    <div class="grow"><span class="muted">Rest${label ? `, then ${esc(label)}` : ""}</span><b id="restN">${fmt(left)}</b></div>
    <button class="small secondary" id="restPlus" aria-label="Add 15 seconds">+15s</button><button class="small" id="restSkip">Skip</button></div>`);
  const end = (done) => { clearInterval(restT); $("#rest")?.remove(); if (done) { try { navigator.vibrate?.([200, 100, 200]); } catch {} toast("Rest done. Next set."); } };
  $("#restPlus").onclick = () => { left += 15; $("#restN").textContent = fmt(left); };
  $("#restSkip").onclick = () => end(false);
  restT = setInterval(() => { left--; if (left <= 0) return end(true); const n = $("#restN"); if (n) n.textContent = fmt(left); }, 1000);
}
function celebratePB(name, what) {
  if ($("#cel")) return;
  document.body.insertAdjacentHTML("beforeend", `<div class="celebrate" id="cel" role="dialog" aria-label="New personal best"><div class="box">
    ${medal({ glyph: "PB" }, true, 130)}<h2>New personal best</h2><p class="muted">${esc(what)} on ${esc(name)}. That's your best yet.</p>
    <button class="block" id="celOk">Keep going</button></div></div>`);
  $("#celOk").onclick = () => $("#cel").remove();
}

// ---------------------------------------------------------------- guided workout session
// Overview first, then one exercise per screen: demo, sets, rest timer, last time, next.
const sessKey = (wid) => `or-sess-${me.id}-${wid}`;
function readSess(wid) { try { return JSON.parse(localStorage.getItem(sessKey(wid))) || null; } catch { return null; } }
function writeSess(wid, st) { try { localStorage.setItem(sessKey(wid), JSON.stringify(st)); } catch {} }
function clearSess(wid) { try { localStorage.removeItem(sessKey(wid)); } catch {} }
const sessElapsed = (st) => (st?.elapsed || 0) + (st?.runningSince ? Date.now() - st.runningSince : 0);
const clock = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`; };
const setLabel = (l) => (l.seconds && !l.reps ? `${l.seconds}s` : `${l.reps ?? "–"}`) + (l.weight_kg ? ` × ${l.weight_kg} kg` : "");

async function loadWorkout(id) {
  const [{ data: w, error }, logs] = await Promise.all([sb.from("workouts").select("*, workout_items(*, exercises(*))").eq("id", id).single(), loadLogs(me.id)]);
  if (error || !w) return null;
  const items = (w.workout_items || []).sort((a, b) => a.position - b.position).filter((it) => it.exercises);
  const order = SECTIONS.flatMap((sec) => items.filter((it) => sectionOf(it) === sec.key));
  const queued = readQ();
  const mine = [...logs.filter((l) => order.some((i) => i.id === l.workout_item_id)), ...queued.filter((q) => order.some((i) => i.id === q.workout_item_id)).map((q) => ({ ...q, id: "queued" }))];
  // earlier sessions of each exercise, newest first: [{date, sets:[...]}]
  const history = (exId) => {
    const prev = logs.filter((l) => l.workout_items?.exercise_id === exId && !order.some((i) => i.id === l.workout_item_id));
    const by = {}; prev.forEach((l) => (by[l.workout_item_id] ??= []).push(l));
    return Object.values(by).map((sets) => ({ date: sets[0].logged_at, sets: sets.sort((a, b) => a.set_number - b.set_number) })).sort((a, b) => b.date.localeCompare(a.date));
  };
  const [urls, { data: nrows }] = await Promise.all([signedMap(order.map((i) => i.exercises)),
    order.length ? sb.from("item_notes").select("workout_item_id,note").in("workout_item_id", order.map((i) => i.id)) : Promise.resolve({ data: [] })]);
  const notes = Object.fromEntries((nrows || []).map((n) => [n.workout_item_id, n.note]));
  return { w, order, logs, mine, history, urls, notes };
}

async function workoutView(id) {
  const d = await loadWorkout(id); if (!d) return render(`<div class="empty">Workout not found.</div>`);
  const { w, order, mine, history } = d;
  const st = readSess(id);
  const doneSets = mine.length, totalSets = order.reduce((s, it) => s + (it.target_sets || 3), 0);
  render(`<button class="back" onclick="location.hash='#/workouts'">Back</button>
    <h1>${esc(w.name)}</h1>
    <div class="ov-stats"><div><b>${order.length}</b><span>exercises</span></div><div><b>${totalSets}</b><span>sets</span></div><div><b>~${estMinutes(order)}</b><span>minutes</span></div></div>
    ${w.notes ? `<div class="card coach-note"><span class="muted">From your coach</span><p style="margin:4px 0 0">${esc(w.notes)}</p></div>` : ""}
    ${w.completed_at ? `<div class="card" style="text-align:center"><span class="chip good">Completed ${fmtDate(w.completed_at)}${w.duration_seconds ? ` in ${clock(w.duration_seconds * 1000)}` : ""}</span></div>` : ""}
    ${SECTIONS.map((sec) => { const its = order.filter((it) => sectionOf(it) === sec.key); return its.length ? `<div class="sec"><h2>${sec.key}</h2><span class="muted">${its.length}</span></div>
      <div class="card ov-list">${its.map((it) => { const ex = it.exercises; const mv = moveFor(ex); const n = order.indexOf(it) + 1; const last = history(ex.id)[0];
        const dn = mine.filter((l) => l.workout_item_id === it.id).length;
        return `<a class="ov-item" href="#/session/${w.id}/${n - 1}"><span class="thumb">${mv ? moveSvg(mv, { animate: false, label: false, props: (ex.equipment || []).length > 0 }) : ""}</span>
          <div class="grow"><b>${n}. ${esc(ex.name)}</b><div class="muted">${esc(targetText(it))}</div>${last ? `<div class="muted">Last time: ${last.sets.map(setLabel).join(", ")}</div>` : ""}</div>
          ${dn ? `<span class="chip ${dn >= (it.target_sets || 3) ? "good" : "on"}">${dn}/${it.target_sets || 3}</span>` : ""}</a>`; }).join("")}</div>` : ""; }).join("")
      || `<div class="empty">No exercises yet.</div>`}
    ${order.length && !w.completed_at ? `<div class="ov-go">${st || doneSets ? `<button class="block" onclick="location.hash='#/session/${w.id}'">Resume workout${st ? ` (exercise ${(st.idx || 0) + 1} of ${order.length}, ${clock(sessElapsed(st))} in)` : ""}</button>`
      : `<button class="block" onclick="location.hash='#/session/${w.id}'">Start workout</button>`}</div>` : ""}`);
  startMoves($("#view"));
}

// Countdown used for rest and timed sets. Beeps, vibrates and flashes when it ends.
let timerT = null;
function beep() {
  try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); [0, 0.25, 0.5].forEach((t) => { const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = t === 0.5 ? 1046 : 784; o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.18); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2); }); } catch {}
  try { navigator.vibrate?.([200, 100, 200, 100, 300]); } catch {}
}
function runTimer(box, { secs, kind = "Rest", next = "", onEnd }) {
  clearInterval(timerT); let left = secs, total = secs, paused = false;
  const R = 34, C = 2 * Math.PI * R;
  box.innerHTML = `<div class="timer ${kind === "Rest" ? "rest-t" : "work-t"}" role="timer">
    <svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="${R}" class="t-bg"/><circle cx="40" cy="40" r="${R}" class="t-fg" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="0"/></svg>
    <div class="t-main"><span class="muted">${kind}${next ? `, then ${esc(next)}` : ""}</span><b class="t-n" aria-live="off">${clock(left * 1000)}</b></div>
    <div class="t-btns"><button type="button" class="small secondary" data-t="pause">Pause</button><button type="button" class="small secondary" data-t="plus">+15s</button><button type="button" class="small" data-t="skip">Skip</button></div></div>`;
  const n = box.querySelector(".t-n"), fg = box.querySelector(".t-fg"), pb = box.querySelector("[data-t=pause]");
  const paint = () => { n.textContent = clock(left * 1000); fg.setAttribute("stroke-dashoffset", (C * (1 - left / total)).toFixed(1)); };
  const end = (finished) => {
    clearInterval(timerT);
    if (finished) { beep(); box.innerHTML = `<div class="timer done-t"><b>${kind === "Rest" ? "Rest done." : "Time."}</b> <span>${next ? `Next: ${esc(next)}` : "Well done."}</span></div>`; setTimeout(() => { if (box.querySelector(".done-t")) box.innerHTML = ""; }, 5000); }
    else box.innerHTML = "";
    onEnd?.(finished);
  };
  pb.onclick = () => { paused = !paused; pb.textContent = paused ? "Resume" : "Pause"; box.querySelector(".timer").classList.toggle("paused", paused); };
  box.querySelector("[data-t=plus]").onclick = () => { left += 15; total += 15; paint(); };
  box.querySelector("[data-t=skip]").onclick = () => end(false);
  paint();
  timerT = setInterval(() => { if (paused) return; left--; if (left <= 0) { left = 0; paint(); end(true); } else paint(); }, 1000);
  return { pause: () => { paused = true; pb.textContent = "Resume"; } };
}

async function sessionView(id, startAt) {
  const d = await loadWorkout(id); if (!d) return render(`<div class="empty">Workout not found.</div>`);
  const { w, order, logs, history } = d; let mine = d.mine; const notes = d.notes || {};
  if (!order.length) return go("workout/" + id);
  if (w.completed_at) return go("workout/" + id);
  const { data: lib } = await sb.from("exercises").select("id,name,muscle_group,equipment");
  let st = readSess(id) || { idx: 0, elapsed: 0, runningSince: Date.now(), startedAt: new Date().toISOString() };
  if (startAt != null && startAt !== "") st.idx = Math.min(order.length - 1, Math.max(0, +startAt));
  if (!st.runningSince && !st.paused) st.runningSince = Date.now();
  const save = () => writeSess(id, st);
  save(); activeSess = { id, get st() { return st; } };
  $("#tabbar").hidden = true;
  const bestBefore = {}; // per exercise: best weight and best reps before today, to spot improvements
  order.forEach((it) => { const h = history(it.exercises.id).flatMap((s) => s.sets); bestBefore[it.exercises.id] = { w: Math.max(0, ...h.map((l) => l.weight_kg || 0)), r: Math.max(0, ...h.map((l) => l.reps || 0)), any: h.length > 0 }; });

  const draw = () => {
    const it = order[st.idx]; const ex = it.exercises; const timed = !!it.target_seconds && !it.target_reps;
    const done = mine.filter((l) => l.workout_item_id === it.id);
    const nSets = Math.max(it.target_sets || 3, done.length);
    const hist = history(ex.id); const last = hist[0];
    const totalDone = mine.length, totalSets = order.reduce((s, x) => s + Math.max(x.target_sets || 3, mine.filter((l) => l.workout_item_id === x.id).length), 0);
    const lastSets = last?.sets || [];
    const topW = Math.max(0, ...lastSets.map((l) => l.weight_kg || 0)); const lastTarget = it.target_reps;
    const ready = !timed && lastTarget && topW > 0 && lastSets.length >= Math.min(3, it.target_sets || 3) && lastSets.every((l) => (l.reps || 0) >= lastTarget) && !(it.target_weight_kg > topW);
    const nextIt = order[st.idx + 1];
    const rows = Array.from({ length: nSets }, (_, i) => {
      const dl = done.find((l) => l.set_number === i + 1); const prev = lastSets[i];
      const kg = dl?.weight_kg ?? it.target_weight_kg ?? prev?.weight_kg ?? "";
      const reps = timed ? dl?.seconds ?? it.target_seconds ?? "" : dl?.reps ?? it.target_reps ?? prev?.reps ?? "";
      return `<div class="srow ${dl ? "done" : ""} ${dl?.id === "queued" ? "queued" : ""}" data-set="${i + 1}" data-log="${dl?.id || ""}">
        <span class="sn">${i + 1}</span>
        <span class="sprev">${prev ? setLabel(prev) : "–"}</span>
        <input type="number" inputmode="decimal" step="0.5" min="0" data-f="weight_kg" value="${kg}" aria-label="Set ${i + 1} kilograms" placeholder="kg">
        <input type="number" inputmode="numeric" min="0" data-f="${timed ? "seconds" : "reps"}" value="${reps}" aria-label="Set ${i + 1} ${timed ? "seconds" : "reps"}" placeholder="${timed ? "sec" : "reps"}">
        ${timed && !dl ? `<button type="button" class="small secondary" data-work="${i + 1}" aria-label="Start ${it.target_seconds} second timer">${it.target_seconds || 30}s</button>` : ""}
        <button type="button" class="sdone" data-done="${i + 1}" aria-pressed="${!!dl}" aria-label="${dl ? "Set done" : "Mark set done"}">${ICON.check}</button></div>`;
    }).join("");
    render(`<div class="sess">
      <div class="sess-top">
        <button type="button" class="small secondary" id="sPause" aria-label="Pause workout">Pause</button>
        <button type="button" class="sess-prog" id="sList" aria-label="Show all exercises"><b>Exercise ${st.idx + 1} of ${order.length}</b><span>${totalDone}/${totalSets} sets</span></button>
        <span class="sess-clock" id="sClock">${clock(sessElapsed(st))}</span></div>
      <div class="progress" style="margin:8px 0 12px"><div style="width:${Math.round((totalDone / Math.max(1, totalSets)) * 100)}%"></div></div>
      <span class="chip">${esc(sectionOf(it))}</span>
      <h1 style="margin-top:6px">${esc(ex.name)}</h1>
      <p class="muted" style="margin:-2px 0 8px">${esc([...new Set([catOf(ex), ex.muscle_group].filter(Boolean))].join(", "))}${(ex.equipment || []).length ? `. ${(ex.equipment || []).map(esc).join(", ")}` : ""}</p>
      <div class="sess-demo" id="demo">${demoHtml(ex, d.urls?.[ex.video_path]) || `<div class="empty">No demo yet. Ask your coach for a video.</div>`}</div>
      <div class="row" style="gap:8px">${d.urls?.[ex.video_path] || ex.video_url ? `<button type="button" class="small ghost" id="replay">Replay video</button>` : ""}
        ${ex.instructions || ex.cues?.length || ex.easier || ex.harder || ex.modifications ? `<button type="button" class="small ghost" id="howBtn">Instructions</button>` : ""}</div>
      ${musclesHtml(ex)}
      <div class="sess-target"><b>${esc(targetText(it))}</b>${it.notes ? `<div class="coach-note-inline">${esc(it.notes)}</div>` : ""}</div>
      ${ready ? `<div class="nudge">${ICON.up} You hit every rep at ${topW} kg last time. If your form felt solid, try ${topW + (topW < 10 ? 1 : 2)} kg today.</div>` : ""}
      <div id="timer"></div>
      <div class="card sets"><div class="srow head"><span>Set</span><span>Last time</span><span>kg</span><span>${timed ? "Secs" : "Reps"}</span><span></span></div>${rows}
        <button type="button" class="small ghost" id="addSet" style="margin-top:8px">+ Add a set</button></div>
      <div class="card inote"><label for="iNote" style="margin-top:0">Note for your coach about this exercise</label>
        <textarea id="iNote" maxlength="1000" placeholder="Optional, e.g. felt it in my lower back on set 3, or the weight was too light">${esc(notes[it.id] || "")}</textarea>
        <p class="muted" id="iNoteSt" style="margin:4px 0 0">${notes[it.id] ? "Saved. Your coach can see it." : "Saves automatically. Your coach sees it with this workout."}</p></div>
      ${ex.instructions || ex.cues?.length || ex.easier || ex.harder || ex.modifications ? `<details class="card how" id="how" ${hist.length ? "" : "open"}><summary>How to do it</summary>${ex.instructions ? `<p>${esc(ex.instructions)}</p>` : ""}
        ${ex.cues?.length ? `<ul class="tips">${ex.cues.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}${variationsHtml(ex, lib)}</details>` : ""}
      ${hist.length ? `<details class="card"><summary>Your history (${hist.length} ${hist.length === 1 ? "session" : "sessions"})</summary>
        ${hist.slice(0, 8).map((h) => `<div class="hist"><span class="muted">${fmtDate(h.date)}</span><span>${h.sets.map(setLabel).join(", ")}</span></div>`).join("")}</details>` : ""}
      ${swapHtml(swapSuggestions(ex, lib || [], me.equipment))}
      <div class="sess-nav"><button type="button" class="secondary" id="sPrev" ${st.idx ? "" : "disabled"}>Previous</button>
        <button type="button" id="sNext">${nextIt ? "Next exercise" : "Finish workout"}</button></div></div>`);
    $("#topbar").hidden = false; $("#tabbar").hidden = true;
    startMoves($("#demo"));
    if (done.length >= (it.target_sets || 3)) $("#sNext").classList.add("pulse");
    bind(it, nextIt, timed);
  };

  const ticker = setInterval(() => { const c = $("#sClock"); if (!c) return clearInterval(ticker); c.textContent = clock(sessElapsed(st)); }, 1000);
  let flushNote = async () => {};
  const goTo = async (i) => { await flushNote(); clearInterval(timerT); st.idx = i; save(); draw(); window.scrollTo(0, 0); };

  const saveSet = async (row, it) => {
    const vals = Object.fromEntries($$("input", row).map((i) => [i.dataset.f, num(i.value)]));
    const rec = { workout_item_id: it.id, client_id: me.id, set_number: Number(row.dataset.set), ...vals, logged_at: new Date().toISOString() };
    if (row.dataset.log === "queued") return toast("Saved on your phone. It'll sync when you're back online.");
    const fresh = !row.dataset.log;
    const queue = () => { writeQ([...readQ(), rec]); mine.push({ ...rec, id: "queued" }); row.dataset.log = "queued"; row.classList.add("done", "queued"); toast("No signal. Saved on your phone; it'll sync later."); return true; };
    if (fresh && !navigator.onLine) return queue();
    const { data, error } = fresh ? await sb.from("set_logs").insert(rec).select().single() : await sb.from("set_logs").update(vals).eq("id", row.dataset.log).select().single();
    if (error && fresh && isNetErr(error)) return queue();
    if (fail(error)) return false;
    if (fresh) mine.push({ ...data, workout_items: { exercise_id: it.exercises.id } }); else Object.assign(mine.find((l) => l.id === data.id) || {}, vals);
    row.dataset.log = data.id; row.classList.add("done");
    // personal best?
    const b = bestBefore[it.exercises.id];
    if (fresh && b.any && (vals.weight_kg ? vals.weight_kg > b.w : vals.reps && !b.w && vals.reps > b.r)) {
      celebratePB(it.exercises.name, vals.weight_kg ? `${vals.weight_kg} kg` : `${vals.reps} reps`);
      if (vals.weight_kg) b.w = vals.weight_kg; else b.r = vals.reps;
    }
    return true;
  };

  const bind = (it, nextIt, timed) => {
    const startRestFor = (setNo) => {
      const rows = $$(".srow[data-set]"); const moreSets = rows.some((r) => !r.classList.contains("done"));
      const rest = it.rest_seconds || (sectionOf(it) === "Main set" ? 60 : 20);
      if (!moreSets && !nextIt) return;
      runTimer($("#timer"), { secs: rest, kind: "Rest", next: moreSets ? `set ${setNo + 1}` : nextIt.exercises.name });
      $("#timer").scrollIntoView({ block: "nearest", behavior: "smooth" });
    };
    $$("[data-done]").forEach((b) => (b.onclick = async () => {
      const row = b.closest(".srow"); const wasDone = row.classList.contains("done");
      b.disabled = true; const ok = await saveSet(row, it); b.disabled = false; if (!ok) return;
      b.setAttribute("aria-pressed", "true");
      if (!wasDone) { const all = $$(".srow[data-set]").every((r) => r.classList.contains("done")); toast(all ? "All sets done. Great work." : `Set ${row.dataset.set} saved`); startRestFor(+row.dataset.set);
        if (all) $("#sNext").classList.add("pulse"); }
      else toast("Updated");
    }));
    // edits to a finished set save automatically
    $$(".srow[data-set] input").forEach((inp) => (inp.onchange = () => { const row = inp.closest(".srow"); if (row.classList.contains("done")) saveSet(row, it).then((ok) => ok && toast("Saved")); }));
    $$("[data-work]").forEach((b) => (b.onclick = () => {
      const row = b.closest(".srow");
      runTimer($("#timer"), { secs: it.target_seconds || 30, kind: "Work", next: "rest", onEnd: async (finished) => {
        if (!finished) return;
        const ok = await saveSet(row, it); if (ok) { row.querySelector("[data-done]").setAttribute("aria-pressed", "true"); b.remove(); setTimeout(() => startRestFor(+row.dataset.set), 1200); }
      } });
    }));
    let nT = null; const nBox = $("#iNote");
    const saveNote = async () => {
      clearTimeout(nT); const v = nBox.value.trim(); if (v === (notes[it.id] || "")) return;
      const stEl = $("#iNoteSt"); if (stEl) stEl.textContent = "Saving…";
      const { error } = v ? await sb.from("item_notes").upsert({ workout_item_id: it.id, client_id: me.id, note: v, updated_at: new Date().toISOString() }, { onConflict: "workout_item_id" })
        : await sb.from("item_notes").delete().eq("workout_item_id", it.id);
      if (error) { if (stEl) stEl.textContent = navigator.onLine ? "Couldn't save the note. Try again." : "You're offline. The note will save when you type again with signal."; return; }
      if (v) notes[it.id] = v; else delete notes[it.id];
      if ($("#iNoteSt")) $("#iNoteSt").textContent = v ? "Saved. Your coach can see it." : "Note removed.";
    };
    nBox.oninput = () => { clearTimeout(nT); nT = setTimeout(saveNote, 1200); };
    nBox.onblur = saveNote; flushNote = saveNote;
    $("#addSet").onclick = () => {
      const rows = $$(".srow[data-set]"); const last = rows[rows.length - 1]; const c = last.cloneNode(true); const n = rows.length + 1;
      c.dataset.set = n; c.dataset.log = ""; c.classList.remove("done", "queued"); c.querySelector(".sn").textContent = n; c.querySelector(".sprev").textContent = "–";
      c.querySelector("[data-done]").setAttribute("aria-pressed", "false"); c.querySelector("[data-done]").dataset.done = n; c.querySelector("[data-work]")?.remove();
      last.after(c); bind(it, nextIt, timed);
    };
    $("#howBtn")?.addEventListener("click", () => { const h = $("#how"); h.open = true; h.scrollIntoView({ block: "start", behavior: "smooth" }); });
    if ($("#replay")) $("#replay").onclick = () => {
      const v = $("#demo video"); if (v) { v.currentTime = 0; v.play?.(); return; }
      const f = $("#demo iframe"); if (f) { f.src = f.src; return; }
      $("#demo").innerHTML = demoHtml(it.exercises, null); startMoves($("#demo"));
    };
    $("#sPrev").onclick = () => st.idx > 0 && goTo(st.idx - 1);
    $("#sNext").onclick = () => (nextIt ? goTo(st.idx + 1) : finish());
    $("#sList").onclick = () => {
      document.body.insertAdjacentHTML("beforeend", `<div class="picker" id="slist" role="dialog" aria-label="Exercises in this workout"><div class="picker-box">
        <div class="row between"><h2 style="margin:0">${esc(w.name)}</h2><button type="button" class="small" id="slX">Close</button></div>
        ${order.map((x, i) => { const dn = mine.filter((l) => l.workout_item_id === x.id).length; return `<button type="button" class="list-item sl-item ${i === st.idx ? "cur" : ""}" data-go="${i}">
          <div class="grow"><b>${i + 1}. ${esc(x.exercises.name)}</b><div class="muted">${esc(sectionOf(x))}, ${esc(targetText(x))}</div></div><span class="chip ${dn >= (x.target_sets || 3) ? "good" : ""}">${dn}/${x.target_sets || 3}</span></button>`; }).join("")}</div></div>`);
      $("#slX").onclick = () => $("#slist").remove(); $("#slist").addEventListener("click", (e) => { if (e.target.id === "slist") $("#slist").remove(); });
      $$("[data-go]").forEach((b) => (b.onclick = () => { $("#slist").remove(); goTo(+b.dataset.go); }));
    };
    $("#sPause").onclick = () => {
      st.elapsed = sessElapsed(st); st.runningSince = null; st.paused = true; save(); clearInterval(timerT);
      document.body.insertAdjacentHTML("beforeend", `<div class="celebrate" id="pz" role="dialog" aria-label="Workout paused"><div class="box">
        <h2>Workout paused</h2><p class="muted">${clock(st.elapsed)} so far. Your sets are saved. Pick up where you left off any time today or later.</p>
        <button class="block" id="pzGo">Resume</button><button class="block secondary" id="pzOut" style="margin-top:8px">Save and leave</button></div></div>`);
      $("#pzGo").onclick = () => { $("#pz").remove(); st.paused = false; st.runningSince = Date.now(); save(); };
      $("#pzOut").onclick = () => { $("#pz").remove(); go("workout/" + id); };
    };
  };

  const finish = async () => {
    await flushNote();
    const totalSets = order.reduce((s, x) => s + (x.target_sets || 3), 0);
    if (mine.length < totalSets && !confirm(`You've done ${mine.length} of ${totalSets} sets. Finish the workout anyway?`)) return;
    clearInterval(timerT); clearInterval(ticker);
    st.elapsed = sessElapsed(st); st.runningSince = null; save();
    const secs = Math.round(st.elapsed / 1000);
    const exDone = order.filter((x) => mine.some((l) => l.workout_item_id === x.id)).length;
    const volume = Math.round(mine.reduce((s, l) => s + (l.weight_kg || 0) * (l.reps || 0), 0));
    const wins = order.flatMap((x) => {
      const today = mine.filter((l) => l.workout_item_id === x.id); if (!today.length) return [];
      const h = history(x.exercises.id)[0]; if (!h) return [];
      const tw = Math.max(0, ...today.map((l) => l.weight_kg || 0)), pw = Math.max(0, ...h.sets.map((l) => l.weight_kg || 0));
      const tr = today.reduce((s, l) => s + (l.reps || 0), 0), pr = h.sets.reduce((s, l) => s + (l.reps || 0), 0);
      if (tw > pw && pw) return [`${x.exercises.name}: ${tw} kg, up from ${pw} kg`];
      if (tw === pw && tr > pr) return [`${x.exercises.name}: ${tr - pr} more ${tr - pr === 1 ? "rep" : "reps"} than last time`];
      return [];
    });
    const DIFF = ["Very easy", "Easy", "Just right", "Hard", "Very hard"];
    render(`<div class="sess sum"><div class="sum-head">${medal({ glyph: "✓" }, true, 110)}<h1>Workout complete</h1><p class="muted">${esc(w.name)}</p></div>
      <div class="ov-stats"><div><b>${clock(secs * 1000)}</b><span>duration</span></div><div><b>${exDone}/${order.length}</b><span>exercises</span></div><div><b>${mine.length}</b><span>sets</span></div></div>
      ${volume ? `<p class="muted" style="text-align:center">${volume.toLocaleString("en-ZA")} kg lifted in total</p>` : ""}
      <div class="card"><h3>${wins.length ? "Improvements" : "Progress"}</h3>${wins.length ? `<ul class="tips">${wins.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="muted" style="margin:0">Matching last time still counts. Consistency is what builds results.</p>`}</div>
      ${order.some((x) => notes[x.id]) ? `<div class="card"><h3>Your exercise notes</h3>${order.filter((x) => notes[x.id]).map((x) => `<p class="fb-note"><b>${esc(x.exercises.name)}:</b> ${esc(notes[x.id])}</p>`).join("")}<p class="muted" style="margin:0">Your coach will see these.</p></div>` : ""}
      <form class="card" id="fb"><h3>How hard was it?</h3><div class="diff">${DIFF.map((l, i) => `<label><input type="radio" name="d" value="${i + 1}" ${i === 2 ? "checked" : ""}><span>${l}</span></label>`).join("")}</div>
        <label for="fbT">Anything for your coach?</label><textarea id="fbT" name="t" maxlength="1000" placeholder="Optional, e.g. squats felt easy, left knee a bit sore"></textarea>
        <button class="block" style="margin-top:12px">Save workout</button></form></div>`);
    $("#topbar").hidden = false;
    $("#fb").onsubmit = async (e) => {
      e.preventDefault(); const f = e.target; const btn = f.querySelector("button"); btn.disabled = true;
      if (!navigator.onLine) { btn.disabled = false; return toast("You're offline. Your sets are saved on your phone. Tap Save again when you have signal."); }
      await flushQ();
      const difficulty = +f.d.value, feedback = f.t.value.trim() || null;
      const exNotes = order.filter((x) => notes[x.id]).map((x) => `${x.exercises.name}: ${notes[x.id]}`);
      const { error } = await sb.from("workouts").update({ completed_at: new Date().toISOString(), duration_seconds: secs, difficulty, client_feedback: feedback }).eq("id", w.id);
      if (fail(error)) { btn.disabled = false; return; }
      clearSess(id);
      if (me.trainer_id && me.trainer_id !== me.id) await sb.from("messages").insert({ client_id: me.id, sender_id: me.id,
        body: `Finished "${w.name}" in ${clock(secs * 1000)}: ${mine.length} sets, felt ${DIFF[difficulty - 1].toLowerCase()}.${wins.length ? ` ${wins.join("; ")}.` : ""}${feedback ? ` Note: ${feedback}` : ""}${exNotes.length ? ` Exercise notes: ${exNotes.join("; ")}.` : ""}` });
      toast("Workout saved. Your coach can see how it went."); go("home");
    };
  };
  draw();
}

// ---------------------------------------------------------------- client exercise library
async function signedMap(rows) {
  const paths = rows.map((r) => r.video_path).filter(Boolean);
  if (!paths.length) return {};
  const { data } = await sb.storage.from("exercise-videos").createSignedUrls(paths, 60 * 60 * 6);
  return Object.fromEntries((data || []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
}
// Video links: the coach pastes a YouTube or Vimeo link; anything else opens as a link.
function cleanUrl(v) { try { const u = new URL(String(v || "").trim()); return u.protocol === "https:" ? u.href : null; } catch { return null; } }
function ytId(url) { return String(url || "").match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/)?.[1] || null; }
function vimeoId(url) { return String(url || "").match(/vimeo\.com\/(?:video\/)?(\d{6,})/)?.[1] || null; }
function linkHtml(link, title = "Demo video") {
  const yt = ytId(link), vm = vimeoId(link);
  if (yt) return `<div class="vid"><iframe src="https://www.youtube-nocookie.com/embed/${yt}?rel=0&playsinline=1" title="${esc(title)}" loading="lazy"
    allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
  if (vm) return `<div class="vid"><iframe src="https://player.vimeo.com/video/${vm}" title="${esc(title)}" loading="lazy" allow="fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
  const safe = cleanUrl(link);
  return safe ? `<a class="btn secondary block" href="${esc(safe)}" target="_blank" rel="noopener">${ICON.library} Watch the demo video</a>` : "";
}
const ytThumb = (x) => (ytId(x.video_url) ? `https://i.ytimg.com/vi/${ytId(x.video_url)}/hqdefault.jpg` : null);
// Order: her own uploaded video, then her video link, then the animation.
function demoHtml(ex, url, opts = {}) {
  if (url) return `<video src="${esc(url)}" controls playsinline preload="metadata" loop muted></video>`;
  if (ex.video_url) return linkHtml(ex.video_url, `${ex.name} demo`);
  const mv = moveFor(ex);
  return mv ? moveSvg(mv, { props: (ex.equipment || []).length > 0, big: true, model: ex.model || "female", muscles: ex.muscles?.length ? musclesFor(ex, mv) : null, ...opts }) : "";
}
// Options list of library exercises for "easier / harder" links.
function exOptions(lib, selected, selfId) {
  return `<option value="">None</option>${sortBy((lib || []).filter((x) => x.id !== selfId), "name").map((x) => `<option value="${x.id}" ${x.id === selected ? "selected" : ""}>${esc(x.name)}</option>`).join("")}`;
}
// Easier / harder / modifications block for clients.
function variationsHtml(ex, lib = [], linkBase = "") {
  const nm = (eid) => (lib || []).find((x) => x.id === eid)?.name;
  const line = (label, eid, note) => { const n = eid && nm(eid); if (!n && !note) return "";
    return `<li><b>${label}:</b> ${n ? (linkBase ? `<a href="${linkBase}${eid}">${esc(n)}</a>` : esc(n)) : ""}${n && note ? ". " : ""}${note ? esc(note) : ""}</li>`; };
  const items = line("Easier", ex.easier_id, ex.easier) + line("Harder", ex.harder_id, ex.harder) + (ex.modifications ? `<li><b>Modifications:</b> ${esc(ex.modifications)}</li>` : "");
  return items ? `<div class="vars"><b>Make it work for you</b><ul class="tips">${items}</ul></div>` : "";
}
// Body map of the muscles this exercise works (coach's own picks first, then the animation's, then the muscle group).
function musclesHtml(ex, opts = {}) { const m = musclesFor(ex, moveFor(ex)); return m[0].length ? muscleMapSvg(m, opts) : ""; }
function tileHtml(x, urls, href) {
  const u = urls[x.video_path];
  return `<a class="tile" href="${href}">${u ? `<video src="${esc(u)}#t=0.8" muted playsinline preload="metadata"></video>` : ytThumb(x) && !moveFor(x) ? `<img class="ph" src="${esc(ytThumb(x))}" alt="" loading="lazy">` : `<span class="ph" aria-hidden="true">${moveFor(x) ? moveSvg(moveFor(x), { animate: false, label: false, props: (x.equipment || []).length > 0 }) : forms(seedOf(x.name), { w: 200, h: 250, scale: 0.55 })}</span>`}
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
  const types = typeOrder(all);
  const muscles = MUSCLES.filter((m) => all.some((x) => x.muscle_group === m));
  render(`<h1>Library</h1><p class="muted">Demos and form cues from your coach, for extra sessions or a refresher.</p>
    ${bonusHtml}
    ${types.map((t) => { const items = all.filter((x) => typesOf(x).includes(t)); return `<div class="sec"><h2>${esc(t)}</h2><a href="#" data-jump="${esc(t)}">See all ${items.length}</a></div>
      <div class="shelf">${items.map((x) => tileHtml(x, urls, `#/ex/${x.id}`)).join("")}</div>`; }).join("")}
    <div class="sec" id="allSec"><h2>All exercises</h2></div>
    <input id="q" placeholder="Search exercises" style="margin-bottom:10px" aria-label="Search exercises">
    <div class="chips" id="mg">${["All", "Fits my kit", ...types, ...muscles].map((m, i) => `<a href="#" class="${i ? "" : "pass"}" data-m="${esc(m)}">${esc(m)}</a>`).join("")}</div>
    <div class="tiles" id="list"></div>`);
  let mg = "All";
  const match = (x) => mg === "All" || (mg === "Fits my kit" ? !missingEquipment(x, me.equipment).length : typesOf(x).includes(mg) || x.muscle_group === mg);
  const draw = () => {
    const q = $("#q").value.toLowerCase();
    const rows = all.filter((x) => match(x) && x.name.toLowerCase().includes(q));
    $("#list").innerHTML = rows.map((x) => tileHtml(x, urls, `#/ex/${x.id}`)).join("")
      || `<div class="empty" style="grid-column:1/-1">${all.length ? "No exercises match. Try another filter." : "Your coach hasn't added exercises yet."}</div>`;
  };
  $("#q").oninput = draw;
  $$("#mg a").forEach((c) => (c.onclick = (e) => { e.preventDefault(); $$("#mg a").forEach((x) => x.classList.remove("pass")); c.classList.add("pass"); mg = c.dataset.m; draw(); }));
  $$("[data-jump]").forEach((a) => (a.onclick = (e) => {
    e.preventDefault(); const chip = $$("#mg a").find((c) => c.dataset.m === a.dataset.jump); chip?.click();
    $("#allSec").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }));
  draw();
}

async function clientExercise(id) {
  const [{ data: ex }, { data: lib }] = await Promise.all([
    sb.from("exercises").select("*").eq("id", id).single(), sb.from("exercises").select("id,name,muscle_group,equipment")]);
  if (!ex) return render(`<div class="empty">Exercise not found.</div>`);
  const linked = [ex.easier_id, ex.harder_id].filter(Boolean);
  const { data: varLib } = linked.length ? await sb.from("exercises").select("id,name").in("id", linked) : { data: [] };
  const url = await videoUrl(ex.video_path);
  render(`<button class="back" onclick="history.back()">← Library</button>
    <div class="card ex-card"><div class="row between"><h1>${esc(ex.name)}</h1><span class="chip">${esc(ex.muscle_group)}</span></div>
      ${demoHtml(ex, url) || `<div class="empty">No demo yet.</div>`}${musclesHtml(ex)}
      <p class="muted">Equipment: ${(ex.equipment || []).map(esc).join(", ") || "Bodyweight"}</p>
      ${ex.cues?.length ? `<div class="cues"><b>Form cues</b><ul>${ex.cues.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>` : ""}
      ${variationsHtml(ex, varLib, "#/exercise/")}
      ${swapHtml(swapSuggestions(ex, lib || [], me.equipment))}
      ${ex.instructions ? `<h3 style="margin-top:14px">How to</h3><p>${esc(ex.instructions)}</p>` : ""}</div>`);
}

// ================================================================ FOOD (points or calories, the client chooses)
const kcalMode = () => me?.nutrition_mode === "calories";
const foodUnit = () => (kcalMode() ? "kcal" : "pts");
const foodVal = (r) => (kcalMode() ? Number(r.kcal ?? Number(r.points) * 50) : Number(r.points));
const foodBudget = () => (kcalMode() ? me.daily_kcal : me.daily_points) || 0;
async function foodSummary(date = today()) {
  const ws = weekStart(new Date(date));
  const { data } = await sb.from("food_logs").select("*").eq("client_id", me.id).gte("log_date", ws).order("created_at");
  const rows = data || []; const budget = foodBudget();
  const dayRows = rows.filter((r) => r.log_date === date);
  const used = Math.round(dayRows.reduce((s, r) => s + foodVal(r), 0));
  const byDay = {}; rows.forEach((r) => (byDay[r.log_date] = (byDay[r.log_date] || 0) + Number(r.points)));
  const over = Object.entries(byDay).filter(([d]) => d <= date).reduce((s, [, v]) => s + Math.max(0, v - (me.daily_points || 0)), 0);
  return { date, budget, used, left: budget - used, buffer: kcalMode() ? null : Math.max(0, WEEKLY_BUFFER - over), dayRows };
}
function foodCard(f) {
  if (!f.budget) return `<div class="card"><h3>Nutrition</h3><p class="muted">Choose points or calories to start tracking food.</p><button onclick="location.hash='#/food'">Set up</button></div>`;
  const pct = Math.min(100, Math.round((f.used / f.budget) * 100));
  const k = kcalMode();
  return `<a class="card" href="#/food" style="display:block;color:inherit;text-decoration:none">
    <div class="row between"><h3>${k ? "Calories today" : "Points today"}</h3>${f.buffer != null ? `<span class="muted">Weekly buffer ${f.buffer}</span>` : ""}</div>
    <div class="row" style="align-items:baseline;gap:6px"><span class="stat">${f.left < 0 ? 0 : f.left}</span><span class="muted">of ${f.budget}${k ? " kcal" : ""} left${f.left < 0 ? (k ? `, ${-f.left} kcal over` : `, ${-f.left} from weekly buffer`) : ""}</span></div>
    <div class="progress" style="margin-top:10px"><div style="width:${pct}%"></div></div></a>`;
}

// ---------------------------------------------------------------- water
async function waterToday() {
  const [{ data: w }, { data: acts }, { data: sets }, { data: m }] = await Promise.all([
    sb.from("water_logs").select("ml").eq("client_id", me.id).eq("log_date", today()),
    sb.from("activities").select("minutes").eq("client_id", me.id).eq("activity_date", today()),
    sb.from("set_logs").select("id").eq("client_id", me.id).gte("logged_at", today()).limit(1),
    sb.from("body_metrics").select("weight_kg").eq("client_id", me.id).not("weight_kg", "is", null).order("metric_date", { ascending: false }).limit(1),
  ]);
  const minutes = (acts || []).reduce((s, a) => s + (a.minutes || 0), 0) + ((sets || []).length ? 45 : 0);
  const weight = m?.[0]?.weight_kg || null;
  const auto = !me.water_goal_ml;
  return { ml: w?.[0]?.ml || 0, goal: me.water_goal_ml || waterGoal({ weight, trainingMinutes: minutes }), auto, weight, minutes };
}
const litres = (ml) => `${(ml / 1000).toFixed(2).replace(/0$/, "").replace(/\.0$/, "")} L`;
function waterAdvice(x) {
  const h = new Date().getHours(); const pct = x.ml / x.goal;
  if (pct >= 1) return "Goal reached. Keep sipping if it's hot or you train again today.";
  if (h >= 12 && pct < (h - 7) / 14 - 0.15) return `You're a little behind for this time of day. Have a glass now and another with your next meal.`;
  if (x.minutes) return "You trained today, so your goal includes extra water. Sip through the afternoon.";
  return pickForDate(WATER_TIPS, today());
}
function waterCard(x) {
  const pct = Math.min(100, Math.round((x.ml / x.goal) * 100));
  const glasses = Math.floor(x.ml / GLASS_ML), need = Math.min(20, Math.ceil(x.goal / GLASS_ML));
  return `<div class="card water" id="water"><div class="row between"><h3>Water</h3><a href="#/water">Details</a></div>
    <div class="row" style="align-items:baseline;gap:6px"><span class="stat">${litres(x.ml)}</span><span class="muted">of ${litres(x.goal)}${x.auto ? ", recommended for you" : ""}</span></div>
    <div class="glasses" aria-label="${glasses} of ${need} glasses">${Array.from({ length: need }, (_, i) => `<span class="${i < glasses ? "on" : ""}"></span>`).join("")}</div>
    <p class="muted" style="margin:8px 0 10px">${esc(waterAdvice(x))}</p>
    <div class="row" style="gap:8px;flex-wrap:wrap"><button class="small" data-water="250">+ Glass 250 ml</button><button class="small secondary" data-water="500">+ Bottle 500 ml</button>
      ${x.ml ? `<button class="small ghost" data-water="-250" aria-label="Remove 250 ml">Undo</button>` : ""}</div></div>`;
}
function bindWater(x, after) {
  $$("[data-water]").forEach((b) => (b.onclick = async () => {
    const ml = Math.max(0, x.ml + Number(b.dataset.water));
    b.disabled = true;
    const { error } = await sb.from("water_logs").upsert({ client_id: me.id, log_date: today(), ml, updated_at: new Date().toISOString() }, { onConflict: "client_id,log_date" });
    if (fail(error)) { b.disabled = false; return; }
    if (x.ml < x.goal && ml >= x.goal) toast("Water goal reached. Well done.");
    after();
  }));
}
function waterWeekHtml(rows, goal) {
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); });
  const by = Object.fromEntries((rows || []).map((r) => [r.log_date, r.ml]));
  const hit = days.filter((d) => (by[d] || 0) >= goal).length;
  const avg = Math.round(days.reduce((s, d) => s + (by[d] || 0), 0) / 7);
  return `<div class="water-week">${days.map((d) => { const v = by[d] || 0; return `<div><span class="bar"><i style="height:${Math.min(100, Math.round((v / goal) * 100))}%" class="${v >= goal ? "hit" : ""}"></i></span>
      <small>${new Date(d).toLocaleDateString("en-ZA", { weekday: "narrow" })}</small></div>`; }).join("")}</div>
    <p class="muted" style="margin:8px 0 0">Average ${litres(avg)} a day. Goal reached on ${hit} of the last 7 days.</p>`;
}
async function waterView() {
  const [x, { data: rows }] = await Promise.all([waterToday(),
    sb.from("water_logs").select("log_date, ml").eq("client_id", me.id).gte("log_date", new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10))]);
  const base = x.weight ? Math.round(x.weight * 35) : null;
  render(`<button class="back" onclick="location.hash='#/home'">Back</button><h1>Water</h1>
    ${waterCard(x)}
    <div class="card"><h3>Last 7 days</h3>${waterWeekHtml(rows, x.goal)}</div>
    <div class="card"><h3>How your goal is worked out</h3>
      <p>${base ? `About 35 ml for every kg you weigh: ${x.weight} kg comes to ${litres(base)}.` : "We use 2 L until you log a weigh-in, then about 35 ml for every kg you weigh."}
      Add about 500 ml for every hour of exercise${x.minutes ? `. You've logged about ${x.minutes} minutes today, so that's included` : ""}. Add another 500 ml on hot days.</p>
      <p class="muted" style="margin:0">Tea, rooibos, coffee, milk and sparkling water all count. If you have a heart or kidney condition, or your doctor has limited your fluids, follow their advice instead.</p></div>
    <form class="card" id="wg"><h3>Your goal</h3>
      <label class="check"><input type="radio" name="m" value="auto" ${x.auto ? "checked" : ""}><span>Recommended for me (changes with my weight and training)</span></label>
      <label class="check"><input type="radio" name="m" value="own" ${x.auto ? "" : "checked"}><span>My own goal</span></label>
      <div class="grid2"><div><label for="wml">Millilitres a day</label><input id="wml" name="ml" type="number" inputmode="numeric" min="500" max="8000" step="250" value="${me.water_goal_ml || x.goal}"></div><div></div></div>
      <button class="small" style="margin-top:12px">Save goal</button></form>
    <div class="card"><h3>Tips that help</h3><ul class="tips">${WATER_TIPS.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>`);
  bindWater(x, waterView);
  $("#wg").onsubmit = async (e) => {
    e.preventDefault(); const f = e.target; const own = f.m.value === "own";
    const v = own ? Math.round(num(f.ml.value) / 50) * 50 : null;
    if (own && (!v || v < 500 || v > 8000)) return toast("Choose between 500 and 8000 ml");
    const { error } = await sb.from("profiles").update({ water_goal_ml: v }).eq("id", me.id);
    if (!fail(error)) { me.water_goal_ml = v; toast("Water goal saved"); waterView(); }
  };
}

async function foodSetup() {
  const { data: m } = await sb.from("body_metrics").select("weight_kg").eq("client_id", me.id).not("weight_kg", "is", null).order("metric_date", { ascending: false }).limit(1);
  let pick = me.nutrition_mode || "points";
  render(`${foodBudget() ? `<button class="back" onclick="location.hash='#/food'">Back</button>` : ""}<h1>Set up food tracking</h1>
    <p class="muted">Choose how you'd like to count. You can switch at any time and your log stays.</p>
    <div class="mode-pick" id="mode" role="radiogroup" aria-label="How to count food">
      <button type="button" role="radio" data-mode="points" aria-checked="${pick === "points"}" class="${pick === "points" ? "on" : ""}"><b>Points</b><span>Simpler. Protein and fibre count in your favour, some foods are free, and you get a weekly buffer for braais and birthdays.</span></button>
      <button type="button" role="radio" data-mode="calories" aria-checked="${pick === "calories"}" class="${pick === "calories" ? "on" : ""}"><b>Calories</b><span>Count kcal exactly. Good if you already know your numbers or work with a dietitian.</span></button>
    </div>
    <p class="muted">We use these details to work out a safe daily target. Only the result is saved. Your age, sex and height are not stored.</p>
    <form id="fs" class="card">
      <div class="grid2"><div><label>Current weight (kg)</label><input name="w" type="number" step="0.1" required value="${m?.[0]?.weight_kg ?? ""}"></div>
      <div><label>Goal weight (kg)</label><input name="g" type="number" step="0.1" value="${me.goal_weight_kg ?? ""}"></div>
      <div><label>Height (cm)</label><input name="h" type="number" required></div><div><label>Age</label><input name="a" type="number" required></div></div>
      <label>Sex (for the calorie formula)</label><select name="s"><option value="f">Female</option><option value="m">Male</option></select>
      <label>Activity level</label><select name="act"><option value="1.2">Mostly sitting</option><option value="1.375" selected>Light exercise 1–3×/week</option><option value="1.55">Moderate 3–5×/week</option><option value="1.725">Very active</option></select>
      <button class="block" style="margin-top:12px">Calculate and save</button>
      <p class="muted" style="margin-top:10px">Prefer a number from your coach or dietitian? <a href="#" id="manual">Enter it yourself</a>.</p></form>
    <p class="muted">This is a tracking tool, not medical advice. If you have a lot to lose or a health condition, check in with your doctor or a registered dietitian first.</p>`);
  $$("#mode [data-mode]").forEach((b) => (b.onclick = () => {
    pick = b.dataset.mode; $$("#mode [data-mode]").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); });
  }));
  const save = async (upd, msg) => {
    const { error } = await sb.from("profiles").update(upd).eq("id", me.id); if (fail(error)) return false;
    Object.assign(me, upd); toast(msg); return true;
  };
  $("#manual").onclick = async (e) => {
    e.preventDefault(); const cal = pick === "calories";
    const v = Number(prompt(cal ? "Daily calories (kcal):" : "Daily points budget:"));
    if (cal ? !v || v < 1200 || v > 5000 : !v || v < 15 || v > 80) return toast(cal ? "Enter a number between 1200 and 5000" : "Enter a number between 15 and 80");
    const upd = cal ? { nutrition_mode: "calories", daily_kcal: Math.round(v), daily_points: Math.round(v / 50) } : { nutrition_mode: "points", daily_points: Math.round(v), daily_kcal: Math.round(v) * 50 };
    if (await save(upd, "Saved")) foodView();
  };
  $("#fs").onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    const w = num(f.w.value), g = num(f.g.value);
    const kcal = dailyKcal({ weight: w, height: num(f.h.value), age: num(f.a.value), sex: f.s.value, activity: f.act.value, losing: g == null || g < w });
    const upd = { nutrition_mode: pick, daily_kcal: kcal, daily_points: Math.round(kcal / 50), goal_weight_kg: g };
    if (!(await save(upd, pick === "calories" ? `Your target: ${kcal} kcal a day` : `Your budget: ${upd.daily_points} points a day`))) return;
    const { data: hasW } = await sb.from("body_metrics").select("id").eq("client_id", me.id).limit(1);
    if (!hasW?.length) await sb.from("body_metrics").insert({ client_id: me.id, weight_kg: w });
    foodView();
  };
}

async function foodView(date) {
  if (date === "setup" || !foodBudget()) return foodSetup();
  date = date || today();
  const [f, { data: custom }] = await Promise.all([foodSummary(date), sb.from("custom_foods").select("*").eq("client_id", me.id).order("name")]);
  const shift = (n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const meals = ["Breakfast", "Lunch", "Dinner", "Snack"];
  const all = [...(custom || []).map((c) => ({ name: c.name, serving: c.serving || "1 serving", points: Number(c.points), kcal: c.kcal == null ? Number(c.points) * 50 : Number(c.kcal), mine: true })), ...FOODS];
  const k = kcalMode();
  render(`<div class="row between"><button class="small secondary" onclick="location.hash='#/food/${shift(-1)}'">‹</button>
      <h2 style="margin:0">${date === today() ? "Today" : fmtDate(date)}</h2>
      <button class="small secondary" ${date >= today() ? "disabled" : ""} onclick="location.hash='#/food/${shift(1)}'" aria-label="Next day">›</button></div>
    <div style="margin-top:12px">${foodCard(f)}</div>
    ${meals.map((m) => { const rs = f.dayRows.filter((r) => r.meal === m); return `<div class="card"><div class="row between"><h3>${m}</h3><span class="muted">${Math.round(rs.reduce((s, r) => s + foodVal(r), 0))} ${foodUnit()}</span></div>
      ${rs.map((r) => `<div class="list-item" style="cursor:default"><div class="grow">${esc(r.food_name)} <span class="muted">× ${r.servings}</span></div><b>${Math.round(foodVal(r))}</b>
        <button class="small secondary" data-del="${r.id}" aria-label="Remove">${ICON.close}</button></div>`).join("") || `<p class="muted" style="margin:4px 0 0">Nothing yet</p>`}</div>`; }).join("")}
    <div class="card" id="add"><h3>Add food</h3>
      <input id="fq" placeholder="Search: pap, biltong, rusk…">
      <div class="grid2" style="margin-top:8px"><select id="meal">${meals.map((m) => `<option ${m === defaultMeal() ? "selected" : ""}>${m}</option>`).join("")}</select>
        <div class="row"><button type="button" class="small secondary" id="sMinus">−</button><b id="sv" style="min-width:34px;text-align:center">1</b><button type="button" class="small secondary" id="sPlus">+</button><span class="muted">serv.</span></div></div>
      <div id="fres" style="max-height:300px;overflow-y:auto;margin-top:8px"></div></div>
    <div class="card"><div class="row between"><h3>Recipes</h3><span class="muted">${k ? "kcal" : "Points"} a serving</span></div>
      ${RECIPES.map((r, i) => `<a class="recipe-card" href="#/recipe/${i}"><span class="pts">${k ? r.kcal : r.points}</span><div style="flex:1"><b>${esc(r.name)}</b><div class="muted">${r.minutes} min, serves ${r.serves}</div></div></a>`).join("")}</div>
    <details class="card"><summary>Not listed? Use the label calculator</summary>
      <form id="lab"><label>Name</label><input name="n" required placeholder="e.g. Woolies protein bar">
      <label>Serving</label><input name="sv" placeholder="e.g. 1 bar (45 g)">
      <div class="grid3"><div><label>kcal</label><input name="k" type="number" step="any" required></div><div><label>Sat. fat g</label><input name="sat" type="number" step="any" value="0"></div>
      <div><label>Sugar g</label><input name="su" type="number" step="any" value="0"></div><div><label>Protein g</label><input name="p" type="number" step="any" value="0"></div>
      <div><label>Fibre g</label><input name="fi" type="number" step="any" value="0"></div><div><label>${k ? "kcal" : "Points"}</label><div class="stat" id="lp">0</div></div></div>
      <button class="block" style="margin-top:10px">Save to my foods</button></form></details>
    <p class="muted">${k ? "Your target is a guide, not a rule. Aim to be close most days; one big meal won't undo your week." : `Free foods are 0 points so hunger is never the reason you stop. Portions still count. Your weekly buffer of ${WEEKLY_BUFFER} covers braais and birthdays.`}</p>
    <p style="text-align:center"><a href="#/food/setup">Counting ${k ? "calories" : "points"}. Change how I count</a></p>`);
  let serv = 1;
  const setServ = (v) => { serv = Math.max(0.5, Math.round(v * 2) / 2); $("#sv").textContent = serv; };
  $("#sMinus").onclick = () => setServ(serv - 0.5); $("#sPlus").onclick = () => setServ(serv + 0.5);
  const drawRes = () => {
    const q = $("#fq").value.toLowerCase();
    const rows = all.filter((x) => x.name.toLowerCase().includes(q)).slice(0, q ? 30 : 12);
    $("#fres").innerHTML = rows.map((x, i) => `<button type="button" class="list-item" data-f="${all.indexOf(x)}" style="width:100%;background:none;color:inherit;border-radius:0;text-align:left">
      <div class="grow"><b>${esc(x.name)}</b> <span class="muted">${esc(x.serving)}</span>${x.mine ? ` <span class="chip">mine</span>` : ""}</div>
      ${k ? `<b>${x.kcal}</b>` : x.free ? `<span class="chip good">Free</span>` : `<b>${x.points}</b>`}</button>`).join("") || `<p class="muted">No match — try the label calculator below.</p>`;
    $$("[data-f]").forEach((b) => (b.onclick = async () => {
      const x = all[b.dataset.f];
      const { error } = await sb.from("food_logs").insert({ client_id: me.id, log_date: date, meal: $("#meal").value, food_name: x.name, servings: serv, points: Math.round(x.points * serv), kcal: Math.round(x.kcal * serv) });
      if (!fail(error)) { toast(`Added ${x.name}`); foodView(date); }
    }));
  };
  $("#fq").oninput = drawRes; drawRes();
  $$("[data-del]").forEach((b) => (b.onclick = async () => { const { error } = await sb.from("food_logs").delete().eq("id", b.dataset.del); if (!fail(error)) foodView(date); }));
  const lab = $("#lab"); const lp = () => calcPoints({ kcal: num(lab.k.value) || 0, sat: num(lab.sat.value) || 0, sugar: num(lab.su.value) || 0, protein: num(lab.p.value) || 0, fibre: num(lab.fi.value) || 0 });
  lab.oninput = () => ($("#lp").textContent = k ? Math.round(num(lab.k.value) || 0) : lp());
  lab.onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await sb.from("custom_foods").insert({ client_id: me.id, name: lab.n.value.trim(), serving: lab.sv.value || null, points: lp(), kcal: num(lab.k.value) || 0 });
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
  if (embedded) return { html: reportHtml.replace("<h3>Your week</h3>", "<h3>This week vs last week</h3>") + html, after: () => drawProgress(metrics, pbs) };
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
  if (me.role === "trainer") ({ data: other } = await sb.from("profiles").select("full_name, avatar_path").eq("id", clientId).single());
  else ({ data: other } = await sb.from("profiles").select("full_name, avatar_path").eq("id", me.trainer_id).single());

  const { data: msgs } = await sb.from("messages").select("*").eq("client_id", clientId).order("created_at").limit(300);
  render(`${me.role === "trainer" ? `<button class="back" onclick="location.hash='#/inbox'">← Inbox</button>` : ""}
    <div class="row" style="margin-bottom:8px">${avatar(other)}<h2 style="margin:0">${esc(other?.full_name || "Coach")}</h2></div>
    <div class="chat"><div class="chat-log" id="log"></div>
    ${canChat() ? `<form class="chat-input" id="send"><textarea name="m" placeholder="Message…" required></textarea><button>Send</button></form>`
      : `<div class="card chat-lock"><h3>Chat with your coach</h3><p class="muted" style="margin:0 0 10px">Messaging your coach for advice is included with a pass or a PT plan. You'll still see anything your coach sends you here.</p>
        <button class="block" onclick="location.hash='#/passes'">See passes</button></div>`}</div>`);
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

  const form = $("#send"); if (!form) return;
  form.m.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  form.onsubmit = async (e) => {
    e.preventDefault(); const body = form.m.value.trim(); if (!body) return;
    form.m.value = "";
    const { data, error } = await sb.from("messages").insert({ client_id: clientId, sender_id: me.id, body }).select().single();
    if (!fail(error)) add(data);
  };
}

// ================================================================ PROFILE (shared)
// Calendar reminders work even when the app is closed, on any phone, at no cost.
function icsFile(events) {
  const pad = (n) => String(n).padStart(2, "0"); const d = new Date();
  const ds = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const url = location.origin + location.pathname;
  const ev = events.map((e) => ["BEGIN:VEVENT", `UID:or-${me.id}-${e.key}@or-coaching`, `DTSTAMP:${stamp}`, `DTSTART:${ds}T${e.time.replace(":", "")}00`,
    "DURATION:PT15M", `RRULE:${e.rule}`, `SUMMARY:${e.title}`, `DESCRIPTION:${e.desc} ${url}`, `URL:${url}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${e.title}`, "TRIGGER:PT0M", "END:VALARM", "END:VEVENT"].join("\r\n"));
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Or.//Coaching//EN", "CALSCALE:GREGORIAN", ...ev, "END:VCALENDAR"].join("\r\n");
}
const DAYS = [["MO", "Mon"], ["TU", "Tue"], ["WE", "Wed"], ["TH", "Thu"], ["FR", "Fri"], ["SA", "Sat"], ["SU", "Sun"]];
function remindersCard() {
  return `<div class="card" id="rem"><h3>Reminders</h3>
    <p class="muted" style="margin:0 0 8px">Add reminders to your phone's calendar. They pop up even when the app is closed.</p>
    <label>Training days</label><div id="remDays">${DAYS.map(([k, l]) => `<span class="chip ${["MO", "WE", "FR"].includes(k) ? "on" : ""}" data-d="${k}" role="button">${l}</span>`).join("")}</div>
    <div class="grid2"><div><label for="remT">Time</label><input id="remT" type="time" value="07:00"></div><div></div></div>
    <label class="check"><input type="checkbox" id="remW" checked><span>Weekly weigh-in on Monday mornings</span></label>
    <label class="check"><input type="checkbox" id="remH" checked><span>Water reminders at 10:00 and 15:00</span></label>
    <button class="secondary block" id="remGo" style="margin-top:10px">${ICON.calendar} Add to my calendar</button></div>`;
}
function bindReminders() {
  $$("#remDays .chip").forEach((c) => (c.onclick = () => c.classList.toggle("on")));
  $("#remGo")?.addEventListener("click", () => {
    const days = $$("#remDays .chip.on").map((c) => c.dataset.d); const ev = [];
    if (days.length) ev.push({ key: "train", time: $("#remT").value || "07:00", rule: `FREQ=WEEKLY;BYDAY=${days.join(",")}`, title: "Training time", desc: "Open your workout in Or." });
    if ($("#remW").checked) ev.push({ key: "weigh", time: "07:00", rule: "FREQ=WEEKLY;BYDAY=MO", title: "Weekly weigh-in", desc: "Log your weight (and photo, if you use them) in Or." });
    if ($("#remH").checked) ["10:00", "15:00"].forEach((t, i) => ev.push({ key: "water" + i, time: t, rule: "FREQ=DAILY", title: "Drink a glass of water", desc: "Tap + Glass in Or." }));
    if (!ev.length) return toast("Pick at least one reminder");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([icsFile(ev)], { type: "text/calendar" }));
    link.download = "or-reminders.ics"; link.click();
    toast("Open the file and choose Add to calendar");
  });
}
function inviteCard() {
  if (!me.referral_code) return "";
  const url = `${location.origin}${location.pathname}?ref=${me.referral_code}`;
  return `<div class="card"><h3>Invite a friend</h3><p class="muted" style="margin:0 0 8px">Training's easier with company. Share your link and your coach will see that you invited them.</p>
    <div class="row" style="gap:8px"><input id="refUrl" value="${esc(url)}" readonly aria-label="Your invite link" style="flex:1;min-width:0"><button class="small" id="refShare">Share</button></div></div>`;
}
function bindInvite() {
  $("#refShare")?.addEventListener("click", async () => {
    const url = $("#refUrl").value; const text = `Come train with me on ${CONFIG.APP_NAME}`;
    try { if (navigator.share) return await navigator.share({ title: CONFIG.APP_NAME, text, url }); } catch { return; }
    try { await navigator.clipboard.writeText(url); toast("Link copied"); } catch { $("#refUrl").select(); toast("Copy the link above"); }
  });
}

async function profileView() {
  const owned = me.equipment || [];
  const cv = isClientView();
  render(`<h1>${cv ? "My profile" : "Settings"}</h1>
    <div class="card"><div class="row" style="gap:16px">${avatar(me, "xl")}
      <div><b>${me.role === "trainer" ? "Your photo" : "Profile photo"}</b><p class="muted" style="margin:2px 0 8px">${me.role === "trainer" ? "Your clients see this next to your messages." : "Only you and your coach can see it."}</p>
      <label class="btn small secondary" style="margin:0;color:var(--text)">${me.avatar_path ? "Change photo" : "Add a photo"}<input type="file" id="avFile" accept="image/*" hidden></label>
      ${me.avatar_path ? `<button type="button" class="small secondary" id="avDel" style="margin-left:6px">Remove</button>` : ""}</div></div></div>
    ${me.role === "trainer" ? `<div class="card row between"><div><h3 style="margin:0">${cv ? "You're in My training" : "My training"}</h3><p class="muted" style="margin:2px 0 0">${cv ? "Switch back to manage your clients." : "Use the client side yourself: workouts, tracking and check-ins."}</p></div><button class="small" id="swv">${cv ? "Coach view" : "Open"}</button></div>` : ""}
    ${!DEMO ? `<div class="card row between"><div><h3 style="margin:0">See ${me.role === "trainer" ? "the client side with sample data" : "the coach side"}</h3><p class="muted" style="margin:2px 0 0">A copy of the app filled with sample clients. Nothing you do there is saved.</p></div><a class="btn small secondary" href="?demo">Open</a></div>` : ""}
    ${cv ? `<div class="card"><h3>Progress photos</h3>
      <label class="check"><input type="checkbox" id="phOpt" ${me.photos_opt_in ? "checked" : ""}>
      <span>Turn on weekly progress photos. I consent to my coach seeing the photos I upload, to track my progress. Only my coach and I can see them, and I can delete them or switch this off at any time.</span></label>
      ${me.photos_opt_in ? `<label class="check"><input type="checkbox" id="shOpt" ${me.share_consent_at ? "checked" : ""}>
      <span>My coach may share my before-and-after photos on Instagram (faces can be hidden). I can withdraw this at any time, though posts already shared may stay up.</span></label>
      <a class="btn secondary block" href="#/photos" style="margin-top:10px">Open my progress photos</a>` : ""}</div>
    <div class="card"><div class="row between"><div><h3 style="margin:0">Health check</h3><p class="muted" style="margin:2px 0 0">${myScreen ? `Updated ${fmtDate(myScreen.updated_at)}` : "Not done yet"}${myScreen?.flags && !myScreen.cleared_at ? ", waiting for your coach to clear you" : ""}</p></div>
      <a class="btn small secondary" href="#/health">${myScreen ? "Update" : "Start"}</a></div></div>
    ${remindersCard()}
    ${inviteCard()}` : ""}
    <form class="card" id="pf">
      <label>Full name</label><input name="name" value="${esc(me.full_name)}">
      ${cv ? `<label>What do I want to track?</label>
      <div id="tr">${[["exercise", "Exercise"], ["nutrition", "Nutrition"]].map(([k, l]) => `<span class="chip ${(me.tracks || ["exercise"]).includes(k) ? "on" : ""}" data-t="${k}" role="button">${l}</span>`).join("")}</div>
      <label>My goal</label><input name="goal" value="${esc(me.goal)}" placeholder="e.g. Lose 5 kg, run 5 km, get stronger">
      <label>Equipment I have</label><p class="muted">Your coach uses this to fit workouts to your space.</p>
      <div id="eq">${EQUIPMENT.map((e) => `<span class="chip ${owned.includes(e) ? "on" : ""}" data-e="${esc(e)}" role="button">${esc(e)}</span>`).join("")}</div>
      <label for="wts">Weights I have or use</label>
      <textarea id="wts" name="wts" maxlength="300" style="min-height:64px" placeholder="e.g. Dumbbells 5 kg and 8 kg, 12 kg kettlebell, gym up to 20 kg">${esc(me.weights_note || "")}</textarea>` : ""}
      <button class="block" style="margin-top:14px">Save</button></form>
    ${me.role === "client" && me.trainer_id ? `<div class="card"><h3>My plan</h3><p><span class="chip on">${{ free: "Workouts only", library: "Library", pt: "PT client" }[me.plan] || me.plan}</span>
      ${me.access_until ? `<span class="muted">until ${fmtDate(me.access_until)}</span>` : ""}</p>${igLink()}</div>` : ""}
    ${!cv ? `<div class="card"><h3>Library access</h3><label class="check"><input type="checkbox" id="libFree" ${me.library_free ? "checked" : ""}>
      <span>Full library is free for all accepted clients. Untick to make it a paid extra (clients still see exercises in their own workouts).</span></label></div>` : ""}
    ${cv ? `<div class="card"><h3>Your data</h3><p class="muted">Under POPIA you can see, correct or delete your information.</p>
      <div class="grid2"><button class="secondary" id="export">Download my data</button><button class="secondary" id="delReq">Request deletion</button></div></div>`
      : `<div class="card"><h3>Install on your phone</h3><p class="muted">iPhone: Safari → Share → Add to Home Screen. Android: Chrome menu → Install app. Share this same tip with clients.</p></div>`}
    <p class="muted" style="text-align:center">${esc(session.user.email)}</p>`);
  $$("#eq .chip, #tr .chip").forEach((c) => (c.onclick = () => c.classList.toggle("on")));
  $("#pf").onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    const upd = { full_name: f.name.value };
    if (cv) {
      upd.goal = f.goal.value; upd.equipment = $$("#eq .chip.on").map((c) => c.dataset.e); upd.weights_note = f.wts.value.trim() || null;
      upd.tracks = $$("#tr .chip.on").map((c) => c.dataset.t);
      if (!upd.tracks.length) return toast("Pick exercise, nutrition or both");
    }
    const { error } = await sb.from("profiles").update(upd).eq("id", me.id);
    if (!fail(error)) { Object.assign(me, upd); toast("Saved"); route(); }
  };
  $("#avFile").addEventListener("change", async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      toast("Uploading photo…");
      const blob = await shrinkImage(file, 480, 0.85);
      const path = `${me.id}/avatar-${Date.now()}.jpg`;
      const { error } = await sb.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg" }); if (fail(error)) return;
      if (me.avatar_path) await sb.storage.from("avatars").remove([me.avatar_path]);
      const { error: ue } = await sb.from("profiles").update({ avatar_path: path }).eq("id", me.id); if (fail(ue)) return;
      me.avatar_path = path; toast("Photo saved"); route();
    } catch (err) { toast(err.message); }
  });
  $("#avDel")?.addEventListener("click", async () => {
    await sb.storage.from("avatars").remove([me.avatar_path]);
    const { error } = await sb.from("profiles").update({ avatar_path: null }).eq("id", me.id);
    if (!fail(error)) { me.avatar_path = null; $("#meBtn").innerHTML = I('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'); toast("Photo removed"); profileView(); }
  });
  $("#phOpt")?.addEventListener("change", async (e) => {
    const on = e.target.checked;
    const upd = { photos_opt_in: on, photos_consent_at: on ? new Date().toISOString() : me.photos_consent_at };
    const { error } = await sb.from("profiles").update(upd).eq("id", me.id);
    if (!fail(error)) { Object.assign(me, upd); toast(on ? "Progress photos switched on" : "Progress photos switched off. Your coach can no longer see them."); profileView(); }
  });
  $("#swv")?.addEventListener("click", switchView);
  $("#shOpt")?.addEventListener("change", async (e) => {
    const upd = { share_consent_at: e.target.checked ? new Date().toISOString() : null };
    const { error } = await sb.from("profiles").update(upd).eq("id", me.id);
    if (!fail(error)) { Object.assign(me, upd); toast(e.target.checked ? "Thanks. Your coach can now share your progress." : "Sharing switched off"); }
  });
  bindReminders(); bindInvite();
  $("#libFree")?.addEventListener("change", async (e) => {
    const { error } = await sb.from("profiles").update({ library_free: e.target.checked }).eq("id", me.id);
    if (!fail(error)) { me.library_free = e.target.checked; toast(e.target.checked ? "Library is free" : "Library is now a paid extra"); }
  });
  $("#export")?.addEventListener("click", async () => {
    const [p, m, a, l, msg, fl, ck, hs, wt] = await Promise.all([
      sb.from("profiles").select("*").eq("id", me.id).single(), sb.from("body_metrics").select("*").eq("client_id", me.id),
      sb.from("activities").select("*").eq("client_id", me.id), sb.from("set_logs").select("*").eq("client_id", me.id),
      sb.from("messages").select("*").eq("client_id", me.id), sb.from("food_logs").select("*").eq("client_id", me.id), sb.from("checkins").select("*").eq("client_id", me.id),
      sb.from("health_screens").select("*").eq("client_id", me.id), sb.from("water_logs").select("*").eq("client_id", me.id)]);
    const blob = new Blob([JSON.stringify({ profile: p.data, body_metrics: m.data, activities: a.data, sets: l.data, messages: msg.data, food: fl.data, checkins: ck.data, health_check: hs.data, water: wt.data }, null, 2)], { type: "application/json" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "my-training-data.json"; link.click();
  });
  $("#delReq")?.addEventListener("click", async () => {
    if (!confirm("Send your coach a request to delete your account and data?")) return;
    const { error } = await sb.from("messages").insert({ client_id: me.id, sender_id: me.id, body: "Please delete my account and all my data (POPIA request)." });
    if (!fail(error)) toast("Request sent to your coach");
  });
}

// ================================================================ TRAINER
const daysAgoIso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const daysBetween = (a, b = today()) => Math.round((new Date(b) - new Date(a)) / 864e5);
const firstName = (c) => (c?.full_name || "").split(" ")[0] || "Client";

// One pass over the last four weeks for every client: activity, check-ins, passes, health, water, weight.
async function coachData() {
  const since = daysAgoIso(28);
  const [{ data: people }, { data: logs }, { data: acts }, { data: wos }, { data: cks }, { data: unread }, { data: screens }, { data: metrics }, { data: water }] = await Promise.all([
    sb.from("profiles").select("*").eq("role", "client").order("full_name"),
    sb.from("set_logs").select("client_id, logged_at").gte("logged_at", since),
    sb.from("activities").select("client_id, activity_date, minutes").gte("activity_date", since),
    sb.from("workouts").select("id, client_id, name, scheduled_date, completed_at"),
    sb.from("checkins").select("*").gte("checkin_date", since),
    sb.from("messages").select("client_id").is("read_at", null).neq("sender_id", me.id),
    sb.from("health_screens").select("client_id, flags, cleared_at"),
    sb.from("body_metrics").select("client_id, metric_date, weight_kg").gte("metric_date", daysAgoIso(42)).order("metric_date"),
    sb.from("water_logs").select("client_id, log_date, ml").gte("log_date", daysAgoIso(6)),
  ]);
  const pending = (people || []).filter((p) => !p.trainer_id), mine = (people || []).filter((p) => p.trainer_id === me.id);
  const rows = mine.map((c) => {
    const own = (arr) => (arr || []).filter((r) => r.client_id === c.id);
    const L = own(logs), A = own(acts), W = own(wos), C = own(cks), M = own(metrics).filter((m) => m.weight_kg), WT = own(water);
    const sessionDays = new Set([...L.map((l) => l.logged_at.slice(0, 10)), ...A.map((x) => x.activity_date), ...W.filter((w) => w.completed_at).map((w) => w.completed_at.slice(0, 10))]);
    const seen = [...sessionDays, ...C.map((x) => x.checkin_date)].sort().pop() || null;
    const ck = C.filter((x) => x.energy != null).sort((a, b) => a.checkin_date.localeCompare(b.checkin_date));
    const last7 = ck.slice(-7);
    const avg = (k) => (last7.length ? +(last7.reduce((sum, x) => sum + x[k], 0) / last7.length).toFixed(1) : null);
    const w0 = M[0], w1 = M[M.length - 1];
    return {
      c, seen, quiet: seen ? daysBetween(seen) : null,
      s7: [...sessionDays].filter((d) => d >= daysAgoIso(6)).length, s28: sessionDays.size,
      done7: W.filter((w) => w.completed_at && w.completed_at.slice(0, 10) >= daysAgoIso(6)).length,
      overdue: W.filter((w) => !w.completed_at && w.scheduled_date && w.scheduled_date < today()).length,
      planned: W.filter((w) => !w.completed_at && (!w.scheduled_date || w.scheduled_date >= today())).length,
      rough: ck.filter((x) => x.checkin_date >= daysAgoIso(3) && (x.energy <= 2 || x.sleep <= 2 || x.soreness >= 4)).pop() || null,
      lastNote: ck.filter((x) => x.note).pop()?.note || null,
      energy: avg("energy"), sleep: avg("sleep"), soreness: avg("soreness"),
      wChange: w0 && w1 && w0 !== w1 ? +(w1.weight_kg - w0.weight_kg).toFixed(1) : null,
      wWeeks: w0 && w1 ? Math.max(1, Math.round(daysBetween(w0.metric_date, w1.metric_date) / 7)) : null,
      waterAvg: WT.length ? Math.round(WT.reduce((sum, x) => sum + x.ml, 0) / 7) : null,
      unreadN: own(unread).length,
      passLeft: c.access_until ? daysBetween(today(), c.access_until) : null,
      screen: own(screens)[0] || null,
    };
  });
  return { people: people || [], pending, mine, rows };
}

// What needs Tanya, most urgent first: [severity 1-3, reason, link]
function attention(r) {
  const out = []; const c = r.c;
  if (r.unreadN) out.push([3, `${r.unreadN} unread ${r.unreadN === 1 ? "message" : "messages"}`, `chat/${c.id}`]);
  if (!r.screen) out.push([2, "Health check not done yet", `client/${c.id}`]);
  else if (r.screen.flags && !r.screen.cleared_at) out.push([3, `Health check needs your review (${r.screen.flags} yes)`, `client/${c.id}`]);
  if (r.rough) out.push([3, `Rough check-in ${fmtDate(r.rough.checkin_date)}: energy ${r.rough.energy}, sleep ${r.rough.sleep}, soreness ${r.rough.soreness}${r.rough.note ? `. "${r.rough.note}"` : ""}`, `client/${c.id}`]);
  if (r.quiet == null) out.push([1, "Hasn't been active yet", `chat/${c.id}`]);
  else if (r.quiet >= 5) out.push([r.quiet >= 10 ? 3 : 2, `Quiet for ${r.quiet} days`, `chat/${c.id}`]);
  if (c.plan !== "free" && r.passLeft != null) {
    if (r.passLeft < 0) out.push([2, `Pass ended ${fmtDate(c.access_until)}`, `client/${c.id}`]);
    else if (r.passLeft <= 7) out.push([2, `Pass ends in ${r.passLeft} ${r.passLeft === 1 ? "day" : "days"}`, `client/${c.id}`]);
  }
  if (r.overdue) out.push([1, `${r.overdue} overdue ${r.overdue === 1 ? "workout" : "workouts"}`, `client/${c.id}`]);
  if ((c.tracks || ["exercise"]).includes("exercise") && !r.planned && r.quiet != null && r.quiet < 14) out.push([1, "Nothing planned. Build their next workout", `builder/${c.id}`]);
  return out;
}

function clientsContext(rows) {
  return `Today is ${today()}. ${rows.length} clients.\n` + rows.map((r) => [
    `Client ${firstName(r.c)}`, `goal: ${r.c.goal || "not set"}`, `plan: ${r.c.plan}`,
    `last active: ${r.quiet == null ? "never" : r.quiet + " days ago"}`, `active days last 7/28: ${r.s7}/${r.s28}`,
    `workouts done this week: ${r.done7}`, `overdue workouts: ${r.overdue}`, `workouts planned ahead: ${r.planned}`,
    r.energy != null ? `check-in averages (1-5): energy ${r.energy}, sleep ${r.sleep}, soreness ${r.soreness}` : "no check-ins",
    r.lastNote ? `latest check-in note: "${r.lastNote}"` : "",
    r.wChange != null ? `weight change ${r.wChange} kg over ${r.wWeeks} weeks` : "",
    r.waterAvg != null ? `water average ${r.waterAvg} ml a day` : "",
    r.screen?.flags && !r.screen.cleared_at ? "health check needs coach review before hard training" : "",
    r.c.plan !== "free" && r.passLeft != null ? `pass ends in ${r.passLeft} days` : "",
  ].filter(Boolean).join("; ")).join("\n");
}

// ---------------------------------------------------------------- Ask AI (coach only)
function aiBox(prompts) {
  return `<div class="card ai"><div class="row between"><h3>Ask AI</h3><span class="chip">Beta</span></div>
    <p class="muted" style="margin:0 0 8px">Ideas to help you decide. You stay the coach: check anything before you act on it. Client names are sent as first names only.</p>
    <div class="chips">${prompts.map((q) => `<a href="#" data-aiq="${esc(q)}">${esc(q)}</a>`).join("")}</div>
    <textarea id="aiQ" maxlength="1000" placeholder="Or ask your own question" aria-label="Ask AI a question"></textarea>
    <button class="small" id="aiGo" style="margin-top:8px">Ask</button><div id="aiOut" class="ai-out" aria-live="polite"></div></div>`;
}
function fmtAi(t) {
  return esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").split(/\n{2,}/).map((par) => {
    const lines = par.split("\n").filter((l) => l.trim());
    if (lines.length && lines.every((l) => /^\s*([-•*]|\d+\.)\s/.test(l))) return `<ul>${lines.map((l) => `<li>${l.replace(/^\s*([-•*]|\d+\.)\s/, "")}</li>`).join("")}</ul>`;
    if (/^#+\s/.test(lines[0] || "")) return `<h3>${lines[0].replace(/^#+\s/, "")}</h3>${lines.slice(1).length ? `<p>${lines.slice(1).join("<br>")}</p>` : ""}`;
    return `<p>${lines.join("<br>")}</p>`;
  }).join("");
}
function bindAi(context) {
  $$("[data-aiq]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); $("#aiQ").value = a.dataset.aiq; $("#aiGo").click(); }));
  $("#aiGo").onclick = async () => {
    const q = $("#aiQ").value.trim(); if (!q) return toast("Type a question or tap a suggestion");
    const b = $("#aiGo"); b.disabled = true; b.textContent = "Thinking…"; $("#aiOut").innerHTML = `<p class="muted">Looking at your clients' data…</p>`;
    const { data, error } = await sb.functions.invoke("coach-ai", { body: { question: q, context: await context() } });
    b.disabled = false; b.textContent = "Ask";
    if (error || data?.error || !data?.text) { $("#aiOut").innerHTML = `<p class="muted">Ask AI isn't switched on yet. It needs the AI key added in Supabase (step 6 of the setup guide).</p>`; return; }
    $("#aiOut").innerHTML = fmtAi(data.text);
  };
}

function bindBroadcast(mine) {
  $("#bc")?.addEventListener("click", () => {
    if (!mine.length) return toast("Accept a client first");
    document.body.insertAdjacentHTML("beforeend", `<div class="picker" id="bcBox" role="dialog" aria-label="Message all clients"><div class="picker-box">
      <div class="row between"><h2 style="margin:0">Message all clients</h2><button type="button" class="small secondary" id="bcX" aria-label="Close">${ICON.close}</button></div>
      <p class="muted">Goes into each client's own chat with you, so replies stay private.</p>
      <textarea id="bcT" maxlength="1000" placeholder="e.g. New challenge this week: 8,000 steps a day. Who's in?"></textarea>
      <button class="block" id="bcSend" style="margin-top:12px">Send to ${mine.length} ${mine.length === 1 ? "client" : "clients"}</button></div></div>`);
    const close = () => $("#bcBox")?.remove();
    $("#bcX").onclick = close; $("#bcBox").addEventListener("click", (e) => { if (e.target.id === "bcBox") close(); });
    $("#bcSend").onclick = async () => {
      const body = $("#bcT").value.trim(); if (!body) return toast("Write your message first");
      $("#bcSend").disabled = true;
      const { error } = await sb.from("messages").insert(mine.map((c) => ({ client_id: c.id, sender_id: me.id, body })));
      if (fail(error)) { $("#bcSend").disabled = false; return; }
      close(); toast(`Sent to ${mine.length} ${mine.length === 1 ? "client" : "clients"}`);
    };
    $("#bcT").focus();
  });
}

async function trainerDash() {
  const { pending, mine, rows } = await coachData();
  const h = new Date().getHours(); const hello = h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
  const items = rows.flatMap((r) => attention(r).map(([sev, why, link]) => ({ r, sev, why, link }))).sort((a, b) => b.sev - a.sev);
  const byClient = []; items.forEach((x) => { const g = byClient.find((y) => y.r === x.r); g ? g.why.push(x) : byClient.push({ r: x.r, sev: x.sev, why: [x] }); });
  const active7 = rows.filter((r) => r.quiet != null && r.quiet <= 6).length;
  const sessions7 = rows.reduce((sum, r) => sum + r.s7, 0);
  const wins = rows.flatMap((r) => [
    r.done7 ? [r, `Finished ${r.done7} ${r.done7 === 1 ? "workout" : "workouts"} this week`] : null,
    r.s7 >= 4 ? [r, `Active on ${r.s7} of the last 7 days`] : null,
    r.wChange != null && r.wChange < 0 && String(r.c.goal || "").match(/lose|kg|weight/i) ? [r, `Down ${-r.wChange} kg in ${r.wWeeks} ${r.wWeeks === 1 ? "week" : "weeks"}`] : null,
  ].filter(Boolean));
  render(`<h1>${hello}, ${esc(firstName(me))}</h1>
    <div class="grid2 dash-stats">
      <a class="card" href="#/clients"><span class="stat">${mine.length}</span><span class="stat-label">Clients</span></a>
      <div class="card"><span class="stat">${active7}</span><span class="stat-label">Active this week</span></div>
      <div class="card"><span class="stat">${sessions7}</span><span class="stat-label">Active days logged this week</span></div>
      <a class="card" href="#/clients"><span class="stat">${pending.length}</span><span class="stat-label">New sign-ups</span></a></div>
    <div class="sec"><h2>Needs you</h2><span class="muted">${byClient.length ? `${byClient.length} ${byClient.length === 1 ? "client" : "clients"}` : ""}</span></div>
    <div class="card">${pending.length ? `<a class="list-item att sev2" href="#/clients"><span class="avatar">${pending.length}</span><div class="grow"><b>New sign-ups waiting</b><div class="muted">Accept them so they can start</div></div></a>` : ""}
      ${byClient.map((g) => `<a class="list-item att sev${g.sev}" href="#/${g.why[0].link}">${avatar(g.r.c)}<div class="grow"><b>${esc(g.r.c.full_name)}</b>
        ${g.why.map((w) => `<div class="muted">${esc(w.why)}</div>`).join("")}</div></a>`).join("")
      || (pending.length ? "" : `<div class="empty">Nobody needs you right now. Nice.</div>`)}</div>
    ${wins.length ? `<div class="sec"><h2>Wins this week</h2><span class="muted">Worth a shout-out</span></div>
      <div class="card">${[...new Set(wins.map(([r]) => r))].map((r) => `<a class="list-item" href="#/chat/${r.c.id}">${avatar(r.c)}<div class="grow"><b>${esc(r.c.full_name)}</b>
        ${wins.filter(([x]) => x === r).map(([, t]) => `<div class="muted">${esc(t)}</div>`).join("")}</div><span class="ico" aria-label="Message">${ICON.chat}</span></a>`).join("")}</div>` : ""}
    ${aiBox(["Who needs me most this week, and what should I say to them?", "Ideas to re-engage my quiet clients", "Draft a motivating message for everyone", "Suggest a theme for next week's daily challenge"])}
    <div class="grid2" style="margin-top:6px"><button class="secondary" id="bc">${ICON.chat} Message all clients</button><button class="secondary" onclick="location.hash='#/workouts'">${ICON.train} Workouts</button></div>`);
  bindAi(async () => clientsContext(rows));
  bindBroadcast(mine);
}

async function trainerClients() {
  const { people, pending, rows } = await coachData();
  const nameOf = (id) => people.find((p) => p.id === id)?.full_name || "a client";
  const tags = (r) => [
    r.screen?.flags && !r.screen.cleared_at ? `<span class="chip warn">Health review</span>` : !r.screen ? `<span class="chip">No health check</span>` : "",
    r.c.plan !== "free" ? `<span class="chip ${r.passLeft != null && r.passLeft < 0 ? "warn" : "good"}">${r.c.plan === "pt" ? "PT" : "Library"}${r.passLeft != null && r.passLeft >= 0 && r.passLeft <= 7 ? `, ${r.passLeft}d left` : r.passLeft != null && r.passLeft < 0 ? ", expired" : ""}</span>` : "",
  ].join("");
  const FILTERS = [["all", "All"], ["att", "Needs you"], ["quiet", "Quiet 5+ days"], ["pt", "PT"], ["library", "Library"], ["free", "Workouts only"]];
  render(`<h1>Clients</h1>
    ${pending.length ? `<div class="card"><h3>New sign-ups (${pending.length})</h3>${pending.map((p) => `<div class="list-item">${avatar(p)}
      <div class="grow"><b>${esc(p.full_name)}</b><div class="muted">${esc(p.email)}, joined ${fmtDate(p.created_at)}${p.referred_by ? `, invited by ${esc(nameOf(p.referred_by))}` : ""}${p.popia_consent_at ? "" : ", no consent recorded"}</div></div>
      <button class="small" data-accept="${p.id}">Accept</button></div>`).join("")}</div>` : ""}
    <input id="cq" placeholder="Search clients" aria-label="Search clients" style="margin-bottom:10px">
    <div class="chips" id="cf">${FILTERS.map(([k, l], i) => `<a href="#" data-f="${k}" class="${i ? "" : "pass"}">${l}</a>`).join("")}</div>
    <div class="card" id="cl"></div>
    ${inviteCard().replace("Invite a friend", "Invite a new client").replace("Training's easier with company. Share your link and your coach will see that you invited them.", "Share your sign-up link in your Instagram bio or WhatsApp. New sign-ups appear here for you to accept.")}`);
  let f = "all";
  const draw = () => {
    const q = $("#cq").value.toLowerCase();
    const list = rows.filter((r) => r.c.full_name.toLowerCase().includes(q) && (f === "all" || (f === "att" ? attention(r).some(([sv]) => sv >= 2) : f === "quiet" ? r.quiet == null || r.quiet >= 5 : r.c.plan === f)));
    $("#cl").innerHTML = list.map((r) => `<a class="list-item" href="#/client/${r.c.id}">${avatar(r.c)}
      <div class="grow"><b>${esc(r.c.full_name)}</b> ${tags(r)}<div class="muted">${esc(r.c.goal || "No goal set")}</div></div>
      <span class="muted" style="text-align:right">${r.quiet == null ? "Not active yet" : r.quiet === 0 ? "Active today" : `Active ${r.quiet}d ago`}<br>${r.s7} days this week</span></a>`).join("")
      || `<div class="empty">${rows.length ? "No clients match." : "No clients yet. Share your link below. New sign-ups appear here for you to accept."}</div>`;
    hydrateAvatars($("#cl"));
  };
  $("#cq").oninput = draw;
  $$("#cf a").forEach((a) => (a.onclick = (e) => { e.preventDefault(); $$("#cf a").forEach((x) => x.classList.remove("pass")); a.classList.add("pass"); f = a.dataset.f; draw(); }));
  draw(); bindInvite();
  $$("[data-accept]").forEach((b) => (b.onclick = async () => {
    const { error } = await sb.from("profiles").update({ trainer_id: me.id }).eq("id", b.dataset.accept);
    if (!fail(error)) { toast("Client accepted"); trainerClients(); }
  }));
}

function healthCard(h) {
  if (!h) return `<div class="card"><div class="row between"><h3>Health check</h3><span class="chip">Not done</span></div><p class="muted" style="margin:0">They'll be asked to complete it the next time they open the app.</p></div>`;
  const yes = HEALTH_QS.filter(([k]) => h.answers?.[k]);
  return `<div class="card ${h.flags && !h.cleared_at ? "flagged" : ""}"><div class="row between"><h3>Health check</h3>${h.flags ? (h.cleared_at ? `<span class="chip good">Cleared ${fmtDate(h.cleared_at)}</span>` : `<span class="chip warn">Needs review</span>`) : `<span class="chip good">All clear</span>`}</div>
    ${yes.length ? `<p class="muted" style="margin:6px 0 4px">Answered yes to:</p><ul class="tips">${yes.map(([, q]) => `<li>${esc(q)}</li>`).join("")}</ul>` : ""}
    ${h.details ? `<p><span class="muted">Their notes:</span> ${esc(h.details)}</p>` : ""}
    <p style="margin:6px 0 0"><span class="muted">Emergency contact:</span> ${esc(h.emergency_name)}, <a href="tel:${esc(String(h.emergency_phone || "").replace(/[^+0-9]/g, ""))}">${esc(h.emergency_phone)}</a></p>
    <p class="muted" style="margin:6px 0 0">Agreed to the terms ${fmtDate(h.waiver_accepted_at)}. Last updated ${fmtDate(h.updated_at)}.</p>
    ${h.flags && !h.cleared_at ? `<p class="muted" style="margin-top:8px">If they need a doctor's go-ahead, get it before hard training. Then mark them as cleared.</p><button class="small" id="clearH">Mark as cleared to train</button>` : ""}</div>`;
}

function clientContext(c, d) {
  const pbs = Object.values(personalBests(d.logs));
  const ck = (d.cks || []).filter((r) => r.energy != null);
  return [`Today is ${today()}. Client: ${firstName(c)}.`, `Goal: ${c.goal || "not set"}.`, `Plan: ${c.plan}. Tracks: ${(c.tracks || []).join(", ")}.`,
    `Equipment: ${(c.equipment || []).join(", ") || "bodyweight / not set"}. Weights: ${c.weights_note || "not given"}.`,
    d.screen?.flags && !d.screen.cleared_at ? "Health check: flagged, waiting for coach review. Keep suggestions gentle and advise checking with a doctor." : d.screen ? "Health check: clear or cleared by coach." : "Health check: not done yet.",
    `Workouts (newest first): ${(d.wos || []).slice(0, 8).map((w) => `${w.name} ${w.scheduled_date || ""} ${w.completed_at ? "done" : "open"}`).join("; ") || "none"}.`,
    `Exercise history: ${pbs.map((b) => { const l = b.history[b.history.length - 1]; return `${b.name}: ${b.sets} sets logged, last ${l.reps ?? l.seconds + "s"}${l.weight_kg ? " @ " + l.weight_kg + " kg" : ""}, best ${b.best.reps ?? b.best.seconds + "s"}${b.best.weight_kg ? " @ " + b.best.weight_kg + " kg" : ""}`; }).join("; ") || "nothing logged yet"}.`,
    `Check-ins last 14 days (energy/sleep/soreness, 1-5): ${ck.map((r) => `${r.checkin_date} ${r.energy}/${r.sleep}/${r.soreness}${r.note ? ` "${r.note}"` : ""}`).join("; ") || "none"}.`,
    `Weights: ${(d.metrics || []).filter((m) => m.weight_kg).slice(-8).map((m) => `${m.metric_date} ${m.weight_kg} kg`).join("; ") || "none"}.`,
    `Water last 7 days: ${(d.water || []).map((w) => `${w.log_date} ${w.ml} ml`).join("; ") || "not tracked"}.`].join("\n");
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
  const [{ data: c }, { data: wos }, { data: cks }, { data: hs }, { data: notes }, { data: water }, { data: metrics }] = await Promise.all([
    sb.from("profiles").select("*").eq("id", id).single(),
    sb.from("workouts").select("*, workout_items(count)").eq("client_id", id).order("created_at", { ascending: false }).then(async (r) => {
      const { data: ns } = await sb.from("item_notes").select("*, workout_items(workout_id, exercises(name))").eq("client_id", id).order("updated_at", { ascending: false });
      (r.data || []).forEach((w) => (w.ex_notes = (ns || []).filter((n) => n.workout_items?.workout_id === w.id))); return r; }),
    sb.from("checkins").select("*").eq("client_id", id).gte("checkin_date", new Date(Date.now() - 13 * 864e5).toISOString().slice(0, 10)).order("checkin_date", { ascending: false }),
    sb.from("health_screens").select("*").eq("client_id", id),
    sb.from("coach_notes").select("*").eq("client_id", id).order("created_at", { ascending: false }),
    sb.from("water_logs").select("log_date, ml").eq("client_id", id).gte("log_date", daysAgoIso(6)),
    sb.from("body_metrics").select("metric_date, weight_kg").eq("client_id", id).order("metric_date"),
  ]);
  const { data: tpls } = await sb.from("workout_templates").select("*").order("name");
  const screen = hs?.[0] || null;
  if (!c) return render(`<div class="empty">Client not found.</div>`);
  const prog = await progressView(id, true);
  render(`<button class="back" onclick="location.hash='#/clients'">← Clients</button>
    <div class="card"><div class="row">${avatar(c, "lg")}<div class="grow"><h2 style="margin:0">${esc(c.full_name)}</h2>
      <div class="muted">${esc(c.goal || "No goal set")}</div></div><button class="small" onclick="location.hash='#/chat/${c.id}'">${ICON.chat} Chat</button></div>
      <div style="margin-top:10px">${(c.equipment || []).map((e) => `<span class="chip">${esc(e)}</span>`).join("") || `<span class="muted">Bodyweight only / not set</span>`}</div>
      ${c.weights_note ? `<p style="margin:10px 0 0"><span class="muted">Weights:</span> ${esc(c.weights_note)}</p>` : ""}</div>
    <form class="card" id="acc"><h3>Access & payment</h3><div class="grid2">
      <div><label>Plan</label><select name="plan">${[["free", "Workouts only"], ["library", "Library subscriber"], ["pt", "PT client"]].map(([k, l]) => `<option value="${k}" ${c.plan === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <div><label>Paid until</label><input name="until" type="date" value="${c.access_until || ""}"></div></div>
      <div style="margin-top:10px"><button type="button" class="small secondary" data-pass="7" data-plan="library" style="margin:0 6px 6px 0">7-day free trial</button>${CONFIG.OFFERS.filter((o) => o.days).map((o) => `<button type="button" class="small secondary" data-pass="${o.days}" data-plan="${o.key === "package" ? "pt" : "library"}" style="margin:0 6px 6px 0">${esc(o.title)}</button>`).join("")}</div>
      <p class="muted" style="margin:4px 0 0">A pass sets the plan and adds its days from today, or from the end of their current pass.</p>
      <button class="small" style="margin-top:10px">Update access</button>
      ${c.access_until && c.access_until < today() ? `<span class="chip warn">Expired ${fmtDate(c.access_until)}</span>` : ""}</form>
    ${healthCard(screen)}
    <div class="card" id="notes"><div class="row between"><h3>Private notes</h3><span class="muted">Only you see these</span></div>
      ${(notes || []).map((n) => `<div class="note"><p>${esc(n.body)}</p><div class="row between"><span class="muted">${fmtTime(n.created_at)}</span><button type="button" class="small ghost" data-nd="${n.id}">Delete</button></div></div>`).join("")}
      <form id="nf"><textarea name="b" maxlength="2000" required placeholder="Session notes, niggles, what they told you" aria-label="New note"></textarea><button class="small" style="margin-top:8px">Add note</button></form></div>
    ${aiBox([`Suggest next week's workouts for ${firstName(c)}`, `How is ${firstName(c)} progressing?`, `Draft a check-in message to ${firstName(c)}`, "How can I progress their main lifts safely?"])}
    ${c.photos_opt_in ? `<a class="card row between" href="#/photos/${c.id}" style="text-decoration:none;color:inherit"><div><h3 style="margin:0">Progress photos</h3><p class="muted" style="margin:2px 0 0">Before and after, week by week</p></div>${ICON.progress}</a>` : ""}
    ${checkinHistory((cks || []).filter((r) => r.energy != null))}
    ${(water || []).length ? `<div class="card"><h3>Water</h3>${waterWeekHtml(water, c.water_goal_ml || waterGoal({ weight: (metrics || []).filter((m) => m.weight_kg).pop()?.weight_kg }))}</div>` : ""}
    <div class="card"><div class="row between"><h3>Workouts</h3><button class="small" onclick="location.hash='#/builder/${c.id}'">+ New workout</button></div>
      ${(tpls || []).length ? `<form class="inline-assign" id="ia"><select id="iaT" aria-label="Saved workout">${tpls.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select>
        <input id="iaD" type="date" value="${today()}" aria-label="Date"><button class="small secondary">Assign</button></form>
        <p class="muted" style="margin:4px 0 8px">Assign one of your saved workouts. You can adjust ${esc(firstName(c))}'s copy straight after.</p>` : ""}
      ${(wos || []).map((w) => `<a class="list-item" href="#/builder/${c.id}/${w.id}"><div class="grow"><b>${esc(w.name)}</b>
        <div class="muted">${w.workout_items?.[0]?.count || 0} exercises${w.scheduled_date ? ", " + fmtDate(w.scheduled_date) : ""}${w.duration_seconds ? `, took ${Math.round(w.duration_seconds / 60)} min` : ""}${w.difficulty ? `, felt ${["very easy", "easy", "just right", "hard", "very hard"][w.difficulty - 1]}` : ""}${w.template_id ? `, from "${esc((tpls || []).find((t) => t.id === w.template_id)?.name || "a saved workout")}"` : ""}</div></div>
        ${w.completed_at ? `<span class="chip good">Done ${fmtDate(w.completed_at)}</span>` : `<span class="chip">Open</span>`}</a>
        ${w.client_feedback ? `<p class="muted fb-note">"${esc(w.client_feedback)}"</p>` : ""}
        ${(w.ex_notes || []).map((n) => `<p class="muted fb-note"><b>${esc(n.workout_items?.exercises?.name || "Exercise")}:</b> "${esc(n.note)}"</p>`).join("")}`).join("")
        || `<div class="empty">No workouts yet.</div>`}</div>
    ${prog.html}`);
  prog.after();
  bindAi(async () => clientContext(c, { logs: await loadLogs(id), wos, cks, screen, water, metrics }));
  $("#clearH")?.addEventListener("click", async () => {
    if (!confirm(`Confirm ${firstName(c)} is cleared to train? Only do this once you're satisfied it's safe, for example after a doctor's go-ahead.`)) return;
    const { error } = await sb.from("health_screens").update({ cleared_at: new Date().toISOString() }).eq("client_id", c.id);
    if (!fail(error)) { await sb.from("messages").insert({ client_id: c.id, sender_id: me.id, body: "I've reviewed your health check. You're cleared to train. Let's go!" }); toast("Marked as cleared"); trainerClient(id); }
  });
  $("#ia")?.addEventListener("submit", async (e) => {
    e.preventDefault(); const t = tpls.find((x) => x.id === $("#iaT").value); if (!t) return;
    const made = await assignTemplate(t, c.id, $("#iaD").value || today());
    if (made.length) { toast(`Assigned "${t.name}". Adjust it for ${firstName(c)} here, or go back.`); go(`builder/${c.id}/${made[0].id}`); }
  });
  $("#nf").onsubmit = async (e) => {
    e.preventDefault(); const body = e.target.b.value.trim(); if (!body) return;
    const { error } = await sb.from("coach_notes").insert({ trainer_id: me.id, client_id: c.id, body });
    if (!fail(error)) { toast("Note saved"); trainerClient(id); }
  };
  $$("[data-nd]").forEach((b) => (b.onclick = async () => {
    if (!confirm("Delete this note?")) return;
    const { error } = await sb.from("coach_notes").delete().eq("id", b.dataset.nd); if (!fail(error)) trainerClient(id);
  }));
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

const SECTIONS = [
  { key: "Warm-up", hint: "Get moving and switch on the right muscles.", match: ["Warm-up", "Mobility"], defaults: { target_sets: 1, target_reps: 10, rest_seconds: 15 } },
  { key: "Main set", hint: "The work for today.", match: ["Main set", "Finisher"], defaults: { target_sets: 3, target_reps: 10, rest_seconds: 60 } },
  { key: "Cool-down", hint: "Bring the heart rate down and stretch.", match: ["Cool-down", "Stretch", "Chill set", "Mobility"], defaults: { target_sets: 1, target_seconds: 30 } },
];
const sectionOf = (it) => (SECTIONS.some((s) => s.key === it.section) ? it.section : "Main set");

// ---------------------------------------------------------------- exercise library
const CATEGORIES = ["Strength", "Cardio", "Core", "Mobility", "Stretch", "Power", "Balance"];
const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const GOOD_FOR = ["Low impact", "Seated", "Balance", "Single side"];
const starterOf = (x) => STARTER.find((st) => st.name.toLowerCase() === (x.name || "").toLowerCase());
const levelOf = (x) => x.level || starterOf(x)?.level || "Beginner";
const tagsOf = (x) => (x.tags?.length ? x.tags : starterOf(x)?.tags || []);
const catOf = (x) => x.category || STARTER.find((st) => st.name.toLowerCase() === (x.name || "").toLowerCase())?.category
  || ({ Core: "Core", Cardio: "Cardio", Mobility: "Mobility" }[x.muscle_group]) || "Strength";
const starterRow = (x) => ({ trainer_id: me.id, name: x.name, category: x.category, muscle_group: x.muscle_group, equipment: x.equipment,
  instructions: x.instructions, cues: x.cues, categories: x.types, demo_move: x.demo || "none", level: x.level, tags: x.tags || [] });
const estMinutes = (its) => Math.max(5, Math.round((its || []).reduce((t, i) => {
  const sets = i.target_sets || 1; const work = i.target_seconds || (i.target_reps || 10) * 3; return t + sets * (work + (i.rest_seconds ?? 45));
}, 0) / 60));

// Her library; the first time it's empty, it starts with the animated starter pack.
async function myLibrary() {
  let { data } = await sb.from("exercises").select("*").eq("trainer_id", me.id).order("name");
  data = data || [];
  if (!data.length) {
    const { error } = await sb.from("exercises").insert(STARTER.map(starterRow));
    if (!error) {
      toast(`Your library is ready: ${STARTER.length} exercises with animated demos`);
      ({ data } = await sb.from("exercises").select("*").eq("trainer_id", me.id).order("name")); data = data || [];
    }
  }
  return data;
}

function filterBar(id, lib) {
  const muscles = MUSCLES.filter((m) => lib.some((x) => x.muscle_group === m));
  const kit = [...new Set(lib.flatMap((x) => x.equipment || []))].sort();
  return `<div class="fbar" id="${id}"><input type="search" data-f="q" placeholder="Search by name, muscle or equipment" aria-label="Search exercises">
    <div class="fsel"><select data-f="cat" aria-label="Category"><option value="">All categories</option>${CATEGORIES.filter((c) => lib.some((x) => catOf(x) === c)).map((c) => `<option>${c}</option>`).join("")}</select>
    <select data-f="mg" aria-label="Muscle group"><option value="">All muscles</option>${muscles.map((m) => `<option>${m}</option>`).join("")}</select>
    <select data-f="eq" aria-label="Equipment"><option value="">Any equipment</option><option value="none">Bodyweight only</option>${kit.map((e) => `<option>${esc(e)}</option>`).join("")}</select>
    <select data-f="lv" aria-label="Level"><option value="">Any level</option>${LEVELS.map((l) => `<option>${l}</option>`).join("")}</select>
    <select data-f="tg" aria-label="Good for"><option value="">Good for anyone</option>${GOOD_FOR.map((t) => `<option>${t}</option>`).join("")}<option value="video">Has a video</option></select></div></div>`;
}
function bindFilter(id, onChange) {
  const el = $("#" + id); const get = () => Object.fromEntries($$("[data-f]", el).map((i) => [i.dataset.f, i.value]));
  $$("[data-f]", el).forEach((i) => (i.oninput = () => onChange(get())));
  return get;
}
function exMatch(x, f) {
  const q = (f.q || "").toLowerCase();
  return (!q || [x.name, x.muscle_group, catOf(x), ...(x.equipment || [])].join(" ").toLowerCase().includes(q))
    && (!f.cat || catOf(x) === f.cat) && (!f.mg || x.muscle_group === f.mg)
    && (!f.eq || (f.eq === "none" ? !(x.equipment || []).length : (x.equipment || []).includes(f.eq)))
    && (!f.lv || levelOf(x) === f.lv) && (!f.tg || (f.tg === "video" ? !!(x.video_url || x.video_path) : tagsOf(x).includes(f.tg)));
}
function exCard(x, { urls = {}, attrs = "", tag = "a", href = "", extra = "" } = {}) {
  const mv = moveFor(x); const u = urls[x.video_path];
  const media = u ? `<video src="${esc(u)}#t=0.8" muted playsinline loop autoplay preload="metadata"></video>`
    : ytThumb(x) && !mv ? `<span class="ph yt"><img src="${esc(ytThumb(x))}" alt="" loading="lazy"><i aria-hidden="true"></i></span>`
    : mv ? moveSvg(mv, { label: false, props: (x.equipment || []).length > 0 }) : `<span class="ph">${forms(seedOf(x.name), { w: 200, h: 162, scale: 0.5 })}</span>`;
  const badges = `${x.video_url ? `<span class="chip good">Video</span>` : ""}<span class="chip">${levelOf(x)}</span>${tagsOf(x).slice(0, 2).map((t) => `<span class="chip">${esc(t)}</span>`).join("")}`;
  return `<${tag} class="ex-tile" ${href ? `href="${href}"` : ""} ${attrs}>${media}<b>${esc(x.name)}</b>
    <span>${esc([...new Set([catOf(x), x.muscle_group].filter(Boolean))].join(", "))}</span><span class="muted">${(x.equipment || []).map(esc).join(", ") || "Bodyweight"}</span><span class="ex-badges">${badges}</span>${extra}</${tag}>`;
}

async function trainerLibrary() {
  const all = await myLibrary();
  const urls = await signedMap(all);
  const have = new Set(all.map((x) => x.name.toLowerCase())); const missing = STARTER.filter((x) => !have.has(x.name.toLowerCase()));
  all.filter((x) => !x.category).forEach((x) => sb.from("exercises").update({ category: catOf(x) }).eq("id", x.id).then(() => {}));
  render(`<div class="row between"><h1>Exercises</h1><button class="small" onclick="location.hash='#/exercise/new'">${ICON.plus} Add exercise</button></div>
    <p class="muted">Every move with its demo, muscles, category, level, equipment and how-to. Tap one to edit it, paste a YouTube link, or upload your own video. Filter by "Good for" to find low-impact, seated or balance options for clients with different needs.</p>
    ${missing.length ? `<div class="card row between" style="gap:12px"><div><b>${missing.length} more starter ${missing.length === 1 ? "exercise" : "exercises"} available</b><div class="muted">Animated demos, instructions and cues included</div></div><button class="small" id="addStarter">Add</button></div>` : ""}
    ${filterBar("lf", all)}
    <p class="muted" id="lcount" style="margin:8px 0"></p>
    <div class="ex-grid" id="list"></div>
    <button class="block" style="margin-top:16px" onclick="location.hash='#/wb/new'">${ICON.plus} Create a workout</button>`);
  const draw = (f) => {
    const rows = all.filter((x) => exMatch(x, f));
    $("#lcount").textContent = `Showing ${rows.length} of ${all.length}`;
    $("#list").innerHTML = rows.map((x) => exCard(x, { urls, href: `#/exercise/${x.id}`,
      extra: `${x.reward_streak ? `<span class="chip good">Bonus ${x.reward_streak}d</span>` : ""}${!x.video_path && !x.video_url && !moveFor(x) ? `<span class="chip warn">Add a video link</span>` : ""}` })).join("")
      || `<div class="empty" style="grid-column:1/-1">No exercises match. Clear a filter or add your own.</div>`;
    startMoves($("#list"));
  };
  const get = bindFilter("lf", draw); draw(get());
  $("#addStarter")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget; btn.disabled = true; btn.textContent = "Adding…";
    const { error } = await sb.from("exercises").insert(missing.map(starterRow));
    if (!fail(error)) { toast(`${missing.length} exercises added`); trainerLibrary(); } else { btn.disabled = false; btn.textContent = "Try again"; }
  });
}

// Pick exercises with their animations playing. multi: keep adding until Done.
function openPicker(lib, { title, suggest = [], owned = null, onPick, multi = true }) {
  document.body.insertAdjacentHTML("beforeend", `<div class="picker" id="picker" role="dialog" aria-label="${esc(title)}"><div class="picker-box">
    <div class="row between"><h2 style="margin:0">${esc(title)}</h2><button type="button" class="small" id="pkDone">${multi ? "Done" : "Cancel"}</button></div>
    <div style="margin-top:10px">${filterBar("pf", lib)}</div>
    <details class="qa" id="qa"><summary>Not in the library? Add a new exercise</summary>
      <form id="qaF"><label for="qaN">Exercise name</label><input id="qaN" required maxlength="80" placeholder="e.g. Cossack squat">
        <div class="grid2"><div><label for="qaC">Category</label><select id="qaC">${CATEGORIES.map((c) => `<option>${c}</option>`).join("")}</select></div>
        <div><label for="qaM">Muscle group</label><select id="qaM">${MUSCLES.map((m) => `<option>${m}</option>`).join("")}</select></div></div>
        <label for="qaV">Video link <span class="muted">(optional: YouTube, Vimeo or any page)</span></label>
        <div class="row" style="gap:8px"><input id="qaV" type="url" inputmode="url" placeholder="Paste a link" style="flex:1;min-width:0"><a class="btn small secondary" id="qaY" href="https://www.youtube.com/" target="_blank" rel="noopener">Find on YouTube</a></div>
        <button class="block" style="margin-top:10px">Add to library${multi ? " and this workout" : " and use it"}</button>
        <p class="muted" style="margin:6px 0 0">You can add instructions, cues and equipment later in Exercises.</p></form></details>
    <p class="muted" id="pkN" style="margin:8px 0">${multi ? "Tap exercises to add them. Tap Done when you're finished." : "Tap the exercise to use instead."}</p>
    <div id="pkList"></div></div></div>`);
  let added = 0;
  const close = () => $("#picker")?.remove();
  const draw = (f) => {
    const rows = lib.filter((x) => exMatch(x, f));
    const plain = !f.q && !f.cat && !f.mg && !f.eq && !f.lv && !f.tg;
    const sug = plain ? rows.filter((x) => suggest.includes(x.id)) : [];
    const rest = rows.filter((x) => !sug.includes(x));
    const card = (x) => exCard(x, { tag: "button", attrs: `type="button" data-pick="${x.id}"`, extra: owned && missingEquipment(x, owned).length ? `<span class="chip warn">Needs kit</span>` : "" });
    $("#pkList").innerHTML = `${sug.length ? `<p class="muted">Suggested</p><div class="ex-grid">${sug.map(card).join("")}</div><p class="muted" style="margin-top:14px">Everything else</p>` : ""}
      <div class="ex-grid">${rest.map(card).join("")}</div>${rows.length ? "" : `<div class="empty">No exercises match.</div>`}`;
    startMoves($("#pkList"));
    $$("[data-pick]", $("#pkList")).forEach((b) => (b.onclick = () => {
      onPick(lib.find((x) => x.id === b.dataset.pick));
      if (!multi) return close();
      added++; b.classList.add("added"); $("#pkN").textContent = `${added} added. Tap more, or Done.`;
    }));
  };
  $("#pkDone").onclick = close;
  $("#picker").addEventListener("click", (e) => { if (e.target.id === "picker") close(); });
  const get = bindFilter("pf", draw); draw(get());
  $("#qaN").oninput = () => { $("#qaY").href = `https://www.youtube.com/results?search_query=${encodeURIComponent($("#qaN").value + " exercise how to")}`; };
  $("#qa").addEventListener("toggle", () => { if ($("#qa").open) { $("#qaN").value = $("#pf [data-f=q]").value; $("#qaN").oninput(); $("#qaN").focus(); } });
  $("#qaF").onsubmit = async (e) => {
    e.preventDefault(); const name = $("#qaN").value.trim(); if (!name) return;
    const raw = $("#qaV").value.trim(); const video_url = raw ? cleanUrl(raw) : null;
    if (raw && !video_url) return toast("That link doesn't look right. Copy it from the browser bar or the Share button.");
    if (lib.some((x) => x.name.toLowerCase() === name.toLowerCase())) return toast(`"${name}" is already in your library. Search for it above.`);
    const { data, error } = await sb.from("exercises").insert({ trainer_id: me.id, name, category: $("#qaC").value, muscle_group: $("#qaM").value,
      equipment: [], cues: [], video_url, demo_move: null, level: "Beginner", tags: [] }).select().single();
    if (fail(error)) return;
    lib.push(data); lib.sort((a, b) => a.name.localeCompare(b.name)); onPick(data);
    toast(`Added "${name}" to your library`);
    if (!multi) return close();
    added++; $("#pkN").textContent = `${added} added. Tap more, or Done.`; $("#qaF").reset(); $("#qa").open = false; draw(get());
  };
}

// Drag cards by their handle, on touch or mouse. onDrop runs once the card lands.
function sortable(root, onDrop) {
  $$(".drag", root).forEach((h) => {
    h.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      const card = h.closest(".build-item"); const r = card.getBoundingClientRect(); const dy = e.clientY - r.top;
      const ph = document.createElement("div"); ph.className = "build-ph"; ph.style.height = r.height + "px";
      card.after(ph); card.classList.add("dragging");
      Object.assign(card.style, { position: "fixed", left: r.left + "px", top: r.top + "px", width: r.width + "px", zIndex: 55 });
      h.setPointerCapture(e.pointerId);
      let scrollT = null;
      const move = (ev) => {
        card.style.top = ev.clientY - dy + "px";
        clearInterval(scrollT); const edge = 80;
        if (ev.clientY < edge || ev.clientY > innerHeight - edge) scrollT = setInterval(() => scrollBy(0, ev.clientY < edge ? -14 : 14), 16);
        card.style.visibility = "hidden"; const under = document.elementFromPoint(ev.clientX, ev.clientY); card.style.visibility = "";
        const other = under?.closest(".build-item:not(.dragging)"); const list = under?.closest(".build-list");
        if (other) { const o = other.getBoundingClientRect(); if (ev.clientY < o.top + o.height / 2) other.before(ph); else other.after(ph); }
        else if (list && !list.contains(ph)) { list.querySelector(".drop-hint")?.remove(); list.append(ph); }
      };
      const up = () => {
        clearInterval(scrollT);
        h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up);
        ph.replaceWith(card); card.classList.remove("dragging"); card.removeAttribute("style"); onDrop();
      };
      h.addEventListener("pointermove", move); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
    });
  });
}

const stripItem = (i) => ({ exercise_id: i.exercise_id, section: i.section, target_sets: i.target_sets ?? null, target_reps: i.target_reps ?? null,
  target_weight_kg: i.target_weight_kg ?? null, target_seconds: i.target_seconds ?? null, rest_seconds: i.rest_seconds ?? null, notes: i.notes || null });

// One builder for saved workouts (kind "template") and a client's own copy (kind "client").
async function builder({ kind, id, clientId }) {
  const isTpl = kind === "template";
  const [lib, cRes, wRes, { data: templates }] = await Promise.all([
    myLibrary(),
    clientId ? sb.from("profiles").select("*").eq("id", clientId).single() : Promise.resolve({ data: null }),
    id ? (isTpl ? sb.from("workout_templates").select("*").eq("id", id).single() : sb.from("workouts").select("*, workout_items(*)").eq("id", id).single()) : Promise.resolve({ data: null }),
    sb.from("workout_templates").select("*").order("name"),
  ]);
  const [{ data: folders0 }, { data: myClients }] = await Promise.all([sb.from("workout_folders").select("*").order("name"),
    isTpl ? sb.from("profiles").select("id, full_name").eq("trainer_id", me.id).order("full_name") : Promise.resolve({ data: [] })]);
  let folders = folders0 || [];
  const c = cRes.data, w = wRes.data;
  const cNotes = {};
  if (!isTpl && w?.workout_items?.length) { const { data: ns } = await sb.from("item_notes").select("workout_item_id,note").in("workout_item_id", w.workout_items.map((i) => i.id)); (ns || []).forEach((n) => (cNotes[n.workout_item_id] = n.note)); }
  if ((id && !w) || (!isTpl && !c)) return render(`<div class="empty">Workout not found.</div>`);
  let items = (isTpl ? (w?.items || []) : (w?.workout_items || []).sort((a, b) => a.position - b.position)).map((i) => ({ ...i, section: sectionOf(i) }));
  let fromTpl = !isTpl ? w?.template_id || null : null;
  const pendingFolder = isTpl && !w ? (sessionStorage.getItem("or-new-folder") || "") : ""; sessionStorage.removeItem("or-new-folder");
  const src = fromTpl ? (templates || []).find((t) => t.id === fromTpl) : null;
  const exOf = (it) => lib.find((x) => x.id === it.exercise_id) || { name: "Removed exercise", equipment: [], muscle_group: "" };
  const owned = c?.equipment || null;
  const who = c ? firstName(c) : "";
  const back = isTpl ? "#/workouts" : `#/client/${clientId}`;

  const FIELDS = [["target_sets", "Sets", "numeric"], ["target_reps", "Reps", "numeric"], ["target_seconds", "Secs", "numeric"], ["rest_seconds", "Rest s", "numeric"], ["target_weight_kg", "kg", "decimal"]];
  const itemHtml = (it, i, n) => {
    const ex = exOf(it); const mv = moveFor(ex); const need = owned ? missingEquipment(ex, owned) : [];
    return `<div class="card build-item" data-i="${i}">
      <div class="row" style="gap:10px;align-items:center">
        <button type="button" class="drag" aria-label="Drag to reorder ${esc(ex.name)}. Arrow keys move it.">${ICON.grip}</button>
        <span class="thumb">${mv ? moveSvg(mv, { label: false, props: (ex.equipment || []).length > 0 }) : ""}</span>
        <div class="grow"><b>${n}. ${esc(ex.name)}</b><div class="muted">${esc([...new Set([catOf(ex), ex.muscle_group].filter(Boolean))].join(", "))}${need.length ? `, <span style="color:var(--warn)">needs ${esc(need.join(", "))}</span>` : ""}</div></div></div>
      ${owned && need.length ? swapHtml(swapSuggestions(ex, lib, owned)) : ""}
      <div class="grid5">${FIELDS.map(([k, l, m]) => `<div><label>${l}</label><input data-k="${k}" type="number" inputmode="${m}" step="any" min="0" value="${it[k] ?? ""}" aria-label="${l}"></div>`).join("")}</div>
      ${it.id && cNotes[it.id] ? `<p class="fb-note client-said"><b>${esc(who)} said:</b> "${esc(cNotes[it.id])}"</p>` : ""}
      <label>Note for this exercise</label><input data-k="notes" value="${esc(it.notes)}" placeholder="e.g. Slow on the way down">
      <div class="row" style="gap:8px;margin-top:10px"><button type="button" class="small secondary" data-rep="${i}">Replace</button><button type="button" class="small ghost" data-rm="${i}">Remove</button></div></div>`;
  };
  const reorder = () => { items = $$(".build-list").flatMap((l) => $$(".build-item", l).map((el) => ({ ...items[+el.dataset.i], section: l.dataset.sec }))); draw(); };
  const draw = () => {
    $("#sections").innerHTML = SECTIONS.map((sec) => {
      const list = items.map((it, i) => [it, i]).filter(([it]) => it.section === sec.key);
      return `<section class="build-sec"><div class="sec"><h2>${sec.key}</h2><span class="muted">${list.length} ${list.length === 1 ? "exercise" : "exercises"}</span></div>
        <div class="build-list" data-sec="${sec.key}">${list.map(([it, i], n) => itemHtml(it, i, n + 1)).join("") || `<p class="muted drop-hint">${sec.hint} Add exercises, or drag one here.</p>`}</div>
        <button type="button" class="secondary block" data-add="${sec.key}">${ICON.plus} Add to ${sec.key.toLowerCase()}</button></section>`;
    }).join("");
    startMoves($("#sections")); builderDraft?.();
    $("#sum").textContent = items.length ? `${items.length} ${items.length === 1 ? "exercise" : "exercises"}, about ${estMinutes(items)} minutes` : "No exercises yet. Add some to each section below.";
    $$("#sections [data-k]").forEach((inp) => (inp.oninput = () => {
      const i = inp.closest("[data-i]").dataset.i; const k = inp.dataset.k;
      items[i][k] = k === "notes" ? inp.value : num(inp.value);
      $("#sum").textContent = `${items.length} ${items.length === 1 ? "exercise" : "exercises"}, about ${estMinutes(items)} minutes`;
    }));
    $$("[data-rm]").forEach((b) => (b.onclick = () => { const ex = exOf(items[+b.dataset.rm]); items.splice(+b.dataset.rm, 1); draw(); toast(`Removed ${ex.name}`); }));
    $$("[data-rep]").forEach((b) => (b.onclick = () => {
      const i = +b.dataset.rep; const cur = exOf(items[i]);
      openPicker(lib, { title: `Replace ${cur.name}`, multi: false, owned,
        suggest: lib.filter((x) => x.id !== cur.id && (x.muscle_group === cur.muscle_group || moveFor(x) === moveFor(cur))).map((x) => x.id),
        onPick: (x) => { const { id: _drop, ...rest } = items[i]; items[i] = { ...rest, exercise_id: x.id }; draw(); toast(`Swapped in ${x.name}`); } });
    }));
    $$("[data-add]").forEach((b) => (b.onclick = () => {
      const sec = SECTIONS.find((x) => x.key === b.dataset.add);
      openPicker(lib, { title: `Add to ${sec.key.toLowerCase()}`, owned, suggest: lib.filter((x) => typesOf(x).some((t) => sec.match.includes(t))).map((x) => x.id),
        onPick: (x) => { items.push({ exercise_id: x.id, section: sec.key, ...sec.defaults }); draw(); } });
    }));
    sortable($("#sections"), reorder);
    $$("#sections .drag").forEach((h) => (h.onkeydown = (e) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return; e.preventDefault();
      const order = SECTIONS.flatMap((sec) => items.filter((it) => it.section === sec.key));
      const it = items[+h.closest("[data-i]").dataset.i]; const k = order.indexOf(it); const j = k + (e.key === "ArrowUp" ? -1 : 1);
      if (j < 0 || j >= order.length) return;
      it.section = order[j].section; [order[k], order[j]] = [order[j], order[k]]; items = order; draw();
      $$("#sections .build-item").find((el) => items[+el.dataset.i] === it)?.querySelector(".drag").focus();
    }));
  };

  render(`<button class="back" onclick="location.hash='${back}'">${isTpl ? "Back to workouts" : `Back to ${esc(c.full_name)}`}</button>
    <h1>${isTpl ? (w ? "Edit workout" : "Create workout") : `${w ? "Edit" : "New"} workout for ${esc(who)}`}</h1>
    ${src ? `<p class="muted">Based on your saved workout "${esc(src.name)}". Changes here only change ${esc(who)}'s copy, not the saved workout or anyone else's.</p>` : ""}
    ${isTpl && w ? `<p class="muted">Changes here update the saved workout. Workouts you've already given to clients stay as they are.</p>` : ""}
    <div id="draftBar"></div>
    <form id="wf" novalidate><div class="card">
      ${!w && (templates || []).length ? `<label for="tpl">Start from a saved workout</label><select id="tpl"><option value="">Start blank</option>${templates.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select>` : ""}
      <label for="wn">Workout name</label><input id="wn" name="name" required maxlength="120" value="${esc(w?.name || "")}" placeholder="e.g. Upper body, Glute focus, Full body, Core">
      ${isTpl ? `<label for="wfo">Save in</label><select id="wfo" name="folder">${folderOptions(folders, w?.folder_id || pendingFolder || "", !w ? myClients : [])}</select>
        <p class="muted" id="wfoHint" style="margin:4px 0 0"></p>`
        : `<div class="grid2"><div><label for="wd">Date</label><input id="wd" name="date" type="date" value="${w?.scheduled_date || today()}"></div><div></div></div>
        <p class="muted" style="margin:4px 0 0">Saves in ${esc(who)}'s folder.</p>`}
      <label for="wno">Notes for the whole workout</label><textarea id="wno" name="notes" placeholder="Focus for today, how it should feel">${esc(w?.notes || "")}</textarea>
      ${c ? `<p class="muted" style="margin-top:8px">${esc(who)}'s equipment: ${(c.equipment || []).map(esc).join(", ") || "not set"}${c.weights_note ? `. Weights: ${esc(c.weights_note)}` : ""}</p>` : ""}
      <p class="muted" id="sum" style="margin:8px 0 0"></p></div>
    <p class="muted" style="margin:4px 0 0">Drag ${ICON.grip.replace("<svg", '<svg style="width:14px;height:14px;vertical-align:-2px"')} to reorder, including between sections.</p>
    <div id="sections"></div>
    <div class="card build-bar"><button class="block" id="save">${isTpl ? (w ? "Save changes" : "Save to my workouts") : `Save ${esc(who)}'s workout`}</button>
      <div class="grid2" style="margin-top:10px"><button type="button" class="secondary" id="saveNew">${isTpl ? (w ? "Save as a new workout" : "Save and assign") : "Also save to my workouts"}</button>
      ${w ? `<button type="button" class="danger" id="del">Delete</button>` : `<button type="button" class="ghost" onclick="location.hash='${back}'">Cancel</button>`}</div></div></form>`);
  // ---------- folder choice
  const folderValue = () => { const v = $("#wfo")?.value || ""; return v && !v.startsWith("client:") && v !== "__new" ? v : null; };
  const toClient = () => { const v = $("#wfo")?.value || ""; return v.startsWith("client:") ? v.slice(7) : null; };
  const folderHint = () => { const h = $("#wfoHint"); if (!h) return; const cid = toClient();
    h.innerHTML = cid ? `Saves as ${esc(firstName((myClients || []).find((x) => x.id === cid) || {}))}'s own workout, without a date. <label class="check" style="margin-top:6px"><input type="checkbox" id="keepMaster"><span>Also keep a master copy in my library</span></label>`
      : "Master workout: assign it to clients from here or the library. Their copies can be changed without touching this one."; };
  $("#wfo")?.addEventListener("change", async (e) => {
    if (e.target.value === "__new") {
      const name = (prompt("Name the new folder, e.g. Glute programmes") || "").trim().slice(0, 60);
      if (!name) { e.target.value = folderValue() || ""; return; }
      const { data, error } = await sb.from("workout_folders").insert({ trainer_id: me.id, name }).select().single();
      if (fail(error)) { e.target.value = ""; return; }
      folders = [...folders, data].sort((a, b) => a.name.localeCompare(b.name));
      e.target.innerHTML = folderOptions(folders, data.id, !w ? myClients : []); toast(`Folder "${name}" created`);
    }
    folderHint(); saveDraftSoon();
  });
  folderHint();

  // ---------- draft: saved on this phone as you build, so a refresh or a slip of the thumb loses nothing
  const dKey = `or-draft-${me.id}-${isTpl ? "t" : "c"}-${id || "new"}-${clientId || ""}`;
  const snapshot = () => { const f = $("#wf"); return { name: f.name.value, notes: f.notes.value, date: f.date?.value || null, folder: $("#wfo")?.value || "", items, fromTpl, at: Date.now() }; };
  const original = JSON.stringify({ name: w?.name || "", notes: w?.notes || "", items: items.map(stripItem) });
  // written straight away (it's tiny), so even leaving mid-word keeps everything
  const saveDraftSoon = () => { if (!$("#wf")) return; try {
    const s2 = snapshot(); if (JSON.stringify({ name: s2.name, notes: s2.notes || "", items: s2.items.map(stripItem) }) === original) return localStorage.removeItem(dKey);
    localStorage.setItem(dKey, JSON.stringify(s2)); } catch {} };
  const clearDraft = () => { builderDraft = null; try { localStorage.removeItem(dKey); } catch {} };
  builderDraft = saveDraftSoon;
  $("#wf").addEventListener("input", saveDraftSoon); $("#wf").addEventListener("change", saveDraftSoon);
  let draft = null; try { draft = JSON.parse(localStorage.getItem(dKey) || "null"); } catch {}
  if (draft && draft.items) {
    const when = new Date(draft.at).toLocaleString("en-ZA", { weekday: "short", hour: "2-digit", minute: "2-digit" });
    $("#draftBar").innerHTML = `<div class="card nudge draft"><b>Unsaved changes from ${esc(when)}</b><p class="muted" style="margin:2px 0 8px">${esc(draft.name || "Untitled workout")}, ${draft.items.length} ${draft.items.length === 1 ? "exercise" : "exercises"}.</p>
      <div class="row" style="gap:8px"><button type="button" class="small" id="drUse">Restore</button><button type="button" class="small ghost" id="drNo">Discard</button></div></div>`;
    $("#drUse").onclick = () => { const f = $("#wf"); items = draft.items.filter((i) => lib.some((x) => x.id === i.exercise_id)); fromTpl = draft.fromTpl || fromTpl;
      f.name.value = draft.name || ""; f.notes.value = draft.notes || ""; if (f.date && draft.date) f.date.value = draft.date;
      if ($("#wfo") && draft.folder && [...$("#wfo").options].some((o) => o.value === draft.folder)) $("#wfo").value = draft.folder; folderHint();
      $("#draftBar").innerHTML = ""; draw(); toast("Draft restored"); };
    $("#drNo").onclick = () => { clearDraft(); $("#draftBar").innerHTML = ""; };
  }
  draw();

  $("#tpl")?.addEventListener("change", (e) => {
    const t = templates.find((x) => x.id === e.target.value); if (!t) { fromTpl = null; return; }
    items = (t.items || []).filter((i) => lib.some((x) => x.id === i.exercise_id)).map((i) => ({ ...i, section: sectionOf(i) }));
    fromTpl = t.id; const f = $("#wf"); f.name.value = t.name; if (t.notes) f.notes.value = t.notes;
    draw(); toast(isTpl ? `Copied "${t.name}". Save it under a new name.` : `Loaded "${t.name}". Adjust it for ${who}, then save.`);
  });
  const ordered = () => SECTIONS.flatMap((sec) => items.filter((it) => it.section === sec.key));
  const check = () => {
    const f = $("#wf"); $$("#wf .bad").forEach((x) => x.classList.remove("bad"));
    const stop = (el, msg) => { el?.classList.add("bad"); el?.scrollIntoView({ block: "center", behavior: "smooth" }); el?.focus?.({ preventScroll: true }); toast(msg); return false; };
    if (!f.name.value.trim()) return stop(f.name, "Give the workout a name at the top. Your exercises are still here.");
    if (!items.length) return stop($("#sections [data-add]"), "Add at least one exercise, then save.");
    const WHOLE = { target_sets: "Sets", target_reps: "Reps", target_seconds: "Secs", rest_seconds: "Rest" };
    const list = ordered();
    for (let n = 0; n < list.length; n++) {
      const it = list[n]; const i = items.indexOf(it); const card = $(`#sections .build-item[data-i="${i}"]`);
      for (const [k, label] of Object.entries(WHOLE)) {
        const v = it[k]; if (v == null) continue;
        if (!Number.isFinite(v) || v < 0 || !Number.isInteger(v)) return stop(card?.querySelector(`[data-k="${k}"]`) || card, `Exercise ${n + 1} (${exOf(it).name}): ${label} must be a whole number, like 10.`);
      }
      const kg = it.target_weight_kg; if (kg != null && (!Number.isFinite(kg) || kg < 0 || kg > 500)) return stop(card?.querySelector('[data-k="target_weight_kg"]') || card, `Exercise ${n + 1} (${exOf(it).name}): check the kg.`);
    }
    // a box the phone could not read (e.g. "10-12" typed into a number box)
    const unread = $$("#sections input[type=number]").find((x) => x.validity.badInput);
    if (unread) return stop(unread, "One number box has something it can't read. Use a single number, e.g. 10, and put ranges like 8-12 in the exercise note.");
    return true;
  };
  const saveTemplate = async (name, existingId) => {
    const f = $("#wf"); const row = { trainer_id: me.id, name: name.trim().slice(0, 120), notes: f.notes.value || null, items: ordered().map(stripItem), folder_id: folderValue() };
    const { data, error } = existingId ? await sb.from("workout_templates").update(row).eq("id", existingId).select().single()
      : await sb.from("workout_templates").insert(row).select().single();
    return fail(error) ? null : data;
  };
  $("#wf").onsubmit = async (e) => {
    e.preventDefault(); if (!check()) return; const f = e.target; const btn = $("#save"); btn.disabled = true;
    if (isTpl && toClient()) {
      const cid = toClient(); const cl = (myClients || []).find((x) => x.id === cid);
      if ($("#keepMaster")?.checked) { const t = await saveTemplate(f.name.value); if (!t) { btn.disabled = false; return; } }
      const ws = await saveClientCopy({ name: f.name.value, notes: f.notes.value, items: ordered() }, cid);
      btn.disabled = false; if (!ws) return; clearDraft();
      toast(`Saved in ${cl ? firstName(cl) : "the client"}'s folder`); return go("cfolder/" + cid);
    }
    if (isTpl) {
      const t = await saveTemplate(f.name.value, w?.id); btn.disabled = false; if (!t) return;
      clearDraft(); toast(w ? "Changes saved" : "Saved to your workouts"); return go(t.folder_id ? "folder/" + t.folder_id : "workouts");
    }
    const list = ordered();
    const row = { trainer_id: me.id, client_id: clientId, name: f.name.value.trim(), scheduled_date: f.date.value || null, notes: f.notes.value || null, template_id: fromTpl };
    const { data: saved, error } = w ? await sb.from("workouts").update(row).eq("id", w.id).select().single() : await sb.from("workouts").insert(row).select().single();
    if (fail(error)) { btn.disabled = false; return; }
    // Keep existing items (so logged sets stay linked), update or add the rest, remove dropped ones
    const keepIds = list.filter((i) => i.id).map((i) => i.id);
    const dropped = (w?.workout_items || []).filter((i) => !keepIds.includes(i.id)).map((i) => i.id);
    if (dropped.length) { const { error: de } = await sb.from("workout_items").delete().in("id", dropped); if (fail(de)) { btn.disabled = false; return; } }
    const payload = list.map((i, pos) => { const r = { ...stripItem(i), workout_id: saved.id, position: pos }; if (i.id) r.id = i.id; return r; });
    const existing = payload.filter((x) => x.id), fresh = payload.filter((x) => !x.id);
    if (existing.length) { const { error: ue } = await sb.from("workout_items").upsert(existing); if (fail(ue)) { btn.disabled = false; return; } }
    if (fresh.length) { const { error: ie } = await sb.from("workout_items").insert(fresh);
      if (ie) { if (!w) await sb.from("workouts").delete().eq("id", saved.id); fail(ie); btn.disabled = false; toast("Couldn't save the exercises. Nothing was lost on this screen: try Save again."); return; } }
    if (!w && clientId !== me.id) await sb.from("messages").insert({ client_id: clientId, sender_id: me.id, body: `New workout ready: "${saved.name}"` });
    clearDraft(); toast(`Saved ${who}'s workout`); go("client/" + clientId);
  };
  $("#saveNew").onclick = async () => {
    if (!check()) return;
    if (isTpl && w) {
      const name = prompt("Name for the new workout", `${$("#wf").name.value} (v2)`); if (!name) return;
      const t = await saveTemplate(name); if (t) { clearDraft(); toast(`Saved "${t.name}" as a new workout`); go("wb/" + t.id); }
    } else if (isTpl) {
      const t = await saveTemplate($("#wf").name.value); if (t) { clearDraft(); history.replaceState(null, "", "#/wb/" + t.id); toast("Saved to your workouts. Now choose who gets it."); go("assign/" + t.id); }
    } else {
      const t = await saveTemplate($("#wf").name.value); if (t) toast(`Saved "${t.name}" to your workouts, ready for other clients`);
    }
  };
  $("#del")?.addEventListener("click", async () => {
    if (isTpl) {
      if (!confirm(`Delete "${w.name}" from your workouts? Workouts already given to clients stay.`)) return;
      const { error } = await sb.from("workout_templates").delete().eq("id", w.id); if (!fail(error)) { toast("Deleted"); go("workouts"); }
    } else {
      if (!confirm(`Delete this workout from ${who}'s programme, with any sets they logged in it?`)) return;
      const { error } = await sb.from("workouts").delete().eq("id", w.id); if (!fail(error)) go("client/" + clientId);
    }
  });
}

async function exerciseEditor(id) {
  const isNew = id === "new";
  const ex = isNew ? { name: "", muscle_group: "Full body", equipment: [], cues: [], instructions: "", categories: [] }
    : (await sb.from("exercises").select("*").eq("id", id).single()).data;
  if (!ex) return render(`<div class="empty">Exercise not found.</div>`);
  const [{ data: allTypes }, lib] = await Promise.all([sb.from("exercises").select("categories").eq("trainer_id", me.id), myLibrary()]);
  const customTypes = [...new Set((allTypes || []).flatMap(typesOf))].filter((t) => !TYPES.includes(t)).sort();
  const url = await videoUrl(ex.video_path);
  render(`<button class="back" onclick="location.hash='#/library'">← Exercises</button>
    <h1>${isNew ? "New exercise" : esc(ex.name)}</h1>
    <form id="ef" class="card">
      <label>Name</label><input name="name" required value="${esc(ex.name)}" placeholder="e.g. Goblet squat">
      <div class="grid2"><div><label>Category</label><select name="cat">${CATEGORIES.map((c) => `<option ${c === catOf(ex) ? "selected" : ""}>${c}</option>`).join("")}</select></div>
      <div><label>Muscle group</label><select name="mg">${MUSCLES.map((m) => `<option ${m === ex.muscle_group ? "selected" : ""}>${m}</option>`).join("")}</select></div></div>
      <div class="grid2"><div><label>Level</label><select name="lv">${LEVELS.map((l) => `<option ${l === levelOf(ex) ? "selected" : ""}>${l}</option>`).join("")}</select></div><div></div></div>
      <label>Good for <span class="muted">(helps you find options for clients with different needs)</span></label>
      <div id="gf">${GOOD_FOR.map((t) => `<span class="chip ${tagsOf(ex).includes(t) ? "on" : ""}" data-g="${t}" role="button">${t}</span>`).join("")}</div>
      <label>Equipment needed <span class="muted">(none = bodyweight)</span></label>
      <div id="eq">${EQUIPMENT.filter((e) => e !== "Full gym").map((e) => `<span class="chip ${ex.equipment.includes(e) ? "on" : ""}" data-e="${esc(e)}" role="button">${esc(e)}</span>`).join("")}</div>
      <label>Type <span class="muted">(pick any that fit)</span></label>
      <div id="ty">${[...new Set([...TYPES, ...customTypes, ...typesOf(ex)])].map((t) => `<span class="chip ${typesOf(ex).includes(t) ? "on" : ""}" data-t="${esc(t)}" role="button">${esc(t)}</span>`).join("")}</div>
      <div class="row" style="margin-top:8px"><input id="tyNew" maxlength="30" placeholder="Add your own, e.g. Glute focus" aria-label="New type"><button type="button" class="small secondary" id="tyAdd">Add</button></div>
      <label for="rw">Bonus video for streaks</label>
      <select name="rw" id="rw">${[["", "No, part of the normal library"], ["7", "Unlocks at a 7-day streak"], ["14", "Unlocks at a 14-day streak"], ["30", "Unlocks at a 30-day streak"]]
        .map(([v, l]) => `<option value="${v}" ${String(ex.reward_streak ?? "") === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      <p class="muted">Bonus videos are free rewards. Clients can't see them until their streak gets there.</p>
      <label for="dm">Animated demo <span class="muted">(shown until you upload a video)</span></label>
      <select id="dm" name="dm">${[["", "Match automatically from the name"], ...Object.entries(MOVES).map(([k, m]) => [k, m.label]), ["none", "No animation"]]
        .map(([v, l]) => `<option value="${v}" ${(ex.demo_move || "") === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>
      <label for="mo">Demo model</label><select id="mo" name="mo">${[["female", "Female"], ["male", "Male"]].map(([v, l]) => `<option value="${v}" ${(ex.model || "female") === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      <div id="dmPrev" class="dm-prev"></div>
      <label>Muscles worked <span class="muted">(tap once for a main muscle, twice for a supporting muscle, again to clear. Leave blank to use the animation's muscles)</span></label>
      <div id="mu">${Object.entries(MUSCLE_NAMES).map(([k, n]) => { const st = (ex.muscles || []).includes(k) ? "p" : (ex.muscles2 || []).includes(k) ? "s" : "";
        return `<span class="chip mchip ${st}" data-m="${k}" data-st="${st}" role="button" aria-label="${n}${st === "p" ? ", main" : st === "s" ? ", supporting" : ""}">${n}</span>`; }).join("")}</div>
      <p class="muted" style="margin:4px 0 0"><span class="mm-dot p"></span>Main <span class="mm-dot s" style="margin-left:10px"></span>Supporting</p>
      <div id="muPrev"></div>
      <label for="vu">Video link <span class="muted">(YouTube, Vimeo or Instagram. Clients see it instead of the animation)</span></label>
      <div class="row" style="gap:8px"><input id="vu" name="vu" type="url" inputmode="url" placeholder="Paste a YouTube link" value="${esc(ex.video_url || "")}" style="flex:1;min-width:0">
        <a class="btn small secondary" id="ytFind" target="_blank" rel="noopener" href="#">Find on YouTube</a></div>
      <p class="muted" style="margin:4px 0 0">On YouTube, tap Share, then Copy link, and paste it here. Only link videos you're happy to recommend.</p>
      <div id="vuPrev"></div>
      <label>Or upload your own video</label>
      ${url ? `<video src="${esc(url)}" controls playsinline style="width:100%;border-radius:10px;max-height:260px"></video>` : ""}
      <input type="file" name="video" accept="video/*">
      <p class="muted">Tip: film landscape or square, 10–20 seconds, side-on angle, max 100 MB.</p>
      <label>How to (setup & steps)</label><textarea name="ins">${esc(ex.instructions)}</textarea>
      <h3 style="margin:16px 0 4px">Easier, harder and modifications</h3>
      <p class="muted" style="margin:0 0 6px">Clients see these under the exercise. Link another exercise from your library, add a short note, or both.</p>
      <div class="grid2"><div><label for="ezId">Easier option</label><select id="ezId" name="ezId">${exOptions(lib, ex.easier_id, id)}</select></div>
        <div><label for="hzId">Harder option</label><select id="hzId" name="hzId">${exOptions(lib, ex.harder_id, id)}</select></div></div>
      <div class="grid2"><div><input name="ez" maxlength="500" placeholder="e.g. Hands on a bench" aria-label="Easier option note" value="${esc(ex.easier || "")}"></div>
        <div><input name="hz" maxlength="500" placeholder="e.g. Add a 2-second pause" aria-label="Harder option note" value="${esc(ex.harder || "")}"></div></div>
      <label for="mods">Modifications <span class="muted">(injuries, pregnancy, no equipment)</span></label>
      <textarea id="mods" name="mods" maxlength="1000" placeholder="e.g. Sore knees: reduce depth. No bench: use a sturdy chair.">${esc(ex.modifications || "")}</textarea>
      <div class="row between" style="margin-top:10px"><label style="margin:0">Coaching cues <span class="muted">(one per line)</span></label>
        <button type="button" class="small secondary" id="ai">Draft with AI</button></div>
      <textarea name="cues" style="min-height:120px" placeholder="Keep your back flat&#10;Drive through your heels">${esc((ex.cues || []).join("\n"))}</textarea>
      <p class="muted">AI drafts are a starting point — check and edit before saving. Clients only see what you save.</p>
      <button class="block" style="margin-top:12px" id="save">Save to library</button>
      ${isNew ? "" : `<button type="button" class="block danger" style="margin-top:8px" id="del">Delete exercise</button>`}
    </form>`);
  $$("#eq .chip, #ty .chip, #gf .chip").forEach((c) => (c.onclick = () => c.classList.toggle("on")));
  const ytHref = () => ($("#ytFind").href = `https://www.youtube.com/results?search_query=${encodeURIComponent(($("#ef").name.value || "exercise") + " exercise how to")}`);
  const vuPrev = () => { const v = $("#vu").value.trim(); $("#vuPrev").innerHTML = v && cleanUrl(v) ? linkHtml(v, "Preview") : v ? `<p class="muted" style="color:var(--warn)">That link doesn't look right.</p>` : ""; };
  $("#ef").name.addEventListener("input", ytHref); ytHref();
  $("#vu").addEventListener("change", vuPrev); vuPrev();
  $("#tyAdd").onclick = () => {
    const v = $("#tyNew").value.trim().replace(/\s+/g, " "); if (!v) return;
    const name = v[0].toUpperCase() + v.slice(1);
    const existing = $$("#ty .chip").find((c) => c.dataset.t.toLowerCase() === name.toLowerCase());
    if (existing) { existing.classList.add("on"); } else {
      $("#ty").insertAdjacentHTML("beforeend", `<span class="chip on" data-t="${esc(name)}" role="button">${esc(name)}</span>`);
      const chip = $("#ty").lastElementChild; chip.onclick = () => chip.classList.toggle("on");
    }
    $("#tyNew").value = "";
  };
  $("#tyNew").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("#tyAdd").click(); } });
  const preview = () => {
    const f = $("#ef"); const mv = moveFor({ name: f.name.value, demo_move: f.dm.value || null });
    const own = $$("#mu .chip.p").map((c) => c.dataset.m);
    $("#dmPrev").innerHTML = mv ? moveSvg(mv, { label: false, big: true, props: $$("#eq .chip.on").length > 0, model: f.mo.value, muscles: own.length ? [own, $$("#mu .chip.s").map((c) => c.dataset.m)] : null }) + `<p class="muted" style="margin:6px 0 0">${esc(MOVES[mv].label)}${f.dm.value ? "" : ", matched from the name"}</p>`
      : `<p class="muted" style="margin:0">No animation. Choose one above, or upload a video.</p>`;
    startMoves($("#dmPrev"));
    const picked = $$("#mu .chip.p").map((c) => c.dataset.m), picked2 = $$("#mu .chip.s").map((c) => c.dataset.m);
    $("#muPrev").innerHTML = musclesHtml({ name: f.name.value, demo_move: f.dm.value || null, muscle_group: f.mg.value, muscles: picked, muscles2: picked2, model: f.mo.value }) || `<p class="muted">Pick the muscles, or choose an animation above.</p>`;
  };
  $$("#mu .chip").forEach((c) => (c.onclick = () => { const nx = { "": "p", p: "s", s: "" }[c.dataset.st || ""]; c.dataset.st = nx; c.classList.remove("p", "s"); if (nx) c.classList.add(nx);
    c.setAttribute("aria-label", c.textContent + (nx === "p" ? ", main" : nx === "s" ? ", supporting" : "")); preview(); }));
  $("#ef").mo.onchange = preview;
  $("#dm").onchange = preview; $("#ef").name.addEventListener("input", preview); $$("#eq .chip").forEach((c) => c.addEventListener("click", preview)); preview();
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
    const row = { trainer_id: me.id, name: f.name.value.trim(), category: f.cat.value, muscle_group: f.mg.value, equipment: $$("#eq .chip.on").map((c) => c.dataset.e),
      instructions: f.ins.value || null, cues: f.cues.value.split("\n").map((s) => s.trim()).filter(Boolean), video_path,
      reward_streak: f.rw.value ? Number(f.rw.value) : null, categories: $$("#ty .chip.on").map((c) => c.dataset.t), demo_move: f.dm.value || null,
      level: f.lv.value, tags: $$("#gf .chip.on").map((c) => c.dataset.g), video_url: f.vu.value.trim() ? cleanUrl(f.vu.value) : null,
      muscles: $$("#mu .chip.p").map((c) => c.dataset.m), muscles2: $$("#mu .chip.s").map((c) => c.dataset.m), model: f.mo.value,
      easier: f.ez.value.trim() || null, harder: f.hz.value.trim() || null, modifications: f.mods.value.trim() || null, easier_id: f.ezId.value || null, harder_id: f.hzId.value || null };
    if (!row.muscles.length) { row.muscles = null; row.muscles2 = row.muscles2.length ? row.muscles2 : null; }
    if (row.muscles2 && !row.muscles2.length) row.muscles2 = null;
    if (f.vu.value.trim() && !row.video_url) { btn.disabled = false; return toast("That video link doesn't look right. Copy it from the Share button."); }
    const { error } = isNew ? await sb.from("exercises").insert(row) : await sb.from("exercises").update(row).eq("id", id);
    btn.disabled = false; btn.textContent = "Save to library";
    if (!fail(error)) { toast("Saved to library"); go("library"); }
  };
}

// Copy a saved workout into a client's programme, once or weekly. Returns the new workouts.
async function assignTemplate(t, clientId, start, weeks = 1, notify = true) {
  const made = [];
  for (let k = 0; k < weeks; k++) {
    const d = start ? new Date(start) : null; d?.setDate(d.getDate() + 7 * k);
    const { data: wk, error } = await sb.from("workouts").insert({ trainer_id: me.id, client_id: clientId, name: weeks > 1 ? `${t.name} (week ${k + 1})` : t.name,
      scheduled_date: d ? d.toISOString().slice(0, 10) : null, notes: t.notes || null, template_id: t.id || null }).select().single();
    if (fail(error)) return made;
    const rows = (t.items || []).map((i, pos) => ({ ...stripItem(i), section: sectionOf(i), workout_id: wk.id, position: pos }));
    const { error: ie } = rows.length ? await sb.from("workout_items").insert(rows) : { error: null };
    // never leave a workout without its exercises: undo the empty workout if the exercises didn't save
    if (ie) { await sb.from("workouts").delete().eq("id", wk.id); fail(ie); return made; }
    made.push(wk);
  }
  if (notify && made.length && clientId !== me.id) await sb.from("messages").insert({ client_id: clientId, sender_id: me.id,
    body: weeks > 1 ? `Your new ${weeks}-week programme is ready: "${t.name}"` : `New workout ready for ${fmtDate(made[0].scheduled_date)}: "${t.name}"` });
  return made;
}

// A copy of a workout in a client's folder, without a date (the coach schedules it later or the client picks it).
async function saveClientCopy(t, clientId) { const ws = await assignTemplate({ ...t, id: t.id || null }, clientId, null, 1, false); return ws[0] || null; }
let builderDraft = null;
function folderOptions(folders, selected = "", clients = []) {
  return `<option value="" ${selected ? "" : "selected"}>General library</option>
    ${(folders || []).map((f) => `<option value="${f.id}" ${f.id === selected ? "selected" : ""}>${esc(f.name)}</option>`).join("")}
    <option value="__new">+ New folder…</option>
    ${(clients || []).length ? `<optgroup label="A client's folder (their own copy)">${clients.map((cl) => `<option value="client:${cl.id}">${esc(cl.id === me.id ? "Me (My training)" : cl.full_name)}</option>`).join("")}</optgroup>` : ""}`;
}

// ---------------------------------------------------------------- workout library with folders
// Master workouts live in the General library or the coach's own folders. Every client has an automatic folder:
// their own workouts. Copies are independent: changing one never changes the master or anyone else's copy.
function sheetPick(title, options, onPick, note = "") {
  document.body.insertAdjacentHTML("beforeend", `<div class="picker" id="sheet" role="dialog" aria-label="${esc(title)}"><div class="picker-box">
    <div class="row between"><h2 style="margin:0">${esc(title)}</h2><button type="button" class="small" id="shX">Close</button></div>
    ${note ? `<p class="muted">${esc(note)}</p>` : ""}
    ${options.map((o) => `<button type="button" class="list-item sl-item" data-v="${esc(o.value)}"><div class="grow"><b>${esc(o.label)}</b>${o.sub ? `<div class="muted">${esc(o.sub)}</div>` : ""}</div></button>`).join("") || `<div class="empty">Nothing to choose yet.</div>`}</div></div>`);
  const close = () => $("#sheet")?.remove();
  $("#shX").onclick = close; $("#sheet").addEventListener("click", (e) => { if (e.target.id === "sheet") close(); });
  $$("#sheet [data-v]").forEach((b) => (b.onclick = () => { close(); onPick(b.dataset.v); }));
}
const SORTS = [["name", "Name A–Z"], ["new", "Newest first"], ["edited", "Recently edited"]];
const sortBy = (list, k) => [...list].sort(k === "name" ? (a, b) => a.name.localeCompare(b.name) : k === "new" ? (a, b) => (b.created_at || "").localeCompare(a.created_at || "")
  : (a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""));

async function workoutLibrary(view = "home", arg = null) {
  const [{ data: tpls }, { data: folders }, { data: clients }, { data: cws }, lib] = await Promise.all([
    sb.from("workout_templates").select("*").order("name"),
    sb.from("workout_folders").select("*").order("name"),
    sb.from("profiles").select("id, full_name, equipment").eq("trainer_id", me.id).order("full_name"),
    sb.from("workouts").select("id, name, client_id, scheduled_date, completed_at, created_at, updated_at, template_id, workout_items(count)").eq("trainer_id", me.id),
    myLibrary(),
  ]);
  const T = tpls || [], F = folders || [], C = clients || [], W = cws || [];
  const exOf = (eid) => lib.find((x) => x.id === eid);
  const cName = (id) => (id === me.id ? "Me (My training)" : C.find((x) => x.id === id)?.full_name || "Client");
  const fName = (id) => (id ? F.find((f) => f.id === id)?.name || "General library" : "General library");
  const folder = view === "folder" ? (arg === "general" ? { id: "general", name: "General library" } : arg === "all" ? { id: "all", name: "All workouts" } : F.find((f) => f.id === arg)) : null;
  const client = view === "cfolder" ? C.find((x) => x.id === arg) : null;
  if ((view === "folder" && !folder) || (view === "cfolder" && !client)) return render(`<button class="back" onclick="location.hash='#/workouts'">Workouts</button><div class="empty">Folder not found.</div>`);
  const sortKey = localStorage.getItem("or-wsort") || "name";
  const head = view === "home" ? `<div class="row between"><h1>Workouts</h1><button class="small" id="wNew">${ICON.plus} Create workout</button></div>
      <p class="muted">Master workouts in folders, plus a folder for every client with the workouts made for them.</p>`
    : `<button class="back" onclick="location.hash='#/workouts'">All folders</button>
      <div class="row between"><h1>${esc(client ? (client.id === me.id ? "My training" : client.full_name) : folder.name)}</h1>
      ${folder && !["general", "all"].includes(folder.id) ? `<div class="row" style="gap:6px"><button class="small secondary" id="fRen">Rename</button><button class="small ghost" id="fDel">Delete</button></div>` : ""}</div>
      ${client ? `<p class="muted">Every workout made for ${esc(firstName(client))}. Copies from your library can be changed here without touching the master.</p>`
        : folder.id === "all" ? `<p class="muted">Every master workout and every client's workouts in one list.</p>` : `<p class="muted">Master workouts. Assign or copy them into any client's folder.</p>`}`;
  const filterSel = view === "home" || folder?.id === "all" ? `<select id="wf2" aria-label="Filter by folder or client"><option value="">All folders</option><option value="f:general">General library</option>
      ${F.map((f) => `<option value="f:${f.id}">${esc(f.name)}</option>`).join("")}<optgroup label="Clients">${C.map((cl) => `<option value="c:${cl.id}">${esc(cName(cl.id))}</option>`).join("")}</optgroup></select>` : "";
  render(`${head}
    <div class="wtools"><input type="search" id="wq" placeholder="Search workouts by name" aria-label="Search workouts">
      <div class="grid2">${filterSel || "<div></div>"}<select id="ws" aria-label="Sort">${SORTS.map(([k, l]) => `<option value="${k}" ${k === sortKey ? "selected" : ""}>${l}</option>`).join("")}</select></div></div>
    <div id="wDraft"></div><div id="wl"></div>
    ${view === "home" ? `<div class="card"><h3>How it works</h3><ol class="steps" style="margin:6px 0 0">
      <li><b>Create a workout</b> and choose where to save it: the General library, one of your folders, or straight into a client's folder.</li>
      <li><b>Assign or copy</b> a master workout into a client's folder. Their copy is theirs: adjust it without changing the master.</li>
      <li><b>Folders</b> are only for organising. Deleting a folder never deletes its workouts; they move to the General library.</li></ol></div>` : ""}`);

  // unfinished workouts saved on this phone
  const drafts = Object.keys(localStorage).filter((k) => k.startsWith(`or-draft-${me.id}-t-new`)).map((k) => { try { return [k, JSON.parse(localStorage.getItem(k))]; } catch { return null; } }).filter(Boolean);
  if (drafts.length) $("#wDraft").innerHTML = drafts.map(([k, d]) => `<div class="card nudge draft row between"><div><b>Unfinished: ${esc(d.name || "Untitled workout")}</b><div class="muted">${d.items?.length || 0} exercises, not saved yet</div></div>
    <div class="row" style="gap:6px"><button class="small" data-dr="${esc(k)}">Continue</button><button class="small ghost" data-drx="${esc(k)}">Discard</button></div></div>`).join("");
  $$("[data-dr]").forEach((b) => (b.onclick = () => go("wb/new")));
  $$("[data-drx]").forEach((b) => (b.onclick = () => { localStorage.removeItem(b.dataset.drx); b.closest(".card").remove(); }));

  const used = (tid) => new Set(W.filter((u) => u.template_id === tid).map((u) => u.client_id)).size;
  const tplCard = (t, showFolder) => {
    const first = (t.items || []).map((i) => exOf(i.exercise_id)).filter(Boolean).slice(0, 4);
    const secs = SECTIONS.map((sec) => [sec.key, (t.items || []).filter((i) => sectionOf(i) === sec.key).length]).filter(([, k]) => k).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(", ");
    const n = used(t.id);
    return `<div class="card wk"><a href="#/wb/${t.id}" class="wk-head" style="color:inherit;text-decoration:none">
        <div class="wk-thumbs">${first.map((x) => moveFor(x) ? `<span class="thumb">${moveSvg(moveFor(x), { animate: false, label: false, props: (x.equipment || []).length > 0 })}</span>` : "").join("")}</div>
        <b>${esc(t.name)}</b><div class="muted">${showFolder ? `<span class="chip">${esc(fName(t.folder_id))}</span> ` : ""}${(t.items || []).length} exercises (${secs || "empty"}), about ${estMinutes(t.items)} min${n ? `. Given to ${n} ${n === 1 ? "client" : "clients"}` : ""}</div></a>
      <div class="wk-actions"><button class="small" data-as="${t.id}">Assign</button><button class="small secondary" data-cp="${t.id}">Copy to a client</button>
        <button class="small secondary" data-mv="${t.id}">Move</button><button class="small secondary" data-dup="${t.id}">Duplicate</button><button class="small ghost" data-dl="${t.id}">Delete</button></div></div>`;
  };
  const cwCard = (w, showClient) => `<div class="card wk"><a href="#/builder/${w.client_id}/${w.id}" class="wk-head" style="color:inherit;text-decoration:none">
      <b>${esc(w.name)}</b><div class="muted">${showClient ? `<span class="chip">${esc(cName(w.client_id))}</span> ` : ""}${w.workout_items?.[0]?.count || 0} exercises${w.scheduled_date ? `, ${fmtDate(w.scheduled_date)}` : ", no date"}${w.template_id ? `, from "${esc(T.find((t) => t.id === w.template_id)?.name || "a master workout")}"` : ""}
      ${w.completed_at ? ` <span class="chip good">Done ${fmtDate(w.completed_at)}</span>` : ""}</div></a>
    <div class="wk-actions"><button class="small secondary" data-cc="${w.id}">Copy to another client</button><button class="small secondary" data-sm="${w.id}">Save to my library</button>
      <button class="small ghost" data-cd="${w.id}">Delete</button></div></div>`;

  const draw = () => {
    const q = $("#wq").value.trim().toLowerCase(); const fl = $("#wf2")?.value || ""; const sk = $("#ws").value;
    const m = (x) => !q || x.name.toLowerCase().includes(q);
    let html = "";
    if (view === "home" && !q && !fl) {
      const count = (fid) => T.filter((t) => (t.folder_id || null) === fid).length;
      const tile = (href, name, sub, icon = "train") => `<a class="folder" href="${href}">${ICON[icon] || ""}<b>${esc(name)}</b><span class="muted">${sub}</span></a>`;
      html = `<div class="sec"><h2>Folders</h2><button class="small secondary" id="fNew">${ICON.plus} New folder</button></div>
        <div class="folders">${tile("#/folder/all", "All workouts", `${T.length + W.length} workouts`)}${tile("#/folder/general", "General library", `${count(null)} master`)}
        ${F.map((f) => tile(`#/folder/${f.id}`, f.name, `${count(f.id)} master`)).join("")}</div>
        <div class="sec"><h2>Client folders</h2></div>
        <div class="folders">${C.map((cl) => { const k = W.filter((w) => w.client_id === cl.id).length; return tile(`#/cfolder/${cl.id}`, cName(cl.id), `${k} ${k === 1 ? "workout" : "workouts"}`, "clients"); }).join("") || `<div class="empty">Clients appear here once they join with your invite link.</div>`}</div>`;
    } else {
      // which masters and client workouts are in view
      let tl = [], wl = [];
      if (client) wl = W.filter((w) => w.client_id === client.id);
      else if (folder && folder.id === "general") tl = T.filter((t) => !t.folder_id);
      else if (folder && folder.id !== "all") tl = T.filter((t) => t.folder_id === folder.id);
      else { tl = T; wl = W; }
      if (fl.startsWith("f:")) { const fid = fl.slice(2); tl = T.filter((t) => (fid === "general" ? !t.folder_id : t.folder_id === fid)); wl = []; }
      if (fl.startsWith("c:")) { tl = []; wl = W.filter((w) => w.client_id === fl.slice(2)); }
      tl = sortBy(tl.filter(m), sk); wl = sortBy(wl.filter(m), sk);
      const wide = !folder || folder.id === "all" || fl;
      html = `${client ? `<div class="row" style="gap:8px;margin-bottom:10px"><button class="small" onclick="location.hash='#/builder/${client.id}'">${ICON.plus} New workout for ${esc(firstName(client))}</button>
          <button class="small secondary" id="cfAdd">Add from my library</button></div>`
        : folder && folder.id !== "all" ? `<button class="small" id="fCreate" style="margin-bottom:10px">${ICON.plus} Create workout in this folder</button>` : ""}
        ${tl.length ? `${wl.length ? `<div class="sec"><h2>Master workouts</h2></div>` : ""}${tl.map((t) => tplCard(t, wide)).join("")}` : ""}
        ${wl.length ? `${tl.length ? `<div class="sec"><h2>Client workouts</h2></div>` : ""}${wl.map((w) => cwCard(w, !client)).join("")}` : ""}
        ${!tl.length && !wl.length ? `<div class="card empty">${q ? "No workouts match." : client ? `No workouts for ${esc(firstName(client))} yet.` : "This folder is empty. Create a workout here, or move one in."}</div>` : ""}`;
    }
    $("#wl").innerHTML = html; startMoves($("#wl"));
    bindCards();
  };

  const reload = () => workoutLibrary(view, arg);
  const copyTo = (src, title) => sheetPick(title, C.map((cl) => ({ value: cl.id, label: cName(cl.id) })), async (cid) => {
    const w2 = await saveClientCopy(src, cid); if (w2) { toast(`Copied into ${cName(cid)}'s folder. Adjust it there; the original stays as it is.`); reload(); }
  }, "Their copy has no date yet. Open it in their folder to set one or make changes.");
  const loadItems = async (wid) => { const { data } = await sb.from("workout_items").select("*").eq("workout_id", wid).order("position"); return data || []; };
  function bindCards() {
    $("#fNew")?.addEventListener("click", async () => {
      const name = (prompt("Folder name, e.g. Glute programmes, Beginners, Sarah") || "").trim().slice(0, 60); if (!name) return;
      const { error } = await sb.from("workout_folders").insert({ trainer_id: me.id, name }); if (!fail(error)) { toast(`Folder "${name}" created`); reload(); }
    });
    $("#fCreate")?.addEventListener("click", () => { if (folder && folder.id !== "general") sessionStorage.setItem("or-new-folder", folder.id); go("wb/new"); });
    $("#cfAdd")?.addEventListener("click", () => sheetPick(`Add to ${firstName(client)}'s folder`, sortBy(T, "name").map((t) => ({ value: t.id, label: t.name, sub: fName(t.folder_id) })), async (tid) => {
      const t = T.find((x) => x.id === tid); const w2 = await saveClientCopy(t, client.id); if (w2) { toast(`Added "${t.name}". It's ${firstName(client)}'s own copy.`); reload(); }
    }));
    $$("[data-as]").forEach((b) => (b.onclick = () => go("assign/" + b.dataset.as)));
    $$("[data-cp]").forEach((b) => (b.onclick = () => { const t = T.find((x) => x.id === b.dataset.cp); copyTo(t, `Copy "${t.name}" to…`); }));
    $$("[data-mv]").forEach((b) => (b.onclick = () => {
      const t = T.find((x) => x.id === b.dataset.mv);
      sheetPick(`Move "${t.name}" to…`, [{ value: "", label: "General library" }, ...F.map((f) => ({ value: f.id, label: f.name }))].filter((o) => o.value !== (t.folder_id || "")), async (fid) => {
        const { error } = await sb.from("workout_templates").update({ folder_id: fid || null }).eq("id", t.id); if (!fail(error)) { toast(`Moved to ${fName(fid || null)}`); reload(); }
      });
    }));
    $$("[data-dup]").forEach((b) => (b.onclick = async () => {
      const t = T.find((x) => x.id === b.dataset.dup);
      const { error } = await sb.from("workout_templates").insert({ trainer_id: me.id, name: `${t.name} (copy)`.slice(0, 120), notes: t.notes, items: t.items, folder_id: t.folder_id || null });
      if (!fail(error)) { toast(`Duplicated "${t.name}"`); reload(); }
    }));
    $$("[data-dl]").forEach((b) => (b.onclick = async () => {
      const t = T.find((x) => x.id === b.dataset.dl);
      if (!confirm(`Delete the master workout "${t.name}"? Copies already in clients' folders stay.`)) return;
      const { error } = await sb.from("workout_templates").delete().eq("id", t.id); if (!fail(error)) { toast("Deleted"); reload(); }
    }));
    $$("[data-cc]").forEach((b) => (b.onclick = async () => {
      const w = W.find((x) => x.id === b.dataset.cc); const items = await loadItems(w.id);
      copyTo({ name: w.name, notes: null, items, id: w.template_id }, `Copy "${w.name}" to…`);
    }));
    $$("[data-sm]").forEach((b) => (b.onclick = async () => {
      const w = W.find((x) => x.id === b.dataset.sm); const items = await loadItems(w.id);
      sheetPick(`Save "${w.name}" as a master in…`, [{ value: "", label: "General library" }, ...F.map((f) => ({ value: f.id, label: f.name }))], async (fid) => {
        const { error } = await sb.from("workout_templates").insert({ trainer_id: me.id, name: w.name, items: items.map(stripItem), folder_id: fid || null });
        if (!fail(error)) { toast(`Saved to ${fName(fid || null)}. ${cName(w.client_id)}'s copy is unchanged.`); reload(); }
      });
    }));
    $$("[data-cd]").forEach((b) => (b.onclick = async () => {
      const w = W.find((x) => x.id === b.dataset.cd);
      if (!confirm(`Delete "${w.name}" from ${cName(w.client_id)}'s folder, with any sets they logged in it? Your master workouts are not affected.`)) return;
      const { error } = await sb.from("workouts").delete().eq("id", w.id); if (!fail(error)) { toast("Deleted"); reload(); }
    }));
  }
  $("#wNew")?.addEventListener("click", () => go("wb/new"));
  $("#fRen")?.addEventListener("click", async () => {
    const name = (prompt("New folder name", folder.name) || "").trim().slice(0, 60); if (!name || name === folder.name) return;
    const { error } = await sb.from("workout_folders").update({ name }).eq("id", folder.id); if (!fail(error)) { toast("Folder renamed. Its workouts are unchanged."); reload(); }
  });
  $("#fDel")?.addEventListener("click", async () => {
    const k = T.filter((t) => t.folder_id === folder.id).length;
    if (!confirm(`Delete the folder "${folder.name}"?${k ? ` Its ${k} ${k === 1 ? "workout moves" : "workouts move"} to the General library. No workouts are deleted.` : ""}`)) return;
    if (k) { const { error } = await sb.from("workout_templates").update({ folder_id: null }).eq("folder_id", folder.id); if (fail(error)) return; }
    const { error } = await sb.from("workout_folders").delete().eq("id", folder.id); if (!fail(error)) { toast("Folder deleted. Its workouts are in the General library."); go("workouts"); }
  });
  $("#wq").oninput = draw; $("#ws").onchange = () => { localStorage.setItem("or-wsort", $("#ws").value); draw(); }; $("#wf2")?.addEventListener("change", draw);
  draw();
}

async function assignView(id, preClient) {
  const [{ data: t }, { data: clients }, lib] = await Promise.all([
    sb.from("workout_templates").select("*").eq("id", id).single(),
    sb.from("profiles").select("id, full_name, equipment").eq("trainer_id", me.id).order("full_name"),
    myLibrary(),
  ]);
  if (!t) return render(`<div class="empty">Workout not found.</div>`);
  if (!preClient && (clients || []).length === 1) preClient = clients[0].id;
  const ex = (eid) => lib.find((x) => x.id === eid) || { name: "Exercise", equipment: [] };
  const needs = (cl) => [...new Set((t.items || []).flatMap((i) => missingEquipment(ex(i.exercise_id), cl.equipment)))];
  const label = (cl) => (cl.id === me.id ? "Me (My training)" : cl.full_name);
  render(`<button class="back" onclick="location.hash='#/workouts'">Back to workouts</button><h1>Assign "${esc(t.name)}"</h1>
    <div class="card nudge saved-ok">${ICON.check} <span><b>This workout is saved</b> in your library. Assigning gives a client their own copy. <a href="#/workouts">Done for now</a></span></div>
    <div class="card"><div class="row between"><b>${(t.items || []).length} exercises, about ${estMinutes(t.items)} min</b><a href="#/wb/${t.id}">Edit</a></div>
      ${SECTIONS.map((sec) => { const its = (t.items || []).filter((i) => sectionOf(i) === sec.key); return its.length ? `<p class="muted" style="margin:8px 0 2px">${sec.key}</p>
      <ol class="steps" style="margin:0">${its.map((i) => `<li>${esc(ex(i.exercise_id).name)} <span class="muted">${esc(targetText(i))}</span></li>`).join("")}</ol>` : ""; }).join("")}</div>
    <form class="card" id="as"><h3>1. Choose the client</h3>
      <div id="asC">${(clients || []).map((cl) => `<span class="chip ${cl.id === preClient ? "on" : ""}" data-c="${cl.id}" role="button" aria-pressed="${cl.id === preClient}">${esc(label(cl))}${needs(cl).length ? " (needs kit)" : ""}</span>`).join("") || `<span class="muted">No clients yet.</span>`}</div>
      <p class="muted" style="margin:6px 0 0">"Needs kit" means they're missing equipment for an exercise. You can swap it in their copy afterwards.</p>
      <h3 style="margin-top:14px">2. Choose the day</h3>
      <div class="grid2"><div><label for="asD">Date</label><input id="asD" type="date" value="${today()}"></div>
        <div><label for="asW">Repeat</label><select id="asW">${[[1, "Just this day"], [2, "Weekly for 2 weeks"], [4, "Weekly for 4 weeks"], [6, "Weekly for 6 weeks"], [8, "Weekly for 8 weeks"], [12, "Weekly for 12 weeks"]].map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></div></div>
      <button class="block" style="margin-top:14px">3. Assign</button></form>`);
  $$("#asC .chip").forEach((ch) => (ch.onclick = () => { ch.classList.toggle("on"); ch.setAttribute("aria-pressed", ch.classList.contains("on")); $("#asC").classList.remove("bad"); }));
  $("#as").onsubmit = async (e) => {
    e.preventDefault();
    const ids = $$("#asC .chip.on").map((ch) => ch.dataset.c); if (!ids.length) { $("#asC").classList.add("bad"); $("#asC").scrollIntoView({ block: "center", behavior: "smooth" }); return toast("Tap a client's name under step 1 to choose who gets it. Your workout is already saved."); }
    const weeks = Number($("#asW").value); const start = $("#asD").value || today();
    const names = ids.map((cid) => label(clients.find((x) => x.id === cid))).join(", ");
    if (!confirm(`Assign "${t.name}" to ${names}, ${weeks > 1 ? `weekly for ${weeks} weeks from` : "on"} ${fmtDate(start)}?`)) return;
    const btn = $("#as button.block"); btn.disabled = true; btn.textContent = "Assigning…";
    const made = [];
    for (const cid of ids) { const ws = await assignTemplate(t, cid, start, weeks); made.push(...ws.map((x) => ({ cid, w: x }))); }
    if (!made.length) { btn.disabled = false; btn.textContent = "3. Assign"; return; }
    const firsts = ids.map((cid) => made.find((m) => m.cid === cid)).filter(Boolean);
    render(`<div class="card"><h2>Assigned</h2><p>"${esc(t.name)}" is now in ${esc(names)}'s app${weeks > 1 ? `, every week for ${weeks} weeks` : ""}.</p>
      <p class="muted">Need changes for one person? Open their copy. It won't change the saved workout or anyone else's.</p>
      ${firsts.map((m) => `<a class="btn secondary block" style="margin-top:8px" href="#/builder/${m.cid}/${m.w.id}">Adjust ${esc(label(clients.find((x) => x.id === m.cid)))}'s copy</a>`).join("")}
      <button class="block" style="margin-top:12px" onclick="location.hash='#/workouts'">Done</button></div>`);
  };
}

async function trainerInbox() {
  const [{ data: clients }, { data: msgs }] = await Promise.all([
    sb.from("profiles").select("id, full_name, avatar_path").eq("trainer_id", me.id).order("full_name"),
    sb.from("messages").select("*").order("created_at", { ascending: false }).limit(500),
  ]);
  const last = {}; const unread = {};
  (msgs || []).forEach((m) => { last[m.client_id] ??= m; if (!m.read_at && m.sender_id !== me.id) unread[m.client_id] = (unread[m.client_id] || 0) + 1; });
  const sorted = (clients || []).sort((a, b) => (last[b.id]?.created_at || "").localeCompare(last[a.id]?.created_at || ""));
  render(`<h1>Chat</h1><div class="card">${sorted.map((c) => `<a class="list-item" href="#/chat/${c.id}">${avatar(c)}
    <div class="grow"><b>${esc(c.full_name)}</b><div class="muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(last[c.id]?.body || "No messages yet")}</div></div>
    ${unread[c.id] ? `<span class="chip on">${unread[c.id]}</span>` : `<span class="muted">${last[c.id] ? fmtDate(last[c.id].created_at) : ""}</span>`}</a>`).join("")
    || `<div class="empty">Accept a client to start chatting.</div>`}</div>`);
}

// Boot: onAuthStateChange fires INITIAL_SESSION on load and starts the app.
