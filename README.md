# BetUs ⚽️ — Pronos Coupe du Monde 2026

Web app de concours de pronostics entre amis pour la Coupe du Monde 2026.
**App : https://solalberrebi.github.io/BetUs/**

## Stack

- **Frontend** : React + Vite + Tailwind CSS v4, déployé sur GitHub Pages (workflow `.github/workflows/deploy.yml`).
- **Backend** : Supabase (auth e-mail/mot de passe, Postgres, Realtime). Schéma complet dans `supabase/schema.sql`.
- **Données** : les 104 matchs sont seedés depuis `data/matches.json`.

## Règles du concours (encodées en base)

- Pronostics de match : vainqueur 1 pt, buteur 3 pts, passeur 3 pts, score exact 5 pts (max 12 pts).
- Avant-compétition : 6 réponses × 3 pts, verrouillées au coup d'envoi du 1er match.
- Verrouillage **côté serveur** (RLS) : aucun prono accepté/modifié après le coup d'envoi ; les pronos des autres ne sont visibles qu'une fois le match commencé.
- Égalité au classement : 1) scores exacts, 2) buteurs trouvés, 3) passeurs trouvés.
- Comparaison des noms de joueurs insensible à la casse et aux accents.
- Cagnotte : 30 €/personne (suivi par l'admin, paiement hors app via Revolut) — 70 % au 1er, 30 % au 2e.

## Rôle admin (organisateur)

L'admin voit un onglet **Admin** : saisie des résultats (score, buteurs, passeurs, qualifié aux TAB),
assignation des équipes des matchs à élimination directe, suivi des paiements, résultats finaux de la
compétition. Les points et le classement se recalculent automatiquement (vues SQL `match_points` et
`leaderboard`), mis à jour en temps réel chez tous les participants.

Pour promouvoir un admin (SQL editor Supabase) :

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'email@exemple.fr');
```

## Développement

```bash
npm install
npm run dev      # http://localhost:5173/BetUs/
npm run build
```

Le schéma se (ré)applique en collant `supabase/schema.sql` dans le SQL editor Supabase (idempotent).
