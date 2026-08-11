# Dossier des images

Toutes les images statiques du site vont ici. Elles sont servies à la racine sous
`/images/<nom>` (en dev via Vite, et copiées dans le build en prod).

## Page d'accueil

| Élément | Fichier | Chemin servi |
| --- | --- | --- |
| Image de fond du hero (défaut) | `home-bg.jpg` | `/images/home-bg.jpg` |
| Raccourci Hydra | `hydra.jpg` | `/images/hydra.jpg` |
| Raccourci Calendrier & résultats | `calendrier.jpg` | `/images/calendrier.jpg` |
| Raccourci Compétitions | `competitions.jpg` | `/images/competitions.jpg` |
| Raccourci Équipes | `equipes.jpg` | `/images/equipes.jpg` |
| Raccourci Joueurs | `joueurs.jpg` | `/images/joueurs.jpg` |
| Raccourci Statistiques | `stats.jpg` | `/images/stats.jpg` |
| Raccourci Récompenses | `recompenses.jpg` | `/images/recompenses.jpg` |

Format conseillé pour les raccourcis : paysage ~400×200, `.jpg` ou `.png`.
Si un fichier manque, l'élément reste affiché (panneau neutre + icône).

L'image de fond du hero est modifiable en direct par un admin connecté (bouton
« Changer l'image de fond »), qui accepte un chemin comme `/images/home-bg.jpg`
ou une URL externe.
