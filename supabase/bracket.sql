-- BetUs — Propagation automatique du tableau final.
-- Quand l'admin valide le résultat d'un match à élimination directe, le
-- vainqueur (et le perdant, pour la petite finale) est inscrit automatiquement
-- dans le match suivant. La sortie des groupes (1A, 2B, 3e…) reste manuelle.

-- Slots d'origine ('W73', 'L101'…), mémorisés pour que la propagation reste
-- correcte même après assignation (corrections de résultat incluses).
alter table public.matches add column if not exists home_slot text;
alter table public.matches add column if not exists away_slot text;

update public.matches
set home_slot = case when home_slot is null and home_team ~ '^[WL]\d+$' then home_team else home_slot end,
    away_slot = case when away_slot is null and away_team ~ '^[WL]\d+$' then away_team else away_slot end
where stage <> 'group';

create or replace function public.propagate_knockout() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  w_name text; w_code text; l_name text; l_code text;
begin
  if new.stage = 'group' or new.status <> 'finished'
     or new.home_score is null or new.away_score is null then
    return new;
  end if;

  if new.home_score > new.away_score
     or (new.home_score = new.away_score and new.winner_override = 'home') then
    w_name := new.home_team; w_code := new.home_code;
    l_name := new.away_team; l_code := new.away_code;
  elsif new.away_score > new.home_score
     or (new.home_score = new.away_score and new.winner_override = 'away') then
    w_name := new.away_team; w_code := new.away_code;
    l_name := new.home_team; l_code := new.home_code;
  else
    return new;  -- égalité sans qualifié renseigné : on ne propage pas
  end if;

  update public.matches set home_team = w_name, home_code = w_code where home_slot = 'W' || new.id;
  update public.matches set away_team = w_name, away_code = w_code where away_slot = 'W' || new.id;
  update public.matches set home_team = l_name, home_code = l_code where home_slot = 'L' || new.id;
  update public.matches set away_team = l_name, away_code = l_code where away_slot = 'L' || new.id;
  return new;
end $$;

drop trigger if exists knockout_propagation on public.matches;
create trigger knockout_propagation
after update on public.matches
for each row execute function public.propagate_knockout();
