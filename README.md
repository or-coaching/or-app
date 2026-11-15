# Or. — launch guide

A web app clients install on their phones from a link. No app stores, no coding.

**Want to look first?** Set `DEMO: true` in `js/config.js` and the app runs on sample data with "I'm a client" and "I'm the coach" buttons. No Supabase needed. Set it back to `false` before going live.
Budget about **2 hours** for the first setup. Everything below is click-by-click.

**What you'll use (all free to start)**
- **Supabase** — logins, the database, video storage and live chat
- **GitHub** — stores the app's files and hosts the website (GitHub Pages)
- **Anthropic** (optional) — drafts the AI form cues, costs cents

---

## Step 1 — Create the Supabase project (15 min)

1. Go to **supabase.com** → **Start your project** → sign up with GitHub (one less password).
2. Click **New project**.
   - Name: `coach-app`
   - Database password: click **Generate a password** and save it in your password manager.
   - Region: **Central EU (Frankfurt)** or **West EU (Ireland)** — there's no South African region. Mention this in the privacy notice (already worded in `privacy.html`).
3. Click **Create new project** and wait about 2 minutes.

## Step 2 — Build the database (5 min)

1. Left menu → **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from this folder, copy **everything**, paste it in.
3. Click **Run**. You should see "Success. No rows returned".

This creates all the tables, the video storage, live chat and the privacy rules (clients can only ever see their own data).

## Step 3 — Copy your two keys (2 min)

1. Left menu → **Project Settings** (cog) → **API** (may be called **Data API** / **API Keys**).
2. Copy the **Project URL** (looks like `https://abcd1234.supabase.co`).
3. Copy the **anon public** key (newer dashboards call it the **publishable** key). It's safe to put in the app — the database rules protect the data.
   ⚠️ Never use the **service_role** / **secret** key in the app.

## Step 4 — Put the app on GitHub (10 min)

**Option A — let Claude do it:** create an empty repository (below, steps 1–3), then tell Claude its name and Claude pushes the files.

**Option B — upload it yourself:**
1. github.com → top right **+** → **New repository**.
2. Name: `coach-app`. Choose **Public** (GitHub Pages is free for public repos; no client data lives here — that's all in Supabase).
3. Click **Create repository**.
4. On the new page click **uploading an existing file**.
5. Unzip `coach-app.zip` on your computer, open the folder, select **everything inside it** and drag it onto the page. Wait for the files to finish uploading.
6. Click **Commit changes**.

## Step 5 — Add your keys and her details (5 min)

1. In the repository, click the `js` folder → `config.js` → the **pencil** icon (Edit).
2. Check `DEMO` is `false`, then replace:
   - `APP_NAME` → already "Or."
   - `SUPABASE_URL` and `SUPABASE_ANON_KEY` → from Step 3
   - `INSTAGRAM_URL` → her Instagram link
   - In `BRAND`, the two colours → her logo colours (Claude can do this once you send the logo)
3. Click **Commit changes** → **Commit changes**.

## Step 6 — Switch the website on (3 min)

1. Repository → **Settings** → **Pages** (left menu).
2. Source: **Deploy from a branch**. Branch: **main**, folder **/ (root)** → **Save**.
3. Wait 1–2 minutes and refresh. Your link appears at the top, e.g.
   `https://YOUR-USERNAME.github.io/coach-app/`

Then tell Supabase where the app lives (so email links work):
4. Supabase → **Authentication** → **URL Configuration**.
5. **Site URL** = your GitHub Pages link. Under **Redirect URLs** click **Add URL** and add the same link. **Save**.

## Step 7 — Make her the trainer (3 min)

1. She opens the app link → **Create account** → confirms her email → signs in. (She'll see the "waiting for your coach" screen — that's expected.)
2. Supabase → **SQL Editor** → **New query** → paste, with her email:
   ```sql
   update public.profiles set role = 'trainer' where email = 'her@email.com';
   ```
3. **Run**. She signs out and in again — she now sees **Clients, Library, Chat, Settings**.

## Step 8 — Turn on AI form cues (optional, 10 min)

1. Go to **console.anthropic.com** → sign up → **Billing**: add a card and a small credit (e.g. $5 lasts a very long time — each cue draft costs a fraction of a cent).
2. **API Keys** → **Create Key** → copy it.
3. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
4. Name it exactly `coach-cues`. Delete the sample code, paste everything from `supabase/functions/coach-cues/index.ts` → **Deploy**.
5. Edge Functions → **Secrets** (or Project Settings → Edge Functions) → **Add new secret**:
   Name `ANTHROPIC_API_KEY`, value = your key → **Save**.
6. In the app: Library → an exercise → **✨ Draft with AI**. She reviews and edits the cues before saving — clients only see what she approves.

## Step 8b — Add her photos (10 min)

The app is designed around her own photography, which is what makes it look like her brand rather than a template.
1. Pick 3 portrait photos (phone camera is fine, at least 1200 px tall, under 500 KB each — compress free at squoosh.app):
   - **welcome** — sign-in screen
   - **today** — client home screen
   - **passes** — passes and library screen
2. In the repository open the `images` folder → **Add file** → **Upload files** → name them `welcome.jpg`, `today.jpg`, `passes.jpg` → **Commit changes**.
3. In `js/config.js` fill in `PHOTOS`, e.g. `today: "images/today.jpg"`.

Until then, the app shows a branded "Or." background.

## Step 9 — Payments and passes (when she's ready)

The app shows **Pay** buttons and gives her an **Access & payment** switch per client.
1. Create **payment links** in PayFast, Yoco or Paystack (their dashboards do this without code) for each item in `OFFERS`: 5-day, 7-day and 30-day passes, a PT session and monthly coaching. Adjust the prices to hers.
2. Paste each link into `OFFERS` in `config.js` (Step 5 method). Optional: a booking calendar link in `BOOKING_URL`.
3. When a client pays, the app messages her. She opens the client → **Access & payment** → taps the pass they bought (e.g. **7-day pass**) → **Update access**. The days are added automatically, and the client sees a "days left on your pass" chip on their home screen.
4. To make the library a paid extra: **Settings** → untick **Full library is free**. Clients still see the exercises in their own workouts.

> Phase 2: automatic access switching via PayFast/Yoco notifications — needs her merchant account first.

## Step 9b — Make it hers: challenges, tips and recipes

- **Daily challenges and coach's tips:** `js/engage.js`, one line each. Everyone gets the same challenge each day, chosen from the list.
- **Recipes:** `js/nutrition.js`, at the bottom. Copy an existing recipe and change it; points work themselves out from the kcal, sat fat, sugar, protein and fibre per serving.
- **Badges** (streaks, workouts, personal bests, kg lost, challenges, roulette, food tracking) are worked out automatically from what clients log.

## Step 10 — Test before inviting clients (20 min)

Use a second email (or a friend) as a test client:
- [ ] Sign up as the client → she sees them under **New sign-ups** → **Accept**
- [ ] She adds 2 exercises with videos, builds a workout for the client
- [ ] Client logs sets, a weigh-in and an activity; picks Nutrition in Profile and logs food
- [ ] Client ticks off the daily challenge, spins the roulette, and opens Streaks and badges
- [ ] Chat both ways (messages appear live)
- [ ] Client can't see the full library when it's paid and access is off
- [ ] Install on an iPhone and an Android (below)

## Installing on phones (share with clients)

- **iPhone:** open the link in **Safari** → **Share** → **Add to Home Screen**.
- **Android:** open in **Chrome** → **⋮** menu → **Install app** / **Add to Home screen**.

## Making changes later

Edit any file on GitHub with the pencil icon → **Commit changes**. The site updates in about a minute. Clients may need to close and reopen the app.

---

## Costs and limits to watch

Supabase free plan (check supabase.com/pricing — figures change): 500 MB database, **1 GB file storage**, **5 GB bandwidth a month**, and projects **pause after a week without activity**.
- **Videos are the constraint.** Keep clips 10–20 s, 720p — around 3–8 MB each. 100 clips ≈ 500 MB.
- Once she has paying clients, move to **Pro (about $25/month)**: 100 GB storage, 250 GB bandwidth, no pausing. One library subscriber at R99 roughly covers half of it.

## Compliance checklist (POPIA)

- [ ] Fill in every highlighted item in `privacy.html` (business name, contact, data region, retention period) and have it checked
- [ ] Consent is captured at sign-up (stored with a timestamp)
- [ ] Clients can download their data and request deletion in **Profile**
- [ ] To delete a client: Supabase → **Authentication** → **Users** → find them → **Delete user** (removes all their data)
- [ ] Her Supabase and GitHub accounts use strong passwords and **two-factor authentication**
- [ ] AI cues and the points budget are general guidance, not medical advice (stated in the app and notice)

## What's where

| File | What it does |
|---|---|
| `js/config.js` | The only file you edit: name, keys, Instagram, prices, colours |
| `js/app.js` | All the screens |
| `js/nutrition.js` | Points formula, SA food list, daily budget, recipes |
| `js/engage.js` | Daily challenges, tips, streaks and badges |
| `js/demo.js` | Sample data for demo mode only |
| `supabase/schema.sql` | Database and privacy rules |
| `supabase/functions/coach-cues/` | AI form cues |
| `privacy.html` | POPIA privacy notice template |
| `icons/` | App icon and `logo.png` (add her logo here) |
