-- BetUs — Compositions (titulaires + formation) importées via API-Football.
-- L'Edge Function `livescore` remplit cette colonne ~40 min avant le coup d'envoi
-- (dès que l'API publie les compos), puis l'écran de détail affiche le terrain.
-- Shape : { home: { formation, coach, startXI:[{n,name,pos,grid}], subs:[...] }, away: {...} }
alter table public.matches add column if not exists lineups jsonb;
