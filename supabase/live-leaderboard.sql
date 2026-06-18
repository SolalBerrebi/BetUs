-- BetUs — Classement en direct : exposer rank_snapshot en lecture aux joueurs
-- pour afficher le delta de rang ▲/▼ pendant les matchs (rangs uniquement, rien de
-- sensible). L'écriture reste réservée au service role (Edge Function).
drop policy if exists "rank_snapshot read" on public.rank_snapshot;
create policy "rank_snapshot read" on public.rank_snapshot
  for select to authenticated using (true);
