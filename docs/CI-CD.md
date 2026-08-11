# CI/CD — déploiement automatique via GitHub Actions

À chaque **push sur `foundation/monorepo`**, GitHub Actions :

1. **Vérifie** le code sur un runner propre : `npm ci`, `npm run check` (type-check),
   `npm run build`. Si ça échoue, le déploiement n'a pas lieu.
2. **Déploie** sur le VPS par SSH : le serveur s'aligne sur la branche
   (`git reset --hard`), réinstalle, rebuild et redémarre PM2 (`scripts/ci-deploy.sh`).

Les **Pull Requests** lancent seulement l'étape de vérification (pas de déploiement).

> `db:push` n'est **pas** exécuté automatiquement (drizzle-kit push est interactif
> et peut altérer des données). Quand le schéma change, lance-le à la main :
> `ssh … && cd ~/ChronosProject && npm run db:push`.

---

## Mise en place (une seule fois)

### 1. Créer une clé de déploiement dédiée

Sur ton poste (ne réutilise pas ta clé perso) :

```bash
ssh-keygen -t ed25519 -C "github-actions-chronos" -f chronos_deploy -N ""
# -> génère chronos_deploy (privée) et chronos_deploy.pub (publique)
```

### 2. Autoriser cette clé sur le VPS

```bash
# depuis ton poste (adapte l'IP / user)
ssh-copy-id -i chronos_deploy.pub root@TON_IP
# ou, manuellement :
cat chronos_deploy.pub | ssh root@TON_IP 'mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys'
```

### 3. Ajouter les secrets GitHub

Dépôt → **Settings → Secrets and variables → Actions → New repository secret** :

| Secret | Valeur |
| --- | --- |
| `VPS_HOST` | l'IP (ou le domaine) du serveur |
| `VPS_USER` | `root` (ou l'utilisateur de déploiement) |
| `VPS_SSH_KEY` | **tout** le contenu du fichier `chronos_deploy` (clé privée, lignes BEGIN/END comprises) |
| `VPS_PORT` | *(optionnel)* le port SSH s'il n'est pas 22 — décommente alors la ligne `port:` dans le workflow |

### 4. Préparer le serveur (état propre)

Le déploiement fait `git reset --hard origin/foundation/monorepo` : le serveur doit
donc refléter le dépôt.

```bash
ssh root@TON_IP
cd ~/ChronosProject
git remote -v                 # doit pointer sur le dépôt GitHub (accès en lecture OK)
git checkout foundation/monorepo
git fetch origin && git reset --hard origin/foundation/monorepo
```

- Le `.env` (secrets) et les dossiers git-ignorés (**images**, `public/uploads`) ne
  sont **pas** touchés par le reset.
- Vérifie que tout ce que tu avais édité à la main sur le serveur est bien **commité**
  dans le dépôt (port dans `ecosystem.config.cjs`, scripts…), sinon le reset l'écrase.

### 5. Activer

Commite et pousse le workflow :

```bash
git add .github/workflows/deploy.yml scripts/ci-deploy.sh docs/CI-CD.md
git commit -m "CI/CD: déploiement automatique via GitHub Actions"
git push origin foundation/monorepo
```

Le premier run apparaît dans l'onglet **Actions** du dépôt.

---

## Utilisation au quotidien

- **Déployer** : `git push` sur `foundation/monorepo`. Le pipeline vérifie puis déploie.
- **Déclencher à la main** : onglet Actions → *Deploy Chronos* → *Run workflow*.
- **Suivre** : onglet Actions (logs CI + logs SSH). Sur le serveur : `pm2 logs chronos`.
- **Changement de schéma** : après le déploiement, `npm run db:push` à la main sur le serveur.
- **Rollback** : `git revert`/`git push` (le pipeline redéploie l'état précédent), ou sur
  le serveur `git reset --hard <commit_ok> && bash scripts/ci-deploy.sh`.

## Notes

- Le build a lieu **deux fois** : sur le runner (validation) puis sur le VPS (déploiement
  réel). C'est voulu — les erreurs sont attrapées avant de toucher la prod.
- `scripts/deploy.sh` (déploiement manuel) reste utilisable ; `scripts/ci-deploy.sh` est
  la variante non-interactive pour l'automatisation.
- Pour passer plus tard la prod sur `main` : change les 3 occurrences de
  `foundation/monorepo` (2 dans `deploy.yml`, 1 dans l'appel `ci-deploy.sh`) et bascule
  le serveur sur `main`.
