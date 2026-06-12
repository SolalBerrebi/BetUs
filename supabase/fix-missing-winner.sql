-- BetUs — Complétion unique des pronos sans vainqueur alors que le score l'induit.
--
-- Certains pronos (saisis avant la déduction automatique côté UI) ont un score complet
-- mais aucun vainqueur : on déduit le vainqueur du score (h>a → home, h<a → away,
-- nul en phase de groupes → draw), puis on notifie chaque joueur concerné par push.
-- Le classement se recalcule tout seul (vues match_points / leaderboard).
-- Nul en élimination directe : non déductible (départage aux t.a.b.) → laissé tel quel.
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
  select
    p.user_id,
    p.match_id,
    m.home_team,
    m.away_team,
    case
      when p.pred_home_score > p.pred_away_score then 'home'
      when p.pred_home_score < p.pred_away_score then 'away'
      when m.stage = 'group' then 'draw'
    end as implied
  from public.predictions p
  join public.matches m on m.id = p.match_id
  where p.winner is null
    and p.pred_home_score is not null
    and p.pred_away_score is not null
    and not (p.pred_home_score = p.pred_away_score and m.stage <> 'group');

  select count(*) into n from _fix;
  raise notice 'Pronos sans vainqueur (déductible du score) : %', n;

  if n = 0 then
    return;
  end if;

  -- Détail (joueur, match, vainqueur déduit) pour journal/contrôle
  for items in select to_jsonb(f) from _fix f loop
    raise notice '  → %', items;
  end loop;

  -- 1) Compléter le vainqueur (le trigger de cohérence validera la valeur)
  update public.predictions p
  set winner = f.implied
  from _fix f
  where p.user_id = f.user_id and p.match_id = f.match_id;

  -- 2) Notifier chaque joueur concerné (tâche `direct` de l'edge function push)
  select jsonb_agg(jsonb_build_object(
    'user_id', user_id,
    'title', '✅ Prono complété',
    'body', format(
      'Ton prono %s–%s avait un score sans vainqueur : on a déduit le vainqueur du score. Tes points sont à jour.',
      home_team, away_team
    ),
    'url', format('/BetUs/#/match/%s', match_id),
    'tag', format('winner-fill-%s', match_id)
  ))
  into items
  from _fix;

  perform public.call_push_function(jsonb_build_object('task', 'direct', 'items', items));

  raise notice 'Vainqueur complété sur % prono(s).', n;
end $$;
