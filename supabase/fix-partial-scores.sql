-- BetUs — Complétion unique des scores partiels (une case laissée sur « – »).
--
-- L'ancien sélecteur démarrait sur « – » : certains n'ont rempli qu'un côté du score.
-- On met la case vide à 0 (lecture la plus naturelle de « – »), le trigger de cohérence
-- déduit le vainqueur au passage, puis on notifie chaque joueur pour qu'il vérifie.
-- Ne touche que les matchs à venir (les joueurs peuvent encore ajuster).
--
-- Prérequis : schema.sql à jour (trigger predictions_coherence avec auto-complétion)
--             et push.sql (fonction call_push_function) déjà appliqués.
-- À exécuter une fois dans le SQL editor Supabase (rôle postgres → contourne RLS).
-- Idempotent : un 2ᵉ passage ne trouve plus rien à compléter.

do $$
declare
  items jsonb;
  n int;
begin
  create temp table _fix on commit drop as
  select p.user_id, p.match_id, m.home_team, m.away_team
  from public.predictions p
  join public.matches m on m.id = p.match_id
  where (p.pred_home_score is null) <> (p.pred_away_score is null)
    and m.status = 'scheduled';

  select count(*) into n from _fix;
  raise notice 'Pronos avec score partiel : %', n;

  if n = 0 then
    return;
  end if;

  for items in select to_jsonb(f) from _fix f loop
    raise notice '  → %', items;
  end loop;

  -- 1) Compléter la case vide à 0 (le trigger déduit le vainqueur si absent)
  update public.predictions p
  set pred_home_score = coalesce(p.pred_home_score, 0),
      pred_away_score = coalesce(p.pred_away_score, 0)
  from _fix f
  where p.user_id = f.user_id and p.match_id = f.match_id;

  -- 2) Notifier chaque joueur concerné (tâche `direct` de l'edge function push)
  select jsonb_agg(jsonb_build_object(
    'user_id', user_id,
    'title', '✍️ Vérifie ton prono',
    'body', format(
      'Ton prono %s–%s avait un score à moitié rempli : la case vide a été mise à 0. Ajuste-le avant le coup d''envoi si besoin !',
      home_team, away_team
    ),
    'url', format('/BetUs/#/match/%s', match_id),
    'tag', format('partial-%s', match_id)
  ))
  into items
  from _fix;

  perform public.call_push_function(jsonb_build_object('task', 'direct', 'items', items));

  raise notice 'Scores complétés sur % prono(s).', n;
end $$;
