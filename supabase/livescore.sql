-- BetUs — Live score + auto-import des résultats via API-Football (api-sports.io).
-- Le score live met à jour matches.home_score/away_score + status='live'.
-- À la fin du match, un BROUILLON est proposé à l'admin (buteurs/passeurs) ;
-- rien n'est compté tant qu'Ouriel n'a pas validé → l'admin reste source de vérité.

-- Ancienne table football-data abandonnée (on est passé à API-Football)
drop table if exists public.match_fd;

-- Correspondance nos matchs (1..104) ↔ fixtures API-Football
create table if not exists public.match_api (
  match_id int primary key references public.matches(id) on delete cascade,
  fixture_id int unique not null
);
alter table public.match_api enable row level security;  -- service role uniquement

-- Brouillon de résultat proposé automatiquement (vérifié puis validé par l'admin)
create table if not exists public.result_draft (
  match_id int primary key references public.matches(id) on delete cascade,
  home_score int,
  away_score int,
  winner_override text check (winner_override in ('home','away')),
  scorers text[] not null default '{}',
  assisters text[] not null default '{}',
  own_goals text[] not null default '{}',
  fixture_status text,
  fetched_at timestamptz not null default now()
);
alter table public.result_draft enable row level security;

-- Lecture des brouillons réservée aux admins (affichés dans l'écran admin)
drop policy if exists result_draft_admin on public.result_draft;
create policy result_draft_admin on public.result_draft for select to authenticated
  using (public.is_admin());
