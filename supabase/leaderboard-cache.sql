-- ---------------------------------------------------------------------------
-- Classement précalculé (cache) — lu par le client à la place de la vue
-- `leaderboard`, qui est coûteuse à recalculer (~1,7 s : agrégat match_points
-- + tournament_points par profil). On déplace ce coût dans le chemin d'écriture
-- (admin qui saisit un résultat, tick livescore) : la lecture côté joueur devient
-- quasi-instantanée. Refresh déclenché par triggers uniquement quand un champ
-- qui change réellement les points bouge.
-- ---------------------------------------------------------------------------

create table if not exists public.leaderboard_cache (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_name       text    not null,
  has_paid           boolean not null default false,
  total_points       int     not null default 0,
  match_points       int     not null default 0,
  tournament_points  int     not null default 0,
  exact_count        int     not null default 0,
  scorer_count       int     not null default 0,
  assister_count     int     not null default 0,
  winner_count       int     not null default 0,
  predictions_scored int     not null default 0,
  rank               int     not null default 0,
  updated_at         timestamptz not null default now()
);

alter table public.leaderboard_cache enable row level security;

-- Lecture pour tous les joueurs connectés ; écriture réservée au service role /
-- à la fonction de refresh (security definer). Même pattern que top_players.
drop policy if exists "leaderboard_cache read" on public.leaderboard_cache;
create policy "leaderboard_cache read" on public.leaderboard_cache
  for select to authenticated using (true);

-- Recalcule tout le classement depuis la vue `leaderboard` (+ rang, mêmes
-- départages que ranked_leaderboard) et le stocke. security definer pour pouvoir
-- écrire la table malgré la RLS, quel que soit l'utilisateur dont l'écriture a
-- déclenché le trigger.
create or replace function public.refresh_leaderboard_cache() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.leaderboard_cache;
  insert into public.leaderboard_cache (
    user_id, display_name, has_paid, total_points, match_points, tournament_points,
    exact_count, scorer_count, assister_count, winner_count, predictions_scored, rank, updated_at
  )
  select
    l.user_id, l.display_name, l.has_paid, l.total_points, l.match_points, l.tournament_points,
    l.exact_count, l.scorer_count, l.assister_count, l.winner_count, l.predictions_scored,
    rank() over (
      order by l.total_points desc, l.exact_count desc, l.scorer_count desc, l.assister_count desc
    ),
    now()
  from public.leaderboard l;
end $$;

-- Wrapper trigger (la fonction de refresh ci-dessus, elle, est appelable en RPC).
create or replace function public.trg_refresh_leaderboard_cache() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_leaderboard_cache();
  return null;
end $$;

-- matches : seulement quand un champ qui change les points bouge. On IGNORE
-- volontairement minute / period / goals_timeline / stats (màj livescore très
-- fréquentes, sans impact sur le classement) pour ne pas refresher en boucle.
drop trigger if exists matches_refresh_leaderboard on public.matches;
create trigger matches_refresh_leaderboard
after update on public.matches
for each row
when (
  old.status          is distinct from new.status
  or old.home_score      is distinct from new.home_score
  or old.away_score      is distinct from new.away_score
  or old.winner_override is distinct from new.winner_override
  or old.scorers         is distinct from new.scorers
  or old.assisters       is distinct from new.assisters
  or old.subs            is distinct from new.subs
)
execute function public.trg_refresh_leaderboard_cache();

-- profiles : nouveau joueur / suppression, ou changement de has_paid (cagnotte)
-- ou de display_name (affiché dans le classement).
drop trigger if exists profiles_ins_del_refresh_leaderboard on public.profiles;
create trigger profiles_ins_del_refresh_leaderboard
after insert or delete on public.profiles
for each row execute function public.trg_refresh_leaderboard_cache();

drop trigger if exists profiles_upd_refresh_leaderboard on public.profiles;
create trigger profiles_upd_refresh_leaderboard
after update on public.profiles
for each row
when (old.has_paid is distinct from new.has_paid
   or old.display_name is distinct from new.display_name)
execute function public.trg_refresh_leaderboard_cache();

-- tournament_results : la saisie des résultats de tournoi change les points tournoi.
drop trigger if exists tournament_results_refresh_leaderboard on public.tournament_results;
create trigger tournament_results_refresh_leaderboard
after insert or update or delete on public.tournament_results
for each row execute function public.trg_refresh_leaderboard_cache();

-- Remplissage initial.
select public.refresh_leaderboard_cache();
