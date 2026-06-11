-- BetUs — Nettoyage unique des pronos incohérents (vainqueur ≠ score).
--
-- Annule (supprime) tout prono dont le vainqueur contredit le score, puis notifie chaque
-- joueur concerné par push. S'applique à TOUS les matchs (à venir, en cours, terminés).
--
-- Prérequis : schema.sql (à jour, avec le trigger predictions_coherence) et push.sql
--             (fonction call_push_function) déjà appliqués.
-- À exécuter une fois dans le SQL editor Supabase (rôle postgres → contourne RLS).
-- Idempotent : un 2ᵉ passage ne trouve plus rien à annuler.
--
-- Définition « incohérent » (score complet + vainqueur renseignés) :
--   • score décisif (h≠a) et vainqueur ≠ l'équipe qui mène ;
--   • score nul (h=a) en phase de groupes et vainqueur ≠ « nul » ;
--   • score nul (h=a) en élimination et vainqueur = « nul » (le départage est aux t.a.b.).
-- Un score nul + vainqueur home/away en élimination est COHÉRENT (qualif aux t.a.b.) → conservé.

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
  where p.winner is not null
    and p.pred_home_score is not null
    and p.pred_away_score is not null
    and (
      (p.pred_home_score <> p.pred_away_score
        and p.winner <> case when p.pred_home_score > p.pred_away_score then 'home' else 'away' end)
      or (p.pred_home_score = p.pred_away_score and m.stage = 'group' and p.winner <> 'draw')
      or (p.pred_home_score = p.pred_away_score and m.stage <> 'group' and p.winner = 'draw')
    );

  select count(*) into n from _bad;
  raise notice 'Pronos incohérents détectés : %', n;

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
    'title', '⚠️ Prono annulé',
    'body', format(
      'Ton prono %s–%s était incohérent (vainqueur ≠ score) et a été annulé.%s',
      home_team, away_team,
      case when started then '' else ' Reviens en saisir un nouveau avant le coup d''envoi !' end
    ),
    'url', format('/BetUs/#/match/%s', match_id),
    'tag', format('void-%s', match_id)
  ))
  into items
  from _bad;

  perform public.call_push_function(jsonb_build_object('task', 'direct', 'items', items));

  -- 2) Annuler (supprimer) les pronos incohérents
  delete from public.predictions p
  using _bad b
  where p.user_id = b.user_id and p.match_id = b.match_id;

  raise notice 'Pronos incohérents annulés : %', n;
end $$;
