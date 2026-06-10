-- BetUs — Note perso sur ses pronos + fil de commentaires sur la fiche de chaque joueur.

-- 1) Note perso (une phrase par joueur, modifiable par lui, visible par tous)
alter table public.profiles add column if not exists pronos_note text;
-- (les policies profiles existantes couvrent déjà : select=true, update=(id=auth.uid() or is_admin()))

-- 2) Fil de commentaires attaché à un joueur cible
create table if not exists public.player_comments (
  id bigint generated always as identity primary key,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists player_comments_target_idx on public.player_comments(target_user_id, created_at);

alter table public.player_comments enable row level security;

drop policy if exists pc_select on public.player_comments;
create policy pc_select on public.player_comments for select to authenticated using (true);

drop policy if exists pc_insert on public.player_comments;
create policy pc_insert on public.player_comments for insert to authenticated
  with check (author_id = auth.uid());

drop policy if exists pc_delete on public.player_comments;
create policy pc_delete on public.player_comments for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- Realtime pour voir les commentaires apparaître en direct
alter publication supabase_realtime add table public.player_comments;
