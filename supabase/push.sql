-- BetUs — Phase 3 : notifications push (abonnements, rappels cron, trigger résultats)
-- À exécuter après schema.sql. Remplacer __PUSH_SECRET__ avant exécution.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Abonnements Web Push
-- ---------------------------------------------------------------------------

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subs_own on public.push_subscriptions;
create policy push_subs_own on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Journal d'envoi : évite les doublons de rappels (cron toutes les 5 min)
create table if not exists public.push_log (
  kind text not null,
  match_id int not null,
  sent_at timestamptz not null default now(),
  primary key (kind, match_id)
);
alter table public.push_log enable row level security;  -- accès service role uniquement

-- ---------------------------------------------------------------------------
-- Rappel « les pronos ferment dans 1 h » — cron toutes les 5 minutes
-- ---------------------------------------------------------------------------

create or replace function public.call_push_function(payload jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://earcdglvoepdlauuupuw.supabase.co/functions/v1/push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', '__PUSH_SECRET__'
    ),
    body := payload
  );
end $$;

do $$
begin
  perform cron.unschedule('push-reminders');
exception when others then null;
end $$;

select cron.schedule(
  'push-reminders',
  '*/5 * * * *',
  $$select public.call_push_function('{"task": "reminders"}'::jsonb)$$
);

-- ---------------------------------------------------------------------------
-- Notification « résultat saisi » — trigger quand un match passe à finished
-- ---------------------------------------------------------------------------

create or replace function public.notify_match_finished() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'finished' and old.status is distinct from 'finished' then
    perform public.call_push_function(
      jsonb_build_object('task', 'result', 'match_id', new.id)
    );
  end if;
  return new;
end $$;

drop trigger if exists match_finished_push on public.matches;
create trigger match_finished_push
after update on public.matches
for each row execute function public.notify_match_finished();
