# BetUs — Concours de pronostics Coupe du Monde 2026

Plan de création de la web app. Objectif : remplacer le groupe WhatsApp par une
plateforme propre, automatique et agréable, qui applique exactement le règlement
du concours.

⚠️ **Contrainte de calendrier : la Coupe du Monde commence le 11 juin 2026.**
Le plan est donc découpé en phases pour qu'un MVP utilisable soit en ligne
immédiatement, et que le reste (classement, notifications) suive dans les jours
qui viennent sans bloquer personne.

---

## 1. Ce que fait l'application

Pour les participants :
- **Inscription / connexion** simple (lien magique par e-mail, pas de mot de passe).
- **Pronostics d'avant-compétition** (6 réponses × 3 pts) : meilleur buteur,
  meilleur passeur, meilleur gardien, affiche de la finale, équipe gagnante,
  meilleur joueur. Verrouillés automatiquement au coup d'envoi du premier match.
- **Pronostics de match** pour chacun des 104 matchs : vainqueur (1 pt),
  buteur (3 pts), passeur (3 pts), score exact (5 pts) — max 12 pts/match.
  Saisie ouverte jusqu'au coup d'envoi, puis **verrouillage automatique côté
  serveur** (impossible de tricher, même en bidouillant la page).
- **Visibilité** : les pronostics des autres deviennent visibles une fois le
  match commencé (avant, chacun ne voit que les siens).
- **Classement en temps réel**, avec les départages du règlement :
  1) nombre de scores exacts, 2) nombre de buteurs trouvés, 3) nombre de passeurs trouvés.
- **Page match** : compte à rebours, pronostics de tout le monde, points gagnés.

Pour l'organisateur (compte admin) :
- **Saisie des résultats** après chaque match : score final, liste des buteurs,
  liste des passeurs. Les points de tout le monde se calculent automatiquement
  et le classement se met à jour instantanément.
- **Suivi des paiements** : case à cocher « a payé ses 30 € » par participant
  (le paiement lui-même reste sur Revolut, hors de l'app). Affichage de la
  cagnotte totale et de la répartition 70 % / 30 %.
- **Saisie des résultats finaux** de la compétition (buteur, passeur, gardien,
  finale, vainqueur, meilleur joueur) pour scorer les pronostics d'avant-compétition.

## 2. Architecture technique

| Brique | Choix | Pourquoi |
|---|---|---|
| Frontend | React + Vite + Tailwind CSS, site statique | Rapide à développer, déployable sur GitHub Pages |
| Hébergement front | GitHub Pages (déploiement auto via GitHub Actions) | Gratuit, zéro maintenance |
| Backend / données | **Supabase** (compte de l'organisateur) | Auth, base Postgres, temps réel, Edge Functions — plan gratuit largement suffisant pour un groupe d'amis |
| Auth | Supabase Auth, magic link par e-mail | Pas de mot de passe à gérer |
| Temps réel | Supabase Realtime | Le classement se met à jour en direct quand l'admin saisit un résultat |
| Notifications | Web Push (clés VAPID) + Supabase Edge Function + pg_cron | « Les pronostics ouvrent dans 1 h », « Résultats saisis, classement mis à jour » |
| Calendrier des matchs | Fichier de seed avec les 104 matchs (équipes, groupe, date/heure de coup d'envoi) | Pas de dépendance à une API payante ; les résultats sont saisis par l'admin de toute façon (aucune API gratuite ne donne les passeurs de façon fiable) |

**Coût total : 0 €.** Tout tient dans les plans gratuits.

### Modèle de données (Supabase / Postgres)

- `profiles` — pseudo, avatar, `is_admin`, `has_paid`.
- `matches` — phase (groupes, 8e, etc.), équipes, date/heure du coup d'envoi,
  statut, score final, buteurs (liste), passeurs (liste).
- `predictions` — un pronostic par (joueur, match) : vainqueur (1/N/2),
  score exact, buteur, passeur. Modifiable jusqu'au coup d'envoi.
- `tournament_predictions` — les 6 pronostics d'avant-compétition, un par joueur.
- `tournament_results` — les 6 réponses officielles, saisies par l'admin à la fin.

**Sécurité (Row Level Security)** — les règles du concours sont appliquées par
la base elle-même, pas seulement par l'interface :
- Un pronostic ne peut être créé/modifié que si `now() < coup d'envoi` (et avant
  le 1er match pour les pronostics d'avant-compétition).
- Chacun ne peut écrire que ses propres pronostics.
- Les pronostics des autres ne sont lisibles qu'une fois le match commencé.
- Seul l'admin peut écrire les résultats et cocher les paiements.

### Calcul des points

Vue SQL calculée côté base (source de vérité unique) :
- Vainqueur correct : 1 pt (le nul compte comme résultat en phase de groupes).
- Buteur pronostiqué présent dans la liste des buteurs du match : 3 pts.
- Passeur pronostiqué présent dans la liste des passeurs : 3 pts.
- Score exact : 5 pts.
- Avant-compétition : 3 pts par bonne réponse (6 max → 18 pts).
- Comparaison des noms insensible à la casse et aux accents (« Konaté » = « konate »).

Le classement est une vue agrégée avec les 3 critères de départage intégrés au tri.

## 3. Interface — direction design

Style **Apple / iOS** : épuré, fond clair, typographie système
(SF Pro / -apple-system), cartes arrondies avec ombres douces, effets de
verre dépoli (glassmorphism léger), micro-animations fluides, mode sombre
automatique. Pensé mobile d'abord (tout le monde pronostiquera depuis son téléphone).

Écrans :
1. **Accueil / Matchs** — matchs du jour et à venir, drapeaux, compte à rebours,
   badge « pronostic enregistré ✓ ».
2. **Fiche match** — formulaire de pronostic avant le match ; pendant/après :
   pronostics de tous + points gagnés.
3. **Classement** — podium, points, détail des départages, mise à jour en direct.
4. **Mes pronostics** — avant-compétition + historique match par match.
5. **Profil joueur** — stats (scores exacts, buteurs trouvés…).
6. **Admin** (visible uniquement par l'organisateur) — saisie résultats, paiements.

L'app sera une **PWA installable** : icône sur l'écran d'accueil de l'iPhone,
plein écran, et c'est ce qui permet les notifications push sur iOS.

## 4. Phasage (calé sur le calendrier de la compétition)

**Phase 1 — MVP en ligne avant le coup d'envoi** *(priorité absolue)*
- Projet Supabase : schéma, RLS, seed des 104 matchs.
- Auth magic link + profils.
- Saisie des pronostics d'avant-compétition et des pronostics de match,
  avec verrouillage automatique au coup d'envoi.
- Déploiement GitHub Pages.
→ Les copains peuvent s'inscrire et pronostiquer dès le premier match.

**Phase 2 — Résultats et classement** *(dans la foulée, avant la fin des premiers matchs)*
- Interface admin de saisie des résultats.
- Calcul des points + classement temps réel.
- Suivi des paiements / cagnotte.

**Phase 3 — Confort** *(première semaine de compétition)*
- PWA installable + notifications push (ouverture des pronostics ~1 h avant
  chaque match, résultats saisis).
- Page profil/stats, polish design, mode sombre.

## 5. Ce dont on a besoin de l'organisateur

1. **Créer un compte Supabase** (gratuit, ~2 minutes) sur supabase.com et
   créer un projet vide — toutes les données du concours seront chez lui.
   Nous transmettre l'URL du projet et les clés (ou un accès temporaire au
   dashboard pour la mise en place).
2. **Son adresse e-mail** pour créer le compte admin.
3. La **liste des participants** (juste pour vérifier qui s'est inscrit) —
   l'inscription elle-même se fait directement dans l'app.

L'hébergement du front (GitHub Pages / verss.ai) est pris en charge de notre côté.
