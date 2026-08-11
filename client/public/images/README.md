# Dossier des images

Images statiques du site, au format **WebP**, servies à `/images/<nom>.webp`
(en dev via Vite, copiées dans le build en prod). Si un fichier manque, l'élément
reste propre (fond/bandeau neutre).

Deux notions distinctes :

## 1. Fond du site (commun à toutes les pages)

| Élément | Fichier |
| --- | --- |
| Fond du site (derrière tout le contenu) | `home-bg.webp` |

C'est le **fond global** appliqué sur toutes les pages. Un admin peut le remplacer
en direct depuis l'accueil (bouton « Changer le fond du site »), qui accepte un
chemin `/images/home-bg.webp` ou une URL. Réglage : `home_bg`.

## 2. Bandeaux de titre (une image PROPRE par page)

Chaque page a son bandeau, avec une image par défaut ci-dessous, **modifiable par
un admin sur la page elle-même** (bouton « Changer l'image du bandeau »). Réglages :
`hero_<page>`.

| Page | Fichier par défaut |
| --- | --- |
| Accueil | `home-bg.webp` (défaut ; remplaçable par un bandeau propre) |
| Hydra | `hydra.webp` |
| Calendrier & résultats | `calendrier.webp` |
| Compétitions | `competitions.webp` |
| Équipes | `equipes.webp` |
| Joueurs | `joueurs.webp` |
| Statistiques | `stats.webp` |
| Récompenses | `recompenses.webp` |

## Générer les .webp

1. Dépose tes images brutes dans `client/public/images/_raw/` (git-ignoré), nommées
   comme la colonne « Fichier » (ex. `hydra.jpg`).
2. `npm i -D sharp` (une fois), puis `npm run optimize:images`.
3. Les `.webp` optimisés apparaissent ici, prêts à commiter.
