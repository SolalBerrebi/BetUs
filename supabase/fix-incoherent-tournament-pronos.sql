-- BetUs — Nettoyage unique des pronos d'avant-compétition incohérents.
--
-- Contrairement aux pronos de match (une ligne = un match), un prono d'avant-compétition
-- regroupe 7 prédictions dans une seule ligne. On n'annule donc QUE la partie incohérente
-- (finale / vainqueur) et on conserve le reste (buteur, passeur, gardien, meilleur joueur).
-- Puis on notifie chaque joueur concerné par push.
--
-- Deux cas d'incohérence traités :
--   • finalist_a = finalist_b (même équipe deux fois)        → on vide finalist_a, finalist_b ET winner ;
--   • winner ne fait pas partie d'une finale déclarée        → on vide winner seul.
-- Un vainqueur sans aucun finaliste renseigné n'est PAS traité (incomplet, pas contradictoire).
--
-- Prérequis : schema.sql à jour (trigger tournament_predictions_coherence) et push.sql.
-- À exécuter une fois dans le SQL editor Supabase. Idempotent.

do $$
declare
  items jsonb;
  n int;
begin
  create temp table _bad_t on commit drop as
  select
    user_id,
    (finalist_a is not null and finalist_b is not null and finalist_a = finalist_b) as dup_finalists,
    (winner is not null
      and (finalist_a is not null or finalist_b is not null)
      and winner is distinct from finalist_a
      and winner is distinct from finalist_b) as bad_winner
  from public.tournament_predictions
  where (finalist_a is not null and finalist_b is not null and finalist_a = finalist_b)
     or (winner is not null
         and (finalist_a is not null or finalist_b is not null)
         and winner is distinct from finalist_a
         and winner is distinct from finalist_b);

  select count(*) into n from _bad_t;
  raise notice 'Pronos avant-compétition incohérents détectés : %', n;
  if n = 0 then
    return;
  end if;

  for items in select to_jsonb(b) from _bad_t b loop
    raise notice '  → %', items;
  end loop;

  -- 1) Notifier chaque joueur concerné
  select jsonb_agg(jsonb_build_object(
    'user_id', user_id,
    'title', '⚠️ Prono avant-compétition ajusté',
    'body', case
      when dup_finalists then
        'Ta finale était incohérente (deux fois la même équipe) : elle a été réinitialisée. Reviens choisir tes deux finalistes et le vainqueur.'
      else
        'Ton vainqueur ne faisait pas partie de tes finalistes : il a été réinitialisé. Reviens le choisir.'
    end,
    'url', '/BetUs/#/avant-competition',
    'tag', 'void-tournament'
  ))
  into items
  from _bad_t;

  perform public.call_push_function(jsonb_build_object('task', 'direct', 'items', items));

  -- 2a) Finalistes en double → on vide la finale entière (et donc le vainqueur)
  update public.tournament_predictions tp
  set finalist_a = null, finalist_b = null, winner = null
  from _bad_t b
  where tp.user_id = b.user_id and b.dup_finalists;

  -- 2b) Vainqueur hors finale (cas non couvert par 2a) → on vide le vainqueur seul
  update public.tournament_predictions tp
  set winner = null
  from _bad_t b
  where tp.user_id = b.user_id and b.bad_winner and not b.dup_finalists;

  raise notice 'Pronos avant-compétition ajustés : %', n;
end $$;
