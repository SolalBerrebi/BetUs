-- BetUs — Cotes 1X2 (favori/outsider) façon Apple Sports. Récupérées une fois en
-- pré-match par l'Edge Function depuis /odds, stockées sur le match.
-- Shape : { home: number, draw: number, away: number, book: text }
alter table public.matches add column if not exists odds jsonb;
