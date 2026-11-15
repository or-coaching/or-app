// =============================================================
// Streaks, badges, daily challenges and tips.
// She can edit CHALLENGES and TIPS freely — one line each.
// =============================================================

// Exercise roulette opens after this many active days (any day they open the app counts).
export const ROULETTE_UNLOCK_DAYS = 90;

// One small win a day. The app picks today's from this list (same for every client).
export const CHALLENGES = [
  "Hold a plank for 45 seconds",
  "Take a 15-minute walk after a meal",
  "Drink 2 litres of water today",
  "Do 30 squats, split however you like",
  "Stretch your hips for 5 minutes before bed",
  "Take the stairs every time today",
  "20 push-ups, knees down is fine",
  "Eat a vegetable with every meal",
  "10 minutes of mobility first thing",
  "Get 7 hours of sleep tonight",
  "50 walking lunges around the house",
  "No sugary drinks today",
  "Wall sit for 60 seconds",
  "8 000 steps today",
  "3 rounds: 10 glute bridges, 10 sit-ups",
  "Phone-free first 30 minutes of your day",
  "Add protein to your breakfast",
  "1 minute of skipping or jumping jacks",
  "Foam roll or massage your calves",
  "Cook one meal from scratch",
  "Dead hang or doorway stretch for 30 seconds",
  "Walk during one phone call",
  "15 tricep dips off a chair",
  "Breathe: 4 seconds in, 6 out, for 2 minutes",
  "Balance on one leg while you brush your teeth",
  "100 calf raises through the day",
  "Pack tomorrow's gym bag tonight",
  "Try a new fruit or vegetable",
  "Side plank 20 seconds each side",
  "Message a friend to train together",
];

export const TIPS = [
  "Slow the lowering part of each rep. Three seconds down builds strength faster than rushing.",
  "Soreness isn't a measure of a good session. Consistency is.",
  "Breathe out on the effort: as you stand up from a squat or press the weight away.",
  "Protein at each meal helps you recover and keeps you fuller for longer.",
  "Sleep is training too. Muscle is built while you rest, not while you lift.",
  "If the last two reps feel hard but your form holds, the weight is right.",
  "A 10-minute walk after eating helps steady your blood sugar.",
  "Progress isn't only the scale. Notice how your clothes fit and how your energy feels.",
  "Warm up with the same movement you're about to train, just lighter.",
  "Drink water before you feel thirsty, especially in the Cape summer heat.",
  "Missed a day? Never miss two. That's the whole trick to streaks.",
  "Write down the weight you used. Next time, beat it by one rep or one kilo.",
];

function dayIndex(iso) { return Math.floor(new Date(iso + "T00:00:00Z").getTime() / 864e5); }
export function pickForDate(list, iso, salt = 0) { return list[(dayIndex(iso) + salt) % list.length]; }

// Current streak counts back from today (or yesterday, so the morning doesn't break it).
export function streaks(daysIso, todayIso) {
  const set = new Set(daysIso);
  const sorted = [...set].sort();
  let best = 0, run = 0, prev = null;
  for (const d of sorted) { run = prev !== null && dayIndex(d) - prev === 1 ? run + 1 : 1; best = Math.max(best, run); prev = dayIndex(d); }
  let current = 0; let cursor = dayIndex(todayIso);
  if (!set.has(todayIso)) cursor -= 1;
  const has = (i) => set.has(new Date(i * 864e5).toISOString().slice(0, 10));
  while (has(cursor)) { current++; cursor--; }
  return { current, best, today: set.has(todayIso) };
}

// Badges are worked out from what clients have logged — nothing extra to store.
// glyph = what's printed in the middle of the medal.
export const BADGES = [
  { id: "first",    glyph: "1",   title: "First rep",        desc: "Log your first set",                  test: (s) => s.sets >= 1 },
  { id: "w5",       glyph: "5",   title: "Five sessions",    desc: "Finish 5 workouts",                   test: (s) => s.workouts >= 5 },
  { id: "w25",      glyph: "25",  title: "Quarter century",  desc: "Finish 25 workouts",                  test: (s) => s.workouts >= 25 },
  { id: "w50",      glyph: "50",  title: "Half a hundred",   desc: "Finish 50 workouts",                  test: (s) => s.workouts >= 50 },
  { id: "s7",       glyph: "7",   title: "Full week",        desc: "A 7-day streak",                      test: (s) => s.bestStreak >= 7 },
  { id: "s30",      glyph: "30",  title: "Unbroken",         desc: "A 30-day streak",                     test: (s) => s.bestStreak >= 30 },
  { id: "m20",      glyph: "20",  title: "Strong month",     desc: "20 active days in one month",         test: (s) => s.bestMonth >= 20 },
  { id: "pb1",      glyph: "PB",  title: "New best",         desc: "Beat your first effort on any exercise", test: (s) => s.prs >= 1 },
  { id: "pb10",     glyph: "10",  title: "Getting stronger", desc: "Improve on 10 exercises",             test: (s) => s.prs >= 10 },
  { id: "kg2",      glyph: "2.5", title: "First 2.5 kg",     desc: "Lose 2.5 kg from your first weigh-in", test: (s) => s.kgLost >= 2.5 },
  { id: "kg5",      glyph: "5kg", title: "Five down",        desc: "Lose 5 kg",                           test: (s) => s.kgLost >= 5 },
  { id: "kg10",     glyph: "10kg", title: "Ten down",        desc: "Lose 10 kg",                          test: (s) => s.kgLost >= 10 },
  { id: "move10",   glyph: "10h", title: "On the move",      desc: "10 hours of logged activity",         test: (s) => s.activityMins >= 600 },
  { id: "ch10",     glyph: "C10", title: "Challenge accepted", desc: "Complete 10 daily challenges",      test: (s) => s.challenges >= 10 },
  { id: "spin3",    glyph: "R3",  title: "Roll the dice",    desc: "Try 3 roulette exercises",            test: (s) => s.roulette >= 3 },
  { id: "fuel7",    glyph: "F7",  title: "Fuelled",          desc: "Track food on 7 days",                test: (s) => s.foodDays >= 7 },
];

export function badgeStats({ logs, workoutsDone, activities, challenges, metrics, foodDays, activeDays, todayIso }) {
  const firstBest = {};
  for (const l of logs) {
    const ex = l.workout_items?.exercise_id; if (!ex) continue;
    const score = (l.weight_kg || 0) * 1000 + (l.reps || 0) * 10 + (l.seconds || 0);
    firstBest[ex] ??= { first: score, best: score };
    firstBest[ex].best = Math.max(firstBest[ex].best, score);
  }
  const weights = metrics.filter((m) => m.weight_kg).sort((a, b) => a.metric_date.localeCompare(b.metric_date));
  const byMonth = {}; new Set(activeDays).forEach((d) => (byMonth[d.slice(0, 7)] = (byMonth[d.slice(0, 7)] || 0) + 1));
  const st = streaks(activeDays, todayIso);
  return {
    sets: logs.length,
    workouts: workoutsDone,
    bestStreak: st.best,
    streak: st,
    bestMonth: Math.max(0, ...Object.values(byMonth)),
    prs: Object.values(firstBest).filter((x) => x.best > x.first).length,
    kgLost: weights.length > 1 ? +(weights[0].weight_kg - weights[weights.length - 1].weight_kg).toFixed(1) : 0,
    activityMins: activities.reduce((s, a) => s + (a.minutes || 0), 0),
    challenges: challenges.length,
    roulette: activities.filter((a) => a.type === "Roulette").length,
    foodDays,
  };
}

export function medal(b, earned, size = 64) {
  const r = size / 2;
  const fs = b.glyph.length > 3 ? size * 0.22 : b.glyph.length > 2 ? size * 0.27 : size * 0.34;
  return `<svg class="medal ${earned ? "earned" : ""}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${r}" cy="${r}" r="${r - 2}" class="m-outer"/>
    <circle cx="${r}" cy="${r}" r="${r - 8}" class="m-inner"/>
    <circle cx="${r}" cy="${r}" r="${r - 5}" class="m-ring" fill="none" stroke-dasharray="2 3.2"/>
    <text x="50%" y="50%" dy=".35em" text-anchor="middle" font-size="${fs}" class="m-glyph">${b.glyph}</text></svg>`;
}
