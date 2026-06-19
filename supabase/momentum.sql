-- BetUs — Momentum du match (« Attack Momentum »). L'Edge Function dérive, à chaque
-- tick live, un échantillon de pression depuis l'évolution des stats + buts récents,
-- et l'append ici. Shape : [{ min: int, value: int(-100..100) }] (+ = domicile pousse).
alter table public.matches add column if not exists momentum jsonb;
