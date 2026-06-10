-- BetUs — Live score via football-data.org (score uniquement, l'admin valide le final).
-- Table de correspondance entre nos matchs (1..104) et les id football-data.org.

create table if not exists public.match_fd (
  match_id int primary key references public.matches(id) on delete cascade,
  fd_id int unique not null
);

alter table public.match_fd enable row level security;  -- service role uniquement
