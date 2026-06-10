-- BetUs — Concours de pronostics Coupe du Monde 2026
-- Schéma complet : tables, RLS, scoring. Idempotent (drop/create des objets dérivés).

set check_function_bodies = off;

create extension if not exists unaccent with schema extensions;
create extension if not exists fuzzystrmatch with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Comparaison de noms insensible casse/accents/espaces ("Konaté " = "konate")
create or replace function public.norm_name(t text) returns text
language sql stable as
$$ select lower(trim(regexp_replace(extensions.unaccent(coalesce(t, '')), '\s+', ' ', 'g'))) $$;

-- Comparaison tolérante aux fautes de frappe : égalité après normalisation, ou
-- distance de Levenshtein ≤ 1 (noms ≥ 5 lettres) / ≤ 2 (noms ≥ 9 lettres), à
-- condition que la première lettre corresponde (évite Hernandez ↔ Fernandez).
create or replace function public.name_matches(a text, b text) returns boolean
language sql stable as $$
  select case
    when a is null or b is null then false
    else (
      with n as (select public.norm_name(a) as x, public.norm_name(b) as y)
      select x = y
        or (left(x, 1) = left(y, 1)
            and greatest(length(x), length(y)) >= 5
            and extensions.levenshtein(x, y) <=
                case when greatest(length(x), length(y)) >= 9 then 2 else 1 end)
      from n
    )
  end
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false) $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  is_admin boolean not null default false,
  has_paid boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id int primary key,                      -- numéro officiel du match (1..104)
  stage text not null check (stage in
    ('group','round_of_32','round_of_16','quarter_final','semi_final','third_place','final')),
  group_name text,
  home_team text not null,                 -- placeholder type '1A' ou 'W73' tant que non déterminé
  away_team text not null,
  home_code text,
  away_code text,
  kickoff_at timestamptz not null,
  city text,
  venue text,
  status text not null default 'scheduled' check (status in ('scheduled','live','finished')),
  home_score int,
  away_score int,
  winner_override text check (winner_override in ('home','away')),  -- vainqueur aux tirs au but
  scorers text[] not null default '{}',
  assisters text[] not null default '{}'
);

create table if not exists public.predictions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id int not null references public.matches(id) on delete cascade,
  winner text check (winner in ('home','draw','away')),
  pred_home_score int check (pred_home_score between 0 and 20),
  pred_away_score int check (pred_away_score between 0 and 20),
  scorer text,
  assister text,
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);
create index if not exists predictions_match_idx on public.predictions (match_id);
create index if not exists predictions_user_idx on public.predictions (user_id);

create table if not exists public.tournament_predictions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  top_scorer text,
  top_assister text,
  best_keeper text,
  finalist_a text,
  finalist_b text,
  winner text,
  best_player text,
  updated_at timestamptz not null default now()
);

-- Singletons (id contraint à true)
create table if not exists public.tournament_results (
  id boolean primary key default true check (id),
  top_scorer text,
  top_assister text,
  best_keeper text,
  finalist_a text,
  finalist_b text,
  winner text,
  best_player text
);

create table if not exists public.settings (
  id boolean primary key default true check (id),
  tournament_start timestamptz not null
);

insert into public.settings (id, tournament_start)
values (true, '2026-06-11T23:00:00Z')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
                           split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Un joueur ne peut pas se promouvoir admin ni se marquer payé lui-même
create or replace function public.protect_profile_flags() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;  -- service role / admin : autorisé
  end if;
  if new.is_admin is distinct from old.is_admin
     or new.has_paid is distinct from old.has_paid then
    raise exception 'modification non autorisée';
  end if;
  return new;
end $$;

drop trigger if exists protect_profile_flags on public.profiles;
create trigger protect_profile_flags
before update on public.profiles
for each row execute function public.protect_profile_flags();

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists predictions_touch on public.predictions;
create trigger predictions_touch before update on public.predictions
for each row execute function public.touch_updated_at();

drop trigger if exists tournament_predictions_touch on public.tournament_predictions;
create trigger tournament_predictions_touch before update on public.tournament_predictions
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — le règlement est appliqué par la base
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;
alter table public.tournament_predictions enable row level security;
alter table public.tournament_results enable row level security;
alter table public.settings enable row level security;

create or replace function public.tournament_locked() returns boolean
language sql stable as
$$ select now() >= (select tournament_start from public.settings where id) $$;

create or replace function public.match_started(p_match_id int) returns boolean
language sql stable as
$$ select exists (select 1 from public.matches m where m.id = p_match_id and now() >= m.kickoff_at) $$;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- matches : lecture pour tous, écriture admin
drop policy if exists matches_select on public.matches;
create policy matches_select on public.matches for select to anon, authenticated using (true);
drop policy if exists matches_admin_write on public.matches;
create policy matches_admin_write on public.matches for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- predictions : les siens toujours ; ceux des autres une fois le match commencé.
-- Écriture uniquement avant le coup d'envoi.
drop policy if exists predictions_select on public.predictions;
create policy predictions_select on public.predictions for select to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.match_started(match_id));
drop policy if exists predictions_insert on public.predictions;
create policy predictions_insert on public.predictions for insert to authenticated
  with check (user_id = auth.uid() and not public.match_started(match_id));
drop policy if exists predictions_update on public.predictions;
create policy predictions_update on public.predictions for update to authenticated
  using (user_id = auth.uid() and not public.match_started(match_id))
  with check (user_id = auth.uid() and not public.match_started(match_id));
drop policy if exists predictions_delete on public.predictions;
create policy predictions_delete on public.predictions for delete to authenticated
  using (user_id = auth.uid() and not public.match_started(match_id));

-- tournament_predictions : verrouillés au début de la compétition
drop policy if exists tpred_select on public.tournament_predictions;
create policy tpred_select on public.tournament_predictions for select to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.tournament_locked());
drop policy if exists tpred_insert on public.tournament_predictions;
create policy tpred_insert on public.tournament_predictions for insert to authenticated
  with check (user_id = auth.uid() and not public.tournament_locked());
drop policy if exists tpred_update on public.tournament_predictions;
create policy tpred_update on public.tournament_predictions for update to authenticated
  using (user_id = auth.uid() and not public.tournament_locked())
  with check (user_id = auth.uid() and not public.tournament_locked());

-- tournament_results / settings : lecture pour tous, écriture admin
drop policy if exists tres_select on public.tournament_results;
create policy tres_select on public.tournament_results for select to anon, authenticated using (true);
drop policy if exists tres_admin_write on public.tournament_results;
create policy tres_admin_write on public.tournament_results for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings for select to anon, authenticated using (true);
drop policy if exists settings_admin_write on public.settings;
create policy settings_admin_write on public.settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Scoring — vues calculées (source de vérité unique)
-- ---------------------------------------------------------------------------

-- Issue réelle d'un match terminé ('home'/'draw'/'away'), TAB inclus via winner_override
create or replace function public.actual_outcome(m public.matches) returns text
language sql stable as $$
  select case
    when m.status <> 'finished' or m.home_score is null or m.away_score is null then null
    when m.home_score > m.away_score then 'home'
    when m.home_score < m.away_score then 'away'
    else coalesce(m.winner_override, 'draw')
  end
$$;

drop view if exists public.leaderboard;
drop view if exists public.match_points;

create view public.match_points
with (security_invoker = on) as
select
  p.user_id,
  p.match_id,
  m.status,
  (p.winner is not null and p.winner = public.actual_outcome(m))::int * 2              as winner_pts,
  case when exists (
    select 1 from unnest(m.scorers) s where public.name_matches(s, p.scorer)
  ) then 4 else 0 end                                                                  as scorer_pts,
  case when exists (
    select 1 from unnest(m.assisters) a where public.name_matches(a, p.assister)
  ) then 4 else 0 end                                                                  as assister_pts,
  case when p.pred_home_score is not null and m.status = 'finished'
        and p.pred_home_score = m.home_score and p.pred_away_score = m.away_score
  then 6 else 0 end                                                                    as exact_pts
from public.predictions p
join public.matches m on m.id = p.match_id
where m.status = 'finished';

create or replace function public.tournament_points(uid uuid) returns int
language sql stable as $$
  select coalesce((
    select
        6  * public.name_matches(tp.top_scorer, tr.top_scorer)::int
      + 8  * public.name_matches(tp.top_assister, tr.top_assister)::int
      + 10 * public.name_matches(tp.best_keeper, tr.best_keeper)::int
      + 15 * (public.norm_name(tp.winner) = public.norm_name(tr.winner) and tr.winner is not null)::int
      + 6  * public.name_matches(tp.best_player, tr.best_player)::int
        -- finale : la paire de finalistes, peu importe l'ordre — 20 pts
      + 20 * (tr.finalist_a is not null and tr.finalist_b is not null
            and public.norm_name(tp.finalist_a) in (public.norm_name(tr.finalist_a), public.norm_name(tr.finalist_b))
            and public.norm_name(tp.finalist_b) in (public.norm_name(tr.finalist_a), public.norm_name(tr.finalist_b))
            and public.norm_name(tp.finalist_a) <> public.norm_name(tp.finalist_b))::int
    from public.tournament_predictions tp
    cross join public.tournament_results tr
    where tp.user_id = uid
  ), 0)
$$;

create view public.leaderboard
with (security_invoker = on) as
select
  pr.id as user_id,
  pr.display_name,
  pr.has_paid,
  coalesce(mp.match_total, 0) + public.tournament_points(pr.id) as total_points,
  coalesce(mp.match_total, 0)                                   as match_points,
  public.tournament_points(pr.id)                               as tournament_points,
  coalesce(mp.exact_count, 0)    as exact_count,     -- départage 1
  coalesce(mp.scorer_count, 0)   as scorer_count,    -- départage 2
  coalesce(mp.assister_count, 0) as assister_count,  -- départage 3
  coalesce(mp.winner_count, 0)   as winner_count,
  coalesce(mp.played, 0)         as predictions_scored
from public.profiles pr
left join (
  select user_id,
         sum(winner_pts + scorer_pts + assister_pts + exact_pts) as match_total,
         count(*) filter (where exact_pts > 0)    as exact_count,
         count(*) filter (where scorer_pts > 0)   as scorer_count,
         count(*) filter (where assister_pts > 0) as assister_count,
         count(*) filter (where winner_pts > 0)   as winner_count,
         count(*)                                  as played
  from public.match_points
  group by user_id
) mp on mp.user_id = pr.id;

-- ---------------------------------------------------------------------------
-- Realtime : classement mis à jour en direct quand l'admin saisit un résultat
-- ---------------------------------------------------------------------------

do $$
begin
  alter publication supabase_realtime add table public.matches;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null;
end $$;
