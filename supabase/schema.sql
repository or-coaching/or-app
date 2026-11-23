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

-- =====================================================================
-- EXERCISE TYPES (warm-up, cool-down, chill set, or the coach's own)
-- =====================================================================
alter table public.exercises add column if not exists categories text[] not null default '{}';

-- =====================================================================
-- ANIMATED DEMOS, WORKOUT SECTIONS, CLIENT WEIGHTS
-- =====================================================================
alter table public.exercises add column if not exists demo_move text;            -- animation used until a video is uploaded
alter table public.workout_items add column if not exists section text;          -- 'Warm-up', 'Main set', 'Cool-down'
alter table public.profiles add column if not exists weights_note text check (length(weights_note) <= 300);  -- weights the client has

-- =====================================================================
-- PROFILE PHOTOS AND PROGRESS PHOTOS (private: the person and their coach only)
-- =====================================================================
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists photos_opt_in boolean not null default false;
alter table public.profiles add column if not exists photos_consent_at timestamptz;

create table if not exists public.progress_photos (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles(id) on delete cascade,
  taken_on    date not null default current_date,
  angle       text not null default 'Front' check (angle in ('Front','Side','Back')),
  path        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists progress_photos_client_idx on public.progress_photos (client_id, taken_on);
alter table public.progress_photos enable row level security;
drop policy if exists "client owns progress photos" on public.progress_photos;
create policy "client owns progress photos" on public.progress_photos for all
  using (client_id = auth.uid()) with check (client_id = auth.uid() and (select photos_opt_in from public.profiles where id = auth.uid()));
drop policy if exists "coach sees opted-in progress photos" on public.progress_photos;
create policy "coach sees opted-in progress photos" on public.progress_photos for select using (
  public.coaches(client_id) and (select photos_opt_in from public.profiles where id = client_id));

-- Storage files live under "<user id>/..." so the folder name says who owns them.
create or replace function public.owner_of(object_name text)
returns uuid language plpgsql immutable as $$
begin
  return split_part(object_name, '/', 1)::uuid;
exception when others then return null;
end; $$;

insert into storage.buckets (id, name, public, file_size_limit) values ('avatars', 'avatars', false, 2097152) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit) values ('progress-photos', 'progress-photos', false, 5242880) on conflict (id) do nothing;

drop policy if exists "avatars: owner, their coach or their clients can view" on storage.objects;
create policy "avatars: owner, their coach or their clients can view" on storage.objects for select using (
  bucket_id = 'avatars' and (public.owner_of(name) = auth.uid() or public.coaches(public.owner_of(name)) or public.owner_of(name) = public.my_trainer_id()));
drop policy if exists "avatars: owner uploads" on storage.objects;
create policy "avatars: owner uploads" on storage.objects for insert with check (bucket_id = 'avatars' and public.owner_of(name) = auth.uid());
drop policy if exists "avatars: owner replaces" on storage.objects;
create policy "avatars: owner replaces" on storage.objects for update using (bucket_id = 'avatars' and public.owner_of(name) = auth.uid());
drop policy if exists "avatars: owner deletes" on storage.objects;
create policy "avatars: owner deletes" on storage.objects for delete using (bucket_id = 'avatars' and public.owner_of(name) = auth.uid());

drop policy if exists "progress photos: owner or coach can view" on storage.objects;
create policy "progress photos: owner or coach can view" on storage.objects for select using (
  bucket_id = 'progress-photos' and (public.owner_of(name) = auth.uid()
    or (public.coaches(public.owner_of(name)) and (select photos_opt_in from public.profiles where id = public.owner_of(name)))));
drop policy if exists "progress photos: owner uploads" on storage.objects;
create policy "progress photos: owner uploads" on storage.objects for insert with check (
  bucket_id = 'progress-photos' and public.owner_of(name) = auth.uid() and (select photos_opt_in from public.profiles where id = auth.uid()));
drop policy if exists "progress photos: owner deletes" on storage.objects;
create policy "progress photos: owner deletes" on storage.objects for delete using (bucket_id = 'progress-photos' and public.owner_of(name) = auth.uid());

-- =====================================================================
-- CALORIES OR POINTS (client chooses how to count food)
-- =====================================================================
alter table public.profiles add column if not exists nutrition_mode text not null default 'points';
do $$ begin
  alter table public.profiles add constraint profiles_nutrition_mode_check check (nutrition_mode in ('points','calories'));
exception when duplicate_object then null; end $$;
alter table public.profiles add column if not exists daily_kcal int;
alter table public.food_logs add column if not exists kcal numeric;
alter table public.custom_foods add column if not exists kcal numeric;

-- =====================================================================
-- HEALTH SCREENING, RISK ACKNOWLEDGEMENT AND EMERGENCY CONTACT
-- Health information is special personal information under POPIA:
-- only the client and their own coach can see it.
-- =====================================================================
create table if not exists public.health_screens (
  client_id          uuid primary key references public.profiles(id) on delete cascade,
  answers            jsonb not null default '{}',
  flags              int not null default 0,          -- number of "yes" answers (set by the database)
  details            text check (length(details) <= 1000),
  emergency_name     text check (length(emergency_name) <= 120),
  emergency_phone    text check (length(emergency_phone) <= 40),
  waiver_accepted_at timestamptz not null,
  health_consent_at  timestamptz not null,
  cleared_at         timestamptz,                     -- set by the coach once she's happy (e.g. doctor's note)
  updated_at         timestamptz not null default now()
);
alter table public.health_screens enable row level security;
drop policy if exists "client owns health screen" on public.health_screens;
create policy "client owns health screen" on public.health_screens for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists "coach reads health screen" on public.health_screens;
create policy "coach reads health screen" on public.health_screens for select using (public.coaches(client_id));
drop policy if exists "coach clears health screen" on public.health_screens;
create policy "coach clears health screen" on public.health_screens for update using (public.coaches(client_id));

create or replace function public.guard_health_screen()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.flags := (select count(*) from jsonb_each(new.answers) where value = 'true'::jsonb);
  new.updated_at := now();
  if auth.uid() is null then return new; end if;
  if tg_op = 'UPDATE' and public.is_trainer() then
    -- the coach may only record clearance
    new.answers := old.answers; new.flags := old.flags; new.details := old.details;
    new.emergency_name := old.emergency_name; new.emergency_phone := old.emergency_phone;
    new.waiver_accepted_at := old.waiver_accepted_at; new.health_consent_at := old.health_consent_at;
    new.updated_at := old.updated_at;
    return new;
  end if;
  -- the client can never clear themselves; a changed answer needs fresh clearance
  if tg_op = 'INSERT' then new.cleared_at := null;
  elsif new.answers is distinct from old.answers then new.cleared_at := null;
  else new.cleared_at := old.cleared_at; end if;
  return new;
end; $$;
drop trigger if exists guard_health_screen on public.health_screens;
create trigger guard_health_screen before insert or update on public.health_screens
  for each row execute function public.guard_health_screen();

-- =====================================================================
-- COACH NOTES (private to the coach)
-- =====================================================================
create table if not exists public.coach_notes (
  id          uuid primary key default gen_random_uuid(),
  trainer_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  client_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index if not exists coach_notes_client_idx on public.coach_notes (client_id, created_at);
alter table public.coach_notes enable row level security;
drop policy if exists "coach owns notes" on public.coach_notes;
create policy "coach owns notes" on public.coach_notes for all
  using (trainer_id = auth.uid() and public.coaches(client_id))
  with check (trainer_id = auth.uid() and public.coaches(client_id));

-- =====================================================================
-- WORKOUT TEMPLATES (build once, assign to many clients or weeks)
-- =====================================================================
create table if not exists public.workout_templates (
  id          uuid primary key default gen_random_uuid(),
  trainer_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name        text not null check (length(name) <= 120),
  notes       text,
  items       jsonb not null default '[]',
  created_at  timestamptz not null default now()
);
alter table public.workout_templates enable row level security;
drop policy if exists "coach owns templates" on public.workout_templates;
create policy "coach owns templates" on public.workout_templates for all
  using (trainer_id = auth.uid() and public.is_trainer())
  with check (trainer_id = auth.uid() and public.is_trainer());

-- =====================================================================
-- REFERRALS, SHARING CONSENT
-- =====================================================================
alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists referred_by uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists share_consent_at timestamptz;  -- ok for coach to post before/after
update public.profiles set referral_code = upper(substr(md5(id::text), 1, 8)) where referral_code is null;
create unique index if not exists profiles_referral_code_idx on public.profiles (referral_code);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare ref uuid; code text := upper(substr(md5(new.id::text), 1, 8));
begin
  while exists (select 1 from public.profiles where referral_code = code) loop
    code := upper(substr(md5(random()::text), 1, 8));
  end loop;
  select id into ref from public.profiles
    where referral_code = upper(nullif(trim(new.raw_user_meta_data->>'ref'), '')) limit 1;
  insert into public.profiles (id, full_name, email, popia_consent_at, referral_code, referred_by)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    case when (new.raw_user_meta_data->>'popia_consent') = 'true' then now() else null end,
    code,
    ref
  );
  return new;
end; $$;

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
  if new.referral_code is distinct from old.referral_code or new.referred_by is distinct from old.referred_by then
    raise exception 'Referral details can''t be changed';
  end if;
  return new;
end; $$;

-- =====================================================================
-- WATER (one running total per client per day)
-- =====================================================================
alter table public.profiles add column if not exists water_goal_ml int check (water_goal_ml between 500 and 8000);
create table if not exists public.water_logs (
  client_id  uuid not null references public.profiles(id) on delete cascade,
  log_date   date not null default current_date,
  ml         int not null default 0 check (ml between 0 and 15000),
  updated_at timestamptz not null default now(),
  primary key (client_id, log_date)
);
alter table public.water_logs enable row level security;
drop policy if exists "client owns water" on public.water_logs;
create policy "client owns water" on public.water_logs for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists "coach reads water" on public.water_logs;
create policy "coach reads water" on public.water_logs for select using (public.coaches(client_id));

-- =====================================================================
-- EXERCISE CATEGORIES, WORKOUT LIBRARY LINK
-- =====================================================================
alter table public.exercises add column if not exists category text;   -- Strength, Cardio, Core, Mobility, Stretch, Power, Balance
-- Which saved workout a client's workout was copied from. The copy is independent:
-- editing it never changes the saved workout or anyone else's copy.
alter table public.workouts add column if not exists template_id uuid references public.workout_templates(id) on delete set null;

-- =====================================================================
-- EXERCISE VIDEO LINKS, LEVELS, "GOOD FOR"; LIBRARY LOCKED BY DEFAULT
-- =====================================================================
alter table public.exercises add column if not exists video_url text check (video_url is null or video_url like 'https://%');
alter table public.exercises add column if not exists level text;    -- Beginner, Intermediate, Advanced
alter table public.exercises add column if not exists tags text[] not null default '{}';  -- Low impact, Seated, Balance, Single side
-- The full library is a paid extra unless the coach chooses to make it free (Settings).
alter table public.profiles alter column library_free set default false;

-- =====================================================================
-- GUIDED WORKOUT RESULTS (how long it took, how hard it felt, client notes)
-- =====================================================================
alter table public.workouts add column if not exists duration_seconds int check (duration_seconds is null or duration_seconds between 0 and 86400);
alter table public.workouts add column if not exists difficulty smallint check (difficulty is null or difficulty between 1 and 5);
alter table public.workouts add column if not exists client_feedback text check (length(client_feedback) <= 1000);

-- =====================================================================
-- MUSCLES WORKED + CLIENT NOTE PER EXERCISE
-- =====================================================================
-- Coach's own pick of muscles for the body map (null = use the animation's muscles).
alter table public.exercises add column if not exists muscles text[];
-- A client's note to the coach about one exercise in one workout ("felt it in my lower back").
create table if not exists public.item_notes (
  workout_item_id uuid primary key references public.workout_items(id) on delete cascade,
  client_id       uuid not null references public.profiles(id) on delete cascade,
  note            text not null check (length(note) between 1 and 1000),
  updated_at      timestamptz not null default now()
);
alter table public.item_notes enable row level security;
drop policy if exists "client owns item notes" on public.item_notes;
create policy "client owns item notes" on public.item_notes for all
  using (client_id = auth.uid())
  with check (client_id = auth.uid() and exists (
    select 1 from public.workout_items wi join public.workouts w on w.id = wi.workout_id
    where wi.id = workout_item_id and w.client_id = auth.uid()));
drop policy if exists "coach reads item notes" on public.item_notes;
create policy "coach reads item notes" on public.item_notes for select using (public.coaches(client_id));

-- =====================================================================
-- WORKOUT FOLDERS, EDIT DATES, RICHER EXERCISE RECORDS
-- =====================================================================
-- Coach's own folders for master workouts (Glute programmes, Beginners...). Client folders are automatic:
-- a client's folder is simply their own workouts. Deleting a folder never deletes workouts: they move to General.
create table if not exists public.workout_folders (
  id          uuid primary key default gen_random_uuid(),
  trainer_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 60),
  created_at  timestamptz not null default now()
);
alter table public.workout_folders enable row level security;
drop policy if exists "coach owns folders" on public.workout_folders;
create policy "coach owns folders" on public.workout_folders for all
  using (trainer_id = auth.uid() and public.is_trainer())
  with check (trainer_id = auth.uid() and public.is_trainer());
alter table public.workout_templates add column if not exists folder_id uuid references public.workout_folders(id) on delete set null;
alter table public.workout_templates add column if not exists updated_at timestamptz not null default now();
alter table public.workouts add column if not exists updated_at timestamptz not null default now();
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists touch_templates on public.workout_templates;
create trigger touch_templates before update on public.workout_templates for each row execute function public.touch_updated_at();
drop trigger if exists touch_workouts on public.workouts;
create trigger touch_workouts before update on public.workouts for each row execute function public.touch_updated_at();
-- A folder must belong to the same coach as the workout filed in it.
create or replace function public.check_template_folder() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.folder_id is not null and not exists (select 1 from public.workout_folders f where f.id = new.folder_id and f.trainer_id = new.trainer_id) then
    raise exception 'Folder not found';
  end if;
  return new;
end $$;
drop trigger if exists check_template_folder on public.workout_templates;
create trigger check_template_folder before insert or update of folder_id on public.workout_templates for each row execute function public.check_template_folder();

-- Exercise record: secondary muscles, demo model, easier/harder options and modifications.
alter table public.exercises add column if not exists muscles2 text[];
alter table public.exercises add column if not exists model text check (model is null or model in ('female', 'male'));
alter table public.exercises add column if not exists easier text check (length(easier) <= 500);
alter table public.exercises add column if not exists harder text check (length(harder) <= 500);
alter table public.exercises add column if not exists modifications text check (length(modifications) <= 1000);
alter table public.exercises add column if not exists easier_id uuid references public.exercises(id) on delete set null;
alter table public.exercises add column if not exists harder_id uuid references public.exercises(id) on delete set null;
