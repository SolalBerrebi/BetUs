-- BetUs — Course au Soulier d'Or / Passe d'Or : top buteurs & passeurs du tournoi,
-- rafraîchis par l'Edge Function depuis /players/topscorers & /players/topassists.
-- Branché sur les paris tournoi (top_scorer / top_assister) pour surligner le pari du joueur.
create table if not exists public.top_players (
  category text not null check (category in ('scorer', 'assister')),
  rank int not null,
  player text not null,        -- nom canonique (surname) si résolu au roster, sinon nom API
  full_name text,
  team_code text,
  value int not null default 0, -- buts (scorer) ou passes décisives (assister)
  primary key (category, rank)
);

alter table public.top_players enable row level security;

-- Lecture pour tous les joueurs connectés ; écriture réservée au service role.
drop policy if exists "top_players read" on public.top_players;
create policy "top_players read" on public.top_players
  for select to authenticated using (true);
