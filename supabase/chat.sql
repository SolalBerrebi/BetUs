-- BetUs — Salon de match : chat persisté, ouvert au coup d'envoi.
-- Symétrique du verrouillage des pronos : on pronostique AVANT le coup d'envoi,
-- on discute À PARTIR du coup d'envoi.

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  match_id int not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists messages_match_idx on public.messages (match_id, created_at);

alter table public.messages enable row level security;

-- Lecture : tout le monde une fois le match commencé (ou ses propres messages / admin)
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.match_started(match_id));

-- Écriture : ses propres messages, du coup d'envoi jusqu'à la clôture du match.
-- Le salon se ferme quand l'admin valide le résultat (status 'finished').
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.match_started(match_id)
    and not public.match_finished(match_id)
  );

-- Suppression : son propre message, ou l'admin (modération)
drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;
