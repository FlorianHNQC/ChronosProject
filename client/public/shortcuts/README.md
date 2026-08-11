# Images des raccourcis de la page d'accueil

Dépose ici les images des grands raccourcis (format paysage recommandé, ~400×200,
`.jpg` ou `.png`). Elles sont servies à la racine sous `/shortcuts/<nom>` et copiées
dans le build. Si un fichier manque, le raccourci reste affiché (panneau neutre + icône).

Noms de fichiers attendus :

| Raccourci | Fichier |
| --- | --- |
| Hydra | `hydra.jpg` |
| Calendrier & résultats | `calendrier.jpg` |
| Compétitions | `competitions.jpg` |
| Playoffs | `playoffs.jpg` |
| Équipes | `equipes.jpg` |
| Joueurs | `joueurs.jpg` |
| Statistiques | `stats.jpg` |
| Récompenses | `recompenses.jpg` |

## Image de fond de l'accueil

L'image de fond du hero est **`../home-bg.jpg`** (dans `client/public/home-bg.jpg`,
servie à `/home-bg.jpg`). C'est la valeur par défaut ; un admin connecté peut la
remplacer à la volée depuis la page d'accueil (bouton « Changer l'image de fond »,
qui accepte un chemin comme `/home-bg.jpg` ou une URL externe).
