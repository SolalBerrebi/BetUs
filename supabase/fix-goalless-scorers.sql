-- BetUs — Nettoyage unique des buteurs/passeurs sur un 0-0 prédit.
--
-- Un prono 0-0 ne peut avoir ni buteur ni passeur : on efface ces deux champs (le prono
-- score/vainqueur est conservé), puis on notifie chaque joueur concerné par push.
-- S'applique à TOUS les matchs (à venir, en cours, terminés).
--
-- Prérequis : schema.sql (à jour, avec le trigger predictions_coherence incluant la règle
--             0-0) et push.sql (fonction call_push_function) déjà appliqués.
-- À exécuter une fois dans le SQL editor Supabase (rôle postgres → contourne RLS).
-- Idempotent : un 2ᵉ passage ne trouve plus rien à effacer.

do $$
declare
  items jsonb;
  n int;
begin
  create temp table _bad on commit drop as
  select
    p.user_id,
    p.match_id,
    m.home_team,
    m.away_team,
    public.match_started(p.match_id) as started
  from public.predictions p
  join public.matches m on m.id = p.match_id
  where p.pred_home_score = 0
    and p.pred_away_score = 0
    and (p.scorer is not null or p.assister is not null);

  select count(*) into n from _bad;
  raise notice 'Pronos 0-0 avec buteur/passeur détectés : %', n;

  if n = 0 then
    return;
  end if;

  -- Détail (joueur, match) pour journal/contrôle
  for items in select to_jsonb(b) from _bad b loop
    raise notice '  → %', items;
  end loop;

  -- 1) Notifier chaque joueur concerné (tâche `direct` de l'edge function push)
  select jsonb_agg(jsonb_build_object(
    'user_id', user_id,
    'title', '⚠️ Prono ajusté',
    'body', format(
      'Ton prono %s–%s annonçait 0-0 : le buteur/passeur a été retiré (pas de but possible).%s',
      home_team, away_team,
      case when started then '' else ' Tu peux ajuster ton prono avant le coup d''envoi !' end
    ),
    'url', format('/BetUs/#/match/%s', match_id),
    'tag', format('goalless-%s', match_id)
  ))
  into items
  from _bad;

  perform public.call_push_function(jsonb_build_object('task', 'direct', 'items', items));

  -- 2) Effacer buteur et passeur des pronos 0-0 (le reste du prono est conservé)
  update public.predictions p
  set scorer = null, assister = null
  from _bad b
  where p.user_id = b.user_id and p.match_id = b.match_id;

  raise notice 'Buteurs/passeurs effacés sur % prono(s) 0-0.', n;
end $$;
