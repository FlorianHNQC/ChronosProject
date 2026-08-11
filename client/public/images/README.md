# Dossier des images

Toutes les images statiques du site vont ici, au format **WebP** (optimisé). Elles sont
servies à la racine sous `/images/<nom>.webp` (en dev via Vite, et copiées dans le build en prod).
Le code référence directement ces `.webp`. Si un fichier manque, l'élément reste affiché
(panneau/bandeau neutre + icône).

## Fichiers attendus

| Élément (raccourci d'accueil + bandeau de page) | Fichier |
| --- | --- |
| Fond du hero d'accueil (défaut) | `home-bg.webp` |
| Hydra | `hydra.webp` |
| Calendrier & résultats | `calendrier.webp` |
| Compétitions | `competitions.webp` |
| Équipes | `equipes.webp` |
| Joueurs | `joueurs.webp` |
| Statistiques | `stats.webp` |
| Récompenses | `recompenses.webp` |

Chaque image sert à la fois de vignette de raccourci sur l'accueil **et** de fond du bandeau
de la page correspondante.

## Générer les .webp optimisés

1. Dépose tes images brutes (`.jpg` / `.png` / `.webp`) dans `client/public/images/_raw/`
   (ce dossier est git-ignoré), en les nommant comme la colonne « Fichier » ci-dessus
   (ex. `hydra.jpg`).
2. Installe l'outil une fois :  `npm i -D sharp`
3. Lance :  `npm run optimize:images`  (ou `node scripts/optimize-images.mjs --width=1600 --quality=65`)
4. Les `.webp` optimisés apparaissent ici, prêts à être commités.

Comme les bandeaux/vignettes sont derrière un voile sombre, une qualité ~60-65 est
visuellement sans perte tout en réduisant fortement le poids.

L'image de fond du hero d'accueil reste modifiable en direct par un admin connecté
(bouton « Changer l'image de fond »), qui accepte un chemin comme `/images/home-bg.webp`
ou une URL externe.
