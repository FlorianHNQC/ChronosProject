#!/usr/bin/env bash
#
# Déploiement CI/CD — appelé par GitHub Actions via SSH sur le VPS.
# Aligne le dépôt sur origin/<branche>, installe, build, redémarre PM2.
#
# NE lance PAS `db:push` : les migrations de schéma se font à la main
# (`npm run db:push`) quand le schéma change, car drizzle-kit push est
# interactif et peut altérer des données.
#
# Usage :  bash scripts/ci-deploy.sh [branche]   (défaut : foundation/monorepo)
#
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BRANCH="${1:-foundation/monorepo}"
log() { printf "\n\033[1;36m==> %s\033[0m\n" "$1"; }
fail() { printf "\n\033[1;31m✗ %s\033[0m\n" "$1" >&2; exit 1; }

command -v pm2 >/dev/null 2>&1 || fail "PM2 non installé."
[ -f .env ] || fail "Fichier .env manquant à la racine."

log "Récupération du code (origin/$BRANCH)"
git fetch --prune origin
# Aligne EXACTEMENT sur la branche distante (écrase les modifs locales suivies ;
# .env et les dossiers git-ignorés — images, uploads — ne sont pas touchés).
git reset --hard "origin/$BRANCH"

log "Dépendances (npm ci)"
npm ci

log "Build de production (client + serveur)"
npm run build

log "(Re)démarrage via PM2"
if pm2 describe chronos >/dev/null 2>&1; then
  pm2 restart chronos --update-env
else
  pm2 start ecosystem.config.cjs
  pm2 save
fi

log "Déploiement terminé. Suivi : pm2 logs chronos"
