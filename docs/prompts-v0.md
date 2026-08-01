# Prompts v0 (Vercel) — refonte UI de Chronos

But : générer dans **v0.dev** une identité visuelle « e-sport » propre, puis chaque page,
dans un format directement intégrable à Chronos (React + Tailwind + **shadcn/ui**).

## Comment s'en servir

1. Colle d'abord le **Prompt 0 — Design system** dans un nouveau chat v0. Il pose le
   thème (couleurs, typo, composants). Garde ce chat : les pages suivantes réutiliseront le style.
2. Pour chaque page, ouvre le **même chat** (pour conserver le design system) et colle le
   prompt correspondant. Génère une page à la fois.
3. Quand une page te plaît, récupère le code et donne-le moi : je l'adapte à Chronos
   (routing Wouter, données TanStack Query, composants existants). Ne te soucie pas des
   `next/link`, `next/image` ni des données réelles — je m'en occupe à l'intégration.
4. **Ne régénère PAS la page Hydra** (déjà finalisée).

> Contraintes à laisser dans chaque prompt (déjà incluses ci-dessous) : React + TypeScript +
> Tailwind + shadcn/ui **uniquement**, pas d'API spécifiques à Next.js (`next/image`,
> `next/link`, server actions), données factices en props, interface **en français**, responsive,
> thème **sombre**.

---

## Prompt 0 — Design system (à coller en premier)

```
Tu es un designer produit e-sport. Crée le design system d'une plateforme web nommée
« CHRONOS », dédiée à la scène compétitive Brawl Stars d'une communauté (ligues, équipes,
classements, statistiques). Interface 100 % en français.

Stack imposée : React + TypeScript, Tailwind CSS et shadcn/ui UNIQUEMENT. N'utilise aucune
API spécifique à Next.js (pas de next/image, next/link, server actions). Composants clients
avec données factices passées en props. Tout doit être responsive (mobile-first) et en thème SOMBRE.

Direction artistique :
- Ambiance « gaming / e-sport » moderne, premium, sobre — pas criard, pas « template gratuit ».
- Fond sombre en dégradé subtil (proche du noir bleuté), surfaces (cards) légèrement plus claires
  avec bordure fine et un léger glow au survol.
- Une couleur d'accent électrique (propose 2 options : violet-indigo, ou cyan) + une secondaire.
- Typographie : titres condensés/impactants (ex. police display type "Geist"/"Inter" en extra-bold,
  tracking serré, éventuellement uppercase pour les grands titres), corps très lisible.
- Composants cohérents : boutons, badges de statut (À venir / En cours / Terminé / Annulé),
  cartes, tableaux, avatars, tags colorés, chips de compteur, onglets, fil d'ariane.
- Micro-détails : coins arrondis moyens, ombres douces, transitions au survol, states focus accessibles.

Livre : (1) une page « Style guide » montrant la palette, la typo, et tous les composants ci-dessus ;
(2) un layout applicatif avec une sidebar de navigation à gauche (sections : Accueil, Hydra,
Compétitions, Calendrier, Playoffs, Équipes, Joueurs, Statistiques, Récompenses) et une zone de
contenu. Header discret avec le logo « CHRONOS ». Prévois un bouton de connexion admin.
```

---

## Prompt 1 — Page d'accueil

```
[Réutilise le design system CHRONOS défini précédemment. React + Tailwind + shadcn/ui,
thème sombre, français, pas d'API Next.js, données factices.]

Conçois la PAGE D'ACCUEIL de Chronos. Objectif : donner envie et orienter, SANS afficher de
classement de joueurs (aucun ranking, aucun « top joueurs »).

Blocs :
1. Hero compact : titre « CHRONOS », baseline « La scène compétitive Brawl Stars de la communauté ».
   Quelques chips de compteurs (X joueurs, Y équipes, Z compétitions) et un bandeau discret
   « Compétition en cours : <nom> » cliquable.
2. Grille de RACCOURCIS vers les pages communautaires (cartes cliquables avec icône + libellé +
   courte description) : Hydra (classement par tiers), Calendrier & résultats, Compétitions,
   Playoffs, Équipes, Joueurs, Statistiques, Récompenses.
3. FIL D'ACTUALITÉ (timeline verticale, la pièce maîtresse) : liste chronologique d'événements
   hétérogènes, chacun avec une pastille d'icône colorée selon le type, un titre, une date et un
   sous-titre. Types d'événements : « Compétition lancée / clôturée » (nom de la compétition),
   « Résultat : Équipe A 3–1 Équipe B » (nom de la compétition en sous-titre), « Match à venir :
   Équipe A vs Équipe B » (avec un badge « À venir »), « Joueur de la semaine : <pseudo> ».
   Les événements à venir sont mis en avant en haut.

Pas de section « meilleurs joueurs ». Utilise 8–12 événements factices variés pour la démo.
```

---

## Prompt 2 — Calendrier & résultats

```
[Réutilise le design system CHRONOS. React + Tailwind + shadcn/ui, sombre, français, pas de Next.js.]

Conçois la page CALENDRIER & RÉSULTATS. Un vrai agenda, pas une simple liste.

- En-tête avec titre et un sélecteur de compétition (dropdown shadcn).
- Deux sections : « À venir » puis « Résultats & matchs passés ».
- Les matchs sont GROUPÉS PAR JOUR (en-tête de date lisible : « lundi 12 mai 2026 · 4 matchs »).
- Chaque ligne de match : badge de statut (À venir / En cours / Terminé / Annulé), équipe domicile
  à droite, score central (« 3 – 1 » si terminé, sinon « vs »), équipe extérieur à gauche, et à
  droite le mode de jeu + l'heure. Ligne cliquable (mène à la fiche match).
- Soigne la densité : lisible même avec beaucoup de matchs. Mets des données factices sur 2–3 jours.
```

---

## Prompt 3 — Fiche match

```
[Réutilise le design system CHRONOS. React + Tailwind + shadcn/ui, sombre, français, pas de Next.js.]

Conçois la FICHE MATCH (détail d'une rencontre).

- Bandeau haut : les deux équipes (logo + nom) de part et d'autre d'un grand score, badge de statut,
  et méta : compétition, mode de jeu, map, durée, modérateur, date/heure.
- Un tableau des STATISTIQUES DES JOUEURS pour ce match : par joueur, avatar + pseudo + équipe,
  puis colonnes brawler, dégâts infligés, dégâts subis/soignés, et un score de performance.
  Sépare visuellement les deux équipes.
- Un encart « Drifters » (joueurs mis en avant pour ce match) : 1 par équipe, avatar + pseudo.
- Optionnel : capture d'écran du match, notes.
Données factices réalistes (équipes de brawl stars, pseudos, chiffres).
```

---

## Prompt 4 — Compétitions

```
[Réutilise le design system CHRONOS. React + Tailwind + shadcn/ui, sombre, français, pas de Next.js.]

Conçois la page COMPÉTITIONS : l'historique et les compétitions en cours.

- Une compétition = une ligue ou un tournoi, avec un statut : Brouillon, Active, Archivée.
- Mets la compétition ACTIVE en avant (grande carte : nom, format, nb d'équipes, période, bouton
  « Voir le calendrier »).
- En dessous, une grille/liste des compétitions passées (archivées) : carte compacte avec nom,
  badge « Archivée », date de clôture, vainqueur, nb d'équipes/joueurs.
- Filtre par statut. Données factices : 1 active + plusieurs archivées.
```

---

## Prompt 5 — Playoffs

```
[Réutilise le design system CHRONOS. React + Tailwind + shadcn/ui, sombre, français, pas de Next.js.]

Conçois la page PLAYOFFS sous forme de VRAIE GRILLE (bracket) à élimination.

- Colonnes par tour (ex. Quarts, Demies, Finale), reliées par des connecteurs entre les séries.
- Chaque série = petite carte avec les deux équipes (logo + nom) et leur score de série (ex. 3–2),
  l'équipe gagnante mise en évidence.
- Sélecteur de compétition en haut. Scroll horizontal propre sur mobile.
Données factices : un bracket à 8 équipes cohérent.
```

---

## Prompt 6 — Équipes

```
[Réutilise le design system CHRONOS. React + Tailwind + shadcn/ui, sombre, français, pas de Next.js.]

Conçois la page ÉQUIPES.

- Grille de cartes d'équipe : logo, nom, compétition, et l'aperçu du roster (avatars empilés).
- Au clic, vue détaillée d'une équipe : bandeau (logo + nom + compétition) et la liste des joueurs
  du roster (avatar, pseudo, tier, rôle éventuel). Prévois un état « équipe incomplète ».
Données factices : plusieurs équipes de 3–4 joueurs.
```

---

## Prompt 7 — Joueurs (annuaire)

```
[Réutilise le design system CHRONOS. React + Tailwind + shadcn/ui, sombre, français, pas de Next.js.]

Conçois l'ANNUAIRE DES JOUEURS.

- Barre de recherche + filtres (par tier, par nationalité).
- Grille de cartes joueur compactes : avatar, pseudo, drapeau de nationalité, badge de tier coloré,
  Elo. Carte cliquable vers la fiche joueur.
- Affichage dense et fluide (beaucoup de joueurs). Données factices variées.
```

---

## Prompt 8 — Fiche joueur

```
[Réutilise le design system CHRONOS. React + Tailwind + shadcn/ui, sombre, français, pas de Next.js.]

Conçois la FICHE JOUEUR (profil détaillé).

- En-tête profil : grand avatar, pseudo, drapeau de nationalité, badge de tier coloré, Elo actuel,
  date d'arrivée dans la communauté, tags (chips colorés).
- Un bloc « Évolution de l'Elo » (petite courbe/sparkline) et quelques stats clés
  (matchs joués, compétitions, dégâts moyens).
- Un bloc « Équipes » (les équipes du joueur) et un bloc « Historique des matchs » (liste des
  derniers matchs avec adversaire, score, résultat gagné/perdu, date, cliquable).
Données factices réalistes.
```

---

## Prompt 9 — Statistiques

```
[Réutilise le design system CHRONOS. React + Tailwind + shadcn/ui, sombre, français, pas de Next.js.]

Conçois la page STATISTIQUES (classements agrégés par compétition).

- Sélecteur de compétition en haut.
- Un GRAND TABLEAU triable : rang, joueur (avatar + pseudo), équipe, matchs joués, dégâts totaux,
  dégâts moyens, meilleur brawler, score de performance. Lignes cliquables vers la fiche joueur.
- Éventuellement 2–3 cartes « leaders » en haut (plus gros total de dégâts, etc.).
Style tableau e-sport dense mais lisible. Données factices.
```

---

## Prompt 10 — Récompenses

```
[Réutilise le design system CHRONOS. React + Tailwind + shadcn/ui, sombre, français, pas de Next.js.]

Conçois la page RÉCOMPENSES (palmarès).

- Section « Awards de saison » : grille de cartes par catégorie (MVP, meilleur rookie, etc.),
  chaque carte = catégorie + joueur récompensé (avatar + pseudo) + justification courte.
- Section « Joueur de la semaine » : liste chronologique (date de la semaine + joueur + justification).
- Ton un peu « trophée/prestige ». Données factices.
```
