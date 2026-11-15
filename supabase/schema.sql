-- =====================================================================
-- PT Coaching App — database setup
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to run once on a fresh project.
-- =====================================================================

-- ---------- PROFILES (one row per person who signs up) ----------
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  full_name         text,
  email             text,
  role              text not null default 'client' check (role in ('trainer','client')),
  trainer_id        uuid references public.profiles(id) on delete set null,
  goal              text,
  equipment         text[] not null default '{}',   -- what the client owns
  popia_consent_at  timestamptz,                      -- POPIA consent timestamp
  created_at        timestamptz not null default now()
);

-- Helper: is the logged-in person a trainer?
create or replace function public.is_trainer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'trainer');
$$;

-- Helper: does the logged-in trainer coach this client?
create or replace function public.coaches(client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = client and trainer_id = auth.uid()
  ) and public.is_trainer();
$$;

-- Helper: the logged-in client's trainer
create or replace function public.my_trainer_id()
returns uuid language sql stable security definer set search_path = public as $$
  select trainer_id from public.profiles where id = auth.uid();
$$;

-- Create a profile automatically when someone signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, popia_consent_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    case when (new.raw_user_meta_data->>'popia_consent') = 'true' then now() else null end
  );
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Stop clients from promoting themselves to trainer or changing their own trainer
create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() is null when run by the owner in the SQL Editor: allow.
  if auth.uid() is null then return new; end if;
  if new.role is distinct from old.role then
    raise exception 'Role can only be changed by the app owner';
  end if;
  if new.trainer_id is distinct from old.trainer_id and not public.is_trainer() then
    raise exception 'Only the trainer can assign clients';
  end if;
  return new;
end; $$;

drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles
  for each row execute function public.protect_profile_fields();

alter table public.profiles enable row level security;

drop policy if exists "read own or coached profiles" on public.profiles;
create policy "read own or coached profiles" on public.profiles for select using (
  id = auth.uid()
  or (public.is_trainer() and role = 'client'
      and (trainer_id = auth.uid() or trainer_id is null))              -- her clients + new sign-ups
  or id = public.my_trainer_id()                                         -- client sees own trainer
);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update using (id = auth.uid());

drop policy if exists "trainer accepts or updates clients" on public.profiles;
create policy "trainer accepts or updates clients" on public.profiles for update using (
  public.is_trainer() and role = 'client' and (trainer_id is null or trainer_id = auth.uid())
);

-- ---------- EXERCISE LIBRARY (trainer's reusable library) ----------
create table if not exists public.exercises (
  id            uuid primary key default gen_random_uuid(),
  trainer_id    uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  muscle_group  text not null default 'Full body',
  equipment     text[] not null default '{}',   -- empty = bodyweight
  video_path    text,                           -- file in the exercise-videos bucket
  instructions  text,
  cues          text[] not null default '{}',   -- coaching cues (AI-drafted, trainer-approved)
  created_at    timestamptz not null default now()
);
alter table public.exercises enable row level security;

drop policy if exists "trainer manages library" on public.exercises;
create policy "trainer manages library" on public.exercises for all
  using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

drop policy if exists "clients read their trainer's library" on public.exercises;
create policy "clients read their trainer's library" on public.exercises for select using (
  trainer_id = public.my_trainer_id()
);

-- ---------- WORKOUTS (what the PT prescribes) ----------
create table if not exists public.workouts (
  id              uuid primary key default gen_random_uuid(),
  trainer_id      uuid not null references public.profiles(id) on delete cascade,
  client_id       uuid not null references public.profiles(id) on delete cascade,
  name            text not null,
  scheduled_date  date,
  notes           text,
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);
alter table public.workouts enable row level security;

drop policy if exists "trainer manages workouts" on public.workouts;
create policy "trainer manages workouts" on public.workouts for all
  using (trainer_id = auth.uid() and public.coaches(client_id))
  with check (trainer_id = auth.uid() and public.coaches(client_id));

drop policy if exists "client reads own workouts" on public.workouts;
create policy "client reads own workouts" on public.workouts for select using (client_id = auth.uid());

drop policy if exists "client marks complete" on public.workouts;
create policy "client marks complete" on public.workouts for update using (client_id = auth.uid());

create table if not exists public.workout_items (
  id                uuid primary key default gen_random_uuid(),
  workout_id        uuid not null references public.workouts(id) on delete cascade,
  exercise_id       uuid not null references public.exercises(id) on delete restrict,
  position          int  not null default 0,
  target_sets       int,
  target_reps       int,
  target_weight_kg  numeric,
  target_seconds    int,
  rest_seconds      int,
  notes             text
);
alter table public.workout_items enable row level security;

drop policy if exists "access items via workout" on public.workout_items;
create policy "access items via workout" on public.workout_items for select using (
  exists (select 1 from public.workouts w where w.id = workout_id
          and (w.client_id = auth.uid() or w.trainer_id = auth.uid()))
);
drop policy if exists "trainer writes items" on public.workout_items;
create policy "trainer writes items" on public.workout_items for all
  using (exists (select 1 from public.workouts w where w.id = workout_id and w.trainer_id = auth.uid()))
  with check (exists (select 1 from public.workouts w where w.id = workout_id and w.trainer_id = auth.uid()));

-- ---------- SET LOGS (what the client actually did) ----------
create table if not exists public.set_logs (
  id               uuid primary key default gen_random_uuid(),
  workout_item_id  uuid not null references public.workout_items(id) on delete cascade,
  client_id        uuid not null references public.profiles(id) on delete cascade,
  set_number       int not null,
  reps             int,
  weight_kg        numeric,
  seconds          int,
  logged_at        timestamptz not null default now()
);
alter table public.set_logs enable row level security;

drop policy if exists "client owns set logs" on public.set_logs;
create policy "client owns set logs" on public.set_logs for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists "trainer reads set logs" on public.set_logs;
create policy "trainer reads set logs" on public.set_logs for select using (public.coaches(client_id));

-- ---------- OTHER ACTIVITY (walks, runs, classes, sport) ----------
create table if not exists public.activities (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.profiles(id) on delete cascade,
  activity_date date not null default current_date,
  type          text not null,
  minutes       int,
  distance_km   numeric,
  notes         text,
  created_at    timestamptz not null default now()
);
alter table public.activities enable row level security;

drop policy if exists "client owns activities" on public.activities;
create policy "client owns activities" on public.activities for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists "trainer reads activities" on public.activities;
create policy "trainer reads activities" on public.activities for select using (public.coaches(client_id));

-- ---------- BODY METRICS (weight, waist, body fat) ----------
create table if not exists public.body_metrics (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.profiles(id) on delete cascade,
  metric_date   date not null default current_date,
  weight_kg     numeric,
  waist_cm      numeric,
  body_fat_pct  numeric,
  created_at    timestamptz not null default now()
);
alter table public.body_metrics enable row level security;

drop policy if exists "client owns metrics" on public.body_metrics;
create policy "client owns metrics" on public.body_metrics for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists "trainer reads metrics" on public.body_metrics;
create policy "trainer reads metrics" on public.body_metrics for select using (public.coaches(client_id));

-- ---------- MESSAGES (trainer <-> client DMs) ----------
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles(id) on delete cascade,
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (length(body) between 1 and 4000),
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists messages_client_idx on public.messages (client_id, created_at);
alter table public.messages enable row level security;

drop policy if exists "chat participants read" on public.messages;
create policy "chat participants read" on public.messages for select using (
  client_id = auth.uid() or public.coaches(client_id)
);
drop policy if exists "chat participants send" on public.messages;
create policy "chat participants send" on public.messages for insert with check (
  sender_id = auth.uid() and (client_id = auth.uid() or public.coaches(client_id))
);
drop policy if exists "chat participants mark read" on public.messages;
create policy "chat participants mark read" on public.messages for update using (
  client_id = auth.uid() or public.coaches(client_id)
);

-- Live chat updates
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;

-- ---------- VIDEO STORAGE ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('exercise-videos', 'exercise-videos', false, 104857600)  -- 100 MB per clip
on conflict (id) do nothing;

drop policy if exists "signed-in users watch videos" on storage.objects;
create policy "signed-in users watch videos" on storage.objects for select
  using (bucket_id = 'exercise-videos' and auth.role() = 'authenticated');

drop policy if exists "trainer uploads videos" on storage.objects;
create policy "trainer uploads videos" on storage.objects for insert
  with check (bucket_id = 'exercise-videos' and public.is_trainer());

drop policy if exists "trainer replaces videos" on storage.objects;
create policy "trainer replaces videos" on storage.objects for update
  using (bucket_id = 'exercise-videos' and public.is_trainer());

drop policy if exists "trainer deletes videos" on storage.objects;
create policy "trainer deletes videos" on storage.objects for delete
  using (bucket_id = 'exercise-videos' and public.is_trainer());

-- =====================================================================
-- AFTER the trainer has signed up in the app, run this ONE line
-- (with her email) to make her the trainer:
--
--   update public.profiles set role = 'trainer' where email = 'her@email.com';
-- =====================================================================

-- =====================================================================
-- NUTRITION (optional, client chooses) — points-based food tracking
-- =====================================================================
alter table public.profiles add column if not exists tracks text[] not null default '{exercise}';  -- 'exercise', 'nutrition'
alter table public.profiles add column if not exists daily_points int;
alter table public.profiles add column if not exists goal_weight_kg numeric;

create table if not exists public.food_logs (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles(id) on delete cascade,
  log_date    date not null default current_date,
  meal        text not null default 'Snack' check (meal in ('Breakfast','Lunch','Dinner','Snack')),
  food_name   text not null,
  servings    numeric not null default 1,
  points      numeric not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists food_logs_client_idx on public.food_logs (client_id, log_date);
alter table public.food_logs enable row level security;

drop policy if exists "client owns food logs" on public.food_logs;
create policy "client owns food logs" on public.food_logs for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());

-- Client's own saved foods (label calculator results), reusable
create table if not exists public.custom_foods (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  serving    text,
  points     numeric not null,
  created_at timestamptz not null default now()
);
alter table public.custom_foods enable row level security;
drop policy if exists "client owns custom foods" on public.custom_foods;
create policy "client owns custom foods" on public.custom_foods for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());

-- =====================================================================
-- PAID ACCESS — library subscription and PT clients
-- plan: 'free' (assigned workouts only), 'library' (full video library), 'pt' (coaching + library)
-- =====================================================================
alter table public.profiles add column if not exists plan text not null default 'free';
alter table public.profiles add column if not exists access_until date;          -- null = no end date
alter table public.profiles add column if not exists library_free boolean not null default true;  -- trainer setting
do $$ begin
  alter table public.profiles add constraint profiles_plan_check check (plan in ('free','library','pt'));
exception when duplicate_object then null; end $$;

create or replace function public.has_library()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select t.library_free
           or (c.plan in ('library','pt') and (c.access_until is null or c.access_until >= current_date))
    from public.profiles c join public.profiles t on t.id = c.trainer_id
    where c.id = auth.uid()), false);
$$;

-- Clients see the full library only with access; exercises in their own workouts are always visible
drop policy if exists "clients read their trainer's library" on public.exercises;
create policy "clients read their trainer's library" on public.exercises for select using (
  trainer_id = public.my_trainer_id()
  and (public.has_library() or exists (
        select 1 from public.workout_items wi join public.workouts w on w.id = wi.workout_id
        where wi.exercise_id = exercises.id and w.client_id = auth.uid()))
);

-- Videos follow the same rule
drop policy if exists "signed-in users watch videos" on storage.objects;
create policy "signed-in users watch videos" on storage.objects for select using (
  bucket_id = 'exercise-videos'
  and (public.is_trainer() or exists (select 1 from public.exercises e where e.video_path = storage.objects.name))
);

-- Only the trainer can change plans / access dates
create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.role is distinct from old.role then
    raise exception 'Role can only be changed by the app owner';
  end if;
  if (new.trainer_id is distinct from old.trainer_id
      or new.plan is distinct from old.plan
      or new.access_until is distinct from old.access_until) and not public.is_trainer() then
    raise exception 'Only the trainer can change access';
  end if;
  return new;
end; $$;

-- =====================================================================
-- DAILY CHALLENGES — one small win a day (counts towards streaks)
-- =====================================================================
create table if not exists public.challenge_completions (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.profiles(id) on delete cascade,
  challenge_date  date not null default current_date,
  challenge       text not null,
  created_at      timestamptz not null default now(),
  unique (client_id, challenge_date)
);
alter table public.challenge_completions enable row level security;
drop policy if exists "client owns challenges" on public.challenge_completions;
create policy "client owns challenges" on public.challenge_completions for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists "trainer reads challenges" on public.challenge_completions;
create policy "trainer reads challenges" on public.challenge_completions for select using (public.coaches(client_id));

-- =====================================================================
-- DAILY CHECK-IN — energy, sleep, soreness (1–5) and an optional note
-- =====================================================================
create table if not exists public.checkins (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.profiles(id) on delete cascade,
  checkin_date  date not null default current_date,
  energy        int check (energy between 1 and 5),
  sleep         int check (sleep between 1 and 5),
  soreness      int check (soreness between 1 and 5),
  note          text check (length(note) <= 500),
  created_at    timestamptz not null default now(),
  unique (client_id, checkin_date)
);
alter table public.checkins enable row level security;
drop policy if exists "client owns checkins" on public.checkins;
create policy "client owns checkins" on public.checkins for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists "trainer reads checkins" on public.checkins;
create policy "trainer reads checkins" on public.checkins for select using (public.coaches(client_id));

-- =====================================================================
-- STREAK REWARDS, NUTRITION ON BY DEFAULT
-- =====================================================================
-- A library video can be a bonus that unlocks at a 7, 14 or 30-day streak
alter table public.exercises add column if not exists reward_streak int;
do $$ begin
  alter table public.exercises add constraint exercises_reward_streak_check check (reward_streak in (7, 14, 30));
exception when duplicate_object then null; end $$;

-- Nutrition is switched on for every client unless they turn it off
alter table public.profiles alter column tracks set default '{exercise,nutrition}';
update public.profiles set tracks = array_append(tracks, 'nutrition')
  where role = 'client' and not ('nutrition' = any(tracks));

-- The logged-in client's best run of consecutive active days (any set, activity,
-- finished workout, daily challenge or day they opened the app)
create or replace function public.best_streak()
returns int language sql stable security definer set search_path = public as $$
  with d as (
    select distinct dt from (
      select (logged_at at time zone 'Africa/Johannesburg')::date as dt from public.set_logs where client_id = auth.uid()
      union select activity_date from public.activities where client_id = auth.uid()
      union select (completed_at at time zone 'Africa/Johannesburg')::date from public.workouts where client_id = auth.uid() and completed_at is not null
      union select challenge_date from public.challenge_completions where client_id = auth.uid()
      union select checkin_date from public.checkins where client_id = auth.uid()
    ) x),
  g as (select dt - (row_number() over (order by dt))::int as grp from d)
  select coalesce(max(n), 0)::int from (select count(*) as n from g group by grp) s;
$$;

-- Which streak milestones have a bonus video waiting (names stay hidden until unlocked)
create or replace function public.reward_milestones()
returns int[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct reward_streak order by reward_streak), '{}')
  from public.exercises where trainer_id = public.my_trainer_id() and reward_streak is not null;
$$;

-- Clients see: library videos with a pass, bonus videos once their streak earns them,
-- and anything in their own workouts
drop policy if exists "clients read their trainer's library" on public.exercises;
create policy "clients read their trainer's library" on public.exercises for select using (
  trainer_id = public.my_trainer_id()
  and (
    (reward_streak is null and public.has_library())
    or (reward_streak is not null and public.best_streak() >= reward_streak)
    or exists (select 1 from public.workout_items wi join public.workouts w on w.id = wi.workout_id
               where wi.exercise_id = exercises.id and w.client_id = auth.uid())
  )
);
