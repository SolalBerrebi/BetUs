-- BetUs — Détail auditable des points d'avant-compétition (1 ligne par poste).
-- La base reste la source de vérité du calcul (matching fuzzy inclus) ; le front
-- ne fait qu'afficher. security_invoker → respecte la RLS (visible une fois la
-- compétition commencée, comme les pronos d'avant-compétition).

drop view if exists public.tournament_breakdown;

create view public.tournament_breakdown
with (security_invoker = on) as
select tp.user_id, v.slot, v.item, v.pick, v.answer, v.points
from public.tournament_predictions tp
cross join public.tournament_results tr
cross join lateral (values
  (1, 'Meilleur buteur',  tp.top_scorer,   tr.top_scorer,
      case when public.name_matches(tp.top_scorer, tr.top_scorer) then 6 else 0 end),
  (2, 'Meilleur passeur', tp.top_assister, tr.top_assister,
      case when public.name_matches(tp.top_assister, tr.top_assister) then 8 else 0 end),
  (3, 'Meilleur gardien', tp.best_keeper,  tr.best_keeper,
      case when public.name_matches(tp.best_keeper, tr.best_keeper) then 10 else 0 end),
  (4, 'Finale',
      nullif(concat_ws(' – ', tp.finalist_a, tp.finalist_b), ''),
      nullif(concat_ws(' – ', tr.finalist_a, tr.finalist_b), ''),
      case when tr.finalist_a is not null and tr.finalist_b is not null
            and public.norm_name(tp.finalist_a) in (public.norm_name(tr.finalist_a), public.norm_name(tr.finalist_b))
            and public.norm_name(tp.finalist_b) in (public.norm_name(tr.finalist_a), public.norm_name(tr.finalist_b))
            and public.norm_name(tp.finalist_a) <> public.norm_name(tp.finalist_b)
           then 20 else 0 end),
  (5, 'Équipe gagnante', tp.winner, tr.winner,
      case when tr.winner is not null and public.norm_name(tp.winner) = public.norm_name(tr.winner) then 15 else 0 end),
  (6, 'Meilleur joueur', tp.best_player, tr.best_player,
      case when public.name_matches(tp.best_player, tr.best_player) then 6 else 0 end)
) as v(slot, item, pick, answer, points);
