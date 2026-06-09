-- BetUs — Snapshot des rangs pour notifier les changements de classement.
-- L'Edge Function compare le rang courant au rang stocké et notifie chaque joueur.

create table if not exists public.rank_snapshot (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  rank int not null,
  total_points int not null,
  updated_at timestamptz not null default now()
);

alter table public.rank_snapshot enable row level security;  -- service role uniquement

-- Classement ordonné avec les départages du règlement, rang calculé en SQL.
-- Réutilisé par l'Edge Function (lecture via service role).
create or replace view public.ranked_leaderboard
with (security_invoker = on) as
select
  user_id,
  display_name,
  total_points,
  rank() over (
    order by total_points desc, exact_count desc, scorer_count desc, assister_count desc
  ) as rank
from public.leaderboard;
